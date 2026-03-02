import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import yfinance as yf
from django.db import OperationalError, transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Sector, Stock, StockPeHistory


SECTOR_SYMBOLS = {
    "banking": [
        "HDFCBANK.NS",
        "ICICIBANK.NS",
        "SBIN.NS",
        "KOTAKBANK.NS",
        "AXISBANK.NS",
        "INDUSINDBK.NS",
        "PNB.NS",
        "BANKBARODA.NS",
        "IDFCFIRSTB.NS",
        "FEDERALBNK.NS",
    ],
    "it": [
        "TCS.NS",
        "INFY.NS",
        "HCLTECH.NS",
        "WIPRO.NS",
        "TECHM.NS",
        "LTIM.NS",
    ],
    "pharma": [
        "SUNPHARMA.NS",
        "DRREDDY.NS",
        "CIPLA.NS",
        "DIVISLAB.NS",
        "APOLLOHOSP.NS",
        "LUPIN.NS",
    ],
    "fmcg": [
        "HINDUNILVR.NS",
        "ITC.NS",
        "NESTLEIND.NS",
        "DABUR.NS",
        "BRITANNIA.NS",
        "MARICO.NS",
    ],
    "auto": [
        "MARUTI.NS",
        "TATAMOTORS.NS",
        "M&M.NS",
        "BAJAJ-AUTO.NS",
        "EICHERMOT.NS",
        "HEROMOTOCO.NS",
    ],
    "energy": [
        "RELIANCE.NS",
        "ONGC.NS",
        "IOC.NS",
        "BPCL.NS",
        "NTPC.NS",
        "POWERGRID.NS",
    ],
    "metals": [
        "TATASTEEL.NS",
        "JSWSTEEL.NS",
        "HINDALCO.NS",
        "VEDL.NS",
        "SAIL.NS",
    ],
}

_ALL_STOCKS_CACHE_TTL_SECONDS = 60
_all_stocks_cache = {"ts": 0.0, "data": None}


def _save_payload_to_db(payload):
    if not payload:
        return

    sector_names = sorted({item.get("sector") for item in payload if item.get("sector")})
    existing_sectors = {sector.name: sector for sector in Sector.objects.filter(name__in=sector_names)}

    new_sector_names = [name for name in sector_names if name not in existing_sectors]
    if new_sector_names:
        Sector.objects.bulk_create([Sector(name=name) for name in new_sector_names], ignore_conflicts=True)
        existing_sectors = {sector.name: sector for sector in Sector.objects.filter(name__in=sector_names)}

    try:
        with transaction.atomic():
            for item in payload:
                symbol = item.get("symbol")
                if not symbol:
                    continue

                stock_obj, _ = Stock.objects.update_or_create(
                    symbol=symbol,
                    defaults={
                        "name": item.get("name"),
                        "sector": existing_sectors.get(item.get("sector")),
                        "price": item.get("price"),
                        "change_percent": item.get("change_percent"),
                        "market_cap": item.get("market_cap"),
                        "pe_ratio": item.get("pe_ratio"),
                        "currency": item.get("currency"),
                        "exchange": item.get("exchange"),
                    },
                )

                pe_ratio = item.get("pe_ratio")
                if pe_ratio is not None:
                    StockPeHistory.objects.create(stock=stock_obj, pe_ratio=pe_ratio)
    except OperationalError:
        # Keep API responses available even if SQLite is temporarily locked.
        return


def _load_pe_history(symbol, limit=30):
    if not symbol:
        return []

    try:
        rows = (
            StockPeHistory.objects.select_related("stock")
            .filter(stock__symbol=symbol)
            .order_by("-captured_at")[:limit]
        )
    except Exception:
        return []

    history = []
    for row in reversed(list(rows)):
        history.append(
            {
                "pe_ratio": row.pe_ratio,
                "captured_at": row.captured_at.isoformat(),
            }
        )
    return history


def _load_payload_from_db():
    try:
        rows = (
            Stock.objects.select_related("sector")
            .all()
            .order_by("symbol")
        )
    except Exception:
        return []

    payload = []
    for row in rows:
        payload.append(
            {
                "sector": row.sector.name if row.sector else None,
                "symbol": row.symbol,
                "name": row.name,
                "price": row.price,
                "change_percent": row.change_percent,
                "market_cap": row.market_cap,
                "pe_ratio": row.pe_ratio,
                "currency": row.currency,
                "exchange": row.exchange,
            }
        )
    return payload


def _safe_get(obj, key, default=None):
    if obj is None:
        return default
    try:
        if hasattr(obj, "get"):
            value = obj.get(key, default)
            return default if value is None else value
    except Exception:
        pass
    try:
        value = obj[key]
        return default if value is None else value
    except Exception:
        return default


