from django.urls import path
from .views import PortfolioCreateView, PortfolioUpdateDeleteView, SectorStocksView


urlpatterns = [
    path("sector-stocks/", SectorStocksView.as_view(), name="sector-stocks"),
    path("portfolios/", PortfolioCreateView.as_view(), name="portfolio-create"),
    path("portfolios/<int:portfolio_id>/", PortfolioUpdateDeleteView.as_view(), name="portfolio-update-delete"),
]
