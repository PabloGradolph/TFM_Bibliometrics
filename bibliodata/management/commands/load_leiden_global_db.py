from django.core.management.base import BaseCommand
from bibliodata.models import Author
import pandas as pd

class Command(BaseCommand):
    help = "Asigna la comunidad detectada por Louvain a cada Author"

    def handle(self, *args, **options):
        try:
            df = pd.read_csv("analysis/data/networks/nodes_with_communities_leiden.csv")
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR("❌ Archivo de partición no encontrado."))
            return

        count = 0
        not_found = []

        for _, row in df.iterrows():
            id = row['author_id']
            community = row['Community_ID']

            author = Author.objects.filter(gesbib_id__iexact=id).first()
            if author:
                author.leiden_community_global = community
                author.save()
                count += 1
                self.stdout.write(self.style.SUCCESS(f"{author.gesbib_id} → comunidad {community}"))
            else:
                not_found.append(id)

        self.stdout.write(self.style.NOTICE(f"\n✅ Autores actualizados: {count}"))
        if not_found:
            self.stdout.write(self.style.WARNING("\n⚠️ Nombres no encontrados:"))
            for id in not_found:
                self.stdout.write(f" - {id}")
