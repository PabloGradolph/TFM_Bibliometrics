/**
 * Utilities for building search-related parameters.
 */

/**
 * Parse an integer from a UI select element.
 *
 * @param {HTMLSelectElement|null} selectEl
 * @param {number} defaultValue
 * @returns {number}
 */
export function parseTopK(selectEl, defaultValue = 50) {
    if (!selectEl) return defaultValue;
    return parseInt(selectEl.value, 10) || defaultValue;
}

/**
 * Build URLSearchParams for the publications search endpoint.
 *
 * Behavior is preserved:
 * - If an author is selected, send `author=<name>`.
 * - Otherwise, send `q=<query>`.
 * - Always send `top_k`.
 *
 * @param {object} params
 * @param {string|null} params.selectedAuthorName
 * @param {string} params.query
 * @param {number} params.topK
 * @returns {URLSearchParams}
 */
export function buildPublicationsSearchParams({
    selectedAuthorName,
    query,
    topK,
}) {
    const qs = new URLSearchParams();

    if (selectedAuthorName) {
        qs.append('author', selectedAuthorName);
    } else {
        qs.append('q', query);
    }

    qs.append('top_k', topK);
    return qs;
}
