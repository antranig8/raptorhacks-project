import * as d3 from 'd3';
import { calculateLevelData } from './levelUtils';

export const initSkillWeb = (svgRef, data, width, height, zoom) => {
    const svg = d3.select(svgRef.current)
        .attr("viewBox", [0, 0, width, height])
        .attr("width", "100%")
        .attr("height", "100%")
        .style("display", "block");

    svg.selectAll("*").remove();

    const canvas = svg.append("g");
    svg.call(zoom);

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
            const ring1Radius = 300;
            const siblings = d.parent.children;
            const index = siblings.indexOf(d);
            const angle = (index / siblings.length) * 2 * Math.PI;
            d.x = width / 2 + Math.cos(angle) * ring1Radius;
            d.y = height / 2 + Math.sin(angle) * ring1Radius;
        } else if (d.depth === 2) {
            const leafOrbitRadius = 150;
            const siblings = d.parent.children;
            const index = siblings.indexOf(d);
            const parentAngle = Math.atan2(d.parent.y - height / 2, d.parent.x - width / 2);
            const spread = Math.PI / 2;
            const step = siblings.length > 1 ? spread / (siblings.length - 1) : 0;
            const angle = parentAngle - (spread / 2) + (index * step);
            d.x = d.parent.x + Math.cos(angle) * leafOrbitRadius;
            d.y = d.parent.y + Math.sin(angle) * leafOrbitRadius;
        }
    });

    const links = root.links();
    const nodes = root.descendants();

    const link = canvas.append("g")
        .attr("stroke", "#444")
        .attr("stroke-opacity", 0.6)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke-width", d => Math.max(1, 4 - d.source.depth))
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    const node = canvas.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .call(d3.drag()
            .on("start", (event, d) => {
                if (d.depth === 0) return;
                d3.select(event.sourceEvent.target.parentNode).raise();
            })
            .on("drag", function (event, d) {
                if (d.depth === 0) return;
                let newX = event.x;
                let newY = event.y;
                const margin = 1;

                nodes.forEach(other => {
                    if (d === other) return;
                    const dL = newX - d.dims.w / 2 - margin;
                    const dR = newX + d.dims.w / 2 + margin;
                    const dT = newY - d.dims.h / 2 - margin;
                    const dB = newY + d.dims.h / 2 + margin;
                    const oL = other.x - other.dims.w / 2 - margin;
                    const oR = other.x + other.dims.w / 2 + margin;
                    const oT = other.y - other.dims.h / 2 - margin;
                    const oB = other.y + other.dims.h / 2 + margin;

                    if (dL < oR && dR > oL && dT < oB && dB > oT) {
                        const overlapX = Math.min(dR - oL, oR - dL);
                        const overlapY = Math.min(dB - oT, oB - dT);
                        if (overlapX < overlapY) { newX += (newX > other.x) ? overlapX : -overlapX; }
                        else { newY += (newY > other.y) ? overlapY : -overlapY; }
                    }
                });

                d.x = newX; d.y = newY;
                d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
                link.filter(l => l.source === d).attr("x1", d.x).attr("y1", d.y);
                link.filter(l => l.target === d).attr("x2", d.x).attr("y2", d.y);
            }))
        .on("click", (event, d) => {
            event.stopPropagation();
            const scale = 1.2;
            const tx = width / 2 - d.x * scale;
            const ty = height / 2 - d.y * scale;
            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(tx, ty).scale(scale)
            );
        });

    node.append("rect")
        .attr("width", d => d.dims.w)
        .attr("height", d => d.dims.h)
        .attr("x", d => -d.dims.w / 2)
        .attr("y", d => -d.dims.h / 2)
        .attr("rx", d => d.dims.rx)
        .attr("ry", d => d.dims.rx)
        .attr("fill", d => d.depth === 0 ? "#8b5cf6" : (d.depth === 1 ? "#3b82f6" : "#10b981"))
        .attr("stroke", "#1e1e1e")
        .attr("stroke-width", 2);

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
            .attr("width", pw).attr("height", ph).attr("x", -pw / 2).attr("y", -ph / 2).attr("rx", prx).attr("ry", prx)
            .attr("fill", "none").attr("stroke", colorScale(d.levelData.progressPercentage))
            .attr("stroke-width", 5).attr("stroke-linecap", "round").attr("stroke-dasharray", dashArray).attr("stroke-dashoffset", 0);
    });

    node.append("text").attr("dy", "-0.2em").attr("text-anchor", "middle").text(d => d.data.name).style("font-size", d => d.depth === 0 ? "16px" : "14px").style("font-weight", "600").style("fill", "#fff").style("pointer-events", "none");
    node.append("text").attr("dy", "1.4em").attr("text-anchor", "middle").text(d => `${d.levelData.xpInCurrentLevel} / ${d.levelData.xpRequiredForNextLevel} xp`).style("font-size", "12px").style("fill", "rgba(255,255,255,0.7)").style("pointer-events", "none");

    return canvas;
};
