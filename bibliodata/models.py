from django.db import models

class Publication(models.Model):
    """
    Represents a scientific publication registered in the GESBIB database.

    Fields:
        - gb_id: Internal identifier from GESBIB (unique).
        - title: Title of the publication.
        - doi: Digital Object Identifier (optional).
        - year: Year of publication.
        - publication_date: Exact date of publication (optional).
        - publication_type: Normalized type (e.g., article, conference paper...).
        - source: Name of the journal or conference (optional).
        - wos_id / scopus_id / indices_id / digital_csic_id / conciencia_id: External database IDs (optional).
        - open_access: Boolean indicating if the publication is open access.
        - is_csic: Boolean flag if the publication is CSIC-related.
        - thematic_areas: Many-to-many relation with ThematicArea.
    """
    gb_id = models.CharField("GESBIB ID", max_length=50, unique=True)
    title = models.TextField("Title")
    doi = models.CharField("DOI", max_length=100, blank=True, null=True)
    year = models.IntegerField("Year")
    publication_date = models.DateField("Publication date", blank=True, null=True)
    publication_type = models.CharField("Normalized type", max_length=100)
    source = models.CharField("Source", max_length=255, blank=True, null=True)
    
    wos_id = models.CharField("Web of Science ID", max_length=50, blank=True, null=True)
    scopus_id = models.CharField("Scopus ID", max_length=50, blank=True, null=True)
    indices_id = models.CharField("ÍnDICEs ID", max_length=50, blank=True, null=True)
    digital_csic_id = models.CharField("Digital.CSIC ID", max_length=50, blank=True, null=True)
    conciencia_id = models.CharField("Conciencia ID", max_length=50, blank=True, null=True)

    open_access = models.BooleanField("Open access", default=False)
    is_csic = models.BooleanField("CSIC Publication?", default=True)

    thematic_areas = models.ManyToManyField("ThematicArea", related_name="publications")


    def __str__(self):
        return f"{self.title[:80]}..."
    

class PublicationMetric(models.Model):
    """
    Stores bibliometric indicators for a publication, optionally by year and source.

    Fields:
        - publication: Related Publication object.
        - source: Metric source (e.g., JCR, SJR, CiteScore, JCI, Dimensions).
        - year: Year of the metric (if available).
        - impact_factor: Raw impact factor (e.g., JCR IF, SJR IF).
        - quartile: Quartile label (e.g., Q1, Q2...).
        - quartile_value: Numeric quartile (1, 2, 3, 4).
        - percentile: Percentile value in the source.
        - position: Rank position in source category.
        - influence_score: Other index (e.g., Article Influence Score, Dimensions RCR/FCR).
    """

    SOURCE_CHOICES = [
        ("jcr", "JCR"),
        ("sjr", "SJR"),
        ("citescore", "CiteScore"),
        ("jci", "JCI"),
        ("dimensions", "Dimensions"),
    ]

    publication = models.ForeignKey("Publication", on_delete=models.CASCADE, related_name="metrics")
    source = models.CharField("Metric source", max_length=50, choices=SOURCE_CHOICES)
    year = models.IntegerField("Metric year", blank=True, null=True)

    impact_factor = models.FloatField("Impact factor", blank=True, null=True)
    quartile = models.CharField("Quartile (e.g., Q1)", max_length=10, blank=True, null=True)
    quartile_value = models.IntegerField("Quartile (numeric)", blank=True, null=True)
    percentile = models.FloatField("Percentile", blank=True, null=True)
    position = models.IntegerField("Position", blank=True, null=True)
    influence_score = models.FloatField("Influence score", blank=True, null=True)

    class Meta:
        unique_together = ("publication", "source", "year")
        ordering = ["publication", "source", "year"]

    def __str__(self):
        return f"{self.publication.title[:50]} - {self.source.upper()} {self.year or ''}".strip()
    

class PublicationDuplication(models.Model):
    """
    Registers duplication or metadata validation information for publications.

    Fields:
        - publication: Related publication.
        - is_duplicated: Boolean flag for duplicated entries.
        - remarks: Optional notes or reasons.
    """
    publication = models.OneToOneField("Publication", on_delete=models.CASCADE, related_name="duplication_info")
    is_duplicated = models.BooleanField("Duplicated?", default=False)
    is_csic = models.BooleanField("CSIC Publication?", default=True)
    remarks = models.TextField("Remarks", blank=True, null=True)

    def __str__(self):
        return f"{self.publication.title[:50]} - Duplicated: {self.is_duplicated}"
    
    
