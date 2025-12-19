/**
 * Timeline chart rendering and exporting.
 */

import * as d3 from 'd3';

/**
 * Render the publications timeline chart.
 *
 * @param {Array<Object>} data - Timeline data points from the backend.
 * @param {'yearly'|'monthly'} viewType - Current timeline view type.
 * @param {Object|null|undefined} timelineInfo - Optional info (e.g. no_month_count).
 * @param {() => ('es'|'en')} detectLangFromPath - Language detector.
 */
export function updateTimeline(data, viewType, timelineInfo, detectLangFromPath) {
    // Clear container
    d3.select('#timelineChart').html('');

    // Chart config
    const margin = { top: 20, right: 20, bottom: 70, left: 60 };
    const yAxisLabelExtraGap = 10;

    const containerEl = document.getElementById('timelineChart');
    if (!containerEl) return;

    const width = containerEl.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
        .select('#timelineChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('display', 'block')
        .style('margin', '0 auto')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    let x;
    if (viewType === 'monthly') {
        x = d3.scaleLinear().domain([1, 12]).range([0, width]);
    } else {
        x = d3
            .scaleLinear()
            .domain(d3.extent(data, (d) => d.year))
            .range([0, width]);
    }

    const y = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.count)])
        .nice()
        .range([height, 0]);

    // Axes
    let xAxis;
    if (viewType === 'monthly') {
        xAxis = d3
            .axisBottom(x)
            .ticks(12)
            .tickFormat((d) => {
                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                return months[d - 1];
            });
    } else {
        xAxis = d3.axisBottom(x).ticks(width / 80).tickFormat(d3.format('d'));
    }

    const yAxis = d3.axisLeft(y).ticks(height / 40);

    // Add axes
    svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .selectAll('text')
        .style('text-anchor', 'middle');

    svg.append('g').call(yAxis);

    // Line & area
    const line = d3
        .line()
        .x((d) => (viewType === 'monthly' ? x(d.month) : x(d.year)))
        .y((d) => y(d.count))
        .curve(d3.curveMonotoneX);

    const area = d3
        .area()
        .x((d) => (viewType === 'monthly' ? x(d.month) : x(d.year)))
        .y0(height)
        .y1((d) => y(d.count))
        .curve(d3.curveMonotoneX);

    svg.append('path').datum(data).attr('fill', '#e3f2fd').attr('d', area);

    svg
        .append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#2196f3')
        .attr('stroke-width', 2)
        .attr('d', line);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.style.opacity = 0;
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(255,255,255,0.95)';
    tooltip.style.border = '1px solid #2196f3';
    tooltip.style.borderRadius = '4px';
    tooltip.style.padding = '6px 10px';
    tooltip.style.fontSize = '13px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    tooltip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    document.body.appendChild(tooltip);

    // Info box
    const infoBox = document.createElement('div');
    infoBox.className = 'info-box';
    infoBox.style.display = 'none';
    infoBox.style.position = 'absolute';
    infoBox.style.backgroundColor = 'white';
    infoBox.style.border = '2px solid #2196f3';
    infoBox.style.borderRadius = '6px';
    infoBox.style.padding = '10px 15px';
    infoBox.style.fontSize = '14px';
    infoBox.style.zIndex = '1000';
    infoBox.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    infoBox.style.pointerEvents = 'none';
    document.body.appendChild(infoBox);

    const langTL = detectLangFromPath ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
    const TL_I18N = {
        yAxis: { es: 'Número de publicaciones', en: 'Number of publications' },
        xMonth: { es: 'Mes', en: 'Month' },
        xYear: { es: 'Año', en: 'Year' },
        publications: { es: 'Publicaciones', en: 'Publications' },
        year: { es: 'Año', en: 'Year' },
    };
    const tTL = (k) => (TL_I18N[k] && TL_I18N[k][langTL]) || k;

    svg
        .selectAll('.point')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', (d) => (viewType === 'monthly' ? x(d.month) : x(d.year)))
        .attr('cy', (d) => y(d.count))
        .attr('r', 5)
        .attr('fill', '#2196f3')
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
            d3.select(this).attr('r', 7).attr('fill', '#1976d2');
            tooltip.style.opacity = 1;

            let tooltipContent;
            if (viewType === 'monthly') {
                const months = (function () {
                    const lang = detectLangFromPath ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    const monthsES = [
                        'Enero',
                        'Febrero',
                        'Marzo',
                        'Abril',
                        'Mayo',
                        'Junio',
                        'Julio',
                        'Agosto',
                        'Septiembre',
                        'Octubre',
                        'Noviembre',
                        'Diciembre',
                    ];
                    const monthsEN = [
                        'January',
                        'February',
                        'March',
                        'April',
                        'May',
                        'June',
                        'July',
                        'August',
                        'September',
                        'October',
                        'November',
                        'December',
                    ];
                    return lang === 'es' ? monthsES : monthsEN;
                })();
                tooltipContent = `<b>${months[d.month - 1]}</b><br><b>${tTL('publications')}:</b> ${d.count}`;
            } else {
                tooltipContent = `<b>${tTL('year')}:</b> ${d.year}<br><b>${tTL('publications')}:</b> ${d.count}`;
            }

            tooltip.innerHTML = tooltipContent;
            tooltip.style.left = `${event.pageX + 10}px`;
            tooltip.style.top = `${event.pageY + 10}px`;
        })
        .on('mouseout', function () {
            d3.select(this).attr('r', 5).attr('fill', '#2196f3');
            tooltip.style.opacity = 0;
        })
        .on('click', function (event, d) {
            event.stopPropagation();

            const containerRect = containerEl.getBoundingClientRect();
            const xPos = event.clientX - containerRect.left;
            const yPos = event.clientY - containerRect.top;

            const infoBoxWidth = 120;
            const infoBoxHeight = 60;

            let finalX = xPos;
            let finalY = yPos - infoBoxHeight - 10;

            if (finalX + infoBoxWidth / 2 > containerRect.width) {
                finalX = containerRect.width - infoBoxWidth / 2;
            } else if (finalX - infoBoxWidth / 2 < 0) {
                finalX = infoBoxWidth / 2;
            }

            if (finalY < 0) {
                finalY = yPos + 10;
            }

            let infoBoxContent;
            if (viewType === 'monthly') {
                const months = (function () {
                    const lang = detectLangFromPath ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                    const monthsES = [
                        'Enero',
                        'Febrero',
                        'Marzo',
                        'Abril',
                        'Mayo',
                        'Junio',
                        'Julio',
                        'Agosto',
                        'Septiembre',
                        'Octubre',
                        'Noviembre',
                        'Diciembre',
                    ];
                    const monthsEN = [
                        'January',
                        'February',
                        'March',
                        'April',
                        'May',
                        'June',
                        'July',
                        'August',
                        'September',
                        'October',
                        'November',
                        'December',
                    ];
                    return lang === 'es' ? monthsES : monthsEN;
                })();
                infoBoxContent = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${months[d.month - 1]}</div>
                    <div>${tTL('publications')}: ${d.count}</div>
                `;
            } else {
                infoBoxContent = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${tTL('year')} ${d.year}</div>
                    <div>${tTL('publications')}: ${d.count}</div>
                `;
            }

            infoBox.innerHTML = infoBoxContent;
            infoBox.style.display = 'block';
            infoBox.style.left = `${finalX - infoBoxWidth / 2}px`;
            infoBox.style.top = `${finalY}px`;
        });

    // Close info box
    svg.on('click', (event) => {
        if (!event.target.classList.contains('point')) {
            infoBox.style.display = 'none';
        }
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('#timelineChart')) {
            infoBox.style.display = 'none';
        }
    });

    // Axis titles
    svg
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left + yAxisLabelExtraGap)
        .attr('x', 0 - height / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(tTL('yAxis'));

    svg
        .append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 30})`)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(viewType === 'monthly' ? tTL('xMonth') : tTL('xYear'));

    // Missing month info
    if (viewType === 'monthly' && timelineInfo && timelineInfo.no_month_count > 0) {
        const infoMessage = d3
            .select('#timelineChart')
            .append('div')
            .attr('class', 'alert alert-info')
            .style('position', 'absolute')
            .style('top', '50px')
            .style('right', '10px')
            .style('padding', '8px 12px')
            .style('font-size', '12px')
            .style('border-radius', '4px')
            .style('background-color', '#e3f2fd')
            .style('border', '1px solid #2196f3')
            .style('color', '#0d47a1')
            .style('z-index', '1000')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '8px')
            .style('max-width', '300px');

        const langInfo = detectLangFromPath ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
        const I18N_MISSING_MONTH = {
            part1: { es: 'publicación(es) sin mes asignado', en: 'publication(s) without an assigned month' },
            part2: { es: 'se han contabilizado en enero', en: 'have been counted in January' },
        };
        const txt = `${timelineInfo.no_month_count} ${I18N_MISSING_MONTH.part1[langInfo]} ${I18N_MISSING_MONTH.part2[langInfo]}`;

        infoMessage.html(
            `<div style="flex-grow: 1;">
                <i class="fas fa-info-circle"></i>
                ${txt}
            </div>
            <button type="button" class="btn-close" style="font-size: 0.7rem;" aria-label="Close"></button>`,
        );

        infoMessage.select('.btn-close').on('click', function () {
            infoMessage.remove();
        });
    }
}

/**
 * Bind the timeline export button.
 *
 * @param {Object} args
 * @param {() => ('es'|'en')} args.detectLangFromPath - Language detector.
 */
export function initTimelineExporter({ detectLangFromPath }) {
    if (typeof window === 'undefined') return;

    const btn = document.getElementById('exportTimelineBtn');
    if (!btn || btn.__timelineExporterBound) return;

    btn.__timelineExporterBound = true;
    btn.addEventListener('click', async () => {
        try {
            const container = document.getElementById('timelineChart');
            if (!container) return;

            const svgEl = container.querySelector('svg');
            if (!svgEl) {
                // eslint-disable-next-line no-alert
                alert('No chart to export');
                return;
            }

            const clone = svgEl.cloneNode(true);
            clone.querySelectorAll('*').forEach((n) => {
                const cs = window.getComputedStyle(n);
                n.setAttribute('font-family', cs.fontFamily);
                n.setAttribute('font-size', cs.fontSize);
                if (cs.fill && cs.fill !== 'none') n.setAttribute('fill', cs.fill);
                if (cs.stroke && cs.stroke !== 'none') n.setAttribute('stroke', cs.stroke);
            });

            const origWidth = parseInt(clone.getAttribute('width'), 10) || container.clientWidth;
            const origHeight = parseInt(clone.getAttribute('height'), 10) || container.clientHeight;

            const exportTitle = (function () {
                const lang = detectLangFromPath ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                return lang === 'es' ? 'Línea de tiempo de publicaciones' : 'Publications timeline';
            })();

            const titleMargin = 40;
            const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            const scaleFactor = 2;
            exportSvg.setAttribute('width', String(origWidth * scaleFactor));
            exportSvg.setAttribute('height', String((origHeight + titleMargin) * scaleFactor));
            exportSvg.setAttribute('viewBox', `0 0 ${origWidth} ${origHeight + titleMargin}`);
            exportSvg.setAttribute('shape-rendering', 'geometricPrecision');
            exportSvg.setAttribute('text-rendering', 'geometricPrecision');

            const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            titleEl.setAttribute('x', String(origWidth / 2));
            titleEl.setAttribute('y', '24');
            titleEl.setAttribute('text-anchor', 'middle');
            titleEl.setAttribute('font-size', '18');
            titleEl.setAttribute('font-family', 'Arial, sans-serif');
            titleEl.setAttribute('fill', '#111');
            titleEl.textContent = exportTitle;
            exportSvg.appendChild(titleEl);

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(0, ${titleMargin})`);
            Array.from(clone.childNodes).forEach((ch) => g.appendChild(ch));
            exportSvg.appendChild(g);

            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(exportSvg);
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                    }
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    const ts = new Date().toISOString().replace(/[:.]/g, '-');
                    const a = document.createElement('a');
                    a.download = `publication_timeline_${ts}.png`;
                    a.href = canvas.toDataURL('image/png');
                    a.click();
                } finally {
                    URL.revokeObjectURL(url);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                // eslint-disable-next-line no-alert
                alert('Failed to export image');
            };

            img.src = url;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[Timeline][Export] Failed', error);
            // eslint-disable-next-line no-alert
            alert('Failed to export image');
        }
    });
}
