from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from bibliodata.models import Publication, Institution, ThematicArea, Author
from django.db.models import Count, Min, Max, Q
from collections import defaultdict
from itertools import combinations
import random

# Create your views here.

def home(request):
    return render(request, 'core/home.html')

def dashboard(request):
    return render(request, 'core/dashboard.html')

def about(request):
    return render(request, 'core/about.html')

def get_filter_data(request):
    # Obtener años disponibles con conteo de publicaciones
    years = Publication.objects.values('year').annotate(count=Count('id')).order_by('year')
    
    # Obtener áreas temáticas
    areas = ThematicArea.objects.values('name').annotate(count=Count('publications')).order_by('-count')
    
    # Obtener instituciones (solo las que tienen publicaciones)
    institutions = Institution.objects.filter(publications__isnull=False).values('name').annotate(count=Count('publications')).order_by('-count')
    
    # Obtener tipos de publicación
    pub_types = Publication.objects.values('publication_type').annotate(count=Count('id')).order_by('-count')
    
    return JsonResponse({
        'years': list(years),
        'areas': list(areas),
        'institutions': list(institutions),
        'publication_types': list(pub_types)
    })

def get_filtered_data(request):
    # Obtener los parámetros de filtrado
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')
    view_type = request.GET.get('view_type', 'yearly')
    author = request.GET.get('author')

    # Construir el query base
    query = Publication.objects.all()

    # Aplicar filtros
    if year_from:
        query = query.filter(year__gte=year_from)
    if year_to:
        query = query.filter(year__lte=year_to)
    if areas:
        query = query.filter(thematic_areas__name__in=areas)
    if institutions:
        query = query.filter(institutions__name__in=institutions)
    if types:
        type_query = Q()
        for type in types:
            type_query |= Q(publication_type__icontains=type)
        query = query.filter(type_query)
    if author:
        query = query.filter(authors__name=author)

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
        year_counts = query.values('year').annotate(count=Count('id')).order_by('year')
        
        # Actualizar el diccionario con los conteos reales
        for item in year_counts:
            timeline_data[item['year']] = item['count']
        
        # Convertir a lista de objetos para el JSON
        timeline_data = [{'year': year, 'count': count} for year, count in timeline_data.items()]
        timeline_info = None

    areas_data = list(query.values('thematic_areas__name').annotate(count=Count('id')).order_by('-count'))
    institutions_data = list(query.values('institutions__name').annotate(count=Count('id')).order_by('-count'))
    types_data = list(query.values('publication_type').annotate(count=Count('id')).order_by('-count'))

    return JsonResponse({
        'timeline': timeline_data,
        'timeline_info': timeline_info,
        'areas': areas_data,
        'institutions': institutions_data,
        'types': types_data
    })

def get_author_suggestions(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'suggestions': []})

    # Buscar autores que coincidan con la consulta
    authors = Author.objects.filter(
        name__icontains=query
    ).values('name').annotate(
        count=Count('publications')
    ).order_by('-count', 'name')[:10]  # Limitar a 10 sugerencias

    return JsonResponse({
        'suggestions': list(authors)
    })

def search_publications(request):
    query = request.GET.get('q', '').strip()
    author = request.GET.get('author', '').strip()
    if not query and not author:
        return JsonResponse({'results': []})

    # Construir la consulta base
    publications = Publication.objects.all()

    # Si hay un autor seleccionado, filtrar por ese autor
    if author:
        publications = publications.filter(authors__name=author)
    # Si hay una consulta de texto, buscar en títulos Y áreas temáticas
    elif query:
        publications = publications.filter(
            Q(title__icontains=query) |
            Q(thematic_areas__name__icontains=query)
        )

    # Ordenar y limitar resultados
    publications = publications.distinct().order_by('-year', '-publication_date')[:50]

    results = []
    for pub in publications:
        # Obtener los autores de la publicación
        authors = [author.name for author in pub.authors.all()]
        
        # Obtener las instituciones
        institutions = [inst.name for inst in pub.institutions.all()]
        
        # Obtener las áreas temáticas
        areas = [area.name for area in pub.thematic_areas.all()]
        
        results.append({
            'id': pub.id,
            'title': pub.title,
            'year': pub.year,
            'publication_type': pub.publication_type,
            'authors': authors,
            'institutions': institutions,
            'areas': areas,
            'url': pub.url if hasattr(pub, 'url') else None
        })

    return JsonResponse({'results': results})

def publication_detail(request, publication_id):
    # Obtener la publicación por su ID, o mostrar 404 si no existe
    publication = get_object_or_404(Publication, id=publication_id)

    # Puedes pasar la información que necesites a la plantilla
    context = {
        'publication': publication,
        'authors': publication.authors.all(),
        'institutions': publication.institutions.all(),
        'areas': publication.thematic_areas.all(),
    }
    
    return render(request, 'core/publication_detail.html', context)

