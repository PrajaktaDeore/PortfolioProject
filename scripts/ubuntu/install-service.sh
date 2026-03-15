#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SERVICE_SRC="$ROOT_DIR/deploy/systemd/tradeanalytics.service"
SERVICE_DST="/etc/systemd/system/tradeanalytics.service"

if [[ ! -f "$SERVICE_SRC" ]]; then
  echo "ERROR: Missing $SERVICE_SRC" >&2
  exit 1
fi

echo "Installing systemd service..."
sudo cp "$SERVICE_SRC" "$SERVICE_DST"
sudo systemctl daemon-reload
sudo systemctl enable --now tradeanalytics.service

echo "Service installed and started."
echo "Logs: sudo journalctl -u tradeanalytics -f"

