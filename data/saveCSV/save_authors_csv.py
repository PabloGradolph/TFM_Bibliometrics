"""
Script to process a JSONL file containing author data from the GESBIB database
and convert it to a structured CSV. The output CSV includes textual fields and 
links for selected attributes. Empty columns are automatically removed in a 
post-processing step.

Requirements:
- json
- csv
- Python 3.7+
"""

import os
import json
import csv

# Input and output file paths
JSONL_INPUT_PATH = "data/data/IPBLN/json/authors_IPBLN.jsonl"
CSV_OUTPUT_PATH = "data/data/IPBLN/csv/authors_IPBLN_not_cleaned.csv"
CLEANED_CSV_OUTPUT_PATH = "data/data/csv/authors_IPBLN.csv"

# Fields to extract from each author record
FIELDS_TO_EXTRACT = [
    "Nombre", "ID CSIC", "CVN", "Perfil Digital.CSIC", "ORCID", "RID",
    "Scopus ID", "OpenAlexID", "Google Sch.", "Pubs.", "Citas",
    "Indice-H (W/S)", "Internac.", "Instos."
]

def validate_inputs():
    """
    Validates that the input file and expected field structure are correct.
    """
    if not isinstance(FIELDS_TO_EXTRACT, list):
        raise ValueError("FIELDS_TO_EXTRACT must be a list.")
    if not os.path.exists(JSONL_INPUT_PATH):
        raise FileNotFoundError(f"Input file '{JSONL_INPUT_PATH}' does not exist.")

def jsonl_to_csv(input_path, output_path, fields):
    """
    Converts a JSONL file to CSV, extracting specified fields.

    Args:
        input_path (str): Path to the input JSONL file.
        output_path (str): Path to save the structured CSV.
        fields (list): List of field names to extract.

    Returns:
        int: Number of lines processed.
    """
    headers = ["id_autor_gesbib"]
    for field in fields:
        headers.append(field)
        headers.append(f"{field} link")

    line_count = 0

    with open(input_path, 'r', encoding='utf-8') as fin, open(output_path, 'w', newline='', encoding='utf-8') as fout:
        writer = csv.writer(fout)
        writer.writerow(headers)

        for line in fin:
            try:
                author = json.loads(line)
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON line skipped: {line.strip()}")
                continue

            row = [author.get("id_autor_gesbib", "")]
            for field in fields:
                info = author.get(field, {})
                if not isinstance(info, dict):
                    print(f"⚠️ Unexpected structure in field '{field}' for author ID {author.get('id_autor_gesbib', 'unknown')}.")
                    info = {}
                text = info.get("text", "")
                links = info.get("links", [])
                link = links[0] if links else ""
                row.extend([text, link])
            writer.writerow(row)
            line_count += 1

    return line_count

def remove_empty_columns(input_path, output_path):
    """
    Removes columns that are completely empty from a CSV file.

    Args:
        input_path (str): Path to the input CSV file.
        output_path (str): Path to save the cleaned CSV.
    """
    with open(input_path, 'r', encoding='utf-8') as f:
        reader = list(csv.reader(f))
        headers = reader[0]
        rows = reader[1:]

    # Transpose to work column-wise
    columns = list(zip(*rows))
    non_empty_indices = []
    removed_columns = []

    for i, col in enumerate(columns):
        if any(cell.strip() for cell in col):
            non_empty_indices.append(i)
        else:
            removed_columns.append(headers[i])

    # Build filtered output
    filtered_headers = [headers[i] for i in non_empty_indices]
    filtered_rows = [[row[i] for i in non_empty_indices] for row in rows]

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(filtered_headers)
        writer.writerows(filtered_rows)

    if removed_columns:
        print("🧹 Columns removed (completely empty):")
        for col in removed_columns:
            print(f"  - {col}")
    else:
        print("✅ No columns were removed.")

def main():
    """
    Main execution function: validates input, converts JSONL to CSV, and
    removes empty columns from the resulting file.
    """
    validate_inputs()
    line_count = jsonl_to_csv(JSONL_INPUT_PATH, CSV_OUTPUT_PATH, FIELDS_TO_EXTRACT)
    remove_empty_columns(CSV_OUTPUT_PATH, CLEANED_CSV_OUTPUT_PATH)
    print(f"\n📄 Cleaned CSV with {line_count} lines saved to: {CLEANED_CSV_OUTPUT_PATH}")

if __name__ == "__main__":
    main()