"""
Django management command to extract author data from the GesBIB system using Selenium.
The command logs in, paginates through the author listing table, scrapes visible data 
(including text and links), and saves each record as a JSONL entry.

Usage:
    python manage.py <command_name> --user <CSIC_USERNAME> --password <CSIC_PASSWORD>

Output:
    - JSONL file: data/data/json/gesbib_authors.jsonl
    - Log file (errors): data/data/autores_errors.log
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
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager


def extract_id_from_url(url):
    """
    Extracts the GesBIB author ID from a given URL.

    Args:
        url (str): URL string.

    Returns:
        str or None: Extracted ID or None if not found.
    """
    if not url:
        return None
    match = re.search(r'autor\.html\?id=(\d+)', url)
    return match.group(1) if match else None


def log_error(page, exception):
    """
    Logs errors to a file with timestamp and page number.

    Args:
        page (int): Page number where the error occurred.
        exception (Exception): Exception object.
    """
    with open('data/data/autores_errors.log', 'a', encoding='utf-8') as f:
        f.write(f"[{datetime.now().isoformat()}] ❌ Error en página {page}: {str(exception)}\n")


class Command(BaseCommand):
    help = 'Extrae todos los autores de GesBIB con enlaces y campos completos'

    def add_arguments(self, parser):
        parser.add_argument('--user', type=str, required=True, help='Usuario CSIC')
        parser.add_argument('--password', type=str, required=True, help='Contraseña CSIC')

    def handle(self, *args, **options):
        self.stdout.write('Iniciando el scraping de autores de GesBIB...')

        output_path = 'data/data/json/gesbib_authors.jsonl'

        # Determine current page from existing lines
        if os.path.exists(output_path):
            with open(output_path, 'r', encoding='utf-8') as f:
                line_count = sum(1 for _ in f)
            current_page = line_count // 500 + 1
        else:
            current_page = 1

        self.stdout.write(self.style.SUCCESS(f"📄 Retomando desde página {current_page}"))

        chrome_options = Options()
        # chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

        try:
            url = 'https://apps.csic.es/gesbib/adv/listadoAutores.html'
            driver.get(url)

            # Login
            driver.find_element(By.ID, "username").clear()
            driver.find_element(By.ID, "username").send_keys(options['user'])
            driver.find_element(By.ID, "password").clear()
            driver.find_element(By.ID, "password").send_keys(options['password'])
            driver.find_element(By.CSS_SELECTOR, "form#auth-login button[type='submit']").click()

            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            self.stdout.write(self.style.SUCCESS("✅ Login exitoso."))

            # Clear filters
            reset_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "mainForm:resetBtn"))
            )
            driver.execute_script("arguments[0].click();", reset_button)
            time.sleep(2)

            # Select 500 results per page
            select_element = Select(driver.find_element(By.ID, "mainForm:dataTable_rppDD"))
            select_element.select_by_value("500")
            time.sleep(2)

            # Skip to current page
            for _ in range(current_page - 1):
                try:
                    next_btn = driver.find_element(By.CSS_SELECTOR, ".ui-paginator-next")
                    if "ui-state-disabled" in next_btn.get_attribute("class"):
                        break
                    driver.execute_script("arguments[0].click();", next_btn)
                    time.sleep(6)
                except NoSuchElementException:
                    break

            while True:
                time.sleep(4)
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.ID, "mainForm:dataTable_data"))
                )
                soup = BeautifulSoup(driver.page_source, 'html.parser')

                headers = [
                    th.text.strip()
                    for th in soup.select("#mainForm\\:dataTable_head th span.ui-column-title")
                ]

                rows = soup.select("#mainForm\\:dataTable_data tr")
                page_data = []

                for row in rows:
                    cells = row.find_all("td")
                    row_info = {}

                    for idx, cell in enumerate(cells):
                        links = cell.find_all('a')
                        text = cell.get_text(strip=True)
                        hrefs = [a['href'] for a in links if a.has_attr('href')]

                        row_info[headers[idx] if idx < len(headers) else f"col_{idx}"] = {
                            "text": text,
                            "links": hrefs
                        }

                    # Extract GesBIB author ID
                    autor_link = row.find("a", href=re.compile(r'autor\.html\?id='))
                    autor_id = extract_id_from_url(autor_link['href']) if autor_link else None
                    row_info["id_autor_gesbib"] = autor_id

                    page_data.append(row_info)

                with open(output_path, 'a', encoding='utf-8') as f:
                    for row in page_data:
                        f.write(json.dumps(row, ensure_ascii=False) + '\n')

                self.stdout.write(self.style.SUCCESS(f"✅ Página {current_page} guardada."))
                current_page += 1

                try:
                    next_btn = driver.find_element(By.CSS_SELECTOR, ".ui-paginator-next")
                    if "ui-state-disabled" in next_btn.get_attribute("class"):
                        break
                    driver.execute_script("arguments[0].click();", next_btn)
                    time.sleep(8)
                except NoSuchElementException:
                    break

        except Exception as e:
            log_error(current_page, e)
            self.stdout.write(self.style.ERROR(f'❌ Error durante el scraping: {str(e)}'))

        finally:
            driver.quit()