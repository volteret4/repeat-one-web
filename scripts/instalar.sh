#!/usr/bin/env bash
# Comprueba los requisitos y arranca el instalador web de REPEAT-ONE (scripts/instalador/).
#
# La web corre en el host, no en Docker, y nunca lanza ni para contenedores:
# escribe los .env y te da el comando de scripts/up.sh para que lo ejecutes tú.
#
# Uso:
#   scripts/instalar.sh                  # solo en 127.0.0.1, primer puerto libre desde 8799
#   scripts/instalar.sh --port 8800      # puerto fijo
#   scripts/instalar.sh --host 0.0.0.0   # accesible desde la red (sin HTTPS)
#   scripts/instalar.sh --check          # solo comprobar requisitos
set -uo pipefail
cd "$(dirname "$0")/.."

PYTHON_GUIDE="https://www.python.org/downloads/"

echo "Comprobando requisitos…"
if ! command -v python3 >/dev/null 2>&1; then
  echo "  ✗ Falta python3, que hace falta para la web del instalador."
  echo "      → guía: $PYTHON_GUIDE"
  exit 1
fi
if ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 8))'; then
  echo "  ✗ python3 es demasiado antiguo ($(python3 --version 2>&1)); hace falta 3.8 o posterior."
  echo "      → guía: $PYTHON_GUIDE"
  exit 1
fi

check_only=0
for arg in "$@"; do
  [ "$arg" = "--check" ] && check_only=1
done

python3 scripts/instalador/server.py --check
status=$?
if [ "$check_only" = 1 ]; then
  exit "$status"
fi
if [ "$status" != 0 ]; then
  echo
  echo "Faltan requisitos. Puedes configurar los módulos igualmente, pero up.sh no"
  echo "funcionará hasta que los instales. La web también los muestra con su guía."
fi

exec python3 scripts/instalador/server.py "$@"
