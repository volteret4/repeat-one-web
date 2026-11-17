#!/usr/bin/env bash
# Graba todas las demos de demo/<mod>/ desde pepecono. Necesita el túnel SSH a los puertos
# de los servicios (ver README de esta carpeta) y Playwright con Chromium.
# Uso: grabar_todo.sh [módulo…]   (sin argumentos, todos)
set -uo pipefail
cd "$(dirname "$0")"
PY=${PY:-python3}
declare -A CMD=(
  [gaps]="--port 5023 --owned --steps steps/gaps.js --post steps/gaps.py"
  [mapa]="--port 8779 --owned --steps steps/mapa.js --post steps/mapa.py --search api/search:q"
  [pendientes]="--port 8773 --owned --steps steps/pendientes.js"
  [sellos]="--port 8758 --owned --steps steps/sellos.js --post steps/sellos.py --search api/groups/labels:q api/groups/producers:q api/groups/masters:q"
  [trasvase]="--port 5020 --owned --steps steps/trasvase.js --post steps/trasvase.py"
  [clips]="--port 8774 --steps steps/explore.js --skip /file$"
  [tracklist]="--port 5024 --steps steps/tracklist.js"
  [explorador]="--port 8771 --owned --steps steps/explore.js"
  [stats]="--port 8768 --owned"
  [mixxx]="--port 8755 --owned --steps steps/mixxx.js --skip api/stream/ --trim 30"
  [playlists]="--port 8772 --owned --steps steps/playlists.js"
  [rater]="--port 5021 --steps steps/rater.js --pages /recs/random /recs/vector /stats /dominios --skip api/play/"
  [consejero]="--port 8776 --owned --steps steps/consejero.js"
  [sync]="--port 5022 --trim 300"
  [conciertos]="--port 8747 --steps steps/conciertos.js --post steps/conciertos.py"
  [escuchowsky]="--port 8751 --owned --steps steps/escuchowsky.js --post steps/escuchowsky.py --skip api/friends|api/enrich_albums"
  [discover]="--port 8753 --owned --skip api/config --lastfm-key api/config"
  # Discos Olvidados no está desplegado en pepecono: se arranca en local en el 8775 (ver README).
  [olvidados]="--port 8775 --steps steps/explore.js --trim 150"
  [creditos]="--port 8794 --owned --steps steps/creditos.js"
)
mods=("$@"); [ ${#mods[@]} -eq 0 ] && mods=(gaps mapa pendientes sellos trasvase clips tracklist explorador stats mixxx playlists rater consejero sync conciertos creditos discover olvidados podcast escuchowsky)
# Podcast TTS: su web la sirve SWAG, no el contenedor; se toma de pepecono.
PODCAST_HTML=$(mktemp); trap 'rm -f "$PODCAST_HTML"' EXIT
ssh -o BatchMode=yes pepecono 'cat /home/pepe/contenedores/podcast-tts/index.html' > "$PODCAST_HTML" 2>/dev/null
CMD[podcast]="--port 8759 --post steps/podcast.py --html $PODCAST_HTML --skip api/config|audio_articles|\\.mp3 --trim 30"
for m in "${mods[@]}"; do
  # shellcheck disable=SC2086
  $PY record.py --mod "$m" ${CMD[$m]} --wait 3000 2>&1 | tail -1
  du -sh "../../demo/$m" | cut -f1
done
