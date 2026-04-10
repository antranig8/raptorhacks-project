import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useNavigate } from "react-router-dom";
import styles from "@dashboard/styles/SkillTree.module.css";
import { initSkillWeb } from "./skillWebD3";
import { emptyPlanData, fetchDataForUser } from "./skillTreeData";
import SkillTreeHeader from "./SkillTreeHeader";

export default function SkillTree() {
    const navigate = useNavigate();
    const svgRef = useRef(null);
    const zoomRef = useRef(null);
    const apiRef = useRef(null);
    const [isPlaceholder, setIsPlaceholder] = useState(false);

    useEffect(() => {
        if (!svgRef.current) return;

        zoomRef.current = d3.zoom()
            .scaleExtent([0.2, 4])
            .on("zoom", (event) => {
                d3.select(svgRef.current).select("g").attr("transform", event.transform);
            });

        let isCancelled = false;

        const loadSkillTree = async () => {
            try {
                const skillTree = await fetchDataForUser();
                if (isCancelled || !svgRef.current) return;
                setIsPlaceholder(Boolean(skillTree.isPlaceholder));

                const container = d3.select(svgRef.current).node().parentNode;
                const width = container.clientWidth || 800;
                const height = container.clientHeight || 600;

                apiRef.current = initSkillWeb(
                    svgRef,
                    skillTree.data,
                    width,
                    height,
                    zoomRef.current,
                    (node) => {
                        if (skillTree.isPlaceholder) {
                            navigate('/dashboard/plan');
                            return;
                        }

                        // A node click becomes the quiz entry point. We carry the
                        // stable skillTreeId and nodeId through the route so the
                        // quiz page can fetch its data without shared app state.
                        if (!skillTree.skillTreeId || !node?.id) {
                            return;
                        }

                        navigate(`/dashboard/quizzes?skillTreeId=${encodeURIComponent(skillTree.skillTreeId)}&nodeId=${encodeURIComponent(node.id)}`, {
                            state: {
                                nodeName: node.name,
                                skillTreeName: skillTree.treeName,
                            },
                        });
                    },
                );
            } catch (error) {
                if (isCancelled || !svgRef.current) return;
                setIsPlaceholder(true);

                const container = d3.select(svgRef.current).node().parentNode;
                const width = container.clientWidth || 800;
                const height = container.clientHeight || 600;

                console.error("Failed to load skill tree data.", error);
                apiRef.current = initSkillWeb(
                    svgRef,
                    emptyPlanData,
                    width,
                    height,
                    zoomRef.current,
                    () => {
                        navigate('/dashboard/plan');
                    },
                );
            }
        };

        loadSkillTree();

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                apiRef.current?.undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                apiRef.current?.redo();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            isCancelled = true;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [navigate]);

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

    const handleUndo = () => apiRef.current?.undo();
    const handleRedo = () => apiRef.current?.redo();

    return (
        <section className={styles.container} style={{ width: "100%", height: "calc(100vh - 100px)", overflow: "hidden", display: "flex", flexDirection: "column", padding: 0 }}>
            <SkillTreeHeader
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onTreesClick={() => navigate('/dashboard/plan')}
            />
            <div className={`${styles.canvasArea} ${isPlaceholder ? styles.canvasAreaPlaceholder : ''}`}>
                {isPlaceholder && (
                    <div className={styles.placeholderOverlay}>
                        <div className={styles.placeholderCard}>
                            <p className={styles.placeholderEyebrow}>No Active Tree</p>
                            <h3 className={styles.placeholderTitle}>Create your first plan</h3>
                            <p className={styles.placeholderText}>
                                There is no saved skill tree yet. Start with a plan and the roadmap will appear here.
                            </p>
                            <button
                                className={styles.placeholderButton}
                                type="button"
                                onClick={() => navigate('/dashboard/plan')}
                            >
                                Create Plan
                            </button>
                        </div>
                    </div>
                )}
                <svg ref={svgRef}></svg>
            </div>
        </section>
    );
}
