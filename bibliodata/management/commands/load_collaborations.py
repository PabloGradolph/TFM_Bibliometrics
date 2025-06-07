from django.core.management.base import BaseCommand
from bibliodata.models import Author, Publication, Collaboration
from django.db import transaction

class Command(BaseCommand):
    help = "Genera y guarda relaciones de colaboración entre autores"

    def handle(self, *args, **options):
        self.stdout.write("🧠 Buscando colaboraciones entre autores...")
        Collaboration.objects.all().delete()

        total = 0
        authors = Author.objects.all()

        with transaction.atomic():
            for author in authors:
                # Publicaciones en las que participa este autor
                pubs = Publication.objects.filter(authors=author).prefetch_related('authors')
                counter = {}

                for pub in pubs:
                    for coauthor in pub.authors.all():
                        if coauthor != author:
                            key = tuple(sorted((author.gesbib_id, coauthor.gesbib_id)))  # Evitar duplicado inverso
                            counter[key] = counter.get(key, 0) + 1

                for (gesbib_id1, gesbib_id2), count in counter.items():
                    author1 = Author.objects.get(gesbib_id=gesbib_id1)
                    author2 = Author.objects.get(gesbib_id=gesbib_id2)
                    if not Collaboration.objects.filter(author=author1, collaborator=author2).exists() and \
                       not Collaboration.objects.filter(author=author2, collaborator=author1).exists():
                        Collaboration.objects.create(author=author1, collaborator=author2, publication_count=count)
                        total += 1

                self.stdout.write(f"🔗 {author.name}: {len(counter)} colaboraciones")

        self.stdout.write(self.style.SUCCESS(f"\n✅ Total de colaboraciones creadas: {total}"))
