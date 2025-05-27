from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('about/', views.about, name='about'),
    path('api/dashboard/filters/', views.get_filter_data, name='get_filter_data'),
    path('api/dashboard/data/', views.get_filtered_data, name='get_filtered_data'),
] 