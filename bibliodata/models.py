from django.db import models

class Publication(models.Model):
    gb_id = models.CharField("GESBIB ID", max_length=50, unique=True)
    title = models.TextField("Title")
    title_link = models.URLField("Link to title", blank=True, null=True)
    doi = models.JSONField("DOI(s)", blank=True, null=True)
    year = models.IntegerField("Year")
    publication_date = models.CharField("Publication date (yyyy-mm-dd)", max_length=20, blank=True, null=True)
    publication_type = models.JSONField("Normalized type(s)", blank=True,  null=True)
    source = models.CharField("Source", max_length=255, blank=True, null=True)
    source_link = models.URLField("Source link", blank=True, null=True)
    source_id = models.CharField("Source ID", max_length=100, blank=True, null=True)
    editorial = models.CharField("Editorial", max_length=255, blank=True, null=True)
    editorial_link = models.URLField("Editorial link", blank=True, null=True)
    
    aa_link = models.URLField("External PDF link (AA)", blank=True, null=True)
    extra_sources = models.JSONField("Sources (WOS, SCOPUS...)", blank=True, null=True)
    extra_links = models.JSONField("Extra source links", blank=True, null=True)

    citations = models.IntegerField("Citations", blank=True, null=True)
    international_collab = models.FloatField("International collaboration", blank=True, null=True)

    language = models.CharField("Language", max_length=20, blank=True, null=True)
    abstract = models.TextField("Abstract", blank=True, null=True)

    isbn = models.JSONField("ISBNs (for books)", blank=True, null=True)
    issns = models.JSONField("ISSNs", blank=True, null=True)

    conference_name = models.JSONField("Conference name(s)", blank=True, null=True)
    conference_location = models.JSONField("Conference location(s)", blank=True, null=True)
    conference_date = models.JSONField("Conference date(s)", blank=True, null=True)

    keywords_all = models.JSONField("All keywords", blank=True, null=True)
    num_countries = models.IntegerField("Number of countries", blank=True, null=True)
    num_spanish_affils = models.IntegerField("Number of Spanish affiliations", blank=True, null=True)
    num_foreign_affils = models.IntegerField("Number of foreign affiliations", blank=True, null=True)

    ccaas = models.JSONField("CCAA (Spanish Autonomous Communities)", blank=True, null=True)
    provinces = models.JSONField("Provinces", blank=True, null=True)
    areas_all = models.JSONField("All thematic areas", blank=True, null=True)

    thematic_areas = models.ManyToManyField("ThematicArea", related_name="publications")
    predicted_thematic_areas = models.ManyToManyField("ThematicArea", related_name="predicted_publications", blank=True)
    jcr_materias = models.JSONField("JCR materias", blank=True, null=True)

    other_authors = models.JSONField("Non-IPBLN authors (raw names)", blank=True, null=True)
    affiliations = models.JSONField("Full affiliation strings", blank=True, null=True)
    institutions = models.ManyToManyField("Institution", related_name="publications", blank=True)

    def __str__(self):
        return f"{self.title[:80]}..."


