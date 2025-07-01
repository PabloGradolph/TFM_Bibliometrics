"""
Script to convert GESBIB publication metadata from JSONL format into a 
structured TSV file. It extracts relevant textual and linked data for each 
publication, formats fields consistently, and validates the final TSV using pandas.

Requirements:
- json
- csv
- pandas
- Python 3.7+
"""

import json
import csv
import pandas as pd

# Output TSV path
OUTPUT_FILE = 'data/data/IPBLN/csv/items_only_IPBLN.csv'

# Fieldnames for output TSV
FIELDNAMES = [
    'id', 'Año', 'AA link', 'Título', 'Título link', 'Tipo',
    'Fuente', 'Fuente link', 'Editorial', 'Editorial link',
    'Colab. internac.', 'Citas', 'Autores filiac. CSIC',
    'Autores filiac. CSIC link', 'Extra', 'Extra link',
    'id_publicacion', 'id_fuente', 'id_autores'
]

def clean_text(value):
    """
    Cleans string fields: replaces problematic characters.

    Args:
        value (str or any): Input value.

    Returns:
        str: Cleaned string.
    """
    if isinstance(value, str):
        return value.replace('"', "'").replace('\n', ' ').replace('\t', ' ').replace('\r', ' ').strip()
    return str(value) if value is not None else ''

def join_if_list(value):
    """
    Converts a list into a pipe-separated string, or cleans single strings.

    Args:
        value (list or str): Input value.

    Returns:
        str: Cleaned string.
    """
    if isinstance(value, list):
        return ' | '.join(clean_text(item) for item in value)
    return clean_text(value or '')

def parse_publication_jsonl(input_path, output_path):
    """
    Parses publication records from a JSONL file and saves them as TSV.

    Args:
        input_path (str): Path to the JSONL file.
        output_path (str): Path to the output TSV file.
    """
    rows = []
    counter = 0

    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            counter += 1
            data = json.loads(line.strip())
            row = {
                'id': counter,
                'Año': clean_text(data.get('Año', {}).get('text', '')),
                'AA link': clean_text(data.get('AA', {}).get('link', '')),
                'Título': clean_text(data.get('Título', {}).get('text', '')),
                'Título link': clean_text(data.get('Título', {}).get('link', '')),
                'Tipo': clean_text(data.get('Tipo', {}).get('text', '')),
                'Fuente': clean_text(data.get('Fuente', {}).get('text', '')),
                'Fuente link': clean_text(data.get('Fuente', {}).get('link', '')),
                'Editorial': clean_text(data.get('Editorial', {}).get('text', '')),
                'Editorial link': clean_text(data.get('Editorial', {}).get('link', '')),
                'Colab. internac.': clean_text(data.get('Colab. internac.', {}).get('text', '')),
                'Citas': clean_text(data.get('Citas', {}).get('text', '')),
                'Autores filiac. CSIC': clean_text(data.get('Autores filiac. CSIC', {}).get('text', '')),
                'Autores filiac. CSIC link': join_if_list(data.get('Autores filiac. CSIC', {}).get('links', [])),
                'Extra': clean_text(data.get('', {}).get('text', '')),
                'Extra link': join_if_list(data.get('', {}).get('links', [])),
                'id_publicacion': clean_text(data.get('ids_gb', {}).get('publicacion', '')),
                'id_fuente': clean_text(data.get('ids_gb', {}).get('fuente', '')),
                'id_autores': join_if_list(data.get('ids_gb', {}).get('autores', []))
            }

            # Ensure all fields exist and are strings
            for key in FIELDNAMES:
                row[key] = clean_text(row.get(key, ''))

            rows.append(row)
        return rows
    
def save_to_tsv(rows, output_path):
    """
    Saves the parsed rows to a TSV file.
    Args:
        rows (list): List of dictionaries representing rows.
        output_path (str): Path to the output TSV file.
    """
    with open(output_path, 'w', encoding='utf-8', newline='') as fout:
        writer = csv.DictWriter(
            fout,
            fieldnames=FIELDNAMES,
            delimiter='\t',
            quoting=csv.QUOTE_ALL,
            quotechar='"',
            escapechar='\\'
        )
        writer.writeheader()
        writer.writerows(rows)

def validate_tsv(file_path):
    """
    Loads and prints basic stats from the generated TSV using pandas.

    Args:
        file_path (str): Path to the TSV file.
    """
    try:
        df = pd.read_csv(file_path, sep='\t', dtype=str)
        print()
        print(f"📂 File: {file_path}")
        print(f"✅ File loaded successfully.")
        print(f"🧾 Rows: {len(df)}")
        print(f"🧱 Columns: {df.shape[1]}")
        print(f"📌 Headers: {list(df.columns)}")
    except pd.errors.ParserError as e:
        print("❌ Error while parsing TSV:")
        print(e)

def main():
    """
    Main execution function.
    """
    input_files = ["data/data/IPBLN/json/items_only_IPBLN.jsonl"]
    data = []
    for input_file in input_files:
        data.extend(parse_publication_jsonl(input_file, OUTPUT_FILE))
    
    save_to_tsv(data, OUTPUT_FILE)
    print(f"✅ TSV file saved to {OUTPUT_FILE}")
    validate_tsv(OUTPUT_FILE)

if __name__ == "__main__":
    main()