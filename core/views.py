import logging
from io import BytesIO, StringIO
from django.shortcuts import render, get_object_or_404
import json
from django.http import JsonResponse, HttpResponse, Http404
from bibliodata.models import Publication, Author, Collaboration
from django.db.models import Count, Min, Max, Q, F
from django.http import JsonResponse
from bibliodata.models import Author  # Para mapear nombres
from django.db.models import Max as DBMax, Min as DBMin
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils.translation import gettext as _
import random
import networkx as nx
import csv
import random
from django.contrib.auth.decorators import login_required
from django.conf import settings
import unicodedata
from pathlib import Path
from bibliodata.models import PublicationEmbedding
from core.reports.network_exports import build_collaboration_graph
from core.reports.bibtex import build_bibtex_entry
from core.reports.ris import build_ris_entry
from core.reports.pdf_exports import build_pdf_report

# --- Optimized: Use HNSWlib index ---
import hnswlib
import os

from sentence_transformers import SentenceTransformer, CrossEncoder
import tempfile
import shutil


def _get_selected_authors(request):
    """Return selected author names from the query string.

    Supported formats:
    - Single: ?author=Name
    - Multi (repeated): ?author=Name1&author=Name2
    - Multi (list): ?authors=Name1&authors=Name2
    - Multi (array style): ?authors[]=Name1&authors[]=Name2

    Returns:
        list[str]: Normalized, non-empty author names.
    """
    authors = []

    # Prefer multi-value forms if present.
    author_list = [a.strip() for a in request.GET.getlist('author') if str(a).strip()]
    authors.extend(author_list)
    authors.extend([a.strip() for a in request.GET.getlist('authors') if str(a).strip()])
    authors.extend([a.strip() for a in request.GET.getlist('authors[]') if str(a).strip()])

    # Backwards compatibility: some call sites use request.GET.get('author')
    # Avoid duplicating when the multi-value form is already present.
    if not author_list:
        single = (request.GET.get('author') or '').strip()
        if single:
            authors.append(single)

    # De-duplicate while preserving order.
    seen = set()
    out = []
    for a in authors:
        if a not in seen:
            out.append(a)
            seen.add(a)
    return out

@csrf_exempt
@require_http_methods(["POST"])
def semantic_search(request):
    """
    Receives a search query, vectorizes it, computes cosine similarity with publication embeddings,
    and returns publications with similarity > 0.5, ordered by similarity.
    """
    import json
    data = json.loads(request.body.decode('utf-8'))
    query = data.get('query', '')
    if not query:
        return JsonResponse({'results': [], 'error': 'No query provided.', 'received_query': query}, status=400)

    # Load model (same as used for embeddings)
    model_name = 'all-MiniLM-L6-v2'
    model = SentenceTransformer(model_name)
    query_emb = model.encode(query)

    # Load HNSW index (path configurable via settings.HNSW_INDEX_PATH or request override)
    index_path = getattr(settings, 'HNSW_INDEX_PATH')
    if not os.path.exists(index_path):
        return JsonResponse({'results': [], 'error': 'HNSW index not found.', 'received_query': query}, status=500)

    # Load index (cache in global for efficiency)
    if not hasattr(semantic_search, '_hnsw_index'):
        first_emb = PublicationEmbedding.objects.first()
        if not first_emb:
            return JsonResponse({'results': [], 'error': 'No embeddings found.', 'received_query': query}, status=500)
        emb_dim = len(json.loads(first_emb.embedding))
        p = hnswlib.Index(space='cosine', dim=emb_dim)
        try:
            # Sanity check: Python-level readability (helps distinguish permission vs hnsw issue)
            with open(index_path, 'rb') as _fh:
                _fh.read(1)
            p.load_index(index_path)
        except RuntimeError as e:
            # Common on Windows when path contains non-ASCII characters (e.g., á) or is too long
            # Fallback: copy to a short, ASCII-only temp path and load from there
            if os.name == 'nt':
                tmp_dir = os.path.join(tempfile.gettempdir(), 'hnsw_index_cache')
                os.makedirs(tmp_dir, exist_ok=True)
                tmp_path = os.path.join(tmp_dir, 'hnsw_index.bin')
                try:
                    # Copy only if source is newer or destination missing
                    if not os.path.exists(tmp_path) or os.path.getmtime(index_path) > os.path.getmtime(tmp_path):
                        shutil.copy2(index_path, tmp_path)
                    with open(tmp_path, 'rb') as _fh:
                        _fh.read(1)
                    p.load_index(tmp_path)
                except Exception as e2:  # noqa: BLE001
                    return JsonResponse({'results': [], 'error': f'HNSW index could not be loaded: {e2}', 'received_query': query}, status=500)
            else:
                return JsonResponse({'results': [], 'error': f'HNSW index could not be loaded: {e}', 'received_query': query}, status=500)
        p.set_ef(100)
        semantic_search._hnsw_index = p
    else:
        p = semantic_search._hnsw_index

    # Permitir que el usuario defina el número de resultados (top_k)
    try:
        top_k = int(data.get('top_k', 50))
        if top_k < 1 or top_k > 500:
            top_k = 50
    except Exception:
        top_k = 50
    ids, distances = p.knn_query(query_emb, k=top_k)
    # Ensure plain Python types to avoid JSON serialization issues later
    ids = [int(x) for x in ids[0]]
    distances = [float(x) for x in distances[0]]

    # Convert cosine distance to similarity (1 - distance)
    candidates = []
    emb_objs = {
        pe.publication_id: pe
        for pe in PublicationEmbedding.objects.filter(publication_id__in=ids).select_related('publication')
    }
    for idx, pub_id in enumerate(ids):
        pe = emb_objs.get(pub_id)
        if not pe:
            continue
        pub = pe.publication
        similarity = 1.0 - float(distances[idx])
        if similarity < 0.1:
            continue

        curated_areas = [area.name for area in pub.thematic_areas.all()]
        raw_areas = list(pub.areas_all or [])
        institutions = [inst.name for inst in pub.institutions.all()]
        publication_type = pub.publication_type

        candidates.append({
            'id': pub.id,
            'title': pub.title,
            'year': pub.year,
            'publication_type': publication_type,
            'abstract': pub.abstract,
            'similarity': float(round(similarity, 3)),
            'authors': [author.name for author in pub.authors.all()],
            'other_authors': getattr(pub, 'other_authors', []),
            'keywords': list(pub.keywords_all or []),
            'areas': curated_areas or raw_areas,
            'areas_all': raw_areas,
            'institutions': institutions,
        })

    # Reranking con cross-encoder (multilingüe)

    def _build_rerank_text(candidate):
        """Return a reranking text combining the title with curated thematic areas."""
        title = candidate.get('title') or ''
        curated = candidate.get('areas') or []
        raw = candidate.get('areas_all') or []
        areas_text = ', '.join(curated) if curated else ', '.join(raw)
        if areas_text:
            return f"{title} || Areas: {areas_text}"
        fallback = candidate.get('abstract') or ''
        return f"{title} || {fallback}" if fallback else title

    pairs = [(query, _build_rerank_text(c)) for c in candidates]
    cross_encoder_model = 'cross-encoder/stsb-xlm-r-multilingual'
    if pairs:
        try:
            if not hasattr(semantic_search, '_cross_encoder'):
                semantic_search._cross_encoder = CrossEncoder(cross_encoder_model)
            cross_encoder = semantic_search._cross_encoder
            scores = cross_encoder.predict(pairs)
            for i, c in enumerate(candidates):
                c['rerank_score'] = float(scores[i])
            candidates.sort(key=lambda x: x.get('rerank_score', 0.0), reverse=True)
        except Exception as rerank_error:  # noqa: BLE001
            logging.warning("Cross-encoder rerank skipped: %s", rerank_error)
    return JsonResponse({'results': candidates, 'received_query': query})

def home(request):
    return render(request, 'core/home.html')

@login_required(login_url='/BiblioMetrics/accounts/login/')
def dashboard(request):
    return render(request, 'core/dashboard.html')

def about(request):
    return render(request, 'core/about.html')

from bibliodata.utils_publication_types import CANON_TYPES  # <-- importa tu lista canónica
from functools import reduce
from operator import or_

