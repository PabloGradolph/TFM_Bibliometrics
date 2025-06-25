import csv
from django.core.management.base import BaseCommand
from bibliodata.models import Publication, ThematicArea
from django.db import transaction

class Command(BaseCommand):
    help = 'Carga las áreas temáticas predichas por IA en el campo predicted_thematic_areas de Publication.'

    def add_arguments(self, parser):
        parser.add_argument('--csv', type=str, default='analysis/ThematicAreasClassifier/predictions_with_probabilities.csv', help='Ruta al archivo CSV de predicciones')
        parser.add_argument('--id-col', type=str, default='gb_id', help='Nombre de la columna identificadora de la publicación')
        parser.add_argument('--label-col', type=str, default='predicted_labels', help='Nombre de la columna con las áreas temáticas predichas')

    @transaction.atomic
    def handle(self, *args, **options):
        csv_path = options['csv']
        id_col = options['id_col']
        label_col = options['label_col']
        count_updated = 0
        count_not_found = 0
        with open(csv_path, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                pub_id = row.get(id_col)
                labels = row.get(label_col)
                if not pub_id or not labels:
                    continue
                # Asumimos que las etiquetas están separadas por ; o ,
                areas = [l.strip() for l in labels.replace(';', ',').split(',') if l.strip()]
                try:
                    pub = Publication.objects.get(gb_id=pub_id)
                except Publication.DoesNotExist:
                    self.stdout.write(self.style.WARNING(f'No se encontró publicación con gb_id={pub_id}'))
                    count_not_found += 1
                    continue
                # Limpiamos las áreas previas predichas
                pub.predicted_thematic_areas.clear()
                for area in areas:
                    area_obj, _ = ThematicArea.objects.get_or_create(name=area)
                    pub.predicted_thematic_areas.add(area_obj)
                pub.save()
                count_updated += 1
        self.stdout.write(self.style.SUCCESS(f'Publicaciones actualizadas: {count_updated}'))
        if count_not_found:
            self.stdout.write(self.style.WARNING(f'Publicaciones no encontradas: {count_not_found}')) 