"""Django management command to export clustering configurations to CSV.

This command aggregates entries from AuthorClustering to produce a per-configuration
summary (model_name, k, pca_dims) with average quality metrics and counts, then
computes a normalized combined score to rank configurations from best to worst.

Default combined score follows the app's current heuristic used in the
collaboration keywords network selection:
    combined = 0.8 * norm_silhouette + 0.1 * norm_calinski + 0.1 * norm_davies

Notes:
- Min-max normalization is applied across the set of configurations for each metric.
- When max == min (flat distribution), the normalized value defaults to 0.
- By default, Davies-Bouldin is not inverted here to match the current app logic
  (higher normalized DB scores contribute positively). If you prefer the
  conventional interpretation (lower DB is better), pass --invert-davies to
  invert its normalized contribution.

Usage examples:
    python manage.py export_cluster_configs --outfile configs.csv
    python manage.py export_cluster_configs --invert-davies --weights 0.8,0.1,0.1

Columns exported:
    model_name, k, pca_dims, authors_count, noise_count,
    silhouette_avg, calinski_harabasz_avg, davies_bouldin_avg,
    norm_silhouette, norm_calinski, norm_davies, combined_score
"""

import csv
from typing import List, Tuple

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q

from bibliodata.models import AuthorClustering


class Command(BaseCommand):
    """Export clustering configurations ranked by a combined normalized score."""

    help = (
        "Export clustering configurations (model_name, k, pca_dims) to CSV, "
        "ranked by a combined normalized score (0.8 sil, 0.1 cal, 0.1 db by default)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--outfile",
            default="cluster_configurations.csv",
            help="Output CSV file path (default: cluster_configurations.csv)",
        )
        parser.add_argument(
            "--weights",
            default="0.8,0.1,0.1",
            help="Comma-separated weights for silhouette,calinski,davies (default: 0.8,0.1,0.1)",
        )
        parser.add_argument(
            "--invert-davies",
            action="store_true",
            help="Invert Davies-Bouldin normalized contribution (lower is better).",
        )

    def _parse_weights(self, raw: str) -> Tuple[float, float, float]:
        try:
            parts = [float(x.strip()) for x in raw.split(",")]
            if len(parts) != 3:
                raise ValueError
            w_sum = sum(parts)
            if w_sum == 0:
                return 0.8, 0.1, 0.1
            # Normalize weights to sum 1 (defensive)
            return parts[0] / w_sum, parts[1] / w_sum, parts[2] / w_sum
        except Exception:
            return 0.8, 0.1, 0.1

    def handle(self, *args, **options):
        outfile: str = options["outfile"]
        invert_davies: bool = options["invert_davies"]
        w_sil, w_cal, w_db = self._parse_weights(options["weights"])  # defaults to 0.8,0.1,0.1

        # Aggregate per-configuration values
        qs = (
            AuthorClustering.objects
            .values("model_name", "k", "pca_dims")
            .annotate(
                silhouette_avg=Avg("silhouette"),
                calinski_harabasz_avg=Avg("calinski_harabasz"),
                davies_bouldin_avg=Avg("davies_bouldin"),
                authors_count=Count("author", distinct=True),
                noise_count=Count("id", filter=Q(cluster=-1)),
            )
        )

        configs = list(qs)
        if not configs:
            self.stdout.write(self.style.WARNING("No clustering configurations found."))
            return

        # Compute min-max for normalization (ignore None values)
        def _min_max(values: List[float]):
            vals = [v for v in values if v is not None]
            if not vals:
                return None, None
            return min(vals), max(vals)

        min_sil, max_sil = _min_max([c["silhouette_avg"] for c in configs])
        min_cal, max_cal = _min_max([c["calinski_harabasz_avg"] for c in configs])
        min_db, max_db = _min_max([c["davies_bouldin_avg"] for c in configs])

        def _norm(val, vmin, vmax):
            if val is None or vmin is None or vmax is None or vmax == vmin:
                return 0.0
            return (val - vmin) / (vmax - vmin)

        # Compute normalized metrics and combined score
        for c in configs:
            n_sil = _norm(c["silhouette_avg"], min_sil, max_sil)
            n_cal = _norm(c["calinski_harabasz_avg"], min_cal, max_cal)
            n_db = _norm(c["davies_bouldin_avg"], min_db, max_db)
            if invert_davies:
                n_db = 1.0 - n_db

            c["norm_silhouette"] = round(n_sil, 6)
            c["norm_calinski"] = round(n_cal, 6)
            c["norm_davies"] = round(n_db, 6)
            c["combined_score"] = round(w_sil * n_sil + w_cal * n_cal + w_db * n_db, 6)

        # Sort best to worst
        configs.sort(key=lambda x: x["combined_score"], reverse=True)

        headers = [
            "model_name", "k", "pca_dims", "authors_count", "noise_count",
            "silhouette_avg", "calinski_harabasz_avg", "davies_bouldin_avg",
            "norm_silhouette", "norm_calinski", "norm_davies", "combined_score",
        ]

        with open(outfile, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for c in configs:
                writer.writerow({h: c.get(h, "") for h in headers})

        self.stdout.write(self.style.SUCCESS(
            f"Exported {len(configs)} configurations to {outfile} (weights sil/cal/db = {w_sil:.2f}/{w_cal:.2f}/{w_db:.2f}, "
            f"invert_davies={invert_davies})"
        ))
