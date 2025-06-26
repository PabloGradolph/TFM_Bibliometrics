export function setupExportReportButton() {
    const exportBtn = document.getElementById('exportMetrics');
    if (!exportBtn) return;

    // Detectar idioma por la URL
    const lang = window.location.pathname.split('/')[1] === 'es' ? 'es' : 'en';
    const texts = {
        es: {
            title: 'Exportar informe',
            message: 'Seleccione el formato de exportación:',
            continue: 'Continuar',
            cancel: 'Cancelar',
            prompt: 'Pulse para continuar.',
            loading: 'Generando informe...',
            pdf: 'PDF',
            html: 'HTML (próximamente...)',
            csv: 'CSV (próximamente...)',
            soon: 'Próximamente...'
        },
        en: {
            title: 'Export report',
            message: 'Select export format:',
            continue: 'Continue',
            cancel: 'Cancel',
            prompt: 'Click to continue.',
            loading: 'Generating report...',
            pdf: 'PDF',
            html: 'HTML (coming soon...)',
            csv: 'CSV (coming soon...)',
            soon: 'Coming soon...'
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
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${t.title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>${t.message}</p>
                        <div class="btn-group w-100 mb-3" role="group" aria-label="Export format">
                            <input type="radio" class="btn-check" name="exportFormat" id="exportFormatPDF" value="pdf" autocomplete="off" checked>
                            <label class="btn btn-outline-primary" for="exportFormatPDF">${t.pdf}</label>
                            <input type="radio" class="btn-check" name="exportFormat" id="exportFormatHTML" value="html" autocomplete="off" disabled>
                            <label class="btn btn-outline-secondary disabled" for="exportFormatHTML">${t.html}</label>
                            <input type="radio" class="btn-check" name="exportFormat" id="exportFormatCSV" value="csv" autocomplete="off" disabled>
                            <label class="btn btn-outline-secondary disabled" for="exportFormatCSV">${t.csv}</label>
                        </div>
                        <p>${t.prompt}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="confirmExportReport">${t.continue}</button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t.cancel}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        // Si ya existe, actualiza los textos por si cambia el idioma
        modal.querySelector('.modal-title').textContent = t.title;
        modal.querySelector('.modal-body').innerHTML = `
            <p>${t.message}</p>
            <div class="btn-group w-100 mb-3" role="group" aria-label="Export format">
                <input type="radio" class="btn-check" name="exportFormat" id="exportFormatPDF" value="pdf" autocomplete="off" checked>
                <label class="btn btn-outline-primary" for="exportFormatPDF">${t.pdf}</label>
                <input type="radio" class="btn-check" name="exportFormat" id="exportFormatHTML" value="html" autocomplete="off" disabled>
                <label class="btn btn-outline-secondary disabled" for="exportFormatHTML">${t.html}</label>
                <input type="radio" class="btn-check" name="exportFormat" id="exportFormatCSV" value="csv" autocomplete="off" disabled>
                <label class="btn btn-outline-secondary disabled" for="exportFormatCSV">${t.csv}</label>
            </div>
            <p>${t.prompt}</p>
        `;
        modal.querySelector('#confirmExportReport').textContent = t.continue;
        modal.querySelector('.btn-secondary').textContent = t.cancel;
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
            if (format !== 'pdf') {
                // No hacer nada para HTML/CSV
                return;
            }
            const modalInstance = bootstrap.Modal.getInstance(modal);
            modalInstance.hide();
            loadingOverlay.style.display = 'flex';

            // Recoger filtros actuales del dashboard
            const yearFrom = document.getElementById('yearFrom')?.value;
            const yearTo = document.getElementById('yearTo')?.value;
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
            const apiExportUrl = `/${lang}/api/export/report/`;

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
                    areas.forEach(area => formData.append('areas', area));
                    institutions.forEach(inst => formData.append('institutions', inst));
                    types.forEach(type => formData.append('types', type));
                    if (author) formData.append('author', author);
                    formData.append('format', 'pdf');
                    formData.append('areas_view', areas_view);
                    if (images.timeline) formData.append('timeline_img', images.timeline);
                    if (images.pie) formData.append('pie_img', images.pie);
                    if (images.bar) formData.append('bar_img', images.bar);

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