from django.core.management.base import BaseCommand
from django.db import transaction
from bibliodata.models import Author  # Cambia esto según tu modelo
import json

class Command(BaseCommand):
    help = "Asigna departamentos a autores en función de su alias"

    def handle(self, *args, **kwargs):
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

        def normalize(s):
            return s.lower().strip()

        updated = 0
        assigned_names = set()

        with transaction.atomic():
            for department, names in departments.items():
                normalized_names = set(map(normalize, names))

                for author in Author.objects.all():
                    try:
                        aliases = author.aliases
                        if isinstance(aliases, str):
                            aliases = json.loads(aliases)
                        if not isinstance(aliases, list):
                            continue
                    except Exception:
                        continue

                    for alias in aliases:
                        if normalize(alias) in normalized_names:
                            author.department = department
                            author.save()
                            assigned_names.add(normalize(alias))
                            updated += 1
                            self.stdout.write(self.style.SUCCESS(
                                f"{author.name} asignado a {department}"))
                            break  # ya asignado, salimos

        # Mostrar los que no se pudieron asignar
        self.stdout.write(self.style.NOTICE(f"\nTotal autores actualizados: {updated}"))

        # Comparar contra todos los nombres declarados
        not_assigned = []
        for department, names in departments.items():
            for name in names:
                if normalize(name) not in assigned_names:
                    not_assigned.append((name, department))

        if not_assigned:
            self.stdout.write(self.style.WARNING("\nAutores NO asignados:"))
            for name, dept in not_assigned:
                self.stdout.write(f" - {name} ({dept})")
        else:
            self.stdout.write(self.style.SUCCESS("\n✅ Todos los autores de la lista fueron asignados correctamente."))
