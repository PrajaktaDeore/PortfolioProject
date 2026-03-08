import json
import math
import os
import random
import time
from datetime import datetime, timedelta, timezone
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
# Yahoo Finance index symbols can be inconsistent across endpoints and regions.
# Keep a short fallback list per index and pick the first symbol that returns data.
INDEX_DEFINITIONS = [
    {"key": "nifty_50", "name": "NIFTY 50", "symbols": ["^NSEI"]},
    # Yahoo Finance pages list ^NSMIDCP as "NIFTY NEXT 50" in related indices.
    {"key": "nifty_next_50", "name": "NIFTY NEXT 50", "symbols": ["^NSMIDCP", "^NIFTYJR"]},
    {"key": "nifty_bank", "name": "NIFTY BANK", "symbols": ["^NSEBANK", "NIFTY_BANK.NS"]},
    {"key": "nifty_100", "name": "NIFTY 100", "symbols": ["^CNX100", "NIFTY_100.NS"]},
    # Confirmed on Yahoo: NIFTY_MIDCAP_100.NS exists (where some ^ symbols fail).
    {"key": "nifty_midcap_100", "name": "NIFTY MIDCAP 100", "symbols": ["NIFTY_MIDCAP_100.NS", "^CNXMIDCAP"]},
]
COMMODITY_SYMBOLS = {
    "gold": {"symbol": "GC=F", "name": "Gold Futures"},
    "silver": {"symbol": "SI=F", "name": "Silver Futures"},
}
BITCOIN_SYMBOL = {"symbol": "BTC-USD", "name": "Bitcoin"}
TIMESERIES_SYMBOL_NAMES = {
    "BTC-USD": "Bitcoin",
    "ETH-USD": "Ethereum",
    "GC=F": "Gold Futures",
    "SI=F": "Silver Futures",
    "HDFCBANK.NS": "HDFC Bank",
    "TCS.NS": "Tata Consultancy Services",
}


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
                        "min_1y": item.get("min_1y"),
                        "max_1y": item.get("max_1y"),
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
                "min_1y": row.min_1y,
                "max_1y": row.max_1y,
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
                    "min_1y": _safe_get(fast_info, "yearLow") or info.get("fiftyTwoWeekLow"),
                    "max_1y": _safe_get(fast_info, "yearHigh") or info.get("fiftyTwoWeekHigh"),
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
                "min_1y": None,
                "max_1y": None,
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
                "min_1y": item.get("fiftyTwoWeekLow"),
                "max_1y": item.get("fiftyTwoWeekHigh"),
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
            "min_1y": None,
            "max_1y": None,
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
            "min_1y": _safe_get(fast_info, "yearLow") or info.get("fiftyTwoWeekLow"),
            "max_1y": _safe_get(fast_info, "yearHigh") or info.get("fiftyTwoWeekHigh"),
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
                "min_1y": quote_item.get("fiftyTwoWeekLow"),
                "max_1y": quote_item.get("fiftyTwoWeekHigh"),
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


def _stock_row_payload(row):
    return {
        "id": row.id,
        "symbol": row.symbol,
        "name": row.name,
        "sector": row.sector.name if row.sector else None,
        "price": row.price,
        "min_1y": row.min_1y,
        "max_1y": row.max_1y,
        "change_percent": row.change_percent,
        "market_cap": row.market_cap,
        "pe_ratio": row.pe_ratio,
        "currency": row.currency,
        "exchange": row.exchange,
    }


class StockCrudListCreateView(APIView):
    def get(self, request):
        rows = Stock.objects.select_related("sector").all().order_by("symbol")
        return Response({"count": rows.count(), "data": [_stock_row_payload(row) for row in rows]}, status=status.HTTP_200_OK)

    def post(self, request):
        symbol = (request.data.get("symbol") or "").strip().upper()
        if not symbol:
            return Response({"detail": "symbol is required."}, status=status.HTTP_400_BAD_REQUEST)

        if Stock.objects.filter(symbol=symbol).exists():
            return Response({"detail": "Stock with this symbol already exists."}, status=status.HTTP_400_BAD_REQUEST)

        sector_name = (request.data.get("sector") or "").strip().lower()
        sector_obj = None
        if sector_name:
            sector_obj, _ = Sector.objects.get_or_create(name=sector_name)

        stock_obj = Stock.objects.create(
            symbol=symbol,
            name=request.data.get("name"),
            sector=sector_obj,
            price=request.data.get("price"),
            min_1y=request.data.get("min_1y"),
            max_1y=request.data.get("max_1y"),
            change_percent=request.data.get("change_percent"),
            market_cap=request.data.get("market_cap"),
            pe_ratio=request.data.get("pe_ratio"),
            currency=request.data.get("currency"),
            exchange=request.data.get("exchange"),
        )
        return Response(_stock_row_payload(stock_obj), status=status.HTTP_201_CREATED)


