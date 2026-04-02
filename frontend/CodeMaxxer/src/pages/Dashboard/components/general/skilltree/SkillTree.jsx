import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import styles from "@dashboard/styles/SkillTree.module.css";
import { initSkillWeb } from "./skillWebD3";
import { mockData } from "./skillTreeData";

export default function SkillTree() {
    const svgRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current) return;

        const container = d3.select(svgRef.current).node().parentNode;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        const zoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on("zoom", (event) => {
                d3.select(svgRef.current).select("g").attr("transform", event.transform);
            });

        initSkillWeb(svgRef, mockData, width, height, zoom);

    }, []);

    return (
        <section className={styles.container} style={{ width: "100%", height: "calc(100vh - 100px)", overflow: "hidden" }}>
            <svg ref={svgRef}></svg>
        </section>
    );
}
