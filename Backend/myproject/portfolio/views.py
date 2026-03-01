import yfinance as yf
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


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

        tickers = yf.Tickers(" ".join(symbols))
        payload = []
        for symbol, ticker in tickers.tickers.items():
            info = ticker.info or {}
            payload.append(
                {
                    "symbol": symbol,
                    "name": info.get("shortName") or info.get("longName"),
                    "price": info.get("regularMarketPrice"),
                    "change_percent": info.get("regularMarketChangePercent"),
                    "market_cap": info.get("marketCap"),
                    "pe_ratio": info.get("trailingPE"),
                    "currency": info.get("currency"),
                    "exchange": info.get("exchange"),
                }
            )

        return Response(
            {"sector": sector, "count": len(payload), "data": payload},
            status=status.HTTP_200_OK,
        )
