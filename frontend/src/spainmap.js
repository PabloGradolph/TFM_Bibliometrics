/**
 * SpainMap module using Leaflet.js
 * Paints CCAA and Provinces according to counts.
 * Responsive; fills the card container similar to worldmap.js.
 */

import L from 'leaflet';

// Lightweight styles (reuse from worldmap where possible)
if (typeof document !== 'undefined' && !document.getElementById('spainmap-focus-style')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'spainmap-focus-style';
  styleEl.textContent = `
  .leaflet-container .leaflet-interactive:focus { outline: none; }
  .leaflet-control { z-index: 600 !important; }
  .leaflet-control-zoom a { background:#ffffff; width:30px; height:30px; line-height:30px; font-weight:600; font-size:16px; }
  .leaflet-control-zoom a:hover { background:#f2f2f2; }
  .spainmap-legend { font: 12px/1.2 system-ui, sans-serif; }
  .spainmap-top10-table { font: 12px/1.2 system-ui, sans-serif; }
  .spainmap-top10-table table { border-collapse: collapse; width:100%; }
  .spainmap-top10-table th, .spainmap-top10-table td { padding:2px 6px; font-size:11px; text-align:left; white-space:nowrap; }
  .spainmap-top10-table th { font-weight:600; border-bottom:1px solid #ddd; }
  .spainmap-top10-table tbody tr:nth-child(even){ background:#f8f8f8; }
  .spainmap-top10-table caption { text-align:left; font-weight:600; margin-bottom:4px; font-size:12px; }
  `;
  document.head.appendChild(styleEl);
}

const COLORS = ['#fff5e6','#ffe6cc','#ffcf99','#ffb566','#ff9c33','#ff8800','#f06d00','#d45500'];
const THRESH = [0.05,0.15,0.30,0.45,0.60,0.75,0.90,1.0];

function buildLegendHTML(maxCount) {
  if (!maxCount || maxCount < 1) return '<div style="font-size:11px;">No data</div>';
  const isES = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1] === 'es');
  let html = '<div class="spainmap-legend"><div style="font-weight:600;margin-bottom:4px;">' + (isES ? 'Publicaciones' : 'Publications') + '</div>';
  THRESH.forEach((t,i)=>{
    const prev = i===0 ? 0 : THRESH[i-1];
    const minCount = Math.max(1, Math.round(Math.pow(maxCount, prev||0.001)));
    const maxBucket = Math.round(Math.pow(maxCount, t));
    const label = i === THRESH.length - 1 ? `≥ ${minCount}` : `${minCount}–${maxBucket}`;
    html += `<div style="display:flex;align-items:center;margin:2px 0;">`+
      `<span style="display:inline-block;width:18px;height:14px;background:${COLORS[i]};border:1px solid #ccc;margin-right:6px;"></span>`+
      `<span style="font-size:11px;white-space:nowrap;">${label}</span>`+
      `</div>`;
  });
  html += '</div>';
  return html;
}

const registry = {
  map: null,
  layerCCAA: null,
  layerProv: null,
  countsCCAA: {},
  countsProv: {},
  countsCCAACanonical: {},
  countsProvCanonical: {},
  maxCount: 0,
  // Parent container id (e.g., 'worldmap-container')
  containerId: null,
  // Child container element where the Spain Leaflet map is mounted
  containerEl: null,
  // Loading overlay specific to the Spain map
  loadingEl: null,
  activeLevel: 'ccaa', // 'ccaa' | 'prov'
  // Display name mappings for Top10 (canonical key -> display name)
  ccaaCanonicalToDisplay: {},
  provCanonicalToDisplay: {},
  // Top10 control refs
  top10El: null,
  top10Control: null,
};

