// filters_search.js
import * as d3 from 'd3';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import EdgeCurveProgram from "@sigma/edge-curve";

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

     // Almacenar las selecciones
    let selectedAreasList = new Set();
    let selectedInstitutionsList = new Set();
    let selectedTypesList = new Set();

    // Variables para el autocompletado
    let selectedAuthorName = null;
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

    // Función para seleccionar un autor
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
            
            updateVisualizations(); // Actualizar gráficos al eliminar el autor
        });

         // Crear y añadir la card de métricas del autor al DOM
        const collaborationRow = document.getElementById('collaborationRow');
        const authorMetricsCard = document.createElement('div');
        authorMetricsCard.id = 'authorMetricsCard';
        authorMetricsCard.className = 'col-md-6 mt-3 mt-md-0 h-100';
        
        // Extraer el idioma de la URL
        const currentLang = window.location.pathname.split('/')[1];
        const cardTitle = currentLang === 'es' ? 'Resumen de Métricas del Autor' : 'Author Metrics Summary';
        
        authorMetricsCard.innerHTML = `
            <div class="card dashboard-card h-100">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">${cardTitle}</h5>
                    </div>
                    <div id="authorMetricsContent" class="flex-grow-1">
                        <!-- El contenido se actualizará dinámicamente -->
                    </div>
                </div>
            </div>
        `;
        collaborationRow.appendChild(authorMetricsCard);

        // Ajustar la columna de la red de colaboración
        const networkCol = document.getElementById('networkCol');
        if (networkCol) {
            networkCol.className = 'col-12 col-md-6';
        }

        // Actualizar los gráficos con el autor seleccionado
        updateVisualizations();
    }

    // Función para actualizar las métricas del autor
    function updateAuthorMetrics(data) {
        if (!selectedAuthorName) return;

        const metricsContent = document.getElementById('authorMetricsContent');
        if (!metricsContent) return;

        // Calcular métricas agregadas
        const metrics = {
            'Dimensions Citations': { total: 0, avg: 0 },
            'WoS Citations': { total: 0, avg: 0 },
            'Scopus Citations': { total: 0, avg: 0 },
            'FCR': { total: 0, avg: 0 },
            'RCR': { total: 0, avg: 0 }
        };

        let totalPublications = data.publications.data.length;
        let internationalCollabCount = 0;

        data.publications.data.forEach(pub => {
            // Sumar citas
            Object.keys(metrics).forEach(metric => {
                const value = pub.metrics[metric]?.value;
                if (value !== null && value !== undefined) {
                    metrics[metric].total += value;
                }
            });

            // Contar colaboraciones internacionales
            if (pub.international_collab) {
                internationalCollabCount++;
            }
        });

        // Calcular promedios
        Object.keys(metrics).forEach(metric => {
            metrics[metric].avg = totalPublications > 0 ? 
                (metrics[metric].total / totalPublications).toFixed(2) : 0;
        });

        // Calcular porcentaje de colaboración internacional
        const internationalCollabPercentage = totalPublications > 0 ?
            ((internationalCollabCount / totalPublications) * 100).toFixed(1) : 0;

        // Crear el contenido HTML
        metricsContent.innerHTML = `
            <div class="mb-4">
                <h6 class="text-muted mb-3">{% trans "Total Publications" %}</h6>
                <h3 class="mb-0">${totalPublications}</h3>
            </div>
            <div class="mb-4">
                <h6 class="text-muted mb-3">{% trans "Citations" %}</h6>
                <div class="row g-3">
                    ${Object.entries(metrics).map(([metric, values]) => `
                        <div class="col-6">
                            <div class="card bg-light">
                                <div class="card-body p-3">
                                    <h6 class="card-subtitle mb-2 text-muted">${metric}</h6>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div class="small text-muted">{% trans "Total" %}</div>
                                            <div class="h5 mb-0">${values.total}</div>
                                        </div>
                                        <div class="text-end">
                                            <div class="small text-muted">{% trans "Avg" %}</div>
                                            <div class="h5 mb-0">${values.avg}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div>
                <h6 class="text-muted mb-3">{% trans "International Collaboration" %}</h6>
                <div class="card bg-light">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="small text-muted">{% trans "Publications with International Collaboration" %}</div>
                                <div class="h5 mb-0">${internationalCollabCount}</div>
                            </div>
                            <div class="text-end">
                                <div class="small text-muted">{% trans "Percentage" %}</div>
                                <div class="h5 mb-0">${internationalCollabPercentage}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
        updateVisualizations();
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
        
        // Añadir el autor seleccionado si existe
        if (selectedAuthorName) {
            params.append('author', selectedAuthorName);
        }

        // Obtener los datos filtrados
        fetch(`/api/dashboard/data/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {

                // Obtener datos de la red de colaboración
                fetch(`/api/dashboard/collaboration-network/?${params.toString()}`)
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
                    // Actualizar las métricas del autor si hay un autor seleccionado
                    if (selectedAuthorName) {
                        updateAuthorMetrics(data);
                    }
                });
            })
            .catch(error => console.error('Error updating visualizations:', error));
    }

    function updatePublicationsTable(page = 1) {
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

        // Retornar la promesa de fetch
        return fetch(`/api/dashboard/publications/?${params.toString()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                const tableBody = document.getElementById('metricsTable');
                const pagination = document.getElementById('publicationsPagination');
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
                                <i class="fas fa-sort ms-1"></i>
                            </th>
                        `).join('')}
                    </tr>
                `;

                // Añadir el encabezado a la tabla
                const table = tableBody.closest('table');
                if (table) {
                    const existingHeader = table.querySelector('thead');
                    if (existingHeader) {
                        existingHeader.remove();
                    }
                    table.insertBefore(tableHeader, tableBody);
                }

                // Función para ordenar las publicaciones
                function sortPublications(metric, direction) {
                    publications.sort((a, b) => {
                        const valueA = a.metrics[metric]?.value ?? -Infinity;
                        const valueB = b.metrics[metric]?.value ?? -Infinity;
                        return direction === 'asc' ? valueA - valueB : valueB - valueA;
                    });
                }

                // Estado de ordenación actual
                let currentSort = {
                    metric: null,
                    direction: 'desc'
                };

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

                        // Ordenar y actualizar la tabla
                        sortPublications(metric, currentSort.direction);
                        updateTableContent(publications);
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

                return Promise.resolve();
            })
            .catch(error => {
                console.error('Error updating publications table:', error);
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
        const tooltip = d3.select('#timelineChart')
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background-color', 'rgba(255,255,255,0.95)')
            .style('border', '1px solid #2196f3')
            .style('border-radius', '4px')
            .style('padding', '6px 10px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');

        // Info box para el clic
        const infoBox = d3.select('#timelineChart')
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
                tooltip.transition()
                    .duration(150)
                    .style('opacity', 1);
                
                let tooltipContent;
                if (viewType === 'monthly') {
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    tooltipContent = `<b>${months[d.month - 1]}</b><br><b>Publicaciones:</b> ${d.count}`;
                } else {
                    tooltipContent = `<b>Año:</b> ${d.year}<br><b>Publicaciones:</b> ${d.count}`;
                }
                
                tooltip.html(tooltipContent)
                    .style('left', (event.pageX - 30) + 'px')
                    .style('top', (event.pageY - 40) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 5)
                    .attr('fill', '#2196f3');
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0);
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
                
                infoBox.html(infoBoxContent)
                    .style('display', 'block')
                    .style('left', (finalX - infoBoxWidth/2) + 'px')
                    .style('top', finalY + 'px');
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

        // Agrupar las áreas menos representativas en 'Otras'
        const N = 14;
        if (data.length > N) {
            const sorted = data.slice().sort((a, b) => b.count - a.count);
            const topN = sorted.slice(0, N);
            const rest = sorted.slice(N);
            const otrasCount = rest.reduce((sum, d) => sum + d.count, 0);
            // Poner "Otras" al principio del array
            data = [{thematic_areas__name: 'Otras', count: otrasCount}, ...topN];
        }

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
            // .call(d3.axisBottom(x))
            // .selectAll('text')
            // .attr('transform', 'rotate(-45)')
            // .style('text-anchor', 'end')
            // .style('font-size', '11px');
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
    yearFrom.addEventListener('change', function() {
        updateVisualizations();
    });

    yearTo.addEventListener('change', function() {
        updateVisualizations();
    });

    areaFilter.addEventListener('change', function() {
        if (this.value && !selectedAreasList.has(this.value)) {
            selectedAreasList.add(this.value);
            createBadge(this.value, selectedAreas, selectedAreasList);
            updateVisualizations();
        }
        this.value = ''; // Reset select
    });

    institutionFilter.addEventListener('change', function() {
        if (this.value && !selectedInstitutionsList.has(this.value)) {
            selectedInstitutionsList.add(this.value);
            createBadge(this.value, selectedInstitutions, selectedInstitutionsList);
            updateVisualizations();
        }
        this.value = ''; // Reset select
    });

    typeFilter.addEventListener('change', function() {
        if (this.value && !selectedTypesList.has(this.value)) {
            selectedTypesList.add(this.value);
            createBadge(this.value, selectedTypes, selectedTypesList);
            updateVisualizations();
        }
        this.value = ''; // Reset select
    });

    clearFiltersBtn.addEventListener('click', function() {
        yearFrom.value = '';
        yearTo.value = '';
        selectedAreasList.clear();
        selectedInstitutionsList.clear();
        selectedTypesList.clear();
        selectedAreas.innerHTML = '';
        selectedInstitutions.innerHTML = '';
        selectedTypes.innerHTML = '';
        
        // Resetear botones de vista a anual
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === 'yearly') {
                btn.classList.add('active');
            }
        });
        
        updateVisualizations();
    });

    let renderer = null;
    
    // Función para actualizar la red de colaboración
    function updateCollaborationNetwork(data) {
        const container = document.getElementById('collaborationNetwork');
        if (!container) return;
        container.innerHTML = '';
      
        // Crear el grafo
        const graph = new Graph();
      
        // Calcular grados para ajustar el tamaño del nodo
        const degreeMap = {};
        data.edges.forEach(edge => {
          degreeMap[edge.source] = (degreeMap[edge.source] || 0) + 1;
          degreeMap[edge.target] = (degreeMap[edge.target] || 0) + 1;
        });
      
        // Añadir nodos con posición inicial aleatoria y tamaño proporcional al grado
        data.nodes.forEach(node => {
          const degree = degreeMap[node.id] || 1;
          graph.addNode(node.id, {
            label: node.label,
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            size: node.is_selected ? Math.max(4, Math.log(degree + 1) * 1.5) : Math.max(2, Math.log(degree + 1)), // Nodo más grande para el autor seleccionado
            color: node.is_selected ? '#ff5722' : '#2196f3',  // Color naranja para el autor seleccionado
            highlighted: node.is_selected  // Marcar como destacado si es el autor seleccionado
          });
        });
      
        // Añadir aristas con grosor proporcional al peso
        data.edges.forEach(edge => {
            if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
              const weight = edge.weight || 1;
              const sourceNode = graph.getNodeAttributes(edge.source);
              const targetNode = graph.getNodeAttributes(edge.target);
              const isHighlighted = sourceNode.highlighted || targetNode.highlighted;
          
              graph.addEdge(edge.source, edge.target, {
                weight: weight,
                size: isHighlighted ? Math.max(0.2, Math.log10(weight + 1) * 0.8) : Math.max(0.1, Math.log10(weight + 1) * 0.6), // Aristas más gruesas para conexiones del autor seleccionado
                color: isHighlighted ? '#ff5722' : 'rgba(150, 150, 150, 0.65)',  // Color naranja sólido para las conexiones del autor seleccionado
                type: 'curve',
              });
            }
          });
      
        // Aplicar layout ForceAtlas2
        forceAtlas2.assign(graph, {
          iterations: 300,
          settings: {
            gravity: 1.2,
            scalingRatio: 15,
            strongGravityMode: true,
            barnesHutOptimize: true,
            adjustSizes: true,
            edgeWeightInfluence: 1
          }
        });
      
        // Renderizar con Sigma
        renderer = new Sigma(graph, container, {
          minCameraRatio: 0.1,
          maxCameraRatio: 10,
          labelRenderedSizeThreshold: 6,
          defaultNodeColor: '#2196f3',
          defaultEdgeColor: '#999',
          defaultNodeSize: 8,
          defaultEdgeType: "curve",
          edgeProgramClasses: {
            curve: EdgeCurveProgram,
          },
          renderLabels: true,
          labelDensity: 0.07,
          zIndex: true,
          enableEdgeHovering: true,
          enableNodeHovering: true,
          enableCamera: true
        });
      
        // Tooltip simple con el título del nodo
        renderer.on('enterNode', ({ node }) => {
          container.setAttribute('title', graph.getNodeAttribute(node, 'label'));
        });
      
        renderer.getCamera().animatedReset({ duration: 500 });

        // Mostrar mensaje informativo sobre el número de nodos y enlaces
        const infoMessage = d3.select('#collaborationNetwork')
            .append('div')
            .attr('class', 'alert alert-info')
            .style('position', 'absolute')
            .style('top', '50px')  // Cambiado de 10px a 50px para que aparezca debajo del título
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

        const numNodes = graph.order;
        const numEdges = graph.size;
        
        // Crear el contenido del mensaje
        infoMessage.html(`
            <div style="flex-grow: 1;">
                <i class="fas fa-info-circle"></i>
                La red contiene ${numNodes} autores y ${numEdges} colaboraciones
            </div>
            <button type="button" class="btn-close" style="font-size: 0.7rem;" aria-label="Close"></button>
        `);

        // Añadir evento para cerrar el mensaje
        infoMessage.select('.btn-close').on('click', function() {
            infoMessage.remove();
        });

        renderer.getCamera().animatedReset({ duration: 500 });
    }      
}