def _strip_accents_lower(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower().strip()

_CANON_LOOKUP = { _strip_accents_lower(c): c for c in CANON_TYPES }

def _canonicalize_types(selected):
    out = []
    for t in (selected or []):
        key = _strip_accents_lower(t)
        out.append(_CANON_LOOKUP.get(key, t))
    return out

def _apply_type_filter(qs, types):
    """
    Filter by exact JSON equality (normalized_types == ["<canon>"]).
    This avoids issues with Unicode escapes in SQLite JSON.
    Also supports legacy rows where normalized_types might be a plain string.
    """
    canon_types = _canonicalize_types(types)
    if not canon_types:
        return qs

    or_clauses = []
    for t in canon_types:
        # main: JSON list with a single canonical string
        or_clauses.append(Q(normalized_types=[t]))
        # legacy tolerance: if some rows were saved as a bare string
        or_clauses.append(Q(normalized_types=t))

    return qs.filter(reduce(or_, or_clauses))

def _get_normalized_type_value(norm):
    """Return the single canonical type from normalized_types JSONField."""
    if isinstance(norm, list) and norm:
        return (norm[0] or '').strip() or 'otro'
    if isinstance(norm, str) and norm:
        return norm.strip()
    return 'otro'


def _parse_quartiles(selected):
    """Normalize quartile input to a set of numeric values {1,2,3,4}.

    Accepted formats (case-insensitive):
    - 'Q1'..'Q4'
    - 'D1'..'D4' (treated like Q1..Q4)
    - '1'..'4'
    - 1..4
    """
    values = set()
    for q in (selected or []):
        if q is None:
            continue
        s = str(q).strip().upper()
        if not s:
            continue
        if s.startswith('Q') or s.startswith('D'):
            try:
                v = int(s[1:])
            except ValueError:
                continue
        else:
            try:
                v = int(s)
            except ValueError:
                continue
        if v in (1, 2, 3, 4):
            values.add(v)
    return values


def _apply_quartile_filter(qs, quartiles, metric_source=None):
    """Filter publications by WoS JCR – JIF quartiles only.

    Business rule (2025-10): Only Journal Impact Factor (metric_type='jif') from WoS is considered.
    Any provided metric_source is ignored (forced 'wos').
    Quartile labels in data may appear as Q1..Q4 or D1..D4; both are treated equivalently.
    Accepted inputs: 'Q1'..'Q4', 'D1'..'D4', 1..4 (numeric), case-insensitive.
    """
    target_vals = _parse_quartiles(quartiles)
    if not target_vals:
        return qs

    q_total = Q()
    for v in target_vals:
        # Accept exact numeric match OR strings that start with Qv / Dv, e.g. "Q1", "Q1 [2017]", "D1", "D1 [2018]"
        q_val = (
            Q(metrics__quartile_value=v, metrics__source='wos', metrics__metric_type='jif') |
            Q(metrics__quartile__istartswith=f"Q{v}", metrics__source='wos', metrics__metric_type='jif') |
            Q(metrics__quartile__istartswith=f"D{v}", metrics__source='wos', metrics__metric_type='jif')
        )
        q_total |= q_val

    return qs.filter(q_total).distinct()


@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_filter_data(request):
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    citations_from = request.GET.get('citations_from')
    citations_to = request.GET.get('citations_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')   # canónicos
    quartiles = request.GET.getlist('quartiles')  # e.g., ['Q1', 'Q2']
    # Business rule: ignore provided metric_source, always use WoS
    metric_source = 'wos'
    selected_authors = _get_selected_authors(request)

    base_query = Publication.objects.all()
    if year_from:
        base_query = base_query.filter(year__gte=year_from)
    if year_to:
        base_query = base_query.filter(year__lte=year_to)
    # Filtro de citas totales (campo Publication.citations)
    if citations_from is not None and citations_from != '':
        try:
            base_query = base_query.filter(citations__gte=int(citations_from))
        except ValueError:
            pass
    if citations_to is not None and citations_to != '':
        try:
            base_query = base_query.filter(citations__lte=int(citations_to))
        except ValueError:
            pass
    if selected_authors:
        base_query = base_query.filter(authors__name__in=selected_authors).distinct()

    # ---- Years (con todos los filtros, incl. tipos)
    query_with_all_filters = base_query
    if areas:
        query_with_all_filters = query_with_all_filters.filter(thematic_areas__name__in=areas)
    if institutions:
        query_with_all_filters = query_with_all_filters.filter(institutions__name__in=institutions)
    if types:
        query_with_all_filters = _apply_type_filter(query_with_all_filters, types)
    if quartiles:
        query_with_all_filters = _apply_quartile_filter(query_with_all_filters, quartiles, metric_source)

    years = (
        query_with_all_filters
        .values('year')
        .annotate(count=Count('id', distinct=True))
        .order_by('year')
    )

    # ---- Áreas (sin filtrar por área; con resto de filtros)
    areas_query = base_query
    if institutions:
        areas_query = areas_query.filter(institutions__name__in=institutions)
    if types:
        areas_query = _apply_type_filter(areas_query, types)
    if quartiles:
        areas_query = _apply_quartile_filter(areas_query, quartiles, metric_source)

    areas_with_counts = (
        areas_query.values('thematic_areas__name')
        .annotate(name=F('thematic_areas__name'), count=Count('id', distinct=True))
        .filter(count__gt=0, thematic_areas__name__isnull=False)
        .order_by('-count', 'name')
    )

    # ---- Instituciones (sin filtrar por institución; con resto de filtros)
    institutions_query = base_query
    if areas:
        institutions_query = institutions_query.filter(thematic_areas__name__in=areas)
    if types:
        institutions_query = _apply_type_filter(institutions_query, types)
    if quartiles:
        institutions_query = _apply_quartile_filter(institutions_query, quartiles, metric_source)

    institutions_with_counts = (
        institutions_query.values('institutions__name')
        .annotate(name=F('institutions__name'), count=Count('id', distinct=True))
        .filter(count__gt=0, institutions__name__isnull=False)
        .order_by('-count', 'name')
    )

    # ---- Tipos normalizados con conteo (mostrar TODOS, aunque cuenten 0)
    publications_for_type_counting = base_query
    if areas:
        publications_for_type_counting = publications_for_type_counting.filter(thematic_areas__name__in=areas)
    if institutions:
        publications_for_type_counting = publications_for_type_counting.filter(institutions__name__in=institutions)
    # A partir de ahora también aplicamos cuartiles para que los conteos de tipos
    # reflejen el subconjunto filtrado por Q (manteniendo todos los tipos posibles con 0 si no aparecen)
    if quartiles:
        publications_for_type_counting = _apply_quartile_filter(publications_for_type_counting, quartiles, metric_source)
    # Nota: normalmente aquí NO aplicamos 'types' para mostrar el universo completo disponible
    # según el resto de filtros. Si lo quieres aplicar, descomenta la siguiente línea:
    # if types: publications_for_type_counting = _apply_type_filter(publications_for_type_counting, types)

    # 1) Inicializa todos los canónicos a 0
    type_counts = {t: 0 for t in CANON_TYPES}

    # 2) Para evitar pérdidas de filas al usar DISTINCT + join con metrics (cuartiles),
    #    primero recuperamos los IDs únicos y luego consultamos normalized_types sin el join.
    pub_ids_for_types = list(
        publications_for_type_counting.values_list('id', flat=True).distinct()
    )
    for norm in Publication.objects.filter(id__in=pub_ids_for_types).values_list('normalized_types', flat=True):
        if isinstance(norm, list) and norm:
            key = (norm[0] or '').strip() or 'otro'
        elif isinstance(norm, str) and norm:
            key = norm.strip()
        else:
            key = 'otro'
        if key in type_counts:
            type_counts[key] += 1
        else:
            type_counts['otro'] += 1

    types_with_counts = [
        {'publication_type': name, 'count': count}
        for name, count in type_counts.items()
    ]
    # Si prefieres orden fijo canónico, usa esta línea:
    # types_with_counts.sort(key=lambda x: CANON_TYPES.index(x['publication_type']))
    # Si prefieres como antes (por count desc y luego alfabético), deja esta:
    types_with_counts.sort(key=lambda x: (-x['count'], x['publication_type']))

    # ---- Quartiles with counts (Q1..Q4). Mostrar TODOS, ignorando filtro de cuartiles
    publications_for_quartile_counting = base_query
    if areas:
        publications_for_quartile_counting = publications_for_quartile_counting.filter(thematic_areas__name__in=areas)
    if institutions:
        publications_for_quartile_counting = publications_for_quartile_counting.filter(institutions__name__in=institutions)
    if types:
        publications_for_quartile_counting = _apply_type_filter(publications_for_quartile_counting, types)

    quartiles_with_counts = []
    for v in (1, 2, 3, 4):
        q = (
            Q(metrics__quartile_value=v, metrics__source='wos', metrics__metric_type='jif') |
            Q(metrics__quartile__istartswith=f"Q{v}", metrics__source='wos', metrics__metric_type='jif') |
            Q(metrics__quartile__istartswith=f"D{v}", metrics__source='wos', metrics__metric_type='jif')
        )
        count = publications_for_quartile_counting.filter(q).distinct().count()
        quartiles_with_counts.append({'quartile': f'Q{v}', 'count': count})

    # Calcular rango de citas sobre el subconjunto base (sin aplicar filtro de tipos ni quartiles para mostrar universo según otros filtros)
    citations_query = base_query
    citations_stats = citations_query.aggregate(min_c=Min('citations'), max_c=Max('citations'))
    min_cit = citations_stats['min_c'] if citations_stats['min_c'] is not None else 0
    max_cit = citations_stats['max_c'] if citations_stats['max_c'] is not None else 0

    return JsonResponse({
        'years': list(years),
        'areas': list(areas_with_counts),
        'institutions': list(institutions_with_counts),
        'publication_types': types_with_counts,
        'quartiles': quartiles_with_counts,
        'citations_range': {'min': min_cit, 'max': max_cit}
    })

@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_filtered_data(request):
    # Obtener los parámetros de filtrado
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    citations_from = request.GET.get('citations_from')
    citations_to = request.GET.get('citations_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')
    quartiles = request.GET.getlist('quartiles')
    metric_source = 'wos'
    view_type = request.GET.get('view_type', 'yearly')
    selected_authors = _get_selected_authors(request)
    include_predicted_areas = request.GET.get('include_predicted_areas') == 'true'

    # Construir el query base
    query = Publication.objects.all()

    # Aplicar filtros
    if year_from:
        query = query.filter(year__gte=year_from)
    if year_to:
        query = query.filter(year__lte=year_to)
    if citations_from is not None and citations_from != '':
        try:
            query = query.filter(citations__gte=int(citations_from))
        except ValueError:
            pass
    if citations_to is not None and citations_to != '':
        try:
            query = query.filter(citations__lte=int(citations_to))
        except ValueError:
            pass
    if areas:
        query = query.filter(thematic_areas__name__in=areas)
    if institutions:
        query = query.filter(institutions__name__in=institutions)
    if types:
        query = _apply_type_filter(query, types)
    if quartiles:
        query = _apply_quartile_filter(query, quartiles, metric_source)
    if selected_authors:
        query = query.filter(authors__name__in=selected_authors).distinct()

    # Total publications matching all currently selected criteria.
    # Note: We compute this after applying all filters (including authors).
    total_publications = query.values('id').distinct().count()

    # Diccionario para convertir nombres de meses a números
    month_map = {
        'jan': 1, 'january': 1,
        'feb': 2, 'february': 2,
        'mar': 3, 'march': 3,
        'apr': 4, 'april': 4,
        'may': 5,
        'jun': 6, 'june': 6,
        'jul': 7, 'july': 7,
        'aug': 8, 'august': 8,
        'sep': 9, 'september': 9,
        'oct': 10, 'october': 10,
        'nov': 11, 'november': 11,
        'dec': 12, 'december': 12
    }

    def extract_month(date_str):
        if not date_str:
            return 1  # Fallback a enero si no hay fecha

        date_str = date_str.strip().lower()
        
        # Formato yyyy-mm-dd o yyyy/mm/dd
        if '-' in date_str or '/' in date_str:
            separator = '-' if '-' in date_str else '/'
            parts = date_str.split(separator)
            if len(parts) >= 2:
                try:
                    month = int(parts[1])
                    if 1 <= month <= 12:
                        return month
                except ValueError:
                    pass

        # Formato Month-Month Year o Month/Month Year
        for separator in ['-', '/']:
            if separator in date_str:
                parts = date_str.split(separator)
                if len(parts) >= 2:
                    # Intentar obtener el segundo mes del rango
                    second_month = parts[1].strip().split()[0]  # Tomar solo la primera palabra
                    if second_month in month_map:
                        return month_map[second_month]

        # Formato Month Year
        for month_name, month_num in month_map.items():
            if month_name in date_str:
                return month_num

        return 1  # Fallback a enero si no se puede determinar el mes

    # Obtener datos para las visualizaciones
    if view_type == 'monthly' and year_from and year_to and year_from == year_to:
        # Vista mensual para un año específico
        year = int(year_from)
        timeline_data = []
        
        # Crear un diccionario con todos los meses del año
        months_data = {month: 0 for month in range(1, 13)}
        
        # Obtener las publicaciones del año
        publications = query.filter(year=year)
        
        # Contador para publicaciones sin mes asignado
        no_month_count = 0
        
        # Procesar cada publicación
        for pub in publications:
            if not pub.publication_date:
                no_month_count += 1
            month = extract_month(pub.publication_date)
            months_data[month] += 1
        
        # Convertir a lista de objetos para el JSON
        timeline_data = [{'year': year, 'month': month, 'count': count} 
                        for month, count in months_data.items()]

        # Añadir información sobre publicaciones sin mes
        timeline_info = {
            'no_month_count': no_month_count,
            'total_count': sum(months_data.values())
        }
    else:
        # Vista anual (comportamiento original)
        min_year = int(year_from) if year_from else Publication.objects.aggregate(Min('year'))['year__min']
        max_year = int(year_to) if year_to else Publication.objects.aggregate(Max('year'))['year__max']
        
        # Crear un diccionario con todos los años en el rango
        timeline_data = {year: 0 for year in range(min_year, max_year + 1)}
        
        # Obtener los conteos reales
        year_counts = query.values('year').annotate(count=Count('id', distinct=True)).order_by('year')
        
        # Actualizar el diccionario con los conteos reales
        for item in year_counts:
            timeline_data[item['year']] = item['count']
        
        # Convertir a lista de objetos para el JSON
        timeline_data = [{'year': year, 'count': count} for year, count in timeline_data.items()]
        timeline_info = None

    # Procesar áreas temáticas para el gráfico circular
    if not include_predicted_areas:
        areas_data = list(query.values('thematic_areas__name').annotate(count=Count('id', distinct=True)).order_by('-count'))
        # Procesar para mostrar top 13 + Otros
        if len(areas_data) > 14:
            top_15_areas = areas_data[:14]
            other_areas = areas_data[14:]
            other_count = sum(area['count'] for area in other_areas)
            areas_data = top_15_areas + [{'thematic_areas__name': 'Otras', 'count': other_count}]
    else:
        # Sumar normales y predichas
        area_counts = {}
        for pub in query:
            # Áreas normales
            for area in pub.thematic_areas.values_list('name', flat=True):
                if area:
                    area_counts[area] = area_counts.get(area, 0) + 1
            # Áreas predichas
            for area in pub.predicted_thematic_areas.values_list('name', flat=True):
                if area:
                    area_counts[area] = area_counts.get(area, 0) + 1
        # Convertir a lista de dicts como espera el frontend
        areas_data = [
            {'thematic_areas__name': name, 'count': count}
            for name, count in area_counts.items()
        ]
        # Ordenar por count descendente
        areas_data.sort(key=lambda x: -x['count'])

        # Procesar para mostrar top 13 + Otros
        if len(areas_data) > 13:
            top_15_areas = areas_data[:13]
            other_areas = areas_data[13:]
            other_count = sum(area['count'] for area in other_areas)
            areas_data = top_15_areas + [{'thematic_areas__name': 'Otras', 'count': other_count}]
    
    institutions_data = list(query.values('institutions__name').annotate(count=Count('id', distinct=True)).order_by('-count'))
    # Tipos (NORMALIZADOS) para el front (mantiene la misma clave 'publication_type')
    # Contamos a partir del queryset ya filtrado (sin agrupar en SQL por ser JSONField en SQLite)
    type_counter = {}
    for norm in query.values_list('normalized_types', flat=True):
        key = _get_normalized_type_value(norm)
        type_counter[key] = type_counter.get(key, 0) + 1

    types_data = [{'publication_type': k, 'count': v} for k, v in type_counter.items()]
    types_data.sort(key=lambda x: (-x['count'], x['publication_type']))

    return JsonResponse({
        'timeline': timeline_data,
        'timeline_info': timeline_info,
        'areas': areas_data,
        'institutions': institutions_data,
        'types': types_data,
        'total_publications': total_publications,
    })

@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_author_suggestions(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'suggestions': []})

    # Buscar autores que coincidan con la consulta
    authors = Author.objects.filter(
        name__icontains=query
    ).values('name').annotate(
        count=Count('publications', distinct=True)
    ).order_by('-count', 'name')[:10]  # Limitar a 10 sugerencias

    return JsonResponse({
        'suggestions': list(authors)
    })

