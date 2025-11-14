"""Utility helpers to build BibTeX entries from Publication instances."""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from typing import Iterable, List

from bibliodata.utils_publication_types import normalize_pub_type

MONTH_TOKENS = {
    "ene": 1,
    "enero": 1,
    "jan": 1,
    "january": 1,
    "feb": 2,
    "febrero": 2,
    "february": 2,
    "mar": 3,
    "marzo": 3,
    "march": 3,
    "abr": 4,
    "abril": 4,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "junio": 6,
    "june": 6,
    "jul": 7,
    "julio": 7,
    "july": 7,
    "ago": 8,
    "agosto": 8,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "septiembre": 9,
    "september": 9,
    "oct": 10,
    "octubre": 10,
    "october": 10,
    "nov": 11,
    "noviembre": 11,
    "november": 11,
    "dic": 12,
    "diciembre": 12,
    "dec": 12,
    "december": 12,
}

BIBTEX_TYPE_MAP = {
    "artículo": "article",
    "artículo de revisión": "article",
    "bibliografía": "article",
    "carta": "article",
    "editorial": "article",
    "nota": "article",
    "reseña": "article",
    "reseña de libro": "article",
    "publicación retractada": "article",
    "corrigenda": "article",
    "capítulo de libro": "incollection",
    "libro": "book",
    "comunicación de congreso": "inproceedings",
    "conferencias y seminarios": "inproceedings",
    "otro": "misc",
}

DEFAULT_BIBTEX_TYPE = "misc"


def build_bibtex_entry(publication) -> str:
    """Return a BibTeX entry string for the given ``Publication`` instance."""

    entry_type = _guess_bibtex_type(publication)
    key = f"pub{publication.id}"
    fields = OrderedDict()

    _set_field(fields, "author", _format_author_field(publication))
    _set_field(fields, "title", publication.title)
    _apply_type_specific_fields(entry_type, publication, fields)
    _set_field(fields, "year", str(publication.year) if publication.year else None)
    _set_field(fields, "month", _extract_month(publication.publication_date))
    _set_field(fields, "publisher", publication.editorial)
    _set_field(fields, "doi", _first_scalar(publication.doi))
    _set_field(fields, "url", _preferred_url(publication))
    _set_field(fields, "abstract", getattr(publication, "abstract", None))
    _set_field(fields, "keywords", _format_keywords(publication.keywords_all))
    _set_field(fields, "issn", _first_scalar(getattr(publication, "issns", None)))
    _set_field(fields, "isbn", _first_scalar(getattr(publication, "isbn", None)))

    lines = [f"@{entry_type}{{{key},"]
    for name, value in fields.items():
        lines.append(f"  {name} = {{{_bibtex_escape(value)}}},")
    if len(lines) > 1:
        lines[-1] = lines[-1].rstrip(",")
    lines.append("}\n")
    return "\n".join(lines)


def _apply_type_specific_fields(entry_type: str, publication, fields: OrderedDict) -> None:
    """Attach journal/booktitle fields based on the resolved BibTeX type."""

    if entry_type == "article":
        _set_field(fields, "journal", publication.source)
    elif entry_type == "book":
        _set_field(fields, "series", publication.source)
    elif entry_type == "incollection":
        booktitle = publication.source or publication.conference_name
        _set_field(fields, "booktitle", booktitle)
    elif entry_type == "inproceedings":
        booktitle = publication.conference_name or publication.source
        _set_field(fields, "booktitle", booktitle)


def _guess_bibtex_type(publication) -> str:
    """Resolve the BibTeX entry type from normalized/publication types."""

    normalized = publication.normalized_types
    if isinstance(normalized, list) and normalized:
        canon = str(normalized[0]).strip().lower()
    elif isinstance(normalized, str) and normalized:
        canon = normalized.strip().lower()
    else:
        raw_type = publication.publication_type
        canon = normalize_pub_type(raw_type) if raw_type else "otro"
        canon = canon.lower()

    return BIBTEX_TYPE_MAP.get(canon, DEFAULT_BIBTEX_TYPE)


