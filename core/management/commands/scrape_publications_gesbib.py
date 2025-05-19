"""
Django management command to extract structured publication data from GesBIB
using Selenium. Extracts fields including links and derived IDs (item, source, authors),
and saves them in JSONL format. Supports paginated extraction and optional filters (e.g., IPBLN).

Output:
- JSONL file (up to 6 parts): data/data/gesbib_items_partX.jsonl
- Log file: data/data/scraping_errors.log
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


def log_error(page, exception):
    """
    Logs any exception during scraping into a timestamped logfile.

    Args:
        page (int): Page number.
        exception (Exception): Exception raised.
    """
    with open('data/data/scraping_errors.log', 'a', encoding='utf-8') as f:
        f.write(f"[{datetime.now().isoformat()}] ❌ Error en página {page}: {str(exception)}\n")


def extract_text_and_links(cell):
    """
    Extracts visible text and any hyperlinks from a table cell.

    Args:
        cell (Tag): HTML cell.

    Returns:
        dict: { "text": str, "links": list }
    """
    text = cell.get_text(strip=True)
    links = [a['href'] for a in cell.find_all('a', href=True)]
    return {"text": text, "links": links}


def extract_id_from_url(url, tipo):
    """
    Extracts an identifier from a URL depending on its type.

    Args:
        url (str): Full hyperlink string.
        tipo (str): One of 'item', 'revista', or 'autor'.

    Returns:
        str | list | None: Extracted ID or list of IDs (if autor).
    """
    if not url:
        return None
    if tipo == "item":
        match = re.search(r'item\.html\?id=(\d+)', url)
    elif tipo == "revista":
        match = re.search(r'revista\.html\?id=(\d+)', url)
    elif tipo == "autor":
        match = re.findall(r'autor\.html\?id=(\d+)', url)
        return match if match else None
    return match.group(1) if match else None


def count_existing_rows():
    """
    Counts total saved rows across all parts of the output.

    Returns:
        int: Number of records already saved.
    """
    total = 0
    for i in range(1, 7):
        path = f"data/data/json/gesbib_items_part{i}.jsonl"
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                total += sum(1 for _ in f)
    return total


def get_output_file():
    """
    Determines the output file path based on current data volume.

    Returns:
        str: File path to append new data.
    """
    total = count_existing_rows()
    part = (total // 100000) + 1
    part = min(part, 6)
    return f"data/data/json/gesbib_items_part{part}.jsonl"


def saltar_a_pagina(driver, objetivo):
    """
    Navigates through paginated GesBIB tables to reach a specific page.

    Args:
        driver (webdriver): Selenium driver.
        objetivo (int): Target page number.
    """
    umbral = 2940
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "mainForm:dataTable_data"))
    )

    if objetivo > umbral:
        try:
            last_button = driver.find_element(By.CSS_SELECTOR, ".ui-paginator-last")
            driver.execute_script("arguments[0].click();", last_button)
            time.sleep(3)
        except:
            print("❌ No se pudo acceder a la última página")
            return

        while True:
            time.sleep(3)
            paginas = driver.find_elements(By.CSS_SELECTOR, ".ui-paginator-page")
            visibles = [int(p.text) for p in paginas if p.text.isdigit()]
            if not visibles:
                break
            if objetivo in visibles:
                for p in paginas:
                    if p.text == str(objetivo):
                        driver.execute_script("arguments[0].click();", p)
                        return
            else:
                primera = min(visibles)
                if primera > objetivo:
                    for p in paginas:
                        if p.text == str(primera):
                            driver.execute_script("arguments[0].click();", p)
                            time.sleep(3)
                            break
                else:
                    break
    else:
        while True:
            time.sleep(3)
            paginas = driver.find_elements(By.CSS_SELECTOR, ".ui-paginator-page")
            visibles = [int(p.text) for p in paginas if p.text.isdigit()]
            if not visibles:
                break
            if objetivo in visibles:
                for p in paginas:
                    if p.text == str(objetivo):
                        driver.execute_script("arguments[0].click();", p)
                        return
            else:
                ultima = max(visibles)
                if ultima < objetivo:
                    for p in paginas:
                        if p.text == str(ultima):
                            driver.execute_script("arguments[0].click();", p)
                            time.sleep(3)
                            break
                else:
                    break


class Command(BaseCommand):
    help = 'Extrae información de impacto de publicaciones desde GesBIB'

    def add_arguments(self, parser):
        parser.add_argument('--user', type=str, required=True, help='Usuario CSIC')
        parser.add_argument('--password', type=str, required=True, help='Contraseña CSIC')

    def handle(self, *args, **options):
        self.stdout.write('Iniciando el proceso de scraping de publicaciones de GesBIB...')

        chrome_options = Options()
        # chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')

        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

        try:
            url = 'https://apps.csic.es/gesbib/adv/items.html'
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

            # Código para sacar sólo publicaciones del IPBLN
            # page = 1
            # accordion_header = WebDriverWait(driver, 10).until(
            #     EC.element_to_be_clickable((By.XPATH, "//h3[contains(text(), 'Autor / Instituto')]"))
            # )
            # accordion_header.click()
            # time.sleep(10)
            # WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "mainForm:filtro:j_idt388_input")))
            # input_field = driver.find_element(By.ID, "mainForm:filtro:j_idt388_input")
            # input_field.clear()
            # input_field.send_keys("IPBLN")
            # time.sleep(3)
            # input_field.send_keys(Keys.RETURN)
            # time.sleep(3)
            # apply_button = driver.find_element(By.ID, "mainForm:smtBtn")
            # apply_button.click()
            # WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "mainForm:dataTable")))
            # self.stdout.write("✅ Filtro aplicado correctamente (IPBLN).")
            # time.sleep(5)

            # Select 100 results per page
            select = Select(WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "mainForm:dataTable_rppDD"))
            ))
            select.select_by_value("100")
            time.sleep(5)

            saltar_a_pagina(driver, page)
            self.stdout.write(f"✅ Avanzando a la página {page}.")

            while True:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "mainForm:dataTable_data"))
                )
                soup = BeautifulSoup(driver.page_source, 'html.parser')

                headers = [th.text.strip() for th in soup.select("#mainForm\\:dataTable thead tr th span")]
                headers = [i for i in headers if i != '']
                headers.append('')

                page_data = []

                for row in soup.select("#mainForm\\:dataTable_data tr"):
                    cells = row.find_all("td")
                    row_info = {}

                    for idx, cell in enumerate(cells):
                        text = cell.get_text(strip=True)
                        links = [a['href'] for a in cell.find_all('a') if a.has_attr('href')]

                        if headers[idx] == "Autores filiac. CSIC":
                            text_clean = re.sub(r"\[.*?\]", "", text).strip()
                            authors = []
                            for a in text_clean.split(";"):
                                a = a.strip()
                                match = re.search(r'[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+.*', a)
                                if match:
                                    authors.append(match.group(0))
                            row_info[headers[idx]] = {
                                'text': "; ".join(authors),
                                'links': links
                            }
                        elif headers[idx] == "":
                            visible_texts = [a.get_text(strip=True) for a in cell.find_all('a')]
                            row_info[headers[idx]] = {
                                'text': "; ".join(visible_texts),
                                'links': links
                            }
                        else:
                            row_info[headers[idx]] = {
                                'text': text,
                                'link': links[0] if links else None
                            }

                    pub_link = row_info.get("Título", {}).get("link")
                    fuente_link = row_info.get("Fuente", {}).get("link")
                    autores_links = row_info.get("Autores filiac. CSIC", {}).get("links", [])

                    ids_gb = {
                        "publicacion": extract_id_from_url(pub_link, "item"),
                        "fuente": extract_id_from_url(fuente_link, "revista"),
                        "autores": extract_id_from_url(";".join(autores_links), "autor")
                    }

                    row_info["ids_gb"] = ids_gb
                    page_data.append(row_info)

                output_file = get_output_file()
                with open(output_file, 'a', encoding='utf-8') as f:
                    for row in page_data:
                        f.write(json.dumps(row, ensure_ascii=False) + '\n')

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
            log_error(page, e)
            self.stdout.write(self.style.ERROR(f"❌ Error en página {page}: {e}"))

        finally:
            driver.quit()
            self.stdout.write("✅ Scraping finalizado.")
