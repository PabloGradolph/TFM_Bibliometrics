from django import template
from django.utils import translation
from urllib.parse import urlsplit, urlunsplit

register = template.Library()

@register.simple_tag(takes_context=True)
def switch_language_url(context, lang_code):
    """Return current path with another language code, keeping FORCE_SCRIPT_NAME prefix."""
    request = context['request']
    path = request.get_full_path()
    force_script_name = getattr(request, 'script_name', '') or getattr(request, 'FORCE_SCRIPT_NAME', '') or '/BiblioMetrics'
    # Eliminar el prefijo de subruta si está presente
    if path.startswith(force_script_name):
        path = path[len(force_script_name):]
    path = path.lstrip('/')
    parts = path.split('/', 1)
    lang_codes = dict(context.get('LANGUAGES', [('en','English'), ('es','Spanish')]))
    if parts and parts[0] in lang_codes:
        rest = parts[1] if len(parts) > 1 else ''
        new_path = f"{force_script_name}/{lang_code}/{rest}" if rest else f"{force_script_name}/{lang_code}/"
    else:
        new_path = f"{force_script_name}/{lang_code}/{path}" if path else f"{force_script_name}/{lang_code}/"
    return new_path
