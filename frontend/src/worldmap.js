/**
 * WorldMap module using Leaflet.js
 * Paints countries in orange according to a list of country codes.
 * Responsive and fills the card container.
 *
 * Usage: import and call initWorldMap('worldmap-container', ["ES", "FR", ...])
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// You need to provide a GeoJSON file with country polygons
// Example: import countriesGeoJson from './countries.geo.json';
// For demo, you can use a public GeoJSON URL

export function initWorldMap(containerId, activeCountries = []) {
    const map = L.map(containerId, {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 8,
        worldCopyJump: true,
        attributionControl: false,
        zoomControl: false,
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
                style: feature => ({
                    color: '#cccccc',
                    weight: 0.6,
                    fillColor: activeCountries.includes(feature.properties.ISO_A2) ? '#ff9800' : '#d9d9d9',
                    fillOpacity: activeCountries.includes(feature.properties.ISO_A2) ? 0.85 : 1.0,
                }),
                onEachFeature: (feature, layer) => {
                    layer.bindTooltip(feature.properties.ADMIN, {sticky: true});
                }
            }).addTo(map);

            try {
                map.fitBounds(layer.getBounds(), { padding: [10, 10] });
            } catch (e) {
                // Safe guard in case bounds fail
                map.setView([20, 0], 2);
            }
        });

    // Make map responsive
    window.addEventListener('resize', () => {
        map.invalidateSize();
    });
}
