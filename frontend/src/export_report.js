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
            // Áreas seleccionadas (badges)
            let areas = [];
            if (window.selectedAreasList) {
                areas = Array.from(window.selectedAreasList);
            } else {
                const areaFilter = document.getElementById('areaFilter');
                if (areaFilter) {
                    areas = Array.from(areaFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
            }
            let institutions = [];
            if (window.selectedInstitutionsList) {
                institutions = Array.from(window.selectedInstitutionsList);
            } else {
                const institutionFilter = document.getElementById('institutionFilter');
                if (institutionFilter) {
                    institutions = Array.from(institutionFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
            }
            let types = [];
            if (window.selectedTypesList) {
                types = Array.from(window.selectedTypesList);
            } else {
                const typeFilter = document.getElementById('typeFilter');
                if (typeFilter) {
                    types = Array.from(typeFilter.selectedOptions).map(opt => opt.value).filter(v => v);
                }
            }
            // Autor seleccionado
            let author = null;
            if (window.selectedAuthorName) {
                author = window.selectedAuthorName;
            }

            const params = new URLSearchParams();
            if (yearFrom) params.append('year_from', yearFrom);
            if (yearTo) params.append('year_to', yearTo);
            areas.forEach(area => params.append('areas', area));
            institutions.forEach(inst => params.append('institutions', inst));
            types.forEach(type => params.append('types', type));
            if (author) params.append('author', author);
            params.append('format', 'pdf');

            fetch(`/api/export/report/?${params.toString()}`, {
                method: 'GET',
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
                a.download = `informe.pdf`;
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
    });
} 