class Author(models.Model):
    """
    Represents a researcher involved in scientific publications.

    Fields:
        - name: Normalized full name.
        - Identifiers (ORCID, CSIC ID, Researcher ID, Scopus ID, etc.): Links to academic profiles.
        - Metrics: Total publications, citations, average citations, h-index.
        - publications: Related publications through the Authorship model.
    """
    gesbib_id = models.CharField("GESBIB Author ID", primary_key=True, max_length=50, blank=True, null=False)
    csic_id = models.CharField("CSIC ID", max_length=50, blank=True, null=True)

    name = models.CharField("Name", max_length=255)
    name_link = models.URLField("Name link", blank=True, null=True)
    signature = models.CharField("CSIC Signature", max_length=255, blank=True, null=True)  # firmaDigitalCsic
    aliases = models.JSONField("Known aliases", blank=True, null=True)  # firmas[]

    orcid = models.CharField("ORCID", max_length=50, blank=True, null=True)
    orcid_link = models.URLField("ORCID link", blank=True, null=True)
    researcher_id = models.CharField("Researcher ID (WoS)", max_length=50, blank=True, null=True)
    researcher_ids = models.JSONField("All Researcher IDs (WoS)", blank=True, null=True)
    researcher_id_link = models.URLField("Researcher ID link", blank=True, null=True)
    scopus_id = models.CharField("Scopus ID", max_length=50, blank=True, null=True)
    scopus_ids = models.JSONField("All Scopus IDs", blank=True, null=True)
    scopus_id_link = models.URLField("Scopus ID link", blank=True, null=True)
    openalex_id = models.CharField("OpenAlex ID", max_length=100, blank=True, null=True)
    openalex_id_link = models.URLField("OpenAlex ID link", blank=True, null=True)
    google_scholar = models.CharField("Google Scholar ID", max_length=100, blank=True, null=True)
    google_scholar_link = models.URLField("Google Scholar link", blank=True, null=True)

    # Uncomment if you want to use these fields: They are not used in the IPBLN authors
    # academia_edu = models.URLField("Academia.edu", blank=True, null=True)
    # research_gate = models.URLField("ResearchGate", blank=True, null=True)
    
    digital_csic = models.URLField("Digital.CSIC", blank=True, null=True)
    fecyt_cvn = models.URLField("FECYT CVN", blank=True, null=True)

    total_publications = models.IntegerField("Total publications", blank=True, null=True)
    total_citations = models.IntegerField("Total citations", blank=True, null=True)
    citations_wos = models.IntegerField("Citations (WoS)", blank=True, null=True)
    citations_scopus = models.IntegerField("Citations (Scopus)", blank=True, null=True)

    h_index = models.CharField("H-index (WoS/Scopus)", max_length=10, blank=True, null=True)
    h_index_gb = models.IntegerField("H-index GESBIB", blank=True, null=True)
    h_index_h5gb = models.IntegerField("H5-index GESBIB", blank=True, null=True)
    international_index = models.FloatField("International collaboration index", blank=True, null=True)

    gender_estimate = models.IntegerField("Estimated gender", blank=True, null=True)

    institutions_raw = models.TextField("Raw institution string (CSV)", blank=True, null=True)
    institutions_last = models.ForeignKey("Institution", on_delete=models.SET_NULL, null=True, blank=True, related_name="authors_last_affiliated", verbose_name="Last affiliated institution")
    institutions_work = models.JSONField("Institutions linked by work", blank=True, null=True)
    institutions_published = models.JSONField("Institutions with publications", blank=True, null=True)

    materias_jcr = models.JSONField("JCR Subjects", blank=True, null=True)
    materias_cs = models.JSONField("CS Subjects", blank=True, null=True)
    keywords = models.JSONField("Keywords", blank=True, null=True)

    country_id = models.CharField("Country ID", max_length=50, blank=True, null=True)

    publications = models.ManyToManyField("Publication", related_name="authors")

    def __str__(self):
        return self.name


class Institution(models.Model):
    """
    Represents a CSIC research center or institute.

    Fields:
        - name: Full official name of the institution.
        - main_area: Main thematic area or discipline.
        - region / province: Geographical data.
        - international_collab_index: Indicator of international collaboration.
        - thematic_areas: Many-to-many relation with ThematicArea.
    """
    gesbib_id = models.IntegerField("GesBIB ID")
    name = models.CharField("Institution name", max_length=255, unique=True)
    link = models.URLField("GesBIB link", max_length=255, blank=True)

    international_collab_index = models.FloatField("International collaboration index", blank=True, null=True)

    # Puedes mantener estos si luego los usarás
    main_area = models.CharField("Main thematic area", max_length=255, blank=True)
    region = models.CharField("Region (CCAA)", max_length=100, blank=True)
    province = models.CharField("Province", max_length=100, blank=True)

    thematic_areas = models.ManyToManyField("ThematicArea", related_name="institutions", blank=True)

    def __str__(self):
        return self.name


