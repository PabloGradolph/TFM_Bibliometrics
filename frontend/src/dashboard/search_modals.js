/**
 * Search result modals.
 *
 * This module centralizes the DOM creation and rendering for:
 * - Standard search results modal (title/DOI search)
 * - Semantic (AI) search results modal
 */

/**
 * Ensure the standard search results modal exists.
 *
 * @param {string} titleText
 * @returns {HTMLElement}
 */
function ensureStandardResultsModal(titleText) {
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
                        <h5 class="modal-title">${titleText}</h5>
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
    if (modalTitle) modalTitle.textContent = titleText;
    return modal;
}

/**
 * Ensure the semantic results modal exists.
 *
 * @param {string} titleText
 * @returns {HTMLElement}
 */
function ensureSemanticResultsModal(titleText) {
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
    }

    const hdr = modal.querySelector('.modal-title');
    if (hdr) hdr.textContent = titleText;
    return modal;
}

/**
 * Show standard search results in a Bootstrap modal.
 *
 * @param {object} params
 * @param {Array<object>} params.results
 * @param {() => string} params.detectLang
 * @param {string} [params.nextUrl]
 * @param {any} params.bootstrap
 * @returns {void}
 */
export function showStandardSearchResultsModal({
    results,
    detectLang,
    nextUrl,
    bootstrap,
}) {
    const currentLang = detectLang();
    const searchResults = currentLang === 'es' ? 'Resultados de la búsqueda' : 'Search Results';
    const emptyText = currentLang === 'es' ? 'No se encontraron resultados.' : 'No results found.';
    const authorsLabel = currentLang === 'es' ? 'Autores' : 'Authors';
    const institutionsLabel = currentLang === 'es' ? 'Instituciones' : 'Institutions';
    const areasLabel = currentLang === 'es' ? 'Áreas' : 'Areas';
    const doiLabel = currentLang === 'es' ? 'DOI' : 'DOI';
    const viewLinkText = currentLang === 'es' ? 'Ver publicación' : 'View publication';

    const modal = ensureStandardResultsModal(searchResults);

    const resultsList = document.getElementById('searchResultsList');
    if (!resultsList) return;

    if (!Array.isArray(results) || results.length === 0) {
        resultsList.innerHTML = `<p class="text-center">${emptyText}</p>`;
    } else {
        resultsList.innerHTML = results
            .map((result) => {
                const authors = Array.isArray(result.authors)
                    ? result.authors.join(', ')
                    : (result.authors || '');
                const otherAuthors = Array.isArray(result.other_authors) && result.other_authors.length > 0
                    ? ` <span class="text-muted">(${result.other_authors.join(', ')})</span>`
                    : '';
                const doi = (result.doi || '').toString().trim();
                const doiLine = doi ? `<strong>${doiLabel}:</strong> ${doi}<br>` : '';

                // Keep the same DOM structure to preserve styling and click handlers.
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
            })
            .join('');
    }

    // Attach click handlers (same behavior as before)
    resultsList.querySelectorAll('.card-body').forEach((cardBody) => {
        cardBody.addEventListener('click', function () {
            const publicationId = this.dataset.publicationId;
            if (!publicationId) return;
            const next = typeof nextUrl === 'string' && nextUrl ? nextUrl : window.location.href;
            const encodedNext = encodeURIComponent(next);
            window.location.href = `/BiblioMetrics/publication/${publicationId}/?next=${encodedNext}`;
        });
    });

    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
}

/**
 * Show semantic search results in a modal, ordered by similarity.
 *
 * @param {object} params
 * @param {Array<object>} params.results
 * @param {() => string} params.detectLang
 * @param {any} params.bootstrap
 * @param {HTMLSelectElement|null} params.topKSelectEl
 * @param {() => (string|null)} params.getLastQuery
 * @param {(query: string, topK: number, lang: string) => Promise<Array<object>>} params.fetchSemantic
 * @returns {void}
 */
export function showSemanticSearchResultsModal({
    results,
    detectLang,
    bootstrap,
    topKSelectEl,
    getLastQuery,
    fetchSemantic,
}) {
    const currentLang = detectLang();
    const titleText = currentLang === 'es' ? 'Resultados IA' : 'AI Search Results';

    // Defensive: ensure we have an array
    if (!Array.isArray(results)) results = [];

    // Sort by similarity desc if similarity field exists
    results = results.slice().sort((a, b) => {
        const sa = (typeof a.similarity === 'number') ? a.similarity : 0;
        const sb = (typeof b.similarity === 'number') ? b.similarity : 0;
        return sb - sa;
    });

    const modal = ensureSemanticResultsModal(titleText);

    const list = document.getElementById('semanticResultsList');
    if (!list) return;

    /**
     * @param {Array<object>} res
     * @returns {void}
     */
    function renderSemanticResults(res) {
        if (!Array.isArray(res) || res.length === 0) {
            list.innerHTML = '<p class="text-center">' + (currentLang === 'es' ? 'No se encontraron resultados.' : 'No results found.') + '</p>';
            return;
        }

        list.innerHTML = res.map((r) => {
            const simText = (typeof r.similarity === 'number')
                ? `<div class="text-end text-muted" style="font-size:0.9rem">${(r.similarity * 100).toFixed(1)}% similar</div>`
                : '';
            const authors = Array.isArray(r.authors) ? r.authors.join(', ') : (r.authors || '');
            const otherAuthors = Array.isArray(r.other_authors) && r.other_authors.length > 0
                ? ` <span class="text-muted">(${r.other_authors.join(', ')})</span>`
                : '';
            const areasFallback = Array.isArray(r.areas) && r.areas.length
                ? r.areas
                : (Array.isArray(r.areas_all) ? r.areas_all : []);
            const areas = areasFallback.length
                ? areasFallback.join(', ')
                : (currentLang === 'es' ? 'Sin áreas registradas' : 'No areas available');
            const institutions = Array.isArray(r.institutions) && r.institutions.length
                ? r.institutions.join(', ')
                : '';
            const instLabel = currentLang === 'es' ? 'Instituciones' : 'Institutions';
            const areasLabel = currentLang === 'es' ? 'Áreas' : 'Areas';
            const pubType = r.publication_type || '';
            const year = r.year || '';
            const subtitleText = (year ? year : '') + (pubType ? ` - ${pubType}` : '');
            const urlLink = r.url
                ? `<a href="${r.url}" class="card-link" target="_blank">${currentLang === 'es' ? 'Ver publicación' : 'View publication'}</a>`
                : '';

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
        container.querySelectorAll('.card-body').forEach((cardBody) => {
            cardBody.addEventListener('click', function () {
                const publicationId = this.dataset.publicationId;
                if (publicationId) {
                    window.location.href = `/BiblioMetrics/publication/${publicationId}/`;
                }
            });
        });
    }

    renderSemanticResults(results);

    // Selector event: re-run semantic query with a new top_k
    if (topKSelectEl) {
        topKSelectEl.addEventListener('change', function () {
            const topK = parseInt(this.value, 10);
            const lastQuery = getLastQuery();
            if (!lastQuery) return;

            fetchSemantic(lastQuery, topK, currentLang)
                .then((newResults) => {
                    renderSemanticResults(newResults || []);
                })
                .catch(() => {
                    // Keep existing UI if refresh fails.
                });
        });
    }

    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
}
