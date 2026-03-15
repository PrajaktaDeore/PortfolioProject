def _dedupe(symbols):
    seen = set()
    out = []
    for symbol in symbols:
        symbol = str(symbol or "").strip()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        out.append(symbol)
    return out


# Canonical sector keys used by the frontend routes and API responses.
# Keep values as Yahoo Finance-compatible symbols (NSE uses `.NS`).
SECTOR_SYMBOLS = {
    "auto": _dedupe(
        [
            "MARUTI.NS",
            "TATAMOTORS.NS",
            "M&M.NS",
            "BAJAJ-AUTO.NS",
            "EICHERMOT.NS",
            "HEROMOTOCO.NS",
        ]
    ),
    "banking": _dedupe(
        [
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
        ]
    ),
    "cement": _dedupe(
        [
            "ULTRACEMCO.NS",
            "AMBUJACEM.NS",
            "SHREECEM.NS",
            "ACC.NS",
            "DALBHARAT.NS",
            "JKCEMENT.NS",
        ]
    ),
    "chemicals": _dedupe(
        [
            "AARTIIND.NS",
            "SRF.NS",
            "DEEPAKNTR.NS",
            "NAVINFLUOR.NS",
            "ATUL.NS",
            "PIIND.NS",
        ]
    ),
    "consumer": _dedupe(
        [
            "TITAN.NS",
            "ASIANPAINT.NS",
            "PIDILITIND.NS",
            "DMART.NS",
            "TRENT.NS",
            "BERGEPAINT.NS",
        ]
    ),
    "energy": _dedupe(
        [
            "RELIANCE.NS",
            "ONGC.NS",
            "IOC.NS",
            "BPCL.NS",
            "NTPC.NS",
            "POWERGRID.NS",
        ]
    ),
    "finance": _dedupe(
        [
            "BAJFINANCE.NS",
            "BAJAJFINSV.NS",
            "HDFCLIFE.NS",
            "SBILIFE.NS",
            "ICICIGI.NS",
            "ICICIPRULI.NS",
            "CHOLAFIN.NS",
            "MFSL.NS",
        ]
    ),
    "fmcg": _dedupe(
        [
            "HINDUNILVR.NS",
            "ITC.NS",
            "NESTLEIND.NS",
            "DABUR.NS",
            "BRITANNIA.NS",
            "MARICO.NS",
        ]
    ),
    "healthcare": _dedupe(
        [
            "APOLLOHOSP.NS",
            "MAXHEALTH.NS",
            "FORTIS.NS",
            "LALPATHLAB.NS",
            "METROPOLIS.NS",
            "SUNPHARMA.NS",
        ]
    ),
    "infrastructure": _dedupe(
        [
            "LT.NS",
            "ADANIPORTS.NS",
            "GMRINFRA.NS",
            "IRB.NS",
            "NCC.NS",
            "KEC.NS",
        ]
    ),
    "it": _dedupe(
        [
            "TCS.NS",
            "INFY.NS",
            "HCLTECH.NS",
            "WIPRO.NS",
            "TECHM.NS",
            "LTIM.NS",
        ]
    ),
    "media": _dedupe(
        [
            "ZEEL.NS",
            "SUNTV.NS",
            "PVRINOX.NS",
            "NETWORK18.NS",
            "TV18BRDCST.NS",
            "DISHTV.NS",
        ]
    ),
    "metals": _dedupe(
        [
            "TATASTEEL.NS",
            "JSWSTEEL.NS",
            "HINDALCO.NS",
            "VEDL.NS",
            "SAIL.NS",
        ]
    ),
    "pharma": _dedupe(
        [
            "SUNPHARMA.NS",
            "DRREDDY.NS",
            "CIPLA.NS",
            "DIVISLAB.NS",
            "APOLLOHOSP.NS",
            "LUPIN.NS",
        ]
    ),
    "power": _dedupe(
        [
            "NTPC.NS",
            "POWERGRID.NS",
            "TATAPOWER.NS",
            "ADANIPOWER.NS",
            "TORNTPOWER.NS",
            "NHPC.NS",
        ]
    ),
    "realty": _dedupe(
        [
            "DLF.NS",
            "GODREJPROP.NS",
            "OBEROIRLTY.NS",
            "PRESTIGE.NS",
            "PHOENIXLTD.NS",
            "BRIGADE.NS",
        ]
    ),
    "telecom": _dedupe(
        [
            "BHARTIARTL.NS",
            "IDEA.NS",
            "INDUSTOWER.NS",
            "TATACOMM.NS",
        ]
    ),
}


SECTOR_ALIASES = {
    "automobile": "auto",
    "autos": "auto",
    "banks": "banking",
    "bank": "banking",
    "financial": "finance",
    "financials": "finance",
    "health": "healthcare",
    "health-care": "healthcare",
    "tech": "it",
    "technology": "it",
    "information-technology": "it",
    "infra": "infrastructure",
    "capital-goods": "infrastructure",
    "construction": "infrastructure",
    "consumer-discretionary": "consumer",
    "real-estate": "realty",
    "telecommunications": "telecom",
    "pharmaceuticals": "pharma",
}


def resolve_sector(value):
    normalized = str(value or "").strip().lower()
    if not normalized:
        return ""
    canonical = SECTOR_ALIASES.get(normalized, normalized)
    return canonical

