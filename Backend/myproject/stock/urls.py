from django.urls import path

from .views import (
    AllSectorStocksView,
    BuiltinPortfolioBitcoinView,
    GoldSilverDataView,
    MarketOverviewView,
    StockCrudListCreateView,
    StockCrudUpdateDeleteView,
    StockDetailView,
    TimeSeriesArimaForecastView,
)


urlpatterns = [
    path("", AllSectorStocksView.as_view(), name="all-sector-stocks"),
    path("market-overview/", MarketOverviewView.as_view(), name="market-overview"),
    path("crud/stocks/", StockCrudListCreateView.as_view(), name="stock-crud-list-create"),
    path("crud/stocks/<int:stock_id>/", StockCrudUpdateDeleteView.as_view(), name="stock-crud-update-delete"),
    path("gold-silver/", GoldSilverDataView.as_view(), name="gold-silver-data"),
    path("timeseies/bitcoin/", BuiltinPortfolioBitcoinView.as_view(), name="timeseies-bitcoin"),
    path("timeseies/arima/", TimeSeriesArimaForecastView.as_view(), name="timeseies-arima"),
    path("timeseries/bitcoin/", BuiltinPortfolioBitcoinView.as_view(), name="timeseries-bitcoin"),
    path("timeseries/arima/", TimeSeriesArimaForecastView.as_view(), name="timeseries-arima"),
    path("stock/<str:symbol>/", StockDetailView.as_view(), name="stock-detail"),
]
