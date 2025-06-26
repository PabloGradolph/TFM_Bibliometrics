// filters_search.js
import * as d3 from 'd3';
import Graph from 'graphology';
import Sigma from 'sigma';
import EdgeCurveProgram from "@sigma/edge-curve";
import { setupExportReportButton } from './export_report';


export function initFiltersAndSearch() {

    // Referencias a los elementos del DOM
    const yearFrom = document.getElementById('yearFrom');
    const yearTo = document.getElementById('yearTo');
    const areaFilter = document.getElementById('areaFilter');
    const institutionFilter = document.getElementById('institutionFilter');
    const typeFilter = document.getElementById('typeFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const selectedAreas = document.getElementById('selectedAreas');
    const selectedInstitutions = document.getElementById('selectedInstitutions');
    const selectedTypes = document.getElementById('selectedTypes');
    const standardSearch = document.getElementById('standardSearch');
    const standardSearchBtn = document.getElementById('standardSearchBtn');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const selectedAuthor = document.getElementById('selectedAuthor');
    const authorLimitMessage = document.getElementById('authorLimitMessage');

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

        // Actualizar descripción del modelo actual
        if (clusteringModel && modelDescription) {
            modelDescription.textContent = modelDescriptions[clusteringModel.value] || '';
        }
    }

    // Event listeners para el modal de clustering
    if (clusteringModel && modelDescription) {
        clusteringModel.addEventListener('change', function() {
            const selectedModel = this.value;
            const modelDescriptions = currentLang === 'es' ? spanishModelDescriptions : englishModelDescriptions;
            modelDescription.textContent = modelDescriptions[selectedModel] || '';
            
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
            if (currentCommunityView === selectedView) {
                document.querySelectorAll('.dropdown-item.network-community-view').forEach(link => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
                return;
            }

            currentCommunityView = selectedView;

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
    let selectedAuthorName = null;

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

        fetch(`/api/search/authors/?q=${encodeURIComponent(query)}`)
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
            selectedAuthor.innerHTML = '';
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
        
        // Extraer el idioma de la URL
        const currentLang = window.location.pathname.split('/')[1];
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

        // Obtener las métricas del autor
        fetch(`/api/author/metrics/?author_id=${encodeURIComponent(authorName)}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error fetching author metrics:', data.error);
                    return;
                }
                
                const metricsTable = document.getElementById('authorMetricsTable');
                if (!metricsTable) return;

                // Mapeo de nombres de métricas a nombres más amigables
                const metricNames = {
                    'orcid': 'ORCID',
                    'total_publications': 'Total Publications',
                    'total_citations': 'Total Citations',
                    'citations_wos': 'WoS Citations',
                    'citations_scopus': 'Scopus Citations',
                    'h_index': 'H-index (WoS/Scopus)',
                    'h_index_gb': 'H-index (Gesbib)',
                    'h_index_h5gb': 'H5-index (Gesbib)',
                    'international_index': 'International Collaboration Index'
                };

                // Limpiar la tabla
                metricsTable.innerHTML = '';

                // Añadir cada métrica a la tabla
                Object.entries(data.metrics).forEach(([key, value]) => {
                    const row = document.createElement('tr');
                
                    if (key === 'orcid' && typeof value === 'string' && value.trim() !== '') {
                        // Forzar https y generar enlace clicable
                        const url = value.replace(/^http:/, 'https:');
                        row.innerHTML = `
                            <td>${metricNames[key]}</td>
                            <td><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></td>
                        `;
                    } else {
                        row.innerHTML = `
                            <td>${metricNames[key] || key}</td>
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
            // Actualizar los filtros para reflejar las publicaciones del autor
            updateFilters();
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

        // Realizar la búsqueda
        fetch(`/api/search/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                // Restaurar el botón
                standardSearchBtn.innerHTML = '<i class="fas fa-search"></i>';

                // Crear y mostrar el modal de resultados
                showSearchResults(data.results);
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
            resultsList.innerHTML = results.map(result => `
                <div class="card mb-3">
                    <div class="card-body" data-publication-id="${result.id}" style="cursor: pointer;">
                        <h5 class="card-title">${result.title}</h5>
                        <h6 class="card-subtitle mb-2 text-muted">
                            ${result.year} - ${result.publication_type}
                        </h6>
                        <p class="card-text">
                            <strong>Autores:</strong> ${result.authors.join(', ')}<br>
                            <strong>Instituciones:</strong> ${result.institutions.join(', ')}<br>
                            <strong>Áreas:</strong> ${result.areas.join(', ')}
                        </p>
                        ${result.url ? `<a href="${result.url}" class="card-link" target="_blank">Ver publicación</a>` : ''}
                    </div>
                </div>
            `).join('');
        }

        // Añadir evento de clic a cada tarjeta de resultado
        resultsList.querySelectorAll('.card-body').forEach(cardBody => {
            cardBody.addEventListener('click', function() {
                const publicationId = this.dataset.publicationId;
                if (publicationId) {
                    // Redirigir a la página de detalle de publicación
                    window.location.href = `/publication/${publicationId}/`;
                }
            });
        });

        // Mostrar el modal
        const modalInstance = new bootstrap.Modal(modal);
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

    // Inicializar estado del botón al cargar la página
    updateSearchButton();

    // Cargar los datos de los filtros
    loadFilterData();

    // Configurar botones de vista de áreas (circular/barra)
    setupAreasButtons();

    // Función para cargar los datos de los filtros
    function loadFilterData() {
        fetch('/api/dashboard/filters/')
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
            updateVisualizations();
        });
        
        container.appendChild(badge);
    }

    // Función para limpiar todos los filtros
    function clearFilters() {
        yearFrom.value = '';
        yearTo.value = '';
        selectedAreasList.clear();
        selectedInstitutionsList.clear();
        selectedTypesList.clear();
        selectedAreas.innerHTML = '';
        selectedInstitutions.innerHTML = '';
        selectedTypes.innerHTML = '';
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
            types: Array.from(selectedTypesList)
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
        filters.areas.forEach(area => params.append('areas', area));
        filters.institutions.forEach(institution => params.append('institutions', institution));
        filters.types.forEach(type => params.append('types', type));
        params.append('view_type', filters.view_type);
        if (includePredictedAreas) params.append('include_predicted_areas', 'true');
        
        // Añadir el autor seleccionado si existe
        if (selectedAuthorName) {
            params.append('author', selectedAuthorName);
        }

        // Obtener los datos filtrados
        fetch(`/api/dashboard/data/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {

                // Obtener datos de la red de colaboración
                const networkParams = new URLSearchParams(params); // Clonar los parámetros existentes
                networkParams.append('view_type', currentCommunityView); // Añadir el tipo de vista de comunidad

                fetch(`/api/dashboard/collaboration-network/?${networkParams.toString()}`)
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
            page: page
        };

        // Construir la URL con los parámetros de filtrado
        const params = new URLSearchParams();
        if (filters.year_from) params.append('year_from', filters.year_from);
        if (filters.year_to) params.append('year_to', filters.year_to);
        filters.areas.forEach(area => params.append('areas', area));
        filters.institutions.forEach(institution => params.append('institutions', institution));
        filters.types.forEach(type => params.append('types', type));
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
        return fetch(`/api/dashboard/publications/?${params.toString()}`)
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

                // Ordenar las métricas en un orden específico
                const orderedMetrics = [
                    { key: 'Dimensions Citations', label: 'Dimensions Citations' },
                    { key: 'WoS Citations', label: 'WoS Citations' },
                    { key: 'Scopus Citations', label: 'Scopus Citations' },
                    { key: 'FCR', label: 'FCR' },
                    { key: 'RCR', label: 'RCR' },
                    { key: 'International Collaboration', label: 'International Collaboration' }
                ];

                // Crear el encabezado de la tabla con iconos de ordenación
                const tableHeader = document.createElement('thead');
                tableHeader.innerHTML = `
                    <tr>
                        <th style="max-width: 300px;">Título</th>
                        ${orderedMetrics.map(({ key, label }) => `
                            <th class="sortable" data-metric="${key}">
                                ${label}
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
                                window.location.href = `/publication/${publicationId}/`;
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
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    tooltipContent = `<b>${months[d.month - 1]}</b><br><b>Publicaciones:</b> ${d.count}`;
                } else {
                    tooltipContent = `<b>Año:</b> ${d.year}<br><b>Publicaciones:</b> ${d.count}`;
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
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    infoBoxContent = `
                        <div style="font-weight: bold; margin-bottom: 5px;">${months[d.month - 1]}</div>
                        <div>Publicaciones: ${d.count}</div>
                    `;
                } else {
                    infoBoxContent = `
                        <div style="font-weight: bold; margin-bottom: 5px;">Año ${d.year}</div>
                        <div>Publicaciones: ${d.count}</div>
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

        // Añadir título del eje Y
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left + 20)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Número de publicaciones');

        // Añadir título del eje X
        svg.append('text')
            .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 30})`)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(viewType === 'monthly' ? 'Mes' : 'Año');

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
            infoMessage.html(`
                <div style="flex-grow: 1;">
                    <i class="fas fa-info-circle"></i>
                    ${timelineInfo.no_month_count} publicación(es) sin mes asignado 
                    se han contabilizado en enero
                </div>
                <button type="button" class="btn-close" style="font-size: 0.7rem;" aria-label="Close"></button>
            `);

            // Añadir evento para cerrar el mensaje
            infoMessage.select('.btn-close').on('click', function() {
                infoMessage.remove();
            });
        }
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
                    <div>Publicaciones: ${d.data.count}</div>
                    <div>Porcentaje: ${percentage}%</div>
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
                return `${name} (${d.count} pubs, ${percentage}%)`;
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
            data = [...topN, {thematic_areas__name: 'Otras', count: otrasCount}];
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
    
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            // Quitamos las etiquetas del eje X
            .call(d3.axisBottom(x).tickFormat(''));
    
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
                    <div>Publicaciones: ${d.count}</div>
                    <div>Porcentaje: ${percentage}%</div>
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
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -margin.left + 20)
            .attr('x', -height / 2)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Número de publicaciones');
    
        // Añadir título del eje X
        svg.append('text')
            .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 20})`)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Áreas temáticas');
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
            createBadge(selectedArea, selectedAreas, selectedAreasList);
            updateFilters();
        }
        areaFilter.value = '';
    });
    institutionFilter.addEventListener('change', () => {
        const selectedInstitution = institutionFilter.value;
        if (selectedInstitution && !selectedInstitutionsList.has(selectedInstitution)) {
            selectedInstitutionsList.add(selectedInstitution);
            createBadge(selectedInstitution, selectedInstitutions, selectedInstitutionsList);
            updateFilters();
        }
        institutionFilter.value = '';
    });
    typeFilter.addEventListener('change', () => {
        const selectedType = typeFilter.value;
        if (selectedType && !selectedTypesList.has(selectedType)) {
            selectedTypesList.add(selectedType);
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

    // Event listener para el botón de mostrar/ocultar etiquetas
    const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
    const currentLang = window.location.pathname.split('/')[1];
    const extraLabels = currentLang === 'es' ? 'Ocultar etiquetas extra' : 'Hide Extra Labels';
    const allLabels = currentLang === 'es' ? 'Mostrar etiquetas' : 'Show All Labels';
    if (toggleLabelsBtn) {
        toggleLabelsBtn.addEventListener('click', () => {
            if (!renderer) return; // Asegurarse de que el renderer existe

            showAllLabels = !showAllLabels; // Alternar el estado

            if (showAllLabels) {
                // Mostrar todas las etiquetas: ajustar settings para forzar renderizado
                renderer.setSettings({
                    labelDensity: Infinity,
                    labelGridCellSize: 1,
                    labelRenderedSizeThreshold: 0
                });
                // Actualizar texto del botón
                toggleLabelsBtn.textContent = `${extraLabels}`;
            } else {
                // Volver al comportamiento por defecto (ocultar algunas etiquetas)
                // Restaurar settings por defecto o los que generan el comportamiento deseado
                 renderer.setSettings({
                    labelDensity: 1,
                    labelGridCellSize: 200,
                    labelRenderedSizeThreshold: 0
                });
                 // Actualizar texto del botón
                toggleLabelsBtn.textContent = `${allLabels}`;
            }
            renderer.refresh();
        });
    }

    let currentCommunityView = 'modularity-7'; // Estado para la vista de comunidad activa
    let currentClusteringModel = null;
    let currentNClusters = null;
    let isFullNetwork = false;


    // Event listeners para las opciones del menú desplegable de vista de comunidad
    document.querySelectorAll('.dropdown-item.network-community-view').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault(); // Prevenir el comportamiento por defecto del enlace

            const selectedView = this.dataset.communityView; // Obtener el tipo de vista del data-attribute

            // Si ya es la vista actual, no hacer nada
            if (currentCommunityView === selectedView) {
                 // Actualizar visualmente el menú para marcar la opción activa (en caso de que no lo estuviera)
                document.querySelectorAll('.dropdown-item.network-community-view').forEach(link => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
                return; // Salir de la función si la vista no cambia
            }

            currentCommunityView = selectedView; // Actualizar el estado

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

    function updateCollaborationNetwork(data) {
        const container = document.getElementById('collaborationNetwork');
        if (!container) return;
    
        const cardTitle = document.querySelector('#collaborationNetwork').closest('.card').querySelector('.card-title');
        const currentLang = window.location.pathname.split('/')[1];
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
            if (currentCommunityView === 'keywords') {
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
                if (currentCommunityView === 'department') {
                    messageText = currentLang === 'es'
                        ? 'Los investigadores han sido clasificados en departamentos utilizando un Node2VecTransformer y un MLPClassifier. Esta clasificación no es 100% precisa. No aparecen investigadores sin colaboraciones.'
                        : 'Researchers have been classified into departments using a Node2VecTransformer and MLPClassifier. This classification is not 100% accurate. There are no researchers without collaborations.';
                } else if (currentCommunityView === 'modularity-7') {
                    messageText = currentLang === 'es'
                        ? 'Se ha utilizado el algoritmo de detección de comunidades Lovaina sobre la red de coautorías completa para agrupar a los investigadores en distintas comunidades. No aparecen investigadores sin colaboraciones.'
                        : 'The Louvain community detection algorithm has been used on the complete co-authorship network to group researchers into different communities. There are no researchers without collaborations.';
                }  else if (currentCommunityView === 'modularity-5') {
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

            if (currentCommunityView === 'keywords') {
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
            if (currentCommunityView === 'department') {
                groupByProp = 'department';
            } else if (currentCommunityView === 'modularity-5') {
                groupByProp = 'leiden_community';
            } else if (currentCommunityView === 'modularity-7') {
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
                : (currentCommunityView === 'department'
                    ? departmentColorScale(dept)
                    : (currentCommunityView === 'modularity-5'
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
        if (!data.is_author_view && !(isFullNetwork && currentCommunityView === 'modularity-7') && !(isFullNetwork && currentCommunityView === 'modularity-5')) {
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
        
            if (currentCommunityView === 'department') {
                title.textContent = currentLang === 'es' ? 'Departamentos' : 'Departments';
            } else if (currentCommunityView === 'keywords') {
                title.textContent = currentLang === 'es' ? 'Comunidades de Palabras Clave' : 'Keyword Communities';
            } else if (currentCommunityView === 'modularity-5' || currentCommunityView === 'modularity-7') {
                const k = currentCommunityView === 'modularity-7' ? 7 : 5;
                title.textContent = currentLang === 'es'
                    ? `Comunidades (${k})`
                    : `Communities (${k})`;
            }
        
            legend.appendChild(title);

            const counts = document.createElement('div');
            counts.style.marginBottom = '8px';
            counts.textContent = `${data.nodes.length} nodos / ${data.edges.length} enlaces`;
            legend.appendChild(counts);
        
            if (currentCommunityView === 'department') {
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
                if (currentCommunityView === 'keywords') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.community)))];
                } else if (currentCommunityView === 'modularity-5') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.leiden_community)))];
                } else if (currentCommunityView === 'modularity-7') {
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
                        label.textContent = currentLang === 'es' ? 'Outlier' : 'Outlier';
                    } else {
                        const num = (currentCommunityView === 'modularity-7') ? (i + 1) : (comm + 1);
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
        currentCommunityView = 'keywords';
        currentClusteringModel = model;
        currentNClusters = nClusters;
    
        const params = new URLSearchParams({
            communityView: 'keywords',
            clusteringModel: model,
            nClusters: nClusters,
            autoMode: modelConfigMode === 'auto',
            globalMode: configMode === 'global'
        });
    
        // === HACER LA PETICIÓN AL BACKEND ===
        fetch(`/api/dashboard/collaboration-network/?${params.toString()}`)
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
        const currentLang = window.location.pathname.split('/')[1];
        let text = '';

        if (currentCommunityView === 'department') {
            text = currentLang === 'es' ? 'Por Departamento' : 'By Department';
        } else if (currentCommunityView === 'modularity-7') {
            text = currentLang === 'es' 
                ? (isFullNetwork ? 'Louvain' : 'Louvain (7 comunidades)')
                : (isFullNetwork ? 'Louvain' : 'Louvain (7 communities)');
        } else if (currentCommunityView === 'modularity-5') {
            text = currentLang === 'es' 
                ? (isFullNetwork ? 'Leiden' : 'Leiden (5 comunidades)')
                : (isFullNetwork ? 'Leiden' : 'Leiden (5 communities)');
        } else if (currentCommunityView === 'keywords') {
            const modelName = model || currentClusteringModel;
            const nClustersValue = nClusters || currentNClusters;
            if (modelName && nClustersValue) {
                text = currentLang === 'es'
                    ? `Por palabras clave (${modelName}, ${nClustersValue} clústeres)`
                    : `By keywords (${modelName}, ${nClustersValue} clusters)`;
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
        
        // Añadir filtros de área
        selectedAreasList.forEach(area => params.append('areas', area));
        
        // Añadir filtros de institución
        selectedInstitutionsList.forEach(institution => params.append('institutions', institution));
        
        // Añadir filtros de tipo
        selectedTypesList.forEach(type => params.append('types', type));

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
        fetch(`/api/dashboard/filters/?${params.toString()}`)
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

    // Añadir el manejador del botón de red completa
    document.getElementById('toggleFullNetworkBtn').addEventListener('click', function() {
        const button = this;
        const container = document.getElementById('collaborationNetwork');
        const currentLang = window.location.pathname.split('/')[1];
        
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
            communityView: currentCommunityView,
            fullNetwork: isFullNetwork
        });
        
        if (currentClusteringModel) {
            params.append('clusteringModel', currentClusteringModel);
            params.append('nClusters', currentNClusters);
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

        fetch(`/api/dashboard/collaboration-network/?${params.toString()}`)
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
                if (!isFullNetwork && (currentCommunityView === 'modularity-5' || currentCommunityView === 'keywords')) {
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
            currentCommunityView = view;
            
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
            
            if (currentClusteringModel) {
                params.append('clusteringModel', currentClusteringModel);
                params.append('nClusters', currentNClusters);
                params.append('autoMode', 'true');
                params.append('globalMode', 'true');
            }

            fetch(`/api/dashboard/collaboration-network/?${params.toString()}`)
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
            include: 'Incluir áreas temáticas predichas por IA',
            exclude: 'Excluir áreas temáticas predichas por IA'
        },
        en: {
            include: 'Include AI-predicted areas',
            exclude: 'Exclude AI-predicted areas'
        }
    };

    function updatePredictedAreasBtnText() {
        const lang = window.location.pathname.split('/')[1] === 'es' ? 'es' : 'en';
        const btn = document.getElementById('togglePredictedAreasBtn');
        if (!btn) return;
        btn.textContent = includePredictedAreas ? predictedAreasBtnTexts[lang].exclude : predictedAreasBtnTexts[lang].include;
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

    window.addEventListener('DOMContentLoaded', function() {
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