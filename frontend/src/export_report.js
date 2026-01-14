export function setupExportReportButton() {
    const exportBtn = document.getElementById('exportMetrics');
    if (!exportBtn) return;

    // Detectar idioma por la URL
    // Robust language detection (reuse global helper if present)
    const lang = (typeof detectLangFromPath === 'function')
        ? detectLangFromPath()
        : (function(){
            const parts = window.location.pathname.split('/').filter(Boolean);
            // Accept 'es' explicitly; default to 'en'
            return parts.includes('es') ? 'es' : 'en';
        })();
    const texts = {
        es: {
            title: 'Exportar informe / datos',
            message: 'Seleccione formato y ordenación:',
            continue: 'Exportar',
            cancel: 'Cancelar',
            prompt: 'Elige un formato. ZIP genera un paquete completo.',
            loading: 'Generando exportación...',
            pdf: 'PDF Informe',
            csv: 'CSV Tabla',
            ndjson: 'NDJSON',
            bibtex: 'BibTeX',
            ris: 'RIS',
            gexf: 'GEXF Red',
            network_csv: 'CSV Aristas',
            network_nodes: 'CSV Nodos',
            zip: 'ZIP Todo',
            sections: {
                publications: 'Publicaciones',
                networks: 'Redes',
                bundle: 'Exportación completa'
            },
            descriptions: {
                pdf: 'Informe PDF con gráficos y resúmenes filtrados.',
                csv: 'Tabla completa de publicaciones en formato CSV.',
                ndjson: 'Publicaciones como objetos JSON independientes.',
                bibtex: 'Citas BibTeX listas para gestores de referencias.',
                ris: 'Archivo RIS compatible con gestores bibliográficos.',
                gexf: 'Red de coautorías en formato GEXF para Gephi.',
                network_csv: 'Listado CSV de colaboraciones autor-autor.',
                network_nodes: 'Tabla CSV de nodos con departamento y comunidades.',
                zip: 'Paquete con todos los formatos, incluyendo redes.'
            },
            networkLabel: 'Tipo de red',
            networkPrompt: 'Elige si prefieres la red completa o solo los IPs.',
            networkOptions: {
                ips: 'Red de IPs del IPBLN (investigadores principales)',
                full: 'Red completa de investigadores del IPBLN'
            },
            orderLabel: 'Ordenar por métricas',
            orderField: 'Métrica',
            orderDirection: 'Dirección',
            asc: 'Ascendente',
            desc: 'Descendente',
            metricsPlaceholder: 'Selecciona métrica (opcional)',
            metrics: {
                year: 'Año',
                citations: 'Citas (genérico)',
                dimensions_citations: 'Citas Dimensions',
                wos_citations: 'Citas WoS',
                scopus_citations: 'Citas Scopus',
                fcr: 'FCR',
                rcr: 'RCR',
                international_collab: 'Colaboración internacional'
            }
        },
        en: {
            title: 'Export report / data',
            message: 'Select format and ordering:',
            continue: 'Export',
            cancel: 'Cancel',
            prompt: 'Choose a format. ZIP bundles everything.',
            loading: 'Generating export...',
            pdf: 'PDF Report',
            csv: 'CSV Table',
            ndjson: 'NDJSON',
            bibtex: 'BibTeX',
            ris: 'RIS',
            gexf: 'GEXF Network',
            network_csv: 'CSV Network (edges)',
            network_nodes: 'CSV Network (nodes)',
            zip: 'ZIP All',
            sections: {
                publications: 'Publications',
                networks: 'Networks',
                bundle: 'Full export'
            },
            descriptions: {
                pdf: 'PDF report with charts and filtered summary.',
                csv: 'Full publications table in CSV format.',
                ndjson: 'Each publication as an individual JSON object.',
                bibtex: 'BibTeX citations ready for reference managers.',
                ris: 'RIS file compatible with reference managers.',
                gexf: 'Co-authorship network in GEXF for Gephi.',
                network_csv: 'CSV edge list of collaborations with weights.',
                network_nodes: 'CSV table of nodes with department and community metadata.',
                zip: 'Bundle containing every export format, including networks.'
            },
            networkLabel: 'Network type',
            networkPrompt: 'Choose between the full network or only principal investigators.',
            networkOptions: {
                ips: 'IPBLN PIs network (principal investigators only)',
                full: 'Full IPBLN researcher network'
            },
            orderLabel: 'Order by metrics',
            orderField: 'Metric',
            orderDirection: 'Direction',
            asc: 'Ascending',
            desc: 'Descending',
            metricsPlaceholder: 'Select metric (optional)',
            metrics: {
                year: 'Year',
                citations: 'Citations (generic)',
                dimensions_citations: 'Dimensions citations',
                wos_citations: 'WoS citations',
                scopus_citations: 'Scopus citations',
                fcr: 'FCR',
                rcr: 'RCR',
                international_collab: 'International collaboration'
            }
        }
    };
    const t = texts[lang];
    const defaultFormat = 'pdf';
    const publicationFormats = new Set(['pdf', 'csv', 'ndjson', 'bibtex', 'ris']);
    const networkFormats = new Set(['gexf', 'network_csv', 'network_nodes']);
    const bundleFormats = new Set(['zip']);
    const formatSections = [
        { key: 'publications', label: t.sections.publications, formats: Array.from(publicationFormats) },
        { key: 'networks', label: t.sections.networks, formats: Array.from(networkFormats) },
        { key: 'bundle', label: t.sections.bundle, formats: Array.from(bundleFormats) }
    ];
    const formatDescriptions = t.descriptions || {};
    const metricFields = ['', 'year', 'citations', 'dimensions_citations', 'wos_citations', 'scopus_citations', 'fcr', 'rcr', 'international_collab'];

    const shouldShowMetricControls = (format) => publicationFormats.has(format) || bundleFormats.has(format);
    const shouldShowNetworkControls = (format) => networkFormats.has(format) || bundleFormats.has(format);

    const buildMetricOptions = () => metricFields.map(field => (
        field === ''
            ? `<option value="">${t.metricsPlaceholder}</option>`
            : `<option value="${field}">${t.metrics[field]}</option>`
    )).join('');

    const buildFormatSections = () => formatSections.map(section => `
        <div class="mb-3" data-section="${section.key}">
            <p class="fw-semibold mb-2">${section.label}</p>
            <div class="d-flex flex-wrap gap-2">
                ${section.formats.map(format => `
                    <div>
                        <input type="radio" class="btn-check" name="exportFormat" id="exportFormat_${format}" value="${format}" autocomplete="off" ${format === defaultFormat ? 'checked' : ''}>
                        <label class="btn btn-outline-primary btn-sm" for="exportFormat_${format}">${t[format]}</label>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    const renderModalContent = () => {
        const descriptionText = formatDescriptions[defaultFormat] || t.prompt;
        return `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${t.title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${t.cancel}"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">${t.message}</p>
                        ${buildFormatSections()}
                        <div class="alert alert-info py-2 px-3 small mb-3" id="exportFormatDescription">
                            ${descriptionText}
                        </div>
                        <div class="border rounded p-3 mb-3" data-metric-controls>
                            <h6 class="mb-2">${t.orderLabel}</h6>
                            <div class="row g-2 align-items-end">
                                <div class="col-md-6">
                                    <label class="form-label" for="exportSortField">${t.orderField}</label>
                                    <select class="form-select form-select-sm" id="exportSortField">${buildMetricOptions()}</select>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">${t.orderDirection}</label>
                                    <div class="btn-group w-100" role="group">
                                        <input type="radio" class="btn-check" name="sortDirection" id="sortAsc" value="asc" autocomplete="off">
                                        <label class="btn btn-outline-secondary btn-sm" for="sortAsc">${t.asc}</label>
                                        <input type="radio" class="btn-check" name="sortDirection" id="sortDesc" value="desc" autocomplete="off" checked>
                                        <label class="btn btn-outline-secondary btn-sm" for="sortDesc">${t.desc}</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="border rounded p-3 mb-3 d-none" data-network-controls>
                            <h6 class="mb-2">${t.networkLabel}</h6>
                            <div class="d-flex flex-column gap-2">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="networkScope" id="networkScope_ips" value="ips" checked>
                                    <label class="form-check-label" for="networkScope_ips">${t.networkOptions.ips}</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="networkScope" id="networkScope_full" value="full">
                                    <label class="form-check-label" for="networkScope_full">${t.networkOptions.full}</label>
                                </div>
                            </div>
                            <p class="small text-muted mb-0">${t.networkPrompt}</p>
                        </div>
                        <div class="alert alert-info small mb-0">
                            ${t.prompt}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="confirmExportReport">${t.continue}</button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t.cancel}</button>
                    </div>
                </div>
            </div>
        `;
    };

    let modal = document.getElementById('exportReportModal');

    const toggleConditionalControls = () => {
        if (!modal) return;
        const selected = modal.querySelector('input[name="exportFormat"]:checked');
        const key = selected ? selected.value : defaultFormat;
        const metricEl = modal.querySelector('[data-metric-controls]');
        const networkEl = modal.querySelector('[data-network-controls]');
        if (metricEl) {
            metricEl.classList.toggle('d-none', !shouldShowMetricControls(key));
        }
        if (networkEl) {
            networkEl.classList.toggle('d-none', !shouldShowNetworkControls(key));
        }
    };

    const attachFormatDescriptionHandler = () => {
        if (!modal) return;
        const descriptionEl = modal.querySelector('#exportFormatDescription');
        if (!descriptionEl) return;

        const updateDescription = () => {
            const selected = modal.querySelector('input[name="exportFormat"]:checked');
            const key = selected ? selected.value : defaultFormat;
            descriptionEl.textContent = formatDescriptions[key] || t.prompt;
        };

        const handleFormatChange = () => {
            updateDescription();
            toggleConditionalControls();
        };

        modal.querySelectorAll('input[name="exportFormat"]').forEach(input => {
            input.addEventListener('change', handleFormatChange);
        });

        handleFormatChange();
    };

    const hydrateModal = () => {
        modal.innerHTML = renderModalContent();
        attachFormatDescriptionHandler();
    };

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exportReportModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        hydrateModal();
        document.body.appendChild(modal);
    } else {
        hydrateModal();
    }

    exportBtn.addEventListener('click', function() {
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    });

    // Overlay de carga
    let loadingOverlay = document.getElementById('exportReportLoading');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'exportReportLoading';
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = 0;
        loadingOverlay.style.left = 0;
        loadingOverlay.style.width = '100vw';
        loadingOverlay.style.height = '100vh';
        loadingOverlay.style.background = 'rgba(255,255,255,0.7)';
        loadingOverlay.style.display = 'none';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.alignItems = 'center';
        loadingOverlay.style.zIndex = 2000;
        loadingOverlay.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">${t.loading}</span></div><div style="margin-left: 1rem; font-size: 1.2rem;">${t.loading}</div>`;
        document.body.appendChild(loadingOverlay);
    }

    // Función para convertir SVG a PNG base64 con escala
    function svgToPngBase64(svgElement, width, height, callback, scale = 3) {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        const img = new window.Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = (width || img.width) * scale;
            canvas.height = (height || img.height) * scale;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(scale, 0, 0, scale, 0, 0);
            ctx.drawImage(img, 0, 0);
            const pngBase64 = canvas.toDataURL('image/png');
            callback(pngBase64);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    /**
     * Compress a base64 image data URL by resizing and converting to JPEG.
     * This keeps the PDF export request under Django's upload size limits.
     *
     * @param {string|null} dataUrl
     * @param {{maxWidth?: number, maxHeight?: number, quality?: number}} opts
     * @returns {Promise<string|null>}
     */
    async function compressImageDataUrl(dataUrl, opts = {}) {
        try {
            if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return null;
            const { maxWidth = 1400, maxHeight = 900, quality = 0.75 } = opts;
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            const loaded = new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = (e) => reject(e);
            });
            img.src = dataUrl;
            await loaded;

            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (!w || !h) return dataUrl;

            const ratio = Math.min(1, maxWidth / w, maxHeight / h);
            const outW = Math.max(1, Math.round(w * ratio));
            const outH = Math.max(1, Math.round(h * ratio));
            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outW, outH);
            ctx.drawImage(img, 0, 0, outW, outH);

            // JPEG shrinks payload dramatically vs PNG for map screenshots.
            return canvas.toDataURL('image/jpeg', quality);
        } catch (e) {
            return dataUrl;
        }
    }

    // Evento para el botón de continuar
    modal.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'confirmExportReport') {
            const selectedFormatInput = modal.querySelector('input[name="exportFormat"]:checked');
            const format = selectedFormatInput ? selectedFormatInput.value : defaultFormat;
            const sortFieldEl = modal.querySelector('#exportSortField');
            const sortField = sortFieldEl ? sortFieldEl.value : '';
            const sortOrderInput = modal.querySelector('input[name="sortDirection"]:checked');
            const sortOrder = sortOrderInput ? sortOrderInput.value : 'desc';
            const shouldSendOrdering = shouldShowMetricControls(format);
            const shouldIncludeNetworkScope = shouldShowNetworkControls(format);
            const networkScopeInput = modal.querySelector('input[name="networkScope"]:checked');
            const networkScope = networkScopeInput ? networkScopeInput.value : 'ips';

            const collectFilters = () => {
                const yearFrom = document.getElementById('yearFrom')?.value;
                const yearTo = document.getElementById('yearTo')?.value;
                const citationsFrom = document.getElementById('citationsFrom')?.value;
                const citationsTo = document.getElementById('citationsTo')?.value;
                let areas = [];
                if (window.selectedAreasList && window.selectedAreasList.size > 0) {
                    areas = Array.from(window.selectedAreasList);
                } else {
                    const areaFilter = document.getElementById('areaFilter');
                    if (areaFilter) areas = Array.from(areaFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
                let institutions = [];
                if (window.selectedInstitutionsList && window.selectedInstitutionsList.size > 0) {
                    institutions = Array.from(window.selectedInstitutionsList);
                } else {
                    const institutionFilter = document.getElementById('institutionFilter');
                    if (institutionFilter) institutions = Array.from(institutionFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
                let types = [];
                if (window.selectedTypesList && window.selectedTypesList.size > 0) {
                    types = Array.from(window.selectedTypesList);
                } else {
                    const typeFilter = document.getElementById('typeFilter');
                    if (typeFilter) types = Array.from(typeFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
                let author = null; if (window.selectedAuthorName) author = window.selectedAuthorName;
                let quartiles = []; if (window.selectedQuartilesList && window.selectedQuartilesList.size > 0) quartiles = Array.from(window.selectedQuartilesList);
                const metric_source = window.selectedMetricSource || '';
                return {yearFrom, yearTo, citationsFrom, citationsTo, areas, institutions, types, author, quartiles, metric_source};
            };

            const sendSimpleFormat = (fmt, filename) => {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                modalInstance.hide();
                loadingOverlay.style.display = 'flex';
                const {yearFrom, yearTo, citationsFrom, citationsTo, areas, institutions, types, author, quartiles, metric_source} = collectFilters();
                const formData = new FormData();
                if (yearFrom) formData.append('year_from', yearFrom);
                if (yearTo) formData.append('year_to', yearTo);
                if (citationsFrom) formData.append('citations_from', citationsFrom);
                if (citationsTo) formData.append('citations_to', citationsTo);
                areas.forEach(a => formData.append('areas', a));
                institutions.forEach(i => formData.append('institutions', i));
                types.forEach(t => formData.append('types', t));
                if (author) formData.append('author', author);
                quartiles.forEach(q => formData.append('quartiles', q));
                if (metric_source) formData.append('metric_source', metric_source);
                if (shouldSendOrdering && sortField) formData.append('sort_field', sortField);
                if (shouldSendOrdering && sortOrder) formData.append('sort_order', sortOrder);
                if (shouldIncludeNetworkScope) formData.append('network_scope', networkScope);
                formData.append('format', fmt);
                // Ensure backend generates language-dependent formats (PDF) in the current UI language.
                // It's harmless for language-agnostic formats.
                formData.append('lang', lang);

                const apiExportUrl = `/BiblioMetrics/${lang}/api/export/report/`;
                fetch(apiExportUrl, { method: 'POST', body: formData })
                  .then(resp => { if (!resp.ok) throw new Error('Generation failed'); return resp.blob(); })
                  .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                  })
                  .catch(() => {
                      alert(lang === 'es' ? 'Error en la exportación' : 'Error generating export');
                  })
                  .finally(() => { loadingOverlay.style.display = 'none'; });
            };

            // Simple formats that do not need chart images
            if (['csv','ndjson','bibtex','ris','gexf','network_csv','network_nodes','zip'].includes(format)) {
                const fnMap = {
                    csv: 'Bibliometria_IPBLN_Publicaciones.csv',
                    ndjson: 'Bibliometria_IPBLN_Publicaciones.ndjson',
                    bibtex: 'Bibliometria_IPBLN_Publicaciones.bib',
                    ris: 'Bibliometria_IPBLN_Publicaciones.ris',
                    gexf: 'Bibliometria_IPBLN_CoauthorNetwork.gexf',
                    network_csv: 'Bibliometria_IPBLN_CoauthorEdges.csv',
                    network_nodes: 'Bibliometria_IPBLN_CoauthorNodes.csv',
                    zip: 'Bibliometria_IPBLN_ExportBundle.zip'
                };
                sendSimpleFormat(format, fnMap[format]);
                return;
            }
            if (format !== 'pdf') {
                return;
            }
            const modalInstance = bootstrap.Modal.getInstance(modal);
            modalInstance.hide();
            loadingOverlay.style.display = 'flex';

            // Recoger filtros actuales del dashboard
            const yearFrom = document.getElementById('yearFrom')?.value;
            const yearTo = document.getElementById('yearTo')?.value;
            const citationsFrom = document.getElementById('citationsFrom')?.value;
            const citationsTo = document.getElementById('citationsTo')?.value;
            let areas = [];
            if (window.selectedAreasList && window.selectedAreasList.size > 0) {
                areas = Array.from(window.selectedAreasList);
            } else {
                const areaFilter = document.getElementById('areaFilter');
                if (areaFilter) {
                    areas = Array.from(areaFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
            }
            let institutions = [];
            if (window.selectedInstitutionsList && window.selectedInstitutionsList.size > 0) {
                institutions = Array.from(window.selectedInstitutionsList);
            } else {
                const institutionFilter = document.getElementById('institutionFilter');
                if (institutionFilter) {
                    institutions = Array.from(institutionFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
            }
            let types = [];
            if (window.selectedTypesList && window.selectedTypesList.size > 0) {
                types = Array.from(window.selectedTypesList);
            } else {
                const typeFilter = document.getElementById('typeFilter');
                if (typeFilter) {
                    types = Array.from(typeFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
            }
            let author = null;
            if (window.selectedAuthorName) {
                author = window.selectedAuthorName;
            }
            // Nuevos filtros: cuartiles y fuente
            let quartiles = [];
            if (window.selectedQuartilesList && window.selectedQuartilesList.size > 0) {
                quartiles = Array.from(window.selectedQuartilesList);
            }
            const metric_source = window.selectedMetricSource || '';

            // Recoger los SVG de los gráficos
            const timelineSVG = document.querySelector('#timelineChart svg');
            const pieSVG = document.querySelector('#areasChart svg');
            // Para el bar chart, si está activo, es el mismo div que pie pero con otro SVG
            let barSVG = null;
            if (pieSVG && pieSVG.parentElement) {
                // Si hay más de un SVG en #areasChart, el segundo es el bar
                const svgs = document.querySelectorAll('#areasChart svg');
                if (svgs.length > 1) {
                    barSVG = svgs[1];
                } else if (document.querySelector('[data-areas-view="bar"]')?.classList.contains('active')) {
                    barSVG = pieSVG;
                }
            }

            // Si solo hay un SVG, lo usamos para ambos (pie/bar) según el botón activo
            if (!barSVG) {
                if (document.querySelector('[data-areas-view="bar"]')?.classList.contains('active')) {
                    barSVG = pieSVG;
                }
            }

            // LOG para depuración
            console.log('SVGs encontrados:', {
                timelineSVG: !!timelineSVG,
                pieSVG: !!pieSVG,
                barSVG: !!barSVG
            });

            // Detectar la vista activa de áreas
            let areas_view = 'pie';
            if (document.querySelector('[data-areas-view="bar"]')?.classList.contains('active')) {
                areas_view = 'bar';
            }

            // Detectar el idioma de la URL para la API
            const apiExportUrl = `/BiblioMetrics/${lang}/api/export/report/`;

            // Convertir SVGs a PNG base64 (async)
            let imagesReady = 0;
            const images = { timeline: null, pie: null, bar: null, collab_map_world: null, collab_map_spain: null };
            const checkAndSend = () => {
                if (imagesReady === 4) {
                    // LOG para depuración
                    console.log('Imágenes base64 generadas:', images);
                    // Enviar al backend
                    const formData = new FormData();
                    if (yearFrom) formData.append('year_from', yearFrom);
                    if (yearTo) formData.append('year_to', yearTo);
                    if (citationsFrom) formData.append('citations_from', citationsFrom);
                    if (citationsTo) formData.append('citations_to', citationsTo);
                    areas.forEach(area => formData.append('areas', area));
                    institutions.forEach(inst => formData.append('institutions', inst));
                    types.forEach(type => formData.append('types', type));
                    if (author) formData.append('author', author);
                    quartiles.forEach(q => formData.append('quartiles', q));
                    if (metric_source) formData.append('metric_source', metric_source);
                    if (sortField) formData.append('sort_field', sortField);
                    if (sortOrder) formData.append('sort_order', sortOrder);
                    formData.append('format', 'pdf');
                    // Explicitly send current UI language for i18n in the PDF.
                    formData.append('lang', lang);
                    formData.append('areas_view', areas_view);
                    if (images.timeline) formData.append('timeline_img', images.timeline);
                    if (images.pie) formData.append('pie_img', images.pie);
                    if (images.bar) formData.append('bar_img', images.bar);
                    if (images.collab_map_world) formData.append('collab_map_world_img', images.collab_map_world);
                    if (images.collab_map_spain) formData.append('collab_map_spain_img', images.collab_map_spain);

                    // Añadir el nombre del HTML de la red de palabras clave si corresponde
                    if (
                        (window.currentCommunityView === 'keywords' || (typeof currentCommunityView !== 'undefined' && currentCommunityView === 'keywords')) &&
                        (window.currentClusteringModel || typeof currentClusteringModel !== 'undefined') &&
                        (window.currentNClusters || typeof currentNClusters !== 'undefined')
                    ) {
                        const model = window.currentClusteringModel || currentClusteringModel;
                        const nClusters = window.currentNClusters || currentNClusters;
                        if (model && nClusters) {
                            const modelSlug = model.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const htmlName = `${modelSlug}_k${nClusters}.html`;
                            console.log('Enviando network_html:', htmlName);
                            formData.append('network_html', htmlName);
                        }
                    }

                    fetch(apiExportUrl, {
                        method: 'POST',
                        body: formData
                    })
                    .then(response => {
                        if (!response.ok) throw new Error('Error al generar el informe');
                        return response.blob();
                    })
                    .then(blob => {
                        // Descargar el PDF
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Bibliometria_IPBLN_Informe.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                    })
                    .catch(err => {
                        alert(lang === 'es' ? 'Error al generar el informe' : 'Error generating report');
                    })
                    .finally(() => {
                        loadingOverlay.style.display = 'none';
                    });
                }
            };

            // Timeline
            if (timelineSVG) {
                svgToPngBase64(timelineSVG, timelineSVG.clientWidth, timelineSVG.clientHeight, (b64) => {
                    images.timeline = b64;
                    imagesReady++;
                    checkAndSend();
                }, 3);
            } else {
                imagesReady++;
                checkAndSend();
            }
            // Pie
            if (pieSVG) {
                svgToPngBase64(pieSVG, pieSVG.clientWidth, pieSVG.clientHeight, (b64) => {
                    images.pie = b64;
                    imagesReady++;
                    checkAndSend();
                }, 3);
            } else {
                imagesReady++;
                checkAndSend();
            }
            // Bar
            if (barSVG) {
                svgToPngBase64(barSVG, barSVG.clientWidth, barSVG.clientHeight, (b64) => {
                    images.bar = b64;
                    imagesReady++;
                    checkAndSend();
                }, 3);
            } else {
                imagesReady++;
                checkAndSend();
            }

            // Collaboration map (world/spain depending on active map view)
            (async () => {
                try {
                    const currentMapView = (typeof window !== 'undefined' && window.currentMapView) ? window.currentMapView : 'world';
                    if (currentMapView === 'spain') {
                        if (typeof window !== 'undefined' && typeof window.__exportSpainMapImageBase64 === 'function') {
                            const raw = await window.__exportSpainMapImageBase64();
                            images.collab_map_spain = await compressImageDataUrl(raw, { maxWidth: 1300, maxHeight: 850, quality: 0.72 });
                        }
                    } else {
                        if (typeof window !== 'undefined' && typeof window.__exportWorldMapImageBase64 === 'function') {
                            const raw = await window.__exportWorldMapImageBase64();
                            images.collab_map_world = await compressImageDataUrl(raw, { maxWidth: 1300, maxHeight: 850, quality: 0.72 });
                        }
                    }
                } catch (e) {
                    // ignore capture errors; report can still be generated
                } finally {
                    imagesReady++;
                    checkAndSend();
                }
            })();
        }
    });
} 