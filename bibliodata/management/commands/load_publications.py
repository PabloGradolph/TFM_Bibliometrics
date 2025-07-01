import csv
import json
import re
import unidecode
from django.core.management.base import BaseCommand
from bibliodata.models import Publication, PublicationMetric, Author, Institution, ThematicArea


def clean_list(json_list):
    if not isinstance(json_list, list):
        return []
    return [item.split("|", 1)[1].strip() if "|" in item else item.strip() for item in json_list]

def parse_number(val):
    if not val:  # Cubre None y cadena vacía
        return None
    try:
        token = val.split(" ")[0].replace(",", ".")
        return float(token) if token != "" else None
    except (ValueError, AttributeError):
        return None


class Command(BaseCommand):
    help = "Carga publicaciones desde items.csv, impacto.csv y JSON enriquecido"

    def handle(self, *args, **kwargs):
        path_items = "data/data/IPBLN/csv/items_only_IPBLN.csv"
        path_impact = "data/data/IPBLN/csv/impact_only_IPBLN.csv"
        path_json = "data/data/IPBLN/json/items_only_ipbln_info.json"

        with open(path_items, encoding="utf-8") as f:
            items = {row["id_publicacion"]: row for row in csv.DictReader(f, delimiter="\t")}

        with open(path_impact, encoding="utf-8") as f:
            impact = {row["id_publicacion"]: row for row in csv.DictReader(f, delimiter="\t")}

        with open(path_json, encoding="utf-8") as f:
            json_data = json.load(f)

        created, updated = 0, 0

        for pub_id, item in items.items():
            j = json_data.get(pub_id, {}).get("sd", {})
            print(f"Procesando publicación {pub_id}...")
            def jv(k):
                val = j.get(k)
                if isinstance(val, dict) and "value" in val:
                    return val["value"]
                else:
                    return val  # puede ser lista, string, número, etc.
            imp = impact.get(pub_id, {})

            # === Datos básicos ===
            obj, created_flag = Publication.objects.update_or_create(
                gb_id=pub_id,
                defaults={
                    "title": item.get("Título"),
                    "title_link": item.get("Título link"),
                    "doi": jv("doi"),
                    "year": int(item.get("Año") or 0),
                    "publication_date": jv("fecha_publicacion"),
                    "publication_type": jv("doctype"), # Lista
                    "source": item.get("Fuente"),
                    "source_link": item.get("Fuente link"),
                    "source_id": item.get("id_fuente"),
                    "editorial": item.get("Editorial"),
                    "editorial_link": item.get("Editorial link"),
                    "aa_link": item.get("AA link"),
                    "extra_sources": item.get("Extra", "").split("; ") if item.get("Extra") else [],
                    "extra_links": item.get("Extra link", "").split(" | ") if item.get("Extra link") else [],
                    "citations": int(item.get("Citas") or 0),
                    "international_collab": parse_number(item.get("Colab. internac.")),
                    "language": jv("idioma"),
                    "abstract": jv("abstract"),
                    "isbn": jv("isbn"), # Lista
                    "issns": jv("issns"), # Lista
                    "conference_name": jv("conferencia_nombre"), # Lista
                    "conference_location": jv("conferencia_lugar"), # Lista
                    "conference_date": jv("conferencia_fecha"), # Lista
                    "keywords_all": jv("keywords_all"), # Lista
                    "affiliations": clean_list(jv("afiliaciones")), # Lista a editar
                    "num_countries": int(jv("num_pais")) if jv("num_pais") else 0,
                    "num_spanish_affils": int(jv("num_spanish_affils")) if jv("num_spanish_affils") else 0,
                    "num_foreign_affils": int(jv("num_foreign_affils")) if jv("num_foreign_affils") else 0,
                    "ccaas": clean_list(jv("ccaa")), # Lista a editar
                    "provinces": clean_list(jv("provincia")), # Lista a editar
                    "areas_all": jv("area_all"), # Lista
                    "jcr_materias": clean_list(jv("jcr_materia")),
                }
            )

            # === Autores ===
            ids_autores_csv = item.get("id_autores", "").split(" | ")
            ids_autores_csv = [aid.strip() for aid in ids_autores_csv if aid.strip()]

            firmas_autores_ipbln = set()
            for autor in Author.objects.all():
                firmas_autores_ipbln.add(autor.name.strip())
                if autor.aliases:
                    firmas_autores_ipbln.update([a.strip() for a in autor.aliases])

            autores_obj = []
            for aid in ids_autores_csv:
                autor = Author.objects.filter(gesbib_id=aid).first()
                if autor:
                    autores_obj.append(autor)
            obj.authors.set(autores_obj)

            otros_autores_nombres = []
            lista_autores_json = j.get("autores", [])
            for autor_str in lista_autores_json:
                partes = autor_str.split("|", 1)
                if len(partes) == 2:
                    nombre_autor = partes[1].strip()
                    if nombre_autor not in firmas_autores_ipbln:
                        otros_autores_nombres.append(nombre_autor)
            obj.other_authors = otros_autores_nombres

            # === Instituciones ===
            institutions_objs = []
            
            for inst in jv("institutos_csic_recon") or []:
                parts = inst.split("|")
                if len(parts) > 1:
                    name = parts[1].strip()
                    institution = Institution.objects.filter(name=name).first()
                    if institution:
                        institutions_objs.append(institution)

            obj.institutions.set(institutions_objs)

            # === Temáticas ===
            areas = jv("area_all") or []
            if not areas:
                areas = clean_list(jv("jcr_materia")) or []

            for area in areas:
                area_obj, _ = ThematicArea.objects.get_or_create(name=area.strip())
                obj.thematic_areas.add(area_obj)

            obj.save()

            # === Métricas ===
            def add_metric(source, type_, year, **kwargs):
                PublicationMetric.objects.update_or_create(
                    publication=obj,
                    source=source,
                    metric_type=type_,
                    year=year,
                    defaults=kwargs
                )

            try:
                year = int(item.get("Año") or 0)
                add_metric("dimensions", "citations", year, impact_factor=parse_number(imp.get("Dimensions - Citas")))
                add_metric("dimensions", "recent_citations", year, impact_factor=parse_number(imp.get("Dimensions - Citas recientes (2y)")))
                add_metric("dimensions", "fcr", year, impact_factor=parse_number(imp.get("Dimensions - FCR")))
                add_metric("dimensions", "rcr", year, impact_factor=parse_number(imp.get("Dimensions - RCR")))

                add_metric("wos", "jif", year,
                           impact_factor=parse_number(imp.get("WoS JIF - JIF")),
                           percentile=parse_number(imp.get("WoS JIF - JIF Mejor PCT")),
                           quartile=imp.get("WoS JIF - JIF Mejor Q"),
                           position=imp.get("WoS JIF - JIF Mejor Pos."),
                           subject_areas=imp.get("WoS JIF - Materias JCR - JIF"),
                           source_journal_name=imp.get("WoS JIF - Fuente"),
                           source_journal_link=imp.get("WoS JIF - Fuente links"),
                           international_collab=parse_number(imp.get("Wos JIF - Colab. internac.")))

                add_metric("wos", "jci", year,
                           impact_factor=parse_number(imp.get("WoS JIF - JCI")),
                           percentile=parse_number(imp.get("WoS JIF - JCI Mejor PCT")),
                           quartile=imp.get("WoS JIF - JCI Mejor Q"),
                           position=imp.get("WoS JIF - JCI Mejor Pos."),
                           subject_areas=imp.get("WoS JIF - Materias JCR - JCI"))

                add_metric("wos", "influence", year,
                           influence_score=parse_number(imp.get("WoS JIF - Article Influence Score")))

                add_metric("wos", "citations", year,
                           impact_factor=parse_number(imp.get("WoS JIF - Citas")))
                
                add_metric("scopus", "citations", year,
                           impact_factor=parse_number(imp.get("Scopus - Citas")))
                
                add_metric("scopus", "sjr", year,
                            impact_factor=parse_number(imp.get("Scopus - SJR")),
                            percentile=parse_number(imp.get("Scopus - SJR Mejor PCT")),
                            quartile=imp.get("Scopus - SJR Mejor Q"),
                            position=imp.get("Scopus - SJR Mejor Pos."),
                            source_journal_name=imp.get("Scopus - Fuente"),
                            source_journal_link=imp.get("Scopus - Fuente links"),
                            subject_areas=imp.get("Scopus - Materias SJR"))

                add_metric("scopus", "citescore", year,
                            impact_factor=parse_number(imp.get("Scopus - CiteScore")),
                            percentile=parse_number(imp.get("Scopus - CiteScore Mejor PCT")),
                            quartile=imp.get("Scopus - CiteScore Mejor Q"),
                            position=imp.get("Scopus - CiteScore Mejor Pos."),
                            subject_areas=imp.get("Scopus - Materias CiteScore"),
                            international_collab=parse_number(imp.get("Scopus - Colab. internac.")))

            except Exception as e:
                self.stdout.write(self.style.WARNING(f"⚠️ Error añadiendo métricas para {pub_id}: {e}"))

            created += 1 if created_flag else 0
            updated += 0 if created_flag else 1

        self.stdout.write(self.style.SUCCESS(f"✅ Publicaciones creadas: {created}"))
        self.stdout.write(self.style.SUCCESS(f"🔄 Publicaciones actualizadas: {updated}"))
