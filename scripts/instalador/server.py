#!/usr/bin/env python3
"""Instalador web de REPEAT-ONE.

Corre en el host, fuera de Docker, y solo con la biblioteca estándar. Sirve
una página para elegir módulos y rellenar sus variables. Clona los repos
elegidos y escribe los .env, pero nunca llama a Docker ni necesita su socket:
al final muestra el comando de scripts/up.sh para que lo ejecutes tú.

Las tablas de módulos no se duplican aquí: se leen de scripts/up.sh,
docker-compose.yml, README.md y los .env.example.

Uso normal: scripts/instalar.sh. A mano:
  python3 scripts/instalador/server.py [--host 127.0.0.1] [--port 8799]
  python3 scripts/instalador/server.py --check   # solo los requisitos
"""
from __future__ import annotations

import argparse
import datetime as dt
import http.server
import json
import os
import re
import secrets
import shutil
import socket
import socketserver
import subprocess
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ROOT_ENV = ROOT / ".env"
ROOT_ENV_EXAMPLE = ROOT / ".env.example"
COMPOSE = ROOT / "docker-compose.yml"
REPO_BASE = "https://github.com/volteret4"

# Mismo criterio que up.sh para ocultar lo que se escribe.
SECRET_RE = re.compile(r"(PASS|TOKEN|KEY|SECRET)")
VAR_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
# Las exporta up.sh; no son de ningún módulo.
GLOBAL_COMPOSE_VARS = {"PUID", "PGID"}


# ── .env ─────────────────────────────────────────────────────────────────────

def parse_env_text(text: str) -> dict[str, str]:
    """La última clave gana; quita comillas externas como get_var de up.sh."""
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.rstrip("\r")
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        out[key] = value
    return out


def read_env(path: Path) -> dict[str, str]:
    try:
        return parse_env_text(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return {}


def env_comments(path: Path) -> dict[str, str]:
    """Comentario justo encima de cada VAR= (activa o comentada) de un .env.example."""
    out: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return out
    comment: list[str] = []
    header = True  # el primer bloque de comentarios es la cabecera del fichero
    for line in lines:
        s = line.strip()
        m = re.match(r"^#?\s*([A-Z][A-Z0-9_]*)\s*=", s)
        if m:
            if comment and not header and m.group(1) not in out:
                out[m.group(1)] = " ".join(comment)
            comment, header = [], False
            continue
        if s.startswith("#"):
            text = s.lstrip("#").strip()
            if "──" in text:  # título de sección, no explica la variable
                comment, header = [], False
            elif text:
                comment.append(text)
        else:
            comment, header = [], header and not comment
    return out


def ensure_env(path: Path, example: Path) -> None:
    """Como up.sh: si no hay .env, se parte de .env.example."""
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if example.is_file():
        shutil.copyfile(example, path)
    else:
        path.touch()
    os.chmod(path, 0o600)


def write_env(path: Path, updates: dict[str, str]) -> list[str]:
    """Actualiza claves en su sitio y añade las nuevas al final, sin tocar el resto."""
    if not updates:
        return []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        lines = []
    pending = dict(updates)
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in updates:
                if key in seen:
                    continue  # duplicada: se queda una sola
                seen.add(key)
                out.append(f"{key}={pending.pop(key)}")
                continue
        out.append(line)
    if pending:
        if out and out[-1].strip():
            out.append("")
        out.extend(f"{k}={v}" for k, v in pending.items())
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp-instalador")
    tmp.write_text("\n".join(out) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    os.replace(tmp, path.resolve() if path.is_symlink() else path)
    return list(updates)


# ── Metadatos del repo ───────────────────────────────────────────────────────

def read_up_sh_tables() -> dict:
    """Extrae las tablas de up.sh ejecutando solo sus declaraciones."""
    script = r'''
set -e
cd "$1"
eval "$(sed -n -e '/^ORDER=(/p' \
  -e '/^declare -A REPO=(/,/^)/p' -e '/^declare -A DESC=(/,/^)/p' \
  -e '/^declare -A VARS=(/,/^)/p' -e '/^declare -A URLS=(/,/^)/p' scripts/up.sh)"
dump() { local -n t="$1"; local k; for k in "${!t[@]}"; do printf '%s\0%s\0%s\0' "$1" "$k" "${t[$k]}"; done; }
for p in "${ORDER[@]}"; do printf 'ORDER\0%s\0\0' "$p"; done
dump REPO; dump DESC; dump VARS; dump URLS
'''
    tables: dict = {"ORDER": [], "REPO": {}, "DESC": {}, "VARS": {}, "URLS": {}}
    try:
        res = subprocess.run(["bash", "-c", script, "_", str(ROOT)], capture_output=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return tables
    parts = res.stdout.decode("utf-8", "replace").split("\0")
    for i in range(0, len(parts) - 2, 3):
        table, key, value = parts[i], parts[i + 1], parts[i + 2]
        if table == "ORDER":
            tables["ORDER"].append(key)
        elif table in tables:
            tables[table][key] = value
    return tables


SERVICE_KEY_RE = re.compile(r"^  ([A-Za-z0-9_.-]+):\s*(#.*)?$")
PROFILES_RE = re.compile(r"^\s+profiles:\s*\[(.*?)\]")
INTERP_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-([^}]*))?\}")