function normKey(s) {
  if (!s || typeof s !== 'string') return '';
  const nfkd = s.normalize('NFKD');
  const ascii = nfkd.replace(/[\u0300-\u036f]/g, '');
  return ascii.replace(/[‐‑‒–—―\-_/]+/g,' ').replace(/[^A-Za-zÀ-ÿ ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}

function canonicalKey(s) {
  const base = normKey(s);
  if (!base) return '';
  const tokens = base.split(' ').filter(Boolean).sort();
  return tokens.join(' ');
}

// Alias maps to reconcile backend naming variants with GeoJSON feature names
// Keys must be normalized with normKey; values are strings that, once
// canonicalized, match the GeoJSON feature canonical key
const CCAA_ALIASES = new Map([
  // Asturias
  ['asturias principado de', 'asturias'],
  ['principado de asturias', 'asturias'],
  // Castilla y León
  ['castilla y leon', 'castilla leon'],
  // Comunidad Valenciana
  ['comunidad valenciana', 'valencia'],
  // Comunidad de Madrid
  ['madrid comunidad de', 'madrid'],
  ['comunidad de madrid', 'madrid'],
  // Región de Murcia
  ['murcia region de', 'murcia'],
  ['region de murcia', 'murcia'],
  // Comunidad Foral de Navarra
  ['navarra comunidad foral de', 'navarra'],
  ['comunidad foral de navarra', 'navarra'],
]);

const PROV_ALIASES = new Map([
  // Vizcaya / Bizkaia (GeoJSON name is "Bizkaia/Vizcaya")
  ['vizcaya', 'bizkaia vizcaya'],
  ['bizkaia', 'bizkaia vizcaya'],
]);

/**
 * Apply level-specific alias to a raw name before canonicalization.
 * Ensures mismatched inputs map to the GeoJSON feature canonical keys.
 * @param {string} name - input key from backend counts
 * @param {'ccaa'|'prov'} level - target layer level
 * @returns {string} - possibly remapped name to canonicalize
 */
function applyAlias(name, level) {
  const n = normKey(name);
  if (!n) return '';
  if (level === 'ccaa') {
    return CCAA_ALIASES.get(n) || n;
  }
  if (level === 'prov') {
    return PROV_ALIASES.get(n) || n;
  }
  return n;
}

function styleFor(name, level) {
  const key = canonicalKey(name);
  const count = level === 'ccaa' ? (registry.countsCCAACanonical[key] || 0) : (registry.countsProvCanonical[key] || 0);
  const maxCount = registry.maxCount || 1;
  const isActive = count > 0;
  let normalized = 0;
  if (isActive) {
    normalized = maxCount > 1 ? (Math.log(count || 1) / Math.log(maxCount)) : 1;
    if (!isFinite(normalized) || normalized < 0) normalized = 0;
    if (normalized > 1) normalized = 1;
  }
  const pickFill = (t) => {
    if (t <= 0.05) return COLORS[0];
    if (t <= 0.15) return COLORS[1];
    if (t <= 0.30) return COLORS[2];
    if (t <= 0.45) return COLORS[3];
    if (t <= 0.60) return COLORS[4];
    if (t <= 0.75) return COLORS[5];
    if (t <= 0.90) return COLORS[6];
    return COLORS[7];
  };
  const fillColor = isActive ? pickFill(normalized) : '#ffffff';
  const fillOpacity = isActive ? (0.1 + 0.85 * normalized) : 0.0;
  return {
    stroke: true,
    color: isActive ? '#b34700' : '#9a9a9a',
    opacity: isActive ? 1.0 : 0.8,
    weight: isActive ? 1.2 : 1.0,
    fillColor,
    fillOpacity,
  };
}

function updateLegend(ctrl) {
  const c = ctrl && ctrl.getContainer ? ctrl.getContainer() : null;
  if (c) c.innerHTML = buildLegendHTML(registry.maxCount);
}

function updateTop10() {
  try {
    if (!registry.top10El) return;
    const isES = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1] === 'es');
    const isCCAA = registry.activeLevel === 'ccaa';
    const title = isES ? (isCCAA ? 'Top 10 comunidades' : 'Top 10 provincias') : (isCCAA ? 'Top 10 communities' : 'Top 10 provinces');
    const colName = isES ? (isCCAA ? 'Comunidad' : 'Provincia') : (isCCAA ? 'Community' : 'Province');
    const colItems = isES ? 'Núm.' : 'Items';
    const colPct = '%';

    const counts = isCCAA ? (registry.countsCCAACanonical || {}) : (registry.countsProvCanonical || {});
    const nameMap = isCCAA ? (registry.ccaaCanonicalToDisplay || {}) : (registry.provCanonicalToDisplay || {});
    // Excluir Andalucía en CCAA y Granada en provincias del Top 10
    const excludeSet = isCCAA ? new Set(['andalucia']) : new Set(['granada']);
    // Filtrar solo claves presentes en el mapa (evita Canarias si están excluidas)
    const entries = Object.entries(counts)
      .filter(([ck, v]) => v > 0 && Object.prototype.hasOwnProperty.call(nameMap, ck) && !excludeSet.has(ck))
      .sort((a,b) => b[1]-a[1])
      .slice(0, 10);
    // Denominador: preferir total del backend si está disponible
    const backendTotal = (typeof window !== 'undefined' && typeof window.spainMapFilteredTotal === 'number') ? window.spainMapFilteredTotal : null;
    const denom = (backendTotal && backendTotal > 0)
      ? backendTotal
      : Object.entries(counts).filter(([ck]) => Object.prototype.hasOwnProperty.call(nameMap, ck)).reduce((acc,[,v]) => acc + (typeof v === 'number' ? v : 0), 0);

    if (!entries.length) {
      registry.top10El.innerHTML = `<div style="font-weight:600;font-size:12px;margin-bottom:4px;">${title}</div><div style="font-size:11px;color:#666;">—</div>`;
      return;
    }

    const rows = entries.map(([ck, cnt]) => {
      const pct = denom > 0 ? ((cnt/denom)*100).toFixed(1) : '0.0';
      const name = nameMap[ck] || ck;
      return `<tr><td><strong>${name}</strong></td><td>${cnt}</td><td>${pct}%</td></tr>`;
    }).join('');
    registry.top10El.innerHTML = `<div class="spainmap-top10-table"><table aria-label="${title}"><caption>${title}</caption><thead><tr><th>${colName}</th><th>${colItems}</th><th>${colPct}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (e) {
    try { console.warn('[SpainMap] Failed to update Top10', e); } catch (_) { /* noop */ }
  }
}

export function initSpainMap(containerId) {
  registry.containerId = containerId;
  const parent = document.getElementById(containerId);
  if (!parent) return;
  try { console.debug('[SpainMap] init on container', containerId); } catch (e) { /* noop */ }
  // Ensure parent has baseline styles
  parent.style.background = '#ffffff';
  parent.style.position = 'relative';
  if (!parent.style.height || parent.style.height === '0px') parent.style.height = '360px';

  // Create or reuse a dedicated child container to avoid clashing with the World map
  let child = parent.querySelector(`#${containerId}-spain`);
  if (!child) {
    child = document.createElement('div');
    child.id = `${containerId}-spain`;
    // Absolute overlay so it sits above the world map without replacing it
    child.style.position = 'absolute';
    child.style.top = '0';
    child.style.left = '0';
    child.style.width = '100%';
    child.style.height = '100%';
    // Use a high z-index to stay above any Leaflet popups/tooltips from the world map (popup=700, tooltip=650)
    child.style.zIndex = '1000';
    child.style.background = '#ffffff';
    // Start hidden; dashboard controls visibility via setSpainMapVisible
    child.style.display = 'none';
    parent.appendChild(child);
  }
  registry.containerEl = child;

  // Loading overlay inside the Spain map container
  const overlay = document.createElement('div');
  overlay.className = 'spainmap-loading-overlay';
  overlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.8);z-index:700;`;
  overlay.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>`;
  child.appendChild(overlay);
  registry.loadingEl = overlay;

  // Initialize Leaflet on the child container (unique id), avoiding the already initialized parent
  const map = L.map(child.id, {
    center: [40.0, -3.7],
    zoom: 5,
    minZoom: 4,
    maxZoom: 12,
    attributionControl: false,
    zoomControl: false,
    scrollWheelZoom: false,
    // Force Canvas so leaflet-image can rasterize vector layers reliably
    preferCanvas: true,
  });
  L.control.zoom({ position: 'topright' }).addTo(map);
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'leaflet-bar');
    div.style.background = 'rgba(255,255,255,0.92)';
    div.style.padding = '6px 8px';
    div.style.borderRadius = '4px';
    div.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
    div.innerHTML = buildLegendHTML(registry.maxCount);
    return div;
  };
  legend.addTo(map);

  // Top 10 control (mirror world map layout: bottom-left to avoid overlapping legend)
  const top10 = L.control({ position: 'bottomleft' });
  top10.onAdd = function() {
    const div = L.DomUtil.create('div', 'leaflet-bar spainmap-top10-table');
    div.style.background = 'rgba(255,255,255,0.95)';
    div.style.padding = '6px 8px';
    div.style.borderRadius = '4px';
    div.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
    div.style.maxWidth = '280px';
    div.style.maxHeight = 'none';
    div.style.overflow = 'visible';
    const isES = (typeof window !== 'undefined' && window.location && window.location.pathname.split('/')[1] === 'es');
    const initialTitle = isES ? 'Top 10 comunidades' : 'Top 10 communities';
    div.innerHTML = `<div style="font-weight:600;font-size:12px;margin-bottom:4px;">${initialTitle}</div><div style="font-size:11px;color:#666;">—</div>`;
    registry.top10El = div;
    return div;
  };
  top10.addTo(map);
  registry.top10Control = top10;

  // Helper: try multiple URLs until one succeeds
  async function fetchJsonWithFallback(urls) {
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        // eslint-disable-next-line no-console
        console.warn('[SpainMap] Failed to fetch', url, e);
      }
    }
    throw lastErr || new Error('All sources failed');
  }

  // Load CCAA and Provinces GeoJSON from local static paths or raw GitHub fallbacks (CORS-friendly)
  Promise.all([
    fetchJsonWithFallback([
      '/static/js/data/spain-communities.geojson',
      '/static/data/spain-communities.geojson',
      '/data/spain-communities.geojson',
      'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-communities.geojson'
    ]),
    fetchJsonWithFallback([
      '/static/js/data/spain-provinces.geojson',
      '/static/data/spain-provinces.geojson',
      '/data/spain-provinces.geojson',
      'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson'
    ])
  ]).then(([ccaa, prov]) => {
    try {
      console.debug('[SpainMap] GeoJSON loaded:', {
        ccaaFeatures: Array.isArray(ccaa?.features) ? ccaa.features.length : 'N/A',
        provFeatures: Array.isArray(prov?.features) ? prov.features.length : 'N/A'
      });
    } catch (e) { /* noop */ }
    // Option: Exclude Canary Islands to center the peninsula
    // Filter out CCAA "Canarias" and provinces "Las Palmas" and "Santa Cruz De Tenerife"
    const ccaaFiltered = {
      ...ccaa,
      features: (Array.isArray(ccaa?.features) ? ccaa.features : []).filter(f => {
        const n = (f.properties && (f.properties.name || f.properties.NAME)) || '';
        const nk = canonicalKey(n);
        // canonicalKey sorts tokens, so check for both tokens presence
        // For Canarias, the canonical key will be 'canarias'
        return nk !== 'canarias';
      })
    };
    const provFiltered = {
      ...prov,
      features: (Array.isArray(prov?.features) ? prov.features : []).filter(f => {
        const n = (f.properties && (f.properties.name || f.properties.NAME)) || '';
        // Use normalized (not token-sorted) key to match exact province names
        const nn = normKey(n);
        return nn !== 'las palmas' && nn !== 'santa cruz de tenerife';
      })
    };

    const layerCCAA = L.geoJSON(ccaaFiltered, {
      style: f => styleFor(f.properties && (f.properties.name || f.properties.NAME || ''), 'ccaa'),
      onEachFeature: (f, lyr) => {
        const name = (f.properties && (f.properties.name || f.properties.NAME)) || 'Unknown';
        lyr.bindTooltip(() => {
          const key = canonicalKey(name);
          const count = registry.countsCCAACanonical[key] || 0;
          const pubsLabel = 'publicaciones';
          return count > 0 ? `${name}: ${count} ${pubsLabel}` : `${name}`;
        }, { sticky: true });
      }
  }).addTo(map);

  const layerProv = L.geoJSON(provFiltered, {
      style: f => styleFor(f.properties && (f.properties.name || f.properties.NAME || ''), 'prov'),
      onEachFeature: (f, lyr) => {
        const name = (f.properties && (f.properties.name || f.properties.NAME)) || 'Unknown';
        lyr.bindTooltip(() => {
          const key = canonicalKey(name);
          const count = registry.countsProvCanonical[key] || 0;
          const pubsLabel = 'publicaciones';
          return count > 0 ? `${name}: ${count} ${pubsLabel}` : `${name}`;
        }, { sticky: true });
      }
    });

    // By default show CCAA; provinces can be toggled externally
    registry.layerCCAA = layerCCAA;
    registry.layerProv = layerProv;
    registry.map = map;

    // Build canonical -> display name maps from filtered features (ensures consistency with what is shown)
    registry.ccaaCanonicalToDisplay = {};
    (ccaaFiltered.features || []).forEach(f => {
      const n = (f.properties && (f.properties.name || f.properties.NAME)) || '';
      const ck = canonicalKey(n);
      if (ck) registry.ccaaCanonicalToDisplay[ck] = n;
    });
    registry.provCanonicalToDisplay = {};
    (provFiltered.features || []).forEach(f => {
      const n = (f.properties && (f.properties.name || f.properties.NAME)) || '';
      const ck = canonicalKey(n);
      if (ck) registry.provCanonicalToDisplay[ck] = n;
    });

  // Ensure layout is updated after layers attach
  try {
    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) { /* noop */ }
      try { map.fitBounds(layerCCAA.getBounds(), { padding: [10, 10] }); } catch (e) { map.setView([40.0,-3.7], 5); }
    }, 50);
  } catch (e) { /* noop */ }
  try { console.debug('[SpainMap] CCAA layer added and fitted.'); } catch (e) { /* noop */ }

    if (registry.loadingEl) registry.loadingEl.style.display = 'none';
    // Initial Top10 render (may be empty until counts arrive)
    updateTop10();
  }).catch(err => {
    // eslint-disable-next-line no-console
    console.error('[SpainMap] Error loading GeoJSON:', err);
    if (registry.loadingEl) registry.loadingEl.style.display = 'none';
  });

  // Expose to update legend later
  registry.legend = legend;
}

