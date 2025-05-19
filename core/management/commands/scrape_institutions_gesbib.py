"""
Django management command to extract institutional data from the GESBIB system 
using Selenium and BeautifulSoup. Extracts hierarchical table headers and full 
record information including IDs and link fields.

Output:
- JSONL file: data/data/json/gesbib_institutions.jsonl
"""

import os
import re
import json
import time
from datetime import datetime
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager


def extract_institute_id(url):
    """
    Extracts the GESBIB institute ID from a URL.

    Args:
        url (str): Link to instituto.html?id=...

    Returns:
        str or None: Extracted ID or None.
    """
    if not url:
        return None
    match = re.search(r'instituto\.html\?id=(\d+)', url)
    return match.group(1) if match else None


def extract_complex_headers(soup):
    """
    Extracts hierarchical column headers from a two-level GESBIB table.

    Args:
        soup (BeautifulSoup): Parsed HTML content.

    Returns:
        list: Combined header labels (e.g., 'Section - Subsection').
    """
    thead = soup.select_one("#mainForm\\:dataTable_head")
    rows = thead.find_all("tr")
    grid = []
    col_fill = []

    # Step 1: capture raw header rows with rowspan/colspan
    for r in rows:
        cells = r.find_all(["th", "td"])
        row = []
        for c in cells:
            cell_text = c.get_text(strip=True)
            rowspan = int(c.get("rowspan", "1"))
            colspan = int(c.get("colspan", "1"))
            row.append({
                "text": cell_text,
                "rowspan": rowspan,
                "colspan": colspan
            })
        grid.append(row)

    result = []

    # Step 2: expand header cells to grid form
    for row in grid:
        result_row = []
        col_idx = 0
        while len(result_row) < max(len(col_fill), len(row)):
            if len(col_fill) <= col_idx:
                col_fill.append(0)
            if col_fill[col_idx] > 0:
                result_row.append(None)
                col_fill[col_idx] -= 1
                col_idx += 1
            else:
                break

        for cell in row:
            while col_idx < len(col_fill) and col_fill[col_idx] > 0:
                result_row.append(None)
                col_fill[col_idx] -= 1
                col_idx += 1

            for _ in range(cell["colspan"]):
                result_row.append(cell["text"])
                if cell["rowspan"] > 1:
                    col_fill.insert(col_idx, cell["rowspan"] - 1)
                else:
                    col_fill.insert(col_idx, 0)
                col_idx += 1

        result.append(result_row)

    # Step 3: merge labels into final headers
    num_columns = len(result[-1])
    headers = []

    for col_idx in range(num_columns):
        col_header = []
        for row in result:
            if col_idx < len(row) and row[col_idx]:
                col_header.append(row[col_idx])
        headers.append(" - ".join(col_header))

    headers.append("Colab. Internac.")  # Manually appended if needed
    return headers


class Command(BaseCommand):
    help = 'Extrae todos los autores de GesBIB con enlaces y campos completos'

    def add_arguments(self, parser):
        parser.add_argument('--user', type=str, required=True, help='Usuario CSIC')
        parser.add_argument('--password', type=str, required=True, help='Contraseña CSIC')

    def handle(self, *args, **options):
        self.stdout.write('Iniciando el scraping de instituciones de GesBIB...')

        output_path = 'data/data/json/gesbib_institutions.jsonl'

        chrome_options = Options()
        # chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

        try:
            url = 'https://apps.csic.es/gesbib/adv/listadoInstitutos.html'
            driver.get(url)

            # Login
            driver.find_element(By.ID, "username").clear()
            driver.find_element(By.ID, "username").send_keys(options['user'])
            driver.find_element(By.ID, "password").clear()
            driver.find_element(By.ID, "password").send_keys(options['password'])
            driver.find_element(By.CSS_SELECTOR, "form#auth-login button[type='submit']").click()

            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            self.stdout.write(self.style.SUCCESS("✅ Login exitoso."))

            soup = BeautifulSoup(driver.page_source, 'html.parser')

            # Extract complex headers using BeautifulSoup
            headers = extract_complex_headers(soup)
            print(f'Headers: {headers}')

            rows = soup.select("#mainForm\\:dataTable_data tr")
            page_data = []

            for row in rows:
                cells = row.find_all("td")
                row_info = {}

                for idx, cell in enumerate(cells):
                    links = cell.find_all('a')
                    text = cell.get_text(strip=True)
                    hrefs = [a['href'] for a in links if a.has_attr('href')]
                    row_info[headers[idx] if idx < len(headers) else "Colab. Internac."] = {
                        "text": text,
                        "links": hrefs
                    }

                institute_link = row.find("a", href=re.compile(r'instituto\.html\?id='))
                institute_id = extract_institute_id(institute_link['href']) if institute_link else None
                row_info["id_instituto_gesbib"] = institute_id

                page_data.append(row_info)

            with open(output_path, 'a', encoding='utf-8') as f:
                for row in page_data:
                    f.write(json.dumps(row, ensure_ascii=False) + '\n')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error durante el scraping: {str(e)}'))

        finally:
            self.stdout.write(self.style.SUCCESS(f'Datos guardados en: {output_path}'))
            driver.quit()