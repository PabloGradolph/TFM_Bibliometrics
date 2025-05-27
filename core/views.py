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
        query = query.filter(publication_type__in=types)

    # Obtener datos para las visualizaciones
    timeline_data = list(query.values('year').annotate(count=Count('id')).order_by('year'))
    areas_data = list(query.values('thematic_areas__name').annotate(count=Count('id')).order_by('-count'))
    institutions_data = list(query.values('institutions__name').annotate(count=Count('id')).order_by('-count'))
    types_data = list(query.values('publication_type').annotate(count=Count('id')).order_by('-count'))

    return JsonResponse({
        'timeline': timeline_data,
        'areas': areas_data,
        'institutions': institutions_data,
        'types': types_data
    })
