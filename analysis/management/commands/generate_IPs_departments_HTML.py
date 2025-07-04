from django.core.management.base import BaseCommand
import pandas as pd
import networkx as nx
from pyvis.network import Network
import os

class Command(BaseCommand):
    help = 'Genera un HTML interactivo de la red de coautoría agrupada por departamentos.'

    def handle(self, *args, **options):
        # Mapeo de departamentos a autores (copiado de load_departments_db.py)
        departments = {
            "Biología Celular e Inmunología": [
                "Acosta Herrera, Marialbert", "Alcina, Antonio", "Delgado Mora, Mario",
                "González Rey, Elena", "Hernández López de Munaín, Cristina", "Macías Sánchez, Elena",
                "Márquez Ortiz, Ana María", "Martín Ibáñez, Javier", "Matesanz del Barrio, Fuencisla",
                "Oliver Pozo, Francisco Javier", "Ortiz Fernández, Lourdes", "Sancho López, Jaime", "Zubiaur, Mercedes"
            ],
            "Biología Molecular": [
                "Berzal Herranz, Alfredo", "Daza Martín, Manuel", "Gómez Castilla, Jordi", "López Giménez, Juan F.",
                "López López, Manuel Carlos", "Navarro Carretero, Miguel", "Sánchez Luque, Francisco José",
                "Suñé, Carlos", "Thomas, María del Carmen"
            ],
            "Bioquímica y Farmacología Molecular": [
                "Castanys, Santiago", "Estévez García, Antonio Manuel", "Gómez Díaz, Elena",
                "González Pacanowska, Dolores", "Morales Sánchez, Juan Carlos",
                "Pérez Victoria, José María", "Ruiz Pérez, Luis Miguel",
                "Sánchez Navarro, Macarena", "Vidal Romero, Antonio"
            ]
        }
        # Invertir el mapeo: autor -> departamento
        author_to_dept = {}
        for dept, names in departments.items():
            for name in names:
                author_to_dept[name.strip()] = dept

        # Leer nodos y aristas
        nodes_path = os.path.join('analysis', 'data', 'networks', 'lab_nodes.csv')
        edges_path = os.path.join('analysis', 'data', 'networks', 'lab_edges.csv')
        nodes_df = pd.read_csv(nodes_path)
        edges_df = pd.read_csv(edges_path)

        # Construir grafo
        G = nx.Graph()
        for _, row in nodes_df.iterrows():
            G.add_node(row["Id"], label=row["Label"], lab=row["Lab"])
        for _, row in edges_df.iterrows():
            G.add_edge(row["Source"], row["Target"], weight=row["Weight"])

        # Crear red PyVis
        net = Network(height='700px', width='100%', notebook=False, directed=False)
        net.barnes_hut()
        net.set_options("""
        {
          "nodes": {
            "font": {"size": 16, "face": "Tahoma"},
            "shape": "dot"
          },
          "edges": {
            "color": {"inherit": true},
            "smooth": false
          },
          "interaction": {"hover": true, "tooltipDelay": 200},
          "physics": {
            "barnesHut": {
              "gravitationalConstant": -12000,
              "springLength": 250,
              "springConstant": 0.02,
              "damping": 0.6
            },
            "minVelocity": 0.75,
            "stabilization": {"iterations": 250}
          }
        }
        """)

        # Añadir nodos con grupo=departamento
        for node in G.nodes():
            label = G.nodes[node].get('label', node)
            dept = author_to_dept.get(label, 'Sin departamento')
            net.add_node(
                node,
                label=label,
                title=f"{label} ({dept})",
                group=dept,
                size=20
            )

        # Añadir aristas
        for u, v, data in G.edges(data=True):
            net.add_edge(u, v, value=data.get('weight', 1))

        # Exportar HTML
        out_dir = os.path.join('analysis', 'best_IPs_agrupations', 'departaments')
        os.makedirs(out_dir, exist_ok=True)
        file_path = os.path.join(out_dir, 'departments_comunidades.html')
        net.write_html(file_path)

        # Inyectar título
        with open(file_path, "r", encoding="utf-8") as f:
            html = f.read()
        titulo_html = "<h2 style='text-align:center; font-family:Tahoma;'>Red de Coautorías por Departamento</h2>\n"
        html = html.replace("<body>", f"<body>\n{titulo_html}")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html)

        self.stdout.write(self.style.SUCCESS(f"✅ HTML generado en {file_path}"))
