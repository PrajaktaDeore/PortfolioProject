from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("stock", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="StockPeHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("pe_ratio", models.DecimalField(blank=True, decimal_places=4, max_digits=12, null=True)),
                ("captured_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("stock", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pe_history", to="stock.stock")),
            ],
            options={
                "ordering": ["-captured_at"],
            },
        ),
    ]
