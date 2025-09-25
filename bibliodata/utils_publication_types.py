import re
import unicodedata

# Canonical GesBIB vocabulary (para informes)
CANON_TYPES = [
    "artículo",
    "artículo de revisión",
    "bibliografía",
    "capítulo de libro",
    "carta",
    "comunicación de congreso",
    "editorial",
    "libro",
    "nota",
    "reseña",
    "reseña de libro",
    "otro",
    "conferencias y seminarios",
    "publicación retractada",
    "corrigenda",
]

# PRIORIDAD: subimos "conferencias y seminarios" por encima de "comunicación de congreso"
CANON_PRIORITY = [
    "publicación retractada",
    "corrigenda",
    "reseña de libro",
    "artículo de revisión",
    "carta",
    "editorial",
    "nota",
    "capítulo de libro",
    "libro",
    "conferencias y seminarios",   # <- más alta que la de congreso
    "comunicación de congreso",
    "bibliografía",
    "reseña",
    "artículo",
    "otro",
]

def _strip_accents_lower(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    return s.lower().strip()

# Reglas hechas SOLO con tus tipos reales + ajustes para parecerse a GesBIB
TYPE_RULES = [
    # (si algún día aparecen)
    (r"\b(retract(ed|ion)|retraction notice|retracted publication|publicacion retractada)\b", "publicación retractada"),
    (r"\b(corrigenda|corrigendum|errat(um|a)|correction|addendum)\b", "corrigenda"),

    # Book review -> artículo (para no inflar "editorial" y porque GesBIB no muestra reseña de libro)
    (r"\b(book\s*review)\b", "artículo"),

    # Article review
    (r"\b(review)\b", "artículo de revisión"),
    (r"\bestado de la cuest(i|o)on\.\s*revisi(ó|o)n\b", "artículo de revisión"),
    (r"\bart(í|i)culo de revisi(ó|o)n\b", "artículo de revisión"),

    # Proceedings / congress contributions
    (r"\b(conference\s*paper|proceedings\s*paper|meeting\s*abstract|actas\s*de\s*congres(os|o))\b",
     "comunicación de congreso"),
    (r"\b(comunicaci(ó|o)n de congreso-(poster|oral)(-online)?)\b", "comunicación de congreso"),
    (r"\b(congres(os|o)s y conferencias)\b", "comunicación de congreso"),
    (r"\b(resumen)\b", "comunicación de congreso"),

    # Invited / plenary -> conferencias y seminarios (evento, no paper)
    (r"\b(comunicaci(ó|o)n de congreso-conferencia (invitada|plenaria)(-online)?)\b",
     "conferencias y seminarios"),

    # Chapters
    (r"\b(book chapter|cap(í|i)tulos? de libro|cap(í|i)tulo de libro)\b", "capítulo de libro"),
    (r"\bart(í|i)culo de monograf(í|i)a\b", "capítulo de libro"),

    # Journal articles y afines
    (r"\b(journal article|article|art(í|i)culo(s)?( de revista)?|early access|data paper)\b", "artículo"),
    (r"\bart(í|i)culo de investigaci(ó|o)n\b", "artículo"),
    (r"\bart(í|i)culo de revista\b", "artículo"),
    (r"\bart(í|i)culos\b", "artículo"),
    (r"\barticle\b", "artículo"),

    # Bibliografías -> artículo (GesBIB no las mantiene como tipo)
    (r"\b(bibliograf(í|i)a|bibliography)\b", "artículo"),

    # Editorial / editorial material
    (r"\beditorial material\b", "editorial"),
    (r"\beditorial\b", "editorial"),

    # Informe / texto original -> nota (para que exista esta categoría)
    (r"\binforme\b", "nota"),
    (r"\btexto original\b", "nota"),

    # Otras
    (r"\botra tipolog(í|i)a\b", "artículo"),
]

def normalize_pub_type(raw) -> str:
    """Devuelve UN único tipo canónico por publicación."""
    if not raw:
        return "otro"

    items = raw if isinstance(raw, (list, tuple, set)) else [raw]
    candidates = set()

    for x in items:
        s = _strip_accents_lower(str(x))
        matched = False
        for pattern, canon in TYPE_RULES:
            if re.search(pattern, s):
                candidates.add(canon)
                matched = True
                break
        if not matched:
            candidates.add("otro")

    for label in CANON_PRIORITY:
        if label in candidates:
            return label
    return "otro"
