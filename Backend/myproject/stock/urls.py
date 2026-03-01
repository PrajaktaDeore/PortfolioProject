from django.urls import path

from .views import AllSectorStocksView, StockDetailView


urlpatterns = [
    path("", AllSectorStocksView.as_view(), name="all-sector-stocks"),
    path("stock/<str:symbol>/", StockDetailView.as_view(), name="stock-detail"),
]
