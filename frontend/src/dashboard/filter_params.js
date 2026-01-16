/**
 * Shared helpers to build URLSearchParams for dashboard endpoints.
 */

/**
 * Build URLSearchParams based on the currently selected dashboard filters.
 *
 * This helper is intentionally conservative: it only adds keys when values exist
 * (matching the existing dashboard behavior).
 *
 * @param {object} params
 * @param {HTMLInputElement|null} params.yearFromEl
 * @param {HTMLInputElement|null} params.yearToEl
 * @param {HTMLInputElement|null} params.citationsFromEl
 * @param {HTMLInputElement|null} params.citationsToEl
 * @param {Set<string>} params.selectedAreas
 * @param {Set<string>} params.selectedInstitutions
 * @param {Set<string>} params.selectedTypes
 * @param {Set<string>} params.selectedQuartiles
 * @param {boolean} [params.includePredictedAreas]
 * @param {string|null} [params.selectedAuthorName]
 * @param {Set<string>|null} [params.selectedAuthorNames]
 * @param {string|null} [params.viewType]
 * @returns {URLSearchParams}
 */
export function buildDashboardFilterParams({
    yearFromEl,
    yearToEl,
    citationsFromEl,
    citationsToEl,
    selectedAreas,
    selectedInstitutions,
    selectedTypes,
    selectedQuartiles,
    includePredictedAreas = false,
    selectedAuthorName = null,
    selectedAuthorNames = null,
    viewType = null,
}) {
    const qs = new URLSearchParams();

    if (yearFromEl && yearFromEl.value) qs.append('year_from', yearFromEl.value);
    if (yearToEl && yearToEl.value) qs.append('year_to', yearToEl.value);

    if (citationsFromEl && citationsFromEl.value) {
        qs.append('citations_from', citationsFromEl.value);
    }
    if (citationsToEl && citationsToEl.value) {
        qs.append('citations_to', citationsToEl.value);
    }

    selectedAreas.forEach((a) => qs.append('areas', a));
    selectedInstitutions.forEach((i) => qs.append('institutions', i));
    selectedTypes.forEach((t) => qs.append('types', t));
    selectedQuartiles.forEach((q) => qs.append('quartiles', q));

    if (viewType) qs.append('view_type', viewType);
    if (includePredictedAreas) qs.append('include_predicted_areas', 'true');

    // Add selected authors.
    // - Single author: keep legacy `author=<name>`
    // - Multiple authors: send repeated `author=<name>` (OR semantics in backend)
    if (selectedAuthorNames && selectedAuthorNames.size > 1) {
        Array.from(selectedAuthorNames).forEach((name) => qs.append('author', name));
    } else if (selectedAuthorName) {
        qs.append('author', selectedAuthorName);
    }

    return qs;
}

/**
 * Clone URLSearchParams.
 *
 * @param {URLSearchParams} params
 * @returns {URLSearchParams}
 */
export function cloneSearchParams(params) {
    return new URLSearchParams(params);
}
