#!/usr/bin/env python3
"""Graba una demo de un servicio local de REPEAT-ONE para publicarla como estática.

Abre la web del servicio (por un túnel SSH a 127.0.0.1:<puerto>), guarda el HTML,
los ficheros que carga y las respuestas GET de su API mientras se ejecutan unas
interacciones, y deja en demo/<mod>/ una copia que demo/_replay/replay.js
reproduce sin servidor.

Seguridad: ninguna petición que no sea GET llega al servicio (se contesta {ok:true}
sin enviarla), salvo las rutas de solo lectura de --post-ro. El panel ⚙ no se graba.
Las rutas y nombres de la red se borran de todo lo guardado (scrub()).

  record.py --mod gaps --port 5023 --steps steps/gaps.js
"""
import argparse
import asyncio
import hashlib
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright

DEMO = Path(__file__).resolve().parents[2] / 'demo'
SKIP = ('settings-panel.js', '/api/settings', 'theme-picker.js')
# GET que podrían lanzar trabajo en el servicio: nunca se envían.
ACTION_GET = re.compile(r'/(?:sync|scan|refresh|rescan|copy|delete|download|run|update|exchange|upload|follow|unfollow|import|publish|jobs/run)(?:/|$|\?)', re.I)

# Lo que no debe salir de casa: rutas del NAS y del servidor, IPs y nombres de equipos.
PATH_RE = re.compile(r'(?:file://)?(?:/mnt|/home|/media|/srv|/data|/music|/downloads|/volume\d*|/share)(?:/[^"\'<>\\\n`]+)+')
HOST_RE = re.compile(r'\b(?:pepe-?cono|pollete|moode|dietpi|frodobolson)\b|\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d{1,3}\.\d{1,3}\b|[\w.-]+\.duckdns\.org', re.I)


PATH_ENC_RE = re.compile(r'%2F(?:mnt|home|media|srv|data|music|downloads|share|volume\d*)(?:%2F[^&"\'\s<>]+)+', re.I)


SECRET_QS_RE = re.compile(r'((?:[?&]|&amp;)(?:torrent_?pass|passkey|authkey|auth|apikey|api_key|token|key|secret|sid|pass)=)[^&"\'\s<>]+', re.I)


def scrub(text):
    def short(m):
        parts = [p for p in m.group(0).split('/') if p]
        return '…/' + parts[-1]
    text = PATH_RE.sub(short, text)
    text = PATH_ENC_RE.sub('…', text)
    # Credenciales en URLs (trackers privados, APIs): fuera el valor.
    text = SECRET_QS_RE.sub(lambda m: m.group(1) + '…', text)
    return HOST_RE.sub('…', text)


def fnv(text):
    """FNV-1a de 32 bits sobre unidades UTF-16 (como charCodeAt en replay.js): clave de un POST de solo lectura."""
    h = 0x811c9dc5
    b = text.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, '08x')


# Referencias a otro servicio en el mismo host (p. ej. ya_lo_tengo en :8780): pasan a la copia en p<puerto>/.
CROSS_RE = re.compile(r"""location\.protocol\s*\+\s*['"]//['"]\s*\+\s*location\.hostname\s*\+\s*['"]:(\d+)/""")


def local_refs(text):
    text = CROSS_RE.sub(r"'./p\1/", text)
    text = re.sub(r'''(["'`(=]\s*)/api/''', r'\1./api/', text)
    # owned-badges.js toma como base el origen de su script: en la demo, su carpeta.
    return text.replace('new URL(script.src).origin', "new URL('.', script.src).href.replace(/\\/$/, '')")


def thumb(body, size=200):
    """Imagen reducida (mismo formato): las portadas originales pesan demasiado para una demo."""
    try:
        import io
        from PIL import Image
        im = Image.open(io.BytesIO(body))
        fmt = im.format or 'JPEG'
        im.thumbnail((size, size))
        if fmt == 'JPEG' and im.mode not in ('RGB', 'L'):
            im = im.convert('RGB')
        buf = io.BytesIO()
        im.save(buf, fmt, **({'quality': 75} if fmt == 'JPEG' else {'optimize': True}))
        return buf.getvalue() if buf.tell() < len(body) else body
    except Exception:
        return body


def trim(obj, n):
    """Deja como mucho n elementos en cada lista grande (recursivo)."""
    if isinstance(obj, list):
        return [trim(x, n) for x in obj[:n]]
    if isinstance(obj, dict):
        return {k: trim(v, n) for k, v in obj.items()}
    return obj


