"""
Django management command to generate and store semantic embeddings for all publications.
Uses sentence-transformers to vectorize combined publication fields.
"""
import json
from django.core.management.base import BaseCommand
from bibliodata.models import Publication, PublicationEmbedding
from sentence_transformers import SentenceTransformer

class Command(BaseCommand):
    help = "Generate semantic embeddings for all publications and store them in PublicationEmbedding."

    def handle(self, *args, **options):
        model_name = 'all-MiniLM-L6-v2'  # Puedes cambiar el modelo si lo deseas
        self.stdout.write(self.style.SUCCESS(f"Loading embedding model: {model_name}"))
        model = SentenceTransformer(model_name)

        publications = Publication.objects.all()
        total = publications.count()
        self.stdout.write(f"Processing {total} publications...")


        for idx, pub in enumerate(publications, start=1):
            title = pub.title or ''
            areas_raw = ', '.join(pub.areas_all or []) if pub.areas_all else ''
            areas_curated = ', '.join(pub.thematic_areas.values_list('name', flat=True))
            abstract = pub.abstract or ''
            keywords = ', '.join(pub.keywords_all or []) if pub.keywords_all else ''
            authors_main = ', '.join([a.name for a in pub.authors.all()]) if hasattr(pub, 'authors') else ''
            year = str(pub.year) if pub.year else ''

            # Optimized weighted text: prioritize title, areas, authors
            weighted_text = (
                f"{title}. {areas_curated}. {authors_main}. "
                f"{title}. {areas_curated}. "
                f"{title}. "  # Extra weight for title/areas/
            )

            embedding = model.encode(weighted_text)
            embedding_list = embedding.tolist()

            obj, created = PublicationEmbedding.objects.update_or_create(
                publication=pub,
                defaults={
                    'embedding': json.dumps(embedding_list),
                    'source_fields': {
                        'title': title,
                        'year': year,
                        'abstract': abstract,
                        'keywords_all': keywords,
                        'authors_main': authors_main,
                        'areas_curated': areas_curated,
                        'weighted_text': weighted_text,
                    }
                }
            )
            status = 'CREATED' if created else 'UPDATED'
            self.stdout.write(f"[{idx}/{total}] {status} embedding for publication ID {pub.id}")

        self.stdout.write(self.style.SUCCESS("All embeddings generated and stored successfully."))
