"""
Script to convert GESBIB impact JSONL data into a structured TSV format. 
The script extracts selected fields, formats them properly, handles nested
structures with links, and optionally cleans empty columns using pandas.

Requirements:
- json
- csv
- pandas
- Python 3.7+
"""

import json
import csv
import os
import pandas as pd

# Mapping: JSON keys → base column names in CSV
JSON_TO_CSV_MAP = {
    'Año': 'Año',
    'AA': 'AA link',
    'Titulo': 'Titulo',
    'Calidad fuente': 'Calidad fuente',
    'Citas (mejor)': 'Citas (mejor)',
    'Dimensions - Citas': 'Dimensions - Citas',
    'Dimensions - Citas recientes (2y)': 'Dimensions - Citas recientes (2y)',
    'Dimensions - FCR': 'Dimensions - FCR',
    'Dimensions - RCR': 'Dimensions - RCR',
    'WoS JIF - Fuente': 'WoS JIF - Fuente',
    'WoS JIF - Citas': 'WoS JIF - Citas',
    'WoS JIF - JIF': 'WoS JIF - JIF',
    'WoS JIF - JIF Mejor PCT': 'WoS JIF - JIF Mejor PCT',
    'WoS JIF - JIF Mejor Q': 'WoS JIF - JIF Mejor Q',
    'WoS JIF - JIF Mejor Pos.': 'WoS JIF - JIF Mejor Pos.',
    'WoS JIF - Materias JCR - JIF': 'WoS JIF - Materias JCR - JIF',
    'WoS JIF - Article Influence Score': 'WoS JIF - Article Influence Score',
    'WoS JIF - JCI': 'WoS JIF - JCI',
    'WoS JIF - JCI Mejor PCT': 'WoS JIF - JCI Mejor PCT',
    'WoS JIF - JCI Mejor Q': 'WoS JIF - JCI Mejor Q',
    'WoS JIF - JCI Mejor Pos.': 'WoS JIF - JCI Mejor Pos.',
    'WoS JIF - Materias JCR - JCI': 'WoS JIF - Materias JCR - JCI',
    'WoS JIF - Colab. internac.': 'WoS JIF - Colab. internac.',
    'Scopus - Fuente': 'Scopus - Fuente',
    'Scopus - Citas': 'Scopus - Citas',
    'Scopus - SJR': 'Scopus - SJR',
    'Scopus - SJR Mejor PCT': 'Scopus - SJR Mejor PCT',
    'Scopus - SJR Mejor Q': 'Scopus - SJR Mejor Q',
    'Scopus - SJR Mejor Pos.': 'Scopus - SJR Mejor Pos.',
    'Scopus - Materias SJR': 'Scopus - Materias SJR',
    'Scopus - CiteScore': 'Scopus - CiteScore',
    'Scopus - CiteScore Mejor PCT': 'Scopus - CiteScore Mejor PCT',
    'Scopus - CiteScore Mejor Q': 'Scopus - CiteScore Mejor Q',
    'Scopus - CiteScore Mejor Pos.': 'Scopus - CiteScore Mejor Pos.',
    'Scopus - Materias CiteScore': 'Scopus - Materias CiteScore',
    'Scopus - Colab. internac.': 'Scopus - Colab. internac.'
}

def clean_text(value):
    """
    Cleans raw text by removing problematic characters.

    Args:
        value (str or any): Input value.

    Returns:
        str: Cleaned text.
    """
    if isinstance(value, str):
        return value.replace('"', "'").replace('\n', ' ').replace('\t', ' ').replace('\r', ' ').strip()
    return str(value) if value is not None else ''

def join_if_list(value):
    """
    Converts a list to a pipe-separated string or cleans string values.

    Args:
        value (list or str): Input data.

    Returns:
        str: Cleaned and joined string.
    """
    if isinstance(value, list):
        return ' | '.join(clean_text(item) for item in value)
    return clean_text(value or '')

def convert_jsonl_to_tsv(input_file, field_map):
    """
    Converts a JSONL file to a TSV with structured columns and links.

    Args:
        input_file (str): Path to the input JSONL file.
        field_map (dict): JSON key → base CSV column name.
    """
    rows = []
    counter = 0

    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            counter += 1
            data = json.loads(line.strip())
            row = {'id': counter}
            for json_key, csv_base in field_map.items():
                val = data.get(json_key, {})
                row[csv_base] = clean_text(val.get('text', ''))
                row[f'{csv_base} links'] = join_if_list(val.get('links', []))
            row['id_publicacion'] = clean_text(data.get('id_publicacion', ''))
            rows.append(row)
    return rows

def save_to_tsv(rows, output_file, field_map):
    """
    Saves the processed rows to a TSV file.

    Args:
        rows (list): List of dictionaries representing the rows.
        output_file (str): Path to the output TSV file.
        field_map (dict): JSON key → base CSV column name.
    """
    fieldnames = ['id'] + [col for base in field_map.values() for col in (base, f'{base} links')] + ['id_publicacion']
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames,
            delimiter='\t',
            quoting=csv.QUOTE_ALL,
            quotechar='"',
            escapechar='\\'
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

def clean_empty_columns(input_path, output_path):
    """
    Removes completely empty columns from a TSV file using pandas.

    Args:
        input_path (str): Input TSV file path.
        output_path (str): Output cleaned TSV file path.
    """
    try:
        df = pd.read_csv(input_path, sep='\t', dtype=str)

        # Drop columns with all NaN or all empty strings
        df_clean = df.dropna(axis=1, how='all')
        df_clean = df_clean.loc[:, (df_clean != '').any()]

        df_clean.to_csv(
            output_path,
            index=False,
            sep='\t',
            quoting=csv.QUOTE_ALL,
            quotechar='"',
            escapechar='\\',
            encoding='utf-8'
        )

        print(f"\n🧹 Cleaned file saved to: {output_path}")
        print(f"🧱 Columns after cleaning: {df_clean.shape[1]}")
        print(f"📌 Remaining columns: {list(df_clean.columns)}")
        print(f"🧾 Total rows: {len(df_clean)}")

    except pd.errors.ParserError as error:
        print("❌ Error reading generated TSV:")
        print(error)

def main():
    """
    Main execution function to process impact JSONL data into clean TSV format.
    """
    # input_file = "data/data/IPBLN/json/impact_only_IPBLN.jsonl"
    # raw_output = "data/data/IPBLN/csv/impact_only_IPBLN.csv"
    # clean_output = raw_output.replace(".csv", "_clean.csv")

    input_files = [f"data/data/json/impact_part{i}.jsonl" for i in range(1, 7)]
    raw_output = "data/data/csv/gesbib_impact.csv"
    clean_output = raw_output.replace(".csv", "_clean.csv")

    data = []
    for input_file in input_files:
        if os.path.exists(input_file):
            data.extend(convert_jsonl_to_tsv(input_file, JSON_TO_CSV_MAP))
    save_to_tsv(data, raw_output, JSON_TO_CSV_MAP)
    clean_empty_columns(raw_output, clean_output)
    print(f"📁 File saved as: {clean_output}")

if __name__ == "__main__":
    main()