def read_compose() -> list[dict]:
    """Recorre docker-compose.yml a mano: no hace falta PyYAML ni docker."""
    try:
        lines = COMPOSE.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    services: list[dict] = []
    cur: dict | None = None
    in_services = False
    for line in lines:
        if re.match(r"^\S", line):
            in_services = line.startswith("services:")
            cur = None
            continue
        if not in_services:
            continue
        m = SERVICE_KEY_RE.match(line)
        if m:
            cur = {"name": m.group(1), "profiles": [], "vars": {}, "sock": False}
            services.append(cur)
            continue
        if cur is None:
            continue
        code = line.split(" #", 1)[0]
        if code.strip().startswith("#"):
            continue
        m = PROFILES_RE.match(code)
        if m:
            cur["profiles"] = [p.strip().strip("\"'") for p in m.group(1).split(",") if p.strip()]
        if "docker.sock" in code:
            cur["sock"] = True
        for vm in INTERP_RE.finditer(code):
            cur["vars"].setdefault(vm.group(1), vm.group(2))
    return services


def read_readme_notes() -> dict[str, str]:
    """Notas «Antes de arrancar cada módulo» del README, por perfil."""
    notes: dict[str, str] = {}
    try:
        text = (ROOT / "README.md").read_text(encoding="utf-8")
    except OSError:
        return notes
    for line in text.splitlines():
        m = re.match(r"^- ((?:\*\*[A-Za-z0-9_]+\*\*(?:\s*(?:/|,|y)\s*)?)+):\s*(.+)$", line)
        if not m:
            continue
        for name in re.findall(r"\*\*([A-Za-z0-9_]+)\*\*", m.group(1)):
            notes.setdefault(name, m.group(2))
    return notes


def var_kind(name: str, default: str | None) -> str:
    if SECRET_RE.search(name):
        return "secret"
    if "PATH" in name or (default or "").startswith(("/", "./", "~")):
        return "path"
    return "text"


def build_modules() -> dict:
    tables = read_up_sh_tables()
    notes = read_readme_notes()
    by_profile: dict[str, list[dict]] = {}
    for svc in read_compose():
        for p in svc["profiles"]:
            by_profile.setdefault(p, []).append(svc)
    help_root = env_comments(ROOT_ENV_EXAMPLE)

    modules = []
    for p in tables["ORDER"]:
        repo = tables["REPO"].get(p, "")
        directory = f"services/{repo}" if repo else "."
        dir_path = ROOT / directory
        help_mod = env_comments(dir_path / ".env.example") if repo else {}
        variables = [{"name": v, "default": None, "compose": False} for v in tables["VARS"].get(p, "").split()]
        by_name = {v["name"]: v for v in variables}
        for svc in by_profile.get(p, []):
            for v, default in svc["vars"].items():
                if v in GLOBAL_COMPOSE_VARS:
                    continue
                if v in by_name:
                    by_name[v]["default"] = by_name[v]["default"] or default
                    continue
                by_name[v] = {"name": v, "default": default, "compose": True}
                variables.append(by_name[v])
        for v in variables:
            v["kind"] = var_kind(v["name"], v["default"])
            v["help"] = help_mod.get(v["name"]) or help_root.get(v["name"], "")
        modules.append({
            "id": p,
            "label": p.replace("_", " ").capitalize(),
            "group": "Sistema" if p == "scheduler" else "Módulos",
            "desc": tables["DESC"].get(p, ""),
            "dir": directory,
            "env_file": f"{directory}/.env" if repo else None,
            "repo": repo,
            "repo_url": f"{REPO_BASE}/{repo}" if repo else "",
            "present": not repo or (dir_path / ".git").exists(),
            "ports": tables["URLS"].get(p, "").split(),
            "sock": any(s["sock"] for s in by_profile.get(p, [])),
            "vars": variables,
            "notes": notes.get(p, ""),
        })
    return {"modules": modules, "groups": ["Módulos", "Sistema"]}