def get_publications_data(request):
    # Obtener los parámetros de filtrado
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')
    author = request.GET.get('author')
    page = int(request.GET.get('page', 1))
    per_page = 20

    # Construir el query base
    query = Publication.objects.all()

    # Aplicar filtros
    if year_from:
        query = query.filter(year__gte=year_from)
    if year_to:
        query = query.filter(year__lte=year_to)
    if areas:
        query = query.filter(thematic_areas__name__in=areas)
    if institutions:
        query = query.filter(institutions__name__in=institutions)
    if types:
        type_query = Q()
        for type in types:
            type_query |= Q(publication_type__icontains=type)
        query = query.filter(type_query)
    if author:
        query = query.filter(authors__name=author)

    # Obtener el total de publicaciones para la paginación
    total_publications = query.count()
    total_pages = (total_publications + per_page - 1) // per_page

    # Obtener las publicaciones paginadas
    start = (page - 1) * per_page
    end = start + per_page
    publications = query.order_by('-year', '-publication_date')[start:end]

    # Preparar los datos de las publicaciones con sus métricas
    publications_data = []
    for pub in publications:
        # Obtener las métricas específicas
        metrics = {}
        
        # Dimensions citations
        dim_citations = pub.metrics.filter(source='dimensions', metric_type='citations').order_by('-year').first()
        if dim_citations:
            metrics['Dimensions Citations'] = {
                'value': dim_citations.impact_factor,
                'year': dim_citations.year
            }
        
        # WoS citations
        wos_citations = pub.metrics.filter(source='wos', metric_type='citations').order_by('-year').first()
        if wos_citations:
            metrics['WoS Citations'] = {
                'value': wos_citations.impact_factor,
                'year': wos_citations.year
            }
        
        # Scopus citations
        scopus_citations = pub.metrics.filter(source='scopus', metric_type='citations').order_by('-year').first()
        if scopus_citations:
            metrics['Scopus Citations'] = {
                'value': scopus_citations.impact_factor,
                'year': scopus_citations.year
            }
        
        # Dimensions FCR
        dim_fcr = pub.metrics.filter(source='dimensions', metric_type='fcr').order_by('-year').first()
        if dim_fcr:
            metrics['FCR'] = {
                'value': dim_fcr.impact_factor,
                'year': dim_fcr.year
            }
        
        # Dimensions RCR
        dim_rcr = pub.metrics.filter(source='dimensions', metric_type='rcr').order_by('-year').first()
        if dim_rcr:
            metrics['RCR'] = {
                'value': dim_rcr.impact_factor,
                'year': dim_rcr.year
            }

        publications_data.append({
            'id': pub.id,
            'title': pub.title,
            'year': pub.year,
            'publication_type': pub.publication_type[0] if isinstance(pub.publication_type, list) and pub.publication_type else pub.publication_type,
            'metrics': metrics,
            'international_collab': pub.international_collab
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

def get_collaboration_network(request):
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')
    author = request.GET.get('author')

    query = Publication.objects.all()

    if year_from:
        query = query.filter(year__gte=year_from)
    if year_to:
        query = query.filter(year__lte=year_to)
    if areas:
        query = query.filter(thematic_areas__name__in=areas)
    if institutions:
        query = query.filter(institutions__name__in=institutions)
    if types:
        type_query = Q()
        for type in types:
            type_query |= Q(publication_type__icontains=type)
        query = query.filter(type_query)
    if author:
        query = query.filter(authors__name=author)

    publications = query.prefetch_related('authors')
    valid_ids = set(Author.objects.values_list('gesbib_id', flat=True))

    edges = []
    nodes = set()

    for pub in publications:
        ids = [str(a.gesbib_id) for a in pub.authors.all() if str(a.gesbib_id) in valid_ids]
        ids = list(set(ids))
        if len(ids) < 2:
            continue
        pares = combinations(sorted(ids), 2)
        edges.extend(pares)
        nodes.update(ids)

    edge_counts = defaultdict(int)
    for s, t in edges:
        edge_counts[(s, t)] += 1

    edges_data = [{
        'source': s,
        'target': t,
        'weight': w
    } for (s, t), w in edge_counts.items()]

    nodes_data = [{
        'id': nid,
        'label': Author.objects.get(gesbib_id=nid).name,
        'x': random.random(),
        'y': random.random(),
        'is_selected': (nid == author) if author else False
    } for nid in nodes]

    return JsonResponse({
        'nodes': nodes_data,
        'edges': edges_data
    })
