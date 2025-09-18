/**
 * WorldMap module using Leaflet.js
 * Paints countries in orange according to a list of country codes.
 * Responsive and fills the card container.
 *
 * Usage: import and call initWorldMap('worldmap-container', ["ES", "FR", ...])
 */

import L from 'leaflet';

// Inject custom CSS once (remove focus outline / black square on click)
if (typeof document !== 'undefined' && !document.getElementById('worldmap-focus-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'worldmap-focus-style';
    styleEl.textContent = `
    .leaflet-container .leaflet-interactive:focus { outline: none; }
    .leaflet-container .leaflet-interactive::-moz-focus-inner { border: 0; }
    .leaflet-control { z-index: 600 !important; }
    .leaflet-control-zoom { box-shadow: 0 1px 3px rgba(0,0,0,0.3); border-radius: 4px; }
    .leaflet-control-zoom a { background:#ffffff; width:30px; height:30px; line-height:30px; font-weight:600; font-size:16px; }
    .leaflet-control-zoom a:hover { background:#f2f2f2; }
    .worldmap-legend { font: 12px/1.2 system-ui, sans-serif; }
    .worldmap-legend div { line-height: 1.1; }
    `;
    document.head.appendChild(styleEl);
}

// Shared palette & thresholds for legend and painting
const WORLD_MAP_THRESHOLDS = [0.05,0.15,0.30,0.45,0.60,0.75,0.90,1.0];
const WORLD_MAP_COLORS = ['#fff5e6','#ffe6cc','#ffcf99','#ffb566','#ff9c33','#ff8800','#f06d00','#d45500'];

function buildLegendHTML(maxCount) {
    if (!maxCount || maxCount < 1) {
        return '<div style="font-size:11px;">No data</div>';
    }
    const isES = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1] === 'es');
    let html = '<div class="worldmap-legend"><div style="font-weight:600;margin-bottom:4px;">' + (isES ? 'Publicaciones' : 'Publications') + '</div>';
    WORLD_MAP_THRESHOLDS.forEach((t,i)=>{
        const prev = i===0 ? 0 : WORLD_MAP_THRESHOLDS[i-1];
        const minCount = Math.max(1, Math.round(Math.pow(maxCount, prev||0.001)));
        const maxBucket = Math.round(Math.pow(maxCount, t));
        const label = i === WORLD_MAP_THRESHOLDS.length - 1 ? `≥ ${minCount}` : `${minCount}–${maxBucket}`;
        html += `<div style="display:flex;align-items:center;margin:2px 0;">`+
            `<span style=\"display:inline-block;width:18px;height:14px;background:${WORLD_MAP_COLORS[i]};border:1px solid #ccc;margin-right:6px;\"></span>`+
            `<span style=\"font-size:11px;white-space:nowrap;\">${label}</span>`+
            `</div>`;
    });
    html += '</div>';
    return html;
}

function updateLegend() {
    if (worldMapRegistry.legendControl && worldMapRegistry.legendControl.getContainer) {
        const c = worldMapRegistry.legendControl.getContainer();
        if (c) c.innerHTML = buildLegendHTML(worldMapRegistry.maxCount);
    }
}

// You need to provide a GeoJSON file with country polygons
// Example: import countriesGeoJson from './countries.geo.json';
// For demo, you can use a public GeoJSON URL

// Internal registry to allow updates from dashboard
const worldMapRegistry = {
    map: null,
    layer: null,
    countsByIsoA2: {},
    maxCount: 0,
    containerId: null,
    loadingEl: null,
    debug: false, // disabled by default
    debugLayer: null,
    legendControl: null,
};

// Mapping manual overrides or special cases (e.g., XK for Kosovo not standard in some datasets)
const ISO_OVERRIDES = {
    XK: 'XK', // keep as is if appears
};

// Names we choose to ignore (non-sovereign, disputed, facilities) to avoid noise
const IGNORE_FEATURE_NAMES = new Set([
    'Siachen Glacier',
    'Baykonur Cosmodrome',
    'Dhekelia Sovereign Base Area',
    'Akrotiri Sovereign Base Area',
    'Brazilian Island',
    'Southern Patagonian Ice Field',
    'Bir Tawil',
    'Indian Ocean Territories',
    'Coral Sea Islands',
    'Spratly Islands',
    'Clipperton Island',
    'Ashmore and Cartier Islands',
    'Serranilla Bank',
    'Scarborough Reef',
]);

