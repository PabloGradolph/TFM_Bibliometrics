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
            network_csv: 'CSV Red',
            zip: 'ZIP Todo',
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
            network_csv: 'CSV Network',
            zip: 'ZIP All',
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

    // Crear el modal si no existe
    let modal = document.getElementById('exportReportModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exportReportModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        // Build metric options HTML
        const metricOptions = ['','year','citations','dimensions_citations','wos_citations','scopus_citations','fcr','rcr','international_collab']
            .map(m => m === '' ? `<option value="">${t.metricsPlaceholder}</option>` : `<option value="${m}">${t.metrics[m]}</option>`)
            .join('');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${t.title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-2">${t.message}</p>
                        <div class="row g-2 mb-3">
                            <div class="col-12">
                                <div class="d-flex flex-wrap gap-2" id="exportFormatGroup">
                                    ${[['pdf',t.pdf],['csv',t.csv],['ndjson',t.ndjson],['bibtex',t.bibtex],['ris',t.ris],['gexf',t.gexf],['network_csv',t.network_csv],['zip',t.zip]]
                                        .map(([val,label]) => `
                                        <div>
                                          <input type="radio" class="btn-check" name="exportFormat" id="exportFormat_${val}" value="${val}" autocomplete="off" ${val==='pdf'?'checked':''}>
                                          <label class="btn btn-outline-primary btn-sm" for="exportFormat_${val}">${label}</label>
                                        </div>`).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="border rounded p-2 mb-3">
                          <div class="row g-2 align-items-end">
                            <div class="col-md-6">
                              <label class="form-label">${t.orderField}</label>
                              <select class="form-select form-select-sm" id="exportSortField">${metricOptions}</select>
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
                        <p class="small text-muted">${t.prompt}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="confirmExportReport">${t.continue}</button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t.cancel}</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    } else {
        // Rebuild body (simpler: remove then recreate for language switch)
        const oldDialog = modal.querySelector('.modal-dialog');
        if (oldDialog) oldDialog.remove();
        const metricOptions = ['','year','citations','dimensions_citations','wos_citations','scopus_citations','fcr','rcr','international_collab']
            .map(m => m === '' ? `<option value="">${t.metricsPlaceholder}</option>` : `<option value="${m}">${t.metrics[m]}</option>`)
            .join('');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${t.title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-2">${t.message}</p>
                        <div class="row g-2 mb-3">
                            <div class="col-12">
                                <div class="d-flex flex-wrap gap-2" id="exportFormatGroup">
                                    ${[['pdf',t.pdf],['csv',t.csv],['ndjson',t.ndjson],['bibtex',t.bibtex],['ris',t.ris],['gexf',t.gexf],['network_csv',t.network_csv],['zip',t.zip]]
                                        .map(([val,label]) => `
                                        <div>
                                          <input type="radio" class="btn-check" name="exportFormat" id="exportFormat_${val}" value="${val}" autocomplete="off" ${val==='pdf'?'checked':''}>
                                          <label class="btn btn-outline-primary btn-sm" for="exportFormat_${val}">${label}</label>
                                        </div>`).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="border rounded p-2 mb-3">
                          <div class="row g-2 align-items-end">
                            <div class="col-md-6">
                              <label class="form-label">${t.orderField}</label>
                              <select class="form-select form-select-sm" id="exportSortField">${metricOptions}</select>
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
                        <p class="small text-muted">${t.prompt}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="confirmExportReport">${t.continue}</button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t.cancel}</button>
                    </div>
                </div>
            </div>`;
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

    // Evento para el botón de continuar
    modal.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'confirmExportReport') {
            const format = document.querySelector('input[name="exportFormat"]:checked').value;
            const sortField = document.getElementById('exportSortField')?.value || '';
            const sortOrder = document.querySelector('input[name="sortDirection"]:checked')?.value || 'desc';

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
                if (sortField) formData.append('sort_field', sortField);
                if (sortOrder) formData.append('sort_order', sortOrder);
                formData.append('format', fmt);

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
            if (['csv','ndjson','bibtex','ris','gexf','network_csv','zip'].includes(format)) {
                const fnMap = {
                    csv: 'Bibliometria_IPBLN_Publicaciones.csv',
                    ndjson: 'Bibliometria_IPBLN_Publicaciones.ndjson',
                    bibtex: 'Bibliometria_IPBLN_Publicaciones.bib',
                    ris: 'Bibliometria_IPBLN_Publicaciones.ris',
                    gexf: 'Bibliometria_IPBLN_CoauthorNetwork.gexf',
                    network_csv: 'Bibliometria_IPBLN_CoauthorEdges.csv',
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
            const images = { timeline: null, pie: null, bar: null };
            const checkAndSend = () => {
                if (imagesReady === 3) {
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
                    formData.append('areas_view', areas_view);
                    if (images.timeline) formData.append('timeline_img', images.timeline);
                    if (images.pie) formData.append('pie_img', images.pie);
                    if (images.bar) formData.append('bar_img', images.bar);

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
        }
    });
} 