@login_required(login_url='/BiblioMetrics/accounts/login/')
def search_publications(request):
    q = request.GET.get('q', '').strip()
    selected_authors = _get_selected_authors(request)
    if not q and not selected_authors:
        return JsonResponse({'results': []})

    publications = Publication.objects.all()
    if selected_authors:
        publications = publications.filter(authors__name__in=selected_authors).distinct()
    elif q:
        # Publications-only search. Besides title and thematic areas, also match DOI.
        # This enables users to paste a full DOI or just a prefix.
        publications = publications.filter(
            Q(title__icontains=q) |
            Q(thematic_areas__name__icontains=q) |
            Q(doi__icontains=q)
        )

    publications = publications.distinct().order_by('-year', '-publication_date')[:50]

    results = []
    for pub in publications:
        authors = [a.name for a in pub.authors.all()]
        institutions = [i.name for i in pub.institutions.all()]
        areas = [a.name for a in pub.thematic_areas.all()]

        results.append({
            'id': pub.id,
            'title': pub.title,
            'year': pub.year,
            'publication_type': pub.publication_type,
            'authors': authors,
            'institutions': institutions,
            'areas': areas,
            'doi': getattr(pub, 'doi', None),
            'url': getattr(pub, 'url', None),
            'other_authors': getattr(pub, 'other_authors', []),
        })

    return JsonResponse({'results': results})

