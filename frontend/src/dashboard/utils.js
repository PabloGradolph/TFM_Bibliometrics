/**
 * Dashboard utilities.
 *
 * Keep small, framework-agnostic helpers here so `dashboard.js` can stay focused
 * on orchestration.
 */

/**
 * Detect the UI language from the current URL path.
 *
 * The project uses language prefixes like `/es/...` or `/en/...`.
 * This helper scans path segments and falls back to Spanish when not found.
 *
 * @returns {'es'|'en'} The detected language.
 */
export function detectLangFromPath() {
    try {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const found = parts.find((p) => p === 'es' || p === 'en');
        return found || 'es';
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[LangDetection] Failed to detect language. Falling back to "es".', error);
        return 'es';
    }
}
