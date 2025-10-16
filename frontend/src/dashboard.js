// filters_search.js
import * as d3 from 'd3';
import Graph from 'graphology';
import Sigma from 'sigma';
import EdgeCurveProgram from "@sigma/edge-curve";
import { setupExportReportButton } from './export_report';
import { initWorldMap, setWorldMapActiveCountries, setWorldMapLoading } from './worldmap.js';
import { initSpainMap, setSpainMapCounts, showSpainLevel, setSpainMapLoading, setSpainMapVisible } from './spainmap.js';

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
        const currentLang = window.location.pathname.split('/')[1];
        const searchResults = currentLang === 'es' ? 'Resultados de la búsqueda' : 'Search Results';

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

        // Actualizar el contenido del modal
        const resultsList = document.getElementById('searchResultsList');
        if (results.length === 0) {
            resultsList.innerHTML = '<p class="text-center">No se encontraron resultados.</p>';
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
                            <strong>Autores:</strong> ${authors}${otherAuthors}<br>
                            <strong>Instituciones:</strong> ${result.institutions.join(', ')}<br>
                            <strong>Áreas:</strong> ${result.areas.join(', ')}
                        </p>
                        ${result.url ? `<a href="${result.url}" class="card-link" target="_blank">Ver publicación</a>` : ''}
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
        const currentLang = window.location.pathname.split('/')[1];
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
                    const areas = Array.isArray(r.areas) ? r.areas.join(', ') : (r.areas || '');
                    const pubType = r.publication_type || '';
                    const year = r.year || '';
                    const urlLink = r.url ? `<a href="${r.url}" class="card-link" target="_blank">${currentLang === 'es' ? 'Ver publicación' : 'View publication'}</a>` : '';

                    return `
                        <div class="card mb-3">
                            <div class="card-body" data-publication-id="${r.id}" style="cursor: pointer;">
                                <div class="d-flex justify-content-between">
                                    <div>
                                        <h5 class="card-title mb-1">${r.title}</h5>
                                        <h6 class="card-subtitle mb-2 text-muted">${year} ${pubType ? '- ' + pubType : ''}</h6>
                                    </div>
                                    ${simText}
                                </div>
                                <p class="card-text mb-1"><strong>${currentLang === 'es' ? 'Autores' : 'Authors'}:</strong> ${authors}${otherAuthors}</p>
                                <p class="card-text mb-1"><strong>${currentLang === 'es' ? 'Áreas' : 'Areas'}:</strong> ${areas}</p>
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
        if (currentAreasView === 'pie') {
            updateAreasChart(data);
        } else {
            updateAreasBarChart(data);
        }
        hideAreasLoading();
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
                                console.log('[WorldMap] Counts by ISO (server-side aggregation):', countsByIso);
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
        // Limpiar el contenedor
        d3.select('#timelineChart').html('');

        // Configuración del gráfico
        const margin = {top: 20, right: 20, bottom: 70, left: 60};
        // Extra gap to separate the rotated Y-axis label from the tick labels / axis line
        const yAxisLabelExtraGap = 10;  // increase if still too close
        const width = document.getElementById('timelineChart').clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        // Crear el SVG
        const svg = d3.select('#timelineChart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('display', 'block')
            .style('margin', '0 auto')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Escalas
        let x;
        if (viewType === 'monthly') {
            // Escala para meses
            x = d3.scaleLinear()
                .domain([1, 12])
                .range([0, width]);
        } else {
            // Escala para años
            x = d3.scaleLinear()
                .domain(d3.extent(data, d => d.year))
                .range([0, width]);
        }

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .nice()
            .range([height, 0]);

        // Ejes
        let xAxis;
        if (viewType === 'monthly') {
            xAxis = d3.axisBottom(x)
                .ticks(12)
                .tickFormat(d => {
                    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    return months[d - 1];
                });
        } else {
            xAxis = d3.axisBottom(x)
                .ticks(width / 80)
                .tickFormat(d3.format('d'));
        }

        const yAxis = d3.axisLeft(y)
            .ticks(height / 40);

        // Añadir ejes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'middle');

        svg.append('g')
            .call(yAxis);

        // Línea
        const line = d3.line()
            .x(d => viewType === 'monthly' ? x(d.month) : x(d.year))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Área
        const area = d3.area()
            .x(d => viewType === 'monthly' ? x(d.month) : x(d.year))
            .y0(height)
            .y1(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Añadir área
        svg.append('path')
            .datum(data)
            .attr('fill', '#e3f2fd')
            .attr('d', area);

        // Añadir línea
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', '#2196f3')
            .attr('stroke-width', 2)
            .attr('d', line);

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.opacity = 0;
        tooltip.style.position = 'absolute';
        tooltip.style.backgroundColor = 'rgba(255,255,255,0.95)';
        tooltip.style.border = '1px solid #2196f3';
        tooltip.style.borderRadius = '4px';
        tooltip.style.padding = '6px 10px';
        tooltip.style.fontSize = '13px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '1000';
        tooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        document.body.appendChild(tooltip);

        // Info box para el clic
        const infoBox = document.createElement('div');
        infoBox.className = 'info-box';
        infoBox.style.display = 'none';
        infoBox.style.position = 'absolute';
        infoBox.style.backgroundColor = 'white';
        infoBox.style.border = '2px solid #2196f3';
        infoBox.style.borderRadius = '6px';
        infoBox.style.padding = '10px 15px';
        infoBox.style.fontSize = '14px';
        infoBox.style.zIndex = '1000';
        infoBox.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        infoBox.style.pointerEvents = 'none';
        document.body.appendChild(infoBox);

        // Añadir puntos y eventos de tooltip y click
        svg.selectAll('.point')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'point')
            .attr('cx', d => viewType === 'monthly' ? x(d.month) : x(d.year))
            .attr('cy', d => y(d.count))
            .attr('r', 5)
            .attr('fill', '#2196f3')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('r', 7)
                    .attr('fill', '#1976d2');
                tooltip.style.opacity = 1;
                
                let tooltipContent;
                if (viewType === 'monthly') {
                    const months = (function(){
                        const langTL = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                        const monthsES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                        const monthsEN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                        return langTL === 'es' ? monthsES : monthsEN;
                    })();
                    const langTL = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    const TL_I18N_LOCAL = {
                        publications: { es: 'Publicaciones', en: 'Publications' }
                    };
                    const tLoc = (k) => (TL_I18N_LOCAL[k] && TL_I18N_LOCAL[k][langTL]) || k;
                    tooltipContent = `<b>${months[d.month - 1]}</b><br><b>${tLoc('publications')}:</b> ${d.count}`;
                } else {
                    const langTL = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    const TL_I18N_LOCAL = {
                        year: { es: 'Año', en: 'Year' },
                        publications: { es: 'Publicaciones', en: 'Publications' }
                    };
                    const tLoc = (k) => (TL_I18N_LOCAL[k] && TL_I18N_LOCAL[k][langTL]) || k;
                    tooltipContent = `<b>${tLoc('year')}:</b> ${d.year}<br><b>${tLoc('publications')}:</b> ${d.count}`;
                }
                
                tooltip.innerHTML = tooltipContent;
                tooltip.style.left = `${event.pageX + 10}px`;
                tooltip.style.top = `${event.pageY + 10}px`;
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 5)
                    .attr('fill', '#2196f3');
                tooltip.style.opacity = 0;
            })
            .on('click', function(event, d) {
                event.stopPropagation();
                
                // Ocultar cualquier info box existente
                d3.selectAll('.info-box').style('display', 'none');
                
                // Calcular la posición relativa al contenedor del gráfico
                const containerRect = document.getElementById('timelineChart').getBoundingClientRect();
                const xPos = event.clientX - containerRect.left;
                const yPos = event.clientY - containerRect.top;
                
                // Obtener las dimensiones del info box
                const infoBoxWidth = 120;
                const infoBoxHeight = 60;
                
                // Calcular la posición final del info box
                let finalX = xPos;
                let finalY = yPos - infoBoxHeight - 10;
                
                // Ajustar la posición horizontal para que no se salga del gráfico
                if (finalX + infoBoxWidth/2 > containerRect.width) {
                    finalX = containerRect.width - infoBoxWidth/2;
                } else if (finalX - infoBoxWidth/2 < 0) {
                    finalX = infoBoxWidth/2;
                }
                
                // Ajustar la posición vertical si se sale por arriba
                if (finalY < 0) {
                    finalY = yPos + 10;
                }
                
                // Mostrar el nuevo info box
                let infoBoxContent;
                if (viewType === 'monthly') {
                    const months = (function(){
                        const langTL = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                        const monthsES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                        const monthsEN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                        return langTL === 'es' ? monthsES : monthsEN;
                    })();
                    const langTL = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    const TL_I18N_LOCAL = { publications: { es: 'Publicaciones', en: 'Publications' } };
                    const tLoc = (k) => (TL_I18N_LOCAL[k] && TL_I18N_LOCAL[k][langTL]) || k;
                    infoBoxContent = `
                        <div style="font-weight: bold; margin-bottom: 5px;">${months[d.month - 1]}</div>
                        <div>${tLoc('publications')}: ${d.count}</div>
                    `;
                } else {
                    const langTL = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    const TL_I18N_LOCAL = {
                        year: { es: 'Año', en: 'Year' },
                        publications: { es: 'Publicaciones', en: 'Publications' }
                    };
                    const tLoc = (k) => (TL_I18N_LOCAL[k] && TL_I18N_LOCAL[k][langTL]) || k;
                    infoBoxContent = `
                        <div style="font-weight: bold; margin-bottom: 5px;">${tLoc('year')} ${d.year}</div>
                        <div>${tLoc('publications')}: ${d.count}</div>
                    `;
                }
                
                infoBox.innerHTML = infoBoxContent;
                infoBox.style.display = 'block';
                infoBox.style.left = `${finalX - infoBoxWidth/2}px`;
                infoBox.style.top = `${finalY}px`;
            });

        // Añadir evento de clic en el SVG para cerrar el info box
        svg.on('click', function(event) {
            if (!event.target.classList.contains('point')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });

        // Añadir evento de clic en el documento para cerrar el info box
        document.addEventListener('click', function(event) {
            if (!event.target.closest('#timelineChart')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });

        // Añadir evento de clic en el contenedor del gráfico
        document.getElementById('timelineChart').addEventListener('click', function(event) {
            if (!event.target.closest('.point')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });

        // Diccionario i18n para timeline y tooltips
        const langTL = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
        const TL_I18N = {
            yAxis: { es: 'Número de publicaciones', en: 'Number of publications' },
            xMonth: { es: 'Mes', en: 'Month' },
            xYear: { es: 'Año', en: 'Year' },
            publications: { es: 'Publicaciones', en: 'Publications' },
            yearLabel: { es: 'Año', en: 'Year' }
        };
        const tTL = (k) => (TL_I18N[k] && TL_I18N[k][langTL]) || k;

        // Añadir título del eje Y (bilingüe)
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            // Move further left (more negative) so it does not overlap the axis ticks
            .attr('y', 0 - margin.left + yAxisLabelExtraGap)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(tTL('yAxis'));

        // Añadir título del eje X (bilingüe)
        svg.append('text')
            .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 30})`)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(viewType === 'monthly' ? tTL('xMonth') : tTL('xYear'));

        // Añadir mensaje informativo sobre publicaciones sin mes
        if (viewType === 'monthly' && timelineInfo && timelineInfo.no_month_count > 0) {
            const infoMessage = d3.select('#timelineChart')
                .append('div')
                .attr('class', 'alert alert-info')
                .style('position', 'absolute')
                .style('top', '50px')  // Cambiado de 10px a 50px para que aparezca más abajo
                .style('right', '10px')
                .style('padding', '8px 12px')
                .style('font-size', '12px')
                .style('border-radius', '4px')
                .style('background-color', '#e3f2fd')
                .style('border', '1px solid #2196f3')
                .style('color', '#0d47a1')
                .style('z-index', '1000')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('gap', '8px')
                .style('max-width', '300px');

            const percentage = ((timelineInfo.no_month_count / timelineInfo.total_count) * 100).toFixed(1);
            
            // Crear el contenido del mensaje
            (function(){
                const langInfo = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                const I18N_MISSING_MONTH = {
                    part1: { es: 'publicación(es) sin mes asignado', en: 'publication(s) without an assigned month' },
                    part2: { es: 'se han contabilizado en enero', en: 'have been counted in January' }
                };
                const txt = `${timelineInfo.no_month_count} ${I18N_MISSING_MONTH.part1[langInfo]} ${I18N_MISSING_MONTH.part2[langInfo]}`;
                infoMessage.html(`
                    <div style="flex-grow: 1;">
                        <i class="fas fa-info-circle"></i>
                        ${txt}
                    </div>
                    <button type="button" class="btn-close" style="font-size: 0.7rem;" aria-label="Close"></button>
                `);
            })();

            // Añadir evento para cerrar el mensaje
            infoMessage.select('.btn-close').on('click', function() {
                infoMessage.remove();
            });
        }
    }

    // -------------------------------------------------------------
    // Export Timeline Image (Yearly or Monthly active view)
    // -------------------------------------------------------------
    (function initTimelineExporter(){
        if (typeof window === 'undefined') return;
        const btn = document.getElementById('exportTimelineBtn');
        if (!btn || btn.__timelineExporterBound) return;
        btn.__timelineExporterBound = true;
        btn.addEventListener('click', async () => {
            try {
                const container = document.getElementById('timelineChart');
                if (!container) return;
                const svgEl = container.querySelector('svg');
                if (!svgEl) {
                    alert('No chart to export');
                    return;
                }

                // Clone SVG to avoid mutating original
                const clone = svgEl.cloneNode(true);
                // Inline styles for fonts/colors if needed (basic approach)
                clone.querySelectorAll('*').forEach(n => {
                    const cs = window.getComputedStyle(n);
                    n.setAttribute('font-family', cs.fontFamily);
                    n.setAttribute('font-size', cs.fontSize);
                    if (cs.fill && cs.fill !== 'none') n.setAttribute('fill', cs.fill);
                    if (cs.stroke && cs.stroke !== 'none') n.setAttribute('stroke', cs.stroke);
                });

                // Wrap in a temporary SVG with extra top margin to add title.
                const origWidth = parseInt(clone.getAttribute('width')) || container.clientWidth;
                const origHeight = parseInt(clone.getAttribute('height')) || container.clientHeight;
                const titleText = document.querySelector('[data-view].active')?.textContent || 'Timeline';
                const exportTitle = (function(){
                    const langExp = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    return langExp === 'es' ? 'Línea de tiempo de publicaciones' : 'Publications timeline';
                })();
                const titleMargin = 40; // space for title
                const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                // High quality scaling (2x) for sharper PNG
                const scaleFactor = 2;
                exportSvg.setAttribute('width', String(origWidth * scaleFactor));
                exportSvg.setAttribute('height', String((origHeight + titleMargin) * scaleFactor));
                exportSvg.setAttribute('viewBox', `0 0 ${origWidth} ${origHeight + titleMargin}`);
                exportSvg.setAttribute('shape-rendering', 'geometricPrecision');
                exportSvg.setAttribute('text-rendering', 'geometricPrecision');

                // Title element
                const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                titleEl.setAttribute('x', String(origWidth / 2));
                titleEl.setAttribute('y', '24');
                titleEl.setAttribute('text-anchor', 'middle');
                titleEl.setAttribute('font-size', '18');
                titleEl.setAttribute('font-family', 'Arial, sans-serif');
                titleEl.setAttribute('fill', '#111');
                titleEl.textContent = exportTitle;
                exportSvg.appendChild(titleEl);

                // Shift original group down
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(0, ${titleMargin})`);
                // Remove existing transform nesting issues by copying children
                Array.from(clone.childNodes).forEach(ch => g.appendChild(ch));
                exportSvg.appendChild(g);

                // Serialize
                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(exportSvg);
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                // Convert to PNG via canvas (using offscreen img)
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                        }
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        const a = document.createElement('a');
                        a.download = `publication_timeline_${ts}.png`;
                        a.href = canvas.toDataURL('image/png');
                        a.click();
                    } finally {
                        URL.revokeObjectURL(url);
                    }
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    alert('Failed to export image');
                };
                img.src = url;
            } catch (err) {
                console.error('[Timeline][Export] Failed', err);
                alert('Failed to export image');
            }
        });
    })();

    // -------------------------------------------------------------
    // Export Areas Distribution (Pie o Bar activo)
    // -------------------------------------------------------------
    (function initAreasExporter(){
        if (typeof window === 'undefined') return;
        const btn = document.getElementById('exportAreasBtn');
        if (!btn || btn.__areasExporterBound) return;
        btn.__areasExporterBound = true;
        btn.addEventListener('click', () => {
            try {
                const container = document.getElementById('areasChart');
                if (!container) return;
                const svgEl = container.querySelector('svg');
                if (!svgEl) { alert('No chart to export'); return; }

                const clone = svgEl.cloneNode(true);
                clone.querySelectorAll('*').forEach(n => {
                    const cs = window.getComputedStyle(n);
                    n.setAttribute('font-family', cs.fontFamily);
                    n.setAttribute('font-size', cs.fontSize);
                    if (cs.fill && cs.fill !== 'none') n.setAttribute('fill', cs.fill);
                    if (cs.stroke && cs.stroke !== 'none') n.setAttribute('stroke', cs.stroke);
                });

                const origWidth = parseInt(clone.getAttribute('width')) || container.clientWidth;
                let origHeight = parseInt(clone.getAttribute('height')) || container.clientHeight;
                const isBar = document.querySelector('[data-areas-view="bar"]')?.classList.contains('active');
                const exportTitle = (function(){
                    const langExp2 = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    if (langExp2 === 'es') return isBar ? 'Distribución de áreas (Barras)' : 'Distribución de áreas (Circular)';
                    return isBar ? 'Areas distribution (Bars)' : 'Areas distribution (Pie)';
                })();
                const titleMargin = 40;
                // Reduced extra margins (user request: "algo menos")
                const bottomExtra = isBar ? 130 : 0;  // was 170
                const leftExtra = isBar ? 70 : 0;     // was 90
                let exportWidth = origWidth + leftExtra;
                if (isBar) {
                    // Mostrar y rotar etiquetas del eje X
                    const xAxisTexts = clone.querySelectorAll('.areas-x-axis text');
                    xAxisTexts.forEach(t => {
                        t.style.display = 'block';
                        t.setAttribute('transform', 'rotate(-48)');
                        t.setAttribute('text-anchor', 'end');
                        t.setAttribute('dx', '-0.35em');
                        t.setAttribute('dy', '0.3em');
                        t.setAttribute('font-size', '9px');
                    });
                    // Reposicionar título del eje X debajo de las etiquetas rotadas
                    const xAxisTitle = clone.querySelector('.x-axis-title');
                    if (xAxisTitle) {
                        const match = /translate\([^,]+,\s*([^\)]+)\)/.exec(xAxisTitle.getAttribute('transform') || '');
                        let baseY = match ? parseFloat(match[1]) : (origHeight - 10);
                        baseY += 85; // slightly less due to reduced bottomExtra
                        // Recalcular centrado usando extensión real de las barras del clon
                        let calculatedCenter = origWidth / 2;
                        try {
                            const bars = clone.querySelectorAll('.bar');
                            if (bars.length > 0) {
                                let minX = Infinity; let maxX = -Infinity;
                                bars.forEach(b => {
                                    const xVal = parseFloat(b.getAttribute('x')) || 0;
                                    const wVal = parseFloat(b.getAttribute('width')) || 0;
                                    if (xVal < minX) minX = xVal;
                                    if (xVal + wVal > maxX) maxX = xVal + wVal;
                                });
                                if (isFinite(minX) && isFinite(maxX)) {
                                    calculatedCenter = (minX + maxX) / 2;
                                }
                            }
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.warn('[Areas][Export][Bar] No se pudo recalcular centro X para título:', e);
                        }
                        // Nota: no sumar leftExtra aquí porque el grupo externo ya aplica esa traslación
                        xAxisTitle.setAttribute('transform', `translate(${calculatedCenter}, ${baseY})`);
                    }
                    // Ajustar título eje Y más afuera y más abajo (coordenadas ya rotadas)
                    const yAxisTitle = clone.querySelector('.y-axis-title');
                    if (yAxisTitle) {
                        const curY = parseFloat(yAxisTitle.getAttribute('y')) || 0;
                        yAxisTitle.setAttribute('y', (curY - 20)); // menos separación externa ahora
                        const curX = parseFloat(yAxisTitle.getAttribute('x')) || 0;
                        yAxisTitle.setAttribute('x', (curX + 25)); // ajuste vertical suave
                    }
                    origHeight += bottomExtra;
                }
                const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                // Improve quality: upscale exported SVG (will rasterize sharper)
                const scaleFactor = 2; // 2x resolution
                exportSvg.setAttribute('width', String(exportWidth * scaleFactor));
                exportSvg.setAttribute('height', String((origHeight + titleMargin) * scaleFactor));
                exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${origHeight + titleMargin}`);
                exportSvg.setAttribute('shape-rendering', 'geometricPrecision');
                exportSvg.setAttribute('text-rendering', 'geometricPrecision');

                const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                titleEl.setAttribute('x', String(leftExtra + origWidth / 2));
                titleEl.setAttribute('y', '24');
                titleEl.setAttribute('text-anchor', 'middle');
                titleEl.setAttribute('font-size', '18');
                titleEl.setAttribute('font-family', 'Arial, sans-serif');
                titleEl.setAttribute('fill', '#111');
                titleEl.textContent = exportTitle;
                exportSvg.appendChild(titleEl);

                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(${leftExtra}, ${titleMargin})`);
                Array.from(clone.childNodes).forEach(ch => g.appendChild(ch));
                exportSvg.appendChild(g);

                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(exportSvg);
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                        }
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0);
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        const a = document.createElement('a');
                        a.download = isBar ? `areas_distribution_bar_${ts}.png` : `areas_distribution_pie_${ts}.png`;
                        a.href = canvas.toDataURL('image/png');
                        a.click();
                    } finally {
                        URL.revokeObjectURL(url);
                    }
                };
                img.onerror = () => { URL.revokeObjectURL(url); alert('Failed to export image'); };
                img.src = url;
            } catch (err) {
                console.error('[Areas][Export] Failed', err);
                alert('Failed to export image');
            }
        });
    })();

    // -------------------------------------------------------------
    // i18n dictionary for Areas (Pie & Bar) charts
    // -------------------------------------------------------------
    const AREAS_I18N = {
        publications: { es: 'Publicaciones', en: 'Publications' },
        percentage: { es: 'Porcentaje', en: 'Percentage' },
        pubsAbbrev: { es: 'pubs', en: 'pubs' },
        yAxis: { es: 'Número de publicaciones', en: 'Number of publications' },
        xAxis: { es: 'Áreas temáticas', en: 'Thematic areas' },
        others: { es: 'Otras', en: 'Others' }
    };
    function tAreas(key) {
        const lang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
        return (AREAS_I18N[key] && AREAS_I18N[key][lang]) || key;
    }

    function updateAreasChart(data) {
        // Filtrar valores nulos
        data = data.filter(d => d.thematic_areas__name !== null);

        // Limpiar el contenedor
        d3.select('#areasChart').html('');

        // Configuración del gráfico
        const margin = {top: 20, right: 150, bottom: 20, left: 20}; // Aumentado el margen derecho para la leyenda
        const width = document.getElementById('areasChart').clientWidth - margin.left - margin.right;
        const height = 320 - margin.top - margin.bottom;
        const radius = Math.min(width, height) / 2;

        // Crear el SVG
        const svg = d3.select('#areasChart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('display', 'block')
            .style('margin', '0 auto')
            .style('min-width', '550px')
            .append('g')
            .attr('transform', `translate(${radius + margin.left},${height/2 + margin.top})`);

        // Escala de colores
        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.thematic_areas__name))
            .range(d3.schemeCategory10);

        // Crear el pie chart
        const pie = d3.pie()
            .value(d => d.count)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        // Info box para el clic
        const infoBox = d3.select('#areasChart')
            .append('div')
            .attr('class', 'info-box')
            .style('display', 'none')
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('border', '2px solid #2196f3')
            .style('border-radius', '6px')
            .style('padding', '10px 15px')
            .style('font-size', '14px')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 8px rgba(0,0,0,0.1)')
            .style('pointer-events', 'none');

        // Añadir los segmentos del pie
        svg.selectAll('path')
            .data(pie(data))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.thematic_areas__name))
            .attr('stroke', 'white')
            .style('stroke-width', '2px')
            .style('cursor', 'pointer')
            .on('click', function(event, d) {
                event.stopPropagation();
                d3.selectAll('.info-box').style('display', 'none');
                // Calcular la posición relativa al contenedor del gráfico
                const containerRect = document.getElementById('areasChart').getBoundingClientRect();
                const xPos = event.clientX - containerRect.left;
                const yPos = event.clientY - containerRect.top;
                // Dimensiones del info box
                const infoBoxWidth = 180;
                const infoBoxHeight = 70;
                let finalX = xPos;
                let finalY = yPos - infoBoxHeight - 10;
                if (finalX + infoBoxWidth/2 > containerRect.width) {
                    finalX = containerRect.width - infoBoxWidth/2;
                } else if (finalX - infoBoxWidth/2 < 0) {
                    finalX = infoBoxWidth/2;
                }
                if (finalY < 0) {
                    finalY = yPos + 10;
                }
                const percentage = (d.data.count / d3.sum(data, d => d.count) * 100).toFixed(1);
                const infoBoxContent = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${d.data.thematic_areas__name}</div>
                    <div>${tAreas('publications')}: ${d.data.count}</div>
                    <div>${tAreas('percentage')}: ${percentage}%</div>
                `;
                // Cambiar el borde del info box al color del segmento
                const borderColor = color(d.data.thematic_areas__name);
                infoBox.html(infoBoxContent)
                    .style('display', 'block')
                    .style('left', (finalX - infoBoxWidth/2) + 'px')
                    .style('top', finalY + 'px')
                    .style('border', `2px solid ${borderColor}`);
            });

        // Añadir la leyenda
        const legend = svg.append('g')
            .attr('transform', `translate(${radius + 20}, ${-height/2})`);

        const legendItem = legend.selectAll('.legend-item')
            .data(data)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`);

        legendItem.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', d => color(d.thematic_areas__name));

        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 12)
            .style('font-size', '10px')
            .text(d => {
                const name = d.thematic_areas__name;
                const percentage = (d.count / d3.sum(data, d => d.count) * 100).toFixed(1);
                return `${name} (${d.count} ${tAreas('pubsAbbrev')}, ${percentage}%)`;
            });

        // Cerrar info box al pinchar fuera
        document.getElementById('areasChart').addEventListener('click', function(event) {
            if (!event.target.closest('path')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });
        document.addEventListener('click', function(event) {
            if (!event.target.closest('#areasChart')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });
        hideAreasLoading();
    }

    function updateAreasBarChart(data) {
        // Filtrar valores nulos
        data = data.filter(d => d.thematic_areas__name !== null);
    
        // Agrupar las áreas menos representativas en 'Otras'
        const N = 25;
        if (data.length > N) {
            const sorted = data.slice().sort((a, b) => b.count - a.count);
            const topN = sorted.slice(0, N);
            const rest = sorted.slice(N);
            const otrasCount = rest.reduce((sum, d) => sum + d.count, 0);
            data = [...topN, {thematic_areas__name: tAreas('others'), count: otrasCount}];
        }
    
        // Limpiar el contenedor
        d3.select('#areasChart').html('');
    
        // Dimensiones y márgenes
        const margin = { top: 20, right: 20, bottom: 30, left: 60 };
        const width = document.getElementById('areasChart').clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;
    
        const svg = d3.select('#areasChart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('display', 'block')
            .style('margin', '0 auto')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
    
        const x = d3.scaleBand()
            .domain(data.map(d => d.thematic_areas__name))
            .range([0, width])
            .padding(0.2);
    
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .nice()
            .range([height, 0]);
    
        // Eje X con etiquetas (se ocultan para vista en pantalla, se mostrarán en exportación)
        const xAxisGroup = svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .attr('class', 'areas-x-axis')
            .call(d3.axisBottom(x));
        xAxisGroup.selectAll('text')
            .style('display', 'none')
            .style('font-size', '9px');
    
        svg.append('g')
            .call(d3.axisLeft(y).ticks(height / 40));
    
        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.thematic_areas__name))
            .range(d3.schemeCategory10);
    
        // Info box para el clic
        const infoBox = d3.select('#areasChart')
            .append('div')
            .attr('class', 'info-box')
            .style('display', 'none')
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('border', '2px solid #2196f3')
            .style('border-radius', '6px')
            .style('padding', '10px 15px')
            .style('font-size', '14px')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 8px rgba(0,0,0,0.1)')
            .style('pointer-events', 'none');
    
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.thematic_areas__name))
            .attr('y', d => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => height - y(d.count))
            .attr('fill', d => color(d.thematic_areas__name))
            .style('cursor', 'pointer')
            .on('click', function(event, d) {
                event.stopPropagation();
                d3.selectAll('.info-box').style('display', 'none');
                const containerRect = document.getElementById('areasChart').getBoundingClientRect();
                const xPos = event.clientX - containerRect.left;
                const yPos = event.clientY - containerRect.top;
                const infoBoxWidth = 180;
                const infoBoxHeight = 70;
                let finalX = xPos;
                let finalY = yPos - infoBoxHeight - 10;
                if (finalX + infoBoxWidth/2 > containerRect.width) {
                    finalX = containerRect.width - infoBoxWidth/2;
                } else if (finalX - infoBoxWidth/2 < 0) {
                    finalX = infoBoxWidth/2;
                }
                if (finalY < 0) {
                    finalY = yPos + 10;
                }
                const percentage = (d.count / d3.sum(data, d => d.count) * 100).toFixed(1);
                const infoBoxContent = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${d.thematic_areas__name}</div>
                    <div>${tAreas('publications')}: ${d.count}</div>
                    <div>${tAreas('percentage')}: ${percentage}%</div>
                `;
                const borderColor = color(d.thematic_areas__name);
                infoBox.html(infoBoxContent)
                    .style('display', 'block')
                    .style('left', (finalX - infoBoxWidth/2) + 'px')
                    .style('top', finalY + 'px')
                    .style('border', `2px solid ${borderColor}`);
            });
    
        // Cerrar info box al pinchar fuera
        document.getElementById('areasChart').addEventListener('click', function(event) {
            if (!event.target.closest('rect')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });
        document.addEventListener('click', function(event) {
            if (!event.target.closest('#areasChart')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });
    
        // Títulos
        // Título eje Y con más separación respecto al eje
        svg.append('text')
            .attr('class', 'y-axis-title')
            .attr('transform', 'rotate(-90)')
            // Ajuste más cercano al eje (menos negativo)
            .attr('y', -margin.left - 2)
            .attr('x', -height / 2)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(tAreas('yAxis'));
    
        // Añadir título del eje X
        svg.append('text')
            .attr('class', 'x-axis-title')
            .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 20})`)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(tAreas('xAxis'));

        // Recentrar el título del eje X según las barras reales (por si visualmente parece corrido)
        try {
            const bars = svg.selectAll('.bar').nodes();
            if (bars.length > 0) {
                let minX = Infinity; let maxX = -Infinity; let barWidthRef = 0;
                bars.forEach(b => {
                    const xVal = parseFloat(b.getAttribute('x')) || 0;
                    const wVal = parseFloat(b.getAttribute('width')) || 0;
                    if (xVal < minX) minX = xVal;
                    if (xVal + wVal > maxX) maxX = xVal + wVal;
                    barWidthRef = wVal; // última referencia (no crítico)
                });
                if (isFinite(minX) && isFinite(maxX)) {
                    const centerBars = (minX + maxX) / 2;
                    svg.select('.x-axis-title')
                        .attr('transform', `translate(${centerBars}, ${height + margin.bottom - 20})`);
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[Areas][BarChart] No se pudo recalcular el centrado del título X:', e);
        }
    }  

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

    // Helper para detección robusta del idioma (evita asumir índice fijo en el path)
    function detectLangFromPath() {
        try {
            const parts = window.location.pathname.split('/').filter(Boolean);
            const found = parts.find(p => p === 'es' || p === 'en');
            return found || 'es';
        } catch (e) {
            console.warn('[LangDetection] Error detectando idioma, se usa "es" por defecto:', e);
            return 'es';
        }
    }

    function updateCollaborationNetwork(data) {
        const container = document.getElementById('collaborationNetwork');
        if (!container) return;
    
        const cardTitle = document.querySelector('#collaborationNetwork').closest('.card').querySelector('.card-title');
        const currentLang = detectLangFromPath();
        console.log('[Network] Actualizando red. Path=', window.location.pathname, 'Idioma detectado=', currentLang);
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
            console.log('[Network][Legend] Título leyenda:', title.textContent, 'Idioma=', currentLang);
        
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
                    console.log('[Network][Legend] Añadida entrada leyenda:', label.textContent, 'Comm ID=', comm);
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
            console.warn('[CommunityDropdown] Botón no encontrado');
            return;
        }
        const currentLang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : (window.location.pathname.split('/')[1] || 'es');
        let text = '';
        console.log('[CommunityDropdown] Vista actual=', window.currentCommunityView, 'FullNetwork=', isFullNetwork, 'Lang=', currentLang);

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
        console.log('[CommunityDropdown] Texto aplicado=', text);
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
        console.log('[Network][ToggleFull] Click. Path=', window.location.pathname, 'Idioma detectado=', currentLang);
        
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
        console.log('[Network][ToggleFull] Nuevo título card:', cardTitle.textContent);
        
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