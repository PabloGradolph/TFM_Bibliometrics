"""Utility helpers to build collaboration network artifacts for exports."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Literal

import networkx as nx
from django.conf import settings

from bibliodata.models import Author, Collaboration

NetworkScope = Literal['ips', 'full']


def normalise_scope(scope: str | None) -> NetworkScope:
    """Clamp the received scope to one of the supported values."""
    if scope == 'full':
        return 'full'
    return 'ips'


def _node_attributes(author: Author, scope_value: NetworkScope, fallback_label: str) -> dict[str, str]:
    """Return consistent node attributes depending on the selected scope."""

    if scope_value == 'full':
        department = getattr(author, 'department_global', None) or getattr(author, 'department', None)
        leiden = getattr(author, 'leiden_community_global', None) or getattr(author, 'leiden_community', None)
        lovaina = getattr(author, 'lovaina_community_global', None) or getattr(author, 'lovaina_community', None)
    else:
        department = getattr(author, 'department', None) or getattr(author, 'department_global', None)
        leiden = getattr(author, 'leiden_community', None) or getattr(author, 'leiden_community_global', None)
        lovaina = getattr(author, 'lovaina_community', None) or getattr(author, 'lovaina_community_global', None)

    leiden = str(leiden).strip() if leiden not in (None, '', 'Unknown') else '0'
    lovaina = str(lovaina).strip() if lovaina not in (None, '', 'Unknown') else '0'

    return {
        'label': author.name or fallback_label,
        'department': department or 'Unknown',
        'leiden_community': leiden,
        'lovaina_community': lovaina,
    }


def build_collaboration_graph(scope: str | None) -> nx.Graph:
    """Create either the full researcher network or the IP-only network graph."""
    scope_value = normalise_scope(scope)
    graph = nx.Graph()

    if scope_value == 'full':
        collaborations = Collaboration.objects.select_related('author', 'collaborator')
        for collab in collaborations:
            author = getattr(collab, 'author', None)
            collaborator = getattr(collab, 'collaborator', None)
            if not author or not collaborator:
                continue
            author_id = str(getattr(author, 'gesbib_id', '')).strip()
            collaborator_id = str(getattr(collaborator, 'gesbib_id', '')).strip()
            if not author_id or not collaborator_id:
                continue
            if not graph.has_node(author_id):
                graph.add_node(author_id, **_node_attributes(author, scope_value, author_id))
            if not graph.has_node(collaborator_id):
                graph.add_node(collaborator_id, **_node_attributes(collaborator, scope_value, collaborator_id))
            weight = collab.publication_count or 1
            if graph.has_edge(author_id, collaborator_id):
                graph[author_id][collaborator_id]['weight'] += weight
            else:
                graph.add_edge(author_id, collaborator_id, weight=weight)
        return graph

    nodes_path = Path(settings.BASE_DIR) / "analysis" / "data" / "networks" / "lab_nodes.csv"
    edges_path = Path(settings.BASE_DIR) / "analysis" / "data" / "networks" / "lab_edges.csv"
    name_lookup: dict[str, str] = {}

    if nodes_path.exists():
        with nodes_path.open(encoding='utf-8') as nodes_file:
            for row in csv.DictReader(nodes_file):
                name = (row.get('Id') or '').strip()
                if not name:
                    continue
                try:
                    author = Author.objects.get(name__iexact=name)
                except Author.DoesNotExist:
                    continue
                author_id = str(getattr(author, 'gesbib_id', '')).strip()
                if not author_id:
                    continue
                graph.add_node(author_id, **_node_attributes(author, scope_value, author_id))
                name_lookup[name.lower()] = author_id

    if edges_path.exists() and name_lookup:
        with edges_path.open(encoding='utf-8') as edges_file:
            for row in csv.DictReader(edges_file):
                source_name = (row.get('Source') or '').strip().lower()
                target_name = (row.get('Target') or '').strip().lower()
                if not source_name or not target_name:
                    continue
                source_id = name_lookup.get(source_name)
                target_id = name_lookup.get(target_name)
                if not source_id or not target_id:
                    continue
                try:
                    weight = int(row.get('Weight') or 1)
                except (TypeError, ValueError):
                    weight = 1
                if graph.has_edge(source_id, target_id):
                    graph[source_id][target_id]['weight'] += weight
                else:
                    graph.add_edge(source_id, target_id, weight=weight)

    return graph
