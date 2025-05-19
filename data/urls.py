from django.urls import path
from . import views

urlpatterns = [
    path('gestbib_authors/', views.gestbib_authors_view, name='gestbib_authors_view'),
    path('save_authors/', views.save_authors, name='save_authors'),
    path('gestbib_publications/', views.gestbib_publications_view, name='gestbib_publications_view'),
    path('save_publications/', views.save_publications, name='save_publications'),
]
