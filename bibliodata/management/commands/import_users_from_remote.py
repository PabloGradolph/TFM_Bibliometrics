from django.core.management.base import BaseCommand
from django.conf import settings
from django.apps import apps
from django.db import transaction

class Command(BaseCommand):
    help = "Copy users from DATABASES['remote'] into default (upsert by email)."

    def handle(self, *args, **kwargs):
        User = apps.get_model(settings.AUTH_USER_MODEL)

        # Leemos usuarios desde la BDD remota usando el ORM (evita SQL crudo y nombres de tabla)
        remote_qs = User.objects.using("remote").all().only(
            "email", "password", "last_login", "is_superuser",
            "is_staff", "is_active", "date_joined",
        )

        created, updated = 0, 0

        with transaction.atomic(using="default"):
            for ru in remote_qs.iterator():
                # UPsert por email (USERNAME_FIELD='email' en tu CustomUser)
                obj, is_created = User.objects.update_or_create(
                    email=User.objects.model._default_manager.normalize_email(ru.email),
                    defaults={
                        "password": ru.password,          # hash intacto
                        "last_login": ru.last_login,
                        "is_superuser": ru.is_superuser,
                        "is_staff": ru.is_staff,
                        "is_active": ru.is_active,
                        "date_joined": ru.date_joined,
                    },
                )
                if is_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Imported users from remote → default. Created: {created}, Updated: {updated}."
        ))