// --- Helper: load leaflet-image UMD from CDN if not present ---
function ensureLeafletImage() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.leafletImage) return resolve(window.leafletImage);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet-image@0.0.4/leaflet-image.js';
    s.async = true;
    s.onload = () => resolve(window.leafletImage);
    s.onerror = () => reject(new Error('Failed to load leaflet-image'));
    document.head.appendChild(s);
  });
}

async function exportSpainMapImage(exportBtnEl) {
  try {
    if (!registry.map || !registry.containerEl) return;
    const exportBtn = exportBtnEl || (typeof document !== 'undefined' ? document.getElementById('exportCollabMap') : null);
    const cardBody = exportBtn ? exportBtn.closest('.card-body') : null;
    if (!cardBody) return;
    const mapContainer = registry.containerEl; // overlay div (absolute) que contiene el mapa de España

    // 1) Render Leaflet map to bitmap (no controls)
  await ensureLeafletImage();
  try { registry.map.invalidateSize(); } catch (e) { /* noop */ }
  await new Promise(r => setTimeout(r, 30));
    const mapBitmapCanvas = await new Promise((resolve, reject) => {
      window.leafletImage(registry.map, (err, canvas) => {
        if (err || !canvas) return reject(err || new Error('leaflet-image failed'));
        resolve(canvas);
      });
    });

    // Check blank canvas edge-case
    const isBlank = (() => {
      try {
        const ctx = mapBitmapCanvas.getContext('2d');
        const sampleW = Math.min(20, mapBitmapCanvas.width);
        const sampleH = Math.min(20, mapBitmapCanvas.height);
        const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
        for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) return false; }
        return true;
      } catch (e) { return false; }
    })();

    // Match current displayed size of the Spain overlay container
    const mapRect = mapContainer.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(mapRect.width));
    const cssH = Math.max(1, Math.round(mapRect.height));
    const scaledMap = document.createElement('canvas');
    scaledMap.width = cssW; scaledMap.height = cssH;
    scaledMap.getContext('2d').drawImage(mapBitmapCanvas, 0, 0, mapBitmapCanvas.width, mapBitmapCanvas.height, 0, 0, cssW, cssH);

    // 2) Clone card off-screen
    const cardRect = cardBody.getBoundingClientRect();
    const clone = cardBody.cloneNode(true);
    Object.assign(clone.style, {
      position: 'absolute', top: '-10000px', left: '-10000px', pointerEvents: 'none',
      width: cardRect.width + 'px', height: cardRect.height + 'px', background: '#ffffff', display: 'block'
    });
    document.body.appendChild(clone);

    // Remove/hide unwanted controls ONLY in the clone
    ['#exportCollabMap', '[data-map-view="world"]', '[data-map-view="spain"]', '.leaflet-control-zoom', '[data-spain-level]']
      .forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

    // Prepare cloned Spain overlay container (same id as original overlay)
    const overlayClone = clone.querySelector('#' + registry.containerEl.id);
    if (!overlayClone) throw new Error('Clone overlay container not found');
  overlayClone.style.width = cssW + 'px';
  overlayClone.style.height = cssH + 'px';
  overlayClone.style.position = 'relative';
  overlayClone.style.overflow = 'hidden';
    // Ensure transparent background and hide Leaflet panes
    const cloneLeafletContainer = overlayClone.querySelector('.leaflet-container') || overlayClone;
    cloneLeafletContainer.style.background = 'transparent';
    cloneLeafletContainer.style.border = 'none';
    overlayClone.querySelectorAll('.leaflet-pane').forEach(p => { p.style.display = 'none'; });
    // Insert the map image as background layer
    const bmp = document.createElement('img');
    bmp.src = scaledMap.toDataURL('image/png');
    Object.assign(bmp.style, { position: 'absolute', left: '0px', top: '0px', width: cssW + 'px', height: cssH + 'px', zIndex: '0', display: 'block' });
  cloneLeafletContainer.insertBefore(bmp, cloneLeafletContainer.firstChild);

    let baseCanvas;
    if (!isBlank) {
      // 3a) Rasterize clone with fixed map bitmap
      const { default: html2canvas } = await import('html2canvas');
      const scale = Math.min(4, (window.devicePixelRatio || 1) * 2);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      baseCanvas = await html2canvas(clone, { backgroundColor: '#ffffff', scale, useCORS: true, logging: false, removeContainer: true, imageTimeout: 0 });
    } else {
      // 3b) Fallback: capture the original cardBody, hiding controls in-place
      const toHide = [
        '#exportCollabMap',
        '[data-map-view="world"]',
        '[data-map-view="spain"]',
        '.leaflet-control-zoom',
        '[data-spain-level]'
      ].map(sel => Array.from(cardBody.querySelectorAll(sel))).flat();
      toHide.forEach(el => { el.__prevVisibility = el.style.visibility; el.style.visibility = 'hidden'; });
      const { default: html2canvas } = await import('html2canvas');
      const scale = Math.min(4, (window.devicePixelRatio || 1) * 2);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      baseCanvas = await html2canvas(cardBody, { backgroundColor: '#ffffff', scale, useCORS: true, logging: false, removeContainer: true, imageTimeout: 0 });
      toHide.forEach(el => { el.style.visibility = el.__prevVisibility || ''; delete el.__prevVisibility; });
      if (clone.parentNode) document.body.removeChild(clone);
    }

    // 4) Add margins and download
    const marginLeft = 60; const marginTop = 50;
    const paddedCanvas = document.createElement('canvas');
    paddedCanvas.width = baseCanvas.width + marginLeft;
    paddedCanvas.height = baseCanvas.height + marginTop;
    const pctx = paddedCanvas.getContext('2d');
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
    pctx.drawImage(baseCanvas, marginLeft, marginTop);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.download = `national_collaborations_${ts}.png`;
    a.href = paddedCanvas.toDataURL('image/png');
    a.click();

  if (clone.parentNode) document.body.removeChild(clone);
  } catch (err) {
    console.error('[SpainMap][Export] Failed to export Spain map image', err);
    alert('Failed to export image');
  }
}