// Name overrides mapping to ISO2 (for disputed / special territories)
const NAME_TO_ISO2 = {
    'Kosovo': 'XK',
    'Northern Cyprus': 'CY', // or leave uncolored if preferred
    'Somaliland': 'SO',      // attaches to Somalia for aggregation
    'France': 'FR',          // fallback if A2 not present
    'Norway': 'NO',
};

// Cache to avoid excessive console spam
let propertyKeysLogged = false;
let missingIsoWarnings = 0;
const MAX_MISSING_WARNINGS = 10;
const missingSamples = [];

/**
 * Attempt to resolve a 2-letter ISO code for a feature, trying multiple properties.
 * @param {object} feature - GeoJSON feature
 * @returns {string} Uppercased ISO A2 code or empty string if not resolvable.
 */
function resolveISO2(feature) {
    if (!feature || !feature.properties) return '';
    const p = feature.properties;
    // Normalize property keys (some datasets might have different hyphen unicode chars)
    const normEntries = Object.entries(p).map(([k, v]) => [k.replace(/[‐‑‒–—―]/g, '-'), v]);
    const propsNorm = Object.fromEntries(normEntries);
    // Direct ISO3166 A2
    if (typeof propsNorm['ISO3166-1-Alpha-2'] === 'string') {
        let direct = propsNorm['ISO3166-1-Alpha-2'].trim().toUpperCase();
        if (direct === 'UK') direct = 'GB';
        if (/^[A-Z]{2}$/.test(direct)) return ISO_OVERRIDES[direct] || direct;
    }
    // A3 mapping
    if (typeof propsNorm['ISO3166-1-Alpha-3'] === 'string') {
        const a3 = propsNorm['ISO3166-1-Alpha-3'].trim().toUpperCase();
        const a3Map = {
            ESP: 'ES', USA: 'US', ITA: 'IT', DEU: 'DE', CHE: 'CH', GBR: 'GB', NLD: 'NL', FRA: 'FR', LVA: 'LV', COL: 'CO', PRT: 'PT', CAN: 'CA', NOR: 'NO', IRL: 'IE', BEL: 'BE', CHN: 'CN', SWE: 'SE', JPN: 'JP', SVK: 'SK', KOR: 'KR', NZL: 'NZ', LUX: 'LU', GRC: 'GR', CZE: 'CZ', VEN: 'VE', BRA: 'BR', MEX: 'MX', ARG: 'AR', BOL: 'BO', AUT: 'AT', HUN: 'HU', CHL: 'CL', EST: 'EE', POL: 'PL', ISR: 'IL', TZA: 'TZ', TWN: 'TW', SRB: 'RS', SLV: 'SV'
        };
        if (a3Map[a3]) return a3Map[a3];
    }
    // Common property keys across datasets
    const rawCandidates = [p.ISO_A2, p.iso_a2, p.ISO2, p.ISO, p.ADM0_A3, p.ISO_A3, p.iso_a3];
    for (let raw of rawCandidates) {
        if (!raw || typeof raw !== 'string') continue;
        let code = raw.trim().toUpperCase();
        if (code === 'UK') code = 'GB'; // normalize UK -> GB
        if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
            return ISO_OVERRIDES[code] || code;
        }
        // If A3 code matches known conversions
        if (code.length === 3 && /^[A-Z]{3}$/.test(code)) {
            // Minimal A3->A2 mapping for those we expect (extendable)
            const a3Map = {
                ESP: 'ES', USA: 'US', ITA: 'IT', DEU: 'DE', CHE: 'CH', GBR: 'GB', NLD: 'NL', FRA: 'FR', LVA: 'LV', COL: 'CO', PRT: 'PT', CAN: 'CA', NOR: 'NO', IRL: 'IE', BEL: 'BE', CHN: 'CN', SWE: 'SE', JPN: 'JP', SVK: 'SK', KOR: 'KR', NZL: 'NZ', LUX: 'LU', GRC: 'GR', CZE: 'CZ', VEN: 'VE', BRA: 'BR', MEX: 'MX', ARG: 'AR', BOL: 'BO', AUT: 'AT', HUN: 'HU', CHL: 'CL', EST: 'EE', POL: 'PL', ISR: 'IL'
            };
            if (a3Map[code]) return a3Map[code];
        }
    }
    // Broad scan: look for any 2-letter uppercase value in properties
    for (const [k, v] of Object.entries(p)) {
        if (typeof v === 'string') {
            const val = v.trim().toUpperCase();
            if (/^[A-Z]{2}$/.test(val)) {
                if (val === 'UK') return 'GB';
                return ISO_OVERRIDES[val] || val;
            }
            // Detect embedded codes like "Spain (ES)" -> capture in parens
            const match = val.match(/\b([A-Z]{2})\b/);
            if (match) {
                const cand = match[1];
                if (cand === 'UK') return 'GB';
                return ISO_OVERRIDES[cand] || cand;
            }
        }
    }
    // Name-based overrides
    const name = typeof p.name === 'string' ? p.name.trim() : (typeof p.NAME === 'string' ? p.NAME.trim() : '');
    if (name && NAME_TO_ISO2[name]) return NAME_TO_ISO2[name];
    return '';
}

