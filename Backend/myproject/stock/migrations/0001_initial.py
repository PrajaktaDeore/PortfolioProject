from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Sector",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(db_index=True, max_length=64, unique=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Stock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("symbol", models.CharField(db_index=True, max_length=32, unique=True)),
                ("name", models.CharField(blank=True, max_length=255, null=True)),
                ("price", models.DecimalField(blank=True, decimal_places=4, max_digits=20, null=True)),
                ("change_percent", models.DecimalField(blank=True, decimal_places=4, max_digits=10, null=True)),
                ("market_cap", models.BigIntegerField(blank=True, null=True)),
                ("pe_ratio", models.DecimalField(blank=True, decimal_places=4, max_digits=12, null=True)),
                ("currency", models.CharField(blank=True, max_length=16, null=True)),
                ("exchange", models.CharField(blank=True, max_length=64, null=True)),
                ("last_updated", models.DateTimeField(auto_now=True)),
                (
                    "sector",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="stocks",
                        to="stock.sector",
                    ),
                ),
            ],
            options={
                "ordering": ["symbol"],
            },
        ),
    ]
