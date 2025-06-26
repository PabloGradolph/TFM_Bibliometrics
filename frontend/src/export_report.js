export function setupExportReportButton() {
    const exportBtn = document.getElementById('exportMetrics');
    if (!exportBtn) return;

    // Detectar idioma por la URL
    const lang = window.location.pathname.split('/')[1] === 'es' ? 'es' : 'en';
    const texts = {
        es: {
            title: 'Exportar informe',
            message: 'Se va a descargar un informe en PDF con la información filtrada actualmente.',
            continue: 'Continuar',
            cancel: 'Cancelar',
            prompt: 'Pulse para continuar.'
        },
        en: {
            title: 'Export report',
            message: 'A PDF report with the currently filtered information will be downloaded.',
            continue: 'Continue',
            cancel: 'Cancel',
            prompt: 'Click to continue.'
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
        modal.querySelector('.modal-body').innerHTML = `<p>${t.message}</p><p>${t.prompt}</p>`;
        modal.querySelector('#confirmExportReport').textContent = t.continue;
        modal.querySelector('.btn-secondary').textContent = t.cancel;
    }

    exportBtn.addEventListener('click', function() {
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    });

    // Evento para el botón de continuar (aquí irá la lógica de exportación real más adelante)
    modal.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'confirmExportReport') {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            modalInstance.hide();
            alert(lang === 'es' ? 'Funcionalidad de exportación próximamente...' : 'Export functionality coming soon...');
        }
    });
} 