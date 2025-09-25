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
    .worldmap-top10-table { font: 12px/1.2 system-ui, sans-serif; }
    .worldmap-top10-table table { border-collapse: collapse; width:100%; }
    .worldmap-top10-table th, .worldmap-top10-table td { padding:2px 6px; font-size:11px; text-align:left; white-space:nowrap; }
    .worldmap-top10-table th { font-weight:600; border-bottom:1px solid #ddd; }
    .worldmap-top10-table tbody tr:nth-child(even){ background:#f8f8f8; }
    .worldmap-top10-table caption { text-align:left; font-weight:600; margin-bottom:4px; font-size:12px; }
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
    top10El: null,
    top10Control: null,
};

// Country name dictionaries for Top 10 table display
const ISO2_NAME_EN = {
    AF:'Afghanistan', AL:'Albania', DZ:'Algeria', AO:'Angola', AR:'Argentina', AM:'Armenia', AU:'Australia', AT:'Austria', AZ:'Azerbaijan',
    BD:'Bangladesh', BY:'Belarus', BE:'Belgium', BZ:'Belize', BJ:'Benin', BO:'Bolivia', BA:'Bosnia and Herzegovina', BW:'Botswana', BR:'Brazil', BG:'Bulgaria',
    KH:'Cambodia', CM:'Cameroon', CA:'Canada', CL:'Chile', CN:'China', CO:'Colombia', CR:'Costa Rica', HR:'Croatia', CU:'Cuba', CY:'Cyprus', CZ:'Czech Republic',
    DK:'Denmark', DO:'Dominican Republic', EC:'Ecuador', EG:'Egypt', SV:'El Salvador', EE:'Estonia', ET:'Ethiopia',
    FI:'Finland', FR:'France', GA:'Gabon', GM:'Gambia', GE:'Georgia', DE:'Germany', GH:'Ghana', GR:'Greece', GT:'Guatemala', HN:'Honduras', HU:'Hungary',
    IS:'Iceland', IN:'India', ID:'Indonesia', IR:'Iran', IE:'Ireland', IL:'Israel', IT:'Italy', CI:'Ivory Coast',
    JM:'Jamaica', JP:'Japan', JO:'Jordan', KZ:'Kazakhstan', KE:'Kenya', KR:'South Korea', KW:'Kuwait', KG:'Kyrgyzstan',
    LV:'Latvia', LB:'Lebanon', LR:'Liberia', LY:'Libya', LT:'Lithuania', LU:'Luxembourg',
    MG:'Madagascar', MW:'Malawi', MY:'Malaysia', ML:'Mali', MT:'Malta', MX:'Mexico', MD:'Moldova', MN:'Mongolia', ME:'Montenegro', MA:'Morocco', MZ:'Mozambique',
    MM:'Myanmar', NA:'Namibia', NP:'Nepal', NL:'Netherlands', NZ:'New Zealand', NI:'Nicaragua', NE:'Niger', NG:'Nigeria', MK:'North Macedonia', NO:'Norway',
    OM:'Oman', PK:'Pakistan', PA:'Panama', PY:'Paraguay', PE:'Peru', PH:'Philippines', PL:'Poland', PT:'Portugal', PR:'Puerto Rico',
    QA:'Qatar', RO:'Romania', RU:'Russia', RW:'Rwanda', SA:'Saudi Arabia', SN:'Senegal', RS:'Serbia', SL:'Sierra Leone', SG:'Singapore', SK:'Slovakia', SI:'Slovenia', ZA:'South Africa', ES:'Spain', SE:'Sweden', CH:'Switzerland', SY:'Syria',
    TW:'Taiwan', TJ:'Tajikistan', TZ:'Tanzania', TH:'Thailand', TG:'Togo', TT:'Trinidad and Tobago', TN:'Tunisia', TR:'Turkey',
    UG:'Uganda', UA:'Ukraine', AE:'United Arab Emirates', GB:'United Kingdom', US:'United States', UY:'Uruguay', UZ:'Uzbekistan',
    VE:'Venezuela', VN:'Vietnam', ZM:'Zambia', ZW:'Zimbabwe'
};
const ISO2_NAME_ES = {
    US:'Estados Unidos', GB:'Reino Unido', DE:'Alemania', IT:'Italia', NL:'Países Bajos', FR:'Francia', SE:'Suecia', CO:'Colombia', CH:'Suiza', ES:'España'
};
function isoToDisplayName(iso, lang) {
    const up = String(iso||'').toUpperCase();
    if (lang === 'es') return ISO2_NAME_ES[up] || ISO2_NAME_EN[up] || up;
    return ISO2_NAME_EN[up] || up;
}

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
        // Fuerza a Leaflet a renderizar capas vectoriales en Canvas en lugar de SVG.
        // Necesario para que leaflet-image pueda rasterizar correctamente las geometrías.
        preferCanvas: true,
        // Limitar la vista para no mostrar latitudes antárticas
        maxBounds: [
            [-60, -180], // suroeste (lat, lng)
            [85, 180]    // noreste
        ],
        maxBoundsViscosity: 1.0,
    });

    // Añadir controles de zoom en la esquina superior derecha
    L.control.zoom({ position: 'topright' }).addTo(map);
    // Añadir leyenda de escala de colores (ahora abajo-derecha tras swap solicitado)
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

    // Añadir control Top10 (tabla) en abajo-izquierda tras swap
    const top10 = L.control({ position: 'bottomleft' });
    top10.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar worldmap-top10-table');
        div.style.background = 'rgba(255,255,255,0.95)';
        div.style.padding = '6px 8px';
        div.style.borderRadius = '4px';
        div.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
    div.style.maxWidth = '280px';
    // Eliminamos el límite de altura para que no aparezca scroll y se vean los 10 países
    div.style.maxHeight = 'none';
    div.style.overflow = 'visible';
        const currentLang = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1]) || 'en';
        const title = currentLang === 'es' ? 'Top 10 países' : 'Top 10 countries';
        div.innerHTML = `<div style="font-weight:600;font-size:12px;margin-bottom:4px;">${title}</div><div style="font-size:11px;color:#666;">—</div>`;
        worldMapRegistry.top10El = div; // reutilizamos la referencia
        return div;
    };
    top10.addTo(map);
    worldMapRegistry.top10Control = top10;

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

