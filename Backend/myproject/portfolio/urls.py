from django.urls import path
from .views import PortfolioCreateView, PortfolioUpdateDeleteView, SectorStocksView


urlpatterns = [
    # Allow both `/sector-stocks/` (or `/api/sector-stocks/`) and the older nested path
    path("", SectorStocksView.as_view(), name="sector-stocks-root"),
    path("sector-stocks/", SectorStocksView.as_view(), name="sector-stocks"),
    path("portfolios/", PortfolioCreateView.as_view(), name="portfolio-create"),
    path("portfolios/<int:portfolio_id>/", PortfolioUpdateDeleteView.as_view(), name="portfolio-update-delete"),
]
