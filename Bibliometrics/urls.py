"""
URL configuration for Bibliometrics project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.conf.urls.i18n import i18n_patterns

urlpatterns = [
    path('admin/', admin.site.urls),
    path('i18n/', include('django.conf.urls.i18n')),  # URLs para el cambio de idioma
    path('accounts/', include('accounts.urls', namespace='accounts')),
]

# URLs con prefijo de idioma
urlpatterns += i18n_patterns(
    path('', include('core.urls')),  # Ajusta esto según tus URLs principales
    path('data/', include('data.urls')),  # Añadido para incluir las URLs de data
    prefix_default_language=True,  # Mostrar el prefijo para todos los idiomas
)

# Servir archivos estáticos en desarrollo
def strip_script_prefix(url: str) -> str:
    """Return a URL path without the FORCE_SCRIPT_NAME prefix for internal routing."""

    script_name = (settings.FORCE_SCRIPT_NAME or '').rstrip('/')
    if script_name and url.startswith(script_name):
        url = url[len(script_name):]
    return url


if settings.DEBUG:
    static_url = strip_script_prefix(settings.STATIC_URL)
    media_url = strip_script_prefix(settings.MEDIA_URL)
    urlpatterns += static(static_url, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += static(media_url, document_root=settings.MEDIA_ROOT)
