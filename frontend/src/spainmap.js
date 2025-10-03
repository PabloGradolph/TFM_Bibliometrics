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
    const layerCCAA = L.geoJSON(ccaa, {
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

  const layerProv = L.geoJSON(prov, {
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

  // Ensure layout is updated after layers attach
  try {
    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) { /* noop */ }
      try { map.fitBounds(layerCCAA.getBounds(), { padding: [10, 10] }); } catch (e) { map.setView([40.0,-3.7], 5); }
    }, 50);
  } catch (e) { /* noop */ }
  try { console.debug('[SpainMap] CCAA layer added and fitted.'); } catch (e) { /* noop */ }

    if (registry.loadingEl) registry.loadingEl.style.display = 'none';
  }).catch(err => {
    // eslint-disable-next-line no-console
    console.error('[SpainMap] Error loading GeoJSON:', err);
    if (registry.loadingEl) registry.loadingEl.style.display = 'none';
  });

  // Expose to update legend later
  registry.legend = legend;
}

export function setSpainMapCounts({ ccaa = {}, provinces = {} }) {
  // Show overlay while applying
  if (registry.loadingEl) registry.loadingEl.style.display = 'flex';
  registry.countsCCAA = ccaa || {};
  registry.countsProv = provinces || {};
  // Build canonical maps so lookup is insensitive to word order/diacritics
  registry.countsCCAACanonical = {};
  Object.entries(registry.countsCCAA).forEach(([k,v]) => {
    const ck = canonicalKey(k);
    if (!ck) return;
    registry.countsCCAACanonical[ck] = (typeof v === 'number' && isFinite(v) ? v : 0);
  });
  registry.countsProvCanonical = {};
  Object.entries(registry.countsProv).forEach(([k,v]) => {
    const ck = canonicalKey(k);
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
