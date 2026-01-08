/**
 * @fileoverview Collaboration network controller.
 *
 * This module extracts the collaboration network logic from `dashboard.js`.
 * The goal is to keep behavior identical while reducing the size of the main file.
 */

import * as d3 from 'd3';
import Graph from 'graphology';
import Sigma from 'sigma';
import EdgeCurveProgram from '@sigma/edge-curve';

/**
 * @typedef {Object} CollaborationNetworkControllerDeps
 * @property {() => string} getLang
 * @property {() => string} detectLangFromPath
 * @property {() => boolean} getIsFullNetwork
 * @property {(next: boolean) => void} setIsFullNetwork
 * @property {() => void} updateVisualizations
 */

/**
 * Creates a controller for the collaboration network.
 *
 * Contract:
 * - Preserves global state used elsewhere: `window.currentCommunityView`,
 *   `window.currentClusteringModel`, `window.currentNClusters`, `window.currentNetworkData`.
 * - Preserves the in-file state that used to live in `dashboard.js`: renderer instance
 *   and label toggle behavior.
 * - To avoid changing call sites, the controller exposes methods that are meant to be
 *   called by wrappers with the same names in `dashboard.js`.
 *
 * @param {CollaborationNetworkControllerDeps} deps Dependencies from `dashboard.js`.
 * @returns {{
 *   updateCollaborationNetwork: (data: any) => void,
 *   updateCommunityDropdownText: (model?: (string|null), nClusters?: (string|number|null)) => void,
 *   initNetworkHandlers: (opts: { getRendererRef: () => (any|null), setRendererRef: (r: any|null) => void, getShowAllLabels: () => boolean, setShowAllLabels: (v: boolean) => void }) => void,
 * }} Controller API.
 */
