from django.core.management.base import BaseCommand
from bibliodata.models import Publication, PublicationMetric
import pandas as pd
from tqdm import tqdm

class Command(BaseCommand):
    help = "Exporta un dataset para entrenamiento de clasificador de áreas temáticas"

    def handle(self, *args, **options):
        rows = []

        queryset = Publication.objects.prefetch_related('thematic_areas', 'metrics')

        for pub in tqdm(queryset, desc="Procesando publicaciones"):
            # Solo extraer publicaciones con al menos una área temática (para entrenamiento)
            thematic_areas = list(pub.thematic_areas.values_list('name', flat=True))
            if thematic_areas:
                continue

            # Extraer métricas si existen
            metrics = pub.metrics.filter(metric_type='jif').order_by('-year')  # puedes cambiar a otro tipo
            metric = metrics.first() if metrics.exists() else None

            rows.append({
                'gb_id': pub.gb_id,
                'title': pub.title,
                'abstract': pub.abstract,
                'year': pub.year,
                'keywords': ';'.join(pub.keywords_all or []),
                'publication_type': ';'.join(pub.publication_type or []),
                'language': pub.language,
                'source': pub.source,
                'editorial': pub.editorial,
                'conference_name': ';'.join(pub.conference_name or []),
                'jcr_materias': ';'.join(pub.jcr_materias or []),

                'citations': pub.citations,
                'international_collab': pub.international_collab,
                'num_countries': pub.num_countries,
                'num_foreign_affils': pub.num_foreign_affils,
                'num_spanish_affils': pub.num_spanish_affils,

                'quartile_value': metric.quartile_value if metric else None,
                'impact_factor': metric.impact_factor if metric else None,
                'percentile': metric.percentile if metric else None,

                'label': ';'.join(thematic_areas),
            })

        df = pd.DataFrame(rows)
        output_path = "analysis/data/datasets/publications_to_predict_dataset.csv"
        df.to_csv(output_path, index=False)

        self.stdout.write(self.style.SUCCESS(f"Dataset exportado en {output_path} ({len(df)} filas)"))
