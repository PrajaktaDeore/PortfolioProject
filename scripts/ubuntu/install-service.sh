#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SERVICE_SRC="$ROOT_DIR/deploy/systemd/tradeanalytics.service"
SERVICE_DST="/etc/systemd/system/tradeanalytics.service"

if [[ ! -f "$SERVICE_SRC" ]]; then
  echo "ERROR: Missing $SERVICE_SRC" >&2
  exit 1
fi

SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-}}"
if [[ -z "$SERVICE_USER" ]]; then
  SERVICE_USER="$(id -un)"
fi

APP_DIR="${APP_DIR:-$ROOT_DIR}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERROR: APP_DIR not found: $APP_DIR" >&2
  exit 1
fi

if ! sudo -u "$SERVICE_USER" test -r "$APP_DIR"; then
  echo "ERROR: $SERVICE_USER cannot read APP_DIR ($APP_DIR)." >&2
  echo "Fix example: sudo chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR" >&2
  exit 1
fi

if ! sudo -u "$SERVICE_USER" test -x "$APP_DIR/scripts/ubuntu/dev.sh"; then
  echo "ERROR: $SERVICE_USER cannot execute $APP_DIR/scripts/ubuntu/dev.sh" >&2
  echo "Fix example: chmod +x $APP_DIR/scripts/ubuntu/dev.sh" >&2
  exit 1
fi

tmp_service="$(mktemp)"
cp "$SERVICE_SRC" "$tmp_service"
# Prefer template placeholders; fall back to line-based replacement for older units.
sed -i "s|__SERVICE_USER__|$SERVICE_USER|g" "$tmp_service"
sed -i "s|__APP_DIR__|$APP_DIR|g" "$tmp_service"
sed -i "s|^User=.*$|User=$SERVICE_USER|g" "$tmp_service"
sed -i "s|^WorkingDirectory=.*$|WorkingDirectory=$APP_DIR|g" "$tmp_service"
sed -i "s|^ExecStart=.*$|ExecStart=/usr/bin/env bash $APP_DIR/scripts/ubuntu/dev.sh|g" "$tmp_service"

echo "Installing systemd service..."
sudo cp "$tmp_service" "$SERVICE_DST"
rm -f "$tmp_service"
sudo systemctl daemon-reload
sudo systemctl enable --now tradeanalytics.service

echo "Service installed and started."
echo "Logs: sudo journalctl -u tradeanalytics -f"
