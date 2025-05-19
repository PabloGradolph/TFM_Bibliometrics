"""
Script to filter GESBIB author and publication data to isolate those 
associated with the IPBLN institute. It also removes empty columns from 
the author dataset and extracts publication and impact data related to 
IPBLN authors.

Requirements:
- pandas
- Python 3.7+
"""

import pandas as pd

# File paths
AUTHORS_CSV_PATH = 'data/data/csv/gesbib_authors.csv'
OUTPUT_AUTHORS_CSV = 'data/data/IPBLN/csv/authors_IPBLN.csv'
ITEMS_CSV_PATH = 'data/data/csv/gesbib_items.csv'
IMPACT_CSV_PATH = 'data/data/csv/gesbib_impact.csv'
OUTPUT_ITEMS_CSV = 'data/data/IPBLN/csv/items_IPBLN.csv'
OUTPUT_IMPACT_CSV = 'data/data/IPBLN/csv/impact_IPBLN.csv'

def filter_ipbln_authors(input_path, output_path):
    """
    Filters authors whose institution includes 'IPBLN', removes empty columns,
    and saves the result to a new CSV file.

    Args:
        input_path (str): Path to the original author CSV.
        output_path (str): Path to save the filtered author CSV.

    Returns:
        pd.DataFrame: Filtered DataFrame of IPBLN authors.
    """
    df = pd.read_csv(input_path, sep=',')
    df_ipbln = df[df['Instos.'].str.contains('IPBLN', na=False)]

    columns_before = df_ipbln.columns
    df_ipbln = df_ipbln.dropna(axis=1, how='all')
    columns_after = df_ipbln.columns

    removed_columns = set(columns_before) - set(columns_after)
    df_ipbln.to_csv(output_path, index=False)

    print(f"✅ IPBLN authors found: {len(df_ipbln)}")
    print(f"📁 File saved as: {output_path}")
    print(f"🧹 Empty columns removed: {len(removed_columns)}")
    print("🗂️ Removed column names:")
    for col in removed_columns:
        print(f"- {col}")

    return df_ipbln

def has_ipbln_author(id_autores_str, ipbln_ids):
    """
    Checks if any of the author IDs in a publication belong to IPBLN.

    Args:
        id_autores_str (str): Pipe-separated string of author IDs.
        ipbln_ids (set): Set of IPBLN author IDs.

    Returns:
        bool: True if any author belongs to IPBLN, False otherwise.
    """
    if pd.isna(id_autores_str):
        return False
    ids = [x.strip() for x in id_autores_str.split(' | ')]
    return any(author_id in ipbln_ids for author_id in ids)

def filter_ipbln_publications(authors_df, items_path, impact_path, output_items, output_impact):
    """
    Filters publications and impact data related to IPBLN authors and saves results.

    Args:
        authors_df (pd.DataFrame): Filtered DataFrame of IPBLN authors.
        items_path (str): Path to full items CSV file.
        impact_path (str): Path to full impact CSV file.
        output_items (str): Path to save filtered items.
        output_impact (str): Path to save filtered impacts.
    """
    items_df = pd.read_csv(items_path, dtype=str, sep='\t')
    impact_df = pd.read_csv(impact_path, dtype=str, sep='\t')

    ipbln_ids = set(authors_df['id_autor_gesbib'].dropna().astype(str))

    items_ipbln = items_df[items_df['id_autores'].apply(lambda x: has_ipbln_author(x, ipbln_ids))]
    items_ipbln.to_csv(output_items, index=False)

    print(f"📄 Publications with IPBLN authors: {len(items_ipbln)}")
    print(f"✅ Saved to: {output_items}")

    ipbln_pub_ids = items_ipbln['id_publicacion'].dropna().astype(str).tolist()
    impact_ipbln = impact_df[impact_df['id_publicacion'].isin(ipbln_pub_ids)]
    impact_ipbln.to_csv(output_impact, index=False)

    print(f"📊 Impact entries for IPBLN publications: {len(impact_ipbln)}")
    print(f"✅ Saved to: {output_impact}")

def main():
    """
    Main execution function to filter authors, publications, and impact data
    for the IPBLN institute and save the outputs.
    """
    ipbln_authors_df = filter_ipbln_authors(AUTHORS_CSV_PATH, OUTPUT_AUTHORS_CSV)
    filter_ipbln_publications(
        authors_df=ipbln_authors_df,
        items_path=ITEMS_CSV_PATH,
        impact_path=IMPACT_CSV_PATH,
        output_items=OUTPUT_ITEMS_CSV,
        output_impact=OUTPUT_IMPACT_CSV
    )

if __name__ == "__main__":
    main()