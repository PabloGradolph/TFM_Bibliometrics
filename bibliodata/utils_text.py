"""Utility functions to sanitize and normalize text fields.

These helpers fix common mojibake issues (e.g., "GonzÃ¡lez" -> "González"),
normalize unicode dashes to a standard hyphen, and clean JSON-like structures
recursively. They are intended to be used both during ingestion and in
maintenance commands.

All functions follow PEP 8 and include docstrings for clarity.
"""

from __future__ import annotations

from typing import Any, Dict, List, Union
import re


MOJIBAKE_MARKERS = ("Ã", "Â", "�")


def _has_mojibake(s: str) -> bool:
    """Return True if the string contains typical mojibake markers.

    Args:
        s: Input string.

    Returns:
        Boolean indicating if mojibake markers are present.
    """
    return any(ch in s for ch in MOJIBAKE_MARKERS)


def sanitize_text(value: Any) -> Any:
    """Sanitize a single text value, attempting to fix mojibake and dashes.

    - If value is not a string, it's returned as-is.
    - If mojibake markers are detected, attempt a latin1->utf8 roundtrip.
    - Normalize unicode dashes to a simple hyphen ('-').
    - Trim whitespace and collapse internal multi-spaces.

    Args:
        value: Arbitrary value; only strings are modified.

    Returns:
        The sanitized value (string or original type for non-strings).
    """
    if not isinstance(value, str):
        return value

    s = value.strip()
    # Normalize various Unicode dash characters to simple hyphen
    s = re.sub(r"[\u2010\u2011\u2012\u2013\u2014\u2015]", "-", s)

    # Best-effort mojibake repair when typical markers appear
    if _has_mojibake(s):
        try:
            repaired = s.encode("latin1", errors="ignore").decode(
                "utf-8", errors="ignore"
            ).strip()
            if repaired:
                s = repaired
        except Exception:
            # Keep original if repair fails
            pass

    # Remove remaining replacement chars if any (information already lost)
    s = s.replace("�", "")

    # Collapse multiple spaces
    s = re.sub(r"\s+", " ", s)
    return s


def sanitize_mapping(mapping: Dict[str, Any]) -> Dict[str, Any]:
    """Return a sanitized copy of a dict, sanitizing keys and values.

    Args:
        mapping: Input dictionary.

    Returns:
        A new dictionary with sanitized keys and values.
    """
    out: Dict[str, Any] = {}
    for k, v in mapping.items():
        sk = sanitize_text(k)
        out[sk] = sanitize_json(v)
    return out


def sanitize_sequence(seq: List[Any]) -> List[Any]:
    """Return a sanitized copy of a list, sanitizing each element recursively.

    Args:
        seq: Input list.

    Returns:
        A new list with sanitized elements.
    """
    return [sanitize_json(x) for x in seq]


def sanitize_json(obj: Any) -> Any:
    """Recursively sanitize a JSON-like Python structure.

    For dicts: sanitize keys (as strings) and values recursively.
    For lists/tuples: sanitize elements recursively.
    For strings: apply sanitize_text().
    For other types: return unchanged.

    Args:
        obj: Any JSON-like structure (dict/list/str/...)

    Returns:
        A sanitized structure of the same shape.
    """
    if isinstance(obj, dict):
        return sanitize_mapping(obj)
    if isinstance(obj, list):
        return sanitize_sequence(obj)
    if isinstance(obj, tuple):
        return tuple(sanitize_sequence(list(obj)))
    return sanitize_text(obj)
