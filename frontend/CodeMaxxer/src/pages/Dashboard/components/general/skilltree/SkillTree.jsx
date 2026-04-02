import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import styles from "@dashboard/styles/SkillTree.module.css";
import { initSkillWeb } from "./skillWebD3";
import { mockData } from "./skillTreeData";
import SkillTreeHeader from "./SkillTreeHeader";

export default function SkillTree() {
    const svgRef = useRef(null);
    const zoomRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current) return;

        const container = d3.select(svgRef.current).node().parentNode;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        zoomRef.current = d3.zoom()
            .scaleExtent([0.2, 4])
            .on("zoom", (event) => {
                d3.select(svgRef.current).select("g").attr("transform", event.transform);
            });

        initSkillWeb(svgRef, mockData, width, height, zoomRef.current);

    }, []);

    const handleZoomIn = () => {
        if (zoomRef.current && svgRef.current) {
            d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.2);
        }
    };

    const handleZoomOut = () => {
        if (zoomRef.current && svgRef.current) {
            d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 0.8);
        }
    };

    const handleReset = () => {
        if (zoomRef.current && svgRef.current) {
            const transform = d3.zoomIdentity;
            d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, transform);
        }
    };

    return (
        <section className={styles.container} style={{ width: "100%", height: "calc(100vh - 100px)", overflow: "hidden", display: "flex", flexDirection: "column", padding: 0 }}>
            <SkillTreeHeader onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <svg ref={svgRef}></svg>
            </div>
        </section>
    );
}
