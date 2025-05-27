document.addEventListener('DOMContentLoaded', function() {
    // Referencias a los elementos del DOM
    const yearFrom = document.getElementById('yearFrom');
    const yearTo = document.getElementById('yearTo');
    const areaFilter = document.getElementById('areaFilter');
    const institutionFilter = document.getElementById('institutionFilter');
    const typeFilter = document.getElementById('typeFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const selectedAreas = document.getElementById('selectedAreas');
    const selectedInstitutions = document.getElementById('selectedInstitutions');
    const selectedTypes = document.getElementById('selectedTypes');

    // Almacenar las selecciones
    let selectedAreasList = new Set();
    let selectedInstitutionsList = new Set();
    let selectedTypesList = new Set();

    // Cargar los datos de los filtros
    loadFilterData();

    // Función para cargar los datos de los filtros
    function loadFilterData() {
        fetch('/api/dashboard/filters/')
            .then(response => response.json())
            .then(data => {
                // Establecer el rango de años disponible
                const years = data.years.map(y => y.year);
                yearFrom.min = Math.min(...years);
                yearFrom.max = Math.max(...years);
                yearTo.min = Math.min(...years);
                yearTo.max = Math.max(...years);

                // Llenar el filtro de áreas temáticas
                data.areas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area.name;
                    option.textContent = `${area.name} (${area.count})`;
                    areaFilter.appendChild(option);
                });

                // Llenar el filtro de instituciones
                data.institutions.forEach(institution => {
                    const option = document.createElement('option');
                    option.value = institution.name;
                    option.textContent = `${institution.name} (${institution.count})`;
                    institutionFilter.appendChild(option);
                });

                // Llenar el filtro de tipos de publicación
                data.publication_types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.publication_type;
                    option.textContent = `${type.publication_type} (${type.count})`;
                    typeFilter.appendChild(option);
                });

                // Cargar datos iniciales
                updateVisualizations();
            })
            .catch(error => console.error('Error loading filter data:', error));
    }

    // Función para crear un badge con botón de eliminar
    function createBadge(value, container, set) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary me-2 mb-2';
        badge.innerHTML = `
            ${value}
            <button type="button" class="btn-close btn-close-white ms-1" 
                    style="font-size: 0.5rem; vertical-align: middle;"
                    aria-label="Remove"></button>
        `;
        
        badge.querySelector('.btn-close').addEventListener('click', () => {
            set.delete(value);
            badge.remove();
            updateVisualizations();
        });
        
        container.appendChild(badge);
    }

    // Función para limpiar todos los filtros
    function clearFilters() {
        yearFrom.value = '';
        yearTo.value = '';
        selectedAreasList.clear();
        selectedInstitutionsList.clear();
        selectedTypesList.clear();
        selectedAreas.innerHTML = '';
        selectedInstitutions.innerHTML = '';
        selectedTypes.innerHTML = '';
        updateVisualizations();
    }

    // Función para actualizar las visualizaciones basadas en los filtros
    function updateVisualizations() {
        const filters = {
            year_from: yearFrom.value,
            year_to: yearTo.value,
            areas: Array.from(selectedAreasList),
            institutions: Array.from(selectedInstitutionsList),
            types: Array.from(selectedTypesList)
        };

        // Construir la URL con los parámetros de filtrado
        const params = new URLSearchParams();
        if (filters.year_from) params.append('year_from', filters.year_from);
        if (filters.year_to) params.append('year_to', filters.year_to);
        filters.areas.forEach(area => params.append('areas', area));
        filters.institutions.forEach(institution => params.append('institutions', institution));
        filters.types.forEach(type => params.append('types', type));

        // Obtener los datos filtrados
        fetch(`/api/dashboard/data/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                // Actualizar la línea de tiempo
                updateTimeline(data.timeline);
                
                // Actualizar el gráfico de áreas
                updateAreasChart(data.areas);
                
                // Actualizar el gráfico de instituciones
                updateInstitutionsChart(data.institutions);
                
                // Actualizar el gráfico de tipos
                updateTypesChart(data.types);
            })
            .catch(error => console.error('Error updating visualizations:', error));
    }

    // Funciones para actualizar cada visualización
    function updateTimeline(data) {
        // TODO: Implementar la actualización del gráfico de línea de tiempo
        console.log('Timeline data:', data);
    }

    function updateAreasChart(data) {
        // TODO: Implementar la actualización del gráfico de áreas
        console.log('Areas data:', data);
    }

    function updateInstitutionsChart(data) {
        // TODO: Implementar la actualización del gráfico de instituciones
        console.log('Institutions data:', data);
    }

    function updateTypesChart(data) {
        // TODO: Implementar la actualización del gráfico de tipos
        console.log('Types data:', data);
    }

    // Event listeners para los filtros
    areaFilter.addEventListener('change', function() {
        if (this.value && !selectedAreasList.has(this.value)) {
            selectedAreasList.add(this.value);
            createBadge(this.value, selectedAreas, selectedAreasList);
            updateVisualizations();
        }
        this.value = ''; // Reset select
    });

    institutionFilter.addEventListener('change', function() {
        if (this.value && !selectedInstitutionsList.has(this.value)) {
            selectedInstitutionsList.add(this.value);
            createBadge(this.value, selectedInstitutions, selectedInstitutionsList);
            updateVisualizations();
        }
        this.value = ''; // Reset select
    });

    typeFilter.addEventListener('change', function() {
        if (this.value && !selectedTypesList.has(this.value)) {
            selectedTypesList.add(this.value);
            createBadge(this.value, selectedTypes, selectedTypesList);
            updateVisualizations();
        }
        this.value = ''; // Reset select
    });

    yearFrom.addEventListener('change', updateVisualizations);
    yearTo.addEventListener('change', updateVisualizations);
    clearFiltersBtn.addEventListener('click', clearFilters);
}); 