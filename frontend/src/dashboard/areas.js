/**
 * Areas charts (pie & bar) + exporter.
 */

import * as d3 from 'd3';

/**
 * Initialize the Areas exporter button.
 *
 * @param {Object} args
 * @param {() => ('es'|'en')} args.detectLangFromPath - Language detector.
 */
export function initAreasExporter({ detectLangFromPath }) {
    if (typeof window === 'undefined') return;

    const btn = document.getElementById('exportAreasBtn');
    if (!btn || btn.__areasExporterBound) return;

    btn.__areasExporterBound = true;
    btn.addEventListener('click', () => {
        try {
            const container = document.getElementById('areasChart');
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
            let origHeight = parseInt(clone.getAttribute('height'), 10) || container.clientHeight;
            const isBar = document.querySelector('[data-areas-view="bar"]')?.classList.contains('active');

            const exportTitle = (function () {
                const lang = detectLangFromPath ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
                if (lang === 'es') return isBar ? 'Distribución de áreas (Barras)' : 'Distribución de áreas (Circular)';
                return isBar ? 'Areas distribution (Bars)' : 'Areas distribution (Pie)';
            })();

            const titleMargin = 40;
            const bottomExtra = isBar ? 130 : 0;
            const leftExtra = isBar ? 70 : 0;
            const exportWidth = origWidth + leftExtra;

            if (isBar) {
                const xAxisTexts = clone.querySelectorAll('.areas-x-axis text');
                xAxisTexts.forEach((t) => {
                    t.style.display = 'block';
                    t.setAttribute('transform', 'rotate(-48)');
                    t.setAttribute('text-anchor', 'end');
                    t.setAttribute('dx', '-0.35em');
                    t.setAttribute('dy', '0.3em');
                    t.setAttribute('font-size', '9px');
                });

                const xAxisTitle = clone.querySelector('.x-axis-title');
                if (xAxisTitle) {
                    const match = /translate\([^,]+,\s*([^\)]+)\)/.exec(xAxisTitle.getAttribute('transform') || '');
                    let baseY = match ? parseFloat(match[1]) : origHeight - 10;
                    baseY += 85;

                    let calculatedCenter = origWidth / 2;
                    try {
                        const bars = clone.querySelectorAll('.bar');
                        if (bars.length > 0) {
                            let minX = Infinity;
                            let maxX = -Infinity;
                            bars.forEach((b) => {
                                const xVal = parseFloat(b.getAttribute('x')) || 0;
                                const wVal = parseFloat(b.getAttribute('width')) || 0;
                                if (xVal < minX) minX = xVal;
                                if (xVal + wVal > maxX) maxX = xVal + wVal;
                            });
                            if (isFinite(minX) && isFinite(maxX)) {
                                calculatedCenter = (minX + maxX) / 2;
                            }
                        }
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.warn('[Areas][Export][Bar] Failed to recalculate X center for title:', e);
                    }

                    xAxisTitle.setAttribute('transform', `translate(${calculatedCenter}, ${baseY})`);
                }

                const yAxisTitle = clone.querySelector('.y-axis-title');
                if (yAxisTitle) {
                    const curY = parseFloat(yAxisTitle.getAttribute('y')) || 0;
                    yAxisTitle.setAttribute('y', String(curY - 20));
                    const curX = parseFloat(yAxisTitle.getAttribute('x')) || 0;
                    yAxisTitle.setAttribute('x', String(curX + 25));
                }

                origHeight += bottomExtra;
            }

            const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            const scaleFactor = 2;
            exportSvg.setAttribute('width', String(exportWidth * scaleFactor));
            exportSvg.setAttribute('height', String((origHeight + titleMargin) * scaleFactor));
            exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${origHeight + titleMargin}`);
            exportSvg.setAttribute('shape-rendering', 'geometricPrecision');
            exportSvg.setAttribute('text-rendering', 'geometricPrecision');

            const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            titleEl.setAttribute('x', String(leftExtra + origWidth / 2));
            titleEl.setAttribute('y', '24');
            titleEl.setAttribute('text-anchor', 'middle');
            titleEl.setAttribute('font-size', '18');
            titleEl.setAttribute('font-family', 'Arial, sans-serif');
            titleEl.setAttribute('fill', '#111');
            titleEl.textContent = exportTitle;
            exportSvg.appendChild(titleEl);

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(${leftExtra}, ${titleMargin})`);
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
                    a.download = isBar ? `areas_distribution_bar_${ts}.png` : `areas_distribution_pie_${ts}.png`;
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
            console.error('[Areas][Export] Failed', error);
            // eslint-disable-next-line no-alert
            alert('Failed to export image');
        }
    });
}