class AllSectorStocksView(APIView):
    def _build_symbol_to_sector(self):
        symbol_to_sector = {}
        for sector, sector_symbols in SECTOR_SYMBOLS.items():
            for symbol in sector_symbols:
                symbol_to_sector[symbol] = sector
        return symbol_to_sector

    def _fetch_quote_api(self, symbols):
        query = urlencode({"symbols": ",".join(symbols)})
        urls = [
            f"https://query1.finance.yahoo.com/v7/finance/quote?{query}",
            f"https://query2.finance.yahoo.com/v7/finance/quote?{query}",
        ]

        errors = []
        for url in urls:
            try:
                req = Request(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0",
                        "Accept": "application/json",
                    },
                )
                with urlopen(req, timeout=10) as resp:
                    raw = resp.read().decode("utf-8")
                data = json.loads(raw)
                return data.get("quoteResponse", {}).get("result", []), None
            except (HTTPError, URLError, ValueError, TimeoutError) as exc:
                errors.append(str(exc))

        return None, "; ".join(errors) if errors else "Unknown upstream error."

    def _fetch_yfinance_fallback(self, symbols, symbol_to_sector):
        payload = []
        for symbol in symbols:
            ticker = yf.Ticker(symbol)
            fast_info = {}
            info = {}

            # Keep fallback resilient: a single failed symbol must not fail the entire API.
            try:
                fast_info = ticker.fast_info or {}
            except Exception:
                fast_info = {}

            try:
                info = ticker.info or {}
            except Exception:
                info = {}

            payload.append(
                {
                    "sector": symbol_to_sector.get(symbol),
                    "symbol": symbol,
                    "name": info.get("shortName") or info.get("longName"),
                    "price": _safe_get(fast_info, "lastPrice") or info.get("regularMarketPrice"),
                    "change_percent": info.get("regularMarketChangePercent"),
                    "market_cap": _safe_get(fast_info, "marketCap") or info.get("marketCap"),
                    "pe_ratio": info.get("trailingPE"),
                    "currency": info.get("currency"),
                    "exchange": info.get("exchange"),
                }
            )
        return payload

    def _build_base_payload(self, symbols, symbol_to_sector):
        return [
            {
                "sector": symbol_to_sector.get(symbol),
                "symbol": symbol,
                "name": None,
                "price": None,
                "change_percent": None,
                "market_cap": None,
                "pe_ratio": None,
                "currency": None,
                "exchange": None,
            }
            for symbol in symbols
        ]

    def get(self, request):
        force_refresh = request.query_params.get("refresh") == "1"
        now = time.time()
        cached = _all_stocks_cache.get("data")
        if not force_refresh and cached and (now - _all_stocks_cache.get("ts", 0.0) < _ALL_STOCKS_CACHE_TTL_SECONDS):
            return Response({"count": len(cached), "data": cached, "source": "cache"}, status=status.HTTP_200_OK)

        if not force_refresh:
            db_payload = _load_payload_from_db()
            if db_payload:
                _all_stocks_cache["data"] = db_payload
                _all_stocks_cache["ts"] = time.time()
                return Response(
                    {
                        "count": len(db_payload),
                        "data": db_payload,
                        "source": "db",
                    },
                    status=status.HTTP_200_OK,
                )

        symbols = []
        for sector_symbols in SECTOR_SYMBOLS.values():
            symbols.extend(sector_symbols)
        symbol_to_sector = self._build_symbol_to_sector()
        base_payload = self._build_base_payload(symbols, symbol_to_sector)

        results, quote_api_error = self._fetch_quote_api(symbols)
        if results is None:
            try:
                payload = self._fetch_yfinance_fallback(symbols, symbol_to_sector)
                merged_by_symbol = {item["symbol"]: item for item in base_payload}
                for item in payload:
                    merged_by_symbol[item["symbol"]] = {**merged_by_symbol[item["symbol"]], **item}
                merged_payload = [merged_by_symbol[symbol] for symbol in symbols]
                _save_payload_to_db(merged_payload)
                _all_stocks_cache["data"] = merged_payload
                _all_stocks_cache["ts"] = time.time()
                return Response(
                    {
                        "count": len(merged_payload),
                        "data": merged_payload,
                        "warning": "Primary quote API unavailable; returning fallback data.",
                    },
                    status=status.HTTP_200_OK,
                )
            except Exception as exc:
                db_payload = _load_payload_from_db()
                if db_payload:
                    _all_stocks_cache["data"] = db_payload
                    _all_stocks_cache["ts"] = time.time()
                    return Response(
                        {
                            "count": len(db_payload),
                            "data": db_payload,
                            "warning": "Live providers unavailable; returning data from local database cache.",
                            "error": f"quote_api={quote_api_error}; yfinance={exc}",
                            "source": "db",
                        },
                        status=status.HTTP_200_OK,
                    )

                _save_payload_to_db(base_payload)
                _all_stocks_cache["data"] = base_payload
                _all_stocks_cache["ts"] = time.time()
                return Response(
                    {
                        "count": len(base_payload),
                        "data": base_payload,
                        "warning": "Live price providers unavailable; returning symbol list only.",
                        "error": f"quote_api={quote_api_error}; yfinance={exc}",
                    },
                    status=status.HTTP_200_OK,
                )

        if not results:
            db_payload = _load_payload_from_db()
            if db_payload:
                _all_stocks_cache["data"] = db_payload
                _all_stocks_cache["ts"] = time.time()
                return Response(
                    {
                        "count": len(db_payload),
                        "data": db_payload,
                        "warning": "Primary quote API returned no live rows; using local database cache.",
                        "source": "db",
                    },
                    status=status.HTTP_200_OK,
                )

            _save_payload_to_db(base_payload)
            _all_stocks_cache["data"] = base_payload
            _all_stocks_cache["ts"] = time.time()
            return Response(
                {
                    "count": len(base_payload),
                    "data": base_payload,
                    "warning": "Primary quote API returned no data; returning symbol list only.",
                },
                status=status.HTTP_200_OK,
            )

        merged_by_symbol = {item["symbol"]: item for item in base_payload}
        for item in results:
            symbol = item.get("symbol")
            if symbol not in merged_by_symbol:
                continue
            merged_by_symbol[symbol] = {
                **merged_by_symbol[symbol],
                "symbol": symbol,
                "name": item.get("shortName") or item.get("longName"),
                "price": item.get("regularMarketPrice"),
                "change_percent": item.get("regularMarketChangePercent"),
                "market_cap": item.get("marketCap"),
                "pe_ratio": item.get("trailingPE"),
                "currency": item.get("currency"),
                "exchange": item.get("exchange"),
            }

        payload = [merged_by_symbol[symbol] for symbol in symbols]
        _save_payload_to_db(payload)
        _all_stocks_cache["data"] = payload
        _all_stocks_cache["ts"] = time.time()
        return Response({"count": len(payload), "data": payload}, status=status.HTTP_200_OK)


