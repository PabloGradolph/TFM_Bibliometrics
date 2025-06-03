import csv
import networkx as nx
from unidecode import unidecode
from collections import defaultdict
from django.core.management.base import BaseCommand
from bibliodata.models import Author, Publication


def normalize_name(name):
    return unidecode(name.lower().replace(",", "").strip())


class Command(BaseCommand):
    help = "Generate co-authorship network between IPs of the IPBLN"

    def handle(self, *args, **options):
        path_csv = "analysis/data/networks/Labos_IPs_IPBLN.csv"
        output_nodes = "analysis/data/networks/lab_nodes.csv"
        output_edges = "analysis/data/networks/lab_edges.csv"

        lab_ip_dict = {}

        # === Leer CSV y construir dict IP -> Lab ===
        with open(path_csv, encoding="utf-8") as f:
            reader = csv.reader(f, delimiter=";", quotechar='"')
            next(reader)
            for row in reader:
                lab = row[0].strip()
                ips = [ip.strip() for ip in row[1].split("|")]
                for ip in ips:
                    lab_ip_dict[ip] = lab

        # === Mapeo nombre normalizado -> Author ===
        author_map = {a.name: a for a in Author.objects.all()}

        # === Filtrar IPs válidos que están en la base de datos ===
        valid_ips = {}
        for raw_name, lab in lab_ip_dict.items():
            normalized = raw_name
            author = author_map.get(normalized)
            if author:
                valid_ips[author] = lab
            else:
                self.stdout.write(self.style.WARNING(f"❌ IP no encontrado en BD: {raw_name}"))

        # === Crear grafo ===
        G = nx.Graph()

        # Añadir nodos
        for author, lab in valid_ips.items():
            G.add_node(author.name, lab=lab)

        # === Contar coautorías entre pares de IPs ===
        edge_weights = defaultdict(int)

        # Recorremos todas las publicaciones
        for pub in Publication.objects.prefetch_related("authors").all():
            pub_authors = set(pub.authors.all())
            pub_ips = [a for a in pub_authors if a in valid_ips]

            # Añadir aristas entre pares de IPs en esta publicación
            for i in range(len(pub_ips)):
                for j in range(i + 1, len(pub_ips)):
                    a1 = pub_ips[i].name
                    a2 = pub_ips[j].name
                    edge = tuple(sorted((a1, a2)))
                    edge_weights[edge] += 1

        # Añadir aristas al grafo
        for (a1, a2), weight in edge_weights.items():
            G.add_edge(a1, a2, weight=weight)

        # === Exportar nodos ===
        with open(output_nodes, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Id", "Label", "Lab"])
            for node, data in G.nodes(data=True):
                writer.writerow([node, node, data["lab"]])

        # === Exportar aristas ===
        with open(output_edges, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Source", "Target", "Type", "Weight"])
            for u, v, data in G.edges(data=True):
                writer.writerow([u, v, "Undirected", data["weight"]])

        self.stdout.write(self.style.SUCCESS("✅ Red de coautorías IPBLN exportada para Gephi."))