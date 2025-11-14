"""Utility helpers to build RIS entries from Publication instances."""

from __future__ import annotations

from typing import List

from core.utils_bibtex import (
    collect_author_names,
    extract_month_number,
    first_scalar,
    format_keywords,
    preferred_url,
    resolve_reference_type,
)


RIS_TYPE_MAP = {
    "article": "JOUR",
    "book": "BOOK",
    "incollection": "CHAP",
    "inproceedings": "CPAPER",
    "misc": "GEN",
}

DEFAULT_RIS_TYPE = "GEN"


def build_ris_entry(publication) -> str:
    """Return a RIS entry string for the given ``Publication`` instance."""

    bib_type = resolve_reference_type(publication)
    ris_type = RIS_TYPE_MAP.get(bib_type, DEFAULT_RIS_TYPE)

    lines: List[str] = [f"TY  - {ris_type}", f"ID  - pub{publication.id}"]

    for author in collect_author_names(publication):
        lines.append(f"AU  - {author}")

    if publication.title:
        lines.append(f"TI  - {publication.title}")

    if publication.year:
        lines.append(f"PY  - {publication.year}")
    month = extract_month_number(publication.publication_date)
    if publication.year and month:
        lines.append(f"DA  - {publication.year}/{month.zfill(2)}")

    _apply_type_specific_fields_ris(bib_type, publication, lines)

    doi = first_scalar(publication.doi)
    if doi:
        lines.append(f"DO  - {doi}")

    url = preferred_url(publication)
    if url:
        lines.append(f"UR  - {url}")

    if publication.abstract:
        lines.append(f"AB  - {publication.abstract}")

    for keyword in _keyword_list(publication.keywords_all):
        lines.append(f"KW  - {keyword}")

    lines.append("ER  - ")
    return "\n".join(lines) + "\n"


def _apply_type_specific_fields_ris(entry_type: str, publication, lines: List[str]) -> None:
    """Append RIS-specific fields based on the resolved entry type."""

    source = getattr(publication, "source", None)
    conference_name = getattr(publication, "conference_name", None)
    conference_location = getattr(publication, "conference_location", None)
    publisher = getattr(publication, "editorial", None)
    issn = first_scalar(getattr(publication, "issns", None))
    isbn = first_scalar(getattr(publication, "isbn", None))

    if entry_type == "article":
        if source:
            lines.append(f"JO  - {source}")
        if issn:
            lines.append(f"SN  - {issn}")
    elif entry_type == "book":
        if source:
            lines.append(f"T2  - {source}")
        if publisher:
            lines.append(f"PB  - {publisher}")
        if isbn:
            lines.append(f"SN  - {isbn}")
    elif entry_type == "incollection":
        booktitle = source or conference_name
        if booktitle:
            lines.append(f"T2  - {booktitle}")
        if publisher:
            lines.append(f"PB  - {publisher}")
        if isbn or issn:
            lines.append(f"SN  - {isbn or issn}")
    elif entry_type == "inproceedings":
        proceedings = conference_name or source
        if proceedings:
            lines.append(f"T2  - {proceedings}")
        if conference_location:
            lines.append(f"CY  - {conference_location}")
        if issn or isbn:
            lines.append(f"SN  - {issn or isbn}")
    else:
        if source:
            lines.append(f"T2  - {source}")
        if publisher:
            lines.append(f"PB  - {publisher}")
        if issn or isbn:
            lines.append(f"SN  - {issn or isbn}")


def _keyword_list(raw) -> List[str]:
    """Return keywords as a list for RIS multi-line formatting."""

    formatted = format_keywords(raw)
    if not formatted:
        return []
    return [part.strip() for part in formatted.split(",") if part.strip()]