// --- Helper: load leaflet-image UMD from CDN if not present ---
function ensureLeafletImage() {
  return new Promise((resolve, reject) => {
    if (window.leafletImage) return resolve(window.leafletImage);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet-image@0.0.4/leaflet-image.js';
    s.async = true;
    s.onload = () => resolve(window.leafletImage);
    s.onerror = () => reject(new Error('Failed to load leaflet-image'));
    document.head.appendChild(s);
  });
}

if (typeof document !== 'undefined') {
  const exportBtn = document.getElementById('exportCollabMap');
  if (exportBtn && !exportBtn.dataset.boundExport) {
    exportBtn.dataset.boundExport = '1';
    exportBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      try {
        const cardBody = exportBtn.closest('.card-body');
        if (!cardBody) return;
        const mapContainer = cardBody.querySelector('#worldmap-container');
        if (!mapContainer) return;

        // 1) Render Leaflet map to bitmap (no controls)
        await ensureLeafletImage();
        const mapBitmapCanvas = await new Promise((resolve, reject) => {
          window.leafletImage(map, (err, canvas) => {
            if (err || !canvas) return reject(err || new Error('leaflet-image failed'));
            resolve(canvas);
          });
        });

                // Comprobamos si el canvas generado está en blanco (problema típico si no se usa preferCanvas)
                const isBlank = (() => {
                    try {
                        const ctx = mapBitmapCanvas.getContext('2d');
                        const sampleW = Math.min(20, mapBitmapCanvas.width);
                        const sampleH = Math.min(20, mapBitmapCanvas.height);
                        const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
                        for (let i = 3; i < data.length; i += 4) { // alpha channel
                            if (data[i] !== 0) return false; // hay píxel pintado
                        }
                        return true;
                    } catch (e) { return false; }
                })();

                if (isBlank) {
                    console.warn('[WorldMap][Export] leaflet-image devolvió un canvas vacío. Se fuerza fallback a html2canvas directo.');
                }

        // Match current displayed size
        const mapRect = mapContainer.getBoundingClientRect();
        const cssW = Math.max(1, Math.round(mapRect.width));
        const cssH = Math.max(1, Math.round(mapRect.height));

        // Scale bitmap to displayed size
        const scaledMap = document.createElement('canvas');
        scaledMap.width = cssW;
        scaledMap.height = cssH;
        scaledMap.getContext('2d').drawImage(
          mapBitmapCanvas, 0, 0, mapBitmapCanvas.width, mapBitmapCanvas.height, 0, 0, cssW, cssH
        );

                // 2) Clone card off-screen (solo si no está en blanco el canvas principal)
        const cardRect = cardBody.getBoundingClientRect();
        const clone = cardBody.cloneNode(true);
        Object.assign(clone.style, {
          position: 'absolute',
          top: '-10000px',
          left: '-10000px',
          pointerEvents: 'none',
          width: cardRect.width + 'px',
          height: cardRect.height + 'px',
          background: '#ffffff',
          display: 'block'
        });
        document.body.appendChild(clone);

        // Remove unwanted controls ONLY in the clone
        ['#exportCollabMap', '[data-map-view="world"]', '[data-map-view="spain"]', '.leaflet-control-zoom']
          .forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

        // Prepare cloned map container
        const cloneMap = clone.querySelector('#worldmap-container');
        if (!cloneMap) throw new Error('Clone map container not found');

        // Fix size so it doesn't collapse
        cloneMap.style.width = cssW + 'px';
        cloneMap.style.height = cssH + 'px';
        cloneMap.style.position = 'relative';
        cloneMap.style.overflow = 'hidden';

        // Make leaflet container backgrounds transparent in the CLONE
        const cloneLeafletContainer =
          cloneMap.querySelector('.leaflet-container') || cloneMap;
        cloneLeafletContainer.style.background = 'transparent';
        cloneLeafletContainer.style.border = 'none';

        // Hide all Leaflet panes (tiles, vectors, markers) in the CLONE
        cloneMap.querySelectorAll('.leaflet-pane').forEach(p => {
          p.style.display = 'none';
        });

        // Insert the map image as an absolutely-positioned background layer
        const bmp = document.createElement('img');
        bmp.src = scaledMap.toDataURL('image/png');
        Object.assign(bmp.style, {
          position: 'absolute',
          left: '0px',
          top: '0px',
          width: cssW + 'px',
          height: cssH + 'px',
          zIndex: '0',
          display: 'block'
        });
        // Put it as the first child so it stays at the bottom
        cloneLeafletContainer.insertBefore(bmp, cloneLeafletContainer.firstChild);

        // Ensure any of your overlays (legend/top10) sit above the image
        cloneMap.querySelectorAll('.legend, .legend-container, .top10, .top10-container')
          .forEach(el => {
            if (!el) return;
            if (!el.style.position) el.style.position = 'absolute';
            el.style.zIndex = '10';
            el.style.background = el.style.background || 'transparent';
          });

                let baseCanvas;
                if (!isBlank) {
                    // 3a) Rasterizar clon con imagen del mapa fija
                    const { default: html2canvas } = await import('html2canvas');
                    const scale = Math.min(4, (window.devicePixelRatio || 1) * 2);
                    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                    baseCanvas = await html2canvas(clone, {
                        backgroundColor: '#ffffff',
                        scale,
                        useCORS: true,
                        logging: false,
                        removeContainer: true,
                        imageTimeout: 0
                    });
                } else {
                    // 3b) Fallback: capturar directamente el cardBody original ocultando controles (sin clonado)
                    const toHide = [
                        '#exportCollabMap',
                        '[data-map-view="world"]',
                        '[data-map-view="spain"]',
                        '.leaflet-control-zoom'
                    ].map(sel => Array.from(cardBody.querySelectorAll(sel))).flat();
                    toHide.forEach(el => { el.__prevVisibility = el.style.visibility; el.style.visibility = 'hidden'; });
                    // Forzamos un reflow
                    void cardBody.offsetHeight; // eslint-disable-line no-unused-expressions
                    const { default: html2canvas } = await import('html2canvas');
                    const scale = Math.min(4, (window.devicePixelRatio || 1) * 2);
                    baseCanvas = await html2canvas(cardBody, {
                        backgroundColor: '#ffffff',
                        scale,
                        useCORS: true,
                        logging: false,
                        removeContainer: true,
                        imageTimeout: 0
                    });
                    // Restaurar visibilidad
                    toHide.forEach(el => { el.style.visibility = el.__prevVisibility || ''; delete el.__prevVisibility; });
                    // Eliminamos el clon porque no lo usamos
                    if (clone.parentNode) document.body.removeChild(clone);
                }

        // 4) Add margins (left/top)
        const marginLeft = 60; // tweak to taste
        const marginTop  = 50;

        const paddedCanvas = document.createElement('canvas');
        paddedCanvas.width  = baseCanvas.width  + marginLeft;
        paddedCanvas.height = baseCanvas.height + marginTop;
        const pctx = paddedCanvas.getContext('2d');
        pctx.fillStyle = '#ffffff';
        pctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
        pctx.drawImage(baseCanvas, marginLeft, marginTop);

        // 5) Download & cleanup
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const a = document.createElement('a');
        a.download = `international_collaborations_${ts}.png`;
        a.href = paddedCanvas.toDataURL('image/png');
        a.click();

                if (clone.parentNode) document.body.removeChild(clone);
            } catch (err) {
                console.error('[WorldMap][Export] Flujo principal falló, usando fallback simple html2canvas', err);
                try {
                    const cardBody = exportBtn.closest('.card-body');
                    if (!cardBody) throw err;
                    const toHide = [
                        '#exportCollabMap',
                        '[data-map-view="world"]',
                        '[data-map-view="spain"]',
                        '.leaflet-control-zoom'
                    ].map(sel => Array.from(cardBody.querySelectorAll(sel))).flat();
                    toHide.forEach(el => { el.__prevVisibility = el.style.visibility; el.style.visibility = 'hidden'; });
                    const { default: html2canvas } = await import('html2canvas');
                    const scale = Math.min(3, (window.devicePixelRatio || 1) * 2);
                    await new Promise(r => requestAnimationFrame(r));
                    const baseCanvas = await html2canvas(cardBody, {
                        backgroundColor: '#ffffff',
                        scale,
                        useCORS: true,
                        logging: false,
                        removeContainer: true,
                        imageTimeout: 0
                    });
                    toHide.forEach(el => { el.style.visibility = el.__prevVisibility || ''; delete el.__prevVisibility; });
                    const marginLeft = 60; const marginTop = 50;
                    const paddedCanvas = document.createElement('canvas');
                    paddedCanvas.width = baseCanvas.width + marginLeft;
                    paddedCanvas.height = baseCanvas.height + marginTop;
                    const ctx = paddedCanvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0,0,paddedCanvas.width,paddedCanvas.height);
                    ctx.drawImage(baseCanvas, marginLeft, marginTop);
                    const ts = new Date().toISOString().replace(/[:.]/g, '-');
                    const a = document.createElement('a');
                    a.download = `international_collaborations_${ts}.png`;
                    a.href = paddedCanvas.toDataURL('image/png');
                    a.click();
                } catch (fallbackErr) {
                    console.error('[WorldMap][Export] Fallback html2canvas también falló', fallbackErr);
                    alert('Failed to export image');
                }
            }
    });
  }
}

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

    // Update Top-10 table (control interno) excluyendo España
    try {
        if (worldMapRegistry.top10El) {
            const entries = Object.entries(worldMapRegistry.countsByIsoA2)
                .filter(([iso, count]) => iso !== 'ES' && count > 0)
                .sort((a,b) => b[1]-a[1])
                .slice(0,10);
            const totalAllExES = Object.entries(worldMapRegistry.countsByIsoA2)
                .filter(([iso]) => iso !== 'ES')
                .reduce((acc,[,v])=> acc+v, 0);
            // Prefer the backend-provided total of filtered publications to compute %
            // This avoids underestimating the percentage when a publication counts in multiple countries.
            const filteredTotal = (typeof window !== 'undefined' && typeof window.worldMapFilteredTotal === 'number' && window.worldMapFilteredTotal > 0)
                ? window.worldMapFilteredTotal
                : null;
            const denominator = (filteredTotal && filteredTotal > 0) ? filteredTotal : (totalAllExES > 0 ? totalAllExES : 0);
            const currentLang = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1]) || 'en';
            const colCountry = currentLang === 'es' ? 'País' : 'Country';
            const colItems = currentLang === 'es' ? 'Núm.' : 'Items';
            const colPct = currentLang === 'es' ? '%' : '%';
            const caption = currentLang === 'es' ? 'Top 10 países' : 'Top 10 countries';
            if (!entries.length) {
                worldMapRegistry.top10El.innerHTML = `<div style=\"font-weight:600;font-size:12px;margin-bottom:4px;\">${caption}</div><div style=\"font-size:11px;color:#666;\">—</div>`;
            } else {
                const rows = entries.map(([iso, cnt]) => {
                    const pct = denominator > 0 ? ((cnt/denominator)*100).toFixed(1) : '0.0';
                    const name = isoToDisplayName(iso, currentLang);
                    return `<tr><td><strong>${name}</strong></td><td>${cnt}</td><td>${pct}%</td></tr>`;
                }).join('');
                worldMapRegistry.top10El.innerHTML = `<table aria-label=\"${caption}\"><caption>${caption}</caption><thead><tr><th>${colCountry}</th><th>${colItems}</th><th>${colPct}</th></tr></thead><tbody>${rows}</tbody></table>`;
            }
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[WorldMap] Failed to update top10 table', e);
    }

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
