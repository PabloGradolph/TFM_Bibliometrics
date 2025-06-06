from django.core.management.base import BaseCommand
from bibliodata.models import Author
import pandas as pd

class Command(BaseCommand):
    help = "Asigna la comunidad detectada por Leiden a cada Author (con ajuste manual para 4 nodos)"

    def handle(self, *args, **options):
        try:
            df = pd.read_csv("analysis/best_IPs_agrupations/LovainaLeiden/leiden_best_partition.csv")
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR("❌ Archivo de partición no encontrado."))
            return

        count = 0
        not_found = []

        for _, row in df.iterrows():
            name = row['author_name']
            community = row['leiden_community']

            author = Author.objects.filter(name__iexact=name).first()
            if author:
                author.leiden_community = community
                author.save()
                count += 1
                self.stdout.write(self.style.SUCCESS(f"{author.name} → comunidad {community}"))
            else:
                not_found.append(name)

        self.stdout.write(self.style.NOTICE(f"\n✅ Autores actualizados: {count}"))
        if not_found:
            self.stdout.write(self.style.WARNING("\n⚠️ Nombres no encontrados:"))
            for name in not_found:
                self.stdout.write(f" - {name}")
