/**
 * Publications table rendering, sorting, and pagination.
 */

/**
 * Create a publications table updater.
 *
 * This module keeps the sorting state internally and exposes a single function
 * compatible with the old `updatePublicationsTable(page)` call site.
 *
 * @param {Object} deps
 * @param {() => string} deps.getLang - Returns current language slug (e.g. 'es'/'en').
 * @param {() => string} deps.getBaseUrl - Returns base URL prefix (e.g. '/BiblioMetrics').
 * @param {() => (string|null)} deps.getSelectedAuthorName - Selected author name, or null.
 * @param {(() => string[])|undefined} deps.getSelectedAuthorNames - Selected author names list.
 * @param {() => Object} deps.getFilters - Returns current filters (year_from, year_to, lists, citations).
 * @param {() => ('es'|'en')} deps.detectLangFromPath - Language detector.
 * @returns {{ updatePublicationsTable: (page?: number) => Promise<void> }}
 */
export function createPublicationsTableController({
    getLang,
    getBaseUrl,
    getSelectedAuthorName,
    getSelectedAuthorNames,
    getFilters,
    detectLangFromPath,
}) {
    /** @type {{metric: (string|null), direction: 'asc'|'desc'}} */
    const currentSort = {
        metric: null,
        direction: 'desc',
    };

    const orderedMetrics = [
        { key: 'Dimensions Citations', label: 'Dimensions Citations' },
        { key: 'WoS Citations', label: 'WoS Citations' },
        { key: 'Scopus Citations', label: 'Scopus Citations' },
        { key: 'FCR', label: 'FCR' },
        { key: 'RCR', label: 'RCR' },
        { key: 'International Collaboration', label: 'International Collaboration' },
    ];

    const metricTranslations = {
        es: {
            title: 'Título',
            'Dimensions Citations': 'Citas Dimensions',
            'WoS Citations': 'Citas WoS',
            'Scopus Citations': 'Citas Scopus',
            'International Collaboration': 'Colaboración Internacional',
            FCR: 'FCR',
            RCR: 'RCR',
        },
        en: {
            title: 'Title',
            'Dimensions Citations': 'Dimensions Citations',
            'WoS Citations': 'WoS Citations',
            'Scopus Citations': 'Scopus Citations',
            'International Collaboration': 'International Collaboration',
            FCR: 'FCR',
            RCR: 'RCR',
        },
    };

    /**
     * Translate a metric label.
     *
     * @param {string} k
     * @returns {string}
     */
    function t(k) {
        const langCode = typeof detectLangFromPath === 'function'
            ? detectLangFromPath()
            : (window.location.pathname.includes('/en/') ? 'en' : 'es');
        return (metricTranslations[langCode] && metricTranslations[langCode][k]) || k;
    }

    /**
     * Render the table body rows.
     *
     * @param {HTMLElement} tableBody
     * @param {Array<Object>} publications
     */
    function updateTableContent(tableBody, publications) {
        tableBody.innerHTML = publications
            .map(
                (pub) => `
                        <tr class="publication-row" data-publication-id="${pub.id}" style="cursor: pointer;">
                            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pub.title}</td>
                            ${orderedMetrics
                                .map(({ key }) => {
                                    const metric = pub.metrics[key];
                                    const displayValue = metric && metric.value !== null ? metric.value : '';
                                    return `<td>${displayValue}</td>`;
                                })
                                .join('')}
                            <td>${pub.international_collab !== null ? pub.international_collab : '-'}</td>
                        </tr>
                    `,
            )
            .join('');

        tableBody.querySelectorAll('.publication-row').forEach((row) => {
            row.addEventListener('click', function () {
                const publicationId = this.dataset.publicationId;
                if (publicationId) {
                    window.location.href = `/BiblioMetrics/publication/${publicationId}/`;
                }
            });
        });
    }

    /**
     * Render pagination links.
     *
     * @param {HTMLElement} paginationEl
     * @param {{ total_pages: number, current_page: number }} paginationData
     * @param {(page: number) => void} onPage
     */
    function renderPagination(paginationEl, paginationData, onPage) {
        if (paginationData.total_pages > 1) {
            let paginationHTML = `
                        <li class="page-item ${paginationData.current_page === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="1">&laquo;</a>
                        </li>
                        <li class="page-item ${paginationData.current_page === 1 ? 'disabled' : ''}">
                            <a class="page-link" href="#" data-page="${paginationData.current_page - 1}">&lt;</a>
                        </li>
                    `;

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

            paginationEl.innerHTML = paginationHTML;
        } else {
            paginationEl.innerHTML = '';
        }

        paginationEl.querySelectorAll('.page-link').forEach((link) => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const page = parseInt(this.dataset.page, 10);
                if (!Number.isNaN(page)) {
                    onPage(page);
                }
            });
        });
    }

    /**
     * Ensure a loader overlay exists.
     *
     * @param {HTMLTableElement|null} table
     */
    function showLoading(table) {
        if (!table) return;

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
        table.style.pointerEvents = 'none';
        table.style.opacity = '0.7';
    }

    /**
     * Hide loader overlay.
     *
     * @param {HTMLTableElement|null} table
     */
    function hideLoading(table) {
        if (!table) return;

        const loadingOverlay = table.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        table.style.pointerEvents = 'auto';
        table.style.opacity = '1';
    }

    /**
     * Update publications table.
     *
     * @param {number} [page=1]
     * @returns {Promise<void>}
     */
    async function updatePublicationsTable(page = 1) {
        const tableBody = document.getElementById('metricsTable');
        const pagination = document.getElementById('publicationsPagination');
        const table = tableBody ? tableBody.closest('table') : null;

        showLoading(table);

        try {
            if (!tableBody || !pagination) {
                throw new Error('Required elements not found');
            }

            const filters = getFilters();

            const params = new URLSearchParams();
            if (filters.year_from) params.append('year_from', filters.year_from);
            if (filters.year_to) params.append('year_to', filters.year_to);
            if (filters.citations_from) params.append('citations_from', filters.citations_from);
            if (filters.citations_to) params.append('citations_to', filters.citations_to);
            (filters.areas || []).forEach((area) => params.append('areas', area));
            (filters.institutions || []).forEach((institution) => params.append('institutions', institution));
            (filters.types || []).forEach((type) => params.append('types', type));
            (filters.quartiles || []).forEach((q) => params.append('quartiles', q));

            params.append('page', String(page));

            const selectedAuthorNames = typeof getSelectedAuthorNames === 'function'
                ? getSelectedAuthorNames()
                : [];

            if (Array.isArray(selectedAuthorNames) && selectedAuthorNames.length > 0) {
                selectedAuthorNames.forEach((name) => {
                    if (name) params.append('author', name);
                });
            } else {
                const selectedAuthorName = getSelectedAuthorName();
                if (selectedAuthorName) {
                    params.append('author', selectedAuthorName);
                }
            }

            if (currentSort.metric) {
                params.append('sort_by', currentSort.metric);
                params.append('sort_order', currentSort.direction);
            }

            const lang = getLang();
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/${lang}/api/dashboard/publications/?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            const { data: publications, pagination: paginationData } = data.publications;

            const tableHeader = document.createElement('thead');
            tableHeader.innerHTML = `
                    <tr>
                        <th style="max-width: 300px;">${t('title')}</th>
                        ${orderedMetrics
                            .map(
                                ({ key }) => `
                            <th class="sortable" data-metric="${key}">
                                ${t(key)}
                                <i class="fas fa-sort${
                                    currentSort.metric === key
                                        ? `-${currentSort.direction === 'desc' ? 'down' : 'up'}`
                                        : ''
                                } ms-1"></i>
                            </th>
                        `,
                            )
                            .join('')}
                    </tr>
                `;

            if (table) {
                const existingHeader = table.querySelector('thead');
                if (existingHeader) existingHeader.remove();
                table.insertBefore(tableHeader, tableBody);
            }

            tableHeader.querySelectorAll('.sortable').forEach((header) => {
                header.addEventListener('click', function () {
                    const metric = this.dataset.metric;
                    const icon = this.querySelector('i');

                    tableHeader.querySelectorAll('.sortable i').forEach((i) => {
                        i.className = 'fas fa-sort ms-1';
                    });

                    if (currentSort.metric === metric) {
                        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
                    } else {
                        currentSort.metric = metric;
                        currentSort.direction = 'desc';
                    }

                    icon.className = `fas fa-sort-${currentSort.direction === 'desc' ? 'down' : 'up'} ms-1`;

                    // Refresh table sorted, always from first page.
                    void updatePublicationsTable(1);
                });
            });

            updateTableContent(tableBody, publications);

            renderPagination(pagination, paginationData, (newPage) => {
                void updatePublicationsTable(newPage);
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error updating publications table:', error);
            throw error;
        } finally {
            hideLoading(table);
        }
    }

    return {
        updatePublicationsTable,
    };
}
