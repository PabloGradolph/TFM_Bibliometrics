from django.shortcuts import render
from django.http import JsonResponse
from bibliodata.models import Publication, Institution, ThematicArea
from django.db.models import Count, Min, Max, Q

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
    view_type = request.GET.get('view_type', 'yearly')  # Nuevo parámetro para el tipo de vista

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

    # Obtener datos para las visualizaciones
    if view_type == 'monthly' and year_from and year_to and year_from == year_to:
        # Vista mensual para un año específico
        year = int(year_from)
        timeline_data = []
        
        # Crear un diccionario con todos los meses del año
        months_data = {month: 0 for month in range(1, 13)}
        
        # Obtener los conteos mensuales
        publications = query.filter(year=year)
        for pub in publications:
            if pub.publication_date:
                try:
                    # Intentar extraer el mes de la fecha de publicación
                    month = int(pub.publication_date.split('-')[1])
                    months_data[month] += 1
                except (IndexError, ValueError):
                    # Si no se puede extraer el mes, usar el mes 1 como fallback
                    months_data[1] += 1
        
        # Convertir a lista de objetos para el JSON
        timeline_data = [{'year': year, 'month': month, 'count': count} 
                        for month, count in months_data.items()]
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

    areas_data = list(query.values('thematic_areas__name').annotate(count=Count('id')).order_by('-count'))
    institutions_data = list(query.values('institutions__name').annotate(count=Count('id')).order_by('-count'))
    types_data = list(query.values('publication_type').annotate(count=Count('id')).order_by('-count'))

    return JsonResponse({
        'timeline': timeline_data,
        'areas': areas_data,
        'institutions': institutions_data,
        'types': types_data
    })