/**
 * Translate Areas labels.
 *
 * @param {string} key - Translation key.
 * @param {() => ('es'|'en')} detectLangFromPath - Language detector.
 * @returns {string}
 */
export function tAreas(key, detectLangFromPath) {
    const AREAS_I18N = {
        publications: { es: 'Publicaciones', en: 'Publications' },
        percentage: { es: 'Porcentaje', en: 'Percentage' },
        pubsAbbrev: { es: 'pubs', en: 'pubs' },
        yAxis: { es: 'Número de publicaciones', en: 'Number of publications' },
        xAxis: { es: 'Áreas temáticas', en: 'Thematic areas' },
        others: { es: 'Otras', en: 'Others' },
    };
    const lang = detectLangFromPath ? detectLangFromPath() : (window.location.pathname.includes('/en/') ? 'en' : 'es');
    return (AREAS_I18N[key] && AREAS_I18N[key][lang]) || key;
}

/**
 * Render the Areas chart based on current view.
 *
 * @param {Object} args
 * @param {Array<Object>} args.data - Areas data from the backend.
 * @param {'pie'|'bar'} args.currentAreasView - Current areas view.
 * @param {() => ('es'|'en')} args.detectLangFromPath - Language detector.
 * @param {() => void} [args.hideAreasLoading] - Optional UI helper.
 */
export function renderAreasChart({ data, currentAreasView, detectLangFromPath, hideAreasLoading }) {
    if (currentAreasView === 'pie') {
        updateAreasChart({ data, detectLangFromPath, hideAreasLoading });
    } else {
        updateAreasBarChart({ data, detectLangFromPath, hideAreasLoading });
    }
    if (typeof hideAreasLoading === 'function') hideAreasLoading();
}

/**
 * Render the Areas pie chart.
 *
 * @param {Object} args
 * @param {Array<Object>} args.data - Areas data.
 * @param {() => ('es'|'en')} args.detectLangFromPath - Language detector.
 * @param {() => void} [args.hideAreasLoading] - Optional UI helper.
 */