def _format_author_field(publication) -> str:
    """Combine DB authors and ``other_authors`` into a BibTeX-ready string."""

    names: List[str] = [a.name for a in publication.authors.all() if a.name]
    names.extend(_normalize_other_authors(getattr(publication, "other_authors", None)))
    unique = []
    seen = set()
    for name in names:
        clean = name.strip()
        if not clean or clean in seen:
            continue
        unique.append(clean)
        seen.add(clean)
    return " and ".join(unique)


def _normalize_other_authors(raw) -> Iterable[str]:
    """Yield cleaned author names from ``other_authors`` regardless of format."""

    if not raw:
        return []

    if isinstance(raw, (list, tuple, set)):
        return [str(item).strip() for item in raw if str(item).strip()]

    text = str(raw).strip()
    if not text:
        return []

    try:
        parsed = json.loads(text)
        if isinstance(parsed, (list, tuple)):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass

    if ";" in text:
        return [part.strip() for part in text.split(";") if part.strip()]
    return [text]


def _first_scalar(value) -> str:
    """Return the first non-empty scalar string from a list/str/None input."""

    if not value:
        return ""
    if isinstance(value, (list, tuple, set)):
        for item in value:
            if item:
                return str(item).strip()
        return ""
    if isinstance(value, str):
        text = value.strip()
        if text.startswith("["):
            try:
                parsed = json.loads(text)
                return _first_scalar(parsed)
            except json.JSONDecodeError:
                return text
        return text
    return str(value).strip()


def _preferred_url(publication) -> str:
    """Return the best available URL for BibTeX (AA, title, DOI, extra_links)."""

    aa_link = _first_scalar(getattr(publication, "aa_link", None))
    if aa_link and not aa_link.strip().lower().startswith("item"):
        return aa_link

    title_link = (getattr(publication, "title_link", "") or "").strip()
    if title_link:
        if title_link.lower().startswith("item"):
            doi_url = _doi_to_url(_first_scalar(publication.doi))
            if doi_url:
                return doi_url
        else:
            return title_link

    doi_url = _doi_to_url(_first_scalar(publication.doi))
    if doi_url:
        return doi_url

    extra_url = _first_scalar(getattr(publication, "extra_links", None))
    return extra_url or ""


def _doi_to_url(doi_value: str) -> str:
    """Normalize DOI strings to https://doi.org/<doi> URLs."""

    if not doi_value:
        return ""
    text = str(doi_value).strip()
    if not text:
        return ""
    lowered = text.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return text
    cleaned = re.sub(r"^(doi:|https?://doi\.org/)", "", text, flags=re.IGNORECASE).strip()
    if not cleaned:
        return ""
    return f"https://doi.org/{cleaned}"


def _format_keywords(raw) -> str:
    """Join keyword sequences into a comma-separated string."""

    if not raw:
        return ""
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return ""
        if text.startswith("["):
            try:
                parsed = json.loads(text)
                return _format_keywords(parsed)
            except json.JSONDecodeError:
                pass
        return text
    if isinstance(raw, (list, tuple, set)):
        parts = [str(item).strip() for item in raw if str(item).strip()]
        return ", ".join(parts)
    return str(raw).strip()


def _extract_month(value) -> str:
    """Extract a BibTeX month token from ``publication_date`` values."""

    if not value:
        return ""
    text = str(value).strip()
    if not text:
        return ""

    lowered = text.lower()
    for token, month_num in MONTH_TOKENS.items():
        if token in lowered:
            return str(month_num)

    tokens = re.split(r"[\s/\\-]+", lowered)
    for token in tokens:
        if token.isdigit():
            num = int(token)
            if 1 <= num <= 12:
                return str(num)
    return ""


def _set_field(fields: OrderedDict, name: str, value: str | None) -> None:
    """Insert a field into the ordered map if ``value`` is non-empty."""

    if value:
        fields[name] = value


def _bibtex_escape(value: str) -> str:
    """Escape problematic characters for BibTeX outputs."""

    if not value:
        return ""
    return str(value).replace("{", "\\{").replace("}", "\\}").replace("\"", '\\"')
