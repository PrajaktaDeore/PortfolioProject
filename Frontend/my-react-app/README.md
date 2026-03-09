# TradeAnalytics - Portfolio & Stock Analytics Dashboard

TradeAnalytics is a full-stack dashboard for exploring sector-wise stocks, tracking a personal portfolio, and running time-series forecasting. The frontend is a React (Vite) app and the backend is a Django REST API that fetches live market data from Yahoo Finance.

## Project Overview

- **Frontend** (`Frontend/my-react-app`): UI for sectors, stocks, portfolio analytics, and time-series pages.
- **Backend** (`Backend/myproject`): Django + DRF API for stock/sector data, auth, portfolio CRUD, and forecasting endpoints.

## Features

- **Sector explorer**: Browse sectors (Banking, IT, Pharma, FMCG, Auto, Energy, Metals) and view metrics (price, 52W high/low, market cap, P/E, etc.).
- **Stock search & sorting**: Filter by symbol/name and sort by market cap, price, change %, P/E, etc.
- **Portfolio (login-gated UI)**: Add stocks to a portfolio and view analytics/visualizations (including PCA projection).
- **Timeseries + forecasting**: Fetch historical OHLC and run forecasts (ARIMA supported end-to-end; additional models exist in the backend).
- **Market/Index charts**: Home page shows index movement (for example, NIFTY) using the backend timeseries endpoint.
- **Gold vs Silver correlation (5Y)**: Generate a correlation graph and download aligned data as CSV.
- **Authentication**: Signup and login via Django endpoints; frontend stores session state in `localStorage`.

## Technologies Used

### Frontend

- React + Vite
- React Router
- Bootstrap 5 (CDN)
- ESLint

### Backend

- Python
- Django
- Django REST Framework (DRF)
- `django-cors-headers`
- `yfinance` (market data)
- `statsmodels` (ARIMA / Exponential Smoothing forecasting)
- `numpy` + `tensorflow` (optional, for the RNN forecasting model)
- SQLite (default dev database)

## Installation & Setup (Python + React)

### 1) Backend (Python / Django)

From the repository root:

```bash
cd Backend/myproject
```

Create and activate a virtual environment:

```bash
python -m venv .venv
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
```

Install dependencies (minimum set to run the API):

```bash
pip install -U pip
pip install django djangorestframework django-cors-headers yfinance statsmodels numpy
```

Optional (only if you want the RNN forecasting option on the backend):

```bash
pip install tensorflow
```

Run migrations and start the server:

```bash
python manage.py migrate
python manage.py runserver
```

Backend runs at `http://127.0.0.1:8000` by default.

### 2) Frontend (React / Vite)

In a second terminal:

```bash
cd Frontend/my-react-app
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` by default.

#### API base URL configuration

The frontend uses `VITE_API_BASE_URL` (defaults to `http://127.0.0.1:8000`). To change it, create `Frontend/my-react-app/.env`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then restart `npm run dev`.

## Useful API Routes (Backend)

- `GET /sector-stocks/sector-stocks/?sector=banking`
- `GET /all-sector-stocks/`
- `GET /all-sector-stocks/stock/<symbol>/`
- `GET /all-sector-stocks/market-overview/`
- `GET /all-sector-stocks/timeseries/bitcoin/?symbol=BTC-USD&period=1y&interval=1d`
- `GET /all-sector-stocks/timeseries/arima/?symbol=BTC-USD&period=1y&interval=1d&days=7&model=arima`
- `POST /user/signup/`
- `POST /user/login/`
