# Generated by Django 5.2 on 2025-05-27 07:44

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bibliodata', '0007_publication_institutions'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='publication',
            name='other_institutions',
        ),
        migrations.AddField(
            model_name='publication',
            name='ccaas',
            field=models.JSONField(blank=True, null=True, verbose_name='CCAA (Spanish Autonomous Communities)'),
        ),
        migrations.AlterField(
            model_name='publication',
            name='affiliations',
            field=models.JSONField(blank=True, null=True, verbose_name='Full affiliation strings'),
        ),
    ]
