#!/usr/bin/env bash
# Instalador de REPEAT-ONE: eliges módulos, clona los repos y prepara cada .env.
#
#   scripts/up.sh                                menú y "up -d --build"
#   scripts/up.sh --list                         lista los módulos
#   scripts/up.sh --profile encarta              sin menú (repetible)
#   scripts/up.sh --yes --profile encarta        sin preguntar variables
#   scripts/up.sh --profile encarta logs -f      otro subcomando de docker compose
set -euo pipefail
cd "$(dirname "$0")/.."

ORDER=(dieta_sonora bandcamp freshrss charts_sellos charts_artistas escuchowsky encarta sellos_discograficos scheduler)

declare -A REPO=(
  [dieta_sonora]=dieta-sonora [bandcamp]=bancamp_imap [freshrss]=freshrss_embeeds
  [charts_sellos]=charts_sellos [charts_artistas]=charts_artistas [escuchowsky]=escuchowsky
  [encarta]=encarta [sellos_discograficos]=sellos-discograficos
)
declare -A DESC=(
  [dieta_sonora]="lanzamientos de Muspy, con descargas desde tu NAS de música compartida"
  [bandcamp]="web de escucha a partir de tus correos de Bandcamp"
  [freshrss]="reproductores de la música enlazada en tus feeds"
  [charts_sellos]="catálogo de un sello"
  [charts_artistas]="discografía de un artista"
  [escuchowsky]="escuchowsky, musthear y tumtumpa-discover (necesita must_hear.db)"
  [encarta]="enciclopedia de consulta (necesita encarta.db)"
  [sellos_discograficos]="tu colección por sello y productor (necesita musica_local.sqlite)"
  [scheduler]="tareas diarias con Ofelia (usa el socket de Docker)"
)
declare -A VARS=(
  [dieta_sonora]="MUSPY_USERID NAS_URL NAS_API_KEY LASTFM_API_KEY SETTINGS_PASSWORD"
  [bandcamp]="IMAP_SERVER IMAP_PORT IMAP_EMAIL IMAP_PASSWORD IMAP_FOLDERS UPDATE_TOKEN"
  [freshrss]="FRESHRSS_SERVER FRESHRSS_USER FRESHRSS_PASS FRESHRSS_FEEDS"
  [charts_sellos]="LASTFM_API_KEY DISCOGS_TOKEN"
  [charts_artistas]="LASTFM_API_KEY DISCOGS_TOKEN"
  [escuchowsky]="LASTFM_API_KEY YOUTUBE_API_KEY"
  [encarta]=""
  [sellos_discograficos]="DISCOGS_TOKEN LASTFM_API_KEY"
  [scheduler]=""
)
declare -A URLS=(
  [dieta_sonora]="5010" [bandcamp]="8765" [freshrss]="8766" [charts_sellos]="8792" [charts_artistas]="8793"
  [escuchowsky]="8751 8752 8753" [encarta]="8777" [sellos_discograficos]="8758"
)
# Ficheros y carpetas que Docker montaría como directorio si no existen.
declare -A TOUCH=(
  [sellos_discograficos]="musica_local.sqlite"
)
declare -A MKDIR=(
  [dieta_sonora]="data data/watch_torrents"
  [charts_sellos]="data"
  [charts_artistas]="data"
  [escuchowsky]="db"
  [encarta]="data"
  [sellos_discograficos]="covers"
)

ASSUME_YES=0
PROFILES=()
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --list) for p in "${ORDER[@]}"; do printf '%-22s %s\n' "$p" "${DESC[$p]}"; done; exit 0 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --profile) shift; PROFILES+=("${1:?falta el nombre del módulo}") ;;
    *) ARGS+=("$1") ;;
  esac
  shift