class InstitutionMetric(models.Model):
    """
    Stores bibliometric indicators per institution, year, and source.

    Fields:
        - institution: ForeignKey to Institution.
        - source: Origin of the data (e.g., WOS, Scopus, GESTBIB).
        - year: Year of the metric.
        - num_publications: Total publications in that year and source.
        - total_citations: Total citations received.
        - h_index: H-index for the institution that year.
    
    Meta:
        - unique_together: Prevents duplicate metrics for same institution/year/source.
        - ordering: Sorts metrics chronologically.
    """
    institution = models.ForeignKey("Institution", on_delete=models.CASCADE, related_name="metrics")
    source = models.CharField("Metric source", max_length=50)  # e.g. 'GESTBIB'
    year = models.IntegerField("Year")

    # Publicaciones
    num_pubs_own = models.IntegerField("Own publications", null=True, blank=True)
    num_pubs_own_children = models.IntegerField("Own + children", null=True, blank=True)
    num_pubs_wos = models.IntegerField("WoS publications (own + children)", null=True, blank=True)
    num_pubs_scopus = models.IntegerField("Scopus publications (own + children)", null=True, blank=True)

    # Citas
    citations_wos = models.IntegerField(null=True, blank=True)
    citations_scopus = models.IntegerField(null=True, blank=True)

    # Índice H
    h_index_wos = models.IntegerField(null=True, blank=True)
    h_index_scopus = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ("institution", "source", "year")
        ordering = ["institution", "source", "year"]
    

class ThematicArea(models.Model):
    """
    Represents a thematic or disciplinary area (e.g., Biology, Physics...).

    Fields:
        - name: Unique name of the area.

    Usage:
        - Used to classify publications and institutions by domain.
    """
    name = models.CharField("Thematic area", max_length=255, unique=True)

    def __str__(self):
        return self.name



class Keyword(models.Model):
    """
    Represents a keyword extracted through NLP techniques.

    Fields:
        - word: The keyword itself.
        - publications: Publications where the keyword was detected.

    Usage:
        - Useful for generating word clouds and thematic exploration.
    """
    word = models.CharField("Keyword", max_length=100, unique=True)
    publications = models.ManyToManyField("Publication", related_name="keywords")

    def __str__(self):
        return self.word
    

class ThematicCluster(models.Model):
    """
    Represents a cluster of thematically related publications.

    Fields:
        - name: Cluster name or label.
        - description: Optional explanation or summary of the cluster.
        - publications: Many-to-many relationship with publications.

    Usage:
        - Generated through clustering algorithms like LDA, KMeans, etc.
        - Supports visualization and thematic analysis.
    """
    name = models.CharField("Cluster name", max_length=100)
    description = models.TextField("Description", blank=True, null=True)
    publications = models.ManyToManyField("Publication", related_name="clusters")

    def __str__(self):
        return self.name


class ReportTemplate(models.Model):
    """
    Stores templates for automatic report generation.

    Fields:
        - name: Template name or title (e.g., "Institution Summary", "Author Trends").
        - description: Explanation of what the report shows.
        - entity_type: Type of entity the report is for ("author", "institution", "area", etc.).
        - file_type: Output format ("HTML", "PDF", "CSV").
        - engine: Report engine ("quarto", "rmarkdown", "custom").
        - template_path: Path to the template file or script (on server or repo).
        - is_active: Whether the template is available for use.
    """

    ENTITY_CHOICES = [
        ("author", "Author"),
        ("institution", "Institution"),
        ("area", "Thematic Area"),
        ("custom", "Custom"),
    ]

    FILE_TYPE_CHOICES = [
        ("html", "HTML"),
        ("pdf", "PDF"),
        ("csv", "CSV"),
    ]

    ENGINE_CHOICES = [
        ("quarto", "Quarto"),
        ("rmarkdown", "RMarkdown"),
        ("python", "Python script"),
    ]

    name = models.CharField("Template name", max_length=150)
    description = models.TextField("Description", blank=True)
    entity_type = models.CharField("Entity type", max_length=50, choices=ENTITY_CHOICES)
    file_type = models.CharField("Output format", max_length=10, choices=FILE_TYPE_CHOICES)
    engine = models.CharField("Rendering engine", max_length=20, choices=ENGINE_CHOICES)
    template_path = models.CharField("Template file path", max_length=300)
    is_active = models.BooleanField("Available for use", default=True)

    def __str__(self):
        return self.name
