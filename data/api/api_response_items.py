"""
Script to retrieve metadata for a set of scientific publications from the 
GESBIB API (CSIC), using publication IDs extracted from a CSV file. The 
retrieved data is saved in a JSON file for further analysis or database insertion.

Requirements:
- requests
- pandas
- Python 3.7+
"""

import os
import time
import json
import requests
import pandas as pd
from dotenv import load_dotenv

# API Token and base URL
load_dotenv()
TOKEN = os.getenv("MY_API_KEY")
BASE_API_URL = f'https://apps.csic.es/gesbib/rest/{TOKEN}/1/items/id/'

# HTTP headers for requests
HEADERS = {
    "Accept": "application/json"
}

# Input and output paths
INPUT_CSV_PATH = 'data/data/IPBLN/csv/items_only_IPBLN.csv'
OUTPUT_JSON_PATH = 'data/data/IPBLN/json/items_only_ipbln_info.json'

def read_publication_ids(csv_path):
    """
    Reads publication IDs from a tab-separated CSV file and removes NaNs.

    Args:
        csv_path (str): Path to the CSV file.

    Returns:
        list: A list of unique publication IDs (str).
    """
    df = pd.read_csv(csv_path, dtype=str, sep='\t')
    return df['id_publicacion'].dropna().unique().tolist()

def fetch_publication_data(publication_id):
    """
    Makes a GET request to the GESBIB API to retrieve data for a specific publication.

    Args:
        publication_id (str): Publication ID from GESBIB.

    Returns:
        dict: Parsed JSON response or error message.
    """
    url = f"{BASE_API_URL}{publication_id}/"
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as error:
        return {"error": str(error)}

def save_to_json(data, output_path):
    """
    Saves the collected publication data to a JSON file.

    Args:
        data (dict): Dictionary with publication data.
        output_path (str): File path to save the JSON output.
    """
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

def main():
    """
    Main function to coordinate reading publication IDs, fetching data,
    and saving the results to disk.
    """
    publication_ids = read_publication_ids(INPUT_CSV_PATH)
    total = len(publication_ids)
    publication_data = {}

    for index, pub_id in enumerate(publication_ids, start=1):
        data = fetch_publication_data(pub_id)
        publication_data[pub_id] = data
        status = "✅" if "error" not in data else "❌"
        print(f"[{index}/{total}] {status} Publication {pub_id}")
        time.sleep(0.2)  # API rate limiting

    save_to_json(publication_data, OUTPUT_JSON_PATH)
    print(f"\n📦 Data saved to {OUTPUT_JSON_PATH}")

if __name__ == "__main__":
    main()
