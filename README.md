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
