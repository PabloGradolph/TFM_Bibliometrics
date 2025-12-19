// filters_search.js
import * as d3 from 'd3';
import Graph from 'graphology';
import Sigma from 'sigma';
import EdgeCurveProgram from "@sigma/edge-curve";
import { setupExportReportButton } from './export_report';
import { initWorldMap, setWorldMapActiveCountries, setWorldMapLoading } from './worldmap.js';
import { initSpainMap, setSpainMapCounts, showSpainLevel, setSpainMapLoading, setSpainMapVisible } from './spainmap.js';
import { detectLangFromPath as detectLangFromPathUtil } from './dashboard/utils.js';
import { initTimelineExporter, updateTimeline as updateTimelineUtil } from './dashboard/timeline.js';
import {
    initAreasExporter,
    renderAreasChart as renderAreasChartUtil,
} from './dashboard/areas.js';

export function initFiltersAndSearch() {

    // Referencias a los elementos del DOM
    const yearFrom = document.getElementById('yearFrom');
    const yearTo = document.getElementById('yearTo');
    const citationsFrom = document.getElementById('citationsFrom');
    const citationsTo = document.getElementById('citationsTo');
    const areaFilter = document.getElementById('areaFilter');
    const institutionFilter = document.getElementById('institutionFilter');
    const typeFilter = document.getElementById('typeFilter');
    // Metric source selector removed (WoS enforced backend)
    const quartileFilter = document.getElementById('quartileFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const selectedAreas = document.getElementById('selectedAreas');
    const selectedInstitutions = document.getElementById('selectedInstitutions');
    const selectedTypes = document.getElementById('selectedTypes');
    const selectedQuartiles = document.getElementById('selectedQuartiles');
    const standardSearch = document.getElementById('standardSearch');
    const standardSearchBtn = document.getElementById('standardSearchBtn');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const selectedAuthor = document.getElementById('selectedAuthor');
    const authorLimitMessage = document.getElementById('authorLimitMessage');
    // Notice card elements ("missing publications")
    const missingPubsNotice = document.getElementById('missingPubsNotice');
    const missingPubsNoticeText = document.getElementById('missingPubsNoticeText');

    // Referencias a elementos del modal de clustering
    const clusteringModel = document.getElementById('clusteringModel');
    const nClusters = document.getElementById('nClusters');
    const nClustersValue = document.getElementById('nClustersValue');
    const nClustersContainer = document.getElementById('nClustersContainer');
    const modelDescription = document.getElementById('modelDescription');
    const applyClusteringBtn = document.getElementById('applyClustering');
    const rangeContainer = document.getElementById('rangeContainer');
    const dbscanOptions = document.getElementById('dbscanOptions');
    const hdbscanOptions = document.getElementById('hdbscanOptions');
    const dbscanClusters = document.getElementById('dbscanClusters');
    const hdbscanClusters = document.getElementById('hdbscanClusters');
    const manualMode = document.getElementById('manualMode');
    const globalBestMode = document.getElementById('globalBestMode');
    const modelManualMode = document.getElementById('modelManualMode');
    const modelAutoMode = document.getElementById('modelAutoMode');
    const manualConfigContainer = document.getElementById('manualConfigContainer');
    const lovainaOptions = document.getElementById('lovainaOptions');

    const lang = window.location.pathname.split('/')[1] === 'es' ? 'es' : 'en';

    // Descripciones de los modelos en español
    const spanishModelDescriptions = {
        'kmeans': 'Agrupa los datos en un número fijo de categorías (clusters) tratando de minimizar la distancia entre los puntos de cada grupo y su centroide, es decir, su "centro". Este método busca particiones compactas y bien separadas, y es especialmente útil cuando los grupos tienen forma redonda o esférica. Es rápido y eficiente, aunque sensible a la elección inicial del número de grupos (k) y a los valores extremos.',
        'agglomerative': 'Construye agrupaciones de forma jerárquica: comienza considerando cada autor como un grupo separado y va fusionando los más similares en pasos sucesivos. El resultado es una estructura en forma de árbol (dendrograma), que permite explorar diferentes niveles de agrupación según la profundidad del corte. Es útil cuando no se conoce el número exacto de grupos y se desea analizar la relación progresiva entre autores.',
        'spectral': 'Transforma la relación entre autores en una red (o grafo) de similitudes y la descompone matemáticamente para encontrar estructuras ocultas. Posteriormente, agrupa los autores en ese nuevo espacio. Es muy útil cuando las agrupaciones no tienen una forma clara o son no convexas, como anillos o cadenas, y aprovecha la conectividad global de los datos.',
        'gmm': 'Parte de la idea de que los datos provienen de una combinación de distribuciones estadísticas llamadas Gaussianas (curvas en forma de campana). En lugar de asignar cada punto a un único cluster, estima la probabilidad de que pertenezca a cada uno. Esto le permite detectar clusters superpuestos o de formas más complejas que los que detecta KMeans, siendo ideal cuando se sospecha que los datos tienen estructuras suaves o ambiguas.',
        'dbscan': 'Identifica grupos basándose en la densidad de los puntos: busca regiones donde los puntos están muy juntos y los separa de las regiones más dispersas. Es especialmente útil cuando los clusters tienen formas arbitrarias y no se conoce el número de grupos a priori. Puede identificar puntos de ruido (outliers) y no requiere especificar el número de clusters.',
        'hdbscan': 'Es una versión jerárquica de DBSCAN que puede encontrar clusters de diferentes densidades. En lugar de usar un único umbral de densidad, construye una jerarquía de clusters y luego selecciona los más significativos. Es robusto a los parámetros y puede encontrar clusters de formas arbitrarias.',
        'lovaina': 'Algoritmo de detección de comunidades que optimiza la modularidad de la red. Funciona de manera iterativa, moviendo nodos entre comunidades para maximizar la modularidad. Es especialmente efectivo para detectar comunidades en redes grandes y puede encontrar comunidades de diferentes tamaños.'
    };

    // Descripciones de los modelos en inglés
    const englishModelDescriptions = {
        'kmeans': 'It groups the data into a fixed number of categories (clusters) trying to minimize the distance between the points of each group and its centroid, that is, its "center". This method looks for compact and well-separated partitions, and is especially useful when the clusters are round or spherical in shape. It is fast and efficient, although sensitive to the initial choice of the number of groups (k) and to extreme values.',
        'agglomerative': 'It builds groupings in a hierarchical way: it starts by considering each author as a separate group and merges the most similar ones in successive steps. The result is a tree-like structure (dendrogram), which allows exploring different levels of grouping according to the depth of the cut. It is useful when the exact number of groups is not known and it is desired to analyze the progressive relationship between authors.',
        'spectral': 'It transforms the relationship between authors into a network (or graph) of similarities and decomposes it mathematically to find hidden structures. It then clusters the authors in this new space. It is very useful when the groupings do not have a clear shape or are non-convex, such as rings or chains, and takes advantage of the global connectivity of the data.',
        'gmm': 'It starts from the idea that the data come from a combination of statistical distributions called Gaussian (bell-shaped curves). Instead of assigning each point to a single cluster, it estimates the probability that it belongs to each cluster. This allows it to detect overlapping or more complex-shaped clusters than KMeans detects, making it ideal when data are suspected of having soft or ambiguous structures.',
        'dbscan': 'Identifies groups based on the density of points: it looks for regions where points are very close together and separates them from more scattered regions. It is especially useful when clusters have arbitrary shapes and the number of groups is not known a priori. It can identify noise points (outliers) and does not require specifying the number of clusters.',
        'hdbscan': 'It is a hierarchical version of DBSCAN that can find clusters of different densities. Instead of using a single density threshold, it builds a hierarchy of clusters and then selects the most significant ones. It is robust to parameters and can find clusters of arbitrary shapes.',
        'lovaina': 'A community detection algorithm that optimizes network modularity. It works iteratively, moving nodes between communities to maximize modularity. It is especially effective for detecting communities in large networks and can find communities of different sizes.'
    };

    // Textos en español
    const spanishTexts = {
        'clusters': 'clusters',
        'bestConfig': 'Mejor Configuración',
        'globalBestConfig': 'Mejor Configuración Global',
        'manualConfig': 'Configuración Manual',
        'numberOfClusters': 'Número de Clusters',
        'clusteringModel': 'Modelo de Clustering',
        'configurationMode': 'Modo de Configuración',
        'apply': 'Aplicar',
        'cancel': 'Cancelar',
        'globalBestDescription': 'Usa la mejor configuración de clustering encontrada entre todos los modelos y parámetros.'
    };

    // Textos en inglés
    const englishTexts = {
        'clusters': 'clusters',
        'bestConfig': 'Best Configuration',
        'globalBestConfig': 'Global Best Configuration',
        'manualConfig': 'Manual Configuration',
        'numberOfClusters': 'Number of Clusters',
        'clusteringModel': 'Clustering Model',
        'configurationMode': 'Configuration Mode',
        'apply': 'Apply',
        'cancel': 'Cancel',
        'globalBestDescription': 'Uses the best clustering configuration found across all models and parameters.'
    };

    // Función para actualizar textos según el idioma
    function updateModalTexts() {
        const texts = currentLang === 'es' ? spanishTexts : englishTexts;
        const modelDescriptions = currentLang === 'es' ? spanishModelDescriptions : englishModelDescriptions;
        
        // Actualizar etiquetas
        const elements = {
            clusteringModelLabel: document.querySelector('label[for="clusteringModel"]'),
            nClustersLabel: document.querySelector('label[for="nClusters"]'),
            manualModeLabel: document.querySelector('label[for="manualMode"]'),
            globalBestModeLabel: document.querySelector('label[for="globalBestMode"]'),
            modelManualModeLabel: document.querySelector('label[for="modelManualMode"]'),
            modelAutoModeLabel: document.querySelector('label[for="modelAutoMode"]'),
            globalBestDescription: document.querySelector('#globalBestMode + .form-text'),
            applyButton: document.getElementById('applyClustering'),
            cancelButton: document.querySelector('.btn-secondary')
        };

        // Actualizar etiquetas solo si existen
        if (elements.clusteringModelLabel) elements.clusteringModelLabel.textContent = texts.clusteringModel;
        if (elements.nClustersLabel) elements.nClustersLabel.textContent = texts.numberOfClusters;
        if (elements.manualModeLabel) elements.manualModeLabel.textContent = texts.manualConfig;
        if (elements.globalBestModeLabel) elements.globalBestModeLabel.textContent = texts.globalBestConfig;
        if (elements.modelManualModeLabel) elements.modelManualModeLabel.textContent = texts.manualConfig;
        if (elements.modelAutoModeLabel) elements.modelAutoModeLabel.textContent = texts.bestConfig;
        if (elements.globalBestDescription) elements.globalBestDescription.textContent = texts.globalBestDescription;
        
        // Actualizar botones
        if (elements.applyButton) elements.applyButton.textContent = texts.apply;
        if (elements.cancelButton) elements.cancelButton.textContent = texts.cancel;

        // Actualizar opciones de clusters
        if (dbscanClusters) {
            Array.from(dbscanClusters.options).forEach(option => {
                option.text = `${option.value} ${texts.clusters}`;
            });
        }
        if (hdbscanClusters) {
            Array.from(hdbscanClusters.options).forEach(option => {
                option.text = `${option.value} ${texts.clusters}`;
            });
        }

        // Actualizar descripción del modelo actual (delegado a función central)
        updateModelDescription();
    }

    // Función central para actualizar la descripción del modelo según selección e idioma
    function updateModelDescription() {
        if (!clusteringModel || !modelDescription) return;
        const langDetected = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.split('/')[1] === 'es' ? 'es' : 'en');
        const modelDescriptionsDict = langDetected === 'es' ? spanishModelDescriptions : englishModelDescriptions;
        modelDescription.textContent = modelDescriptionsDict[clusteringModel.value] || '';
    }

    // Event listeners para el modal de clustering
    if (clusteringModel && modelDescription) {
        // Inicializar al cargar
        updateModelDescription();
        clusteringModel.addEventListener('change', function() {
            updateModelDescription();
            const selectedModel = this.value;
            // Mostrar/ocultar opciones específicas según el modelo
            if (selectedModel === 'dbscan') {
                rangeContainer.classList.add('d-none');
                dbscanOptions.classList.remove('d-none');
                hdbscanOptions.classList.add('d-none');
                lovainaOptions.classList.add('d-none');
            } else if (selectedModel === 'hdbscan') {
                rangeContainer.classList.add('d-none');
                dbscanOptions.classList.add('d-none');
                hdbscanOptions.classList.remove('d-none');
                lovainaOptions.classList.add('d-none');
            } else if (selectedModel === 'lovaina') {
                rangeContainer.classList.add('d-none');
                dbscanOptions.classList.add('d-none');
                hdbscanOptions.classList.add('d-none');
                lovainaOptions.classList.remove('d-none');
            } else {
                rangeContainer.classList.remove('d-none');
                dbscanOptions.classList.add('d-none');
                hdbscanOptions.classList.add('d-none');
                lovainaOptions.classList.add('d-none');
            }
        });
    }

    // Event listener para el modo de configuración global
    if (manualMode && globalBestMode && manualConfigContainer) {
        // Estado inicial: seleccionar Mejor Configuración Global
        globalBestMode.checked = true;
        manualMode.checked = false;
        manualConfigContainer.classList.add('d-none');

        manualMode.addEventListener('change', function() {
            if (this.checked) {
                manualConfigContainer.classList.remove('d-none');
            }
        });

        globalBestMode.addEventListener('change', function() {
            if (this.checked) {
                manualConfigContainer.classList.add('d-none');
            }
        });
    }

    // Event listener para el modo de configuración del modelo
    if (modelManualMode && modelAutoMode && nClustersContainer) {
        modelManualMode.addEventListener('change', function() {
            if (this.checked) {
                nClustersContainer.classList.remove('d-none');
            }
        });

        modelAutoMode.addEventListener('change', function() {
            if (this.checked) {
                nClustersContainer.classList.add('d-none');
            }
        });
    }

    if (nClusters && nClustersValue) {
        nClusters.addEventListener('input', function() {
            nClustersValue.textContent = this.value;
        });
    }

    // Actualizar textos cuando se abre el modal
    const clusteringModal = document.getElementById('clusteringModal');
    if (clusteringModal) {
        clusteringModal.addEventListener('show.bs.modal', function() {
            updateModalTexts();
            // Reafirmar estado inicial cada vez que se abre el modal
            if (globalBestMode && manualMode && manualConfigContainer) {
                if (!globalBestMode.checked && !manualMode.checked) {
                    globalBestMode.checked = true;
                }
                if (globalBestMode.checked) {
                    manualConfigContainer.classList.add('d-none');
                }
            }
        });
    }

    // Modificar el event listener existente para el dropdown de vista de comunidad
    document.querySelectorAll('.dropdown-item.network-community-view').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();

            const selectedView = this.dataset.communityView;

            if (selectedView === 'keywords') {
                // Mostrar el modal de clustering
                const modal = new bootstrap.Modal(document.getElementById('clusteringModal'));
                modal.show();
                return;
            }

            // Si ya es la vista actual, no hacer nada
            if (window.currentCommunityView === selectedView) {
                document.querySelectorAll('.dropdown-item.network-community-view').forEach(link => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
                return;
            }

            window.currentCommunityView = selectedView;

            document.querySelectorAll('.dropdown-item.network-community-view').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');
            
            updateCommunityDropdownText();
            updateVisualizations();
        });
    });

    // Almacenar las selecciones
    let selectedAreasList = new Set();
    let selectedInstitutionsList = new Set();
    let selectedTypesList = new Set();
    let selectedQuartilesList = new Set();
    // metric source removed; always WoS
    let selectedAuthorName = null;

    // Exponer en window para export_report.js
    window.selectedAreasList = selectedAreasList;
    window.selectedInstitutionsList = selectedInstitutionsList;
    window.selectedTypesList = selectedTypesList;
    window.selectedQuartilesList = selectedQuartilesList;
    window.selectedMetricSource = 'wos';
    window.selectedAuthorName = selectedAuthorName;

    // Helper: show/hide the "missing publications" notice
    function setMissingPubsNoticeVisible(visible) {
        if (!missingPubsNotice || !missingPubsNoticeText) return;
        if (visible) {
            const lang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/es/') ? 'es' : 'en');
            const concienciaURL = 'https://apps3.csic.es/contcien/';
            const contactEmail = 'bioinformatica@ipbln.csic.es';
            const textEs = `¿No encuentras una de tus publicaciones? Asegúrate de tenerla registrada en <a href="${concienciaURL}" target="_blank" rel="noopener">Conciencia</a>. Si ya la tienes publicada allí y sigues sin verla aquí, espera a que actualicemos nuestro sistema. Si tienes prisa, puedes contactar con la Unidad de Bioinformática del IPBLN en <a href="mailto:${contactEmail}">${contactEmail}</a> para solicitar una actualización prioritaria.`;
            const textEn = `Can't find one of your publications? Make sure it is registered in <a href="${concienciaURL}" target="_blank" rel="noopener">Conciencia</a>. If it's already there but still not visible here, please wait for our next update. If it's urgent, contact the IPBLN Bioinformatics Unit at <a href="mailto:${contactEmail}">${contactEmail}</a> to request an earlier update.`;
            missingPubsNoticeText.innerHTML = (lang === 'es') ? textEs : textEn;
            missingPubsNotice.classList.remove('d-none');
        } else {
            missingPubsNotice.classList.add('d-none');
            missingPubsNoticeText.innerHTML = '';
        }
    }

    // Variables para el autocompletado
    let searchTimeout = null;

    // Función para actualizar el estado del botón de búsqueda
    function updateSearchButton() {
        if (selectedAuthorName) {
            standardSearchBtn.classList.remove('btn-primary', 'btn-success');
            standardSearchBtn.classList.add('btn-secondary');
            standardSearchBtn.disabled = true;
        } else {
            standardSearchBtn.innerHTML = '<i class="fas fa-search"></i>';
            standardSearchBtn.classList.remove('btn-success', 'btn-secondary');
            standardSearchBtn.classList.add('btn-primary');
            standardSearchBtn.disabled = false;
        }
    }

    // Función para mostrar sugerencias de autores
    function showAuthorSuggestions(query) {
        if (!query || selectedAuthorName) {
            searchSuggestions.style.display = 'none';
            return;
        }

        fetch(`/BiblioMetrics/${lang}/api/search/authors/?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                const suggestionsList = searchSuggestions.querySelector('.list-group');
                suggestionsList.innerHTML = '';

                if (data.suggestions.length === 0) {
                    searchSuggestions.style.display = 'none';
                    return;
                }

                data.suggestions.forEach(author => {
                    const item = document.createElement('a');
                    item.href = '#';
                    item.className = 'list-group-item list-group-item-action';
                    item.innerHTML = `
                        ${author.name}
                        <span class="badge bg-secondary float-end">${author.count} pub.</span>
                    `;
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        selectAuthor(author.name);
                    });
                    suggestionsList.appendChild(item);
                });

                searchSuggestions.style.display = 'block';
            })
            .catch(error => {
                console.error('Error fetching author suggestions:', error);
                searchSuggestions.style.display = 'none';
            });
    }

    // Event listener para el autor seleccionado
    function selectAuthor(authorName) {
        selectedAuthorName = authorName;
        window.selectedAuthorName = authorName;
        standardSearch.value = '';
        standardSearch.disabled = true;
        searchSuggestions.style.display = 'none';
        authorLimitMessage.style.display = 'block';
        updateSearchButton();

        // Crear el badge del autor seleccionado
        selectedAuthor.innerHTML = `
            <span class="badge bg-primary me-2 mb-2">
                ${authorName}
                <button type="button" class="btn-close btn-close-white ms-1" 
                        style="font-size: 0.5rem; vertical-align: middle;"
                        aria-label="Remove"></button>
            </span>
        `;

        // Añadir evento para eliminar el autor
        selectedAuthor.querySelector('.btn-close').addEventListener('click', () => {
            selectedAuthorName = null;
            window.selectedAuthorName = null;
            selectedAuthor.innerHTML = '';
            setMissingPubsNoticeVisible(false);
            standardSearch.disabled = false;
            authorLimitMessage.style.display = 'none';
            updateSearchButton();
            
            // Eliminar la card de métricas del autor del DOM
            const authorMetricsCard = document.getElementById('authorMetricsCard');
            if (authorMetricsCard) {
                authorMetricsCard.remove();
            }
            
            // Ajustar la columna de la red de colaboración
            const networkCol = document.getElementById('networkCol');
            if (networkCol) {
                networkCol.className = 'col-12';
            }
            
            updateFilters(); // Actualizar filtros al eliminar el autor
        });

        // Crear y añadir la card de métricas del autor al DOM
        const collaborationRow = document.getElementById('collaborationRow');
        const authorMetricsCard = document.createElement('div');
        authorMetricsCard.id = 'authorMetricsCard';
        authorMetricsCard.className = 'col-md-6 mt-3 mt-md-0 mb-10 h-100';
        
        // Extraer el idioma de forma robusta
        const currentLang = (typeof detectLangFromPath === 'function')
            ? detectLangFromPath()
            : (window.location.pathname.includes('/es/') ? 'es' : 'en');
        const cardTitle = currentLang === 'es' ? 'Resumen de Métricas del Autor' : 'Author Metrics Summary';
        const metricsTitle = currentLang === 'es' ? 'Métrica' : 'Metrics';
        const valuesTitle = currentLang === 'es' ? 'Valor' : 'Value';
        
        authorMetricsCard.innerHTML = `
            <div class="card dashboard-card h-100">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">${cardTitle}</h5>
                    </div>
                    <div id="authorMetricsContent" class="flex-grow-1">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>${metricsTitle}</th>
                                        <th>${valuesTitle}</th>
                                    </tr>
                                </thead>
                                <tbody id="authorMetricsTable">
                                    <!-- Data will be loaded dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        collaborationRow.appendChild(authorMetricsCard);

        // Ajustar la columna de la red de colaboración
        const networkCol = document.getElementById('networkCol');
        if (networkCol) {
            networkCol.className = 'col-12 col-md-6 mb-10';
        }
        const pubsCol = document.getElementById('pubsCol');
        if (pubsCol) {
            pubsCol.className = 'col-12 mt-4';
        }

        // Show notice now that an author is selected
        setMissingPubsNoticeVisible(true);

        // Obtener las métricas del autor
        fetch(`/BiblioMetrics/${lang}/api/author/metrics/?author_id=${encodeURIComponent(authorName)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error fetching author metrics:', data.error);
                    return;
                }
                
                const metricsTable = document.getElementById('authorMetricsTable');
                if (!metricsTable) return;

                // i18n para nombres de métricas (ES/EN)
                const metricNamesI18N = {
                    es: {
                        orcid: 'ORCID',
                        total_publications: 'Publicaciones totales',
                        total_citations: 'Citas totales',
                        citations_wos: 'Citas WoS',
                        citations_scopus: 'Citas Scopus',
                        h_index: 'Índice h (WoS/Scopus)',
                        h_index_gb: 'Índice h (Gesbib)',
                        h_index_h5gb: 'Índice h5 (Gesbib)',
                        international_index: 'Índice de colaboración internacional'
                    },
                    en: {
                        orcid: 'ORCID',
                        total_publications: 'Total Publications',
                        total_citations: 'Total Citations',
                        citations_wos: 'WoS Citations',
                        citations_scopus: 'Scopus Citations',
                        h_index: 'H-index (WoS/Scopus)',
                        h_index_gb: 'H-index (Gesbib)',
                        h_index_h5gb: 'H5-index (Gesbib)',
                        international_index: 'International Collaboration Index'
                    }
                };
                const tMetric = (k) => (metricNamesI18N[currentLang] && metricNamesI18N[currentLang][k]) || k;

                // Limpiar la tabla
                metricsTable.innerHTML = '';

                // Añadir cada métrica a la tabla
                Object.entries(data.metrics).forEach(([key, value]) => {
                    const row = document.createElement('tr');
                
                    if (key === 'orcid' && typeof value === 'string' && value.trim() !== '') {
                        // Forzar https y generar enlace clicable
                        const url = value.replace(/^http:/, 'https:');
                        row.innerHTML = `
                            <td>${tMetric(key)}</td>
                            <td><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></td>
                        `;
                    } else {
                        row.innerHTML = `
                            <td>${tMetric(key) || key}</td>
                            <td>${value}</td>
                        `;
                    }
                
                    metricsTable.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error fetching author metrics:', error);
            });

        // Actualizar los filtros y visualizaciones con el autor seleccionado
        updateFilters();
    }

    // Función para actualizar el autor seleccionado
    function updateSelectedAuthor() {
        if (selectedAuthorName) {
            // Ensure the notice is visible and filters reflect the author
            setMissingPubsNoticeVisible(true);
            updateFilters();
        } else {
            setMissingPubsNoticeVisible(false);
        }
    }

    // Función para realizar la búsqueda
    function performSearch() {
        if (!selectedAuthorName && !standardSearch.value.trim()) return;

        // Mostrar indicador de carga
        standardSearchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Construir la URL de búsqueda
        const params = new URLSearchParams();
        if (selectedAuthorName) {
            params.append('author', selectedAuthorName);
        } else {
            params.append('q', standardSearch.value.trim());
        }
        // Recoger el parámetro del selector de número de resultados IA
        const topKSelect = document.getElementById('semanticTopK');
        let top_k = 50;
        if (topKSelect) {
            top_k = parseInt(topKSelect.value) || 50;
        }
        params.append('top_k', top_k);

        // Realizar la búsqueda
        fetch(`/BiblioMetrics/${lang}/api/search/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                // Restaurar el botón
                standardSearchBtn.innerHTML = '<i class="fas fa-search"></i>';

                // Crear y mostrar el modal de resultados (máximo top_k)
                showSearchResults((data.results || []).slice(0, top_k));
            })
            .catch(error => {
                console.error('Error performing search:', error);
                standardSearchBtn.innerHTML = '<i class="fas fa-search"></i>';
                alert('Error al realizar la búsqueda. Por favor, inténtelo de nuevo.');
            });
    }

    // Función para mostrar los resultados de búsqueda
    function showSearchResults(results) {
        const currentLang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : 'es';
        const searchResults = currentLang === 'es' ? 'Resultados de la búsqueda' : 'Search Results';
        const emptyText = currentLang === 'es' ? 'No se encontraron resultados.' : 'No results found.';
        const authorsLabel = currentLang === 'es' ? 'Autores' : 'Authors';
        const institutionsLabel = currentLang === 'es' ? 'Instituciones' : 'Institutions';
        const areasLabel = currentLang === 'es' ? 'Áreas' : 'Areas';
        const viewLinkText = currentLang === 'es' ? 'Ver publicación' : 'View publication';

        // Crear el modal si no existe
        let modal = document.getElementById('searchResultsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'searchResultsModal';
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${searchResults}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="searchResultsList"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) modalTitle.textContent = searchResults;

        // Actualizar el contenido del modal
        const resultsList = document.getElementById('searchResultsList');
        if (results.length === 0) {
            resultsList.innerHTML = `<p class="text-center">${emptyText}</p>`;
        } else {
            resultsList.innerHTML = results.map(result => {
                const authors = Array.isArray(result.authors) ? result.authors.join(', ') : (result.authors || '');
                const otherAuthors = Array.isArray(result.other_authors) && result.other_authors.length > 0
                    ? ` <span class="text-muted">(${result.other_authors.join(', ')})</span>`
                    : '';
                return `
                <div class="card mb-3">
                    <div class="card-body" data-publication-id="${result.id}" style="cursor: pointer;">
                        <h5 class="card-title">${result.title}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">
                            ${result.year} - ${result.publication_type}
                        </h6>
                        <p class="card-text">
                            <strong>${authorsLabel}:</strong> ${authors}${otherAuthors}<br>
                            <strong>${institutionsLabel}:</strong> ${result.institutions.join(', ')}<br>
                            <strong>${areasLabel}:</strong> ${result.areas.join(', ')}
                        </p>
                        ${result.url ? `<a href="${result.url}" class="card-link" target="_blank">${viewLinkText}</a>` : ''}
                    </div>
                </div>
                `;
            }).join('');
        }

        // Añadir evento de clic a cada tarjeta de resultado
        resultsList.querySelectorAll('.card-body').forEach(cardBody => {
            cardBody.addEventListener('click', function() {
                const publicationId = this.dataset.publicationId;
                if (publicationId) {
                    // Redirigir a la página de detalle de publicación
                    window.location.href = `/BiblioMetrics/publication/${publicationId}/`;
                }
            });
        });

        // Mostrar el modal
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    }

    /**
     * Show semantic search results in a modal, ordered by similarity.
     * @param {Array<Object>} results - Array of publication objects returned by the semantic search API.
     */
    function showSemanticResults(results) {
    const currentLang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : 'es';
    const titleText = currentLang === 'es' ? 'Resultados IA' : 'AI Search Results';

        // Defensive: ensure we have an array
        if (!Array.isArray(results)) results = [];

        // Sort by similarity desc if similarity field exists
        results = results.slice().sort((a, b) => {
            const sa = (typeof a.similarity === 'number') ? a.similarity : 0;
            const sb = (typeof b.similarity === 'number') ? b.similarity : 0;
            return sb - sa;
        });

        // Create modal if not present
        let modal = document.getElementById('semanticResultsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'semanticResultsModal';
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${titleText}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="semanticResultsList"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            // update title language
            const hdr = modal.querySelector('.modal-title');
            if (hdr) hdr.textContent = titleText;
        }

        const list = document.getElementById('semanticResultsList');
        if (!list) return;

        function renderSemanticResults(res) {
            if (res.length === 0) {
                list.innerHTML = '<p class="text-center">' + (currentLang === 'es' ? 'No se encontraron resultados.' : 'No results found.') + '</p>';
            } else {
                list.innerHTML = res.map(r => {
                    const simText = (typeof r.similarity === 'number') ? `<div class="text-end text-muted" style="font-size:0.9rem">${(r.similarity*100).toFixed(1)}% similar</div>` : '';
                    const authors = Array.isArray(r.authors) ? r.authors.join(', ') : (r.authors || '');
                    const otherAuthors = Array.isArray(r.other_authors) && r.other_authors.length > 0
                        ? ` <span class="text-muted">(${r.other_authors.join(', ')})</span>`
                        : '';
                    const areasFallback = Array.isArray(r.areas) && r.areas.length ? r.areas : Array.isArray(r.areas_all) ? r.areas_all : [];
                    const areas = areasFallback.length ? areasFallback.join(', ') : (currentLang === 'es' ? 'Sin áreas registradas' : 'No areas available');
                    const institutions = Array.isArray(r.institutions) && r.institutions.length ? r.institutions.join(', ') : '';
                    const instLabel = currentLang === 'es' ? 'Instituciones' : 'Institutions';
                    const areasLabel = currentLang === 'es' ? 'Áreas' : 'Areas';
                    const pubType = r.publication_type || '';
                    const year = r.year || '';
                    const subtitleText = (year ? year : '') + (pubType ? ` - ${pubType}` : '');
                    const urlLink = r.url ? `<a href="${r.url}" class="card-link" target="_blank">${currentLang === 'es' ? 'Ver publicación' : 'View publication'}</a>` : '';

                    return `
                        <div class="card mb-3">
                            <div class="card-body" data-publication-id="${r.id}" style="cursor: pointer;">
                                <div class="d-flex justify-content-between">
                                    <div>
                                        <h5 class="card-title mb-1">${r.title}</h5>
                                        <h6 class="card-subtitle mb-2 text-muted">${subtitleText}</h6>
                                    </div>
                                    ${simText}
                                </div>
                                <p class="card-text mb-1"><strong>${currentLang === 'es' ? 'Autores' : 'Authors'}:</strong> ${authors}${otherAuthors}</p>
                                ${institutions ? `<p class="card-text mb-1"><strong>${instLabel}:</strong> ${institutions}</p>` : ''}
                                <p class="card-text mb-1"><strong>${areasLabel}:</strong> ${areas}</p>
                                <div>${urlLink}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                // Attach click handlers
                const container = document.getElementById('semanticResultsList');
                container.querySelectorAll('.card-body').forEach(cardBody => {
                    cardBody.addEventListener('click', function() {
                        const publicationId = this.dataset.publicationId;
                        if (publicationId) {
                            window.location.href = `/BiblioMetrics/publication/${publicationId}/`;
                        }
                    });
                });
            }
        }

        renderSemanticResults(results);

        // Añadir evento al selector para cambiar el número de resultados
        const topKSelect = document.getElementById('semanticTopK');
        if (topKSelect) {
            topKSelect.addEventListener('change', function() {
                const topK = parseInt(this.value);
                // Aquí deberías volver a hacer la petición al backend con el nuevo top_k
                // Puedes guardar el último query en una variable global si lo necesitas
                if (window.lastSemanticQuery) {
                    fetch(`/BiblioMetrics/${currentLang}/semantic_search/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: window.lastSemanticQuery, top_k: topK })
                    })
                    .then(response => response.json())
                    .then(data => {
                        renderSemanticResults(data.results || []);
                    });
                }
            });
        }

        // Show modal
        const modalInstance = new bootstrap.Modal(document.getElementById('semanticResultsModal'));
        modalInstance.show();
    }

    // Event listeners para el autocompletado
    standardSearch.addEventListener('input', function() {
        if (selectedAuthorName) return;

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            showAuthorSuggestions(this.value.trim());
        }, 300);
    });

    standardSearch.addEventListener('focus', function() {
        if (this.value.trim() && !selectedAuthorName) {
            showAuthorSuggestions(this.value.trim());
        }
    });

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#standardSearch') && !e.target.closest('#searchSuggestions')) {
            searchSuggestions.style.display = 'none';
        }
    });

    // Event listeners para la búsqueda
    standardSearchBtn.addEventListener('click', performSearch);
    standardSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // AI Semantic search elements (connect to semantic_search endpoint and show modal)
    const aiSearch = document.getElementById('aiSearch');
    const aiSearchBtn = document.getElementById('aiSearchBtn');

    function handleAISearch() {
        const query = aiSearch ? aiSearch.value.trim() : '';
        if (!query) return;

        // Show spinner on button
        if (aiSearchBtn) aiSearchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Guardar el último query para el selector de top_k
        window.lastSemanticQuery = query;
        const topKSelect = document.getElementById('semanticTopK');
        let top_k = 50;
        if (topKSelect) {
            top_k = parseInt(topKSelect.value) || 50;
        }
        const payload = { query, top_k };
        fetch(`/BiblioMetrics/${lang}/semantic_search/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(resp => resp.json())
        .then(data => {
            // Restore button icon
            if (aiSearchBtn) aiSearchBtn.innerHTML = '<i class="fas fa-robot"></i>';

            // Backend returns list in data.results or data
            const results = data.results || data;
            showSemanticResults(results);
        })
        .catch(error => {
            console.error('Error performing semantic search:', error);
            if (aiSearchBtn) aiSearchBtn.innerHTML = '<i class="fas fa-robot"></i>';
            alert('Error performing AI search.');
        });
    }

    if (aiSearchBtn) aiSearchBtn.addEventListener('click', handleAISearch);
    if (aiSearch) aiSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleAISearch();
    });

    // Inicializar estado del botón al cargar la página
    updateSearchButton();

    // Cargar los datos de los filtros
    loadFilterData();

    // Configurar botones de vista de áreas (circular/barra)
    setupAreasButtons();

    // Función para cargar los datos de los filtros
    function loadFilterData() {
        fetch(`/BiblioMetrics/${lang}/api/dashboard/filters/`)
            .then(response => response.json())
            .then(data => {
                // Establecer el rango de años disponible
                const years = data.years.map(y => y.year);
                yearFrom.min = Math.min(...years);
                yearFrom.max = Math.max(...years);
                yearTo.min = Math.min(...years);
                yearTo.max = Math.max(...years);

                // Llenar el filtro de áreas temáticas
                data.areas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area.name;
                    option.textContent = `${area.name} (${area.count})`;
                    areaFilter.appendChild(option);
                });

                // Llenar el filtro de instituciones
                data.institutions.forEach(institution => {
                    const option = document.createElement('option');
                    option.value = institution.name;
                    option.textContent = `${institution.name} (${institution.count})`;
                    institutionFilter.appendChild(option);
                });

                // Llenar el filtro de tipos de publicación
                data.publication_types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.publication_type;
                    option.textContent = `${type.publication_type} (${type.count})`;
                    typeFilter.appendChild(option);
                });

                // Llenar el filtro de cuartil (Q1..Q4) con conteos
                if (quartileFilter && Array.isArray(data.quartiles)) {
                    quartileFilter.innerHTML = '';
                    const anyOpt = document.createElement('option');
                    anyOpt.value = '';
                    const qLang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/es/') ? 'es' : 'en');
                    anyOpt.textContent = qLang === 'es' ? 'Todos los cuartiles' : 'All quartiles';
                    quartileFilter.appendChild(anyOpt);
                    data.quartiles.forEach(q => {
                        const option = document.createElement('option');
                        option.value = q.quartile;
                        option.textContent = `${q.quartile} (${q.count})`;
                        quartileFilter.appendChild(option);
                    });
                }

                // Actualizar rango de citas disponible inicial
                if (data.citations_range) {
                    const help = document.getElementById('citationsRangeHelp');
                    if (help) {
                        const minC = data.citations_range.min || 0;
                        const maxC = data.citations_range.max || 0;
                        const langRange = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                        const rangeLabel = langRange === 'es' ? 'Rango disponible' : 'Available range';
                        help.textContent = `${rangeLabel}: ${minC} - ${maxC}`;
                        if (citationsFrom) citationsFrom.placeholder = minC;
                        if (citationsTo) citationsTo.placeholder = maxC;
                    }
                }

                // Cargar datos iniciales
                updateVisualizations();
            })
            .catch(error => console.error('Error loading filter data:', error));
    }

    // Función para crear un badge con botón de eliminar
    function createBadge(value, container, set) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary me-2 mb-2';
        // Limitar el texto a 40 caracteres
        const displayText = value.length > 40 ? value.substring(0, 40) + '...' : value;
        badge.innerHTML = `
            ${displayText}
            <button type="button" class="btn-close btn-close-white ms-1" 
                    style="font-size: 0.5rem; vertical-align: middle;"
                    aria-label="Remove"></button>
        `;
        badge.querySelector('.btn-close').addEventListener('click', () => {
            set.delete(value);
            badge.remove();
            // Actualizar window para exportación
            if (set === selectedAreasList) window.selectedAreasList = selectedAreasList;
            if (set === selectedInstitutionsList) window.selectedInstitutionsList = selectedInstitutionsList;
            if (set === selectedTypesList) window.selectedTypesList = selectedTypesList;
            if (set === selectedQuartilesList) window.selectedQuartilesList = selectedQuartilesList;
            // IMPORTANTE: recalcular combos y luego visualizaciones
            updateFilters();
        });
        container.appendChild(badge);
        // Actualizar window para exportación
        if (set === selectedAreasList) window.selectedAreasList = selectedAreasList;
        if (set === selectedInstitutionsList) window.selectedInstitutionsList = selectedInstitutionsList;
        if (set === selectedTypesList) window.selectedTypesList = selectedTypesList;
        if (set === selectedQuartilesList) window.selectedQuartilesList = selectedQuartilesList;
    }

    // Función para limpiar todos los filtros
    function clearFilters() {
        yearFrom.value = '';
        yearTo.value = '';
        if (citationsFrom) citationsFrom.value = '';
        if (citationsTo) citationsTo.value = '';
        selectedAreasList.clear();
        selectedInstitutionsList.clear();
        selectedTypesList.clear();
        selectedQuartilesList.clear();
    // metric source fixed to WoS – nothing to clear
        selectedAreas.innerHTML = '';
        selectedInstitutions.innerHTML = '';
        selectedTypes.innerHTML = '';
        selectedQuartiles.innerHTML = '';
        if (metricSourceFilter) metricSourceFilter.value = '';
        if (quartileFilter) quartileFilter.value = '';
        updateFilters();
    }

    // --- ÁREAS TEMÁTICAS: LÓGICA DE BOTONES Y RENDER ---
    let currentAreasView = 'pie';
    let lastAreasData = null;

    function renderAreasChart(data) {
        return renderAreasChartUtil({
            data,
            currentAreasView,
            detectLangFromPath,
            hideAreasLoading,
        });
    }

    // Lógica de botones de áreas temáticas igual que yearly/monthly
    function setupAreasButtons() {
        const pieBtn = document.querySelector('[data-areas-view="pie"]');
        const barBtn = document.querySelector('[data-areas-view="bar"]');
        if (!pieBtn || !barBtn) return;

        pieBtn.addEventListener('click', function() {
            if (!pieBtn.classList.contains('active')) {
                pieBtn.classList.add('active');
                barBtn.classList.remove('active');
                currentAreasView = 'pie';
                if (lastAreasData) renderAreasChart(lastAreasData);
            }
        });
        barBtn.addEventListener('click', function() {
            if (!barBtn.classList.contains('active')) {
                barBtn.classList.add('active');
                pieBtn.classList.remove('active');
                currentAreasView = 'bar';
                if (lastAreasData) renderAreasChart(lastAreasData);
            }
        });
    }

    // Modifica updateVisualizations para guardar los datos de áreas y renderizar según la vista activa
    function updateVisualizations() {
        const filters = {
            year_from: yearFrom.value,
            year_to: yearTo.value,
            areas: Array.from(selectedAreasList),
            institutions: Array.from(selectedInstitutionsList),
            types: Array.from(selectedTypesList),
            quartiles: Array.from(selectedQuartilesList),
            citations_from: citationsFrom ? citationsFrom.value : '',
            citations_to: citationsTo ? citationsTo.value : '',
            // metric_source removed (always WoS)
        };

        // Determinar si se puede usar la vista mensual
        const canUseMonthly = filters.year_from && filters.year_to && filters.year_from === filters.year_to;
        const monthlyBtn = document.querySelector('[data-view="monthly"]');
        const yearlyBtn = document.querySelector('[data-view="yearly"]');
        
        // Actualizar estado de los botones
        monthlyBtn.disabled = !canUseMonthly;
        if (!canUseMonthly) {
            // Si no se puede usar mensual, forzar vista anual
            monthlyBtn.classList.remove('active');
            yearlyBtn.classList.add('active');
            filters.view_type = 'yearly';
        } else {
            // Si se puede usar mensual, usar el botón activo
            filters.view_type = monthlyBtn.classList.contains('active') ? 'monthly' : 'yearly';
        }

        // Construir la URL con los parámetros de filtrado
        const params = new URLSearchParams();
        if (filters.year_from) params.append('year_from', filters.year_from);
    if (filters.year_to) params.append('year_to', filters.year_to);
    if (filters.citations_from) params.append('citations_from', filters.citations_from);
    if (filters.citations_to) params.append('citations_to', filters.citations_to);
        filters.areas.forEach(area => params.append('areas', area));
        filters.institutions.forEach(institution => params.append('institutions', institution));
        filters.types.forEach(type => params.append('types', type));
    filters.quartiles.forEach(q => params.append('quartiles', q));
    // metric_source removed
        params.append('view_type', filters.view_type);
        if (includePredictedAreas) params.append('include_predicted_areas', 'true');
        
        // Añadir el autor seleccionado si existe
        if (selectedAuthorName) {
            params.append('author', selectedAuthorName);
        }

        // Obtener los datos filtrados
        fetch(`/BiblioMetrics/${lang}/api/dashboard/data/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {

                // Obtener datos de la red de colaboración
                const networkParams = new URLSearchParams(params); // Clonar los parámetros existentes
                networkParams.append('view_type', window.currentCommunityView); // Añadir el tipo de vista de comunidad

                fetch(`/BiblioMetrics/${lang}/api/dashboard/collaboration-network/?${networkParams.toString()}`)
                .then(response => response.json())
                .then(data => {
                    updateCollaborationNetwork(data);
                })
                .catch(error => {
                    console.error('Error fetching collaboration network data:', error);
                });

                // Actualizar la línea de tiempo
                updateTimeline(data.timeline, filters.view_type, data.timeline_info);
                // Guardar y renderizar áreas según el botón activo
                lastAreasData = data.areas;
                // Si ninguno está activo, activa Circular por defecto
                const pieBtn = document.querySelector('[data-areas-view="pie"]');
                const barBtn = document.querySelector('[data-areas-view="bar"]');
                if (pieBtn && barBtn && !pieBtn.classList.contains('active') && !barBtn.classList.contains('active')) {
                    pieBtn.classList.add('active');
                    barBtn.classList.remove('active');
                    currentAreasView = 'pie';
                } else if (barBtn && barBtn.classList.contains('active')) {
                    currentAreasView = 'bar';
                } else if (pieBtn && pieBtn.classList.contains('active')) {
                    currentAreasView = 'pie';
                }
                renderAreasChart(data.areas);
                
                // Actualizar la tabla de publicaciones
                updatePublicationsTable(1).then(() => {
                });

                // Actualizar mapa (Mundo/España) con agregación en servidor
                try {
                    const paramsAll = new URLSearchParams(params);
                    // Count mode for Spain map: 'occurrences' (sum of all affiliations) by default
                    paramsAll.set('count', 'occurrences');
                    if (window.currentMapView === 'spain') {
                        setSpainMapLoading(true);
                        fetch(`/BiblioMetrics/${lang}/api/dashboard/spainmap-counts/?${paramsAll.toString()}`)
                            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to fetch spainmap counts')))
                            .then(countsData => {
                                const ccaa = (countsData && countsData.ccaa) || {};
                                const provinces = (countsData && countsData.provinces) || {};
                                setSpainMapCounts({ ccaa, provinces });
                                // eslint-disable-next-line no-console
                                console.log('[SpainMap] Counts:', { ccaa, provinces });
                                // Guardar total de publicaciones filtradas para Top10 de España
                                if (countsData && typeof countsData.total_publications === 'number') {
                                    window.spainMapFilteredTotal = countsData.total_publications;
                                } else {
                                    window.spainMapFilteredTotal = null;
                                }
                                setSpainMapLoading(false);
                            })
                            .catch(err => {
                                // eslint-disable-next-line no-console
                                console.error('Error fetching spainmap counts:', err);
                                setSpainMapLoading(false);
                            });
                    } else {
                        setWorldMapLoading(true);
                        // Limpiar listado Top 10 mientras se cargan nuevos datos
                        const top10El = document.getElementById('worldmap-top10');
                        if (top10El) top10El.innerHTML = '';
                        fetch(`/BiblioMetrics/${lang}/api/dashboard/worldmap-counts/?${paramsAll.toString()}`)
                            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to fetch worldmap counts')))
                            .then(countsData => {
                                const countsByIso = countsData && countsData.counts ? countsData.counts : {};
                                // Guardar total de publicaciones filtradas para cálculo de porcentajes en Top10
                                if (countsData && typeof countsData.total_publications === 'number') {
                                    window.worldMapFilteredTotal = countsData.total_publications;
                                } else {
                                    window.worldMapFilteredTotal = null;
                                }
                                setWorldMapActiveCountries(countsByIso);
                                // eslint-disable-next-line no-console
                                setWorldMapLoading(false);
                            })
                            .catch(err => {
                                // eslint-disable-next-line no-console
                                console.error('Error fetching worldmap counts:', err);
                                setWorldMapLoading(false);
                            });
                    }
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error('Unexpected error updating map counts:', e);
                    setWorldMapLoading(false);
                    setSpainMapLoading(false);
                }
            })
            .catch(error => console.error('Error updating visualizations:', error));
    }

    // Estado de ordenación actual (mover fuera de la función para mantenerlo entre llamadas)
    let currentSort = {
        metric: null,
        direction: 'desc'
    };

    function updatePublicationsTable(page = 1) {
        const tableBody = document.getElementById('metricsTable');
        const pagination = document.getElementById('publicationsPagination');
        const table = tableBody.closest('table');

        // Mostrar indicador de carga y deshabilitar la tabla
        if (table) {
            // Crear overlay de carga si no existe
            let loadingOverlay = table.querySelector('.loading-overlay');
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                `;
                loadingOverlay.innerHTML = `
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                `;
                table.style.position = 'relative';
                table.appendChild(loadingOverlay);
            }
            loadingOverlay.style.display = 'flex';
            
            // Deshabilitar la tabla
            table.style.pointerEvents = 'none';
            table.style.opacity = '0.7';
        }

        const filters = {
            year_from: yearFrom.value,
            year_to: yearTo.value,
            areas: Array.from(selectedAreasList),
            institutions: Array.from(selectedInstitutionsList),
            types: Array.from(selectedTypesList),
            quartiles: Array.from(selectedQuartilesList),
            citations_from: citationsFrom ? citationsFrom.value : '',
            citations_to: citationsTo ? citationsTo.value : '',
            // metric_source removed (always WoS)
            page: page
        };

        // Construir la URL con los parámetros de filtrado
        const params = new URLSearchParams();
        if (filters.year_from) params.append('year_from', filters.year_from);
    if (filters.year_to) params.append('year_to', filters.year_to);
    if (filters.citations_from) params.append('citations_from', filters.citations_from);
    if (filters.citations_to) params.append('citations_to', filters.citations_to);
        filters.areas.forEach(area => params.append('areas', area));
        filters.institutions.forEach(institution => params.append('institutions', institution));
        filters.types.forEach(type => params.append('types', type));
        filters.quartiles.forEach(q => params.append('quartiles', q));
    // metric_source removed
        params.append('page', filters.page);
        
        // Añadir el autor seleccionado si existe
        if (selectedAuthorName) {
            params.append('author', selectedAuthorName);
        }

        // Añadir parámetros de ordenación si existen
        if (currentSort.metric) {
            params.append('sort_by', currentSort.metric);
            params.append('sort_order', currentSort.direction);
        }

        // Retornar la promesa de fetch
        return fetch(`/BiblioMetrics/${lang}/api/dashboard/publications/?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (!tableBody || !pagination) {
                    return Promise.reject('Required elements not found');
                }

                const { data: publications, pagination: paginationData } = data.publications;

                // Ordenar las métricas en un orden específico (keys fijos para backend / ordenación)
                const orderedMetrics = [
                    { key: 'Dimensions Citations', label: 'Dimensions Citations' },
                    { key: 'WoS Citations', label: 'WoS Citations' },
                    { key: 'Scopus Citations', label: 'Scopus Citations' },
                    { key: 'FCR', label: 'FCR' },
                    { key: 'RCR', label: 'RCR' },
                    { key: 'International Collaboration', label: 'International Collaboration' }
                ];

                // Traducciones encabezados (bilingüe)
                const langCodeForTable = typeof detectLangFromPath === 'function' ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                const metricTranslations = {
                    es: {
                        title: 'Título',
                        'Dimensions Citations': 'Citas Dimensions',
                        'WoS Citations': 'Citas WoS',
                        'Scopus Citations': 'Citas Scopus',
                        'International Collaboration': 'Colaboración Internacional',
                        FCR: 'FCR',
                        RCR: 'RCR'
                    },
                    en: {
                        title: 'Title',
                        'Dimensions Citations': 'Dimensions Citations',
                        'WoS Citations': 'WoS Citations',
                        'Scopus Citations': 'Scopus Citations',
                        'International Collaboration': 'International Collaboration',
                        FCR: 'FCR',
                        RCR: 'RCR'
                    }
                };
                const t = (k) => (metricTranslations[langCodeForTable] && metricTranslations[langCodeForTable][k]) || k;

                // Crear el encabezado de la tabla con iconos de ordenación (texto según idioma)
                const tableHeader = document.createElement('thead');
                tableHeader.innerHTML = `
                    <tr>
                        <th style="max-width: 300px;">${t('title')}</th>
                        ${orderedMetrics.map(({ key, label }) => `
                            <th class="sortable" data-metric="${key}">
                                ${t(key)}
                                <i class="fas fa-sort${currentSort.metric === key ? `-${currentSort.direction === 'desc' ? 'down' : 'up'}` : ''} ms-1"></i>
                            </th>
                        `).join('')}
                    </tr>
                `;

                // Añadir el encabezado a la tabla
                if (table) {
                    const existingHeader = table.querySelector('thead');
                    if (existingHeader) {
                        existingHeader.remove();
                    }
                    table.insertBefore(tableHeader, tableBody);
                }

                // Añadir eventos de clic a los encabezados ordenables
                tableHeader.querySelectorAll('.sortable').forEach(header => {
                    header.addEventListener('click', function() {
                        const metric = this.dataset.metric;
                        const icon = this.querySelector('i');

                        // Resetear todos los iconos
                        tableHeader.querySelectorAll('.sortable i').forEach(i => {
                            i.className = 'fas fa-sort ms-1';
                        });

                        // Actualizar el estado de ordenación
                        if (currentSort.metric === metric) {
                            currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
                        } else {
                            currentSort.metric = metric;
                            currentSort.direction = 'desc';
                        }

                        // Actualizar el icono
                        icon.className = `fas fa-sort-${currentSort.direction === 'desc' ? 'down' : 'up'} ms-1`;

                        // Actualizar la tabla con la nueva ordenación
                        updatePublicationsTable(1); // Volver a la primera página
                    });
                });

                // Función para actualizar el contenido de la tabla
                function updateTableContent(pubs) {
                    tableBody.innerHTML = pubs.map(pub => `
                        <tr class="publication-row" data-publication-id="${pub.id}" style="cursor: pointer;">
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pub.title}</td>
                            ${orderedMetrics.map(({ key }) => {
                                const metric = pub.metrics[key];
                                const displayValue = (metric && metric.value !== null) ? metric.value : '';
                                return `<td>${displayValue}</td>`;
                            }).join('')}
                            <td>${pub.international_collab !== null ? pub.international_collab : '-'}</td>
                        </tr>
                    `).join('');

                    // Añadir eventos para las filas de publicaciones
                    tableBody.querySelectorAll('.publication-row').forEach(row => {
                        row.addEventListener('click', function() {
                            const publicationId = this.dataset.publicationId;
                            if (publicationId) {
                                window.location.href = `/BiblioMetrics/publication/${publicationId}/`;
                            }
                        });
                    });
                }

                // Actualizar el contenido inicial de la tabla
                updateTableContent(publications);

                // Actualizar la paginación
                if (paginationData.total_pages > 1) {
                    let paginationHTML = `
                        <li class="page-item ${paginationData.current_page === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="1">&laquo;</a>
                        </li>
                        <li class="page-item ${paginationData.current_page === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${paginationData.current_page - 1}">&lt;</a>
                        </li>
                    `;

                    // Mostrar páginas alrededor de la actual
                    const startPage = Math.max(1, paginationData.current_page - 2);
                    const endPage = Math.min(paginationData.total_pages, paginationData.current_page + 2);

                    for (let i = startPage; i <= endPage; i++) {
                        paginationHTML += `
                            <li class="page-item ${i === paginationData.current_page ? 'active' : ''}">
                                <a class="page-link" href="#" data-page="${i}">${i}</a>
                            </li>
                        `;
                    }

                    paginationHTML += `
                        <li class="page-item ${paginationData.current_page === paginationData.total_pages ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${paginationData.current_page + 1}">&gt;</a>
                        </li>
                        <li class="page-item ${paginationData.current_page === paginationData.total_pages ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${paginationData.total_pages}">&raquo;</a>
                        </li>
                    `;

                    pagination.innerHTML = paginationHTML;
                } else {
                    pagination.innerHTML = '';
                }

                // Añadir eventos para la paginación
                pagination.querySelectorAll('.page-link').forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        const page = parseInt(this.dataset.page);
                        if (!isNaN(page)) {
                            updatePublicationsTable(page);
                        }
                    });
                });

                // Ocultar indicador de carga y habilitar la tabla
                if (table) {
                    const loadingOverlay = table.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    }
                    table.style.pointerEvents = 'auto';
                    table.style.opacity = '1';
                }

                return Promise.resolve();
            })
            .catch(error => {
                console.error('Error updating publications table:', error);
                
                // Ocultar indicador de carga y habilitar la tabla en caso de error
                if (table) {
                    const loadingOverlay = table.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    }
                    table.style.pointerEvents = 'auto';
                    table.style.opacity = '1';
                }
                
                return Promise.reject(error);
            });
    }

    // Funciones para actualizar cada visualización
    function updateTimeline(data, viewType, timelineInfo) {
        return updateTimelineUtil(data, viewType, timelineInfo, detectLangFromPath);
    }

    // -------------------------------------------------------------
    // Export Timeline Image (Yearly or Monthly active view)
    // -------------------------------------------------------------
    initTimelineExporter({ detectLangFromPath });

    // -------------------------------------------------------------
    // Export Areas Distribution (Pie o Bar activo)
    // -------------------------------------------------------------
    initAreasExporter({ detectLangFromPath });

    // (Areas charts & exporter moved to ./dashboard/areas.js)

    // --- LÍNEA TEMPORAL: LÓGICA DE BOTONES ---
    document.querySelectorAll('[data-view]').forEach(button => {
        button.addEventListener('click', function() {
            if (!this.disabled) {
                document.querySelectorAll('[data-view]').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                updateVisualizations();
            }
        });
    });

    // Event listeners para los filtros
    yearFrom.addEventListener('change', updateFilters);
    yearTo.addEventListener('change', updateFilters);
    areaFilter.addEventListener('change', () => {
        const selectedArea = areaFilter.value;
        if (selectedArea && !selectedAreasList.has(selectedArea)) {
            selectedAreasList.add(selectedArea);
            window.selectedAreasList = selectedAreasList;
            createBadge(selectedArea, selectedAreas, selectedAreasList);
            updateFilters();
        }
        areaFilter.value = '';
    });
    institutionFilter.addEventListener('change', () => {
        const selectedInstitution = institutionFilter.value;
        if (selectedInstitution && !selectedInstitutionsList.has(selectedInstitution)) {
            selectedInstitutionsList.add(selectedInstitution);
            window.selectedInstitutionsList = selectedInstitutionsList;
            createBadge(selectedInstitution, selectedInstitutions, selectedInstitutionsList);
            updateFilters();
        }
        institutionFilter.value = '';
    });
    typeFilter.addEventListener('change', () => {
        const selectedType = typeFilter.value;
        if (selectedType && !selectedTypesList.has(selectedType)) {
            selectedTypesList.add(selectedType);
            window.selectedTypesList = selectedTypesList;
            createBadge(selectedType, selectedTypes, selectedTypesList);
            updateFilters();
        }
        typeFilter.value = '';
    });

    // Event listener para limpiar filtros
    clearFiltersBtn.addEventListener('click', () => {
        yearFrom.value = '';
        yearTo.value = '';
        selectedAreasList.clear();
        selectedInstitutionsList.clear();
        selectedTypesList.clear();
        selectedAreas.innerHTML = '';
        selectedInstitutions.innerHTML = '';
        selectedTypes.innerHTML = '';
        updateFilters();
    });

    let renderer = null;
    let showAllLabels = false; // Estado para controlar la visualización de todas las etiquetas

    // Event listener para el botón de mostrar/ocultar etiquetas (con detección robusta de idioma)
    const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
    if (toggleLabelsBtn) {
        // Establecer texto inicial acorde al idioma y estado
        (function setInitialToggleLabel(){
            const langInit = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.split('/')[1] || 'es');
            toggleLabelsBtn.textContent = (langInit === 'es') ? 'Mostrar etiquetas' : 'Show All Labels';
        })();

        toggleLabelsBtn.addEventListener('click', () => {
            if (!renderer) {
                console.warn('[LabelsToggle] Renderer no inicializado todavía');
                return; // Asegurarse de que el renderer existe
            }

            showAllLabels = !showAllLabels; // Alternar el estado
            const lang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.split('/')[1] || 'es');
            const txtShow = (lang === 'es') ? 'Mostrar etiquetas' : 'Show All Labels';
            const txtHide = (lang === 'es') ? 'Ocultar etiquetas extra' : 'Hide Extra Labels';

            if (showAllLabels) {
                // Mostrar todas las etiquetas: ajustar settings para forzar renderizado
                renderer.setSettings({
                    labelDensity: Infinity,
                    labelGridCellSize: 1,
                    labelRenderedSizeThreshold: 0
                });
                toggleLabelsBtn.textContent = txtHide;
            } else {
                // Restaurar comportamiento por defecto
                renderer.setSettings({
                    labelDensity: 1,
                    labelGridCellSize: 200,
                    labelRenderedSizeThreshold: 0
                });
                toggleLabelsBtn.textContent = txtShow;
            }
            console.log('[LabelsToggle] Estado showAllLabels=', showAllLabels, 'Idioma=', lang, 'Texto=', toggleLabelsBtn.textContent);
            renderer.refresh();
        });
    }

    window.currentCommunityView = 'modularity-7'; // Estado para la vista de comunidad activa
    window.currentClusteringModel = null;
    window.currentNClusters = null;
    let isFullNetwork = false;


    // Event listeners para las opciones del menú desplegable de vista de comunidad
    document.querySelectorAll('.dropdown-item.network-community-view').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault(); // Prevenir el comportamiento por defecto del enlace

            const selectedView = this.dataset.communityView; // Obtener el tipo de vista del data-attribute

            // Si ya es la vista actual, no hacer nada
            if (window.currentCommunityView === selectedView) {
                 // Actualizar visualmente el menú para marcar la opción activa (en caso de que no lo estuviera)
                document.querySelectorAll('.dropdown-item.network-community-view').forEach(link => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
                return; // Salir de la función si la vista no cambia
            }

            window.currentCommunityView = selectedView; // Actualizar el estado

            // Actualizar visualmente el menú para marcar la opción activa
            document.querySelectorAll('.dropdown-item.network-community-view').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');

            // Actualizar la red con la nueva vista
            // La función updateVisualizations ya llama a get_collaboration_network
            // y le pasa los parámetros, solo necesitamos que incluya el view_type
            updateCommunityDropdownText();
            updateVisualizations(); // Esto recarga los datos con el nuevo view_type y llama a updateCollaborationNetwork
        });
    });

    // Helper para detección robusta del idioma.
    // NOTE: wrapper kept intentionally, so we don't have to change any call sites yet.
    function detectLangFromPath() {
        return detectLangFromPathUtil();
    }

    function updateCollaborationNetwork(data) {
        const container = document.getElementById('collaborationNetwork');
        if (!container) return;
    
        const cardTitle = document.querySelector('#collaborationNetwork').closest('.card').querySelector('.card-title');
        const currentLang = detectLangFromPath();
        const toggleButton = document.getElementById('toggleFullNetworkBtn');
    
        if (data.is_author_view) {
            const selectedAuthor = data.nodes.find(node => node.is_selected);
            if (selectedAuthor) {
                cardTitle.textContent = currentLang === 'es'
                    ? `Colaboraciones de ${selectedAuthor.label}`
                    : `Collaborations of ${selectedAuthor.label}`;
            }
            document.querySelector('#communityViewDropdown').closest('.dropdown').style.display = 'none';
            toggleButton.style.display = 'none';
        } else {
            document.querySelector('#communityViewDropdown').closest('.dropdown').style.display = 'block';
            updateCommunityDropdownText(
                data.model || null,
                data.n_clusters || null
            );

            // Ocultar el botón de toggle en todas las vistas de la red completa
            if (window.currentCommunityView === 'keywords') {
                toggleButton.style.display = 'none';
            } else {
                toggleButton.style.display = 'block';
            }

            // Añadir mensaje informativo para red completa
            if (isFullNetwork) {
                // Eliminar mensaje anterior si existe
                const existingMessage = document.getElementById('networkInfoMessage');
                if (existingMessage) {
                    existingMessage.remove();
                }

                let messageText = '';
                if (window.currentCommunityView === 'department') {
                    messageText = currentLang === 'es'
                        ? 'Los investigadores han sido clasificados en departamentos utilizando un Node2VecTransformer y un MLPClassifier. Esta clasificación no es 100% precisa. No aparecen investigadores sin colaboraciones.'
                        : 'Researchers have been classified into departments using a Node2VecTransformer and MLPClassifier. This classification is not 100% accurate. There are no researchers without collaborations.';
                } else if (window.currentCommunityView === 'modularity-7') {
                    messageText = currentLang === 'es'
                        ? 'Se ha utilizado el algoritmo de detección de comunidades Lovaina sobre la red de coautorías completa para agrupar a los investigadores en distintas comunidades. No aparecen investigadores sin colaboraciones.'
                        : 'The Louvain community detection algorithm has been used on the complete co-authorship network to group researchers into different communities. There are no researchers without collaborations.';
                }  else if (window.currentCommunityView === 'modularity-5') {
                    messageText = currentLang === 'es'
                        ? 'Se ha utilizado el algoritmo de detección de comunidades Leiden sobre la red de coautorías completa para agrupar a los investigadores en distintas comunidades. No aparecen investigadores sin colaboraciones.'
                        : 'The Leiden community detection algorithm has been used on the complete co-authorship network to group researchers into different communities. There are no researchers without collaborations.';
                }

                if (messageText) {
                    const cardBody = container.closest('.card-body');
                    const messageDiv = document.createElement('div');
                    messageDiv.id = 'networkInfoMessage';
                    messageDiv.style.cssText = `
                        background-color: #f8f9fa;
                        border-left: 4px solid #0d6efd;
                        padding: 10px 15px;
                        margin: 10px 0;
                        border-radius: 4px;
                        font-size: 0.9rem;
                        color: #666;
                        position: relative;
                    `;

                    const closeButton = document.createElement('button');
                    closeButton.className = 'btn-close';
                    closeButton.style.cssText = `
                        position: absolute;
                        right: 10px;
                        top: 10px;
                        padding: 0.25rem;
                    `;
                    closeButton.onclick = function() {
                        messageDiv.remove();
                    };

                    const messageContent = document.createElement('div');
                    messageContent.textContent = messageText;

                    messageDiv.appendChild(closeButton);
                    messageDiv.appendChild(messageContent);

                    // Insertar el mensaje después del título
                    cardBody.insertBefore(messageDiv, container);
                }
            } else {
                // Eliminar mensaje si no estamos en red completa
                const existingMessage = document.getElementById('networkInfoMessage');
                if (existingMessage) {
                    existingMessage.remove();
                }
            }

            if (window.currentCommunityView === 'keywords') {
                cardTitle.textContent = currentLang === 'es'
                    ? 'Red de coincidencia de palabras clave (entre IPs)'
                    : 'Keyword Coincidence Network (between IPs)';
            } else {
                cardTitle.textContent = currentLang === 'es'
                    ? (isFullNetwork ? 'Red de Coautorías Interactiva Completa' : 'Red de Coautorías Interactiva entre IPs')
                    : (isFullNetwork ? 'Complete Interactive Co-authorship Network' : 'Interactive Co-authorship Network between IPs');
            }
        }
    
        if (renderer) {
            renderer.kill();
            renderer = null;
        }
        container.innerHTML = '';
        const graph = new Graph();
    
        const colorPalette = [
            "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6",
            "#bfef45", "#fabed4", "#469990", "#dcbeff", "#9a6324", "#fffac8", "#800000", "#aaffc3",
            "#808000", "#ffd8b1", "#000075", "#a9a9a9", "#000000", "#6a3d9a", "#b15928", "#1f78b4"
        ];
    
        const colorByCommunity = c => {
            if (c === -1 || isNaN(c)) return '#A9A9A9'; // gris para outliers
            return colorPalette[c % colorPalette.length];
        };
    
        const departmentColorScale = d3.scaleOrdinal()
            .domain(['Departamento 1', 'Departamento 2', 'Departamento 3', 'Unknown'])
            .range(['#1f78b4', '#ff7f0e', '#2ca02c', '#999999']);
    
        // Posicionamiento
        if (data.is_author_view) {
            const centerX = container.clientWidth / 2;
            const centerY = container.clientHeight / 2;
            const radius = 250;
            const authorNode = data.nodes.find(n => n.is_selected);
            if (!authorNode) return;
            authorNode.x = centerX;
            authorNode.y = centerY;
            const coauthors = data.nodes.filter(n => !n.is_selected);
            const angleStep = (2 * Math.PI) / Math.max(coauthors.length, 1);
            coauthors.forEach((node, i) => {
                const angle = i * angleStep;
                node.x = centerX + radius * Math.cos(angle);
                node.y = centerY + radius * Math.sin(angle);
            });
        } else {
            let groupByProp;
            if (window.currentCommunityView === 'department') {
                groupByProp = 'department';
            } else if (window.currentCommunityView === 'modularity-5') {
                groupByProp = 'leiden_community';
            } else if (window.currentCommunityView === 'modularity-7') {
                groupByProp = 'community';  // aquí es lovaina_community en back
            } else {
                groupByProp = 'community';
            }
    
            const groups = [...new Set(data.nodes.map(n => n[groupByProp]))].filter(g => g !== undefined);
            const unknownIndex = groups.indexOf(-1);
            if (unknownIndex > -1) {
                groups.splice(unknownIndex, 1);
                groups.push(-1);
            }
    
            const nodesByGroup = {};
            groups.forEach(group => {
                nodesByGroup[group] = data.nodes.filter(n => n[groupByProp] === group);
            });
    
            const canvasCenterX = container.clientWidth / 2;
            const canvasCenterY = container.clientHeight / 2;
            const totalGroups = groups.length;
            const overallRadius = Math.min(canvasCenterX, canvasCenterY) * 0.8;
            const groupRadius = overallRadius / Math.sqrt(totalGroups) * 0.5;
    
            groups.forEach((group, i) => {
                const nodes = nodesByGroup[group];
                const angleStep = (2 * Math.PI) / Math.max(nodes.length, 5);
                const cx = canvasCenterX + overallRadius * Math.cos((2 * Math.PI * i) / totalGroups);
                const cy = canvasCenterY + overallRadius * Math.sin((2 * Math.PI * i) / totalGroups);
                nodes.forEach((node, j) => {
                    const angle = j * angleStep;
                    node.x = cx + groupRadius * Math.cos(angle);
                    node.y = cy + groupRadius * Math.sin(angle);
                });
            });
        }
    
        data.nodes.forEach(node => {
            const comm = parseInt(node.community);
            const leiden = parseInt(node.leiden_community);
            const dept = node.department;
    
            const nodeColor = data.is_author_view
                ? (node.is_selected ? '#e6194b' : '#bbbbbb')
                : (window.currentCommunityView === 'department'
                    ? departmentColorScale(dept)
                    : (window.currentCommunityView === 'modularity-5'
                        ? colorByCommunity(leiden)
                        : colorByCommunity(comm)));
    
            graph.addNode(node.id, {
                label: node.label,
                x: node.x,
                y: node.y,
                size: node.is_selected ? 18 : 12,
                color: nodeColor,
                highlighted: node.is_selected,
                forceLabel: showAllLabels
            });
        });
    
        data.edges.forEach(edge => {
            if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
                const weight = edge.weight || 1;
                const rawSize = Math.pow(weight, 0.7);
                const edgeSize = Math.min(4.0, Math.max(1.5, rawSize));
                const alpha = Math.min(0.9, 0.5 + 0.05 * weight);
                const edgeColor = `rgba(3, 138, 255, ${alpha.toFixed(2)})`;
                graph.addEdge(edge.source, edge.target, {
                    size: edgeSize,
                    color: edgeColor,
                    type: 'curve'
                });
            }
        });
    
        renderer = new Sigma(graph, container, {
            minCameraRatio: 0.1,
            maxCameraRatio: 10,
            defaultEdgeType: "curve",
            edgeProgramClasses: { curve: EdgeCurveProgram },
            renderLabels: true,
            labelDensity: 1,
            labelGridCellSize: 300,
            labelRenderedSizeThreshold: 0,
            defaultLabelSize: 8,
            zIndex: true,
            enableEdgeHovering: false,
            enableNodeHovering: false,
            enableCamera: false
        });
    
        // Leyenda
        if (!data.is_author_view && !(isFullNetwork && window.currentCommunityView === 'modularity-7') && !(isFullNetwork && window.currentCommunityView === 'modularity-5')) {
            const legend = document.createElement('div');
            legend.id = 'networkLegend';
            Object.assign(legend.style, {
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                backgroundColor: 'rgba(255,255,255,0.95)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                zIndex: 1000,
                boxShadow: '0px 0px 6px rgba(0,0,0,0.1)'
            });
        
            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '6px';
        
            if (window.currentCommunityView === 'department') {
                title.textContent = currentLang === 'es' ? 'Departamentos' : 'Departments';
            } else if (window.currentCommunityView === 'keywords') {
                title.textContent = currentLang === 'es' ? 'Comunidades de Palabras Clave' : 'Keyword Communities';
            } else if (window.currentCommunityView === 'modularity-5' || window.currentCommunityView === 'modularity-7') {
                const k = window.currentCommunityView === 'modularity-7' ? 7 : 5;
                title.textContent = currentLang === 'es'
                    ? `Comunidades (${k})`
                    : `Communities (${k})`;
            } else {
                // Fallback genérico
                title.textContent = currentLang === 'es' ? 'Comunidades' : 'Communities';
            }
        
            legend.appendChild(title);

            const counts = document.createElement('div');
            counts.style.marginBottom = '8px';
            // Bilingual counts (nodes / edges) depending on currentLang
            const nodeWord = currentLang === 'es' ? 'nodos' : 'nodes';
            const edgeWord = currentLang === 'es' ? 'enlaces' : 'edges';
            counts.textContent = `${data.nodes.length} ${nodeWord} / ${data.edges.length} ${edgeWord}`;
            legend.appendChild(counts);
        
            if (window.currentCommunityView === 'department') {
                const departments = [...new Set(data.nodes.map(n => n.department))];
                departments.forEach(dept => {
                    const item = document.createElement('div');
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.marginBottom = '4px';
        
                    const colorBox = document.createElement('div');
                    Object.assign(colorBox.style, {
                        width: '14px',
                        height: '14px',
                        backgroundColor: departmentColorScale(dept),
                        marginRight: '6px',
                        borderRadius: '3px'
                    });
        
                    const label = document.createElement('span');
                    label.textContent = dept;
        
                    item.appendChild(colorBox);
                    item.appendChild(label);
                    legend.appendChild(item);
                });
            } else {
                // === Obtener comunidades ===
                let communities = [];
                if (window.currentCommunityView === 'keywords') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.community)))];
                } else if (window.currentCommunityView === 'modularity-5') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.leiden_community)))];
                } else if (window.currentCommunityView === 'modularity-7') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.community)))];
                }
        
                communities.sort((a, b) => a - b);
        
                communities.forEach((comm, i) => {
                    const item = document.createElement('div');
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.marginBottom = '4px';
        
                    const colorBox = document.createElement('div');
                    Object.assign(colorBox.style, {
                        width: '14px',
                        height: '14px',
                        backgroundColor: colorByCommunity(comm),
                        marginRight: '6px',
                        borderRadius: '3px'
                    });
        
                    const label = document.createElement('span');
                    if (comm === -1 || isNaN(comm)) {
                        label.textContent = currentLang === 'es' ? 'Atípico' : 'Outlier';
                    } else {
                        const num = (window.currentCommunityView === 'modularity-7') ? (i + 1) : (comm + 1);
                        const word = currentLang === 'es' ? 'Comunidad' : 'Community';
                        label.textContent = `${word} ${num}`;
                    }
        
                    item.appendChild(colorBox);
                    item.appendChild(label);
                    legend.appendChild(item);
                });
            }
        
            container.appendChild(legend);
        }
    
        // Interactividad
        const overlay = document.createElement('div');
        overlay.innerText = currentLang === 'es' ? 'Haz click para activar la red' : 'Click to activate the network';
        Object.assign(overlay.style, {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#333',
            cursor: 'pointer',
            zIndex: 1000,
            borderRadius: getComputedStyle(container).borderRadius
        });
        container.appendChild(overlay);
        overlay.addEventListener('click', () => {
            overlay.remove();
            activateInteractivity();
        });
    
        const tooltip = document.createElement('div');
        Object.assign(tooltip.style, {
            position: 'absolute',
            backgroundColor: '#fff',
            border: '1px solid #aaa',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            pointerEvents: 'none',
            display: 'none',
            zIndex: 1000
        });
        document.body.appendChild(tooltip);
    
        const activateInteractivity = () => {
            renderer.setSettings({
                enableEdgeHovering: true,
                enableNodeHovering: true,
                enableCamera: true
            });
    
            renderer.on('enterNode', ({ node, event }) => {
                const label = graph.getNodeAttribute(node, 'label');
                const neighbors = graph.neighbors(node);
                const lines = [];
                neighbors.forEach(neighbor => {
                    const edge = graph.edge(node, neighbor) || graph.edge(neighbor, node);
                    const weight = graph.getEdgeAttribute(edge, 'size') || 1;
                    const neighborLabel = graph.getNodeAttribute(neighbor, 'label');
                    lines.push(`• ${neighborLabel} (${weight})`);
                });
                tooltip.innerText = `${label}\n${currentLang === 'es' ? 'Colabora con:' : 'Collaborates with:'}\n${lines.join('\n')}`;
                tooltip.style.left = `${event.clientX + 10}px`;
                tooltip.style.top = `${event.clientY + 10}px`;
                tooltip.style.display = 'block';
    
                const visibleNodes = new Set(neighbors);
                visibleNodes.add(node);
                graph.forEachNode(n => {
                    graph.setNodeAttribute(n, 'hidden', !visibleNodes.has(n));
                    graph.setNodeAttribute(n, 'forceLabel', showAllLabels || visibleNodes.has(n));
                });
                graph.forEachEdge(e => {
                    const src = graph.source(e);
                    const tgt = graph.target(e);
                    const visible = visibleNodes.has(src) && visibleNodes.has(tgt);
                    graph.setEdgeAttribute(e, 'hidden', !visible);
                });
            });
    
            renderer.on('leaveNode', () => {
                tooltip.style.display = 'none';
                graph.forEachNode(n => {
                    graph.removeNodeAttribute(n, 'hidden');
                    graph.setNodeAttribute(n, 'forceLabel', showAllLabels);
                });
                graph.forEachEdge(e => graph.removeEdgeAttribute(e, 'hidden'));
            });
        };
    
        renderer.getCamera().animatedReset({ duration: 500 });
    }        
    
               
    document.getElementById('applyClustering').addEventListener('click', () => {
        const configMode = document.querySelector('input[name="configMode"]:checked').value; // 'global' o 'manual'
        const model = document.getElementById('clusteringModel').value;
        const modelConfigMode = document.querySelector('input[name="modelConfigMode"]:checked').value; // 'auto' o 'manual'
    
        let nClusters = document.getElementById('nClusters').value;
        if (model === 'dbscan') {
            nClusters = document.getElementById('dbscanClusters').value;
        } else if (model === 'hdbscan') {
            nClusters = document.getElementById('hdbscanClusters').value;
        } else if (model === 'lovaina') {
            nClusters = document.getElementById('lovainaClusters').value;
        }
    
        // === ESTABLECER LA VISTA EN KEYWORDS ===
        window.currentCommunityView = 'keywords';
        window.currentClusteringModel = model;
        window.currentNClusters = nClusters;
    
        const params = new URLSearchParams({
            communityView: 'keywords',
            clusteringModel: model,
            nClusters: nClusters,
            autoMode: modelConfigMode === 'auto',
            globalMode: configMode === 'global'
        });
    
        // === HACER LA PETICIÓN AL BACKEND ===
        fetch(`/BiblioMetrics/${lang}/api/dashboard/collaboration-network/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error desde backend:', data.error);
                    alert(`Ocurrió un error al generar la red: ${data.error}`);
                    return;
                }
            
                if (!data.nodes || !data.edges) {
                    console.error('Respuesta incompleta del backend:', data);
                    alert('La respuesta del servidor no contiene datos de red válidos.');
                    return;
                }
            
                // Guardar los datos actuales de la red
                window.currentNetworkData = data;
                
                updateCommunityDropdownText(model, nClusters);
                updateCollaborationNetwork(data);
                document.activeElement.blur();
                const modal = bootstrap.Modal.getInstance(document.getElementById('clusteringModal'));
                modal.hide();
            })
            .catch(error => {
                console.error('Error en la petición fetch:', error);
            });
    });
    
    function updateCommunityDropdownText(model = null, nClusters = null) {
        const dropdownButton = document.getElementById('communityViewDropdown');
        if (!dropdownButton) {
            return;
        }
        const currentLang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.split('/')[1] || 'es');
        let text = '';

        if (window.currentCommunityView === 'department') {
            text = currentLang === 'es' ? 'Por Departamento' : 'By Department';
        } else if (window.currentCommunityView === 'modularity-7') {
            if (currentLang === 'es') {
                text = isFullNetwork ? 'Louvain' : 'Louvain (7 comunidades)';
            } else {
                text = isFullNetwork ? 'Louvain' : 'Louvain (7 communities)';
            }
        } else if (window.currentCommunityView === 'modularity-5') {
            if (currentLang === 'es') {
                text = isFullNetwork ? 'Leiden' : 'Leiden (5 comunidades)';
            } else {
                text = isFullNetwork ? 'Leiden' : 'Leiden (5 communities)';
            }
        } else if (window.currentCommunityView === 'keywords') {
            const modelName = model || window.currentClusteringModel;
            const nClustersValue = nClusters || window.currentNClusters;
            if (modelName && nClustersValue) {
                if (currentLang === 'es') {
                    text = `Por palabras clave (${modelName}, ${nClustersValue} clústeres)`;
                } else {
                    text = `By keywords (${modelName}, ${nClustersValue} clusters)`;
                }
            } else {
                text = currentLang === 'es' ? 'Por palabras clave' : 'By keywords';
            }
        }

        dropdownButton.textContent = text;
    }
    
    function updateFilters() {
        const params = new URLSearchParams();
        
        // Añadir filtros de año
        if (yearFrom.value) params.append('year_from', yearFrom.value);
        if (yearTo.value) params.append('year_to', yearTo.value);
    if (citationsFrom && citationsFrom.value) params.append('citations_from', citationsFrom.value);
    if (citationsTo && citationsTo.value) params.append('citations_to', citationsTo.value);
        
        // Añadir filtros de área
        selectedAreasList.forEach(area => params.append('areas', area));
        
        // Añadir filtros de institución
        selectedInstitutionsList.forEach(institution => params.append('institutions', institution));
        
        // Añadir filtros de tipo
        selectedTypesList.forEach(type => params.append('types', type));
    selectedQuartilesList.forEach(q => params.append('quartiles', q));
    // metric_source not appended (always WoS)

        // Añadir autor seleccionado si existe
        if (selectedAuthorName) {
            params.append('author', selectedAuthorName);
        }

        // Extraer el idioma de la URL
        const currentLang = window.location.pathname.split('/')[1];
        const allAreas = currentLang === 'es' ? 'Todas las Áreas' : 'All areas';
        const allInstitutions = currentLang === 'es' ? 'Todas las Instituciones' : 'All Institutions';
        const allTypes = currentLang === 'es' ? 'Todos los tipos' : 'All types';

        // Obtener datos actualizados de los filtros
        fetch(`/BiblioMetrics/${lang}/api/dashboard/filters/?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Actualizar áreas temáticas
                areaFilter.innerHTML = `<option value="">${allAreas}</option>`;
                data.areas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area.name;
                    option.textContent = `${area.name} (${area.count})`;
                    areaFilter.appendChild(option);
                });

                // Actualizar instituciones
                institutionFilter.innerHTML = `<option value="">${allInstitutions}</option>`;
                data.institutions.forEach(institution => {
                    const option = document.createElement('option');
                    option.value = institution.name;
                    option.textContent = `${institution.name} (${institution.count})`;
                    institutionFilter.appendChild(option);
                });

                // Actualizar tipos de publicación
                typeFilter.innerHTML = `<option value="">${allTypes}</option>`;
                data.publication_types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.publication_type;
                    option.textContent = `${type.publication_type} (${type.count})`;
                    typeFilter.appendChild(option);
                });

                // Actualizar cuartiles
                if (quartileFilter) {
                    const qLang2 = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/es/') ? 'es' : 'en');
                    const allQuartiles = qLang2 === 'es' ? 'Todos los cuartiles' : 'All quartiles';
                    quartileFilter.innerHTML = `<option value="">${allQuartiles}</option>`;
                    (data.quartiles || []).forEach(q => {
                        const option = document.createElement('option');
                        option.value = q.quartile;
                        option.textContent = `${q.quartile} (${q.count})`;
                        quartileFilter.appendChild(option);
                    });
                }
                // Rango de citas actualizado
                if (data.citations_range) {
                    const help = document.getElementById('citationsRangeHelp');
                    if (help) {
                        const minC = data.citations_range.min || 0;
                        const maxC = data.citations_range.max || 0;
                        const langRange2 = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                        const rangeLabel2 = langRange2 === 'es' ? 'Rango disponible' : 'Available range';
                        help.textContent = `${rangeLabel2}: ${minC} - ${maxC}`;
                    }
                }
            })
            .catch(error => {
                console.error('Error updating filters:', error);
                // Mostrar un mensaje de error al usuario
                const errorMessage = document.createElement('div');
                errorMessage.className = 'alert alert-danger';
                errorMessage.style.position = 'fixed';
                errorMessage.style.top = '20px';
                errorMessage.style.right = '20px';
                errorMessage.style.zIndex = '9999';
                errorMessage.innerHTML = `
                    <strong>Error:</strong> No se pudieron actualizar los filtros.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                `;
                document.body.appendChild(errorMessage);
                
                // Auto-cerrar el mensaje después de 5 segundos
                setTimeout(() => {
                    errorMessage.remove();
                }, 5000);
            });

        // Actualizar visualizaciones
        updateVisualizations();
    }

    // Listeners para Source y Quartile
    // metric source listener removed
    if (quartileFilter) {
        quartileFilter.addEventListener('change', () => {
            const val = quartileFilter.value;
            if (val && !selectedQuartilesList.has(val)) {
                selectedQuartilesList.add(val);
                createBadge(val, selectedQuartiles, selectedQuartilesList);
            }
            quartileFilter.value = '';
            updateFilters();
        });
    }

    // Listeners rango citas
    if (citationsFrom) citationsFrom.addEventListener('change', () => {
        // Normalizar valores negativos
        if (citationsFrom.value !== '' && parseInt(citationsFrom.value, 10) < 0) citationsFrom.value = 0;
        updateFilters();
    });
    if (citationsTo) citationsTo.addEventListener('change', () => {
        if (citationsTo.value !== '' && parseInt(citationsTo.value, 10) < 0) citationsTo.value = 0;
        updateFilters();
    });

    // Añadir el manejador del botón de red completa
    document.getElementById('toggleFullNetworkBtn').addEventListener('click', function() {
        const button = this;
        const container = document.getElementById('collaborationNetwork');
        const currentLang = detectLangFromPath();
        
        // Deshabilitar el botón y mostrar spinner
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' + 
            (currentLang === 'es' ? 'Cargando...' : 'Loading...');
        
        // Mostrar overlay de carga
        const loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            border-radius: inherit;
        `;
        loadingOverlay.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">${currentLang === 'es' ? 'Cargando...' : 'Loading...'}</span>
            </div>
        `;
        container.appendChild(loadingOverlay);
        
        // Cambiar el estado de la red
        isFullNetwork = !isFullNetwork;
        
        // Actualizar el texto del botón
        button.textContent = currentLang === 'es' 
            ? (isFullNetwork ? 'Mostrar Red de IPs' : 'Mostrar Red Completa')
            : (isFullNetwork ? 'Show IPs Network' : 'Show Full Network');

        // Actualizar el título del card
        const cardTitle = document.querySelector('#collaborationNetwork').closest('.card').querySelector('.card-title');
        cardTitle.textContent = currentLang === 'es'
            ? (isFullNetwork ? 'Red de Coautorías Interactiva Completa' : 'Red de Coautorías Interactiva entre IPs')
            : (isFullNetwork ? 'Complete Interactive Co-authorship Network' : 'Interactive Co-authorship Network between IPs');
        
        // Actualizar la red con el nuevo modo
        const params = new URLSearchParams({
            communityView: window.currentCommunityView,
            fullNetwork: isFullNetwork
        });
        
        if (window.currentClusteringModel) {
            params.append('clusteringModel', window.currentClusteringModel);
            params.append('nClusters', window.currentNClusters);
            params.append('autoMode', 'true');
            params.append('globalMode', 'true');
        }

        // Actualizar las opciones del menú desplegable
        const dropdownItems = document.querySelectorAll('.network-community-view');
        dropdownItems.forEach(item => {
            // Habilitar todas las opciones
            item.classList.remove('disabled');
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
        });

        fetch(`/BiblioMetrics/${lang}/api/dashboard/collaboration-network/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error desde backend:', data.error);
                    alert(`Ocurrió un error al generar la red: ${data.error}`);
                    // Revertir el estado si hay error
                    isFullNetwork = !isFullNetwork;
                    return;
                }
                
                if (!data.nodes || !data.edges) {
                    console.error('Respuesta incompleta del backend:', data);
                    alert('La respuesta del servidor no contiene datos de red válidos.');
                    // Revertir el estado si hay error
                    isFullNetwork = !isFullNetwork;
                    return;
                }
                
                // Guardar los datos actuales de la red
                window.currentNetworkData = data;
                
                // Solo actualizar la red cuando tengamos los nuevos datos
                updateCollaborationNetwork(data);

                // Actualizar visibilidad del botón
                if (!isFullNetwork && (window.currentCommunityView === 'modularity-5' || window.currentCommunityView === 'keywords')) {
                    button.style.display = 'none';
                } else {
                    button.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error en la petición fetch:', error);
            })
            .finally(() => {
                // Eliminar el overlay de carga
                loadingOverlay.remove();
                // Habilitar el botón
                button.disabled = false;
            });
    });

    // También necesitamos actualizar el manejador de cambio de vista
    document.querySelectorAll('.network-community-view').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            if (this.classList.contains('disabled')) return;
            
            const view = this.getAttribute('data-community-view');
            window.currentCommunityView = view;
            
            // Actualizar clases activas
            document.querySelectorAll('.network-community-view').forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            // Si estamos cambiando entre department, modularity-7 o modularity-5, forzar red de IPs
            if ((view === 'department' || view === 'modularity-7' || view === 'modularity-5') && isFullNetwork) {
                isFullNetwork = false;
                const toggleFullNetworkBtn = document.getElementById('toggleFullNetworkBtn');
                const currentLang = window.location.pathname.split('/')[1];
                toggleFullNetworkBtn.textContent = currentLang === 'es' ? 'Mostrar Red Completa' : 'Show Full Network';
            }

            // Ocultar el botón de red completa para ciertas vistas en modo IPs
            const toggleFullNetworkBtn = document.getElementById('toggleFullNetworkBtn');
            if (!isFullNetwork && (view === 'keywords')) {
                toggleFullNetworkBtn.style.display = 'none';
            } else {
                toggleFullNetworkBtn.style.display = 'block';
            }
            
            // Mostrar overlay de carga
            const container = document.getElementById('collaborationNetwork');
            const loadingOverlay = document.createElement('div');
            loadingOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                border-radius: inherit;
            `;
            loadingOverlay.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">${window.location.pathname.split('/')[1] === 'es' ? 'Cargando...' : 'Loading...'}</span>
                </div>
            `;
            container.appendChild(loadingOverlay);
            
            // Actualizar la red
            const params = new URLSearchParams({
                communityView: view,
                fullNetwork: isFullNetwork
            });
            
            if (window.currentClusteringModel) {
                params.append('clusteringModel', window.currentClusteringModel);
                params.append('nClusters', window.currentNClusters);
                params.append('autoMode', 'true');
                params.append('globalMode', 'true');
            }

            fetch(`/BiblioMetrics/${lang}/api/dashboard/collaboration-network/?${params.toString()}`)
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.error('Error desde backend:', data.error);
                        return;
                    }
                    // Solo actualizar la red cuando tengamos los nuevos datos
                    updateCollaborationNetwork(data);
                })
                .catch(error => {
                    console.error('Error en la petición fetch:', error);
                })
                .finally(() => {
                    // Eliminar el overlay de carga
                    loadingOverlay.remove();
                });
        });
    });

    let includePredictedAreas = false;

    // Textos para el botón (es/en)
    const predictedAreasBtnTexts = {
        es: {
            include: 'Incluir áreas predichas por IA',
            exclude: 'Excluir áreas predichas por IA'
        },
        en: {
            include: 'Include AI-predicted areas',
            exclude: 'Exclude AI-predicted areas'
        }
    };

    function updatePredictedAreasBtnText() {
        const btn = document.getElementById('togglePredictedAreasBtn');
        if (!btn) return;
        const langCode = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : ((window.location.pathname.split('/').filter(Boolean).includes('es')) ? 'es' : 'en');
        const dict = predictedAreasBtnTexts[langCode] || predictedAreasBtnTexts.en;
        btn.textContent = includePredictedAreas ? dict.exclude : dict.include;
    }

    function showAreasLoading() {
        let overlay = document.getElementById('areasChartLoading');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'areasChartLoading';
            overlay.style.position = 'absolute';
            overlay.style.top = 0;
            overlay.style.left = 0;
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(255,255,255,0.7)';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.zIndex = 10;
            overlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>';
            const parent = document.getElementById('areasChart').parentElement;
            parent.style.position = 'relative';
            parent.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
        }
    }

    function hideAreasLoading() {
        const overlay = document.getElementById('areasChartLoading');
        if (overlay) overlay.style.display = 'none';
    }

        window.addEventListener('DOMContentLoaded', () => {
        // Map initialization: default to world
        window.currentMapView = 'world'; // 'world' | 'spain'
        initWorldMap('worldmap-container');
        let spainInitialized = false;
        const ensureSpainMap = () => {
            if (!spainInitialized) {
                initSpainMap('worldmap-container');
                spainInitialized = true;
            }
        };
        // Map view toggle buttons
        document.querySelectorAll('[data-map-view]')?.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-map-view');
                if (view === window.currentMapView) return;
                document.querySelectorAll('[data-map-view]')?.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const spainGroup = document.getElementById('spainLevelGroup');
                // Update collaborations card title based on view and language
                const titleEl = document.getElementById('collabCardTitleText');
                const currentLang = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1] === 'es') ? 'es' : 'en';
                if (view === 'spain') {
                    spainGroup?.classList.remove('d-none');
                    ensureSpainMap();
                        // Show Spain overlay and refresh sizes
                        setSpainMapVisible(true);
                        // Optionally hide world map tooltips/overlays if needed
                        if (titleEl) {
                            const langMap = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/es/') ? 'es' : 'en');
                            titleEl.textContent = langMap === 'es' ? 'Colaboraciones Nacionales' : 'National Collaborations';
                        }
                } else {
                    spainGroup?.classList.add('d-none');
                        // Hide Spain overlay when switching back to world
                        setSpainMapVisible(false);
                        if (titleEl) {
                            const langMap = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/es/') ? 'es' : 'en');
                            titleEl.textContent = langMap === 'es' ? 'Colaboraciones Internacionales' : 'International Collaborations';
                        }
                }
                window.currentMapView = view;
                // Refresh visualizations to load the right counts for the selected view
                updateVisualizations();
            });
        });
        // Spain level toggle (CCAA/Provinces)
        document.querySelectorAll('[data-spain-level]')?.forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-spain-level]')?.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const level = btn.getAttribute('data-spain-level');
                showSpainLevel(level);
            });
        });

        const btn = document.getElementById('togglePredictedAreasBtn');
        if (btn) {
            btn.addEventListener('click', function() {
                showAreasLoading();
                includePredictedAreas = !includePredictedAreas;
                updatePredictedAreasBtnText();
                updateVisualizations();
            });
            updatePredictedAreasBtnText();
        }
        setupExportReportButton();
    });
}