export function updateAreasChart({ data, detectLangFromPath, hideAreasLoading }) {
    // Filter null values
    const filtered = (data || []).filter((d) => d.thematic_areas__name !== null);

    d3.select('#areasChart').html('');

    const margin = { top: 20, right: 150, bottom: 20, left: 20 };
    const container = document.getElementById('areasChart');
    if (!container) return;

    const width = container.clientWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2;

    const svg = d3
        .select('#areasChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('display', 'block')
        .style('margin', '0 auto')
        .style('min-width', '550px')
        .append('g')
        .attr('transform', `translate(${radius + margin.left},${height / 2 + margin.top})`);

    const color = d3.scaleOrdinal().domain(filtered.map((d) => d.thematic_areas__name)).range(d3.schemeCategory10);

    const pie = d3.pie().value((d) => d.count).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);

    const infoBox = d3
        .select('#areasChart')
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

    svg
        .selectAll('path')
        .data(pie(filtered))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', (d) => color(d.data.thematic_areas__name))
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
            event.stopPropagation();
            d3.selectAll('.info-box').style('display', 'none');

            const containerRect = container.getBoundingClientRect();
            const xPos = event.clientX - containerRect.left;
            const yPos = event.clientY - containerRect.top;

            const infoBoxWidth = 180;
            const infoBoxHeight = 70;

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

            const percentage = ((d.data.count / d3.sum(filtered, (it) => it.count)) * 100).toFixed(1);
            const infoBoxContent = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${d.data.thematic_areas__name}</div>
                    <div>${tAreas('publications', detectLangFromPath)}: ${d.data.count}</div>
                    <div>${tAreas('percentage', detectLangFromPath)}: ${percentage}%</div>
                `;

            const borderColor = color(d.data.thematic_areas__name);
            infoBox
                .html(infoBoxContent)
                .style('display', 'block')
                .style('left', `${finalX - infoBoxWidth / 2}px`)
                .style('top', `${finalY}px`)
                .style('border', `2px solid ${borderColor}`);
        });

    const legend = svg.append('g').attr('transform', `translate(${radius + 20}, ${-height / 2})`);

    const legendItem = legend
        .selectAll('.legend-item')
        .data(filtered)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    legendItem
        .append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', (d) => color(d.thematic_areas__name));

    legendItem
        .append('text')
        .attr('x', 20)
        .attr('y', 12)
        .style('font-size', '10px')
        .text((d) => {
            const name = d.thematic_areas__name;
            const percentage = ((d.count / d3.sum(filtered, (it) => it.count)) * 100).toFixed(1);
            return `${name} (${d.count} ${tAreas('pubsAbbrev', detectLangFromPath)}, ${percentage}%)`;
        });

    container.addEventListener('click', (event) => {
        if (!event.target.closest('path')) {
            d3.selectAll('.info-box').style('display', 'none');
        }
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('#areasChart')) {
            d3.selectAll('.info-box').style('display', 'none');
        }
    });

    if (typeof hideAreasLoading === 'function') hideAreasLoading();
}

/**
 * Render the Areas bar chart.
 *
 * @param {Object} args
 * @param {Array<Object>} args.data - Areas data.
 * @param {() => ('es'|'en')} args.detectLangFromPath - Language detector.
 * @param {() => void} [args.hideAreasLoading] - Optional UI helper.
 */
export function updateAreasBarChart({ data, detectLangFromPath, hideAreasLoading }) {
    let filtered = (data || []).filter((d) => d.thematic_areas__name !== null);

    const N = 25;
    if (filtered.length > N) {
        const sorted = filtered.slice().sort((a, b) => b.count - a.count);
        const topN = sorted.slice(0, N);
        const rest = sorted.slice(N);
        const otherCount = rest.reduce((sum, d) => sum + d.count, 0);
        filtered = [...topN, { thematic_areas__name: tAreas('others', detectLangFromPath), count: otherCount }];
    }

    d3.select('#areasChart').html('');

    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const container = document.getElementById('areasChart');
    if (!container) return;

    const width = container.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3
        .select('#areasChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .style('display', 'block')
        .style('margin', '0 auto')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
        .scaleBand()
        .domain(filtered.map((d) => d.thematic_areas__name))
        .range([0, width])
        .padding(0.2);

    const y = d3
        .scaleLinear()
        .domain([0, d3.max(filtered, (d) => d.count)])
        .nice()
        .range([height, 0]);

    const xAxisGroup = svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .attr('class', 'areas-x-axis')
        .call(d3.axisBottom(x));

    xAxisGroup.selectAll('text').style('display', 'none').style('font-size', '9px');

    svg.append('g').call(d3.axisLeft(y).ticks(height / 40));

    const color = d3.scaleOrdinal().domain(filtered.map((d) => d.thematic_areas__name)).range(d3.schemeCategory10);

    const infoBox = d3
        .select('#areasChart')
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

    svg
        .selectAll('.bar')
        .data(filtered)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d.thematic_areas__name))
        .attr('y', (d) => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', (d) => height - y(d.count))
        .attr('fill', (d) => color(d.thematic_areas__name))
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
            event.stopPropagation();
            d3.selectAll('.info-box').style('display', 'none');

            const containerRect = container.getBoundingClientRect();
            const xPos = event.clientX - containerRect.left;
            const yPos = event.clientY - containerRect.top;

            const infoBoxWidth = 180;
            const infoBoxHeight = 70;

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

            const percentage = ((d.count / d3.sum(filtered, (it) => it.count)) * 100).toFixed(1);
            const infoBoxContent = `
                    <div style="font-weight: bold; margin-bottom: 5px;">${d.thematic_areas__name}</div>
                    <div>${tAreas('publications', detectLangFromPath)}: ${d.count}</div>
                    <div>${tAreas('percentage', detectLangFromPath)}: ${percentage}%</div>
                `;

            const borderColor = color(d.thematic_areas__name);
            infoBox
                .html(infoBoxContent)
                .style('display', 'block')
                .style('left', `${finalX - infoBoxWidth / 2}px`)
                .style('top', `${finalY}px`)
                .style('border', `2px solid ${borderColor}`);
        });

    container.addEventListener('click', (event) => {
        if (!event.target.closest('rect')) {
            d3.selectAll('.info-box').style('display', 'none');
        }
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('#areasChart')) {
            d3.selectAll('.info-box').style('display', 'none');
        }
    });

    svg
        .append('text')
        .attr('class', 'y-axis-title')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left - 2)
        .attr('x', -height / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(tAreas('yAxis', detectLangFromPath));

    svg
        .append('text')
        .attr('class', 'x-axis-title')
        .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 20})`)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(tAreas('xAxis', detectLangFromPath));

    try {
        const bars = svg.selectAll('.bar').nodes();
        if (bars.length > 0) {
            let minX = Infinity;
            let maxX = -Infinity;
            bars.forEach((b) => {
                const xVal = parseFloat(b.getAttribute('x')) || 0;
                const wVal = parseFloat(b.getAttribute('width')) || 0;
                if (xVal < minX) minX = xVal;
                if (xVal + wVal > maxX) maxX = xVal + wVal;
            });
            if (isFinite(minX) && isFinite(maxX)) {
                const centerBars = (minX + maxX) / 2;
                svg.select('.x-axis-title').attr('transform', `translate(${centerBars}, ${height + margin.bottom - 20})`);
            }
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Areas][BarChart] Failed to recalculate X title center:', e);
    }

    if (typeof hideAreasLoading === 'function') hideAreasLoading();
}
