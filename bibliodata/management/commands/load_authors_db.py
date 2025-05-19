import csv
import json
import re

from django.core.management.base import BaseCommand
from bibliodata.models import Author, Institution

class Command(BaseCommand):
    help = "Carga los autores del IPBLN desde CSV y JSON enriquecido."

    def handle(self, *args, **kwargs):
        csv_path = "data/data/IPBLN/csv/authors_IPBLN.csv"
        json_path = "data/data/IPBLN/json/gesbib_authors_ipbln_info.json"

        # 1. Cargar CSV
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            csv_data = {row["id_autor_gesbib"]: row for row in reader}

        # 2. Cargar JSON
        with open(json_path, encoding="utf-8") as f:
            json_data = json.load(f)

        created, updated = 0, 0

        for gesbib_id, json_author in json_data.items():
            row = csv_data.get(gesbib_id)
            if not row:
                self.stdout.write(self.style.WARNING(f"❗ Autor {gesbib_id} no está en el CSV"))
                continue

            # Extraer OpenAlex ID desde enlace
            openalex_link = row.get("OpenAlexID link", "")
            openalex_id = None
            if openalex_link:
                match = re.search(r'/A(\d+)$', openalex_link)
                if match:
                    openalex_id = match.group(1)

            # Buscar institución
            institution = None
            inst_id = json_author.get("idInstitutoUltimo")
            if inst_id:
                institution = Institution.objects.filter(gesbib_id=inst_id).first()

            obj, created_flag = Author.objects.update_or_create(
                gesbib_id=gesbib_id,
                defaults={
                    "csic_id": str(json_author.get("idInterviniente") or ""),
                    "name": row.get("Nombre"),
                    "name_link": row.get("Nombre link"),
                    "signature": json_author.get("firmaDigitalCsic"),
                    "aliases": json_author.get("firmas", []),
                    "orcid": row.get("ORCID"),
                    "orcid_link": row.get("ORCID link"),
                    "researcher_id": json_author.get("ridPrincipalId")[0] if json_author.get("ridPrincipalId") else None,
                    "researcher_ids": json_author.get("ridPrincipalId", []),
                    "researcher_id_link": row.get("RID link"),
                    "scopus_id": json_author.get("scopusPrincipalId")[0] if json_author.get("scopusPrincipalId") else None,
                    "scopus_ids": json_author.get("scopusPrincipalId", []),
                    "scopus_id_link": row.get("Scopus ID link"),
                    "openalex_id": openalex_id,
                    "openalex_id_link": openalex_link,
                    "google_scholar": row.get("Google Sch."),
                    "google_scholar_link": row.get("Google Sch. link"),
                    "digital_csic": row.get("Perfil Digital.CSIC link"),
                    "fecyt_cvn": row.get("CVN link"),
                    "total_publications": json_author.get("numPubs"),
                    "total_citations": json_author.get("totalCitas"),
                    "citations_wos": json_author.get("citasWos"),
                    "citations_scopus": json_author.get("citasScopus"),
                    "h_index": row.get("Indice-H (W/S)"),
                    "h_index_gb": json_author.get("indiceHGb"),
                    "h_index_h5gb": json_author.get("indiceH5Gb"),
                    "international_index": float(row.get("Internac.", 0)) or None,
                    "gender_estimate": json_author.get("generoSupuesto"),
                    "institutions_raw": row.get("Instos."),
                    "institutions_last": institution,
                    "institutions_work": json_author.get("idsInstitutosVinculacionLaboral", []),
                    "institutions_published": json_author.get("idsInstitutosConPublicaciones", []),
                    "materias_jcr": json_author.get("materiasJcr"),
                    "materias_cs": json_author.get("materiasCs"),
                    "keywords": json_author.get("palabrasClave"),
                    "country_id": json_author.get("idPaisUltimo"),
                }
            )

            if created_flag:
                created += 1
            else:
                updated += 1
        
        self.stdout.write(self.style.SUCCESS(f"✅ Autores creados: {created}"))
        self.stdout.write(self.style.SUCCESS(f"🔄 Autores actualizados: {updated}"))