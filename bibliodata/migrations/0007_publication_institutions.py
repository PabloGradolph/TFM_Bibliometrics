# Generated by Django 5.2 on 2025-05-26 10:26

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bibliodata', '0006_publication_other_authors_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='publication',
            name='institutions',
            field=models.ManyToManyField(blank=True, related_name='publications', to='bibliodata.institution'),
        ),
    ]
