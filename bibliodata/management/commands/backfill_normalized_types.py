from django.core.management.base import BaseCommand
from django.db import transaction
from collections import Counter

from bibliodata.models import Publication
from bibliodata.utils_publication_types import normalize_pub_type, CANON_TYPES

class Command(BaseCommand):
    help = "Backfill Publication.normalized_types with a single canonical type (GesBIB style)."

    def add_arguments(self, parser):
        parser.add_argument("--batch-size", type=int, default=1000)
        parser.add_argument("--only-empty", action="store_true")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opt):
        bs = opt["batch_size"]; only_empty = opt["only_empty"]; dry = opt["dry_run"]

        qs = Publication.objects.all().only("id","publication_type","normalized_types")
        if only_empty:
            qs = qs.filter(normalized_types__isnull=True) | Publication.objects.filter(normalized_types=[])

        total = qs.count()
        self.stdout.write(self.style.NOTICE(f"Selected {total} publications."))

        hist = Counter()
        batch = []; updated = unchanged = processed = 0

        for pub in qs.iterator(chunk_size=5000):
            canon = normalize_pub_type(pub.publication_type)
            norm_list = [canon]  # keep JSONField with single value

            hist[canon] += 1

            if pub.normalized_types == norm_list:
                unchanged += 1
            else:
                pub.normalized_types = norm_list
                batch.append(pub)

            if len(batch) >= bs:
                if not dry:
                    with transaction.atomic():
                        Publication.objects.bulk_update(batch, ["normalized_types"])
                updated += len(batch); processed += len(batch); batch.clear()
                self.stdout.write(f"Processed {processed}/{total} ...")

        if batch:
            if not dry:
                with transaction.atomic():
                    Publication.objects.bulk_update(batch, ["normalized_types"])
            updated += len(batch); processed += len(batch)

        self.stdout.write(self.style.SUCCESS("Backfill finished."))
        self.stdout.write(f"Total selected: {total}")
        self.stdout.write(f"Updated rows: {updated}")
        self.stdout.write(f"Unchanged rows: {unchanged}")
        self.stdout.write("Distribution (1:1, sums to publications):")
        for t in CANON_TYPES:
            self.stdout.write(f"  - {t}: {hist.get(t, 0)}")
        if dry:
            self.stdout.write(self.style.WARNING("Dry run: no database changes were committed."))