done
[ ${#ARGS[@]} -gt 0 ] || ARGS=(up -d --build)

command -v docker >/dev/null || { echo "Hace falta Docker." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Hace falta el plugin docker compose." >&2; exit 1; }

if [ ${#PROFILES[@]} -eq 0 ]; then
  [ -t 0 ] || { echo "Sin terminal: indica los módulos con --profile." >&2; exit 1; }
  echo "Módulos de REPEAT-ONE:"
  i=1
  for p in "${ORDER[@]}"; do printf '%3d) %-22s %s\n' "$i" "$p" "${DESC[$p]}"; i=$((i + 1)); done
  read -r -p "Números separados por espacios (o «todos»): " choice
  if [ "$choice" = todos ]; then
    PROFILES=("${ORDER[@]}")
  else
    for n in $choice; do
      case "$n" in ''|*[!0-9]*) echo "No entiendo «$n»." >&2; exit 1 ;; esac
      [ "$n" -ge 1 ] && [ "$n" -le ${#ORDER[@]} ] || { echo "No existe el módulo $n." >&2; exit 1; }
      PROFILES+=("${ORDER[$((n - 1))]}")
    done
  fi
  [ ${#PROFILES[@]} -gt 0 ] || { echo "No has elegido ningún módulo."; exit 0; }
fi
for p in "${PROFILES[@]}"; do
  [ -n "${DESC[$p]:-}" ] || { echo "Módulo desconocido: $p (mira --list)." >&2; exit 1; }
done

ROOT_ENV=.env
[ -f "$ROOT_ENV" ] || cp .env.example "$ROOT_ENV"
chmod 600 "$ROOT_ENV"

get_var() { # fichero variable → valor, sin comillas externas
  [ -f "$1" ] || return 0
  sed -n "s/^$2=//p" "$1" | tail -n 1 | sed -e "s/^[\"']//" -e "s/[\"']$//"
}
set_var() { # fichero variable valor. Sin sed: el valor puede traer cualquier carácter.
  VAR_NAME="$2" VAR_VALUE="$3" python3 - "$1" <<'PY'
import os, sys
path, name, value = sys.argv[1], os.environ['VAR_NAME'], os.environ['VAR_VALUE']
lines = open(path, encoding='utf-8').read().splitlines() if os.path.exists(path) else []
line = f'{name}={value}'
for i, old in enumerate(lines):
    if old.startswith(name + '='):
        lines[i] = line
        break
else:
    lines.append(line)
open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
PY
}

prepare_module() {
  local p="$1" repo="${REPO[$p]:-}" dir env_file v val secret
  [ -n "$repo" ] || return 0
  dir="services/$repo"
  mkdir -p services
  if [ -d "$dir/.git" ]; then
    git -C "$dir" pull -q --ff-only || echo "Aviso: no he podido actualizar $dir; sigo con lo que hay." >&2
  else
    echo "Clonando $repo…"
    git clone -q --depth 1 "https://github.com/volteret4/$repo.git" "$dir"
  fi
  for d in ${MKDIR[$p]:-}; do mkdir -p "$dir/$d"; done
  for f in ${TOUCH[$p]:-}; do [ -e "$dir/$f" ] || touch "$dir/$f"; done
  env_file="$dir/.env"
  if [ ! -f "$env_file" ]; then
    if [ -f "$dir/.env.example" ]; then cp "$dir/.env.example" "$env_file"; else touch "$env_file"; fi
  fi
  chmod 600 "$env_file"
  for v in ${VARS[$p]:-}; do
    val="$(get_var "$env_file" "$v")"
    [ -n "$val" ] && continue
    val="$(get_var "$ROOT_ENV" "$v")"
    if [ -z "$val" ] && [ "$ASSUME_YES" = 0 ] && [ -t 0 ]; then
      case "$v" in *PASS*|*TOKEN*|*KEY*|*SECRET*) secret=1 ;; *) secret=0 ;; esac
      if [ "$secret" = 1 ]; then read -r -s -p "$v para $p (Intro para omitir): " val; echo
      else read -r -p "$v para $p (Intro para omitir): " val; fi
      [ -n "$val" ] && set_var "$ROOT_ENV" "$v" "$val"
    fi
    [ -n "$val" ] && set_var "$env_file" "$v" "$val"
  done
  return 0
}

COMPOSE=()
for p in "${PROFILES[@]}"; do
  prepare_module "$p"
  COMPOSE+=(--profile "$p")
done
[ -d logs ] || mkdir -p logs/escuchowsky logs/musthear logs/tumtumpa

export PUID="${PUID:-$(id -u)}" PGID="${PGID:-$(id -g)}"
docker compose "${COMPOSE[@]}" "${ARGS[@]}"

if [ "${ARGS[0]}" = up ]; then
  echo
  echo "Abiertos:"
  for p in "${PROFILES[@]}"; do
    for port in ${URLS[$p]:-}; do printf '  %-22s http://localhost:%s\n' "$p" "$port"; done
  done
fi