class StockCrudUpdateDeleteView(APIView):
    def patch(self, request, stock_id):
        stock_obj = Stock.objects.select_related("sector").filter(id=stock_id).first()
        if not stock_obj:
            return Response({"detail": "Stock not found."}, status=status.HTTP_404_NOT_FOUND)

        if "symbol" in request.data:
            symbol = (request.data.get("symbol") or "").strip().upper()
            if not symbol:
                return Response({"detail": "symbol cannot be blank."}, status=status.HTTP_400_BAD_REQUEST)
            if Stock.objects.filter(symbol=symbol).exclude(id=stock_obj.id).exists():
                return Response({"detail": "Stock with this symbol already exists."}, status=status.HTTP_400_BAD_REQUEST)
            stock_obj.symbol = symbol

        if "name" in request.data:
            stock_obj.name = request.data.get("name")
        if "price" in request.data:
            stock_obj.price = request.data.get("price")
        if "min_1y" in request.data:
            stock_obj.min_1y = request.data.get("min_1y")
        if "max_1y" in request.data:
            stock_obj.max_1y = request.data.get("max_1y")
        if "change_percent" in request.data:
            stock_obj.change_percent = request.data.get("change_percent")
        if "market_cap" in request.data:
            stock_obj.market_cap = request.data.get("market_cap")
        if "pe_ratio" in request.data:
            stock_obj.pe_ratio = request.data.get("pe_ratio")
        if "currency" in request.data:
            stock_obj.currency = request.data.get("currency")
        if "exchange" in request.data:
            stock_obj.exchange = request.data.get("exchange")
        if "sector" in request.data:
            sector_name = (request.data.get("sector") or "").strip().lower()
            if sector_name:
                sector_obj, _ = Sector.objects.get_or_create(name=sector_name)
                stock_obj.sector = sector_obj
            else:
                stock_obj.sector = None

        stock_obj.save()
        return Response(_stock_row_payload(stock_obj), status=status.HTTP_200_OK)

    def delete(self, request, stock_id):
        stock_obj = Stock.objects.filter(id=stock_id).first()
        if not stock_obj:
            return Response({"detail": "Stock not found."}, status=status.HTTP_404_NOT_FOUND)

        stock_obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MarketOverviewView(APIView):
    def _fetch_from_quote_api(self):
        symbols = []
        seen = set()
        for definition in INDEX_DEFINITIONS:
            for symbol in definition.get("symbols") or []:
                if symbol and symbol not in seen:
                    symbols.append(symbol)
                    seen.add(symbol)
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

    def _build_index_payload(self, key, symbol, default_name, item):
        if not item:
            return {
                "key": key,
                "symbol": symbol,
                "name": default_name,
                "price": None,
                "change": None,
                "change_percent": None,
                "currency": None,
                "exchange": None,
            }

        return {
            "key": key,
            "symbol": symbol,
            "name": item.get("shortName") or item.get("longName") or default_name,
            "price": item.get("regularMarketPrice"),
            "change": item.get("regularMarketChange"),
            "change_percent": item.get("regularMarketChangePercent"),
            "currency": item.get("currency"),
            "exchange": item.get("exchange"),
        }

    def _fetch_from_yfinance(self):
        rows = []
        for definition in INDEX_DEFINITIONS:
            key = definition["key"]
            default_name = definition["name"]
            candidates = [s for s in (definition.get("symbols") or []) if s]

            chosen_symbol = candidates[0] if candidates else ""
            chosen_payload = None

            for symbol in candidates:
                ticker = yf.Ticker(symbol)
                fast_info = {}

                try:
                    fast_info = ticker.fast_info or {}
                except Exception:
                    fast_info = {}
                # Avoid ticker.info (quoteSummary) since missing symbols can produce noisy 404 logs.
                price = _safe_get(fast_info, "lastPrice")
                prev_close = _safe_get(fast_info, "previousClose")
                change = None
                change_percent = None
                if price is not None and prev_close is not None:
                    try:
                        change = float(price) - float(prev_close)
                        if float(prev_close) != 0:
                            change_percent = (change / float(prev_close)) * 100.0
                    except Exception:
                        change = None
                        change_percent = None

                # Accept the first candidate that returns any pricing signal.
                if price is None and change is None and change_percent is None:
                    continue

                chosen_symbol = symbol
                chosen_payload = {
                    "key": key,
                    "symbol": symbol,
                    "name": default_name,
                    "price": price,
                    "change": change,
                    "change_percent": change_percent,
                    "currency": None,
                    "exchange": None,
                }
                break

            if not chosen_payload:
                chosen_payload = {
                    "key": key,
                    "symbol": chosen_symbol,
                    "name": default_name,
                    "price": None,
                    "change": None,
                    "change_percent": None,
                    "currency": None,
                    "exchange": None,
                }

            rows.append(chosen_payload)
        return rows

    def get(self, request):
        quote_rows, quote_error = self._fetch_from_quote_api()
        if quote_rows is not None:
            by_symbol = {row.get("symbol"): row for row in quote_rows}
            payload = []
            for definition in INDEX_DEFINITIONS:
                chosen_symbol = (definition.get("symbols") or [""])[0] or ""
                chosen_item = None
                for symbol in definition.get("symbols") or []:
                    if symbol in by_symbol:
                        chosen_symbol = symbol
                        chosen_item = by_symbol.get(symbol)
                        break
                payload.append(
                    self._build_index_payload(definition["key"], chosen_symbol, definition["name"], chosen_item)
                )
            return Response({"indices": payload}, status=status.HTTP_200_OK)

        try:
            payload = self._fetch_from_yfinance()
            return Response(
                {
                    "indices": payload,
                    "warning": "Primary quote API unavailable; fallback data returned.",
                    "error": quote_error,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            empty_payload = []
            for definition in INDEX_DEFINITIONS:
                chosen_symbol = (definition.get("symbols") or [""])[0] or ""
                empty_payload.append(
                    self._build_index_payload(definition["key"], chosen_symbol, definition["name"], None)
                )
            return Response(
                {
                    "indices": empty_payload,
                    "warning": "Unable to fetch live index values.",
                    "error": f"quote_api={quote_error}; yfinance={exc}",
                },
                status=status.HTTP_200_OK,
            )


class GoldSilverDataView(APIView):
    def _empty_item(self, key, symbol, name):
        return {
            "asset": key,
            "name": name,
            "symbol": symbol,
            "price": None,
            "change_percent": None,
            "currency": None,
            "exchange": None,
            "history": [],
        }

    def _parse_history(self, history_frame):
        if history_frame is None or history_frame.empty:
            return []

        rows = []
        trimmed = history_frame.tail(30)
        for index, row in trimmed.iterrows():
            rows.append(
                {
                    "date": index.strftime("%Y-%m-%d"),
                    "open": row.get("Open"),
                    "high": row.get("High"),
                    "low": row.get("Low"),
                    "close": row.get("Close"),
                    "volume": row.get("Volume"),
                }
            )
        return rows

    def _fetch_item(self, key, symbol, name, period, interval):
        ticker = yf.Ticker(symbol)
        fast_info = {}
        info = {}
        history = None

        try:
            fast_info = ticker.fast_info or {}
        except Exception:
            fast_info = {}

        try:
            info = ticker.info or {}
        except Exception:
            info = {}

        try:
            history = ticker.history(period=period, interval=interval, auto_adjust=False)
        except Exception:
            history = None

        history_rows = self._parse_history(history)
        last_close = history_rows[-1]["close"] if history_rows else None
        live_price = _safe_get(fast_info, "lastPrice") or info.get("regularMarketPrice")

        return {
            "asset": key,
            "name": info.get("shortName") or info.get("longName") or name,
            "symbol": symbol,
            "price": live_price if live_price is not None else last_close,
            "change_percent": info.get("regularMarketChangePercent"),
            "currency": info.get("currency"),
            "exchange": info.get("exchange"),
            "history": history_rows,
        }

    def get(self, request):
        period = request.query_params.get("period", "1mo")
        interval = request.query_params.get("interval", "1d")

        payload = []
        warnings = []

        for key, cfg in COMMODITY_SYMBOLS.items():
            symbol = cfg["symbol"]
            name = cfg["name"]
            try:
                payload.append(self._fetch_item(key, symbol, name, period, interval))
            except Exception as exc:
                warnings.append(f"{key}: {exc}")
                payload.append(self._empty_item(key, symbol, name))

        response_data = {
            "source": "yfinance",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": period,
            "interval": interval,
            "count": len(payload),
            "data": payload,
        }
        if warnings:
            response_data["warning"] = "Some commodities could not be fetched."
            response_data["errors"] = warnings

        return Response(response_data, status=status.HTTP_200_OK)


class BuiltinPortfolioBitcoinView(APIView):
    def _parse_history(self, history_frame):
        if history_frame is None or history_frame.empty:
            return []

        rows = []
        for index, row in history_frame.tail(365).iterrows():
            rows.append(
                {
                    "date": index.strftime("%Y-%m-%d"),
                    "open": row.get("Open"),
                    "high": row.get("High"),
                    "low": row.get("Low"),
                    "close": row.get("Close"),
                    "volume": row.get("Volume"),
                }
            )
        return rows

    def get(self, request):
        period = request.query_params.get("period", "1y")
        interval = request.query_params.get("interval", "1d")
        symbol = (request.query_params.get("symbol") or BITCOIN_SYMBOL["symbol"]).strip()
        name = TIMESERIES_SYMBOL_NAMES.get(symbol, symbol)

        ticker = yf.Ticker(symbol)
        fast_info = {}
        info = {}
        history = None
        warnings = []

        try:
            fast_info = ticker.fast_info or {}
        except Exception as exc:
            warnings.append(f"fast_info: {exc}")

        try:
            info = ticker.info or {}
        except Exception as exc:
            warnings.append(f"info: {exc}")

        try:
            history = ticker.history(period=period, interval=interval, auto_adjust=False)
        except Exception as exc:
            warnings.append(f"history: {exc}")

        history_rows = self._parse_history(history)
        closes = [row.get("close") for row in history_rows if isinstance(row.get("close"), (int, float))]
        min_1y = min(closes) if closes else None
        max_1y = max(closes) if closes else None
        last_close = closes[-1] if closes else None
        current_price = _safe_get(fast_info, "lastPrice") or info.get("regularMarketPrice") or last_close

        discount_percent = None
        if max_1y not in (None, 0) and current_price is not None:
            discount_percent = ((max_1y - current_price) / max_1y) * 100

        response_data = {
            "source": "yfinance",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": period,
            "interval": interval,
            "page_name": "TimeSeies",
            "data": {
                "asset": "bitcoin",
                "name": info.get("shortName") or info.get("longName") or name,
                "symbol": symbol,
                "price": current_price,
                "min_1y": min_1y,
                "max_1y": max_1y,
                "discount_percent": discount_percent,
                "change_percent": info.get("regularMarketChangePercent"),
                "currency": info.get("currency"),
                "exchange": info.get("exchange"),
                "history": history_rows,
            },
        }

        if warnings:
            response_data["warning"] = "Some Bitcoin fields could not be fetched."
            response_data["errors"] = warnings

        return Response(response_data, status=status.HTTP_200_OK)


class TimeSeriesArimaForecastView(APIView):
    def get(self, request):
        symbol = (request.query_params.get("symbol") or BITCOIN_SYMBOL["symbol"]).strip()
        period = request.query_params.get("period", "1y")
        interval = request.query_params.get("interval", "1d")
        model_name = (request.query_params.get("model") or "arima").strip().lower()

        days_raw = request.query_params.get("days", "7")
        try:
            days = int(days_raw)
        except (TypeError, ValueError):
            days = 7
        days = max(1, min(days, 30))

        ticker = yf.Ticker(symbol)
        try:
            history = ticker.history(period=period, interval=interval, auto_adjust=False)
        except Exception as exc:
            return Response(
                {"detail": f"Unable to fetch history for {symbol}: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if history is None or history.empty or "Close" not in history:
            return Response(
                {"detail": f"No historical close data available for {symbol}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        close_series = history["Close"].dropna()
        if close_series.shape[0] < 30:
            return Response(
                {"detail": f"Need at least 30 close values for ARIMA. Found {close_series.shape[0]} for {symbol}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Model log-returns to avoid flat level forecasts from integrated models.
        log_returns = close_series.apply(float).apply(math.log).diff().dropna()
        if log_returns.shape[0] < 30:
            return Response(
                {"detail": f"Need at least 30 return points for ARIMA. Found {log_returns.shape[0]} for {symbol}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Use a simple numeric index for ARIMA input to avoid date-frequency warnings.
        model_returns = log_returns.reset_index(drop=True)

        simulated_prices = []
        mean_prices = []
        used_order = None

        if model_name == "arima":
            try:
                from statsmodels.tsa.arima.model import ARIMA
            except Exception as exc:
                return Response(
                    {"detail": f"statsmodels is required for ARIMA forecast: {exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            fit_result = None
            fit_error = ""
            best_aic = None
            for order in [(5, 0, 0), (3, 0, 2), (2, 0, 2), (1, 0, 1)]:
                try:
                    model = ARIMA(model_returns, order=order)
                    current_fit = model.fit()
                    current_aic = getattr(current_fit, "aic", None)
                    if fit_result is None or (current_aic is not None and (best_aic is None or current_aic < best_aic)):
                        fit_result = current_fit
                        used_order = order
                        best_aic = current_aic
                except Exception as exc:
                    fit_error = str(exc)

            if fit_result is None:
                return Response(
                    {"detail": f"ARIMA model failed for {symbol}: {fit_error}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            try:
                mean_return_forecast = fit_result.forecast(steps=days)
            except Exception as exc:
                return Response(
                    {"detail": f"ARIMA forecast failed for {symbol}: {exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Add residual bootstrap noise to mean-return forecast for a realistic, non-flat path.
            residuals = []
            for x in getattr(fit_result, "resid", []):
                try:
                    value = float(x)
                except (TypeError, ValueError):
                    continue
                if math.isfinite(value):
                    residuals.append(value)
            if not residuals:
                residuals = [0.0]
            residuals_sorted = sorted(residuals)
            lower_idx = int(0.05 * (len(residuals_sorted) - 1))
            upper_idx = int(0.95 * (len(residuals_sorted) - 1))
            clipped_pool = residuals_sorted[lower_idx: upper_idx + 1] or residuals_sorted

            last_close = float(close_series.iloc[-1])
            running_sim = last_close
            running_mean = last_close
            for mean_ret in mean_return_forecast:
                shock = random.choice(clipped_pool)
                sim_ret = float(mean_ret) + float(shock)
                running_sim = running_sim * math.exp(sim_ret)
                running_mean = running_mean * math.exp(float(mean_ret))
                simulated_prices.append(running_sim)
                mean_prices.append(running_mean)

        elif model_name in {"exp_smoothing", "exponential_smoothing"}:
            try:
                from statsmodels.tsa.holtwinters import ExponentialSmoothing
            except Exception as exc:
                return Response(
                    {"detail": f"statsmodels is required for Exponential Smoothing: {exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            close_values = close_series.tail(240).astype(float).reset_index(drop=True)
            if close_values.shape[0] < 20:
                return Response(
                    {"detail": f"Need at least 20 close values for Exponential Smoothing. Found {close_values.shape[0]} for {symbol}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                model = ExponentialSmoothing(close_values, trend="add", damped_trend=True)
                fit = model.fit(optimized=True, use_brute=True)
                forecast_values = fit.forecast(days)
            except Exception as exc:
                return Response(
                    {"detail": f"Exponential Smoothing forecast failed for {symbol}: {exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            simulated_prices = [float(v) for v in forecast_values]
            mean_prices = [float(v) for v in forecast_values]
            used_order = "trend=add,damped=True"
            model_name = "exp_smoothing"
        elif model_name == "rnn":
            try:
                import numpy as np
                os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
                import tensorflow as tf
                from tensorflow.keras import Input
                from tensorflow.keras.layers import Dense, SimpleRNN
                from tensorflow.keras.models import Sequential
            except Exception as exc:
                return Response(
                    {"detail": f"TensorFlow is required for RNN forecast: {exc}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            close_values = close_series.tail(300).astype(float).to_numpy()
            if close_values.shape[0] < 90:
                return Response(
                    {"detail": f"Need at least 90 close values for RNN. Found {close_values.shape[0]} for {symbol}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if np.any(close_values <= 0):
                return Response(
                    {"detail": f"RNN requires strictly positive close prices for {symbol}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            log_prices = np.log(close_values)
            returns = np.diff(log_prices)
            if returns.shape[0] < 80:
                return Response(
                    {"detail": f"Need at least 80 return points for RNN. Found {returns.shape[0]} for {symbol}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            mean_ret = float(np.mean(returns))
            std_ret = float(np.std(returns))
            if not np.isfinite(std_ret) or std_ret < 1e-8:
                std_ret = 1e-8
            norm_returns = (returns - mean_ret) / std_ret
            lookback = min(40, max(20, returns.shape[0] // 6))

            x_data = []
            y_data = []
            for i in range(lookback, len(norm_returns)):
                x_data.append(norm_returns[i - lookback: i])
                y_data.append(norm_returns[i])

            if len(x_data) < 30:
                return Response(
                    {"detail": f"Not enough sequences for RNN training on {symbol}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            x_train = np.array(x_data, dtype=np.float32).reshape((-1, lookback, 1))
            y_train = np.array(y_data, dtype=np.float32)

            tf.random.set_seed(42)
            np.random.seed(42)

            model = Sequential(
                [
                    Input(shape=(lookback, 1)),
                    SimpleRNN(48, activation="tanh"),
                    Dense(24, activation="relu"),
                    Dense(1),
                ]
            )
            model.compile(optimizer="adam", loss="mse")
            model.fit(x_train, y_train, epochs=55, batch_size=16, verbose=0)

            train_pred_norm = model.predict(x_train, verbose=0).reshape(-1)
            train_pred_ret = (train_pred_norm * std_ret) + mean_ret
            train_true_ret = (y_train.reshape(-1) * std_ret) + mean_ret
            residuals = train_true_ret - train_pred_ret
            residuals = residuals[np.isfinite(residuals)]
            if residuals.size < 5:
                residuals = np.array([0.0], dtype=np.float64)

            residuals_sorted = np.sort(residuals)
            lo = int(0.05 * (len(residuals_sorted) - 1))
            hi = int(0.95 * (len(residuals_sorted) - 1))
            residual_pool = residuals_sorted[lo: hi + 1]
            if residual_pool.size == 0:
                residual_pool = residuals_sorted

            recent_window = norm_returns[-lookback:].astype(np.float32)
            running_sim = float(close_values[-1])
            running_mean = float(close_values[-1])

            for _ in range(days):
                input_batch = recent_window.reshape((1, lookback, 1))
                pred_norm = float(model.predict(input_batch, verbose=0)[0][0])
                pred_ret_mean = (pred_norm * std_ret) + mean_ret

                noise = float(random.choice(residual_pool.tolist())) * 0.9
                pred_ret_sim = pred_ret_mean + noise

                running_mean = running_mean * math.exp(pred_ret_mean)
                running_sim = running_sim * math.exp(pred_ret_sim)

                mean_prices.append(float(running_mean))
                simulated_prices.append(float(running_sim))

                next_norm = (pred_ret_sim - mean_ret) / std_ret
                recent_window = np.append(recent_window[1:], np.float32(next_norm))

            used_order = f"lookback={lookback},units=48,epochs=55,returns=log"
        else:
            return Response(
                {"detail": f"Unsupported model '{model_name}'. Use 'arima', 'exp_smoothing', or 'rnn'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        history_rows = []
        for idx, value in close_series.tail(120).items():
            history_rows.append(
                {
                    "date": idx.strftime("%Y-%m-%d"),
                    "close": float(value),
                }
            )

        last_date = close_series.index[-1]
        forecast_rows = []
        for step, value in enumerate(simulated_prices, start=1):
            future_date = (last_date + timedelta(days=step)).strftime("%Y-%m-%d")
            forecast_rows.append(
                {
                    "date": future_date,
                    "predicted_close": float(value),
                    "predicted_close_mean": float(mean_prices[step - 1]),
                }
            )

        return Response(
            {
                "source": "yfinance+arima",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "symbol": symbol,
                "name": TIMESERIES_SYMBOL_NAMES.get(symbol, symbol),
                "period": period,
                "interval": interval,
                "model": model_name,
                "forecast_days": days,
                "arima_order": used_order,
                "history": history_rows,
                "forecast": forecast_rows,
            },
            status=status.HTTP_200_OK,
        )
