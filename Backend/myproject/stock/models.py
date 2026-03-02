from django.db import models


class Sector(models.Model):
    name = models.CharField(max_length=64, unique=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Stock(models.Model):
    symbol = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    sector = models.ForeignKey(
        Sector,
        related_name="stocks",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    price = models.DecimalField(max_digits=20, decimal_places=4, null=True, blank=True)
    change_percent = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    market_cap = models.BigIntegerField(null=True, blank=True)
    pe_ratio = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    currency = models.CharField(max_length=16, null=True, blank=True)
    exchange = models.CharField(max_length=64, null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["symbol"]

    def __str__(self):
        return self.symbol


class StockPeHistory(models.Model):
    stock = models.ForeignKey(
        Stock,
        related_name="pe_history",
        on_delete=models.CASCADE,
    )
    pe_ratio = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    captured_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-captured_at"]

    def __str__(self):
        return f"{self.stock.symbol} @ {self.captured_at:%Y-%m-%d %H:%M:%S}"