/**
 * Resolve a human-readable country name from feature properties.
 */
function resolveName(feature) {
    if (!feature || !feature.properties) return 'Unknown';
    const p = feature.properties;
    const nameCandidates = [
        p.ADMIN, p.admin,
        p.ADMIN_NAME, p.admin_name,
        p.SOVEREIGNT, p.sovereignt,
        p.NAME, p.name,
        p.COUNTRY, p.country,
        p.NAME_LONG, p.name_long,
        p.BRK_NAME, p.brk_name,
    ].filter(v => typeof v === 'string' && v.trim().length);
    if (nameCandidates.length) return nameCandidates[0];
    return 'Unknown';
}

/**
 * Initialize the world map in a container.
 * @param {string} containerId - DOM element id to mount the map.
 * @param {string[]} activeCountries - Optional list of ISO A2 country codes to highlight initially.
 */
export function initWorldMap(containerId, activeCountries = []) {
    worldMapRegistry.containerId = containerId;
    // Reset diagnostic flags for a fresh init
    propertyKeysLogged = false;
    missingIsoWarnings = 0;
    // Ensure container has white background and relative positioning
    const container = document.getElementById(containerId);
    if (container) {
        container.style.background = '#ffffff';
        // Ensure relative positioning for layering
        container.style.position = 'relative';
        // Provide a reasonable default height if none is set via CSS
        if (!container.style.height || container.style.height === '0px') {
            container.style.height = '360px';
        }
        // Baseline z-index so that other explicitly positioned elements (e.g. headers, overlays) can sit above if needed
        container.style.zIndex = '0';
        // Create loading overlay
        const overlay = document.createElement('div');
        overlay.className = 'worldmap-loading-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.8);
            z-index: 500; /* sits above map panes but below potential external overlays you add (use z-index>600) */
        `;
        overlay.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>`;
        container.appendChild(overlay);
        worldMapRegistry.loadingEl = overlay;
    }
    const map = L.map(containerId, {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 8,
        worldCopyJump: true,
        attributionControl: false,
        zoomControl: false, // desactivamos inicial para añadirlo en posición custom
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        scrollWheelZoom: false,
        // Limitar la vista para no mostrar latitudes antárticas
        maxBounds: [
            [-60, -180], // suroeste (lat, lng)
            [85, 180]    // noreste
        ],
        maxBoundsViscosity: 1.0,
    });

    // Añadir controles de zoom en la esquina superior derecha
    L.control.zoom({ position: 'topright' }).addTo(map);
    // Añadir leyenda
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar');
        div.style.background = 'rgba(255,255,255,0.92)';
        div.style.padding = '6px 8px';
        div.style.borderRadius = '4px';
        div.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
        div.innerHTML = buildLegendHTML(worldMapRegistry.maxCount);
        return div;
    };
    legend.addTo(map);
    worldMapRegistry.legendControl = legend;

    // Opcional: atajo de teclado +/- (sin interferir con inputs)
    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
            if (e.key === '+') { map.zoomIn(); }
            if (e.key === '-') { map.zoomOut(); }
        });
    }

    // Zoom con Ctrl + rueda
    if (container) {
        container.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            if (e.deltaY < 0) map.zoomIn();
            else if (e.deltaY > 0) map.zoomOut();
        }, { passive: false });
    }

    // No tile layer: pure vector world on transparent bg so the card background is visible

    // Load countries GeoJSON (replace with your own if needed)
    // Helper para obtener extremos de latitud de un feature
    function getLatExtents(geometry) {
        let minLat = 90;
        let maxLat = -90;
        const pushCoord = (coord) => {
            const lat = coord[1];
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        };
        const walk = (geom) => {
            if (!geom) return;
            const { type, coordinates } = geom;
            if (type === 'Polygon') {
                coordinates.forEach(ring => ring.forEach(pushCoord));
            } else if (type === 'MultiPolygon') {
                coordinates.forEach(poly => poly.forEach(ring => ring.forEach(pushCoord)));
            } else if (type === 'GeometryCollection') {
                geom.geometries.forEach(walk);
            }
        };
        walk(geometry);
        return { minLat, maxLat };
    }

    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
        .then(res => res.json())
        .then(geojson => {
            // eslint-disable-next-line no-console
            console.log('[WorldMap] GeoJSON loaded. Features:', Array.isArray(geojson.features) ? geojson.features.length : 'N/A');
            // Filtrar Antártida (por nombre/ISO) y cualquier geometría cuya latitud máxima esté por debajo de -60
            const filteredFeatures = geojson.features.filter(f => {
                const props = f.properties || {};
                const name = String(props.ADMIN || '');
                const iso2 = String(props.ISO_A2 || '');
                const iso3 = String(props.ISO_A3 || '');
                const { maxLat } = getLatExtents(f.geometry);
                if (/antarctica/i.test(name)) return false;
                if (iso2.toUpperCase() === 'AQ' || iso3.toUpperCase() === 'ATA') return false;
                if (maxLat < -60) return false; // todo el feature está bajo -60º
                return true;
            });
            const filtered = { ...geojson, features: filteredFeatures };
            const layer = L.geoJSON(filtered, {
                style: feature => {
                    const iso2 = resolveISO2(feature);
                    const count = worldMapRegistry.countsByIsoA2[iso2] || 0;
                    const maxCount = worldMapRegistry.maxCount || 1;
                    const isActive = count > 0 || activeCountries.includes(iso2);
                    // High-contrast choropleth: log-normalized value
                    let normalized = 0;
                    if (isActive) {
                        normalized = maxCount > 1 ? (Math.log(count || 1) / Math.log(maxCount)) : 1;
                        if (!isFinite(normalized) || normalized < 0) normalized = 0;
                        if (normalized > 1) normalized = 1;
                    }
                    // Tiered color ramp (light -> dark orange)
                    const pickFill = (t) => {
                        if (t <= 0.05) return '#fff5e6';
                        if (t <= 0.15) return '#ffe6cc';
                        if (t <= 0.30) return '#ffcf99';
                        if (t <= 0.45) return '#ffb566';
                        if (t <= 0.60) return '#ff9c33';
                        if (t <= 0.75) return '#ff8800';
                        if (t <= 0.90) return '#f06d00';
                        return '#d45500';
                    };
                    const fillColor = isActive ? pickFill(normalized) : '#ffffff';
                    const fillOpacity = isActive ? (0.1 + 0.85 * normalized) : 0.0; // from 0.1 to 0.95
                    return {
                        color: isActive ? '#b34700' : '#bbbbbb',
                        weight: isActive ? 1.0 : 0.5,
                        fillColor,
                        fillOpacity,
                    };
                },
                onEachFeature: (feature, lyr) => {
                    const iso2 = resolveISO2(feature);
                    const name = resolveName(feature);
                    const applyTooltipContent = (content) => {
                        if (typeof lyr.setTooltipContent === 'function') {
                            lyr.setTooltipContent(content);
                        } else if (typeof lyr.getTooltip === 'function' && lyr.getTooltip()) {
                            lyr.getTooltip().setContent(content);
                        }
                    };
                    const getTooltipContent = () => {
                        const count = worldMapRegistry.countsByIsoA2[iso2] || 0;
                        if (count > 0) {
                            // Determine language from pathname
                            const currentLang = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1]) || 'en';
                            const pubsLabel = currentLang === 'es' ? 'publicaciones' : 'publications';
                            return `${name}: ${count} ${pubsLabel}`;
                        }
                        return `${name}`;
                    };
                    // Bind initial tooltip content (must be a string, not a function)
                    lyr.bindTooltip(getTooltipContent(), { sticky: true });
                    // Optional simple highlight on click (no popup)
                    lyr.on('click', () => {
                        try { lyr.bringToFront(); } catch (e) { /* noop */ }
                    });
                    // Update tooltip when style changes (on setStyle we'll also update tooltip content)
                    lyr.on('mouseover', () => {
                        applyTooltipContent(getTooltipContent());
                    });
                    if (!propertyKeysLogged) {
                        // eslint-disable-next-line no-console
                        console.log('[WorldMap][Info] Example feature property keys:', Object.keys(feature.properties).slice(0, 25));
                        propertyKeysLogged = true;
                    }
                    if (!iso2 && missingIsoWarnings < MAX_MISSING_WARNINGS && !IGNORE_FEATURE_NAMES.has(name)) {
                        missingIsoWarnings += 1;
                        // eslint-disable-next-line no-console
                        console.warn('[WorldMap][Warn] Feature without resolvable ISO2 (sample):', { name, sampleProps: Object.fromEntries(Object.entries(feature.properties).slice(0, 10)) });
                        if (missingIsoWarnings === MAX_MISSING_WARNINGS) {
                            // eslint-disable-next-line no-console
                            console.warn('[WorldMap][Warn] Reached max missing ISO warnings; further messages suppressed.');
                        }
                    }
                }
            }).addTo(map);

            try {
                map.fitBounds(layer.getBounds(), { padding: [10, 10] });
            } catch (e) {
                // Safe guard in case bounds fail
                map.setView([20, 0], 2);
            }

            // Save in registry for later updates
            worldMapRegistry.map = map;
            worldMapRegistry.layer = layer;
            // Create debug layer group
            worldMapRegistry.debugLayer = L.layerGroup().addTo(map);
            // If counts were cached before layer existed, restyle now
            if (worldMapRegistry.countsByIsoA2 && Object.keys(worldMapRegistry.countsByIsoA2).length > 0) {
                try {
                    setWorldMapActiveCountries(worldMapRegistry.countsByIsoA2);
                } catch (e) {
                    // noop
                }
            }
            // Hide overlay once layer is ready; it may be shown again until counts arrive
            if (worldMapRegistry.loadingEl) {
                worldMapRegistry.loadingEl.style.display = 'none';
            }
        })
        .catch(err => {
            // eslint-disable-next-line no-console
            console.error('[WorldMap] Error loading GeoJSON:', err);
            if (worldMapRegistry.loadingEl) worldMapRegistry.loadingEl.style.display = 'none';
        });

    // Make map responsive
    window.addEventListener('resize', () => {
        map.invalidateSize();
    });
}

