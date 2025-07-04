from django.core.management.base import BaseCommand
from bibliodata.models import Author, Collaboration

import networkx as nx
from pyvis.network import Network
import os
import time
import unicodedata


class Command(BaseCommand):
    help = "Genera un archivo HTML con la red de colaboración para cada autor."

    def handle(self, *args, **options):
        output_dir = "media/networks_html"
        os.makedirs(output_dir, exist_ok=True)

        authors = Author.objects.all()
        total = authors.count()
        processed = 0

        for author in authors:
            time.sleep(1)
            processed += 1
            self.stdout.write(f"Procesando autor: {author.name} ({processed}/{total})")

            author_id = str(author.gesbib_id)
            G = nx.Graph()
            G.add_node(author_id, label=author.name, is_main=True)

            # Obtener todas las colaboraciones del autor
            collaborations = Collaboration.objects.filter(author=author) | Collaboration.objects.filter(collaborator=author)

            for c in collaborations:
                if c.author == author:
                    collaborator = c.collaborator
                else:
                    collaborator = c.author

                collaborator_id = str(collaborator.gesbib_id)

                if not G.has_node(collaborator_id):
                    G.add_node(collaborator_id, label=collaborator.name, is_main=False)

                G.add_edge(author_id, collaborator_id, weight=c.publication_count)

            # Crear red interactiva con PyVis
            net = Network(height='700px', width='100%', directed=False)
            net.barnes_hut()
            net.set_options("""
            {
              "nodes": {
                "font": { "size": 16, "face": "Tahoma" },
                "shape": "dot"
              },
              "edges": {
                "color": { "inherit": true },
                "smooth": false
              },
              "interaction": {
                "hover": true,
                "tooltipDelay": 200
              },
              "physics": {
                "barnesHut": {
                  "gravitationalConstant": -12000,
                  "springLength": 250,
                  "springConstant": 0.02,
                  "damping": 0.6
                },
                "minVelocity": 0.75,
                "stabilization": { "iterations": 250 }
              }
            }
            """)

            for node, data in G.nodes(data=True):
                net.add_node(
                    node,
                    label=data['label'],
                    color='#b3003c' if data['is_main'] else '#a9a9a9',
                    size=22 if data['is_main'] else 16
                )

            for u, v, data in G.edges(data=True):
                net.add_edge(
                    u, v,
                    value=data.get('weight', 1),
                    color="#3b8bff"
                )

            def slugify_filename(name):
                # Quitar acentos/tildes y dejar solo ASCII
                name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
                # Quitar espacios, comas, puntos, barras, etc.
                name = name.replace(" ", "_").replace(",", "").replace(".", "").replace("/", "_")
                return name

            file_safe_name = slugify_filename(author.name)
            file_path = os.path.join(output_dir, f"collab_{file_safe_name}.html")
            net.write_html(file_path)

            # Añadir título al HTML generado
            with open(file_path, "r", encoding="utf-8") as f:
                html = f.read()
            titulo_html = f"<h2 style='text-align:center; font-family:Tahoma;'>Colaboraciones de {author.name}</h2>\n"
            html = html.replace("<body>", f"<body>\n{titulo_html}")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(html)

        self.stdout.write(self.style.SUCCESS(f"\n✅ Red de colaboración generada para {total} autores en '{output_dir}/'"))