// Expose exporter for worldmap handler to delegate when Spain view is active
if (typeof window !== 'undefined') {
  window.__exportSpainMapImage = exportSpainMapImage;
}

export function setSpainMapCounts({ ccaa = {}, provinces = {} }) {
  // Show overlay while applying
  if (registry.loadingEl) registry.loadingEl.style.display = 'flex';
  registry.countsCCAA = ccaa || {};
  registry.countsProv = provinces || {};
  // Build canonical maps so lookup is insensitive to word order/diacritics
  registry.countsCCAACanonical = {};
  Object.entries(registry.countsCCAA).forEach(([k,v]) => {
    // Apply alias mapping prior to canonicalization
    const aliased = applyAlias(k, 'ccaa');
    const ck = canonicalKey(aliased);
    if (!ck) return;
    registry.countsCCAACanonical[ck] = (typeof v === 'number' && isFinite(v) ? v : 0);
  });
  registry.countsProvCanonical = {};
  Object.entries(registry.countsProv).forEach(([k,v]) => {
    const aliased = applyAlias(k, 'prov');
    const ck = canonicalKey(aliased);
    if (!ck) return;
    registry.countsProvCanonical[ck] = (typeof v === 'number' && isFinite(v) ? v : 0);
  });
  // compute maxCount across both
  registry.maxCount = 0;
  for (const v of Object.values(registry.countsCCAACanonical)) if (typeof v === 'number' && v > registry.maxCount) registry.maxCount = v;
  for (const v of Object.values(registry.countsProvCanonical)) if (typeof v === 'number' && v > registry.maxCount) registry.maxCount = v;
  if (registry.layerCCAA) registry.layerCCAA.setStyle(f => styleFor(f.properties && (f.properties.name || f.properties.NAME || ''), 'ccaa'));
  if (registry.layerProv) registry.layerProv.setStyle(f => styleFor(f.properties && (f.properties.name || f.properties.NAME || ''), 'prov'));
  if (registry.legend) updateLegend(registry.legend);
  updateTop10();
  if (registry.loadingEl) registry.loadingEl.style.display = 'none';
}