class StockDetailView(APIView):
    def _find_sector(self, symbol):
        for sector, sector_symbols in SECTOR_SYMBOLS.items():
            if symbol in sector_symbols:
                return sector
        return None

    def _empty_payload(self, symbol):
        return {
            "name": None,
            "symbol": symbol,
            "sector": self._find_sector(symbol),
            "price": None,
            "change_percent": None,
            "market_cap": None,
            "pe_ratio": None,
            "pe_history": [],
            "currency": None,
            "exchange": None,
        }

    def _fetch_from_quote_api(self, symbol):
        query = urlencode({"symbols": symbol})
        urls = [
            f"https://query1.finance.yahoo.com/v7/finance/quote?{query}",
            f"https://query2.finance.yahoo.com/v7/finance/quote?{query}",
        ]

        last_error = None
        for url in urls:
            try:
                req = Request(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0",
                        "Accept": "application/json",
                    },
                )
                with urlopen(req, timeout=10) as resp:
                    raw = resp.read().decode("utf-8")
                data = json.loads(raw)
                result = (data.get("quoteResponse", {}).get("result") or [])
                return result[0] if result else None, None
            except (HTTPError, URLError, ValueError, TimeoutError) as exc:
                last_error = str(exc)

        return None, last_error or "Unknown upstream error."

    def _fetch_from_yfinance(self, symbol):
        ticker = yf.Ticker(symbol)
        fast_info = {}
        info = {}

        try:
            fast_info = ticker.fast_info or {}
        except Exception:
            fast_info = {}

        try:
            info = ticker.info or {}
        except Exception:
            info = {}

        return {
            "name": info.get("shortName") or info.get("longName"),
            "symbol": symbol,
            "sector": self._find_sector(symbol),
            "price": _safe_get(fast_info, "lastPrice") or info.get("regularMarketPrice"),
            "change_percent": info.get("regularMarketChangePercent"),
            "market_cap": _safe_get(fast_info, "marketCap") or info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "currency": info.get("currency"),
            "exchange": info.get("exchange"),
        }

    def get(self, request, symbol):
        symbol = (symbol or "").strip().upper()
        if not symbol:
            return Response(
                {"detail": "Symbol is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        base = self._empty_payload(symbol)
        quote_item, quote_error = self._fetch_from_quote_api(symbol)
        if quote_item:
            payload = {
                **base,
                "name": quote_item.get("shortName") or quote_item.get("longName"),
                "price": quote_item.get("regularMarketPrice"),
                "change_percent": quote_item.get("regularMarketChangePercent"),
                "market_cap": quote_item.get("marketCap"),
                "pe_ratio": quote_item.get("trailingPE"),
                "currency": quote_item.get("currency"),
                "exchange": quote_item.get("exchange"),
            }
            _save_payload_to_db([payload])
            payload["pe_history"] = _load_pe_history(symbol)
            return Response(payload, status=status.HTTP_200_OK)

        try:
            fallback = self._fetch_from_yfinance(symbol)
            payload = {
                **base,
                **fallback,
                "warning": "Primary quote API unavailable; fallback data returned.",
            }
            _save_payload_to_db([payload])
            payload["pe_history"] = _load_pe_history(symbol)
            return Response(payload, status=status.HTTP_200_OK)
        except Exception as exc:
            payload = {
                **base,
                "warning": "Live price providers unavailable; returning empty stock schema.",
                "error": f"quote_api={quote_error}; yfinance={exc}",
            }
            _save_payload_to_db([payload])
            payload["pe_history"] = _load_pe_history(symbol)
            return Response(payload, status=status.HTTP_200_OK)
