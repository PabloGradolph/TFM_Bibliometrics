# 📊 Bibliometría IPBLN – TFM

**Desarrollo de una herramienta web interactiva para el análisis de producción científica a partir de datos GESBIB del CSIC**.

Este proyecto forma parte del Trabajo Fin de Máster del Máster en Ciencia de Datos e Ingeniería de Computadores (Universidad de Granada). El objetivo principal es construir una aplicación completa que permita visualizar, analizar y extraer conocimiento relevante sobre la producción científica del CSIC, integrando visualización interactiva, análisis bibliométrico y técnicas de inteligencia artificial.

---

## 🚀 Funcionalidades principales

- 🔍 Exploración por investigador, grupo, área temática o año.
- 📈 Visualización de:
  - Evolución de publicaciones en el tiempo.
  - Redes de colaboración entre autores.
  - Distribución temática por áreas del conocimiento.
  - Métricas de impacto (citas, cuartiles, JCR/SJR/CiteScore).
- 🤖 Procesamiento de lenguaje natural (NLP) para detección de temas y palabras clave.
- 🧠 Agrupamiento temático y análisis de comunidades científicas.
- 📄 Exportación avanzada de informes y datos: PDF, CSV, NDJSON, BibTeX, RIS, redes (GEXF / CSV) y paquete completo ZIP.

---

## 🧱 Tecnologías utilizadas

| Backend      | Frontend       | Visualización  | IA/NLP           | Otros        |
|--------------|----------------|----------------|------------------|--------------|
| Django       | JS + HTML + CSS| D3.js          | spaCy, clustering| SQLite       |
| Python       | Bootstrap      |                | pandas, JSON     | Web Scrapping|

---

## 🗂️ Estructura del proyecto

```bash
📁 App/
├── 📁 Bibliometrics/ # Proyecto principal (settings.py, ...)
├── 📁 bibliodata/ # Modelos de datos (Author, Institution, Publication...)
├── 📁 core/ # Vistas principales: inicio, dashboard, about...
├── 📁 data/ # Scripts de scrapping, carga de datos en db (CSV, JSON) – ignorado por Git por haber datos privados
├── 📁 visualization/ # Visualizaciones interactivas (D3.js principalmente)
├── 📁 analysis/ # Procesamiento temático, clustering, NLP, análisis de los datos...
├── 📁 templates/ # Plantillas HTML con bloques de Django
├── 📁 static/ # Archivos estáticos (CSS, JS, fuentes)
└── manage.py para ejecución de comandos
└── requirements.txt: librerías de python necesarias para el desarrollo
```
---


## ⚙️ Carga de datos

Los datos utilizados en la aplicación provienen de fuentes internas de GESBIB-CSIC, por lo que no están disponibles públicamente. Para cargar los datos, la aplicación incluye comandos personalizados (`load_authors_db`, entre otros) que permiten procesar y almacenar estructuras complejas desde archivos CSV y JSON enriquecidos.

---

## 📄 Licencia y uso

Este repositorio está publicado con fines académicos, de documentación y evaluación del Trabajo Fin de Máster.

🔒 Para su uso, reutilización o despliegue debe contactarse previamente con el autor.  
No se permite su utilización con fines comerciales ni su reproducción sin autorización.

---

## 👤 Autor

[**Pablo Gradolph Oliva**](https://github.com/PabloGradolph)    
Máster en Ciencia de Datos e Ingeniería de Computadores  
Universidad de Granada  
Curso Académico: 2024-2025