@login_required(login_url='/BiblioMetrics/accounts/login/')
def publication_detail(request, publication_id):
    # Obtener la publicación por su ID, o mostrar 404 si no existe
    publication = get_object_or_404(Publication, id=publication_id)

    # Obtener las métricas relacionadas con la publicación
    metrics = publication.metrics.all()

    zipped_links = list(zip(publication.extra_sources or [], publication.extra_links or []))

    # Puedes pasar la información que necesites a la plantilla
    context = {
        'publication': publication,
        'authors': publication.authors.all(),
        'institutions': publication.institutions.all(),
        'areas': publication.thematic_areas.all(),
        'metrics': metrics, # Añadimos las métricas al contexto
        'zipped_links': zipped_links,
        'next': request.GET.get('next') or request.META.get('HTTP_REFERER') or '',
    }
    
    return render(request, 'core/publication_detail.html', context)


@login_required(login_url='/BiblioMetrics/accounts/login/')
@require_http_methods(["GET"])
def publication_citation_export(request, publication_id, export_format):
    """Allow downloading a single-publication citation in BibTeX or RIS format."""

    publication = get_object_or_404(Publication, id=publication_id)
    fmt = (export_format or '').lower()

    if fmt == 'bib':
        content = build_bibtex_entry(publication)
        content_type = 'application/x-bibtex; charset=utf-8'
        extension = 'bib'
    elif fmt == 'ris':
        content = build_ris_entry(publication)
        content_type = 'application/x-research-info-systems; charset=utf-8'
        extension = 'ris'
    else:
        raise Http404('Unsupported citation format')

    filename = f"Bibliometria_Publicacion_{publication_id}.{extension}"
    response = HttpResponse(content, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def get_metric_value(pub, key):
# Mapeo entre clave y función de ordenación
    if key == 'International Collaboration':
        return pub.international_collab if pub.international_collab is not None else -1
    
    metric_map = {
        'Dimensions Citations': lambda p: p.metrics.filter(source='dimensions', metric_type='citations').order_by('-year').first(),
        'WoS Citations': lambda p: p.metrics.filter(source='wos', metric_type='citations').order_by('-year').first(),
        'Scopus Citations': lambda p: p.metrics.filter(source='scopus', metric_type='citations').order_by('-year').first(),
        'FCR': lambda p: p.metrics.filter(source='dimensions', metric_type='fcr').order_by('-year').first(),
        'RCR': lambda p: p.metrics.filter(source='dimensions', metric_type='rcr').order_by('-year').first(),
    }
    
    metric = metric_map.get(key, lambda p: None)(pub)
    return float(metric.impact_factor) if metric and metric.impact_factor is not None else -1


@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_publications_data(request):
    # Params
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')  # canonical
    quartiles = request.GET.getlist('quartiles')
    citations_from = request.GET.get('citations_from')
    citations_to = request.GET.get('citations_to')
    metric_source = 'wos'
    selected_authors = _get_selected_authors(request)
    page = int(request.GET.get('page', 1))
    try:
        per_page = int(request.GET.get('per_page', 20))
        if per_page <= 0:
            per_page = 20
    except (TypeError, ValueError):
        per_page = 20

    sort_by = request.GET.get('sort_by')
    sort_order = request.GET.get('sort_order', 'desc')

    # Base query
    query = Publication.objects.all()

    # Filters
    if year_from:
        query = query.filter(year__gte=year_from)
    if year_to:
        query = query.filter(year__lte=year_to)
    if citations_from is not None and citations_from != '':
        try:
            query = query.filter(citations__gte=int(citations_from))
        except ValueError:
            pass
    if citations_to is not None and citations_to != '':
        try:
            query = query.filter(citations__lte=int(citations_to))
        except ValueError:
            pass
    if areas:
        query = query.filter(thematic_areas__name__in=areas)
    if institutions:
        query = query.filter(institutions__name__in=institutions)
    if types:
        query = _apply_type_filter(query, types)
    if quartiles:
        query = _apply_quartile_filter(query, quartiles, metric_source)
    if selected_authors:
        query = query.filter(authors__name__in=selected_authors).distinct()

    # Fetch all filtered publications
    publications = list(query)

    # Sorting
    if sort_by:
        publications.sort(key=lambda pub: get_metric_value(pub, sort_by), reverse=(sort_order == 'desc'))
    else:
        publications.sort(key=lambda pub: (pub.year or 0, pub.publication_date or ''), reverse=True)

    # Pagination
    total_publications = len(publications)
    total_pages = (total_publications + per_page - 1) // per_page
    start = (page - 1) * per_page
    end = start + per_page
    publications = publications[start:end]

    # Build payload
    publications_data = []
    for pub in publications:
        metrics = {}

        dim_citations = pub.metrics.filter(source='dimensions', metric_type='citations').order_by('-year').first()
        if dim_citations:
            metrics['Dimensions Citations'] = {'value': dim_citations.impact_factor, 'year': dim_citations.year}

        wos_citations = pub.metrics.filter(source='wos', metric_type='citations').order_by('-year').first()
        if wos_citations:
            metrics['WoS Citations'] = {'value': wos_citations.impact_factor, 'year': wos_citations.year}

        scopus_citations = pub.metrics.filter(source='scopus', metric_type='citations').order_by('-year').first()
        if scopus_citations:
            metrics['Scopus Citations'] = {'value': scopus_citations.impact_factor, 'year': scopus_citations.year}

        dim_fcr = pub.metrics.filter(source='dimensions', metric_type='fcr').order_by('-year').first()
        if dim_fcr:
            metrics['FCR'] = {'value': dim_fcr.impact_factor, 'year': dim_fcr.year}

        dim_rcr = pub.metrics.filter(source='dimensions', metric_type='rcr').order_by('-year').first()
        if dim_rcr:
            metrics['RCR'] = {'value': dim_rcr.impact_factor, 'year': dim_rcr.year}

        norm_type = _get_normalized_type_value(pub.normalized_types)

        publications_data.append({
            'id': pub.id,
            'title': pub.title,
            'year': pub.year,
            'publication_type': norm_type,  # <- normalized single type (keeps same key)
            'metrics': metrics,
            'international_collab': pub.international_collab,
            'num_countries': getattr(pub, 'num_countries', None),
            'affiliations': getattr(pub, 'affiliations', None),
            'countries_ids': getattr(pub, 'countries_ids', None),
            'countries': getattr(pub, 'countries', None),
            'countries_iso2': getattr(pub, 'countries_iso2', None),
        })

    return JsonResponse({
        'publications': {
            'data': publications_data,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_items': total_publications,
                'per_page': per_page
            }
        }
    })

