# TradeAnalytics (Ubuntu Quickstart)

## Prerequisites

- Python 3 + `python3-venv`
- Node.js + npm

## One-time setup

```bash
chmod +x scripts/ubuntu/*.sh
make setup
```

Optional (only if you want the RNN forecast model enabled on the backend):

```bash
INSTALL_TF=1 make setup
```

## Start backend + frontend (dev)

```bash
make dev
```

Defaults:
- Backend: `http://127.0.0.1:8000`
- Frontend: `http://127.0.0.1:5173`

To change ports/hosts:

```bash
BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 FRONTEND_HOST=0.0.0.0 FRONTEND_PORT=5173 make dev
```

## Ubuntu auto-start (systemd)

1) One-time setup:

```bash
chmod +x scripts/ubuntu/*.sh
make setup
```

2) Install + enable the service (auto-starts on boot):

```bash
chmod +x scripts/ubuntu/install-service.sh
scripts/ubuntu/install-service.sh
```

If your repo is not in the default location, pass these env vars:

```bash
APP_DIR=/home/azureuser/PortfolioProject SERVICE_USER=azureuser scripts/ubuntu/install-service.sh
```

3) Check status / logs:

```bash
sudo systemctl status tradeanalytics
sudo journalctl -u tradeanalytics -f
```

## Troubleshooting

### RNN forecast (TensorFlow) on Windows

If `pip install tensorflow` fails with a long-path error, either:

- Move the repo to a shorter path (example `C:\repo\PortfolioProject`) and recreate the venv, or
- Enable Windows Long Path support (Group Policy: “Enable Win32 long paths”, or set `LongPathsEnabled=1` in the registry).
