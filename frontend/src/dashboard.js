// filters_search.js
import * as d3 from 'd3';
import Graph from 'graphology';
import Sigma from 'sigma';
import EdgeCurveProgram from "@sigma/edge-curve";
import { setupExportReportButton } from './export_report';
import { initWorldMap, setWorldMapActiveCountries, setWorldMapLoading } from './worldmap.js';
import { initSpainMap, setSpainMapCounts, showSpainLevel, setSpainMapLoading, setSpainMapVisible } from './spainmap.js';
import { createMapViewsController } from './dashboard/map_views.js';
import { createCollaborationNetworkController } from './dashboard/collaboration_network.js';
import { detectLangFromPath as detectLangFromPathUtil } from './dashboard/utils.js';
import { initTimelineExporter, updateTimeline as updateTimelineUtil } from './dashboard/timeline.js';
import {
    initAreasExporter,
    renderAreasChart as renderAreasChartUtil,
} from './dashboard/areas.js';
import { createPublicationsTableController } from './dashboard/publications_table.js';
import {
    englishModelDescriptions,
    englishTexts,
    spanishModelDescriptions,
    spanishTexts,
} from './dashboard/clustering_i18n.js';
import { setMissingPubsNoticeVisible as setMissingPubsNoticeVisibleUtil } from './dashboard/missing_pubs_notice.js';
import {
    ensureAuthorSuggestionsPortal as ensureAuthorSuggestionsPortalUtil,
    positionAuthorDropdown as positionAuthorDropdownUtil,
} from './dashboard/author_dropdown_portal.js';
import {
    buildFiltersAuthorSuggestionParams,
    showFiltersAuthorSuggestions as showFiltersAuthorSuggestionsUtil,
} from './dashboard/filters_author_suggestions.js';
import {
    buildDashboardFilterParams,
    cloneSearchParams,
} from './dashboard/filter_params.js';
import {
    buildPublicationsSearchParams,
    parseTopK,
} from './dashboard/search_params.js';

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
    // Main search is publications-only. Author selection is handled in Filters.

    // Filters-section author search (author-only)
    const filtersAuthorSearch = document.getElementById('filtersAuthorSearch');
    const filtersAuthorSuggestions = document.getElementById('filtersAuthorSuggestions');
    const filtersSelectedAuthor = document.getElementById('filtersSelectedAuthor');
    const filtersAuthorLimitMessage = document.getElementById('filtersAuthorLimitMessage');
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

    // Clustering modal dictionaries were moved to `dashboard/clustering_i18n.js`
    // to keep this file smaller without altering behavior.

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

    // NOTE (2026-01): Community view dropdown handler moved to
    // `frontend/src/dashboard/collaboration_network.js` (controller).
    // Keeping a second handler here causes duplicated requests and timing issues
    // (including the loading overlay never becoming visible).

    // Almacenar las selecciones
    let selectedAreasList = new Set();
    let selectedInstitutionsList = new Set();
    let selectedTypesList = new Set();
    let selectedQuartilesList = new Set();
    // metric source removed; always WoS
    // NOTE (2025-12): author filter UI now supports multi-select.
    // For now, the rest of the app keeps using `window.selectedAuthorName` (single author)
    // so existing behavior is preserved when exactly one author is selected.
    /** @type {string|null} */
    let selectedAuthorName = null;
    /** @type {Set<string>} */
    let selectedAuthorNames = new Set();

    // Exponer en window para export_report.js
    window.selectedAreasList = selectedAreasList;
    window.selectedInstitutionsList = selectedInstitutionsList;
    window.selectedTypesList = selectedTypesList;
    window.selectedQuartilesList = selectedQuartilesList;
    window.selectedMetricSource = 'wos';
    window.selectedAuthorName = selectedAuthorName;
    // Expose list for future use (not wired to backend yet)
    window.selectedAuthorNames = selectedAuthorNames;

    // Helper: show/hide the "missing publications" notice
    function setMissingPubsNoticeVisible(visible) {
        setMissingPubsNoticeVisibleUtil({
            noticeEl: missingPubsNotice,
            noticeTextEl: missingPubsNoticeText,
            visible,
            detectLang: () => (
                (typeof detectLangFromPath === 'function')
                    ? detectLangFromPath()
                    : (window.location.pathname.includes('/es/') ? 'es' : 'en')
            ),
        });
    }

    // Variables for debounced autocomplete (shared)
    let searchTimeout = null;

    /**
     * Move the dropdown to <body> so it is not affected by local stacking contexts.
     *
     * @returns {void}
     */
    function ensureFiltersAuthorSuggestionsPortal() {
        ensureAuthorSuggestionsPortalUtil(filtersAuthorSuggestions);
    }

    /**
     * Position the dropdown under the input using fixed positioning.
     *
     * We use fixed positioning + a body portal to escape any stacking context created
     * by charts/cards. We also compensate for VisualViewport offsets on mobile/zoom.
     *
     * @returns {void}
     */
    function positionFiltersAuthorDropdown() {
        positionAuthorDropdownUtil({
            searchEl: filtersAuthorSearch,
            suggestionsEl: filtersAuthorSuggestions,
        });
    }

    /**
     * Show author suggestions for the Filters section author search.
     *
     * This reuses the same `/api/search/authors/` endpoint but renders the dropdown
     * next to the quartile (Q) filter. Selecting an author must apply the same
     * dashboard behavior as selecting it from the main search.
     *
     * @param {string} query
     */
    function showFiltersAuthorSuggestions(query) {
        if (!filtersAuthorSearch || !filtersAuthorSuggestions) return;

        // Pass current dashboard filters so author counts reflect the filtered subset
        // (same behavior as other filter dropdowns).
        const params = buildFiltersAuthorSuggestionParams({
            query,
            yearFromEl: yearFrom,
            yearToEl: yearTo,
            citationsFromEl: citationsFrom,
            citationsToEl: citationsTo,
            selectedAreas: selectedAreasList,
            selectedInstitutions: selectedInstitutionsList,
            selectedTypes: selectedTypesList,
            selectedQuartiles: selectedQuartilesList,
        });

        // Do NOT send already-selected authors.
        // Suggestion counts should reflect only the non-author filters; otherwise
        // selecting authors can incorrectly shrink other authors' counts.

        showFiltersAuthorSuggestionsUtil({
            lang,
            query,
            searchEl: filtersAuthorSearch,
            suggestionsEl: filtersAuthorSuggestions,
            ensurePortal: ensureFiltersAuthorSuggestionsPortal,
            positionDropdown: positionFiltersAuthorDropdown,
            hideDropdown: () => {
                filtersAuthorSuggestions.style.display = 'none';
            },
            showDropdown: () => {
                filtersAuthorSuggestions.style.display = 'block';
            },
            clearSuggestions: () => {
                const suggestionsList = filtersAuthorSuggestions.querySelector('.list-group');
                if (!suggestionsList) return;
                suggestionsList.innerHTML = '';
            },
            selectAuthor: (authorName) => selectAuthor(authorName),
            queryParams: params,
        });
    }

    // Keep the fixed dropdown aligned on scroll/resize (while visible)
    window.addEventListener('scroll', positionFiltersAuthorDropdown, true);
    window.addEventListener('resize', positionFiltersAuthorDropdown);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', positionFiltersAuthorDropdown);
        window.visualViewport.addEventListener('resize', positionFiltersAuthorDropdown);
    }

    // Community view dropdown handler (Leiden/Louvain/Department/Keywords)
    // NOTE (2026-01): Kept here intentionally for stability while the dashboard is being modularized.
    // The community dropdown listener in `collaboration_network.js` is disabled to avoid duplication.
    document.querySelectorAll('.dropdown-item.network-community-view').forEach((item) => {
        item.addEventListener('click', function (e) {
            e.preventDefault();

            const selectedView = this.dataset.communityView;
            if (!selectedView) return;

            if (selectedView === 'keywords') {
                const modalEl = document.getElementById('clusteringModal');
                if (modalEl) {
                    const modal = new bootstrap.Modal(modalEl);
                    modal.show();
                }
                return;
            }

            if (window.currentCommunityView === selectedView) {
                document.querySelectorAll('.dropdown-item.network-community-view').forEach((link) => {
                    link.classList.remove('active');
                });
                this.classList.add('active');
                return;
            }

            window.currentCommunityView = selectedView;
            document.querySelectorAll('.dropdown-item.network-community-view').forEach((link) => {
                link.classList.remove('active');
            });
            this.classList.add('active');

            // Update dropdown text immediately.
            updateCommunityDropdownText();

            // Show the network spinner immediately (same UI as IPs/global toggle).
            const networkContainer = document.getElementById('collaborationNetwork');
            if (networkContainer) {
                const computedStyle = window.getComputedStyle(networkContainer);
                if (computedStyle.position === 'static') networkContainer.style.position = 'relative';

                const currentLang = (typeof detectLangFromPath === 'function')
                    ? detectLangFromPath()
                    : (window.location.pathname.includes('/es/') ? 'es' : 'en');
                const text = currentLang === 'es' ? 'Cargando...' : 'Loading...';

                const existing = document.getElementById('collaborationNetworkLoadingOverlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.id = 'collaborationNetworkLoadingOverlay';
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.75);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 5000;
                    pointer-events: all;
                `;
                overlay.innerHTML = `
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">${text}</span>
                        </div>
                        <div style="margin-top: 8px; font-size: 0.95rem; color: #555;">${text}</div>
                    </div>
                `;
                networkContainer.appendChild(overlay);
            }

            // Network-only change: avoid table reload/spinner.
            updateVisualizations({ skipPublicationsTable: true });
        });
    });

    // Event listener para el autor seleccionado
    function selectAuthor(authorName, opts = {}) {
        if (!authorName) return;

        const { skipUpdate = false, skipMetrics = false } = opts;

        // Multi-select: accumulate authors.
        selectedAuthorNames.add(authorName);
        window.selectedAuthorNames = selectedAuthorNames;

        // Keep `selectedAuthorName` as an "active author" (used by author-metrics UI and
        // single-author consumers such as the publications table controller).
        // The dashboard endpoints will use `selectedAuthorNames` for additive (OR) behavior.
        selectedAuthorName = authorName;
        window.selectedAuthorName = authorName;

        // Keep input usable: clear it but DO NOT disable.
        if (filtersAuthorSearch) {
            filtersAuthorSearch.value = '';
            filtersAuthorSearch.disabled = false;
            // Keep focus so user can keep adding authors.
            try { filtersAuthorSearch.focus(); } catch (e) { /* ignore */ }
        }
        if (filtersAuthorSuggestions) {
            filtersAuthorSuggestions.style.display = 'none';
        }
        // Hide the old "limit reached" message (no longer applies).
        if (filtersAuthorLimitMessage) {
            filtersAuthorLimitMessage.style.display = 'none';
        }

        // Render selected authors as badges.
        function renderSelectedAuthors() {
            if (!filtersSelectedAuthor) return;
            if (selectedAuthorNames.size === 0) {
                filtersSelectedAuthor.innerHTML = '';
                return;
            }
            filtersSelectedAuthor.innerHTML = Array.from(selectedAuthorNames)
                .map((name) => `
                    <span class="badge bg-primary me-2 mb-2" data-author-name="${String(name).replace(/"/g, '&quot;')}">
                        ${name}
                        <button type="button" class="btn-close btn-close-white ms-1"
                                style="font-size: 0.5rem; vertical-align: middle;"
                                aria-label="Remove"></button>
                    </span>
                `)
                .join('');

            // Wire remove for each badge
            filtersSelectedAuthor.querySelectorAll('.badge[data-author-name] .btn-close').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const badge = btn.closest('.badge[data-author-name]');
                    const name = badge ? badge.getAttribute('data-author-name') : null;
                    if (!name) return;

                    selectedAuthorNames.delete(name);
                    window.selectedAuthorNames = selectedAuthorNames;

                    // Keep active author aligned with the remaining selection.
                    if (selectedAuthorNames.size === 0) {
                        selectedAuthorName = null;
                        window.selectedAuthorName = null;
                    } else if (selectedAuthorName === name || !selectedAuthorName) {
                        const next = Array.from(selectedAuthorNames)[0];
                        selectedAuthorName = next;
                        window.selectedAuthorName = next;
                    }

                    renderSelectedAuthors();

                    // If there are no selected authors, we must return to the baseline dashboard:
                    // - hide author metrics
                    // - refresh visualizations without author filters
                    if (selectedAuthorNames.size === 0) {
                        const existingMetricsCard = document.getElementById('authorMetricsCard');
                        if (existingMetricsCard) {
                            existingMetricsCard.remove();
                        }

                        // Restore full-width layout for the collaboration network when
                        // the author metrics panel is removed.
                        const networkCol = document.getElementById('networkCol');
                        if (networkCol) {
                            networkCol.className = 'col-12 mb-10';
                        }

                        try {
                            updateFilters();
                        } catch (err) {
                            console.error('Error updating dashboard after removing last author:', err);
                            updateVisualizations();
                        }
                        return;
                    }

                    // If exactly one author remains, keep legacy single-author behavior aligned
                    // (i.e., metrics and any single-author consumers should use that author).
                    if (selectedAuthorNames.size === 1) {
                        selectedAuthorName = Array.from(selectedAuthorNames)[0];
                        window.selectedAuthorName = selectedAuthorName;

                        // When we go back to a single author, restore the full-width network
                        // layout (the metrics card will remain, but the IP network shouldn't
                        // keep a leftover 50/50 split.
                        const networkCol = document.getElementById('networkCol');
                        if (networkCol) {
                            networkCol.className = 'col-12 mb-10';
                        }

                        // If the network was in an author view, ensure it refreshes so any
                        // internal author dropdowns don't keep removed authors.
                        try {
                            updateVisualizations();
                        } catch (e3) {
                            console.warn('Could not refresh network after author removal:', e3);
                        }

                        // If the metrics selector exists from a previous multi-selection,
                        // refresh the metrics card to remove it.
                        const metricsSelect = document.getElementById('authorMetricsSelect');
                        if (metricsSelect) {
                            // Trigger a full refresh of the metrics section by re-selecting
                            // the remaining author.
                            try {
                                selectAuthor(selectedAuthorName);
                            } catch (e2) {
                                // If we're inside the author UI handler, avoid breaking the flow.
                                console.warn('Could not refresh author metrics selector after removal:', e2);
                            }
                        }
                    }

                    // Refresh data to reflect the remaining selection (multi/single).
                    try {
                        updateFilters();
                    } catch (err) {
                        console.error('Error updating dashboard after removing author:', err);
                        updateVisualizations();
                    }

                    // If we are still in multi-author mode, ensure the author metrics selector
                    // reflects the current selection (removed authors must not appear).
                    if (selectedAuthorNames.size >= 2) {
                        const metricsSelect = document.getElementById('authorMetricsSelect');
                        const metricsCard = document.getElementById('authorMetricsCard');
                        if (metricsCard && metricsSelect) {
                            const currentValue = metricsSelect.value;
                            const safeAuthors = Array.from(selectedAuthorNames);
                            const nextActive = safeAuthors.includes(currentValue)
                                ? currentValue
                                : (safeAuthors[0] || null);
                            if (nextActive) {
                                selectedAuthorName = nextActive;
                                window.selectedAuthorName = nextActive;
                            }

                            // Recreate the metrics card so the <select> options are rebuilt.
                            try {
                                selectAuthor(selectedAuthorName);
                            } catch (e4) {
                                console.warn('Could not refresh metrics selector after author removal:', e4);
                            }
                        }
                    }
                });
            });
        }

        renderSelectedAuthors();

        /**
         * Fetch and render metrics for a given author into the author metrics table.
         *
         * @param {string} author
         * @returns {Promise<void>}
         */
        async function loadAuthorMetrics(author) {
            if (!author) return;

            const metricsTable = document.getElementById('authorMetricsTable');
            if (metricsTable) {
                metricsTable.innerHTML = '';
            }

            try {
                const response = await fetch(
                    `/BiblioMetrics/${lang}/api/author/metrics/?author_id=${encodeURIComponent(author)}`,
                );
                const data = await response.json();

                if (data.error) {
                    console.error('Error fetching author metrics:', data.error);
                    return;
                }

                const table = document.getElementById('authorMetricsTable');
                if (!table) return;

                // i18n for metric labels (ES/EN)
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
                        international_index: 'Índice de colaboración internacional',
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
                        international_index: 'International Collaboration Index',
                    },
                };

                const tMetric = (k) => (metricNamesI18N[currentLang] && metricNamesI18N[currentLang][k]) || k;

                table.innerHTML = '';
                Object.entries(data.metrics || {}).forEach(([key, value]) => {
                    const row = document.createElement('tr');

                    if (key === 'orcid' && typeof value === 'string' && value.trim() !== '') {
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

                    table.appendChild(row);
                });
            } catch (error) {
                console.error('Error fetching author metrics:', error);
            }
        }

        // Crear y añadir la card de métricas del autor al DOM
        const collaborationRow = document.getElementById('collaborationRow');
        if (!collaborationRow) {
            updateFilters();
            return;
        }

        let authorMetricsCard = document.getElementById('authorMetricsCard');
        if (!authorMetricsCard) {
            authorMetricsCard = document.createElement('div');
            authorMetricsCard.id = 'authorMetricsCard';
            authorMetricsCard.className = 'col-md-6 mt-3 mt-md-0 mb-10 h-100';
            collaborationRow.appendChild(authorMetricsCard);
        }
        
        // Extraer el idioma de forma robusta
        const currentLang = (typeof detectLangFromPath === 'function')
            ? detectLangFromPath()
            : (window.location.pathname.includes('/es/') ? 'es' : 'en');
        const cardTitle = currentLang === 'es' ? 'Resumen de Métricas del Autor' : 'Author Metrics Summary';
        const metricsTitle = currentLang === 'es' ? 'Métrica' : 'Metrics';
        const valuesTitle = currentLang === 'es' ? 'Valor' : 'Value';
        
        const activeAuthorLabel = currentLang === 'es' ? 'Autor' : 'Author';
        const multipleAuthorsHelper = currentLang === 'es'
            ? 'Selecciona el autor del que quieres ver las métricas'
            : 'Select the author you want to see metrics for';

        const showAuthorSelector = selectedAuthorNames.size > 1;
        const authorSelectOptions = Array.from(selectedAuthorNames)
            .map((name) => {
                const selectedAttr = name === authorName ? 'selected' : '';
                const safe = String(name).replace(/"/g, '&quot;');
                return `<option value="${safe}" ${selectedAttr}>${name}</option>`;
            })
            .join('');

        authorMetricsCard.innerHTML = `
            <div class="card dashboard-card h-100">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">${cardTitle}</h5>
                    </div>
                    ${showAuthorSelector ? `
                        <div class="mb-3">
                            <label for="authorMetricsSelect" class="form-label">${activeAuthorLabel}</label>
                            <select id="authorMetricsSelect" class="form-select form-select-sm">
                                ${authorSelectOptions}
                            </select>
                            <div class="form-text">${multipleAuthorsHelper}</div>
                        </div>
                    ` : ''}
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

        if (showAuthorSelector) {
            const select = document.getElementById('authorMetricsSelect');
            if (select) {
                select.addEventListener('change', () => {
                    const nextAuthor = select.value;
                    // Update active author (used by legacy single-author consumers such as
                    // the publications table controller).
                    selectedAuthorName = nextAuthor;
                    window.selectedAuthorName = nextAuthor;

                    // Only update the metrics view; the dashboard queries still use the
                    // additive author set `selectedAuthorNames`.
                    loadAuthorMetrics(nextAuthor);
                });
            }
        }

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

        // Load metrics for the active author (default: the last selected).
        if (!skipMetrics) {
            loadAuthorMetrics(authorName);
        }

        // Actualizar los filtros y visualizaciones con el autor seleccionado
        if (!skipUpdate) {
            updateFilters();
        }
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

        // Recoger el parámetro del selector de número de resultados IA
        const topKSelect = document.getElementById('semanticTopK');
        const top_k = parseTopK(topKSelect, 50);

        // Construir la URL de búsqueda
        const params = buildPublicationsSearchParams({
            selectedAuthorName,
            query: standardSearch.value.trim(),
            topK: top_k,
        });

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

    // Filters-section search listeners
    if (filtersAuthorSearch) {
        filtersAuthorSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            // Multi-select: keep showing suggestions even if one author is already selected.
            if (!query) {
                if (filtersAuthorSuggestions) filtersAuthorSuggestions.style.display = 'none';
                return;
            }

            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                showFiltersAuthorSuggestions(query);
            }, 300);
        });

        filtersAuthorSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && filtersAuthorSuggestions) {
                filtersAuthorSuggestions.style.display = 'none';
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!filtersAuthorSuggestions || !filtersAuthorSearch) return;
        if (
            e.target !== filtersAuthorSearch &&
            !filtersAuthorSuggestions.contains(e.target)
        ) {
            filtersAuthorSuggestions.style.display = 'none';
        }
    });

    // Función para mostrar los resultados de búsqueda
    function showSearchResults(results) {
        const currentLang = (typeof detectLangFromPath === 'function') ? detectLangFromPath() : 'es';
        const searchResults = currentLang === 'es' ? 'Resultados de la búsqueda' : 'Search Results';
        const emptyText = currentLang === 'es' ? 'No se encontraron resultados.' : 'No results found.';
        const authorsLabel = currentLang === 'es' ? 'Autores' : 'Authors';
        const institutionsLabel = currentLang === 'es' ? 'Instituciones' : 'Institutions';
        const areasLabel = currentLang === 'es' ? 'Áreas' : 'Areas';
        const doiLabel = currentLang === 'es' ? 'DOI' : 'DOI';
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
                const doi = (result.doi || '').toString().trim();
                const doiLine = doi ? `<strong>${doiLabel}:</strong> ${doi}<br>` : '';
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
                            <br>${doiLine}
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
                    const nextUrl = encodeURIComponent(window.location.href);
                    window.location.href = `/BiblioMetrics/publication/${publicationId}/?next=${nextUrl}`;
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
    // NOTE: updateSearchButton() was tied to the old main search author UI.
    // The main search is publications-only now, so we don't call it.

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
                    const currentLang = (typeof detectLangFromPath === 'function')
                        ? detectLangFromPath()
                        : (window.location.pathname.includes('/es/') ? 'es' : 'en');
                    const label = getPublicationTypeLabel(type.publication_type, currentLang);
                    option.textContent = `${label} (${type.count})`;
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

    /**
     * Return the UI label for a canonical publication type.
     *
     * Notes:
     * - The backend stores and filters on canonical Spanish keys (e.g., "artículo").
     * - We keep the option value untouched (so filters keep working), and only translate
     *   the label shown to the user when the UI is in English.
     *
     * @param {string} typeKey
     * @param {string} currentLang - 'es' | 'en'
     * @returns {string}
     */
    function getPublicationTypeLabel(typeKey, currentLang) {
        const key = String(typeKey || '').trim();
        if (!key) return '';
        if (currentLang !== 'en') return key;

        const dict = {
            'artículo': 'Article',
            'artículo de revisión': 'Review article',
            'bibliografía': 'Bibliography',
            'capítulo de libro': 'Book chapter',
            'carta': 'Letter',
            'comunicación de congreso': 'Conference paper',
            'editorial': 'Editorial',
            'libro': 'Book',
            'nota': 'Note',
            'reseña': 'Review',
            'reseña de libro': 'Book review',
            'otro': 'Other',
            'conferencias y seminarios': 'Conferences and seminars',
            'publicación retractada': 'Retracted publication',
            'corrigenda': 'Corrigenda',
        };

        return dict[key] || key;
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

    /**
     * Reset filter UI/state without triggering a data refresh.
     *
     * This is used by the "Clear filters" button, where we want to navigate to the
     * canonical dashboard URL (no querystring). Triggering updateFilters() here would
     * briefly re-persist stale state to the URL.
     *
     * @returns {void}
     */
    function resetFiltersUiOnly() {
        yearFrom.value = '';
        yearTo.value = '';
        if (citationsFrom) citationsFrom.value = '';
        if (citationsTo) citationsTo.value = '';

        selectedAreasList.clear();
        selectedInstitutionsList.clear();
        selectedTypesList.clear();
        selectedQuartilesList.clear();

        selectedAreas.innerHTML = '';
        selectedInstitutions.innerHTML = '';
        selectedTypes.innerHTML = '';
        selectedQuartiles.innerHTML = '';

        if (quartileFilter) quartileFilter.value = '';
    }

    /**
     * Get the canonical dashboard URL (no querystring).
     *
     * We keep a trailing slash because Django URLs typically redirect without it,
     * and certain client-side logic expects the canonical form.
     *
     * @returns {string}
     */
    function getCanonicalDashboardUrl() {
        // Example path: /es/dashboard/ or /en/dashboard/
        const path = window.location.pathname;
        const cleaned = path.endsWith('/') ? path : `${path}/`;
        return `${window.location.origin}${cleaned}`;
    }

    // --- ÁREAS TEMÁTICAS: LÓGICA DE BOTONES Y RENDER ---
    let currentAreasView = 'pie';
    /**
     * Persist dashboard state to the URL so browser back/forward keeps filters.
     *
     * Contract:
     * - Only uses querystring (no local/session storage).
     * - Encodes multi-author selection by repeating `author`.
     * - Safe to call frequently (uses history.replaceState).
     *
     * @param {URLSearchParams} params
     * @returns {void}
     */
    function persistDashboardStateToUrl(params) {
        try {
            const currentPath = window.location.pathname;
            const next = params.toString();
            const newUrl = next ? `${currentPath}?${next}` : currentPath;
            window.history.replaceState({}, '', newUrl);
        } catch (e) {
            console.warn('Could not persist dashboard state to URL:', e);
        }
    }

    /**
     * Restore dashboard state from the querystring on initial load.
     *
     * Notes:
     * - We restore the most important state: filters + authors.
     * - UI-dependent views (timeline/monthly, areas view) will be restored when possible.
     *
     * @returns {void}
     */
    function restoreDashboardStateFromUrl() {
        const qs = new URLSearchParams(window.location.search || '');
        if (!qs || Array.from(qs.keys()).length === 0) return;

        // Years
        const yFrom = qs.get('year_from');
        const yTo = qs.get('year_to');
        if (yearFrom && yFrom) yearFrom.value = yFrom;
        if (yearTo && yTo) yearTo.value = yTo;

        // Citations
        const cFrom = qs.get('citations_from');
        const cTo = qs.get('citations_to');
        if (citationsFrom && cFrom !== null) citationsFrom.value = cFrom;
        if (citationsTo && cTo !== null) citationsTo.value = cTo;

        // Multi-value filters
        (qs.getAll('areas') || []).forEach((a) => {
            if (a && !selectedAreasList.has(a)) {
                selectedAreasList.add(a);
                createBadge(a, selectedAreas, selectedAreasList);
            }
        });
        (qs.getAll('institutions') || []).forEach((i) => {
            if (i && !selectedInstitutionsList.has(i)) {
                selectedInstitutionsList.add(i);
                createBadge(i, selectedInstitutions, selectedInstitutionsList);
            }
        });
        (qs.getAll('types') || []).forEach((t) => {
            if (t && !selectedTypesList.has(t)) {
                selectedTypesList.add(t);
                createBadge(t, selectedTypes, selectedTypesList);
            }
        });
        (qs.getAll('quartiles') || []).forEach((q) => {
            if (q && !selectedQuartilesList.has(q)) {
                selectedQuartilesList.add(q);
                createBadge(q, selectedQuartiles, selectedQuartilesList);
            }
        });

        // Authors (repeated)
        const authors = (qs.getAll('author') || []).filter((a) => String(a || '').trim() !== '');
        if (authors.length > 0) {
            // Reset current selection to avoid accumulating across reloads.
            selectedAuthorNames = new Set();
            window.selectedAuthorNames = selectedAuthorNames;

            // Use selectAuthor to rebuild badges + remove handlers + metrics card.
            authors.forEach((name, idx) => {
                const isLast = idx === (authors.length - 1);
                try {
                    selectAuthor(name, { skipUpdate: true, skipMetrics: !isLast });
                } catch (e) {
                    console.warn('Could not restore author from URL:', name, e);
                }
            });

            // Ensure the active author matches the last selected.
            selectedAuthorName = authors[authors.length - 1] || authors[0];
            window.selectedAuthorName = selectedAuthorName;
        }

        // Predicted areas flag
        includePredictedAreas = qs.get('include_predicted_areas') === 'true';

        // Trigger a single refresh.
        updateFilters();
    }
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
    async function updateVisualizations(options = {}) {
        const { skipPublicationsTable = false } = options;
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
        const params = buildDashboardFilterParams({
            yearFromEl: yearFrom,
            yearToEl: yearTo,
            citationsFromEl: citationsFrom,
            citationsToEl: citationsTo,
            selectedAreas: selectedAreasList,
            selectedInstitutions: selectedInstitutionsList,
            selectedTypes: selectedTypesList,
            selectedQuartiles: selectedQuartilesList,
            includePredictedAreas,
            selectedAuthorName,
            selectedAuthorNames,
            viewType: filters.view_type,
        });

        // Obtener los datos filtrados
        try {
            const response = await fetch(`/BiblioMetrics/${lang}/api/dashboard/data/?${params.toString()}`);
            const data = await response.json();

            // Update filtered publications count (below filters).
            try {
                const countEl = document.getElementById('filteredPublicationsCount');
                if (countEl) {
                    const currentLang = (typeof detectLangFromPath === 'function')
                        ? detectLangFromPath()
                        : (window.location.pathname.includes('/es/') ? 'es' : 'en');
                    const total = (data && typeof data.total_publications === 'number')
                        ? data.total_publications
                        : null;

                    if (total === null) {
                        countEl.textContent = '';
                    } else {
                        const label = currentLang === 'es'
                            ? 'Publicaciones que cumplen los filtros:'
                            : 'Publications matching filters:';
                        countEl.textContent = `${label} ${total}`;
                    }
                }
            } catch (e) {
                console.warn('Could not update filtered publications count:', e);
            }

            // Obtener datos de la red de colaboración
            const networkParams = cloneSearchParams(params); // Clonar los parámetros existentes
            networkParams.append('view_type', window.currentCommunityView); // Añadir el tipo de vista de comunidad

            // Keep network scope consistent with the toggle (IPs vs full network).
            // Without this, the refresh flow always fetches the IPs network and overwrites
            // the full network rendered by the toggle handler.
            networkParams.append('fullNetwork', isFullNetwork ? 'true' : 'false');

            const networkPromise = fetch(`/BiblioMetrics/${lang}/api/dashboard/collaboration-network/?${networkParams.toString()}`)
                .then(r => r.json())
                .then(networkData => {
                    updateCollaborationNetwork(networkData);
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
            // NOTE: When the user toggles/switches only the network view, we avoid reloading the
            // publications table to prevent showing the table spinner for a network-only change.
            let tablePromise = Promise.resolve();
            if (!skipPublicationsTable) {
                tablePromise = updatePublicationsTable(1).catch(() => {});
            }

                // Actualizar mapa (Mundo/España) con agregación en servidor
            try {
                    const paramsAll = cloneSearchParams(params);
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

            // Ensure the caller can await the completion of network rendering triggers.
            await Promise.allSettled([networkPromise, tablePromise]);
        } catch (error) {
            console.error('Error updating visualizations:', error);
        }
    }

    // Estado de ordenación actual (mover fuera de la función para mantenerlo entre llamadas)
    const publicationsTableController = createPublicationsTableController({
        getLang: () => lang,
        getBaseUrl: () => '/BiblioMetrics',
        getSelectedAuthorName: () => selectedAuthorName,
        getSelectedAuthorNames: () => Array.from(selectedAuthorNames || []),
        getFilters: () => ({
            year_from: yearFrom.value,
            year_to: yearTo.value,
            areas: Array.from(selectedAreasList),
            institutions: Array.from(selectedInstitutionsList),
            types: Array.from(selectedTypesList),
            quartiles: Array.from(selectedQuartilesList),
            citations_from: citationsFrom ? citationsFrom.value : '',
            citations_to: citationsTo ? citationsTo.value : '',
        }),
        detectLangFromPath,
    });

    function updatePublicationsTable(page = 1) {
        return publicationsTableController.updatePublicationsTable(page);
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
        // Reset UI/state (including new filters) without triggering URL persistence.
        resetFiltersUiOnly();

        // Reset authors (single + multi) and clear UI.
        selectedAuthorName = null;
        window.selectedAuthorName = null;
        selectedAuthorNames = new Set();
        window.selectedAuthorNames = selectedAuthorNames;
        if (filtersSelectedAuthor) filtersSelectedAuthor.innerHTML = '';

        // Hide author-metrics card + selector if present.
        try {
            const metricsCard = document.getElementById('authorMetricsCard');
            if (metricsCard) metricsCard.style.display = 'none';
            const authorSelectContainer = document.getElementById('authorSelectContainer');
            if (authorSelectContainer) authorSelectContainer.style.display = 'none';
        } catch (e) {
            console.warn('Could not reset author metrics UI:', e);
        }

        // IMPORTANT: we must end up in the clean dashboard URL (no querystring).
        // Using replaceState alone is not enough because updateFilters() will immediately
        // re-persist the (possibly stale) state. We force navigation to the base path.
        const baseDashboardUrl = getCanonicalDashboardUrl();
        window.location.assign(baseDashboardUrl);
    });

    let renderer = null;
    let showAllLabels = false;
    window.currentCommunityView = 'modularity-7';
    window.currentClusteringModel = null;
    window.currentNClusters = null;
    let isFullNetwork = false;

    const collaborationNetworkController = createCollaborationNetworkController({
        getLang: () => lang,
        detectLangFromPath,
        getIsFullNetwork: () => isFullNetwork,
        setIsFullNetwork: (next) => {
            isFullNetwork = next;
        },
        updateVisualizations,
    });

    function updateCollaborationNetwork(data) {
        return collaborationNetworkController.updateCollaborationNetwork(data, {
            renderer,
            setRenderer: (r) => {
                renderer = r;
            },
            showAllLabels,
        });
    }

    function updateCommunityDropdownText(model = null, nClusters = null) {
        return collaborationNetworkController.updateCommunityDropdownText(model, nClusters);
    }

    collaborationNetworkController.initNetworkHandlers({
        getRendererRef: () => renderer,
        setRendererRef: (r) => {
            renderer = r;
        },
        getShowAllLabels: () => showAllLabels,
        setShowAllLabels: (v) => {
            showAllLabels = v;
        },
    });

    // NOTE (2026-01): We intentionally keep the legacy community dropdown handler
    // in this file for now (stability). Do not gate it off.

    // Helper para detección robusta del idioma.
    // NOTE: wrapper kept intentionally, so we don't have to change any call sites yet.
    function detectLangFromPath() {
        return detectLangFromPathUtil();
    }
    
    // (Collaboration network handlers and dropdown text moved to ./dashboard/collaboration_network.js)
    
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

        // Add selected authors.
        if (selectedAuthorNames && selectedAuthorNames.size > 1) {
            Array.from(selectedAuthorNames).forEach((name) => params.append('author', name));
        } else if (selectedAuthorName) {
            params.append('author', selectedAuthorName);
        }

        // Persist current state so going to publication details and back keeps filters.
        persistDashboardStateToUrl(params);

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
                    const label = getPublicationTypeLabel(type.publication_type, currentLang);
                    option.textContent = `${label} (${type.count})`;
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

    // (Full network toggle + view change overlay fetch moved to ./dashboard/collaboration_network.js)

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
        const mapViewsController = createMapViewsController({
            initWorldMap,
            initSpainMap,
            setSpainMapVisible,
            showSpainLevel,
            updateVisualizations,
            detectLangFromPath,
        });
        mapViewsController.init();

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

    // Restore state from querystring after handlers are ready.
    try {
        restoreDashboardStateFromUrl();
    } catch (e) {
        console.warn('Could not restore dashboard state from URL:', e);
    }
}