# ── Requisitos ───────────────────────────────────────────────────────────────

GUIDES = {
    "python3": "https://www.python.org/downloads/",
    "bash": "https://www.gnu.org/software/bash/",
    "git": "https://git-scm.com/downloads",
    "docker": "https://docs.docker.com/engine/install/",
    "compose": "https://docs.docker.com/compose/install/linux/",
    "docker_group": "https://docs.docker.com/engine/install/linux-postinstall/",
}


def _run(cmd: list[str], timeout: int = 15, cwd: Path | None = None) -> tuple[int, str]:
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
    except FileNotFoundError:
        return 127, ""
    except subprocess.TimeoutExpired:
        return 124, "tiempo agotado"
    return res.returncode, (res.stdout + res.stderr).strip()


def check_requirements() -> list[dict]:
    checks: list[dict] = []

    def add(cid, name, ok, detail, required=True, guide=None, fix=None):
        checks.append({"id": cid, "name": name, "ok": ok, "detail": detail,
                       "required": required, "guide": guide or GUIDES.get(cid), "fix": fix})

    v = sys.version_info
    add("python3", "Python 3.8 o posterior", v >= (3, 8), f"{v.major}.{v.minor}.{v.micro}")

    code, out = _run(["bash", "-c", 'echo "${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"'])
    ok = False
    if code == 0:
        major, minor = (int(x) for x in out.split(".")[:2])
        ok = (major, minor) >= (4, 3)
    add("bash", "Bash 4.3 o posterior (lo usa up.sh)", ok, out or "no encontrado",
        fix="En macOS: brew install bash" if not ok else None)

    code, out = _run(["git", "--version"])
    add("git", "Git", code == 0, out if code == 0 else "no encontrado")

    code, out = _run(["docker", "--version"])
    has_docker = code == 0
    add("docker", "Docker Engine", has_docker, out if has_docker else "no encontrado")

    code, out = _run(["docker", "compose", "version"])
    add("compose", "Docker Compose v2 (docker compose)", code == 0,
        out if code == 0 else "falta el plugin compose")

    if has_docker:
        code, out = _run(["docker", "info", "--format", "{{.ServerVersion}}"])
        if code == 0:
            add("daemon", "Acceso al daemon de Docker", True, f"servidor {out}")
        elif "permission denied" in out.lower():
            add("docker_group", "Acceso al daemon de Docker", False,
                "tu usuario no puede hablar con el daemon",
                fix="sudo usermod -aG docker $USER (y vuelve a iniciar sesión), o lanza up.sh con sudo")
        else:
            add("daemon", "Daemon de Docker en marcha", False, "el daemon no responde",
                guide=GUIDES["docker"], fix="sudo systemctl enable --now docker")
    return checks


# ── Acciones ─────────────────────────────────────────────────────────────────

def known_values(module_list: list[dict]) -> dict[str, str]:
    """Lo mismo que buscaría up.sh: primero el .env del módulo, luego el raíz."""
    known = {k: v for k, v in read_env(ROOT_ENV).items() if v}
    for m in module_list:
        if m["env_file"]:
            for k, v in read_env(ROOT / m["env_file"]).items():
                if v and k not in known:
                    known[k] = v
    return known


def describe_values(module_list: list[dict]) -> dict:
    known = known_values(module_list)
    root = read_env(ROOT_ENV)
    out = {}
    for m in module_list:
        for v in m["vars"]:
            name = v["name"]
            if name in out:
                out[name]["used_by"].append(m["id"])
                continue
            # Las del compose se interpolan desde el .env raíz; en el del
            # módulo pueden existir con otro sentido (rutas relativas a él).
            value = root.get(name) if v["compose"] else known.get(name)
            item = {"name": name, "kind": v["kind"], "help": v["help"], "default": v["default"],
                    "used_by": [m["id"]], "set": bool(value), "empty": False}
            if v["kind"] != "secret":
                item["value"] = value or v["default"] or ""
            out[name] = item
    return {"vars": list(out.values())}


def check_path(raw: str) -> dict:
    if not raw:
        return {"state": "empty"}
    p = Path(os.path.expanduser(raw))
    if not p.is_absolute():
        p = ROOT / p
    if p.is_dir():
        return {"state": "dir", "writable": os.access(p, os.W_OK), "path": str(p)}
    if p.is_file():
        return {"state": "file", "writable": os.access(p, os.W_OK), "path": str(p)}
    return {"state": "missing", "parent_exists": p.parent.is_dir(), "path": str(p)}


