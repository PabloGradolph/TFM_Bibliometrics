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
        
        // Limitar el texto a 40 caracteres
        const displayText = value.length > 40 ? value.substring(0, 40) + '...' : value;
        
        badge.innerHTML = `
            ${displayText}
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

        // Determinar si se puede usar la vista mensual
        const canUseMonthly = filters.year_from && filters.year_to && filters.year_from === filters.year_to;
        const monthlyBtn = document.querySelector('[data-view="monthly"]');
        const yearlyBtn = document.querySelector('[data-view="yearly"]');
        
        // Actualizar estado de los botones
        monthlyBtn.disabled = !canUseMonthly;
        if (!canUseMonthly) {
            // Si no se puede usar mensual, forzar vista anual
            monthlyBtn.classList.remove('active');
            yearlyBtn.classList.add('active');
            filters.view_type = 'yearly';
        } else {
            // Si se puede usar mensual, usar el botón activo
            filters.view_type = monthlyBtn.classList.contains('active') ? 'monthly' : 'yearly';
        }

        // Construir la URL con los parámetros de filtrado
        const params = new URLSearchParams();
        if (filters.year_from) params.append('year_from', filters.year_from);
        if (filters.year_to) params.append('year_to', filters.year_to);
        filters.areas.forEach(area => params.append('areas', area));
        filters.institutions.forEach(institution => params.append('institutions', institution));
        filters.types.forEach(type => params.append('types', type));
        params.append('view_type', filters.view_type);

        // Obtener los datos filtrados
        fetch(`/api/dashboard/data/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                // Actualizar la línea de tiempo
                updateTimeline(data.timeline, filters.view_type);
                
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
    function updateTimeline(data, viewType) {
        // Limpiar el contenedor
        d3.select('#timelineChart').html('');

        // Configuración del gráfico
        const margin = {top: 20, right: 20, bottom: 70, left: 60};
        const width = document.getElementById('timelineChart').clientWidth - margin.left - margin.right;
        const height = 260 - margin.top - margin.bottom;

        // Crear el SVG
        const svg = d3.select('#timelineChart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('display', 'block')
            .style('margin', '0 auto')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Escalas
        let x;
        if (viewType === 'monthly') {
            // Escala para meses
            x = d3.scaleLinear()
                .domain([1, 12])
                .range([0, width]);
        } else {
            // Escala para años
            x = d3.scaleLinear()
                .domain(d3.extent(data, d => d.year))
                .range([0, width]);
        }

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .nice()
            .range([height, 0]);

        // Ejes
        let xAxis;
        if (viewType === 'monthly') {
            xAxis = d3.axisBottom(x)
                .ticks(12)
                .tickFormat(d => {
                    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    return months[d - 1];
                });
        } else {
            xAxis = d3.axisBottom(x)
                .ticks(width / 80)
                .tickFormat(d3.format('d'));
        }

        const yAxis = d3.axisLeft(y)
            .ticks(height / 40);

        // Añadir ejes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'middle');

        svg.append('g')
            .call(yAxis);

        // Línea
        const line = d3.line()
            .x(d => viewType === 'monthly' ? x(d.month) : x(d.year))
            .y(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Área
        const area = d3.area()
            .x(d => viewType === 'monthly' ? x(d.month) : x(d.year))
            .y0(height)
            .y1(d => y(d.count))
            .curve(d3.curveMonotoneX);

        // Añadir área
        svg.append('path')
            .datum(data)
            .attr('fill', '#e3f2fd')
            .attr('d', area);

        // Añadir línea
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', '#2196f3')
            .attr('stroke-width', 2)
            .attr('d', line);

        // Tooltip
        const tooltip = d3.select('#timelineChart')
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background-color', 'rgba(255,255,255,0.95)')
            .style('border', '1px solid #2196f3')
            .style('border-radius', '4px')
            .style('padding', '6px 10px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');

        // Info box para el clic
        const infoBox = d3.select('#timelineChart')
            .append('div')
            .attr('class', 'info-box')
            .style('display', 'none')
            .style('position', 'absolute')
            .style('background-color', 'white')
            .style('border', '2px solid #2196f3')
            .style('border-radius', '6px')
            .style('padding', '10px 15px')
            .style('font-size', '14px')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 8px rgba(0,0,0,0.1)')
            .style('pointer-events', 'none');

        // Añadir puntos y eventos de tooltip y click
        svg.selectAll('.point')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'point')
            .attr('cx', d => viewType === 'monthly' ? x(d.month) : x(d.year))
            .attr('cy', d => y(d.count))
            .attr('r', 5)
            .attr('fill', '#2196f3')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('r', 7)
                    .attr('fill', '#1976d2');
                tooltip.transition()
                    .duration(150)
                    .style('opacity', 1);
                
                let tooltipContent;
                if (viewType === 'monthly') {
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    tooltipContent = `<b>${months[d.month - 1]}</b><br><b>Publicaciones:</b> ${d.count}`;
                } else {
                    tooltipContent = `<b>Año:</b> ${d.year}<br><b>Publicaciones:</b> ${d.count}`;
                }
                
                tooltip.html(tooltipContent)
                    .style('left', (event.pageX - 30) + 'px')
                    .style('top', (event.pageY - 40) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 5)
                    .attr('fill', '#2196f3');
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0);
            })
            .on('click', function(event, d) {
                event.stopPropagation();
                
                // Ocultar cualquier info box existente
                d3.selectAll('.info-box').style('display', 'none');
                
                // Calcular la posición relativa al contenedor del gráfico
                const containerRect = document.getElementById('timelineChart').getBoundingClientRect();
                const xPos = event.clientX - containerRect.left;
                const yPos = event.clientY - containerRect.top;
                
                // Obtener las dimensiones del info box
                const infoBoxWidth = 120;
                const infoBoxHeight = 60;
                
                // Calcular la posición final del info box
                let finalX = xPos;
                let finalY = yPos - infoBoxHeight - 10;
                
                // Ajustar la posición horizontal para que no se salga del gráfico
                if (finalX + infoBoxWidth/2 > containerRect.width) {
                    finalX = containerRect.width - infoBoxWidth/2;
                } else if (finalX - infoBoxWidth/2 < 0) {
                    finalX = infoBoxWidth/2;
                }
                
                // Ajustar la posición vertical si se sale por arriba
                if (finalY < 0) {
                    finalY = yPos + 10;
                }
                
                // Mostrar el nuevo info box
                let infoBoxContent;
                if (viewType === 'monthly') {
                    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    infoBoxContent = `
                        <div style="font-weight: bold; margin-bottom: 5px;">${months[d.month - 1]}</div>
                        <div>Publicaciones: ${d.count}</div>
                    `;
                } else {
                    infoBoxContent = `
                        <div style="font-weight: bold; margin-bottom: 5px;">Año ${d.year}</div>
                        <div>Publicaciones: ${d.count}</div>
                    `;
                }
                
                infoBox.html(infoBoxContent)
                    .style('display', 'block')
                    .style('left', (finalX - infoBoxWidth/2) + 'px')
                    .style('top', finalY + 'px');
            });

        // Añadir evento de clic en el SVG para cerrar el info box
        svg.on('click', function(event) {
            if (!event.target.classList.contains('point')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });

        // Añadir evento de clic en el documento para cerrar el info box
        document.addEventListener('click', function(event) {
            if (!event.target.closest('#timelineChart')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });

        // Añadir evento de clic en el contenedor del gráfico
        document.getElementById('timelineChart').addEventListener('click', function(event) {
            if (!event.target.closest('.point')) {
                d3.selectAll('.info-box').style('display', 'none');
            }
        });

        // Añadir título del eje Y
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left + 20)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Número de publicaciones');

        // Añadir título del eje X
        svg.append('text')
            .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 30})`)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(viewType === 'monthly' ? 'Mes' : 'Año');
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

    // Event listeners para los botones de vista
    document.querySelectorAll('[data-view]').forEach(button => {
        button.addEventListener('click', function() {
            if (!this.disabled) {
                // Remover clase active de todos los botones
                document.querySelectorAll('[data-view]').forEach(btn => btn.classList.remove('active'));
                // Añadir clase active al botón clickeado
                this.classList.add('active');
                // Actualizar visualizaciones
                updateVisualizations();
            }
        });
    });

    // Event listeners para los filtros
    yearFrom.addEventListener('change', function() {
        updateVisualizations();
    });

    yearTo.addEventListener('change', function() {
        updateVisualizations();
    });

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

    clearFiltersBtn.addEventListener('click', function() {
        yearFrom.value = '';
        yearTo.value = '';
        selectedAreasList.clear();
        selectedInstitutionsList.clear();
        selectedTypesList.clear();
        selectedAreas.innerHTML = '';
        selectedInstitutions.innerHTML = '';
        selectedTypes.innerHTML = '';
        
        // Resetear botones de vista a anual
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === 'yearly') {
                btn.classList.add('active');
            }
        });
        
        updateVisualizations();
    });
}); 