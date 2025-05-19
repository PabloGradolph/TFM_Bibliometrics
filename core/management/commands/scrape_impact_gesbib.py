"""
Django management command to extract publication impact data from GesBIB 
using Selenium. This command performs login, applies filters (e.g., IPBLN), 
activates all checkboxes for metrics, and paginates through the dataset 
while extracting structured text and links.

Outputs:
- JSONL files with impact data.
- Logs progress per page and prints final count. 
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
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager


def extract_text_and_links(cell):
    """
    Extracts plain text and hyperlinks from a BeautifulSoup cell.

    Args:
        cell (Tag): HTML <td> cell.

    Returns:
        dict: { "text": ..., "links": [...] }
    """
    text = cell.get_text(strip=True)
    links = [a['href'] for a in cell.find_all('a', href=True)]
    return {"text": text, "links": links}


def extract_id_from_url(url):
    """
    Extracts publication ID from a URL pattern.

    Args:
        url (str): URL containing "item.html?id=...".

    Returns:
        str or None: Extracted ID or None if not found.
    """
    if not url:
        return None
    match = re.search(r'item\.html\?id=(\d+)', url)
    return match.group(1) if match else None


def count_existing_rows():
    """
    Counts the total number of lines across all impact_part*.jsonl files.

    Returns:
        int: Total number of saved records.
    """
    total = 0
    for i in range(1, 7):
        path = f"data/data/json/impact_part{i}.jsonl"
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                total += sum(1 for _ in f)
    return total


def get_output_file():
    """
    Determines the output file based on current number of rows.

    Returns:
        str: Path to the correct output .jsonl file.
    """
    total = count_existing_rows()
    part = (total // 100000) + 1
    part = min(part, 6)  # limit to 6 parts
    return f"data/data/json/impact_part{part}.jsonl"


class Command(BaseCommand):
    help = 'Extrae información de impacto de publicaciones desde GesBIB'

    def add_arguments(self, parser):
        parser.add_argument('--user', type=str, required=True, help='Usuario CSIC')
        parser.add_argument('--password', type=str, required=True, help='Contraseña CSIC')

    def handle(self, *args, **options):
        self.stdout.write('Iniciando scraping de impacto de publicaciones...')

        chrome_options = Options()
        # chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

        try:
            url = 'https://apps.csic.es/gesbib/adv/impactoItems.html'
            driver.get(url)

            total_rows = count_existing_rows()
            page = total_rows // 100 + 1
            self.stdout.write(f"Continuando desde la página {page} (aprox {total_rows} publicaciones guardadas).")

            # Login
            driver.find_element(By.ID, "username").send_keys(options['user'])
            driver.find_element(By.ID, "password").send_keys(options['password'])
            driver.find_element(By.CSS_SELECTOR, "form#auth-login button[type='submit']").click()

            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "mainForm")))
            self.stdout.write("✅ Login exitoso.")

            # Activate all checkboxes
            for i in range(881, 887):
                checkbox = driver.find_element(By.ID, f"mainForm:j_idt{i}")
                checkbox.click()
                time.sleep(1.5)

            # Seleccionar 100 resultados por página
            select = Select(WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "mainForm:dataTable_rppDD"))
            ))
            select.select_by_value("100")
            time.sleep(6)

            for _ in range(page - 1):
                try:
                    next_btn = driver.find_element(By.CSS_SELECTOR, ".ui-paginator-next")
                    driver.execute_script("arguments[0].click();", next_btn)
                    time.sleep(5)
                except:
                    print(f"❌ Error al retroceder: {e}")
                    break

            while True:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "mainForm:dataTable_data"))
                )
                soup = BeautifulSoup(driver.page_source, 'html.parser')

                # Extract multi-level headers
                header_rows = soup.select("#mainForm\\:dataTable_head tr")
                first_row_ths = header_rows[0].find_all("th")
                second_row_ths = header_rows[1].find_all("th") if len(header_rows) > 1 else []

                headers = []
                second_idx = 0

                for th in first_row_ths:
                    main_label = th.find("span", class_="ui-column-title")
                    main_text = main_label.get_text(strip=True) if main_label else "Col"
                    colspan = int(th.get("colspan", 1))
                    rowspan = int(th.get("rowspan", 1))

                    if rowspan == 2 or colspan == 1:
                        headers.append(main_text)
                    else:
                        for _ in range(colspan):
                            if second_idx < len(second_row_ths):
                                sub_label = second_row_ths[second_idx].find("span", class_="ui-column-title")
                                sub_text = sub_label.get_text(strip=True) if sub_label else f"Sub_{second_idx}"
                                headers.append(f"{main_text} - {sub_text}")
                                second_idx += 1

                rows = soup.select("#mainForm\\:dataTable_data tr")
                data = []

                for row in rows:
                    cells = row.find_all("td")
                    row_info = {}

                    for idx, cell in enumerate(cells):
                        key = headers[idx] if idx < len(headers) else f"col_{idx}"
                        row_info[key] = extract_text_and_links(cell)

                    pub_link = row.find("a", href=re.compile(r'item\.html\?id='))
                    pub_id = extract_id_from_url(pub_link['href']) if pub_link else None
                    row_info["id_publicacion"] = pub_id

                    data.append(row_info)

                output_file = get_output_file()
                with open(output_file, 'a', encoding='utf-8') as f:
                    for row in data:
                        f.write(json.dumps(row, ensure_ascii=False) + '\n')

                with open(output_file, 'r', encoding='utf-8') as f:
                    counter = sum(1 for _ in f)
                    print(f"Total de filas guardadas: {counter}")

                self.stdout.write(f"✅ Página {page} guardada en {output_file}.")
                page += 1

                try:
                    next_btn = driver.find_element(By.CSS_SELECTOR, ".ui-paginator-next")
                    if "ui-state-disabled" in next_btn.get_attribute("class"):
                        break
                    driver.execute_script("arguments[0].click();", next_btn)
                    time.sleep(5)
                except NoSuchElementException:
                    break

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Error en página {page}: {e}"))

        finally:
            driver.quit()
            self.stdout.write("✅ Scraping finalizado.")