export function createCollaborationNetworkController(deps) {
    const {
        getLang,
        detectLangFromPath,
        getIsFullNetwork,
        setIsFullNetwork,
        updateVisualizations,
    } = deps;

    /**
     * Updates the dropdown button label based on the current view and language.
     *
     * @param {string|null} model Optional clustering model name.
     * @param {string|number|null} nClusters Optional cluster count.
     * @returns {void}
     */
    function updateCommunityDropdownText(model = null, nClusters = null) {
        const dropdownButton = document.getElementById('communityViewDropdown');
        if (!dropdownButton) return;

        const currentLang = (typeof detectLangFromPath === 'function')
            ? detectLangFromPath()
            : (window.location.pathname.split('/')[1] || 'es');

        let text = '';
        if (window.currentCommunityView === 'department') {
            text = currentLang === 'es' ? 'Por Departamento' : 'By Department';
        } else if (window.currentCommunityView === 'modularity-7') {
            if (currentLang === 'es') {
                text = getIsFullNetwork() ? 'Louvain' : 'Louvain (7 comunidades)';
            } else {
                text = getIsFullNetwork() ? 'Louvain' : 'Louvain (7 communities)';
            }
        } else if (window.currentCommunityView === 'modularity-5') {
            if (currentLang === 'es') {
                text = getIsFullNetwork() ? 'Leiden' : 'Leiden (5 comunidades)';
            } else {
                text = getIsFullNetwork() ? 'Leiden' : 'Leiden (5 communities)';
            }
        } else if (window.currentCommunityView === 'keywords') {
            const modelName = model || window.currentClusteringModel;
            const nClustersValue = nClusters || window.currentNClusters;
            if (modelName && nClustersValue) {
                if (currentLang === 'es') {
                    text = `Por palabras clave (${modelName}, ${nClustersValue} clústeres)`;
                } else {
                    text = `By keywords (${modelName}, ${nClustersValue} clusters)`;
                }
            } else {
                text = currentLang === 'es' ? 'Por palabras clave' : 'By keywords';
            }
        }

        dropdownButton.textContent = text;
    }

    /**
     * Shows a loading overlay on top of the network container.
     *
     * @param {string} [message] Optional loading message.
     * @returns {() => void} A cleanup function to hide the overlay.
     */
    function showNetworkLoading(message) {
        const container = document.getElementById('collaborationNetwork');
        if (!container) return () => {};

        // Ensure local absolute overlay positioning works.
        const computedStyle = window.getComputedStyle(container);
        if (computedStyle.position === 'static') {
            container.style.position = 'relative';
        }

        const currentLang = detectLangFromPath();
        const text = message || (currentLang === 'es' ? 'Cargando...' : 'Loading...');

        const existing = document.getElementById('collaborationNetworkLoadingOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'collaborationNetworkLoadingOverlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.75);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 5000;
            pointer-events: all;
        `;
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">${text}</span>
                </div>
                <div style="margin-top: 8px; font-size: 0.95rem; color: #555;">${text}</div>
            </div>
        `;

        container.appendChild(overlay);

        return () => {
            const el = document.getElementById('collaborationNetworkLoadingOverlay');
            if (el) el.remove();
        };
    }

    /**
     * Hides any active loading overlay.
     *
     * @returns {void}
     */
    function hideNetworkLoading() {
        const el = document.getElementById('collaborationNetworkLoadingOverlay');
        if (el) el.remove();
    }

    /**
     * Renders/updates the Sigma collaboration network.
     *
     * @param {any} data Network payload from backend.
     * @param {object} ctx Mutable runtime context managed by `dashboard.js`.
     * @param {(any|null)} ctx.renderer Current Sigma renderer instance.
     * @param {(r: any|null) => void} ctx.setRenderer Setter for renderer reference.
     * @param {boolean} ctx.showAllLabels Whether to force show all labels.
     * @returns {void}
     */
    function updateCollaborationNetwork(data, ctx) {
        const container = document.getElementById('collaborationNetwork');
        if (!container) return;

        // Hide the "Show labels" button only for the multi-author view.
        // In this view the graph is small and showing extra labels is not useful.
        const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
        if (toggleLabelsBtn) {
            toggleLabelsBtn.style.display = (data && data.is_multi_author_view) ? 'none' : '';
        }

        // Ensure the network can expand to the full height of its card when needed.
        // This is especially important for the multi-author view.
        const cardBody = container.closest('.card-body');
        if (cardBody) {
            cardBody.style.display = 'flex';
            cardBody.style.flexDirection = 'column';
        }
        container.style.flex = '1 1 auto';
        container.style.minHeight = '260px';

        // Always show loading while destroying/rebuilding the renderer.
        // This avoids user confusion when switching networks/views.
        const cleanupLoading = showNetworkLoading();

        const cardTitle = document.querySelector('#collaborationNetwork').closest('.card').querySelector('.card-title');
        const currentLang = detectLangFromPath();
        const toggleButton = document.getElementById('toggleFullNetworkBtn');

        const isFullNetwork = getIsFullNetwork();

        if (data.is_author_view) {
            // Author-centric views:
            // - single author view: collaborations of the selected author
            // - multi-author view: collaborations *between* selected authors only
            if (data.is_multi_author_view) {
                cardTitle.textContent = currentLang === 'es'
                    ? 'Colaboraciones entre autores seleccionados'
                    : 'Collaborations between selected authors';
            } else {
                const selectedAuthor = (data.nodes || []).find(node => node.is_selected);
                if (selectedAuthor) {
                    cardTitle.textContent = currentLang === 'es'
                        ? `Colaboraciones de ${selectedAuthor.label}`
                        : `Collaborations of ${selectedAuthor.label}`;
                }
            }

            const dropdown = document.querySelector('#communityViewDropdown')?.closest('.dropdown');
            if (dropdown) dropdown.style.display = 'none';
            if (toggleButton) toggleButton.style.display = 'none';

            // Multi-author view should fill the card height to avoid clipping.
            // We rely on the surrounding card layout to constrain the height.
            if (data.is_multi_author_view) {
                container.style.height = '100%';
            } else {
                // Restore default height.
                container.style.height = '400px';
            }
        } else {
            // Restore default height for non-author views.
            container.style.height = '400px';
            document.querySelector('#communityViewDropdown').closest('.dropdown').style.display = 'block';
            updateCommunityDropdownText(
                data.model || null,
                data.n_clusters || null,
            );

                const cleanup = showNetworkLoading(currentLang === 'es' ? 'Cargando...' : 'Loading...');
            if (window.currentCommunityView === 'keywords') {
                toggleButton.style.display = 'none';
            } else {
                toggleButton.style.display = 'block';
            }

            if (isFullNetwork) {
                const existingMessage = document.getElementById('networkInfoMessage');
                if (existingMessage) existingMessage.remove();

                let messageText = '';
                if (window.currentCommunityView === 'department') {
                    messageText = currentLang === 'es'
                        ? 'Los investigadores han sido clasificados en departamentos utilizando un Node2VecTransformer y un MLPClassifier. Esta clasificación no es 100% precisa. No aparecen investigadores sin colaboraciones.'
                        : 'Researchers have been classified into departments using a Node2VecTransformer and MLPClassifier. This classification is not 100% accurate. There are no researchers without collaborations.';
                } else if (window.currentCommunityView === 'modularity-7') {
                    messageText = currentLang === 'es'
                        ? 'Se ha utilizado el algoritmo de detección de comunidades Lovaina sobre la red de coautorías completa para agrupar a los investigadores en distintas comunidades. No aparecen investigadores sin colaboraciones.'
                        : 'The Louvain community detection algorithm has been used on the complete co-authorship network to group researchers into different communities. There are no researchers without collaborations.';
                } else if (window.currentCommunityView === 'modularity-5') {
                    messageText = currentLang === 'es'
                        ? 'Se ha utilizado el algoritmo de detección de comunidades Leiden sobre la red de coautorías completa para agrupar a los investigadores en distintas comunidades. No aparecen investigadores sin colaboraciones.'
                        : 'The Leiden community detection algorithm has been used on the complete co-authorship network to group researchers into different communities. There are no researchers without collaborations.';
                }

                if (messageText) {
                    const cardBody = container.closest('.card-body');
                    const messageDiv = document.createElement('div');
                    messageDiv.id = 'networkInfoMessage';
                    messageDiv.style.cssText = `
                        background-color: #f8f9fa;
                        border-left: 4px solid #0d6efd;
                        padding: 10px 15px;
                        margin: 10px 0;
                        border-radius: 4px;
                        font-size: 0.9rem;
                        color: #666;
                        position: relative;
                    `;
                        // In the happy path, `updateCollaborationNetwork` will also remove the overlay.
                        // This is a fallback for errors or early exits.
                        cleanup();

                    const closeButton = document.createElement('button');
                    closeButton.className = 'btn-close';
                    closeButton.style.cssText = `
                        position: absolute;
                        right: 10px;
                        top: 10px;
                        padding: 0.25rem;
                    `;
                    closeButton.onclick = () => {
        showNetworkLoading,
        hideNetworkLoading,
                        messageDiv.remove();
                    };

                    const messageContent = document.createElement('div');
                    messageContent.textContent = messageText;

                    messageDiv.appendChild(closeButton);
                    messageDiv.appendChild(messageContent);

                    cardBody.insertBefore(messageDiv, container);
                }
            } else {
                const existingMessage = document.getElementById('networkInfoMessage');
                if (existingMessage) existingMessage.remove();
            }

            if (window.currentCommunityView === 'keywords') {
                cardTitle.textContent = currentLang === 'es'
                    ? 'Red de coincidencia de palabras clave (entre IPs)'
                    : 'Keyword Coincidence Network (between IPs)';
            } else {
                cardTitle.textContent = currentLang === 'es'
                    ? (isFullNetwork ? 'Red de Coautorías Interactiva Completa' : 'Red de Coautorías Interactiva entre IPs')
                    : (isFullNetwork ? 'Complete Interactive Co-authorship Network' : 'Interactive Co-authorship Network between IPs');
            }
        }

        if (ctx.renderer) {
            ctx.renderer.kill();
            ctx.setRenderer(null);
        }

        container.innerHTML = '';
        const graph = new Graph();

        const colorPalette = [
            '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6',
            '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
            '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#000000', '#6a3d9a', '#b15928', '#1f78b4',
        ];

        const colorByCommunity = (c) => {
            if (c === -1 || Number.isNaN(c)) return '#A9A9A9';
            return colorPalette[c % colorPalette.length];
        };

        const departmentColorScale = d3.scaleOrdinal()
            .domain(['Departamento 1', 'Departamento 2', 'Departamento 3', 'Unknown'])
            .range(['#1f78b4', '#ff7f0e', '#2ca02c', '#999999']);

        // Positioning
        if (data.is_author_view) {
            const centerX = container.clientWidth / 2;
            const centerY = container.clientHeight / 2;
            const radius = 250;
            const authorNode = data.nodes.find(n => n.is_selected);
            if (!authorNode) return;

            authorNode.x = centerX;
            authorNode.y = centerY;

            const coauthors = data.nodes.filter(n => !n.is_selected);
            const angleStep = (2 * Math.PI) / Math.max(coauthors.length, 1);
            coauthors.forEach((node, i) => {
                const angle = i * angleStep;
                node.x = centerX + radius * Math.cos(angle);
                node.y = centerY + radius * Math.sin(angle);
            });
        } else {
            let groupByProp;
            if (window.currentCommunityView === 'department') {
                groupByProp = 'department';
            } else if (window.currentCommunityView === 'modularity-5') {
                groupByProp = 'leiden_community';
            } else if (window.currentCommunityView === 'modularity-7') {
                groupByProp = 'community';
            } else {
                groupByProp = 'community';
            }

            const groups = [...new Set(data.nodes.map(n => n[groupByProp]))].filter(g => g !== undefined);
            const unknownIndex = groups.indexOf(-1);
            if (unknownIndex > -1) {
                groups.splice(unknownIndex, 1);
                groups.push(-1);
            }

            const nodesByGroup = {};
            groups.forEach(group => {
                nodesByGroup[group] = data.nodes.filter(n => n[groupByProp] === group);
            });

            const canvasCenterX = container.clientWidth / 2;
            const canvasCenterY = container.clientHeight / 2;
            const totalGroups = groups.length;
            const overallRadius = Math.min(canvasCenterX, canvasCenterY) * 0.8;
            const groupRadius = overallRadius / Math.sqrt(totalGroups) * 0.5;

            groups.forEach((group, i) => {
                const nodes = nodesByGroup[group];
                const angleStep = (2 * Math.PI) / Math.max(nodes.length, 5);
                const cx = canvasCenterX + overallRadius * Math.cos((2 * Math.PI * i) / totalGroups);
                const cy = canvasCenterY + overallRadius * Math.sin((2 * Math.PI * i) / totalGroups);

                nodes.forEach((node, j) => {
                    const angle = j * angleStep;
                    node.x = cx + groupRadius * Math.cos(angle);
                    node.y = cy + groupRadius * Math.sin(angle);
                });
            });
        }

        data.nodes.forEach(node => {
            const comm = parseInt(node.community, 10);
            const leiden = parseInt(node.leiden_community, 10);
            const dept = node.department;

            const nodeColor = data.is_author_view
                ? (node.is_selected ? '#e6194b' : '#bbbbbb')
                : (window.currentCommunityView === 'department'
                    ? departmentColorScale(dept)
                    : (window.currentCommunityView === 'modularity-5'
                        ? colorByCommunity(leiden)
                        : colorByCommunity(comm)));

            graph.addNode(node.id, {
                label: node.label,
                x: node.x,
                y: node.y,
                size: node.is_selected ? 18 : 12,
                color: nodeColor,
                highlighted: node.is_selected,
                forceLabel: ctx.showAllLabels,
            });
        });

        data.edges.forEach(edge => {
            if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
                const weight = edge.weight || 1;
                const rawSize = Math.pow(weight, 0.7);
                const edgeSize = Math.min(4.0, Math.max(1.5, rawSize));
                const alpha = Math.min(0.9, 0.5 + 0.05 * weight);
                const edgeColor = `rgba(3, 138, 255, ${alpha.toFixed(2)})`;

                graph.addEdge(edge.source, edge.target, {
                    size: edgeSize,
                    color: edgeColor,
                    type: 'curve',
                });
            }
        });

        const renderer = new Sigma(graph, container, {
            minCameraRatio: 0.1,
            maxCameraRatio: 10,
            defaultEdgeType: 'curve',
            edgeProgramClasses: { curve: EdgeCurveProgram },
            renderLabels: true,
            labelDensity: 1,
            labelGridCellSize: 300,
            labelRenderedSizeThreshold: 0,
            defaultLabelSize: 8,
            zIndex: true,
            enableEdgeHovering: false,
            enableNodeHovering: false,
            enableCamera: false,
        });

        ctx.setRenderer(renderer);

        // Hide loading after Sigma has had at least one paint.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                cleanupLoading();
            });
        });

        // Legend
        if (!data.is_author_view && !(isFullNetwork && window.currentCommunityView === 'modularity-7') && !(isFullNetwork && window.currentCommunityView === 'modularity-5')) {
            const legend = document.createElement('div');
            legend.id = 'networkLegend';
            Object.assign(legend.style, {
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                backgroundColor: 'rgba(255,255,255,0.95)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '13px',
                zIndex: 1000,
                boxShadow: '0px 0px 6px rgba(0,0,0,0.1)',
            });

            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '6px';

            if (window.currentCommunityView === 'department') {
                title.textContent = currentLang === 'es' ? 'Departamentos' : 'Departments';
            } else if (window.currentCommunityView === 'keywords') {
                title.textContent = currentLang === 'es' ? 'Comunidades de Palabras Clave' : 'Keyword Communities';
            } else if (window.currentCommunityView === 'modularity-5' || window.currentCommunityView === 'modularity-7') {
                const k = window.currentCommunityView === 'modularity-7' ? 7 : 5;
                title.textContent = currentLang === 'es' ? `Comunidades (${k})` : `Communities (${k})`;
            } else {
                title.textContent = currentLang === 'es' ? 'Comunidades' : 'Communities';
            }

            legend.appendChild(title);

            const counts = document.createElement('div');
            counts.style.marginBottom = '8px';
            const nodeWord = currentLang === 'es' ? 'nodos' : 'nodes';
            const edgeWord = currentLang === 'es' ? 'enlaces' : 'edges';
            counts.textContent = `${data.nodes.length} ${nodeWord} / ${data.edges.length} ${edgeWord}`;
            legend.appendChild(counts);

            if (window.currentCommunityView === 'department') {
                const departments = [...new Set(data.nodes.map(n => n.department))];
                departments.forEach(dept => {
                    const item = document.createElement('div');
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.marginBottom = '4px';

                    const colorBox = document.createElement('div');
                    Object.assign(colorBox.style, {
                        width: '14px',
                        height: '14px',
                        backgroundColor: departmentColorScale(dept),
                        marginRight: '6px',
                        borderRadius: '3px',
                    });

                    const label = document.createElement('span');
                    label.textContent = dept;

                    item.appendChild(colorBox);
                    item.appendChild(label);
                    legend.appendChild(item);
                });
            } else {
                let communities = [];
                if (window.currentCommunityView === 'keywords') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.community, 10)))];
                } else if (window.currentCommunityView === 'modularity-5') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.leiden_community, 10)))];
                } else if (window.currentCommunityView === 'modularity-7') {
                    communities = [...new Set(data.nodes.map(n => parseInt(n.community, 10)))];
                }

                communities.sort((a, b) => a - b);

                communities.forEach((comm, i) => {
                    const item = document.createElement('div');
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.marginBottom = '4px';

                    const colorBox = document.createElement('div');
                    Object.assign(colorBox.style, {
                        width: '14px',
                        height: '14px',
                        backgroundColor: colorByCommunity(comm),
                        marginRight: '6px',
                        borderRadius: '3px',
                    });

                    const label = document.createElement('span');
                    if (comm === -1 || Number.isNaN(comm)) {
                        label.textContent = currentLang === 'es' ? 'Atípico' : 'Outlier';
                    } else {
                        const num = (window.currentCommunityView === 'modularity-7') ? (i + 1) : (comm + 1);
                        const word = currentLang === 'es' ? 'Comunidad' : 'Community';
                        label.textContent = `${word} ${num}`;
                    }

                    item.appendChild(colorBox);
                    item.appendChild(label);
                    legend.appendChild(item);
                });
            }

            container.appendChild(legend);
        }

        // Interactivity overlay
        const overlay = document.createElement('div');
        overlay.innerText = currentLang === 'es' ? 'Haz click para activar la red' : 'Click to activate the network';
        Object.assign(overlay.style, {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#333',
            cursor: 'pointer',
            zIndex: 1000,
            borderRadius: getComputedStyle(container).borderRadius,
        });
        container.appendChild(overlay);

        overlay.addEventListener('click', () => {
            overlay.remove();
            activateInteractivity(renderer, graph, currentLang, ctx.showAllLabels);
        });

        const tooltip = document.createElement('div');
        Object.assign(tooltip.style, {
            position: 'absolute',
            backgroundColor: '#fff',
            border: '1px solid #aaa',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            pointerEvents: 'none',
            display: 'none',
            zIndex: 1000,
        });
        document.body.appendChild(tooltip);

        renderer.on('enterNode', ({ node, event }) => {
            if (tooltip.style.display === 'none') return;
            // keep handler attached; real visibility is managed by activateInteractivity
        });

        // Store tooltip on renderer for later (keeps behavior similar)
        renderer.__dashboardTooltip = tooltip;
    }

    /**
     * Activates Sigma interactions (hover, camera, visibility).
     *
     * @param {any} renderer Sigma renderer.
     * @param {any} graph Graphology graph.
     * @param {'es'|'en'} currentLang Language code.
     * @param {boolean} showAllLabels Whether to show all labels.
     * @returns {void}
     */
    function activateInteractivity(renderer, graph, currentLang, showAllLabels) {
        renderer.setSettings({
            enableEdgeHovering: true,
            enableNodeHovering: true,
            enableCamera: true,
        });

        const tooltip = renderer.__dashboardTooltip;

        renderer.on('enterNode', ({ node, event }) => {
            const label = graph.getNodeAttribute(node, 'label');
            const neighbors = graph.neighbors(node);
            const lines = [];

            neighbors.forEach(neighbor => {
                const edge = graph.edge(node, neighbor) || graph.edge(neighbor, node);
                const weight = graph.getEdgeAttribute(edge, 'size') || 1;
                const neighborLabel = graph.getNodeAttribute(neighbor, 'label');
                lines.push(`• ${neighborLabel} (${weight})`);
            });

            tooltip.innerText = `${label}\n${currentLang === 'es' ? 'Colabora con:' : 'Collaborates with:'}\n${lines.join('\n')}`;
            tooltip.style.left = `${event.clientX + 10}px`;
            tooltip.style.top = `${event.clientY + 10}px`;
            tooltip.style.display = 'block';

            const visibleNodes = new Set(neighbors);
            visibleNodes.add(node);

            graph.forEachNode(n => {
                graph.setNodeAttribute(n, 'hidden', !visibleNodes.has(n));
                graph.setNodeAttribute(n, 'forceLabel', showAllLabels || visibleNodes.has(n));
            });

            graph.forEachEdge(e => {
                const src = graph.source(e);
                const tgt = graph.target(e);
                const visible = visibleNodes.has(src) && visibleNodes.has(tgt);
                graph.setEdgeAttribute(e, 'hidden', !visible);
            });
        });

        renderer.on('leaveNode', () => {
            tooltip.style.display = 'none';

            graph.forEachNode(n => {
                graph.removeNodeAttribute(n, 'hidden');
                graph.setNodeAttribute(n, 'forceLabel', showAllLabels);
            });

            graph.forEachEdge(e => graph.removeEdgeAttribute(e, 'hidden'));
        });

        renderer.getCamera().animatedReset({ duration: 500 });
    }

    /**
     * Initializes all network event handlers.
     *
     * This function binds:
     * - label toggle button
     * - dropdown community view options
     * - clustering modal apply button
     * - full network toggle button
     *
     * @param {{
     *   getRendererRef: () => (any|null),
     *   setRendererRef: (r: any|null) => void,
     *   getShowAllLabels: () => boolean,
     *   setShowAllLabels: (v: boolean) => void,
     * }} opts Runtime refs to keep state inside `dashboard.js`.
     * @returns {void}
     */
    function initNetworkHandlers(opts) {
        const {
            getRendererRef,
            setRendererRef,
            getShowAllLabels,
            setShowAllLabels,
        } = opts;

        // Label toggle
        const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');
        if (toggleLabelsBtn) {
            (function setInitialToggleLabel() {
                const langInit = (typeof detectLangFromPath === 'function')
                    ? detectLangFromPath()
                    : (window.location.pathname.split('/')[1] || 'es');
                toggleLabelsBtn.textContent = (langInit === 'es') ? 'Mostrar etiquetas' : 'Show All Labels';
            }());

            toggleLabelsBtn.addEventListener('click', () => {
                const renderer = getRendererRef();
                if (!renderer) {
                    console.warn('[LabelsToggle] Renderer not initialized yet');
                    return;
                }

                const next = !getShowAllLabels();
                setShowAllLabels(next);

                const lang = (typeof detectLangFromPath === 'function')
                    ? detectLangFromPath()
                    : (window.location.pathname.split('/')[1] || 'es');

                const txtShow = (lang === 'es') ? 'Mostrar etiquetas' : 'Show All Labels';
                const txtHide = (lang === 'es') ? 'Ocultar etiquetas extra' : 'Hide Extra Labels';

                if (next) {
                    renderer.setSettings({
                        labelDensity: Infinity,
                        labelGridCellSize: 1,
                        labelRenderedSizeThreshold: 0,
                    });
                    toggleLabelsBtn.textContent = txtHide;
                } else {
                    renderer.setSettings({
                        labelDensity: 1,
                        labelGridCellSize: 200,
                        labelRenderedSizeThreshold: 0,
                    });
                    toggleLabelsBtn.textContent = txtShow;
                }

                renderer.refresh();
            });
        }

        // Community view dropdown items (bootstrap dropdown)
        // NOTE (2026-01): Temporarily handled in `dashboard.js` to keep the legacy
        // full refresh flow stable. We'll remove this module duplication permanently
        // once the dashboard refactor is finished.

        // Clustering apply button
        const applyBtn = document.getElementById('applyClustering');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const configMode = document.querySelector('input[name="configMode"]:checked').value;
                const model = document.getElementById('clusteringModel').value;
                const modelConfigMode = document.querySelector('input[name="modelConfigMode"]:checked').value;

                let nClusters = document.getElementById('nClusters').value;
                if (model === 'dbscan') {
                    nClusters = document.getElementById('dbscanClusters').value;
                } else if (model === 'hdbscan') {
                    nClusters = document.getElementById('hdbscanClusters').value;
                } else if (model === 'lovaina') {
                    nClusters = document.getElementById('lovainaClusters').value;
                }

                window.currentCommunityView = 'keywords';
                window.currentClusteringModel = model;
                window.currentNClusters = nClusters;

                const params = new URLSearchParams({
                    communityView: 'keywords',
                    clusteringModel: model,
                    nClusters: nClusters,
                    autoMode: modelConfigMode === 'auto',
                    globalMode: configMode === 'global',
                });

                fetch(`/BiblioMetrics/${getLang()}/api/dashboard/collaboration-network/?${params.toString()}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            console.error('Error from backend:', data.error);
                            alert(`Ocurrió un error al generar la red: ${data.error}`);
                            return;
                        }

                        if (!data.nodes || !data.edges) {
                            console.error('Incomplete backend response:', data);
                            alert('La respuesta del servidor no contiene datos de red válidos.');
                            return;
                        }

                        window.currentNetworkData = data;

                        updateCommunityDropdownText(model, nClusters);
                        updateCollaborationNetwork(data, {
                            renderer: getRendererRef(),
                            setRenderer: setRendererRef,
                            showAllLabels: getShowAllLabels(),
                            setRenderer: setRendererRef,
                        });
                    })
                    .then(() => {
                        document.activeElement?.blur();
                        const modal = bootstrap.Modal.getInstance(document.getElementById('clusteringModal'));
                        modal?.hide();
                    })
                    .catch(error => {
                        console.error('Error in fetch request:', error);
                    });
            });
        }

        // Full network toggle button
        const toggleFullBtn = document.getElementById('toggleFullNetworkBtn');
        if (toggleFullBtn) {
            toggleFullBtn.addEventListener('click', function () {
                const button = this;
                const currentLang = detectLangFromPath();

                const nextFull = !getIsFullNetwork();

                button.disabled = true;
                button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' +
                    (currentLang === 'es' ? 'Cargando...' : 'Loading...');

                // Global overlay to ensure it's always visible (not hidden by canvas/z-index).
                const cleanupLoading = showNetworkLoading(currentLang === 'es' ? 'Cargando...' : 'Loading...');
                setIsFullNetwork(nextFull);

                button.textContent = currentLang === 'es'
                    ? (nextFull ? 'Mostrar Red de IPs' : 'Mostrar Red Completa')
                    : (nextFull ? 'Show IPs Network' : 'Show Full Network');

                const cardTitle = document.querySelector('#collaborationNetwork').closest('.card').querySelector('.card-title');
                cardTitle.textContent = currentLang === 'es'
                    ? (nextFull ? 'Red de Coautorías Interactiva Completa' : 'Red de Coautorías Interactiva entre IPs')
                    : (nextFull ? 'Complete Interactive Co-authorship Network' : 'Interactive Co-authorship Network between IPs');

                const params = new URLSearchParams({
                    communityView: window.currentCommunityView,
                    fullNetwork: nextFull,
                });

                if (window.currentClusteringModel) {
                    params.append('clusteringModel', window.currentClusteringModel);
                    params.append('nClusters', window.currentNClusters);
                    params.append('autoMode', 'true');
                    params.append('globalMode', 'true');
                }

                const dropdownItems = document.querySelectorAll('.network-community-view');
                dropdownItems.forEach(item => {
                    item.classList.remove('disabled');
                    item.style.pointerEvents = 'auto';
                    item.style.opacity = '1';
                });

                // Use the single refresh flow to fetch & render the network.
                // This prevents duplicated fetch paths and ensures the network is actually re-rendered.
                Promise.resolve(updateVisualizations({ skipPublicationsTable: true }))
                    .catch(error => {
                        console.error('Error updating visualizations:', error);
                        setIsFullNetwork(!nextFull);
                    })
                    .finally(() => {
                        cleanupLoading();
                        button.disabled = false;
                        button.textContent = currentLang === 'es'
                            ? (nextFull ? 'Mostrar Red de IPs' : 'Mostrar Red Completa')
                            : (nextFull ? 'Show IPs Network' : 'Show Full Network');
                    });
            });
        }
    }

    return {
        updateCollaborationNetwork: (data, ctx) => updateCollaborationNetwork(data, ctx),
        updateCommunityDropdownText,
        initNetworkHandlers,
    };
}
