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
  maxCount: 0,
  containerId: null,
  loadingEl: null,
  activeLevel: 'ccaa', // 'ccaa' | 'prov'
};

function normKey(s) {
  if (!s || typeof s !== 'string') return '';
  const nfkd = s.normalize('NFKD');
  const ascii = nfkd.replace(/[\u0300-\u036f]/g, '');
  return ascii.replace(/[‐‑‒–—―\-_/]+/g,' ').replace(/[^A-Za-zÀ-ÿ ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}

function styleFor(name, level) {
  const key = normKey(name);
  const count = level === 'ccaa' ? (registry.countsCCAA[key] || 0) : (registry.countsProv[key] || 0);
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
    color: isActive ? '#b34700' : '#bbbbbb',
    weight: isActive ? 1.0 : 0.5,
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
  const container = document.getElementById(containerId);
  if (container) {
    container.style.background = '#ffffff';
    container.style.position = 'relative';
    if (!container.style.height || container.style.height === '0px') container.style.height = '360px';
    const overlay = document.createElement('div');
    overlay.className = 'spainmap-loading-overlay';
    overlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.8);z-index:500;`;
    overlay.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>`;
    container.appendChild(overlay);
    registry.loadingEl = overlay;
  }

  const map = L.map(containerId, {
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

  // Load CCAA and Provinces GeoJSON from public URLs (can be replaced with local files)
  Promise.all([
    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/spain-autonomous-communities.geojson').then(r=>r.json()),
    fetch('https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/spain-provinces.geojson').then(r=>r.json())
  ]).then(([ccaa, prov]) => {
    const layerCCAA = L.geoJSON(ccaa, {
      style: f => styleFor(f.properties && (f.properties.name || f.properties.NAME || ''), 'ccaa'),
      onEachFeature: (f, lyr) => {
        const name = (f.properties && (f.properties.name || f.properties.NAME)) || 'Unknown';
        lyr.bindTooltip(() => {
          const key = normKey(name);
          const count = registry.countsCCAA[key] || 0;
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
          const key = normKey(name);
          const count = registry.countsProv[key] || 0;
          const pubsLabel = 'publicaciones';
          return count > 0 ? `${name}: ${count} ${pubsLabel}` : `${name}`;
        }, { sticky: true });
      }
    });

    // By default show CCAA; provinces can be toggled externally
    registry.layerCCAA = layerCCAA;
    registry.layerProv = layerProv;
    registry.map = map;

    try { map.fitBounds(layerCCAA.getBounds(), { padding: [10, 10] }); } catch (e) { map.setView([40.0,-3.7], 5); }

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
  // compute maxCount across both
  registry.maxCount = 0;
  for (const v of Object.values(registry.countsCCAA)) if (typeof v === 'number' && v > registry.maxCount) registry.maxCount = v;
  for (const v of Object.values(registry.countsProv)) if (typeof v === 'number' && v > registry.maxCount) registry.maxCount = v;
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
  if (layer) layer.addTo(registry.map);
}

export function setSpainMapLoading(visible) {
  if (registry.loadingEl) registry.loadingEl.style.display = visible ? 'flex' : 'none';
}
