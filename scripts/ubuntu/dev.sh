#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/Backend/myproject"
FRONTEND_DIR="$ROOT_DIR/Frontend/my-react-app"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

VENV_PY="$ROOT_DIR/Backend/.venv/bin/python"

if [[ ! -x "$VENV_PY" ]]; then
  echo "Backend venv missing. Run: scripts/ubuntu/setup.sh" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: 'npm' not found. Install Node.js + npm first." >&2
  exit 1
fi

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "== Backend =="
(cd "$BACKEND_DIR" && "$VENV_PY" manage.py migrate >/dev/null)
(cd "$BACKEND_DIR" && "$VENV_PY" manage.py runserver "$BACKEND_HOST:$BACKEND_PORT") &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "== Frontend =="
export VITE_API_BASE_URL="http://$BACKEND_HOST:$BACKEND_PORT"
(cd "$FRONTEND_DIR" && npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT")

