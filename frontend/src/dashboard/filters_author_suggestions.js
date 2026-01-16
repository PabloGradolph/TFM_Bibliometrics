/**
 * Author suggestions fetching and rendering for the Filters section.
 */

/**
 * Build query parameters for the filters author suggestions endpoint.
 *
 * @param {object} params
 * @param {string} params.query
 * @param {HTMLInputElement|null} params.yearFromEl
 * @param {HTMLInputElement|null} params.yearToEl
 * @param {HTMLInputElement|null} params.citationsFromEl
 * @param {HTMLInputElement|null} params.citationsToEl
 * @param {Set<string>} params.selectedAreas
 * @param {Set<string>} params.selectedInstitutions
 * @param {Set<string>} params.selectedTypes
 * @param {Set<string>} params.selectedQuartiles
 * @returns {URLSearchParams}
 */
export function buildFiltersAuthorSuggestionParams({
    query,
    yearFromEl,
    yearToEl,
    citationsFromEl,
    citationsToEl,
    selectedAreas,
    selectedInstitutions,
    selectedTypes,
    selectedQuartiles,
}) {
    const qs = new URLSearchParams();
    qs.set('q', query);

    if (yearFromEl && yearFromEl.value) qs.append('year_from', yearFromEl.value);
    if (yearToEl && yearToEl.value) qs.append('year_to', yearToEl.value);
    if (citationsFromEl && citationsFromEl.value) {
        qs.append('citations_from', citationsFromEl.value);
    }
    if (citationsToEl && citationsToEl.value) qs.append('citations_to', citationsToEl.value);

    selectedAreas.forEach((a) => qs.append('areas', a));
    selectedInstitutions.forEach((i) => qs.append('institutions', i));
    selectedTypes.forEach((t) => qs.append('types', t));
    selectedQuartiles.forEach((q) => qs.append('quartiles', q));

    return qs;
}

/**
 * Render suggestions list items into the dropdown.
 *
 * @param {object} params
 * @param {HTMLElement} params.suggestionsEl
 * @param {Array<{name: string, count: number}>} params.suggestions
 * @param {(authorName: string) => void} params.onSelectAuthor
 * @returns {void}
 */
export function renderFiltersAuthorSuggestions({
    suggestionsEl,
    suggestions,
    onSelectAuthor,
}) {
    const suggestionsList = suggestionsEl.querySelector('.list-group');
    if (!suggestionsList) return;

    suggestionsList.innerHTML = '';

    suggestions.forEach((author) => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        item.innerHTML = `
            ${author.name}
            <span class="badge bg-secondary float-end">${author.count} pub.</span>
        `;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            onSelectAuthor(author.name);
        });
        suggestionsList.appendChild(item);
    });
}

/**
 * Fetch and show author suggestions for the Filters section author search.
 *
 * @param {object} params
 * @param {string} params.lang
 * @param {string} params.query
 * @param {HTMLInputElement|HTMLElement|null} params.searchEl
 * @param {HTMLElement|null} params.suggestionsEl
 * @param {() => void} params.ensurePortal
 * @param {() => void} params.positionDropdown
 * @param {() => void} params.hideDropdown
 * @param {() => void} params.showDropdown
 * @param {() => void} params.clearSuggestions
 * @param {(authorName: string) => void} params.selectAuthor
 * @param {URLSearchParams} params.queryParams
 * @returns {void}
 */
export function showFiltersAuthorSuggestions({
    lang,
    query,
    searchEl,
    suggestionsEl,
    ensurePortal,
    positionDropdown,
    hideDropdown,
    showDropdown,
    clearSuggestions,
    selectAuthor,
    queryParams,
}) {
    if (!searchEl || !suggestionsEl) return;

    ensurePortal();

    // Allow suggestions even after selecting one author (multi-select).
    if (!query) {
        hideDropdown();
        return;
    }

    fetch(`/BiblioMetrics/${lang}/api/search/authors/?${queryParams.toString()}`)
        .then((response) => response.json())
        .then((data) => {
            clearSuggestions();

            if (!data.suggestions || data.suggestions.length === 0) {
                hideDropdown();
                return;
            }

            renderFiltersAuthorSuggestions({
                suggestionsEl,
                suggestions: data.suggestions,
                onSelectAuthor: selectAuthor,
            });

            showDropdown();
            positionDropdown();
        })
        .catch((error) => {
            console.error('Error fetching author suggestions (filters):', error);
            hideDropdown();
        });
}
