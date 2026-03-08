import yfinance as yf
import math
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Portfolio
from .serializers import PortfolioSerializer


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


def _json_safe_number(value):
    """Convert NaN/Infinity and non-numeric values to None for JSON compliance."""
    if value is None:
        return None
    try:
        num = float(value)
    except Exception:
        return None
    return num if math.isfinite(num) else None


class SectorStocksView(APIView):
    def get(self, request):
        sector = request.query_params.get("sector", "").strip().lower()
        if not sector:
            return Response(
                {
                    "detail": "Query param 'sector' is required.",
                    "available_sectors": sorted(SECTOR_SYMBOLS.keys()),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        symbols = SECTOR_SYMBOLS.get(sector)
        if not symbols:
            return Response(
                {
                    "detail": "Unknown sector.",
                    "available_sectors": sorted(SECTOR_SYMBOLS.keys()),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        base_payload = [
            {
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

        try:
            tickers = yf.Tickers(" ".join(symbols))
        except Exception as exc:
            return Response(
                {
                    "sector": sector,
                    "count": len(base_payload),
                    "data": base_payload,
                    "warning": "Live provider unavailable; returning symbol list only.",
                    "error": str(exc),
                },
                status=status.HTTP_200_OK,
            )

        payload = []
        tickers_by_symbol = getattr(tickers, "tickers", {}) or {}
        for symbol in symbols:
            ticker = tickers_by_symbol.get(symbol) if isinstance(tickers_by_symbol, dict) else None
            if ticker is None:
                payload.append(next((row for row in base_payload if row["symbol"] == symbol), {"symbol": symbol}))
                continue
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
                    "symbol": symbol,
                    "name": info.get("shortName") or info.get("longName"),
                    "price": _json_safe_number(_safe_get(fast_info, "lastPrice") or info.get("regularMarketPrice")),
                    "min_1y": _json_safe_number(_safe_get(fast_info, "yearLow") or info.get("fiftyTwoWeekLow")),
                    "max_1y": _json_safe_number(_safe_get(fast_info, "yearHigh") or info.get("fiftyTwoWeekHigh")),
                    "change_percent": _json_safe_number(info.get("regularMarketChangePercent")),
                    "market_cap": _json_safe_number(info.get("marketCap")),
                    "pe_ratio": _json_safe_number(info.get("trailingPE")),
                    "currency": info.get("currency"),
                    "exchange": info.get("exchange"),
                }
            )

        return Response(
            {"sector": sector, "count": len(payload), "data": payload},
            status=status.HTTP_200_OK,
        )


class PortfolioCreateView(APIView):
    def post(self, request):
        serializer = PortfolioSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PortfolioUpdateDeleteView(APIView):
    def put(self, request, portfolio_id):
        portfolio = get_object_or_404(Portfolio, id=portfolio_id)
        serializer = PortfolioSerializer(portfolio, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, portfolio_id):
        portfolio = get_object_or_404(Portfolio, id=portfolio_id)
        serializer = PortfolioSerializer(portfolio, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, portfolio_id):
        portfolio = get_object_or_404(Portfolio, id=portfolio_id)
        portfolio.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
