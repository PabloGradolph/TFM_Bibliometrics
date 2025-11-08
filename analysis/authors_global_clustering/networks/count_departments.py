"""Utility script to count nodes per department from conteo.txt.

Reads one or multiple Python dict literals separated by newlines from the file
`conteo.txt` located in the same directory. It produces:
1. Counts per department for each individual dictionary line.
2. Counts per department for unique nodes (joining dictionaries; later entries override earlier ones).
3. Counts per department counting occurrences across all dictionaries (treating them as separate samples).

Run:
    python count_departments.py

Outputs results to console.
"""
from __future__ import annotations
import ast
from collections import Counter
from pathlib import Path

FILE_NAME = "conteo.txt"


def load_dicts(path: Path) -> list[dict[int, str]]:
    """Load one or multiple dict literals from the given file path.

    Each non-empty line containing a Python dictionary literal is parsed safely
    using ast.literal_eval.
    """
    dicts: list[dict[int, str]] = []
    text = path.read_text(encoding="utf-8").strip()
    # Split by newline boundaries that separate dict literals.
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("{") and line.endswith("}"):
            try:
                parsed = ast.literal_eval(line)
            except Exception as e:  # noqa: BLE001
                raise ValueError(f"Failed to parse line as dict: {line[:80]}... Error: {e}") from e
            if not isinstance(parsed, dict):
                raise ValueError("Parsed object is not a dict")
            dicts.append(parsed)
    return dicts


def count_per_dict(dicts: list[dict[int, str]]) -> list[Counter]:
    """Return a list of Counter objects, one per dictionary of departments."""
    return [Counter(d.values()) for d in dicts]


def count_unique(dicts: list[dict[int, str]]) -> Counter:
    """Count departments after merging dictionaries by unique node id.

    Later dictionaries override earlier assignments for the same node id.
    """
    merged: dict[int, str] = {}
    for d in dicts:
        merged.update(d)
    return Counter(merged.values())


def count_occurrences(dicts: list[dict[int, str]]) -> Counter:
    """Count departments treating each dictionary as independent (sum occurrences)."""
    total = Counter()
    for d in dicts:
        total.update(d.values())
    return total


def main() -> None:
    """Main execution: load dictionaries and print counting summaries."""
    path = Path(__file__).with_name(FILE_NAME)
    dicts = load_dicts(path)
    if not dicts:
        print("No dictionaries found.")
        return

    print(f"Found {len(dicts)} dictionary line(s).\n")

    per_dict = count_per_dict(dicts)
    for idx, counter in enumerate(per_dict, start=1):
        total_nodes = sum(counter.values())
        print(f"[Dictionary {idx}] Total nodes: {total_nodes}")
        for dept, cnt in counter.most_common():
            print(f"  {dept}: {cnt}")
        print()

    unique_counter = count_unique(dicts)
    unique_total = sum(unique_counter.values())
    print("[Unique nodes after merge]")
    print(f"Total unique nodes: {unique_total}")
    for dept, cnt in unique_counter.most_common():
        print(f"  {dept}: {cnt}")
    print()

    occurrence_counter = count_occurrences(dicts)
    occurrence_total = sum(occurrence_counter.values())
    print("[Occurrences across all dictionaries]")
    print(f"Total occurrences (sum of lengths): {occurrence_total}")
    for dept, cnt in occurrence_counter.most_common():
        print(f"  {dept}: {cnt}")


if __name__ == "__main__":
    main()
