from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from bibliodata.models import Publication, Author, Collaboration
from django.db.models import Count, Min, Max, Q, F
import random
import networkx as nx
import csv
import random
from django.http import JsonResponse
from bibliodata.models import Author  # Para mapear nombres
import math
from django.db.models import Max as DBMax, Min as DBMin

# Create your views here.

def home(request):
    return render(request, 'core/home.html')

def dashboard(request):
    return render(request, 'core/dashboard.html')

def about(request):
    return render(request, 'core/about.html')

def get_filter_data(request):
    # Obtener los parámetros de filtrado
    year_from = request.GET.get('year_from')
    year_to = request.GET.get('year_to')
    areas = request.GET.getlist('areas')
    institutions = request.GET.getlist('institutions')
    types = request.GET.getlist('types')
    author = request.GET.get('author')

    # Construir el query base sin aplicar los filtros de área, institución y tipo aún
    base_query = Publication.objects.all()

    # Aplicar filtros de año y autor al query base
    if year_from:
        base_query = base_query.filter(year__gte=year_from)
    if year_to:
        base_query = base_query.filter(year__lte=year_to)
    if author:
        base_query = base_query.filter(authors__name=author)

    # Obtener años disponibles con conteo de publicaciones (basado en query completamente filtrado para años)
    # Note: Years query should still consider all filters including areas/institutions/types
    # This part might need clarification depending on desired year filter interaction
    # For now, let's keep it based on the final 'query' object as before for simplicity, or revisit if needed.
    # Let's rebuild the main query to include areas/institutions/types for counting years.
    query_with_all_filters = base_query
    if areas:
        query_with_all_filters = query_with_all_filters.filter(thematic_areas__name__in=areas)
    if institutions:
        query_with_all_filters = query_with_all_filters.filter(institutions__name__in=institutions)
    if types:
        type_query = Q()
        for type_item in types:
            # Para SQLite, necesitamos buscar el string dentro del JSON
            type_query |= Q(publication_type__icontains=type_item)
        query_with_all_filters = query_with_all_filters.filter(type_query)

    years = query_with_all_filters.values('year').annotate(count=Count('id', distinct=True)).order_by('year')

    # --- Obtener áreas temáticas con conteo ---
    # Count based on base_query (filtered by year/author) + other filters (institutions, types) but NOT areas
    areas_query = base_query
    if institutions:
        areas_query = areas_query.filter(institutions__name__in=institutions)
    if types:
        type_query = Q()
        for type_item in types:
            type_query |= Q(publication_type__icontains=type_item)
        areas_query = areas_query.filter(type_query)

    # Use aggregation to get counts for areas
    areas_with_counts = areas_query.values('thematic_areas__name')\
        .annotate(name=F('thematic_areas__name'), count=Count('id', distinct=True))\
        .filter(count__gt=0, thematic_areas__name__isnull=False)\
        .order_by('-count', 'name')

    # --- Obtener instituciones con conteo ---
    # Count based on base_query (filtered by year/author) + other filters (areas, types) but NOT institutions
    institutions_query = base_query
    if areas:
        institutions_query = institutions_query.filter(thematic_areas__name__in=areas)
    if types:
        type_query = Q()
        for type_item in types:
            # Para SQLite, necesitamos buscar el string dentro del JSON
            type_query |= Q(publication_type__icontains=type_item)
        institutions_query = institutions_query.filter(type_query)

    # Use aggregation to get counts for institutions
    institutions_with_counts = institutions_query.values('institutions__name')\
        .annotate(name=F('institutions__name'), count=Count('id', distinct=True))\
        .filter(count__gt=0, institutions__name__isnull=False)\
        .order_by('-count', 'name')

    # --- Obtener tipos de publicación con conteo ---
    # Contar tipos individuales de publicaciones que cumplen los filtros aplicados (excepto tipo)
    publications_for_type_counting = base_query
    if areas:
        publications_for_type_counting = publications_for_type_counting.filter(thematic_areas__name__in=areas)
    if institutions:
        publications_for_type_counting = publications_for_type_counting.filter(institutions__name__in=institutions)

    # Recopilar todos los tipos individuales y contarlos
    type_counts = {}
    for pub in publications_for_type_counting.only('publication_type'): # Usamos .only() para optimizar la consulta
        if isinstance(pub.publication_type, list):
            for pub_type in pub.publication_type:
                if pub_type:
                    # Normalizar un poco (ej. remover espacios extra, minúsculas)
                    clean_type = pub_type.strip()
                    if clean_type:
                         type_counts[clean_type] = type_counts.get(clean_type, 0) + 1
        elif pub.publication_type: # Manejar caso donde no es lista pero tiene valor
             clean_type = str(pub.publication_type).strip()
             if clean_type:
                  type_counts[clean_type] = type_counts.get(clean_type, 0) + 1

    # Convertir el diccionario de conteos a la lista de objetos esperada por el frontend
    types_with_counts = [{'publication_type': name, 'count': count} for name, count in type_counts.items()]
    # Ordenar por conteo (descendente) y luego por nombre (ascendente)
    types_with_counts.sort(key=lambda x: (-x['count'], x['publication_type']))

    # --- Filtrar tipos que empiezan con "comunicación" ---
    # Esto se hace aquí después del conteo pero antes de devolver la respuesta
    filtered_types_with_counts = [
        item for item in types_with_counts
        if not item['publication_type'].lower().startswith('comunicación')
    ]

    filtered_types_with_counts = [
        item for item in filtered_types_with_counts
        if not item['publication_type'].lower().startswith('capítulo de')
    ]

    filtered_types_with_counts = [
        item for item in filtered_types_with_counts
        if not item['publication_type'].lower() == "artículo"
    ]

    return JsonResponse({
        'years': list(years),
        'areas': list(areas_with_counts),
        'institutions': list(institutions_with_counts),
        'publication_types': filtered_types_with_counts
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
        filtered_ids = [
            pub.id for pub in query
            if pub.publication_type and any(
                t.lower() in str(pub_type).lower()
                for pub_type in pub.publication_type
                for t in types
            )
        ]
        query = Publication.objects.filter(id__in=filtered_ids)
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
        year_counts = query.values('year').annotate(count=Count('id', distinct=True)).order_by('year')
        
        # Actualizar el diccionario con los conteos reales
        for item in year_counts:
            timeline_data[item['year']] = item['count']
        
        # Convertir a lista de objetos para el JSON
        timeline_data = [{'year': year, 'count': count} for year, count in timeline_data.items()]
        timeline_info = None

    # Procesar áreas temáticas para el gráfico circular
    areas_data = list(query.values('thematic_areas__name').annotate(count=Count('id', distinct=True)).order_by('-count'))
    
    # Procesar para mostrar top 10 + Otros
    if len(areas_data) > 14:
        top_15_areas = areas_data[:14]
        other_areas = areas_data[14:]
        other_count = sum(area['count'] for area in other_areas)
        areas_data = top_15_areas + [{'thematic_areas__name': 'Otras', 'count': other_count}]
    
    institutions_data = list(query.values('institutions__name').annotate(count=Count('id', distinct=True)).order_by('-count'))
    types_data = list(query.values('publication_type').annotate(count=Count('id', distinct=True)).order_by('-count'))

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
        count=Count('publications', distinct=True)
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
    }
    
    return render(request, 'core/publication_detail.html', context)


# Mapeo entre clave y función de ordenación
def get_metric_value(pub, key):
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

    sort_by = request.GET.get('sort_by')
    sort_order = request.GET.get('sort_order', 'desc')

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

    # Obtener todas las publicaciones filtradas
    publications = list(query)
    
    # Aplicar ordenación si se especifica
    if sort_by:
        publications.sort(key=lambda pub: get_metric_value(pub, sort_by), reverse=(sort_order == 'desc'))
    else:
        # Ordenación por defecto por año y fecha de publicación
        publications.sort(key=lambda pub: (pub.year or 0, pub.publication_date or ''), reverse=True)

    # Paginar manualmente
    total_publications = len(publications)
    total_pages = (total_publications + per_page - 1) // per_page
    start = (page - 1) * per_page
    end = start + per_page
    publications = publications[start:end]

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
    try:
        community_view = request.GET.get('communityView', 'department')
        clustering_model = request.GET.get('clusteringModel')
        n_clusters = request.GET.get('nClusters')
        auto_mode = request.GET.get('autoMode') == 'true'
        global_mode = request.GET.get('globalMode') == 'true'
        selected_author_name = request.GET.get('author')
        full_network = request.GET.get('fullNetwork') == 'true'

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

                return JsonResponse({'nodes': nodes, 'edges': edges, 'is_author_view': True})
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
            nodes_path = "analysis/data/networks/lab_nodes.csv"
            edges_path = "analysis/data/networks/lab_edges.csv"

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
                                combined_score = 0.8 * norm_silhouette + 0.1 * norm_calinski + 0.1 * norm_davies
                                
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