/**
 * Update active countries by providing counts keyed by ISO A2 code.
 * This will recolor the layer and update tooltips.
 * @param {Record<string, number>} countsByIsoA2 - e.g., { ES: 12, FR: 3 }
 */
export function setWorldMapActiveCountries(countsByIsoA2) {
    // Show overlay while applying (in case of large updates)
    if (worldMapRegistry.loadingEl) worldMapRegistry.loadingEl.style.display = 'flex';
    // Normalize and cache counts
    const normalizeAndStore = (counts) => {
        worldMapRegistry.countsByIsoA2 = {};
        worldMapRegistry.maxCount = 0;
        Object.entries(counts || {}).forEach(([k, v]) => {
            const iso = String(k || '').toUpperCase();
            const num = typeof v === 'number' && isFinite(v) ? v : 0;
            if (iso && num > 0) {
                worldMapRegistry.countsByIsoA2[iso] = num;
                if (num > worldMapRegistry.maxCount) worldMapRegistry.maxCount = num;
            }
        });
    };

    if (!worldMapRegistry.layer) {
        // Layer not ready yet; cache counts for when it is
        normalizeAndStore(countsByIsoA2 || {});
        // keep overlay visible until layer arrives and styles applied
        return;
    }

    normalizeAndStore(countsByIsoA2 || {});
    updateLegend();

    // Re-style each feature and add debug markers
    const matchedISOs = new Set();
    let updatedCount = 0;
    if (worldMapRegistry.debugLayer) {
        worldMapRegistry.debugLayer.clearLayers();
    }
    worldMapRegistry.layer.eachLayer(lyr => {
        const f = lyr.feature || {};
        const props = f.properties || {};
        const iso2 = resolveISO2(f);
        const count = worldMapRegistry.countsByIsoA2[iso2] || 0;
        const isActive = count > 0;
        const maxCount = worldMapRegistry.maxCount || 1;
        let normalized = 0;
        if (isActive) {
            normalized = maxCount > 1 ? (Math.log(count || 1) / Math.log(maxCount)) : 1;
            if (!isFinite(normalized) || normalized < 0) normalized = 0;
            if (normalized > 1) normalized = 1;
        }
        const pickFill = (t) => {
            if (t <= 0.05) return '#fff5e6';
            if (t <= 0.15) return '#ffe6cc';
            if (t <= 0.30) return '#ffcf99';
            if (t <= 0.45) return '#ffb566';
            if (t <= 0.60) return '#ff9c33';
            if (t <= 0.75) return '#ff8800';
            if (t <= 0.90) return '#f06d00';
            return '#d45500';
        };
        const fillColor = isActive ? pickFill(normalized) : '#ffffff';
        const fillOpacity = isActive ? (0.1 + 0.85 * normalized) : 0.0;
        lyr.setStyle({
            color: isActive ? '#b34700' : '#bbbbbb',
            weight: isActive ? 1.0 : 0.5,
            fillColor,
            fillOpacity,
        });
        if (isActive) {
            updatedCount += 1;
            matchedISOs.add(iso2);
            // Add debug marker at bounds center with label ISO:count (only in debug mode)
            if (worldMapRegistry.debug) {
                try {
                    const center = lyr.getBounds().getCenter();
                    if (worldMapRegistry.debugLayer) {
                        const marker = L.circleMarker(center, {
                            radius: 3,
                            color: '#ff8c00',
                            fillColor: '#ff9800',
                            fillOpacity: 0.9,
                            weight: 1
                        });
                        marker.bindTooltip(`${iso2}: ${count}`, { permanent: false, direction: 'top', offset: [0, -4] });
                        worldMapRegistry.debugLayer.addLayer(marker);
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
        // Refresh tooltip content
        if (typeof lyr.setTooltipContent === 'function' || (typeof lyr.getTooltip === 'function' && lyr.getTooltip())) {
            const name = resolveName(f);
            const currentLang = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1]) || 'en';
            const pubsLabel = currentLang === 'es' ? 'publicaciones' : 'publications';
            const content = count > 0 ? `${name}: ${count} ${pubsLabel}` : `${name}`;
            if (typeof lyr.setTooltipContent === 'function') {
                lyr.setTooltipContent(content);
            } else {
                lyr.getTooltip().setContent(content);
            }
        }
    });
    // Log matches vs provided counts
    if (worldMapRegistry.debug) {
        try {
            const providedISOs = Object.keys(worldMapRegistry.countsByIsoA2 || {});
            const missing = providedISOs.filter(k => !matchedISOs.has(k));
            // eslint-disable-next-line no-console
            console.log(`[WorldMap][Debug] Updated features: ${updatedCount}, Missing matches for ISOs:`, missing);
            if (missingSamples.length > 0) {
                // eslint-disable-next-line no-console
                console.warn('[WorldMap][Warn] Unmatched sovereign/other features (truncated):', missingSamples);
            }
        } catch (e) { /* noop */ }
    }
    // Hide overlay after update
    if (worldMapRegistry.loadingEl) worldMapRegistry.loadingEl.style.display = 'none';
}

/**
 * Explicitly show or hide the world map loading overlay.
 * @param {boolean} visible - true to show, false to hide
 */
export function setWorldMapLoading(visible) {
    if (worldMapRegistry.loadingEl) {
        worldMapRegistry.loadingEl.style.display = visible ? 'flex' : 'none';
    }
}

/**
 * Enable/disable visual debug overlays (markers and console logs).
 * @param {boolean} enabled - true to enable debug, false to disable
 */
export function setWorldMapDebug(enabled) {
    worldMapRegistry.debug = !!enabled;
    if (!worldMapRegistry.debug && worldMapRegistry.debugLayer) {
        worldMapRegistry.debugLayer.clearLayers();
    }
}
