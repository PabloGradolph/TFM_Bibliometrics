import csv
from django.core.management.base import BaseCommand
from bibliodata.models import Institution, InstitutionMetric

class Command(BaseCommand):
    help = "Carga los institutos y métricas desde un CSV de GesBIB"

    def handle(self, *args, **options):
        year = 2025
        source = "GESBIB"
        csv_path = 'data/data/IPBLN/csv/gesbib_institutions.csv'

        with open(csv_path, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            for row in reader:
                # Limpia el enlace directamente
                raw_link = row['Nombre link'].strip("[]'\"")
                link = f"https://apps.csic.es/gesbib/adv/{raw_link}" if raw_link else None

                inst, created = Institution.objects.update_or_create(
                    gesbib_id=row['id_instituto_gesbib'],
                    defaults={
                        'name': row['Nombre'],
                        'link': link,
                        'international_collab_index': float(row['Colab. Internac.']) if row['Colab. Internac.'] else None
                    }
                )

                InstitutionMetric.objects.update_or_create(
                    institution=inst,
                    source=source,
                    year=year,
                    defaults={
                        'num_pubs_own': int(row['Nº Publicaciones - Propias']),
                        'num_pubs_own_children': int(row['Nº Publicaciones - Propias + hijos']),
                        'num_pubs_wos': int(row['Nº Publicaciones - WoS (Propias + hijos)']),
                        'num_pubs_scopus': int(row['Nº Publicaciones - Scopus (Propias + hijos)']),
                        'citations_wos': int(row['Nº Citas - WoS']),
                        'citations_scopus': int(row['Nº Citas - Scopus']),
                        'h_index_wos': int(row['Índice-H - WoS']),
                        'h_index_scopus': int(row['Índice-H - Scopus']),
                    }
                )


        self.stdout.write(self.style.SUCCESS("✅ Instituciones y métricas cargadas con éxito."))