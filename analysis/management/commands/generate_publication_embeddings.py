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
            # Combina los campos relevantes en un solo texto
            title = pub.title or ''
            year = str(pub.year) if pub.year else ''
            abstract = pub.abstract or ''
            keywords = ', '.join(pub.keywords_all or []) if pub.keywords_all else ''
            authors = ', '.join(pub.other_authors or []) if pub.other_authors else ''
            areas = ', '.join(pub.areas_all or []) if pub.areas_all else ''
            combined_text = f"{title} {year} {abstract} {keywords} {authors} {areas}"

            # Genera el embedding
            embedding = model.encode(combined_text)
            embedding_list = embedding.tolist()  # Para guardar como JSON

            # Guarda o actualiza el embedding en la base de datos
            obj, created = PublicationEmbedding.objects.update_or_create(
                publication=pub,
                defaults={
                    'embedding': json.dumps(embedding_list),
                    'source_fields': {
                        'title': title,
                        'year': year,
                        'abstract': abstract,
                        'keywords_all': keywords,
                        'other_authors': authors,
                        'areas_all': areas,
                        'combined_text': combined_text,
                    }
                }
            )
            status = 'CREATED' if created else 'UPDATED'
            self.stdout.write(f"[{idx}/{total}] {status} embedding for publication ID {pub.id}")

        self.stdout.write(self.style.SUCCESS("All embeddings generated and stored successfully."))
