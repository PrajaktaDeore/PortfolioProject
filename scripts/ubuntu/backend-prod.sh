#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/Backend/myproject"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-60}"

VENV_PY="$ROOT_DIR/Backend/.venv/bin/python"

if [[ ! -x "$VENV_PY" ]]; then
  echo "Backend venv missing. Run: scripts/ubuntu/setup.sh" >&2
  exit 1
fi

cd "$BACKEND_DIR"
"$VENV_PY" manage.py migrate --noinput

exec "$ROOT_DIR/Backend/.venv/bin/gunicorn" \
  --workers "$WEB_CONCURRENCY" \
  --timeout "$GUNICORN_TIMEOUT" \
  --bind "$BACKEND_HOST:$BACKEND_PORT" \
  myproject.wsgi:application

