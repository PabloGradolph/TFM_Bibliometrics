# management/commands/load_author_clusterings.py

import csv
from collections import defaultdict
from django.core.management.base import BaseCommand
from bibliodata.models import Author, AuthorClustering

class Command(BaseCommand):
    help = 'Carga resultados de clustering de autores desde CSVs exportados'

    def add_arguments(self, parser):
        parser.add_argument('--file', required=True, help='Ruta al archivo CSV')
        parser.add_argument('--model', required=True, help='Nombre del modelo de clustering (ej: kmeans, dbscan, hdbscan...)')

    def handle(self, *args, **options):
        filepath = options['file']
        model_name = options['model'].lower()
        created, skipped = 0, 0

        # Leemos todo el archivo una vez si es DBSCAN para calcular n_clusters
        if model_name == "dbscan":
            with open(filepath, encoding='utf-8') as f:
                reader = list(csv.DictReader(f))
                clusters_by_group = defaultdict(set)

                for row in reader:
                    key = (row['eps'], row['pca_dims'])
                    cluster = int(row['cluster'])
                    if cluster != -1:  # Ignorar ruido
                        clusters_by_group[key].add(cluster)

        with open(filepath, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    author = Author.objects.get(name=row['author'])

                    cluster = int(row['cluster'])
                    pca_dims = int(row.get('pca_dims') or 0)

                    # Obtener k dinámicamente según el modelo
                    if model_name == "dbscan":
                        key = (row['eps'], row['pca_dims'])
                        k = len(clusters_by_group[key])
                    elif model_name == "hdbscan":
                        k = int(row.get('n_clusters') or 0)
                    else:
                        k = int(row.get('k') or 0)

                    # Crear o actualizar clustering
                    obj, created_flag = AuthorClustering.objects.update_or_create(
                        author=author,
                        model_name=model_name,
                        k=k,
                        pca_dims=pca_dims,
                        defaults={
                            'cluster': cluster,
                            'silhouette': float(row.get('silhouette') or 0),
                            'calinski_harabasz': float(row.get('calinski_harabasz') or 0),
                            'davies_bouldin': float(row.get('davies_bouldin') or 0),
                        }
                    )
                    if created_flag:
                        created += 1
                    else:
                        skipped += 1

                except Author.DoesNotExist:
                    self.stdout.write(self.style.WARNING(f"❌ Autor no encontrado: {row['author']}"))

        self.stdout.write(self.style.SUCCESS(f"✅ {created} agrupamientos creados, {skipped} actualizados o existentes."))