"""
Script to convert institutional metadata from a GESBIB JSONL file into 
a structured CSV format. Extracts selected fields, including links for 
the institution name.

Requirements:
- json
- csv
- Python 3.7+
"""

import json
import csv
import os

# Input and output file paths
INPUT_FILE = "data/data/json/gesbib_institutions.jsonl"
OUTPUT_FILE = "data/data/csv/gesbib_institutions.csv"

# Fields to extract
FIELDS_TO_EXTRACT = [
    "Nombre",
    "Nº Publicaciones - Propias",
    "Nº Publicaciones - Propias + hijos",
    "Nº Publicaciones - WoS (Propias + hijos)",
    "Nº Publicaciones - Scopus (Propias + hijos)",
    "Nº Citas - WoS",
    "Nº Citas - Scopus",
    "Índice-H - WoS",
    "Índice-H - Scopus",
    "Colab. Internac."
]

def generate_headers(fields):
    """
    Generates the list of column headers for the CSV file.

    Args:
        fields (list): List of field names to extract.

    Returns:
        list: CSV header row.
    """
    headers = ["id_instituto_gesbib"]
    for field in fields:
        headers.append(field)
        if field == "Nombre":
            headers.append(f"{field} link")
    return headers

def extract_institution_data(input_path, output_path, fields):
    """
    Reads institutional metadata from JSONL and writes to a structured CSV.

    Args:
        input_path (str): Path to input JSONL file.
        output_path (str): Path to output CSV file.
        fields (list): List of fields to extract.
    """
    headers = generate_headers(fields)
    line_count = 0

    with open(input_path, 'r', encoding='utf-8') as fin, open(output_path, 'w', newline='', encoding='utf-8') as fout:
        writer = csv.writer(fout)
        writer.writerow(headers)

        for line in fin:
            try:
                institution = json.loads(line)
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON line skipped: {line.strip()}")
                continue

            row = [institution.get("id_instituto_gesbib", "")]
            for field in fields:
                info = institution.get(field, {})
                if not isinstance(info, dict):
                    print(f"⚠️ Unexpected structure in field '{field}' for institution ID {institution.get('id_instituto_gesbib', 'unknown')}.")
                    info = {}

                text = info.get("text", "")
                if field == "Nombre":
                    links = info.get("links", [])
                    first_link = links[0] if links else ""
                    row.extend([text, first_link])
                else:
                    row.append(text)

            writer.writerow(row)
            line_count += 1

    print(f"\n✅ Processed {line_count} lines.")
    print(f"📄 CSV file saved to: {output_path}")

def main():
    """
    Main function to extract institution data from GESBIB JSONL to CSV.
    """
    extract_institution_data(INPUT_FILE, OUTPUT_FILE, FIELDS_TO_EXTRACT)

if __name__ == "__main__":
    main()