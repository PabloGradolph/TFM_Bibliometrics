/**
 * Dashboard filters bootstrap helpers.
 *
 * Extracted from `frontend/src/dashboard.js` to reduce file size while keeping
 * behavior identical.
 */

/**
 * Load filter options (years, areas, institutions, publication types, quartiles)
 * and trigger the initial visualization refresh.
 *
 * @param {Object} args
 * @param {string} args.lang
 * @param {() => string} args.detectLang
 * @param {(typeKey: string, currentLang: string) => string} args.getPublicationTypeLabel
 * @param {HTMLInputElement} args.yearFrom
 * @param {HTMLInputElement} args.yearTo
 * @param {HTMLSelectElement} args.areaFilter
 * @param {HTMLSelectElement} args.institutionFilter
 * @param {HTMLSelectElement} args.typeFilter
 * @param {HTMLSelectElement|null} args.quartileFilter
 * @param {HTMLInputElement|null} args.citationsFrom
 * @param {HTMLInputElement|null} args.citationsTo
 * @param {() => void} args.updateVisualizations
 * @returns {void}
 */
export function loadDashboardFilterData({
    lang,
    detectLang,
    getPublicationTypeLabel,
    yearFrom,
    yearTo,
    areaFilter,
    institutionFilter,
    typeFilter,
    quartileFilter,
    citationsFrom,
    citationsTo,
    updateVisualizations,
}) {
    fetch(`/BiblioMetrics/${lang}/api/dashboard/filters/`)
        .then((response) => response.json())
        .then((data) => {
            // Set the available year range
            const years = data.years.map((y) => y.year);
            yearFrom.min = Math.min(...years);
            yearFrom.max = Math.max(...years);
            yearTo.min = Math.min(...years);
            yearTo.max = Math.max(...years);

            // Fill the thematic areas filter
            data.areas.forEach((area) => {
                const option = document.createElement('option');
                option.value = area.name;
                option.textContent = `${area.name} (${area.count})`;
                areaFilter.appendChild(option);
            });

            // Fill the institutions filter
            data.institutions.forEach((institution) => {
                const option = document.createElement('option');
                option.value = institution.name;
                option.textContent = `${institution.name} (${institution.count})`;
                institutionFilter.appendChild(option);
            });

            // Fill the publication types filter
            data.publication_types.forEach((type) => {
                const option = document.createElement('option');
                option.value = type.publication_type;
                const currentLang = detectLang();
                const label = getPublicationTypeLabel(type.publication_type, currentLang);
                option.textContent = `${label} (${type.count})`;
                typeFilter.appendChild(option);
            });

            // Fill quartiles (Q1..Q4) with counts
            if (quartileFilter && Array.isArray(data.quartiles)) {
                quartileFilter.innerHTML = '';
                const anyOpt = document.createElement('option');
                anyOpt.value = '';
                const qLang = detectLang();
                anyOpt.textContent = qLang === 'es' ? 'Todos los cuartiles' : 'All quartiles';
                quartileFilter.appendChild(anyOpt);
                data.quartiles.forEach((q) => {
                    const option = document.createElement('option');
                    option.value = q.quartile;
                    option.textContent = `${q.quartile} (${q.count})`;
                    quartileFilter.appendChild(option);
                });
            }

            // Update initial citations range
            if (data.citations_range) {
                const help = document.getElementById('citationsRangeHelp');
                if (help) {
                    const minC = data.citations_range.min || 0;
                    const maxC = data.citations_range.max || 0;
                    const langRange = detectLang();
                    const rangeLabel = langRange === 'es' ? 'Rango disponible' : 'Available range';
                    help.textContent = `${rangeLabel}: ${minC} - ${maxC}`;
                    if (citationsFrom) citationsFrom.placeholder = minC;
                    if (citationsTo) citationsTo.placeholder = maxC;
                }
            }

            // Load initial data
            updateVisualizations();
        })
        .catch((error) => console.error('Error loading filter data:', error));
}
