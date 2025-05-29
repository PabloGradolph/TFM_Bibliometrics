from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('about/', views.about, name='about'),
    path('api/dashboard/filters/', views.get_filter_data, name='get_filter_data'),
    path('api/dashboard/data/', views.get_filtered_data, name='get_filtered_data'),
    path('api/dashboard/publications/', views.get_publications_data, name='get_publications_data'),
    path('api/dashboard/collaboration-network/', views.get_collaboration_network, name='get_collaboration_network'),
    path('api/search/', views.search_publications, name='search_publications'),
    path('api/search/authors/', views.get_author_suggestions, name='get_author_suggestions'),
    path('publication/<int:publication_id>/', views.publication_detail, name='publication_detail'),
] 