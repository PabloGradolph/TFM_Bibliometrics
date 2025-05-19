"""
Views for managing GESBIB author and publication data within the admin interface.
Only superusers are allowed to access the HTML views. Data is saved to JSON files
via POST requests.

Requirements:
- Django 3.0+
"""

import json
from django.contrib.auth.decorators import user_passes_test
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

# Paths to store data
AUTHORS_JSON_PATH = "data/data/json/authors_data.json"
PUBLICATIONS_JSON_PATH = "data/data/json/publications_data.json"

def admin_required(view_func):
    """
    Decorator to restrict view access to superusers only.

    Args:
        view_func (function): Django view function.

    Returns:
        function: Wrapped view function for superusers only.
    """
    return user_passes_test(lambda u: u.is_superuser)(view_func)

@admin_required
def gestbib_authors_view(request):
    """
    Renders the author management admin page.

    Args:
        request (HttpRequest): Django request object.

    Returns:
        HttpResponse: Rendered HTML page.
    """
    return render(request, 'data/gestbib_authors.html')

@csrf_exempt
def save_authors(request):
    """
    Saves JSON data for authors via POST request.

    Args:
        request (HttpRequest): Django request object.

    Returns:
        JsonResponse: Status response (ok or error).
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            with open(AUTHORS_JSON_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            return JsonResponse({"status": "ok"})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
    return JsonResponse({"error": "Only POST method allowed"}, status=400)

@admin_required
def gestbib_publications_view(request):
    """
    Renders the publication management admin page.

    Args:
        request (HttpRequest): Django request object.

    Returns:
        HttpResponse: Rendered HTML page.
    """
    return render(request, 'data/gestbib_publications.html')

@csrf_exempt
def save_publications(request):
    """
    Saves JSON data for publications via POST request.

    Args:
        request (HttpRequest): Django request object.

    Returns:
        JsonResponse: Status response (ok or error).
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            with open(PUBLICATIONS_JSON_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            return JsonResponse({"status": "ok"})
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
    return JsonResponse({"error": "Only POST method allowed"}, status=400)