@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_collaboration_network(request):
    try:
        community_view = request.GET.get('communityView', 'department')
        clustering_model = request.GET.get('clusteringModel')
        n_clusters = request.GET.get('nClusters')
        auto_mode = request.GET.get('autoMode') == 'true'
        global_mode = request.GET.get('globalMode') == 'true'
        selected_authors = _get_selected_authors(request)
        selected_author_name = selected_authors[0] if selected_authors else None
        full_network = request.GET.get('fullNetwork') == 'true'

        # Multi-author view (selected authors only): build a small graph composed only of the
        # selected authors and edges representing collaborations *between them*.
        if len(selected_authors) > 1:
            selected_author_qs = Author.objects.filter(name__in=selected_authors)

            # Ensure we return nodes in the same order the user selected.
            author_by_name = {a.name: a for a in selected_author_qs}
            selected_author_objs = [author_by_name.get(name) for name in selected_authors if author_by_name.get(name)]

            G = nx.Graph()
            id_to_author = {}
            for author in selected_author_objs:
                author_id = str(author.gesbib_id)
                id_to_author[author_id] = author
                G.add_node(
                    author_id,
                    label=author.name,
                    department=getattr(author, 'department', 'Unknown'),
                    is_selected=True,
                )

            # Aggregate collaboration weights for edges between selected authors.
            selected_ids = [a.gesbib_id for a in selected_author_objs]
            if selected_ids:
                collabs = Collaboration.objects.filter(
                    author__gesbib_id__in=selected_ids,
                    collaborator__gesbib_id__in=selected_ids,
                )

                # Build an undirected edge map (src,tgt) with src < tgt to avoid duplicates.
                edge_weights: dict[tuple[str, str], int] = {}
                for c in collabs:
                    src = str(c.author.gesbib_id)
                    tgt = str(c.collaborator.gesbib_id)
                    if src == tgt:
                        continue
                    a, b = (src, tgt) if src < tgt else (tgt, src)
                    edge_weights[(a, b)] = edge_weights.get((a, b), 0) + int(c.publication_count or 0)

                for (src, tgt), weight in edge_weights.items():
                    if weight > 0:
                        G.add_edge(src, tgt, weight=weight)

            nodes = []
            for nid, d in G.nodes(data=True):
                nodes.append(
                    {
                        'id': nid,
                        'label': d['label'],
                        'department': d.get('department', 'Unknown'),
                        'is_selected': True,
                        # Sigma renderer expects positions; random layout is fine for small graphs.
                        'x': random.random() * 1000,
                        'y': random.random() * 1000,
                    }
                )

            edges = [
                {
                    'source': s,
                    'target': t,
                    'weight': int(d.get('weight', 1) or 1),
                }
                for s, t, d in G.edges(data=True)
            ]

            return JsonResponse(
                {
                    'nodes': nodes,
                    'edges': edges,
                    'is_author_view': True,
                    'is_multi_author_view': True,
                }
            )

        if selected_author_name:
            try:
                selected_author = Author.objects.get(name__iexact=selected_author_name)
                selected_author_id = str(selected_author.gesbib_id)
                collaborations = Collaboration.objects.filter(author=selected_author) | Collaboration.objects.filter(collaborator=selected_author)
                G = nx.Graph()
                G.add_node(
                    selected_author_id,
                    label=selected_author.name,
                    department=selected_author.department,
                    is_selected=True
                )
                for c in collaborations:
                    coauthor = c.collaborator if c.author == selected_author else c.author
                    coauthor_id = str(coauthor.gesbib_id)
                    if not G.has_node(coauthor_id):
                        G.add_node(
                            coauthor_id,
                            label=coauthor.name,
                            department=coauthor.department,
                            is_selected=False
                        )
                    G.add_edge(selected_author_id, coauthor_id, weight=c.publication_count)

                nodes = [{
                    'id': nid,
                    'label': d['label'],
                    'department': d['department'],
                    'is_selected': d['is_selected']
                } for nid, d in G.nodes(data=True)]

                edges = [{
                    'source': s, 'target': t, 'weight': d.get('weight', 1)
                } for s, t, d in G.edges(data=True)]

                return JsonResponse({'nodes': nodes, 'edges': edges, 'is_author_view': True, 'is_multi_author_view': False})
            except Author.DoesNotExist:
                pass

        # Red general
        G = nx.Graph()
        nodes_data = []
        valid_ids = set()
        id_to_name = {}

        if full_network:
            # Obtener todas las colaboraciones de la base de datos
            collaborations = Collaboration.objects.all()
            
            # Crear nodos y aristas
            for collab in collaborations:
                author_id = str(collab.author.gesbib_id)
                collaborator_id = str(collab.collaborator.gesbib_id)
                
                # Añadir nodos si no existen
                if not G.has_node(author_id):
                    G.add_node(
                        author_id,
                        label=collab.author.name,
                        department=getattr(collab.author, 'department_global', 'Unknown'),
                        lovaina_community=getattr(collab.author, 'lovaina_community_global', -1),
                        leiden_community=getattr(collab.author, 'leiden_community_global', -1)
                    )
                    valid_ids.add(author_id)
                    id_to_name[author_id] = collab.author.name
                
                if not G.has_node(collaborator_id):
                    G.add_node(
                        collaborator_id,
                        label=collab.collaborator.name,
                        department=getattr(collab.collaborator, 'department_global', 'Unknown'),
                        lovaina_community=getattr(collab.collaborator, 'lovaina_community_global', -1),
                        leiden_community=getattr(collab.collaborator, 'leiden_community_global', -1)
                    )
                    valid_ids.add(collaborator_id)
                    id_to_name[collaborator_id] = collab.collaborator.name
                
                # Añadir arista
                G.add_edge(author_id, collaborator_id, weight=collab.publication_count)
        else:
            # Lógica original para la red de IPs
            nodes_path = Path(settings.BASE_DIR) / "analysis" / "data" / "networks" / "lab_nodes.csv"
            edges_path = Path(settings.BASE_DIR) / "analysis" / "data" / "networks" / "lab_edges.csv"

            with open(nodes_path, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    name = row["Id"].strip()
                    try:
                        author = Author.objects.get(name__iexact=name)
                        author_id = str(author.gesbib_id)
                        department = getattr(author, 'department', 'Unknown')
                        lovaina_community = getattr(author, 'lovaina_community', -1)
                        leiden_community = getattr(author, 'leiden_community', -1)
                    except Author.DoesNotExist:
                        continue
                    valid_ids.add(author_id)
                    id_to_name[author_id] = name
                    G.add_node(author_id, department=department, lovaina_community=lovaina_community, leiden_community=leiden_community)

            with open(edges_path, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    try:
                        source = str(Author.objects.get(name__iexact=row["Source"]).gesbib_id)
                        target = str(Author.objects.get(name__iexact=row["Target"]).gesbib_id)
                    except Author.DoesNotExist:
                        continue
                    if source in valid_ids and target in valid_ids:
                        weight = int(row["Weight"])
                        G.add_edge(source, target, weight=weight)

        if community_view == 'keywords':
            clustering = None  # <-- Inicializar para evitar errores si no se asigna en los if/else
            for node in G.nodes():
                author = Author.objects.get(gesbib_id=node)
                if global_mode:
                    # Obtener todos los modelos disponibles
                    all_models = author.clusterings.all()
                    
                    if all_models.exists():
                        # Obtener los valores máximos y mínimos para normalización
                        max_silhouette = all_models.aggregate(DBMax('silhouette'))['silhouette__max']
                        min_silhouette = all_models.aggregate(DBMin('silhouette'))['silhouette__min']
                        max_calinski = all_models.aggregate(DBMax('calinski_harabasz'))['calinski_harabasz__max']
                        min_calinski = all_models.aggregate(DBMin('calinski_harabasz'))['calinski_harabasz__min']
                        max_davies = all_models.aggregate(DBMax('davies_bouldin'))['davies_bouldin__max']
                        min_davies = all_models.aggregate(DBMin('davies_bouldin'))['davies_bouldin__min']
                        
                        # Calcular el score combinado para cada modelo
                        best_score = float('-inf')
                        best_clustering = None
                        
                        for model in all_models:
                            if model.silhouette is not None and model.calinski_harabasz is not None and model.davies_bouldin is not None:
                                # Normalizar las métricas
                                norm_silhouette = (model.silhouette - min_silhouette) / (max_silhouette - min_silhouette) if max_silhouette != min_silhouette else 0
                                norm_calinski = (model.calinski_harabasz - min_calinski) / (max_calinski - min_calinski) if max_calinski != min_calinski else 0
                                norm_davies = (model.davies_bouldin - min_davies) / (max_davies - min_davies) if max_davies != min_davies else 0
                                
                                # Calcular score combinado
                                combined_score = 0.8 * norm_silhouette + 0.1 * norm_calinski + 0.1 * (1 - norm_davies)
                                
                                if combined_score > best_score:
                                    best_score = combined_score
                                    best_clustering = model
                        
                        clustering = best_clustering
                    else:
                        clustering = None
                elif clustering_model:
                    if auto_mode:
                        clustering = author.clusterings.filter(model_name=clustering_model).order_by('-silhouette').first()
                    else:
                        clustering = author.clusterings.filter(model_name=clustering_model, k=n_clusters).first()
                community = clustering.cluster if clustering else -1

                nodes_data.append({
                    "id": node,
                    "label": id_to_name.get(node, node),
                    "x": random.random() * 1000,
                    "y": random.random() * 1000,
                    "is_selected": False,
                    "community": community,
                    "department": G.nodes[node].get('department', 'Unknown'),
                    "leiden_community": G.nodes[node].get('leiden_community', -1),
                    "lovaina_community": G.nodes[node].get('lovaina_community', -1)
                })
        else:
            for node in G.nodes():
                nodes_data.append({
                    "id": node,
                    "label": id_to_name.get(node, node),
                    "x": random.random() * 1000,
                    "y": random.random() * 1000,
                    "is_selected": False,
                    "community": G.nodes[node].get('lovaina_community', -1),
                    "department": G.nodes[node].get('department', 'Unknown'),
                    "leiden_community": G.nodes[node].get('leiden_community', -1),
                    "lovaina_community": G.nodes[node].get('lovaina_community', -1)
                })

        edges_data = []
        if community_view == 'keywords':
            for i, author1_id in enumerate(G.nodes()):
                author1 = Author.objects.get(gesbib_id=author1_id)
                for author2_id in list(G.nodes())[i+1:]:
                    author2 = Author.objects.get(gesbib_id=author2_id)
                    keywords1 = set(author1.keywords.keys() if author1.keywords else [])
                    keywords2 = set(author2.keywords.keys() if author2.keywords else [])
                    shared_keywords = keywords1.intersection(keywords2)
                    if len(shared_keywords) >= 1:
                        edges_data.append({
                            'source': author1_id,
                            'target': author2_id,
                            'weight': len(shared_keywords),
                            'title': f"Keywords compartidas: {', '.join(shared_keywords)}"
                        })
        else:
            for u, v, d in G.edges(data=True):
                edges_data.append({
                    "source": u,
                    "target": v,
                    "weight": d.get("weight", 1)
                })

        extra_info = {}
        if community_view == 'keywords' and clustering:
            extra_info['model'] = clustering.model_name
            extra_info['n_clusters'] = clustering.k

        return JsonResponse({
            "nodes": nodes_data,
            "edges": edges_data,
            "is_author_view": False,
            **extra_info
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_author_metrics(request):
    author_name = request.GET.get('author_id')  # Ahora recibimos el nombre
    if not author_name:
        return JsonResponse({'error': 'No author name provided'}, status=400)
    
    try:
        author = Author.objects.get(name=author_name)
        metrics = {
            'orcid': author.orcid_link,
            'total_publications': author.total_publications,
            'total_citations': author.total_citations,
            'citations_wos': author.citations_wos,
            'citations_scopus': author.citations_scopus,
            'h_index': author.h_index,
            'h_index_gb': author.h_index_gb,
            'h_index_h5gb': author.h_index_h5gb,
            'international_index': author.international_index
        }
        
        # Remove None values
        metrics = {k: v for k, v in metrics.items() if v is not None}
        
        return JsonResponse({
            'author_name': author.name,
            'metrics': metrics
        })
    except Author.DoesNotExist:
        return JsonResponse({'error': 'Author not found'}, status=404)

@require_http_methods(["GET", "POST"])
@csrf_exempt
@login_required(login_url='/BiblioMetrics/accounts/login/')
def export_report(request):
    """Export bibliometric data and report in multiple formats.

    Supported formats (format param):
        - pdf: Existing rich PDF with filters and charts.
        - csv: Tabular CSV of publications.
        - ndjson: One JSON object per line for easy streaming / pipelines.
        - bibtex: Bibliographic entries for LaTeX / reference managers.
        - ris: RIS formatted references.
        - gexf: Collaboration network (authors) in GEXF for Gephi.
    - network_csv: Edges list (author, collaborator, weight) as CSV with readable labels.
    - network_nodes: Nodes table (id, label, department, communities) as CSV.
        - zip: Full bundle (CSV, NDJSON, BibTeX, RIS, GEXF, edges CSV, README, minimal PDF).

    Optional ordering parameters:
        - sort_field: One of [year, citations, dimensions_citations, wos_citations, scopus_citations,
                        fcr, rcr, international_collab]
        - sort_order: asc | desc (default desc)

    Filtering parameters replicate dashboard filters.
    """
    import base64
    from io import BytesIO, StringIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, Image
    from reportlab.lib.enums import TA_CENTER
    from datetime import datetime
    
    # Permitir POST para recibir imágenes
    if request.method == 'POST':
        data = request.POST
        files = request.FILES
    else:
        data = request.GET
        files = request.FILES

    # DEBUG: log para ver si llegan las imágenes
    import logging
    logger = logging.getLogger("django")

    year_from = data.get('year_from')
    year_to = data.get('year_to')
    citations_from = data.get('citations_from')
    citations_to = data.get('citations_to')
    areas = data.getlist('areas') if hasattr(data, 'getlist') else []
    institutions = data.getlist('institutions') if hasattr(data, 'getlist') else []
    types = data.getlist('types') if hasattr(data, 'getlist') else []
    quartiles = data.getlist('quartiles') if hasattr(data, 'getlist') else []
    metric_source = 'wos'  # enforced business rule
    author = data.get('author')
    format_ = data.get('format', 'pdf')
    sort_field = data.get('sort_field')
    sort_order = data.get('sort_order', 'desc')
    network_scope = data.get('network_scope', 'ips')
    if network_scope not in {'ips', 'full'}:
        network_scope = 'ips'

    # Build base queryset (shared by most formats)
    pubs_query = Publication.objects.all()
    if year_from:
        pubs_query = pubs_query.filter(year__gte=year_from)
    if year_to:
        pubs_query = pubs_query.filter(year__lte=year_to)
    if citations_from is not None and citations_from != '':
        try:
            pubs_query = pubs_query.filter(citations__gte=int(citations_from))
        except ValueError:
            pass
    if citations_to is not None and citations_to != '':
        try:
            pubs_query = pubs_query.filter(citations__lte=int(citations_to))
        except ValueError:
            pass
    if areas:
        pubs_query = pubs_query.filter(thematic_areas__name__in=areas)
    if institutions:
        pubs_query = pubs_query.filter(institutions__name__in=institutions)
    if types:
        pubs_query = _apply_type_filter(pubs_query, types)
    if quartiles:
        pubs_query = _apply_quartile_filter(pubs_query, quartiles, 'wos')
    if author:
        pubs_query = pubs_query.filter(authors__name=author)

    # Ordering annotations (metrics stored in PublicationMetric model)
    from django.db.models import OuterRef, Subquery, FloatField
    from bibliodata.models import PublicationMetric

    def metric_subquery(metric_type: str, source: str):
        return Subquery(
            PublicationMetric.objects.filter(
                publication=OuterRef('pk'),
                metric_type=metric_type,
                source=source
            ).order_by('-year').values('impact_factor')[:1]
        )

    annotate_map = {}
    if sort_field in {
        'dimensions_citations', 'wos_citations', 'scopus_citations', 'fcr', 'rcr'
    }:
        # Add needed annotations only once
        annotate_map['dimensions_citations'] = metric_subquery('citations', 'dimensions')
        annotate_map['wos_citations'] = metric_subquery('citations', 'wos')
        annotate_map['scopus_citations'] = metric_subquery('citations', 'scopus')
        annotate_map['fcr'] = metric_subquery('fcr', 'dimensions')
        annotate_map['rcr'] = metric_subquery('rcr', 'dimensions')
        pubs_query = pubs_query.annotate(**annotate_map)

    # Determine safe order field
    order_field_map = {
        'year': 'year',
        'citations': 'citations',
        'dimensions_citations': 'dimensions_citations',
        'wos_citations': 'wos_citations',
        'scopus_citations': 'scopus_citations',
        'fcr': 'fcr',
        'rcr': 'rcr',
        'international_collab': 'international_collab'
    }
    if sort_field in order_field_map:
        order_real = order_field_map[sort_field]
        if sort_order == 'asc':
            pubs_query = pubs_query.order_by(order_real)
        else:
            pubs_query = pubs_query.order_by(f'-{order_real}')

    pubs_query = (
        pubs_query
        .distinct()
        .prefetch_related('authors', 'institutions', 'thematic_areas', 'predicted_thematic_areas')
    )

    # Shared serialization helpers for CSV/JSON exports
    db_fieldnames = [f.name for f in Publication._meta.fields]
    extra_fieldnames = [
        'authors_names',
        'authors_ids',
        'institutions_names',
        'thematic_areas_names',
        'predicted_thematic_areas_names',
    ]
    fieldnames = db_fieldnames + extra_fieldnames

    def _format_list_items(values):
        parts = []
        for value in (values or []):
            if value is None:
                continue
            if isinstance(value, (list, tuple)):
                nested = _format_list_items(value)
                if nested:
                    parts.append(nested)
            elif isinstance(value, dict):
                serialized = json.dumps(value, ensure_ascii=False)
                if serialized:
                    parts.append(serialized)
            else:
                text = str(value).strip()
                if text:
                    parts.append(text)
        return ' | '.join(parts)

    def _join(values):
        return _format_list_items(values)

    def _serialize_publication_for_tabular(pub):
        authors = list(pub.authors.all())
        institutions = list(pub.institutions.all())
        areas = list(pub.thematic_areas.all())
        pred_areas = list(pub.predicted_thematic_areas.all())

        row = {}
        for fname in db_fieldnames:
            val = getattr(pub, fname, None)
            if isinstance(val, list):
                row[fname] = _format_list_items(val)
            elif isinstance(val, dict):
                try:
                    row[fname] = json.dumps(val, ensure_ascii=False)
                except Exception:
                    row[fname] = str(val)
            else:
                row[fname] = '' if val is None else val

        row['authors_names'] = _join([a.name for a in authors])
        row['authors_ids'] = _join([a.gesbib_id for a in authors if getattr(a, 'gesbib_id', None)])
        row['institutions_names'] = _join([i.name for i in institutions])
        row['thematic_areas_names'] = _join([a.name for a in areas])
        row['predicted_thematic_areas_names'] = _join([a.name for a in pred_areas])
        return row

    # CSV export branch (generate CSV directly from DB using current active filters)
    if format_ == 'csv':
        # Prepare HTTP response; write UTF-8 BOM for better Excel compatibility on Windows
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_Publicaciones.csv"'
        response.write('\ufeff')
        writer = csv.DictWriter(response, fieldnames=fieldnames, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for pub in pubs_query:
            writer.writerow(_serialize_publication_for_tabular(pub))
        return response

    # NDJSON streaming export
    if format_ == 'ndjson':
        from django.http import StreamingHttpResponse
        import json as _json
        # Nota: no usar .iterator() sin chunk_size tras prefetch_related; alternativamente iterar directamente.
        def line_iter():
            # Iteración normal (prefetch ya ejecutado) evita el error de chunk_size.
            for pub in pubs_query:  # Evita ValueError bajo ASGI
                obj = _serialize_publication_for_tabular(pub)
                # Devolver bytes para robustez en algunos servidores ASGI
                yield (_json.dumps(obj, ensure_ascii=False) + '\n').encode('utf-8')
        resp = StreamingHttpResponse(line_iter(), content_type='application/x-ndjson; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_Publicaciones.ndjson"'
        return resp

    # BibTeX export
    if format_ == 'bibtex':
        entries = [build_bibtex_entry(pub) for pub in pubs_query]
        content = ''.join(entries)
        resp = HttpResponse(content, content_type='application/x-bibtex; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_Publicaciones.bib"'
        return resp

    # RIS export
    if format_ == 'ris':
        entries = [build_ris_entry(pub) for pub in pubs_query]
        content = ''.join(entries)
        resp = HttpResponse(content, content_type='application/x-research-info-systems; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_Publicaciones.ris"'
        return resp

    network_graph = None
    if format_ in {'gexf', 'network_csv', 'network_nodes', 'zip'}:
        network_graph = build_collaboration_graph(network_scope)

    if format_ == 'gexf':
        gexf_io = BytesIO()
        nx.write_gexf(network_graph, gexf_io)
        gexf_io.seek(0)
        resp = HttpResponse(gexf_io.read(), content_type='application/gexf+xml')
        resp['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_CoauthorNetwork.gexf"'
        return resp

    if format_ == 'network_csv':
        import csv as _csv
        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_CoauthorEdges.csv"'
        resp.write('\ufeff')
        writer = _csv.writer(resp)
        writer.writerow(['Source', 'Source Label', 'Target', 'Target Label', 'Weight'])
        for u, v, data in network_graph.edges(data=True):
            u_label = network_graph.nodes[u].get('label', u)
            v_label = network_graph.nodes[v].get('label', v)
            writer.writerow([u, u_label, v, v_label, data.get('weight', 1)])
        return resp

    if format_ == 'network_nodes':
        import csv as _csv
        resp = HttpResponse(content_type='text/csv; charset=utf-8')
        resp['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_CoauthorNodes.csv"'
        resp.write('\ufeff')
        writer = _csv.writer(resp)
        writer.writerow(['Id', 'Label', 'Department', 'Leiden Community', 'Lovaina Community'])
        for node_id, attrs in network_graph.nodes(data=True):
            writer.writerow([
                node_id,
                attrs.get('label', node_id),
                attrs.get('department', ''),
                attrs.get('leiden_community', ''),
                attrs.get('lovaina_community', ''),
            ])
        return resp

    # ZIP bundle of all formats
    if format_ == 'zip':
        import zipfile, json as _json, csv as _csv
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # CSV
            csv_buffer = StringIO()
            dict_writer = _csv.DictWriter(csv_buffer, fieldnames=fieldnames)
            dict_writer.writeheader()
            for pub in pubs_query:
                dict_writer.writerow(_serialize_publication_for_tabular(pub))
            zf.writestr('publicaciones.csv', csv_buffer.getvalue().encode('utf-8'))

            # NDJSON
            nd_lines = []
            for pub in pubs_query:
                nd_lines.append(_json.dumps(_serialize_publication_for_tabular(pub), ensure_ascii=False))
            zf.writestr('publicaciones.ndjson', ('\n'.join(nd_lines) + '\n').encode('utf-8'))

            # BibTeX
            bib_entries = [build_bibtex_entry(pub) for pub in pubs_query]
            zf.writestr('publicaciones.bib', ''.join(bib_entries))

            # RIS
            ris_entries = [build_ris_entry(pub) for pub in pubs_query]
            zf.writestr('publicaciones.ris', ''.join(ris_entries))

            # Network GEXF and edges CSV respecting the selected scope
            if network_graph is None:
                network_graph = build_collaboration_graph(network_scope)
            gexf_out = BytesIO()
            nx.write_gexf(network_graph, gexf_out)
            zf.writestr('red_coautorias.gexf', gexf_out.getvalue())

            edges_buffer = StringIO()
            edges_writer = _csv.writer(edges_buffer)
            edges_writer.writerow(['Source', 'Source Label', 'Target', 'Target Label', 'Weight'])
            for u, v, data in network_graph.edges(data=True):
                u_label = network_graph.nodes[u].get('label', u)
                v_label = network_graph.nodes[v].get('label', v)
                edges_writer.writerow([u, u_label, v, v_label, data.get('weight', 1)])
            zf.writestr('red_coautorias_edges.csv', edges_buffer.getvalue().encode('utf-8'))

            nodes_buffer = StringIO()
            nodes_writer = _csv.writer(nodes_buffer)
            nodes_writer.writerow(['Id', 'Label', 'Department', 'Leiden Community', 'Lovaina Community'])
            for node_id, attrs in network_graph.nodes(data=True):
                nodes_writer.writerow([
                    node_id,
                    attrs.get('label', node_id),
                    attrs.get('department', ''),
                    attrs.get('leiden_community', ''),
                    attrs.get('lovaina_community', ''),
                ])
            zf.writestr('red_coautorias_nodes.csv', nodes_buffer.getvalue().encode('utf-8'))

            # README
            network_label = 'Red completa (todos los investigadores)' if network_scope == 'full' else 'Red de IPs (investigadores principales)'
            readme = (
                "Paquete de exportación bibliométrica IPBLN\n\n"
                "Incluye: CSV, NDJSON, BibTeX, RIS, red de coautorías (GEXF + edges/nodes CSV).\n"
                f"Filtros aplicados: años={year_from}-{year_to}, areas={', '.join(areas)}, instituciones={', '.join(institutions)}, tipos={', '.join(types)}, autor={author or '-'}\n"
                f"Ordenación: campo={sort_field or '-'} orden={sort_order}\n"
                f"Tipo de red exportada: {network_label}\n"
            )
            zf.writestr('README.txt', readme)

        zip_buffer.seek(0)
        resp = HttpResponse(zip_buffer.read(), content_type='application/zip')
        resp['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_ExportBundle.zip"'
        return resp

    filters_context = {
        'year_from': year_from,
        'year_to': year_to,
        'areas': areas,
        'institutions': institutions,
        'types': types,
        'quartiles': quartiles,
        'citations_from': citations_from,
        'citations_to': citations_to,
        'author': author,
    }
    images_context = {
        'timeline': data.get('timeline_img'),
        'pie': data.get('pie_img'),
        'bar': data.get('bar_img'),
        # Optional collaboration maps (base64 PNG) captured from the UI.
        'collab_map_world': data.get('collab_map_world_img'),
        'collab_map_spain': data.get('collab_map_spain_img'),
    }
    # Ensure the PDF is generated using the active UI language.
    # - Preferred: explicit POST param (allows future callers).
    # - Fallback: the current request language (LocaleMiddleware / i18n_patterns).
    from django.utils.translation import get_language

    requested_lang = (data.get('lang') or '').strip() or (get_language() or 'es')
    pdf_content = build_pdf_report(
        request=request,
        pubs_queryset=pubs_query,
        filters=filters_context,
        images=images_context,
        network_html=data.get('network_html'),
        lang=requested_lang,
        logger=logger,
    )

    response = HttpResponse(pdf_content, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="Bibliometria_IPBLN_Informe.pdf"'
    return response


@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_worldmap_counts(request):
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    citations_from = request.GET.get('citations_from')
    citations_to = request.GET.get('citations_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')  # canonical
    quartiles = request.GET.getlist('quartiles')
    # Business rule: ignore provided metric_source, always use WoS
    metric_source = 'wos'
    selected_authors = _get_selected_authors(request)

    query = Publication.objects.all()
    if year_from:
        query = query.filter(year__gte=year_from)
    if year_to:
        query = query.filter(year__lte=year_to)
    if citations_from is not None and citations_from != '':
        try:
            query = query.filter(citations__gte=int(citations_from))
        except ValueError:
            pass
    if citations_to is not None and citations_to != '':
        try:
            query = query.filter(citations__lte=int(citations_to))
        except ValueError:
            pass
    if areas:
        query = query.filter(thematic_areas__name__in=areas)
    if institutions:
        query = query.filter(institutions__name__in=institutions)
    if types:
        query = _apply_type_filter(query, types)
    if quartiles:
        query = _apply_quartile_filter(query, quartiles, metric_source)
    if selected_authors:
        query = query.filter(authors__name__in=selected_authors)

    query = query.distinct()

    total = query.count()
    counts = {}
    debug_mode = request.GET.get('debug') == '1'
    missing_spain_ids = []

    for num_countries, countries_iso2, num_spanish_affils, pub_id in query.values_list(
        'num_countries', 'countries_iso2', 'num_spanish_affils', 'id'
    ):
        try:
            iso_list = countries_iso2 if isinstance(countries_iso2, list) else []
            per_pub_iso = set()
            for code in iso_list:
                if isinstance(code, str):
                    iso = code.strip().upper()
                    if iso:
                        per_pub_iso.add(iso)
            if (not per_pub_iso or 'ES' not in per_pub_iso) and (num_spanish_affils or 0) > 0:
                per_pub_iso.add('ES')
                if debug_mode:
                    missing_spain_ids.append(pub_id)
            for iso in per_pub_iso:
                counts[iso] = counts.get(iso, 0) + 1
        except Exception:
            continue

    response = {'counts': counts, 'total_publications': total}
    if debug_mode:
        response['fallback_spain_added'] = len(missing_spain_ids)
        response['sample_missing_spain_publications'] = missing_spain_ids[:50]
    return JsonResponse(response)


@login_required(login_url='/BiblioMetrics/accounts/login/')
def get_spainmap_counts(request):
    import unicodedata, re

    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    citations_from = request.GET.get('citations_from')
    citations_to = request.GET.get('citations_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')  # canonical
    quartiles = request.GET.getlist('quartiles')
    # Business rule: ignore provided metric_source, always use WoS
    metric_source = 'wos'
    selected_authors = _get_selected_authors(request)

    count_mode = request.GET.get('count', 'occurrences')  # 'occurrences' or 'publications'
    query = Publication.objects.all()
    if year_from:
        query = query.filter(year__gte=year_from)
    if year_to:
        query = query.filter(year__lte=year_to)
    if citations_from is not None and citations_from != '':
        try:
            query = query.filter(citations__gte=int(citations_from))
        except ValueError:
            pass
    if citations_to is not None and citations_to != '':
        try:
            query = query.filter(citations__lte=int(citations_to))
        except ValueError:
            pass
    if areas:
        query = query.filter(thematic_areas__name__in=areas)
    if institutions:
        query = query.filter(institutions__name__in=institutions)
    if types:
        query = _apply_type_filter(query, types)
    if quartiles:
        query = _apply_quartile_filter(query, quartiles, metric_source)
    if selected_authors:
        query = query.filter(authors__name__in=selected_authors)

    query = query.distinct()

    def normalize_key(name: str) -> str:
        if not isinstance(name, str):
            return ''
        nfkd = unicodedata.normalize('NFKD', name)
        ascii_str = ''.join([c for c in nfkd if not unicodedata.combining(c)])
        s = re.sub(r'[‐-‒–—―\-_/]+', ' ', ascii_str)
        s = re.sub(r'[^A-Za-zÀ-ÿ ]+', ' ', s)
        s = re.sub(r'\s+', ' ', s)
        return s.strip().lower()

    ccaa_counts, prov_counts = {}, {}

    # Extrae primero los IDs de publicaciones filtradas para evitar duplicados por joins M2M
    pub_ids = list(query.values_list('id', flat=True).distinct())

    # Itera únicamente sobre esas publicaciones (una vez por publicación)
    rows = Publication.objects.filter(id__in=pub_ids).values_list('id', 'ccaas', 'provinces')

    if count_mode == 'publications':
        # Cuenta cada CCAA/provincia como máximo 1 vez por publicación
        for _pid, ccaas, provinces in rows:
            try:
                per_pub_ccaa = set()
                per_pub_prov = set()

                if isinstance(ccaas, (list, tuple)):
                    for n in ccaas:
                        k = normalize_key(n)
                        if k:
                            per_pub_ccaa.add(k)
                elif isinstance(ccaas, str):
                    k = normalize_key(ccaas)
                    if k:
                        per_pub_ccaa.add(k)

                if isinstance(provinces, (list, tuple)):
                    for n in provinces:
                        k = normalize_key(n)
                        if k:
                            per_pub_prov.add(k)
                elif isinstance(provinces, str):
                    k = normalize_key(provinces)
                    if k:
                        per_pub_prov.add(k)

                for k in per_pub_ccaa:
                    ccaa_counts[k] = ccaa_counts.get(k, 0) + 1
                for k in per_pub_prov:
                    prov_counts[k] = prov_counts.get(k, 0) + 1
            except Exception:
                continue
    else:
        # occurrences (por defecto): suma todas las apariciones de CCAA/provincia en las afiliaciones
        for _pid, ccaas, provinces in rows:
            try:
                if isinstance(ccaas, (list, tuple)):
                    for n in ccaas:
                        k = normalize_key(n)
                        if k:
                            ccaa_counts[k] = ccaa_counts.get(k, 0) + 1
                elif isinstance(ccaas, str):
                    k = normalize_key(ccaas)
                    if k:
                        ccaa_counts[k] = ccaa_counts.get(k, 0) + 1

                if isinstance(provinces, (list, tuple)):
                    for n in provinces:
                        k = normalize_key(n)
                        if k:
                            prov_counts[k] = prov_counts.get(k, 0) + 1
                elif isinstance(provinces, str):
                    k = normalize_key(provinces)
                    if k:
                        prov_counts[k] = prov_counts.get(k, 0) + 1
            except Exception:
                continue
    return JsonResponse({
        'ccaa': ccaa_counts,
        'provinces': prov_counts,
        'total_publications': len(pub_ids),
        'count_mode': count_mode,
    })