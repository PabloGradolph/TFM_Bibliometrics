/**
 * @fileoverview Map view controller for the dashboard.
 *
 * This module encapsulates the logic to initialize and switch between the world map
 * and the Spain map views, as well as toggling Spain administrative levels.
 *
 * It is designed to be a low-risk extraction from `dashboard.js`, so callers can
 * keep existing behavior by delegating to this controller.
 */

/**
 * @typedef {Object} MapViewsControllerDeps
 * @property {(containerId: string) => void} initWorldMap
 * @property {(containerId: string) => void} initSpainMap
 * @property {(visible: boolean) => void} setSpainMapVisible
 * @property {(level: string|null) => void} showSpainLevel
 * @property {() => void} updateVisualizations
 * @property {() => string} detectLangFromPath
 */

/**
 * Initializes the dashboard map view UI (world/spain) and Spain level toggles.
 *
 * Contract:
 * - Binds click handlers for `[data-map-view]` and `[data-spain-level]`.
 * - Manages `window.currentMapView` state.
 * - Updates `#collabCardTitleText` based on selected view and language.
 * - Calls `updateVisualizations()` after switching views to refresh counts.
 *
 * @param {MapViewsControllerDeps} deps Dependencies injected from `dashboard.js`.
 * @returns {{ init: () => void }} Controller API.
 */
export function createMapViewsController(deps) {
    const {
        initWorldMap,
        initSpainMap,
        setSpainMapVisible,
        showSpainLevel,
        updateVisualizations,
        detectLangFromPath,
    } = deps;

    let spainInitialized = false;

    /**
     * Ensures the Spain map is initialized only once.
     *
     * @returns {void}
     */
    function ensureSpainMap() {
        if (!spainInitialized) {
            initSpainMap('worldmap-container');
            spainInitialized = true;
        }
    }

    /**
     * Updates the collaborations card title depending on selected map view.
     *
     * @param {'world'|'spain'} view The selected map view.
     * @returns {void}
     */
    function updateCollabTitle(view) {
        const titleEl = document.getElementById('collabCardTitleText');
        if (!titleEl) return;

        const lang = typeof detectLangFromPath === 'function'
            ? detectLangFromPath()
            : (window.location.pathname.includes('/es/') ? 'es' : 'en');

        if (view === 'spain') {
            titleEl.textContent = lang === 'es' ? 'Colaboraciones Nacionales' : 'National Collaborations';
        } else {
            titleEl.textContent = lang === 'es' ? 'Colaboraciones Internacionales' : 'International Collaborations';
        }
    }

    /**
     * Initializes UI handlers for map view selection.
     *
     * @returns {void}
     */
    function initMapViewToggles() {
        document.querySelectorAll('[data-map-view]')?.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-map-view');
                if (!view) return;
                if (view === window.currentMapView) return;

                document.querySelectorAll('[data-map-view]')?.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const spainGroup = document.getElementById('spainLevelGroup');

                if (view === 'spain') {
                    spainGroup?.classList.remove('d-none');
                    ensureSpainMap();
                    setSpainMapVisible(true);
                    updateCollabTitle('spain');
                } else {
                    spainGroup?.classList.add('d-none');
                    setSpainMapVisible(false);
                    updateCollabTitle('world');
                }

                window.currentMapView = view;
                updateVisualizations();
            });
        });
    }

    /**
     * Initializes UI handlers for Spain level selection (CCAA/Provinces).
     *
     * @returns {void}
     */
    function initSpainLevelToggles() {
        document.querySelectorAll('[data-spain-level]')?.forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-spain-level]')?.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const level = btn.getAttribute('data-spain-level');
                showSpainLevel(level);
            });
        });
    }

    /**
     * Initializes maps and wires up DOM handlers.
     *
     * @returns {void}
     */
    function init() {
        // Default to world
        window.currentMapView = 'world';
        initWorldMap('worldmap-container');

        initMapViewToggles();
        initSpainLevelToggles();

        // Keep title aligned with default view.
        updateCollabTitle('world');
    }

    return { init };
}
