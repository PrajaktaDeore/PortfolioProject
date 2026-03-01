from django.urls import path
from .views import SectorStocksView


urlpatterns = [
    path("sector-stocks/", SectorStocksView.as_view(), name="sector-stocks"),
]
