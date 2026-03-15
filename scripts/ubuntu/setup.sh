#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/Backend/myproject"
FRONTEND_DIR="$ROOT_DIR/Frontend/my-react-app"

PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "ERROR: '$PYTHON_BIN' not found. Install Python 3 first." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: 'npm' not found. Install Node.js + npm first." >&2
  exit 1
fi

echo "== Backend: venv + pip =="
mkdir -p "$ROOT_DIR/Backend"
if [[ ! -x "$ROOT_DIR/Backend/.venv/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$ROOT_DIR/Backend/.venv"
fi

"$ROOT_DIR/Backend/.venv/bin/python" -m pip install -U pip
if [[ -f "$ROOT_DIR/Backend/requirements.txt" ]]; then
  "$ROOT_DIR/Backend/.venv/bin/python" -m pip install -r "$ROOT_DIR/Backend/requirements.txt"
else
  echo "WARNING: Backend/requirements.txt not found; skipping pip install -r." >&2
fi

if [[ "${INSTALL_TF:-0}" == "1" ]]; then
  if [[ -f "$ROOT_DIR/Backend/requirements-ml.txt" ]]; then
    echo "== Backend: optional ML deps (TensorFlow) =="
    "$ROOT_DIR/Backend/.venv/bin/python" -m pip install -r "$ROOT_DIR/Backend/requirements-ml.txt"
  else
    echo "WARNING: Backend/requirements-ml.txt not found; skipping TensorFlow install." >&2
  fi
fi

echo "== Backend: migrations =="
(cd "$BACKEND_DIR" && "$ROOT_DIR/Backend/.venv/bin/python" manage.py migrate)

echo "== Frontend: npm install =="
(cd "$FRONTEND_DIR" && npm install)

echo "Setup complete."