def clone_modules(module_list: list[dict]) -> dict:
    """Clona los repos que falten, como prepare_module de up.sh."""
    log: list[str] = []
    ok = True
    for m in module_list:
        if m["present"]:
            continue
        dest = ROOT / m["dir"]
        if dest.exists() and any(dest.iterdir()):
            log.append(f"⚠ {m['dir']} existe y no es un repo git. Muévelo antes de seguir.")
            ok = False
            continue
        log.append(f"$ git clone --depth 1 {m['repo_url']}.git {m['dir']}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        code, out = _run(["git", "clone", "-q", "--depth", "1", f"{m['repo_url']}.git", str(dest)],
                         timeout=900)
        if out:
            log.append(out)
        if code != 0:
            ok = False
            log.append(f"✗ falló el clon de {m['repo']}")
        else:
            log.append(f"✓ {m['repo']}")
    return {"ok": ok, "log": log}


def save(module_list: list[dict], values: dict[str, str]) -> dict:
    known = known_values(module_list)
    declared = {v["name"]: v for m in module_list for v in m["vars"]}
    chosen: dict[str, str] = {}
    pending: list[str] = []
    for name, v in declared.items():
        raw = str(values.get(name) or "")
        if "\n" in raw or "\r" in raw:
            raise ValueError(f"{name}: el valor no puede tener saltos de línea")
        if raw == "":
            if not known.get(name):
                pending.append(name)
            continue  # vacío: se conserva lo que haya (los secretos nunca llegan a la página)
        chosen[name] = raw

    ensure_env(ROOT_ENV, ROOT_ENV_EXAMPLE)
    root_now = read_env(ROOT_ENV)
    root_updates = {k: v for k, v in chosen.items() if root_now.get(k) != v}
    backup = None
    if root_updates:
        stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = ROOT / f".env.bak-instalador-{stamp}"  # .env.* está en .gitignore
        shutil.copy2(ROOT_ENV, backup)
        os.chmod(backup, 0o600)
    written_root = write_env(ROOT_ENV, root_updates)

    module_files: list[str] = []
    skipped: list[str] = []
    for m in module_list:
        if not m["env_file"]:
            continue
        env_path = ROOT / m["env_file"]
        if not env_path.parent.is_dir():
            skipped.append(m["id"])
            continue
        ensure_env(env_path, env_path.parent / ".env.example")
        now = read_env(env_path)
        own = {v["name"]: chosen[v["name"]] for v in m["vars"]
               if not v["compose"] and v["name"] in chosen and now.get(v["name"]) != chosen[v["name"]]}
        if write_env(env_path, own):
            module_files.append(f"{m['env_file']} ({len(own)})")
    return {"root_written": written_root, "backup": backup.name if backup else None,
            "module_files": module_files, "skipped": skipped, "pending": pending}


def commands_for(module_list: list[dict]) -> dict:
    prof = " ".join(f"--profile {m['id']}" for m in module_list)
    root = str(ROOT)
    return {
        "up": f"cd {root} && scripts/up.sh --yes {prof}",
        "ps": f"cd {root} && scripts/up.sh --yes {prof} ps",
        "logs": f"cd {root} && scripts/up.sh --yes {prof} logs -f --tail=100",
        "down": f"cd {root} && scripts/up.sh --yes {prof} down",
    }


# ── HTTP ─────────────────────────────────────────────────────────────────────