class PublicationMetric(models.Model):
    """
    Represents a bibliometric indicator associated with a scientific publication.

    This model stores a single metric value for a given publication, source (e.g., WoS, Scopus, Dimensions),
    and metric type (e.g., Journal Impact Factor, SJR, CiteScore, Citations, etc.) for a specific year.
    It follows a normalized structure: each row stores one metric per publication per year, avoiding redundant
    and null-heavy fields.

    Fields:
    --------
    - publication: Foreign key to the related Publication instance.
    - source: The origin of the metric (WoS, Scopus, or Dimensions).
    - metric_type: The specific type of metric being stored (e.g., 'jif', 'sjr', 'citations', etc.).
    - year: The year in which the metric was reported.

    - source_journal_name: Name of the journal to which the metric refers (if applicable).
    - source_journal_link: Link to the journal source (from the impact CSV or metadata).
    
    - impact_factor: Stores the numerical value of the metric (e.g., JIF, SJR, CiteScore, RCR, etc.).
    - quartile: Label of the quartile (e.g., Q1, D1).
    - quartile_value: Numeric quartile equivalent (1 = Q1/D1, 2 = Q2/D2, etc.).
    - percentile: Percentile rank of the metric in its subject area.
    - position: Rank position in the subject category (e.g., "24/110").
    - subject_areas: List of subject areas or categories relevant to this metric (JSON field).

    - influence_score: Only used if the metric_type is 'influence' (e.g., Article Influence Score).
    - international_collab: Optional boolean indicating if international collaboration is flagged in the metric record.

    Constraints:
    ------------
    - One metric entry per (publication, source, metric_type, year).
    - Designed to support parsing from multiple data sources (CSV, JSON).

    Usage:
    ------
    - For a given publication, this model can store multiple metric rows for the same year,
      one for each combination of metric type and source.
    - It supports flexible retrieval and display of bibliometric indicators in dashboards or reports.
    """
        
    SOURCE_CHOICES = [
        ("wos", "WoS"),
        ("scopus", "Scopus"),
        ("dimensions", "Dimensions"),
    ]

    METRIC_TYPE_CHOICES = [
        ("jif", "Journal Impact Factor"),
        ("jci", "Journal Citation Indicator"),
        ("sjr", "SJR"),
        ("citescore", "CiteScore"),
        ("influence", "Article Influence Score"),
        ("citations", "Citations"),
        ("recent_citations", "Recent Citations (2y)"),
        ("fcr", "Field Citation Ratio"),
        ("rcr", "Relative Citation Ratio"),
    ]

    publication = models.ForeignKey("Publication", on_delete=models.CASCADE, related_name="metrics")

    source = models.CharField("Metric source", max_length=50, choices=SOURCE_CHOICES)
    metric_type = models.CharField("Metric type", max_length=50, choices=METRIC_TYPE_CHOICES, default="Not specified")
    year = models.IntegerField("Metric year", blank=True, null=True)

    source_journal_name = models.CharField("Journal name for metric", max_length=255, blank=True, null=True)
    source_journal_link = models.URLField("Link to journal", blank=True, null=True)

    impact_factor = models.FloatField("Impact factor / value", blank=True, null=True)
    quartile = models.CharField("Quartile (e.g., Q1)", max_length=10, blank=True, null=True)
    quartile_value = models.IntegerField("Quartile (numeric)", blank=True, null=True)
    percentile = models.FloatField("Percentile", blank=True, null=True)
    position = models.CharField("Position", max_length=50, blank=True, null=True)
    subject_areas = models.JSONField("Subject areas", blank=True, null=True)

    influence_score = models.FloatField("Influence score (if applicable)", blank=True, null=True)

    international_collab = models.FloatField("International collaboration (metric)", blank=True, null=True)

    class Meta:
        unique_together = ("publication", "source", "metric_type", "year")
        ordering = ["publication", "source", "year"]

    def __str__(self):
        return f"{self.publication.title[:60]} - {self.source.upper()} {self.metric_type.upper()} {self.year or ''}"

    
    
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

    department = models.CharField("Department", max_length=200, blank=True, null=True)
    lovaina_community = models.IntegerField("Lovaina Community", blank=True, null=True)
    leiden_community = models.IntegerField("Leiden Community", blank=True, null=True)
    department_global = models.CharField("Department for global network", max_length=200, blank=True, null=True)
    lovaina_community_global = models.IntegerField("Lovaina Community for global network", blank=True, null=True)
    leiden_community_global = models.IntegerField("Leiden Community for global network", blank=True, null=True)

    def __str__(self):
        return self.name


class Collaboration(models.Model):
    author = models.ForeignKey('Author', on_delete=models.CASCADE, related_name='collaborations_initiated')
    collaborator = models.ForeignKey('Author', on_delete=models.CASCADE, related_name='collaborations_received')
    publication_count = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('author', 'collaborator')
        

class AuthorClustering(models.Model):
    CLUSTERING_MODELS = [
        ('kmeans', 'KMeans'),
        ('dbscan', 'DBSCAN'),
        ('hdbscan', 'HDBSCAN'),
        ('agglomerative', 'Agglomerative'),
        ('hierarchical', 'Hierarchical'),
        ('spectral', 'Spectral'),
        ('gmm', 'Gaussian Mixture Model'),
        ('lovaina', 'Lovaina'),
    ]

    author = models.ForeignKey("Author", on_delete=models.CASCADE, related_name="clusterings")
    model_name = models.CharField("Clustering model", max_length=50, choices=CLUSTERING_MODELS)
    cluster = models.IntegerField("Assigned cluster")
    k = models.IntegerField("Number of clusters", blank=True, null=True)
    pca_dims = models.IntegerField("PCA dimensions", blank=True, null=True)

    silhouette = models.FloatField("Silhouette score", blank=True, null=True)
    calinski_harabasz = models.FloatField("Calinski-Harabasz score", blank=True, null=True)
    davies_bouldin = models.FloatField("Davies-Bouldin score", blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Author clustering"
        verbose_name_plural = "Author clusterings"
        indexes = [
            models.Index(fields=["model_name", "k", "pca_dims"]),
        ]

    def __str__(self):
        return f"{self.author.name} | {self.model_name} | k={self.k} | cluster={self.cluster}"


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
