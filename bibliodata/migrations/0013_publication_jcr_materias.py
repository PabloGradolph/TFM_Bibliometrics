# Generated by Django 5.2 on 2025-06-02 06:55

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bibliodata', '0012_alter_publication_international_collab'),
    ]

    operations = [
        migrations.AddField(
            model_name='publication',
            name='jcr_materias',
            field=models.JSONField(blank=True, null=True, verbose_name='JCR materias'),
        ),
    ]
