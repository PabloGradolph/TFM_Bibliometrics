/**
 * AI semantic search handler for the dashboard.
 *
 * Keeps behavior compatible with the previous inline implementation:
 * - Reads query from #aiSearch
 * - Uses #semanticTopK for top_k (defaults to 50)
 * - Stores last query on window.lastSemanticQuery
 * - Shows spinner/robot icon on #aiSearchBtn
 * - Calls the provided `showSemanticResults(results)` on success
 *
 * @param {Object} args
 * @param {HTMLInputElement|null} args.aiSearchEl
 * @param {HTMLElement|null} args.aiSearchBtnEl
 * @param {string} args.lang
 * @param {(results: Array<Object>) => void} args.showSemanticResults
 * @returns {{ handleAISearch: () => void, attachAISearchListeners: () => void }}
 */
export function createAISemanticSearch({
    aiSearchEl,
    aiSearchBtnEl,
    lang,
    showSemanticResults,
}) {
    /**
     * Performs the semantic search request and shows the results modal.
     *
     * @returns {void}
     */
    function handleAISearch() {
        const query = aiSearchEl ? aiSearchEl.value.trim() : '';
        if (!query) return;

        // Show spinner on button
        if (aiSearchBtnEl) aiSearchBtnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Save the last query for the top_k selector
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
            body: JSON.stringify(payload),
        })
            .then((resp) => resp.json())
            .then((data) => {
                // Restore button icon
                if (aiSearchBtnEl) aiSearchBtnEl.innerHTML = '<i class="fas fa-robot"></i>';

                // Backend returns list in data.results or data
                const results = data.results || data;
                showSemanticResults(results);
            })
            .catch((error) => {
                console.error('Error performing semantic search:', error);
                if (aiSearchBtnEl) aiSearchBtnEl.innerHTML = '<i class="fas fa-robot"></i>';
                alert('Error performing AI search.');
            });
    }

    /**
     * Attaches click/keypress listeners to the AI search controls.
     *
     * @returns {void}
     */
    function attachAISearchListeners() {
        if (aiSearchBtnEl) aiSearchBtnEl.addEventListener('click', handleAISearch);
        if (aiSearchEl) {
            aiSearchEl.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') handleAISearch();
            });
        }
    }

    return {
        handleAISearch,
        attachAISearchListeners,
    };
}
