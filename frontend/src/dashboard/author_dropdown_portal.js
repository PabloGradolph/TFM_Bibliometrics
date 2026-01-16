/**
 * Utilities to portal and position the Filters author suggestions dropdown.
 */

/**
 * Move the suggestions dropdown to <body> so it is not affected by local stacking contexts.
 *
 * @param {HTMLElement|null} suggestionsEl
 * @returns {void}
 */
export function ensureAuthorSuggestionsPortal(suggestionsEl) {
    if (!suggestionsEl) return;
    if (suggestionsEl.dataset.portalized === 'true') return;

    // If this element previously relied on Bootstrap width helpers inside a
    // relatively positioned parent, remove those helpers because once we portal it
    // to <body> they can unintentionally make the dropdown span the whole viewport.
    suggestionsEl.classList.remove('w-150');

    document.body.appendChild(suggestionsEl);
    suggestionsEl.dataset.portalized = 'true';

    // Base styles for portalized dropdown
    suggestionsEl.style.position = 'fixed';
    suggestionsEl.style.zIndex = '999999';
    suggestionsEl.style.boxSizing = 'border-box';
    suggestionsEl.style.maxWidth = '600px';
    suggestionsEl.style.right = 'auto';
    suggestionsEl.style.bottom = 'auto';
    suggestionsEl.style.maxHeight = '160px';
    suggestionsEl.style.overflowY = 'auto';
    suggestionsEl.style.overflowX = 'hidden';
    suggestionsEl.style.display = 'none';

    const list = suggestionsEl.querySelector('.list-group');
    if (list) {
        list.style.width = '100%';
        list.style.maxWidth = '100%';
        list.style.boxSizing = 'border-box';
    }

    // Ensure list style remains consistent
    if (!suggestionsEl.classList.contains('dropdown-portal')) {
        suggestionsEl.classList.add('dropdown-portal');
    }
}

/**
 * Position the dropdown under the input using fixed positioning.
 *
 * We use fixed positioning + a body portal to escape any stacking context created
 * by charts/cards. We also compensate for VisualViewport offsets on mobile/zoom.
 *
 * @param {object} params
 * @param {HTMLInputElement|HTMLElement|null} params.searchEl
 * @param {HTMLElement|null} params.suggestionsEl
 * @returns {void}
 */
export function positionAuthorDropdown({ searchEl, suggestionsEl }) {
    if (!searchEl || !suggestionsEl) return;
    if (suggestionsEl.style.display !== 'block') return;

    ensureAuthorSuggestionsPortal(suggestionsEl);

    try {
        const rect = searchEl.getBoundingClientRect();
        const vv = window.visualViewport;
        const offsetLeft = vv ? vv.offsetLeft : 0;
        const offsetTop = vv ? vv.offsetTop : 0;

        // Limit height so it doesn't cover the UI; keep it scrollable.
        // The goal is to keep it compact (similar to a select height) while still usable.
        const viewportHeight = vv ? vv.height : window.innerHeight;
        const availableBelow = Math.max(0, viewportHeight - rect.bottom - 12);
        const desiredMaxHeight = 160;
        const computedMaxHeight = Math.min(desiredMaxHeight, availableBelow);

        suggestionsEl.style.position = 'fixed';
        suggestionsEl.style.left = `${Math.round(rect.left + offsetLeft)}px`;
        suggestionsEl.style.top = `${Math.round(rect.bottom + offsetTop)}px`;
        const width = Math.round(rect.width);

        // Force width to match input and ensure we don't overflow the viewport.
        // Subtract a small margin to avoid touching the edge.
        const viewportWidth = vv ? vv.width : window.innerWidth;
        const maxAllowedWidth = Math.max(
            200,
            Math.round(viewportWidth - (rect.left + offsetLeft) - 12)
        );
        suggestionsEl.style.width = `${Math.min(width, maxAllowedWidth)}px`;
        suggestionsEl.style.maxWidth = `${Math.min(width, maxAllowedWidth)}px`;
        suggestionsEl.style.maxHeight = `${Math.max(120, Math.round(computedMaxHeight))}px`;
    } catch (e) {
        // Last-resort: place near the input in the normal flow.
        suggestionsEl.style.position = 'absolute';
        suggestionsEl.style.top = '100%';
        suggestionsEl.style.left = '0';
        suggestionsEl.style.width = '100%';
        suggestionsEl.style.maxHeight = '160px';
        suggestionsEl.style.overflowY = 'auto';
    }
}
