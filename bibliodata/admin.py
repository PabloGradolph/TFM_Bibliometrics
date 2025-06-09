from django.contrib import admin
from .models import Publication, Author, Collaboration, Institution, InstitutionMetric, ThematicArea, ThematicCluster, ReportTemplate, PublicationMetric

@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Publication model.

    Features:
        - Displays title, year, type, source and open access status in the list view.
        - Enables search by title and DOI.
        - Adds filters by year, publication type, and open access status.
    """
    list_display = ("title", "year", "publication_type", "source")
    search_fields = ("title", "doi")
    list_filter = ("year", "publication_type")


@admin.register(PublicationMetric)
class PublicationMetricAdmin(admin.ModelAdmin):
    """
    Admin configuration for the PublicationMetric model.

    Features:
        - list_display: Shows publication, source, year, and key indicators in the list view.
        - search_fields: Enables search by publication title.
        - list_filter: Allows filtering by metric source and year of the metric.
    """
    list_display = ("publication", "source", "year", "impact_factor", "quartile", "percentile", "position")
    list_filter = ("source", "year")
    search_fields = ("publication__title",)


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Author model.

    Features:
        - Displays name, ORCID, total publications and h-index.
        - Enables search by name, ORCID, Researcher ID and Scopus ID.
        - Adds a filter by h-index.
    """
    list_display = ("name", "orcid", "total_publications", "h_index")
    search_fields = ("name", "orcid", "researcher_id", "scopus_id")
    list_filter = ("h_index",)


@admin.register(Collaboration)
class CollaborationAdmin(admin.ModelAdmin):
    list_display = ("author", "collaborator", "publication_count")
    search_fields = ("author", "collaborator", "publication_count")


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Institution model.

    Features:
        - Displays name, main area, region, province and international collaboration index.
        - Enables search by name, main area and province.
        - Adds filters by region and main area.
    """
    list_display = ("name", "main_area", "region", "province", "international_collab_index")
    search_fields = ("name", "main_area", "province")
    list_filter = ("region", "main_area")


@admin.register(InstitutionMetric)
class InstitutionMetricAdmin(admin.ModelAdmin):
    """
    Admin configuration for institution-level bibliometric indicators.

    Features:
        - Displays institution name, source, year, publications, citations and h-index.
        - Enables filtering by source and year.
        - Allows searching metrics by institution name.
    """
    list_display = ("institution", "source", "year", "num_pubs_own", "citations_wos", "citations_scopus", "h_index_wos", "h_index_scopus")
    list_filter = ("source", "year")
    search_fields = ("institution__name",)


@admin.register(ThematicArea)
class ThematicAreaAdmin(admin.ModelAdmin):
    """
    Admin configuration for Thematic Areas.

    Features:
        - Displays the name of the area.
        - Enables search by name.
    """
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(ThematicCluster)
class ThematicClusterAdmin(admin.ModelAdmin):
    """
    Admin configuration for publication clusters.

    Features:
        - Displays name and description of each cluster.
        - Enables search by cluster name and description.
        - Allows editing the many-to-many relation with publications using horizontal filter.
    """
    list_display = ("name", "description")
    search_fields = ("name", "description")
    filter_horizontal = ("publications",)


@admin.register(ReportTemplate)
class ReportTemplateAdmin(admin.ModelAdmin):
    """
    Admin configuration for the ReportTemplate model.

    Features:
        - list_display: Shows key fields in the list view (name, entity type, output format, rendering engine, active status).
        - search_fields: Allows text-based search on name and description.
        - list_filter: Adds sidebar filters to narrow down templates by type, engine or availability.
    """
    list_display = ("name", "entity_type", "file_type", "engine", "is_active")
    search_fields = ("name", "description")
    list_filter = ("entity_type", "file_type", "engine", "is_active")
