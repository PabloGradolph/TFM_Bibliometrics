"""
Script to retrieve author metadata from the GESBIB API (CSIC) based on 
a list of author IDs associated with the IPBLN institute. The results are 
saved in JSON format for later integration into the local database or 
data analysis pipelines.

Requirements:
- requests
- pandas
- Python 3.7+
"""

import os
import requests
import json
import time
import pandas as pd
from dotenv import load_dotenv

# API Token and base URL
load_dotenv()
TOKEN = os.getenv("MY_API_KEY")
BASE_API_URL = f'https://apps.csic.es/gesbib/rest/{TOKEN}/1/autores/id/'

# HTTP headers for requests
HEADERS = {
    "Accept": "application/json"
}

# Input and output file paths
INPUT_CSV_PATH = 'data/data/IPBLN/csv/authors_IPBLN.csv'
OUTPUT_JSON_PATH = 'data/data/IPBLN/json/gesbib_authors_ipbln_info.json'

def read_author_ids(csv_path):
    """
    Reads author IDs from a CSV file and removes NaN values.

    Args:
        csv_path (str): Path to the CSV file.

    Returns:
        list: A list of unique author IDs (str).
    """
    df = pd.read_csv(csv_path, dtype=str)
    return df['id_autor_gesbib'].dropna().unique().tolist()

def fetch_author_data(author_id):
    """
    Makes a GET request to the GESBIB API to retrieve data for a specific author.

    Args:
        author_id (str): GESBIB author ID.

    Returns:
        dict: Parsed JSON response or error message.
    """
    url = f"{BASE_API_URL}{author_id}/"
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as error:
        return {"error": str(error)}

def save_to_json(data, output_path):
    """
    Saves the data dictionary to a JSON file.

    Args:
        data (dict): Dictionary with author data.
        output_path (str): Destination path for the JSON file.
    """
    with open(output_path, 'w', encoding='utf-8') as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

def main():
    """
    Main execution function to coordinate reading, fetching and saving.
    """
    author_ids = read_author_ids(INPUT_CSV_PATH)
    total = len(author_ids)
    author_data = {}

    for index, author_id in enumerate(author_ids, start=1):
        data = fetch_author_data(author_id)
        author_data[author_id] = data
        status = "✅" if "error" not in data else "❌"
        print(f"[{index}/{total}] {status} ID {author_id}")
        time.sleep(0.2)  # Avoid overloading the server

    save_to_json(author_data, OUTPUT_JSON_PATH)
    print(f"\n📦 Data saved to {OUTPUT_JSON_PATH}")

if __name__ == "__main__":
    main()
