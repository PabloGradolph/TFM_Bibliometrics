"""
Django management command to build and save a HNSWlib index from publication embeddings.
Prioritizes embeddings generated with weighted title and areas.
"""
import json
import numpy as np
import hnswlib
from django.core.management.base import BaseCommand
from bibliodata.models import PublicationEmbedding

class Command(BaseCommand):
    help = "Build HNSWlib index from PublicationEmbedding and save to disk."

    def add_arguments(self, parser):
        parser.add_argument('--output', type=str, default='analysis/data/hnsw_index.bin', help='Path to save the HNSW index file.')
        parser.add_argument('--space', type=str, default='cosine', help='Metric space: cosine or l2.')
        parser.add_argument('--ef_construction', type=int, default=200, help='ef_construction parameter for HNSWlib.')
        parser.add_argument('--M', type=int, default=32, help='M parameter for HNSWlib.')

    def handle(self, *args, **options):
        output_path = options['output']
        space = options['space']
        ef_construction = options['ef_construction']
        M = options['M']

        self.stdout.write(self.style.SUCCESS(f"Loading embeddings from DB..."))
        qs = PublicationEmbedding.objects.all()
        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.ERROR("No embeddings found. Run generate_publication_embeddings first."))
            return

        embeddings = []
        ids = []
        for obj in qs:
            emb = json.loads(obj.embedding)
            embeddings.append(emb)
            ids.append(obj.publication_id)
        embeddings = np.array(embeddings, dtype=np.float32)
        ids = np.array(ids, dtype=np.int64)
        dim = embeddings.shape[1]
        self.stdout.write(f"Loaded {total} embeddings. Dimension: {dim}")

        self.stdout.write(self.style.SUCCESS(f"Building HNSWlib index (space={space}, ef_construction={ef_construction}, M={M})..."))
        p = hnswlib.Index(space=space, dim=dim)
        p.init_index(max_elements=total, ef_construction=ef_construction, M=M)
        p.add_items(embeddings, ids)
        p.set_ef(100)
        p.save_index(output_path)
        self.stdout.write(self.style.SUCCESS(f"Index saved to {output_path}"))
