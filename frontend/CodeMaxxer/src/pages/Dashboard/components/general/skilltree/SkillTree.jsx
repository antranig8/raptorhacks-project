import React, { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useNavigate } from "react-router-dom";
import styles from "@dashboardStyles/skilltree/SkillTree.module.css";
import { initSkillWeb } from "./skillWebD3";
import { emptyPlanData, fetchDataForUser } from "./skillTreeData";
import SkillTreeHeader from "./SkillTreeHeader";

const getNodePurpose = (node) => {
    if (!node) return "";

    const childNames = (node.children || []).map((child) => child.name).filter(Boolean);
    const nodeName = node.name || "this topic";
    const normalizedName = nodeName.toLowerCase();

    const descriptions = [
        {
            matches: ["function", "parameter"],
            text: "Functions group reusable code; parameters pass values into them.",
        },
        {
            matches: ["function"],
            text: "Functions group reusable code so one task can be called from multiple places.",
        },
        {
            matches: ["parameter", "argument"],
            text: "Parameters define the inputs a function accepts; arguments are the values passed in.",
        },
        {
            matches: ["variable"],
            text: "Variables name stored values so code can read, update, and reuse them.",
        },
        {
            matches: ["loop"],
            text: "Loops repeat a block of code while a condition or collection still has work left.",
        },
        {
            matches: ["array", "list"],
            text: "Arrays and lists store ordered values that can be indexed, looped over, and changed.",
        },
        {
            matches: ["object", "dictionary", "hash"],
            text: "Objects and maps store related values by key so data can be looked up quickly.",
        },
        {
            matches: ["class", "object oriented", "oop"],
            text: "Classes package data and behavior into reusable object blueprints.",
        },
        {
            matches: ["recursion"],
            text: "Recursion solves a problem by having a function call itself on smaller pieces.",
        },
        {
            matches: ["async", "asynchronous", "promise"],
            text: "Asynchronous code lets long-running work finish later without blocking everything else.",
        },
        {
            matches: ["api", "rest"],
            text: "APIs define how programs request data or actions from other services.",
        },
        {
            matches: ["component", "react"],
            text: "Components split an interface into reusable pieces with their own data and behavior.",
        },
        {
            matches: ["git", "branch"],
            text: "Branches let you develop changes separately before merging them back together.",
        },
    ];

    const match = descriptions.find(({ matches }) => (
        matches.every((term) => normalizedName.includes(term))
    ));

    if (match) {
        return match.text;
    }

    if (childNames.length > 0) {
        const childSummary = childNames.slice(0, 3).join(", ");
        return `Breaks ${nodeName} into ${childSummary}.`;
    }

    return `Covers what ${nodeName} means, how it works, and when to use it.`;
};

const buildQuizPath = (node) => (
    `/dashboard/quizzes?skillTreeId=${encodeURIComponent(node.skillTreeId)}&nodeId=${encodeURIComponent(node.id)}`
);

export default function SkillTree() {
    const navigate = useNavigate();
    const svgRef = useRef(null);
    const canvasAreaRef = useRef(null);
    const zoomRef = useRef(null);
    const apiRef = useRef(null);
    const [isPlaceholder, setIsPlaceholder] = useState(false);
    const [activeNode, setActiveNode] = useState(null);

    const placeNodePopover = useCallback((pointer) => {
        const canvas = canvasAreaRef.current;
        if (!canvas || !pointer) {
            return { x: 24, y: 24 };
        }

        const bounds = canvas.getBoundingClientRect();
        const rawX = pointer.clientX - bounds.left;
        const rawY = pointer.clientY - bounds.top;
        const halfWidth = Math.min(120, Math.max(100, (bounds.width - 32) / 2));
        const x = Math.min(Math.max(rawX, halfWidth + 16), Math.max(halfWidth + 16, bounds.width - halfWidth - 16));
        const y = Math.min(Math.max(rawY + 18, 18), Math.max(18, bounds.height - 105));

        return { x, y };
    }, []);

    const handleStartQuiz = () => {
        if (!activeNode?.skillTreeId || !activeNode?.id) return;

        navigate(buildQuizPath(activeNode), {
            state: {
                nodeName: activeNode.name,
                skillTreeName: activeNode.skillTreeName,
            },
        });
    };

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
                    (node, pointer) => {
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

                        setActiveNode({
                            ...node,
                            skillTreeId: skillTree.skillTreeId,
                            skillTreeName: skillTree.treeName,
                            purpose: getNodePurpose(node),
                            popoverPosition: placeNodePopover(pointer),
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
    }, [navigate, placeNodePopover]);

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
            <div
                ref={canvasAreaRef}
                className={`${styles.canvasArea} ${isPlaceholder ? styles.canvasAreaPlaceholder : ''}`}
                onClick={() => setActiveNode(null)}
            >
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
                {activeNode && !isPlaceholder && (
                    <div
                        className={styles.nodePopover}
                        style={{
                            left: `${activeNode.popoverPosition.x}px`,
                            top: `${activeNode.popoverPosition.y}px`,
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={styles.nodeInfoBox}>
                            <p className={styles.nodeEyebrow}>{activeNode.difficulty || "skill node"}</p>
                            <h3 className={styles.nodeTitle}>{activeNode.name}</h3>
                            <p className={styles.nodeDescription}>{activeNode.purpose}</p>
                        </div>
                        <button
                            className={styles.nodeQuizButton}
                            type="button"
                            onClick={handleStartQuiz}
                        >
                            Start Quiz
                        </button>
                    </div>
                )}
                <svg ref={svgRef}></svg>
            </div>
        </section>
    );
}
