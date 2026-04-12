import * as d3 from 'd3';
import { calculateLevelData } from './levelUtils';

export const initSkillWeb = (svgRef, data, width, height, zoom, onNodeClick) => {
    const getNodeKey = (node) => node.data.id ?? node.data.name;

    const svg = d3.select(svgRef.current)
        .attr("viewBox", [0, 0, width, height])
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block");

    svg.selectAll("*").remove();

    const canvas = svg.append("g");
    svg.call(zoom).on("dblclick.zoom", null); // Disable default double-click zoom

    const root = d3.hierarchy(data);
    const measureCanvas = document.createElement("canvas");
    const context = measureCanvas.getContext("2d");

    // Pre-calculate all node positions and dimensions
    root.descendants().forEach(d => {
        d.levelData = calculateLevelData(d.data.xp || 0);

        const fontSize = d.depth === 0 ? "16px" : "14px";
        context.font = `600 ${fontSize} sans-serif`;
        const textWidth = context.measureText(d.data.name).width;

        const padding = 40;
        const minWidth = d.depth === 0 ? 120 : 100;
        const widthNode = Math.max(minWidth, textWidth + padding);
        const heightNode = d.depth === 0 ? 80 : (d.depth === 1 ? 70 : 65);

        d.dims = {
            w: widthNode,
            h: heightNode,
            rx: d.depth === 0 ? 12 : (d.depth === 1 ? 10 : 8)
        };

        // Layout Ring logic
        if (d.depth === 0) {
            d.x = width / 2;
            d.y = height / 2;
        } else if (d.depth === 1) {
            const ring1Radius = 360;
            const siblings = d.parent.children;
            const index = siblings.indexOf(d);
            const angle = (index / siblings.length) * 2 * Math.PI;
            d.x = width / 2 + Math.cos(angle) * ring1Radius;
            d.y = height / 2 + Math.sin(angle) * ring1Radius;
        } else if (d.depth >= 2) {
            const orbitRadius = d.depth === 2 ? 235 : 165; // Give lower levels more room around their parent.
            const siblings = d.parent.children;
            const index = siblings.indexOf(d);
            // Calculate angle pointing away from the grandparent to spread outward
            const parentAngle = Math.atan2(d.parent.y - d.parent.parent.y, d.parent.x - d.parent.parent.x);
            const spread = Math.PI / 1.2; // Widen sibling spread to reduce branch overlap.
            const step = siblings.length > 1 ? spread / (siblings.length - 1) : 0;
            const angle = parentAngle - (spread / 2) + (index * step);
            d.x = d.parent.x + Math.cos(angle) * orbitRadius;
            d.y = d.parent.y + Math.sin(angle) * orbitRadius;
        }
    });

    // Use D3 force simulation to resolve overlaps, specifically for leaf nodes
    const movableNodes = root.descendants().filter(node => node.depth > 0);
    const simulation = d3.forceSimulation(movableNodes)
        .force("x", d3.forceX(d => d.x).strength(0.5))
        .force("y", d3.forceY(d => d.y).strength(0.5))
        .force("collide", d3.forceCollide().radius(d => (Math.max(d.dims.w, d.dims.h) / 2) + 34).iterations(5))
        .stop();

    // Run the simulation for a few ticks to stabilize
    for (let i = 0; i < 180; ++i) simulation.tick();

    let history = [];
    let historyIndex = -1;

    function saveHistory() {
        const state = {};
        root.descendants().forEach(n => {
            state[getNodeKey(n)] = { x: n.x, y: n.y };
        });

        // Avoid duplicate states in history (no effective move)
        if (historyIndex >= 0) {
            const currentState = history[historyIndex];
            let identical = true;
            for (const key in state) {
                if (!currentState[key] || currentState[key].x !== state[key].x || currentState[key].y !== state[key].y) {
                    identical = false;
                    break;
                }
            }
            if (identical) return;
        }

        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(state);
        historyIndex++;
    }


    const links = root.links();
    const nodes = root.descendants();

    const linkColorScale = d3.scaleLinear().domain([0, 0.5, 1]).range(["#ef4444", "#fbbf24", "#22c55e"]).interpolate(d3.interpolateRgb);

    const link = canvas.append("g")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", d => linkColorScale(d.target.levelData.progressPercentage))
        .attr("stroke-width", d => Math.max(1, 4 - d.source.depth))
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    const selectedNodes = new Set();

    svg.on("click", () => {
        if (selectedNodes.size > 0) {
            selectedNodes.clear();
            updateSelectionState();
        }
    })
    .on("contextmenu", (event) => {
        event.preventDefault();
    });

    const node = canvas.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .style("cursor", "pointer")
        .call(d3.drag()
            .on("start", (event, d) => {
                if (d.depth === 0) return;
                d._didMove = false;
            })
            .on("drag", function (event, d) {
                if (d.depth === 0) return;

                // Raise the element to the front only when actually dragging to preserve clicks
                d3.select(this).raise();

                const dx = event.dx;
                const dy = event.dy;

                if (dx !== 0 || dy !== 0) {
                    d._didMove = true;
                }

                const targets = selectedNodes.has(d) ? Array.from(selectedNodes).filter(n => n.depth !== 0) : [d];

                targets.forEach(targetNode => {
                    targetNode.x += dx;
                    targetNode.y += dy;
                });

                node.attr("transform", n => `translate(${n.x},${n.y})`);
                link.attr("x1", l => l.source.x)
                    .attr("y1", l => l.source.y)
                    .attr("x2", l => l.target.x)
                    .attr("y2", l => l.target.y);
            })
            .on("end", (event, d) => {
                if (d.depth === 0) return;
                if (d._didMove) {
                    saveHistory();
                }
            }))
        .on("click", (event, d) => {
            event.stopPropagation();
            // Ignore the synthetic click that lands after a drag so moving
            // nodes does not accidentally open a quiz.
            if (d._didMove) {
                d._didMove = false;
                return;
            }
            if (selectedNodes.has(d)) {
                selectedNodes.delete(d);
            } else {
                selectedNodes.add(d);
            }
            updateSelectionState();
            // Bubble the clicked node back to React so routing and API calls
            // stay in the normal component layer instead of inside D3 state.
            onNodeClick?.(d.data, {
                clientX: event.sourceEvent?.clientX ?? event.clientX,
                clientY: event.sourceEvent?.clientY ?? event.clientY,
            });
        })
        .on("dblclick", (event, d) => {
            event.stopPropagation();
            d.descendants().forEach(child => selectedNodes.add(child));
            updateSelectionState();
        });

    const mainRects = node.append("rect")
        .attr("width", d => d.dims.w)
        .attr("height", d => d.dims.h)
        .attr("x", d => -d.dims.w / 2)
        .attr("y", d => -d.dims.h / 2)
        .attr("rx", d => d.dims.rx)
        .attr("ry", d => d.dims.rx)
        .attr("fill", d => {
            if (d.depth === 0) return "#4f46e5"; // Indigo for Root
            if (d.depth === 1) return "#2563eb"; // Blue for Topics
            if (d.depth === 2) return "#059669"; // Green for Skills
            return "#d97706"; // Amber for Subskills (Depth 3+)
        })
        .style("filter", "drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.3))"); // Replaced border with soft shadow

    function updateSelectionState() {
        mainRects.each(function (d) {
            const isSelected = selectedNodes.has(d);
            const rect = d3.select(this);
            const currSelected = rect.attr("data-selected") === "true";

            if (isSelected !== currSelected) {
                rect.attr("data-selected", isSelected ? "true" : "false")
                    .transition().duration(200)
                    .style("stroke", isSelected ? "#000" : "none")
                    .style("stroke-width", isSelected ? "3px" : "0px")
                    .style("filter", isSelected ? "none" : "drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.3))");

                const parentNode = d3.select(this.parentNode);
                parentNode.selectAll(".progress-rect")
                    .style("display", isSelected ? "none" : "block");
            }
        });
    }

    node.each(function (d) {
        const group = d3.select(this);
        const m = 6;
        const pw = d.dims.w + m * 2;
        const ph = d.dims.h + m * 2;
        const prx = d.dims.rx + m;
        const perimeter = 2 * (pw + ph) - (8 * prx) + (2 * Math.PI * prx);
        const dashArray = `${d.levelData.progressPercentage * perimeter} ${perimeter}`;
        const colorScale = d3.scaleLinear().domain([0, 0.5, 1]).range(["#ef4444", "#fbbf24", "#22c55e"]).interpolate(d3.interpolateRgb);

        group.append("rect")
            .attr("class", "progress-rect")
            .attr("width", pw).attr("height", ph).attr("x", -pw / 2).attr("y", -ph / 2).attr("rx", prx).attr("ry", prx)
            .attr("fill", "none").attr("stroke", colorScale(d.levelData.progressPercentage))
            .attr("stroke-width", 5).attr("stroke-linecap", "round").attr("stroke-dasharray", dashArray).attr("stroke-dashoffset", 0);

        // Skill Level Circle Indicator
        const radius = 12;
        const cx = d.dims.w / 2;
        const cy = -d.dims.h / 2;

        group.append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", radius)
            .attr("fill", "#1e1e1e")
            .attr("stroke", colorScale(d.levelData.progressPercentage))
            .attr("stroke-width", 2);

        group.append("text")
            .attr("x", cx)
            .attr("y", cy)
            .attr("dy", "0.3em")
            .attr("text-anchor", "middle")
            .text(d.levelData.currentLevel)
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("fill", "#fff")
            .style("pointer-events", "none");
    });

    node.append("text").attr("dy", "-0.2em").attr("text-anchor", "middle").text(d => d.data.name).style("font-size", d => d.depth === 0 ? "16px" : "14px").style("font-weight", "600").style("fill", "#fff").style("pointer-events", "none");
    node.append("text").attr("dy", "1.4em").attr("text-anchor", "middle").text(d => `${d.levelData.xpInCurrentLevel} / ${d.levelData.xpRequiredForNextLevel} xp`).style("font-size", "12px").style("fill", "rgba(255,255,255,0.7)").style("pointer-events", "none");

    const controller = {
        undo: () => {
            if (historyIndex > 0) {
                historyIndex--;
                const prevState = history[historyIndex];
                applyState(prevState);
            }
        },
        redo: () => {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                const nextState = history[historyIndex];
                applyState(nextState);
            }
        }
    };

    function applyState(state) {
        nodes.forEach(n => {
            const nodeKey = getNodeKey(n);
            if (state[nodeKey]) {
                n.x = state[nodeKey].x;
                n.y = state[nodeKey].y;
            }
        });
        node.transition().duration(300).attr("transform", n => `translate(${n.x},${n.y})`);
        link.transition().duration(300)
            .attr("x1", l => l.source.x)
            .attr("y1", l => l.source.y)
            .attr("x2", l => l.target.x)
            .attr("y2", l => l.target.y);
    }

    return controller;
};