async def main(a):
    if a.owned:
        a.ports = a.ports + [8780]
        a.post_ro = a.post_ro + ['p8780/api/owned']
    ports = [a.port] + a.ports
    out = DEMO / a.mod
    store = {}  # clave -> (content-type, bytes)
    owned = {}  # marcas de ya_lo_tengo: "artista\u0001disco" -> resultado

    def key_of(url):
        u = urlsplit(url)
        path = u.path.lstrip('/')
        if u.port != a.port:
            path = f'p{u.port}/{path}'
        return path + (f'?{u.query}' if u.query else '')

    async def handle(route):
        req = route.request
        k = key_of(req.url)
        if a.html and k == a.start.lstrip('/'):
            # Página que no sirve el servicio (p. ej. la sirve SWAG): se toma de un fichero.
            body = Path(a.html).read_bytes()
            store[k] = ('text/html', body)
            return await route.fulfill(status=200, content_type='text/html', body=body)
        if any(s in req.url for s in SKIP) or (a.skip and re.search(a.skip, k)):
            return await route.fulfill(status=404, body='')
        if req.method in ('GET', 'HEAD') and ACTION_GET.search('/' + k.split('?')[0]):
            return await route.fulfill(status=200, content_type='application/json', body='{"ok":true,"simulated":true}')
        if req.method not in ('GET', 'HEAD'):
            if k.split('?')[0] not in a.post_ro:
                return await route.fulfill(status=200, content_type='application/json', body='{"ok":true,"simulated":true}')
            k += '#b' + fnv(req.post_data or '')
        resp = await route.fetch()
        body = await resp.body()
        if resp.ok and k.split('#')[0].endswith('api/owned'):
            # Se guarda disco a disco: la demo contesta cualquier combinación que pida la página.
            items = json.loads(req.post_data or '{}').get('items', [])
            for it, r in zip(items, json.loads(body).get('results', [])):
                owned[f"{it.get('artist', '').strip().lower()}\u0001{it.get('album', '').strip().lower()}"] = r
        elif resp.ok:
            store[k] = (resp.headers.get('content-type', ''), body)
        await route.fulfill(response=resp, body=body)

    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 1300, 'height': 900})
        for port in ports:
            await ctx.route(f'http://127.0.0.1:{port}/**', handle)
        pg = await ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)[:200]))
        # Un confirm()/alert() bloquearía la página: se descartan (y así tampoco se confirma nada).
        pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
        await pg.goto(f'http://127.0.0.1:{a.port}{a.start}', wait_until='load')
        await pg.wait_for_timeout(a.wait)
        if a.steps:
            # Pasos del módulo: una función async (page.evaluate) que usa la web como lo haría alguien.
            try:
                await asyncio.wait_for(pg.evaluate(f'async () => {{ const sleep = ms => new Promise(r => setTimeout(r, ms)); {Path(a.steps).read_text()} }}'), timeout=480)
            except asyncio.TimeoutError:
                errors.append('pasos: más de 8 minutos, se graba lo que haya')
            await pg.wait_for_timeout(a.wait)
        for page in a.pages:
            try:
                await pg.goto(f'http://127.0.0.1:{a.port}{page}', wait_until='load')
                await pg.wait_for_timeout(a.wait)
            except Exception as e:
                errors.append(f'{page}: {str(e)[:80]}')
        for extra in a.fetch:
            await pg.evaluate('u => fetch(u).then(r => r.text()).catch(() => null)', extra)
        await pg.wait_for_timeout(800)
        await b.close()

    if out.exists():
        shutil.rmtree(out)
    (out / 'data').mkdir(parents=True)
    replay_map, total, pages = {}, 0, {}
    start_key = a.start.lstrip('/')
    for k, (ctype, body) in sorted(store.items()):
        path = k.split('?')[0]
        binary = ctype.startswith(('image/', 'audio/', 'video/', 'application/octet-stream', 'font/'))
        is_api = 'json' in ctype or ('/api/' in '/' + path and not binary)
        if is_api:
            try:
                data = json.loads(body)
                if a.trim:
                    data = trim(data, a.trim)
                text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
            except ValueError:
                text = body.decode('utf-8', 'replace')
            name = 'data/' + hashlib.sha1(k.encode()).hexdigest()[:12] + '.json'
            (out / name).write_text(scrub(text), encoding='utf-8')
            replay_map[k] = name
            total += len(text)
            continue
        if k == start_key or (path in ('', start_key) and 'html' in ctype):
            continue  # la página principal se escribe aparte
        if 'text/html' in ctype and '/' + path in a.pages:
            pages[path.strip('/')] = body  # otras páginas: también con el replay
            continue
        if '?' in k or not path or path.endswith('/'):
            # Misma ruta con distintos parámetros (p. ej. /api/cover?path=…): un fichero por consulta.
            ext = Path(path).suffix or {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif'}.get(ctype.split(';')[0], '')
            path_out = 'data/' + hashlib.sha1(k.encode()).hexdigest()[:12] + ext if '?' in k else path + 'index.html'
        else:
            path_out = path
        dest = out / path_out
        dest.parent.mkdir(parents=True, exist_ok=True)
        if any(t in ctype for t in ('javascript', 'css', 'html', 'text', 'svg')):
            text = body.decode('utf-8', 'replace')
            text = re.sub(r'''(["'`(])/(static|assets|img|images|css|js|covers|fonts)/''', r'\1./\2/', text)
            dest.write_text(scrub(local_refs(text)), encoding='utf-8')
        elif ctype.startswith('image/') and len(body) > 20_000:
            dest.write_bytes(thumb(body))
        else:
            dest.write_bytes(body)
        replay_map[k] = path_out
        total += len(body)

    if owned:
        (out / 'data/owned.json').write_text(scrub(json.dumps(owned, ensure_ascii=False)), encoding='utf-8')
        replay_map['__owned__'] = 'data/owned.json'

    if a.post:
        # Ajustes propios del módulo (p. ej. dejar en la lista solo lo grabado).
        ns = {'out': out, 'map': replay_map, 'json': json, 'scrub': scrub, 'fnv': fnv}
        exec(compile(Path(a.post).read_text(), a.post, 'exec'), ns)
        patch_html = ns.get('patch_html')
    else:
        patch_html = None

    search = {}
    for spec in a.search:  # ruta:parámetro[:clave de la lista]
        path, param, *lst = spec.split(':')
        search[path] = {'param': param, 'list': lst[0] if lst else None}
    cfg = {'mod': a.mod, 'root': '', 'ports': a.ports, 'map': replay_map, 'readOnlyPosts': a.post_ro, 'search': search}
    if a.lastfm_key:
        cfg['lastfmKeyPath'] = a.lastfm_key

    def page_html(raw, depth=0):
        """Prepara una página: sin panel ⚙, rutas relativas y el replay en la cabecera.
        Las páginas de subcarpetas llevan <base> a la raíz de la demo, así todo resuelve igual."""
        html = raw.decode('utf-8', 'replace')
        html = re.sub(r'<script[^>]*(?:settings-panel|theme-picker)\.js[^>]*>.*?</script>', '', html, flags=re.S)
        html = local_refs(html)
        if patch_html:
            html = patch_html(html)
        html = re.sub(r'''(\s(?:src|href)=["'])/(?!/)''', r'\1./', html)
        html = re.sub(r'''(["'`(])/(static|assets|img|images|css|js|covers|fonts)/''', r'\1./\2/', html)
        head = ((f'<base href="{"../" * depth}">' if depth else '') +
                '<link rel="stylesheet" href="../_replay/replay.css">'
                f'<script>window.REPLAY = {json.dumps(cfg, ensure_ascii=False)};</script>'
                '<script src="../_replay/replay.js"></script>'
                '<script defer src="https://cloud.umami.is/script.js" data-website-id="5d84fd6c-0760-4a0c-a2d0-ffabb82179f5"></script>')
        return scrub(re.sub(r'<head[^>]*>', lambda m: m.group(0) + head, html, count=1))

    (out / 'index.html').write_text(page_html(store.get(start_key, store.get('', ('', b'')))[1]), encoding='utf-8')
    for path, raw in pages.items():
        dest = out / path / 'index.html'
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page_html(raw, depth=path.count('/') + 1), encoding='utf-8')
    print(f'{a.mod}: {len(store)} respuestas, {len(replay_map)} en el mapa, {total / 1024:.0f} KB; errores JS: {errors[:3]}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--mod', required=True, help='id del módulo en modules.js (carpeta demo/<mod>/)')
    ap.add_argument('--port', type=int, required=True, help='puerto de la web (túnel a pepecono)')
    ap.add_argument('--ports', type=int, nargs='*', default=[], help='otros puertos que llama la web (API aparte)')
    ap.add_argument('--start', default='/', help='ruta de la página principal')
    ap.add_argument('--html', help='HTML local que hace de página principal (si el servicio no la sirve)')
    ap.add_argument('--pages', nargs='*', default=[], help='otras páginas de la web que grabar (p. ej. /stats)')
    ap.add_argument('--steps', help='JS con las interacciones a grabar')
    ap.add_argument('--fetch', nargs='*', default=[], help='URLs extra que grabar')
    ap.add_argument('--post-ro', nargs='*', default=[], help='rutas POST de solo lectura que sí se envían')
    ap.add_argument('--post', help='Python con ajustes del módulo tras grabar (recibe out, map, json)')
    ap.add_argument('--search', nargs='*', default=[], help='búsquedas que el replay resuelve filtrando lo grabado: ruta:parámetro[:lista]')
    ap.add_argument('--skip', help='regex de claves que no se graban (p. ej. vídeos o audio)')
    ap.add_argument('--lastfm-key', help='ruta que la web usa para pedir la API key de Last.fm: la pone el visitante')
    ap.add_argument('--owned', action='store_true', help='graba también las marcas de ya_lo_tengo (:8780)')
    ap.add_argument('--trim', type=int, default=0, help='máximo de elementos por lista en las respuestas JSON')
    ap.add_argument('--wait', type=int, default=3000, help='ms de espera tras cargar y tras los pasos')
    asyncio.run(main(ap.parse_args()))
