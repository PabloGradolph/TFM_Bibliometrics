// Función para seleccionar un autor
function selectAuthor(authorName) {
    selectedAuthorName = authorName;
    standardSearch.value = '';
    standardSearch.disabled = true;
    searchSuggestions.style.display = 'none';
    authorLimitMessage.style.display = 'block';
    updateSearchButton();

    // Crear el badge del autor seleccionado
    selectedAuthor.innerHTML = `
        <span class="badge bg-primary me-2 mb-2">
            ${authorName}
            <button type="button" class="btn-close btn-close-white ms-1" 
                    style="font-size: 0.5rem; vertical-align: middle;"
                    aria-label="Remove"></button>
        </span>
    `;

    // Añadir evento para eliminar el autor
    selectedAuthor.querySelector('.btn-close').addEventListener('click', () => {
        selectedAuthorName = null;
        selectedAuthor.innerHTML = '';
        standardSearch.disabled = false;
        authorLimitMessage.style.display = 'none';
        updateSearchButton();
        
        // Eliminar la card de métricas del autor del DOM
        const authorMetricsCard = document.getElementById('authorMetricsCard');
        if (authorMetricsCard) {
            authorMetricsCard.remove();
        }
        
        // Ajustar la columna de la red de colaboración
        const networkCol = document.getElementById('networkCol');
        if (networkCol) {
            networkCol.className = 'col-12';
        }
        
        updateVisualizations(); // Actualizar gráficos al eliminar el autor
    });

    // Crear y añadir la card de métricas del autor al DOM
    const collaborationRow = document.getElementById('collaborationRow');
    const authorMetricsCard = document.createElement('div');
    authorMetricsCard.id = 'authorMetricsCard';
    authorMetricsCard.className = 'col-md-6';
    authorMetricsCard.innerHTML = `
        <div class="card dashboard-card h-100">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="card-title mb-0">{% trans "Author Metrics Summary" %}</h5>
                </div>
                <div id="authorMetricsContent">
                    <!-- El contenido se actualizará dinámicamente -->
                </div>
            </div>
        </div>
    `;
    collaborationRow.appendChild(authorMetricsCard);

    // Ajustar la columna de la red de colaboración
    const networkCol = document.getElementById('networkCol');
    if (networkCol) {
        networkCol.className = 'col-12 col-md-6';
    }

    // Actualizar los gráficos con el autor seleccionado
    updateVisualizations();
} 