class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "repeat-one-instalador"
    token = ""
    allowed_hosts: set[str] = set()

    def log_request(self, code="-", size="-"):  # sin ruido salvo errores, y sin el token
        if str(code).startswith(("4", "5")):
            sys.stderr.write(f"  {code} {self.command} {self.path.split('?')[0]}\n")

    def _host_ok(self) -> bool:
        if not self.allowed_hosts:
            return True
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        return host in self.allowed_hosts

    def _authed(self) -> bool:
        for part in self.headers.get("Cookie", "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == "instalador" and secrets.compare_digest(v, self.token):
                return True
        return False

    def _send(self, code: int, body: bytes, ctype: str, extra: dict | None = None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, data):
        self._send(code, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def do_GET(self):
        if not self._host_ok():
            return self._send(403, b"Host no permitido", "text/plain")
        url = urllib.parse.urlsplit(self.path)
        if url.path == "/":
            q = urllib.parse.parse_qs(url.query)
            if q.get("t") and secrets.compare_digest(q["t"][0], self.token):
                return self._send(303, b"", "text/plain", {
                    "Location": "/",
                    "Set-Cookie": f"instalador={self.token}; HttpOnly; SameSite=Strict; Path=/",
                })
            if not self._authed():
                return self._send(401, "Abre el enlace con el token que muestra la terminal.".encode(),
                                  "text/plain; charset=utf-8")
            return self._send(200, (HERE / "index.html").read_bytes(), "text/html; charset=utf-8")
        if not self._authed():
            return self._json(401, {"error": "sin sesión"})
        if url.path == "/api/modules":
            return self._json(200, build_modules())
        if url.path == "/api/requirements":
            return self._json(200, {"checks": check_requirements()})
        return self._json(404, {"error": "no existe"})

    def do_POST(self):
        if not self._host_ok() or not self._authed() or self.headers.get("X-Instalador") != "1":
            return self._json(403, {"error": "petición no permitida"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(min(length, 1_000_000)) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "JSON no válido"})
        try:
            return self._json(200, self.route(urllib.parse.urlsplit(self.path).path, data))
        except ValueError as exc:
            return self._json(400, {"error": str(exc)})
        except Exception as exc:  # que la página muestre el fallo en vez de colgarse
            return self._json(500, {"error": f"{type(exc).__name__}: {exc}"})

    def route(self, path: str, data: dict):
        if path == "/api/check-path":
            return check_path(str(data.get("path", "")))
        mods = selected(data.get("profiles", []))
        if path == "/api/prepare":
            result = clone_modules(mods)
            result["values"] = describe_values(selected(data.get("profiles", [])))
            return result
        if path == "/api/values":
            return describe_values(mods)
        if path == "/api/save":
            values = {k: v for k, v in (data.get("values") or {}).items() if VAR_NAME_RE.match(k)}
            result = save(mods, values)
            result["commands"] = commands_for(mods)
            return result
        raise ValueError("ruta desconocida")


def selected(profiles) -> list[dict]:
    if not isinstance(profiles, list):
        raise ValueError("profiles debe ser una lista")
    mods = {m["id"]: m for m in build_modules()["modules"]}
    unknown = [p for p in profiles if p not in mods]
    if unknown:
        raise ValueError("módulos desconocidos: " + ", ".join(map(str, unknown)))
    return [mods[p] for p in profiles]


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def print_checks(checks: list[dict]) -> bool:
    all_ok = True
    for c in checks:
        mark = "✓" if c["ok"] else ("✗" if c["required"] else "·")
        print(f"  {mark} {c['name']}: {c['detail']}")
        if not c["ok"]:
            all_ok = all_ok and not c["required"]
            if c.get("fix"):
                print(f"      → {c['fix']}")
            if c.get("guide"):
                print(f"      → guía: {c['guide']}")
    return all_ok


def main():
    sys.stdout.reconfigure(line_buffering=True)  # la URL debe verse aunque la salida vaya a un log
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=0, help="por defecto el primero libre desde 8799")
    ap.add_argument("--check", action="store_true", help="solo comprueba requisitos y sale")
    args = ap.parse_args()

    if args.check:
        sys.exit(0 if print_checks(check_requirements()) else 1)

    ports = [args.port] if args.port else list(range(8799, 8830))
    httpd = None
    for port in ports:
        try:
            httpd = Server((args.host, port), Handler)
            break
        except OSError:
            continue
    if httpd is None:
        sys.exit(f"No hay ningún puerto libre en {ports[0]}-{ports[-1]}; usa --port.")
    port = httpd.server_address[1]
    Handler.token = secrets.token_urlsafe(24)
    local = args.host in ("127.0.0.1", "localhost", "::1")
    if local:
        Handler.allowed_hosts = {"127.0.0.1", "localhost", "::1"}
    shown = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host
    print(f"\nInstalador en marcha: http://{shown}:{port}/?t={Handler.token}")
    if local:
        print("Si este equipo no tiene navegador, abre un túnel desde el tuyo y usa el mismo enlace:")
        print(f"  ssh -N -L {port}:127.0.0.1:{port} {os.environ.get('USER', 'usuario')}@{socket.gethostname()}")
    else:
        print(f"Escuchando en {args.host}: cambia 127.0.0.1 por la IP de este equipo.")
        print("Aviso: sin HTTPS, las contraseñas viajan en claro por la red.")
    print("Ctrl+C para cerrarlo.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nInstalador cerrado.")


if __name__ == "__main__":
    main()