export function showSpainLevel(level) {
  // level: 'ccaa' | 'provinces'
  registry.activeLevel = level === 'provinces' ? 'prov' : 'ccaa';
  if (!registry.map) return;
  if (registry.layerCCAA && registry.map.hasLayer(registry.layerCCAA)) registry.map.removeLayer(registry.layerCCAA);
  if (registry.layerProv && registry.map.hasLayer(registry.layerProv)) registry.map.removeLayer(registry.layerProv);
  const layer = registry.activeLevel === 'ccaa' ? registry.layerCCAA : registry.layerProv;
  if (layer) {
    layer.addTo(registry.map);
    // On first switch, ensure view fits the layer bounds
    try { registry.map.fitBounds(layer.getBounds(), { padding: [10, 10] }); } catch (e) { /* noop */ }
  }
  if (registry.legend) updateLegend(registry.legend);
  updateTop10();
}

export function setSpainMapLoading(visible) {
  if (registry.loadingEl) registry.loadingEl.style.display = visible ? 'flex' : 'none';
}

/**
 * Show or hide the Spain map overlay container.
 * This avoids re-initializing Leaflet maps on the same DOM element.
 * @param {boolean} visible - true to show, false to hide
 */
export function setSpainMapVisible(visible) {
  try { console.debug('[SpainMap] set visible:', visible); } catch (e) { /* noop */ }
  if (registry.containerEl) {
    registry.containerEl.style.display = visible ? 'block' : 'none';
    if (visible) {
      // Force explicit pixel height/width to avoid percentage sizing issues
      const parent = registry.containerEl.parentElement;
      if (parent) {
        const w = parent.clientWidth || parent.offsetWidth;
        const h = parent.clientHeight || parent.offsetHeight || 360;
        if (w > 0) registry.containerEl.style.width = w + 'px';
        if (h > 0) registry.containerEl.style.height = h + 'px';
      }
    }
    // Additionally hide/show the world map's Leaflet layers and controls
    const parent = registry.containerEl.parentElement;
    if (parent) {
      const worldChildren = Array.from(parent.children);
      worldChildren.forEach(el => {
        if (el === registry.containerEl) return; // skip Spain overlay itself
        const cls = el.classList || { contains: () => false };
        const isLeafletWorld = cls.contains('leaflet-pane') || cls.contains('leaflet-control-container') || cls.contains('leaflet-overlay-pane') || cls.contains('leaflet-marker-pane');
        if (isLeafletWorld) {
          el.style.visibility = visible ? 'hidden' : '';
        }
      });
      // Also hide any lingering Leaflet popups/tooltips from world map
      const popup = parent.querySelector('.leaflet-popup-pane');
      const tooltip = parent.querySelector('.leaflet-tooltip-pane');
      if (popup) popup.style.visibility = visible ? 'hidden' : '';
      if (tooltip) tooltip.style.visibility = visible ? 'hidden' : '';
    }
    // Invalidate size to ensure proper rendering when becoming visible
    if (visible && registry.map) {
      try { registry.map.invalidateSize(); } catch (e) { /* noop */ }
      try { setTimeout(() => registry.map && registry.map.invalidateSize(), 50); } catch (e) { /* noop */ }
    }
  }
}
