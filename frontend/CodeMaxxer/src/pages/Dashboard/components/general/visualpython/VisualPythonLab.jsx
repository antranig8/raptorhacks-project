import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "@dashboard/styles/VisualPythonLab.module.css";
import { explainVisualPythonCode, renderCanvas, simulateProjectile } from "./visualPythonApi";

const LABS = {
    projectile: {
        title: "Projectile Motion Lab",
        editorTitle: "Python Update Code",
        subtitle: "Change the Python update lines, run the simulation, and watch how the path changes.",
        runLabel: "Run Simulation",
        runningLabel: "Running...",
    },
    canvas: {
        title: "Python Canvas Lab",
        editorTitle: "Python Drawing Code",
        subtitle: "Write drawing calls, render the canvas, and inspect each visual command.",
        runLabel: "Render Canvas",
        runningLabel: "Rendering...",
    },
};

const DEFAULT_PROJECTILE_CODE = `vy = vy - gravity * dt
x = x + vx * dt
y = y + vy * dt`;

const DEFAULT_CANVAS_CODE = `x = 5
y = 3
point(x, y)
line(0, 0, x, y)
radius = 1
circle(x, y, radius)`;

const DEFAULT_SETUP = {
    gravity: 9.8,
    speed: 20,
    angle: 45,
    dt: 0.05,
    max_steps: 240,
};

function frameBounds(frames) {
    const maxX = Math.max(...frames.map((frame) => frame.x), 1);
    const maxY = Math.max(...frames.map((frame) => frame.y), 1);
    return { maxX, maxY };
}

function formatFrameValue(value) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) {
        return "--";
    }

    return Number(value).toFixed(2);
}

function formatStepChange(step) {
    if (!step || step.before === undefined || step.after === undefined) return "";
    return `${formatFrameValue(step.before)} -> ${formatFrameValue(step.after)}`;
}

function getCodeLines(code) {
    return code
        .split("\n")
        .map((line, index) => ({ id: `${index}-${line}`, lineNumber: index + 1, text: line.trim() }))
        .filter((line) => line.text.length > 0);
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function addPoint(points, x, y) {
    if (isFiniteNumber(x) && isFiniteNumber(y)) {
        points.push([x, y]);
    }
}

function getCanvasBounds(objects, plotWidth = 1, plotHeight = 1) {
    const points = [];

    objects.forEach((object) => {
        if (object.type === "point" || object.type === "circle") {
            const radius = object.radius || 0;
            addPoint(points, object.x - radius, object.y - radius);
            addPoint(points, object.x + radius, object.y + radius);
        }
        if (object.type === "line") {
            addPoint(points, object.x1, object.y1);
            addPoint(points, object.x2, object.y2);
        }
        if (object.type === "rect") {
            const x2 = object.x + object.width;
            const y2 = object.y + object.height;
            addPoint(points, Math.min(object.x, x2), Math.min(object.y, y2));
            addPoint(points, Math.max(object.x, x2), Math.max(object.y, y2));
        }
    });

    if (points.length === 0) {
        return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    }

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    let minX = Math.min(...xs, 0);
    let maxX = Math.max(...xs, 10);
    let minY = Math.min(...ys, 0);
    let maxY = Math.max(...ys, 10);

    if (minX < 0) {
        minX -= Math.max(Math.abs(minX) * 0.08, 1);
    }
    if (maxX > 10) {
        maxX += Math.max((maxX - 10) * 0.08, 1);
    }
    if (minY < 0) {
        minY -= Math.max(Math.abs(minY) * 0.08, 1);
    }
    if (maxY > 10) {
        maxY += Math.max((maxY - 10) * 0.08, 1);
    }

    const targetAspect = plotWidth / Math.max(plotHeight, 1);
    const currentAspect = (maxX - minX) / Math.max(maxY - minY, 1);

    if (currentAspect > targetAspect) {
        const targetHeight = (maxX - minX) / targetAspect;
        const centerY = (minY + maxY) / 2;
        minY = centerY - targetHeight / 2;
        maxY = centerY + targetHeight / 2;
    } else {
        const targetWidth = (maxY - minY) * targetAspect;
        const centerX = (minX + maxX) / 2;
        minX = centerX - targetWidth / 2;
        maxX = centerX + targetWidth / 2;
    }

    return { minX, maxX, minY, maxY };
}

function getNiceTickStep(range) {
    if (!Number.isFinite(range) || range <= 0) return 1;

    const rawStep = range / 8;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;

    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
}

function buildTicks(min, max) {
    const step = getNiceTickStep(max - min);
    const ticks = [];
    const start = Math.ceil(min / step) * step;

    for (let value = start; value <= max + step * 0.5; value += step) {
        ticks.push(Number(value.toFixed(8)));
    }

    return ticks;
}

function formatTick(value) {
    if (Math.abs(value) < 1e-8) return "0";
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toFixed(2)));
}

export default function VisualPythonLab() {
    const sketchHostRef = useRef(null);
    const p5InstanceRef = useRef(null);
    const sketchStateRef = useRef({ lab: "projectile", frames: [], activeIndex: 0, objects: [] });
    const animationTimerRef = useRef(null);
    const [activeLab, setActiveLab] = useState("projectile");
    const [setup, setSetup] = useState(DEFAULT_SETUP);
    const [projectileCode, setProjectileCode] = useState(DEFAULT_PROJECTILE_CODE);
    const [canvasCode, setCanvasCode] = useState(DEFAULT_CANVAS_CODE);
    const [frames, setFrames] = useState([]);
    const [canvasObjects, setCanvasObjects] = useState([]);
    const [canvasSteps, setCanvasSteps] = useState([]);
    const [canvasVariables, setCanvasVariables] = useState({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isExplaining, setIsExplaining] = useState(false);
    const [isLabsOpen, setIsLabsOpen] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [explanation, setExplanation] = useState("");

    const labConfig = LABS[activeLab];
    const activeCode = activeLab === "projectile" ? projectileCode : canvasCode;
    const setActiveCode = activeLab === "projectile" ? setProjectileCode : setCanvasCode;
    const activeFrame = frames[Math.min(activeIndex, Math.max(frames.length - 1, 0))];
    const codeLines = useMemo(() => getCodeLines(activeCode), [activeCode]);
    const activeSteps = activeLab === "projectile" ? activeFrame?.steps || [] : canvasSteps;
    const visualActions = activeSteps.length > 0
        ? activeSteps.map((step, index) => ({
            id: `${step.line}-${step.target || step.command}-${index}`,
            lineNumber: step.line,
            text: step.code,
            label: step.description,
            change: formatStepChange(step),
            target: step.target || step.command,
        }))
        : codeLines.map((line) => ({
            ...line,
            label: "Run to trace this line",
            change: "",
            target: "",
        }));
    const activeLineNumbers = new Set(activeSteps.map((step) => step.line));
    const canUseTimeline = activeLab === "projectile" && frames.length > 0;
    const finalFrameIndex = Math.max(frames.length - 1, 0);
    const stateRows = activeLab === "projectile"
        ? [
            { label: "Time", key: "t", value: activeFrame?.t },
            { label: "X position", key: "x", value: activeFrame?.x },
            { label: "Y position", key: "y", value: activeFrame?.y },
            { label: "X velocity", key: "vx", value: activeFrame?.vx },
            { label: "Y velocity", key: "vy", value: activeFrame?.vy },
            { label: "Gravity", key: "gravity", value: setup.gravity },
            { label: "Time step", key: "dt", value: setup.dt },
        ]
        : [
            { label: "Objects", key: "objects", value: canvasObjects.length },
            { label: "Points", key: "points", value: canvasObjects.filter((object) => object.type === "point").length },
            { label: "Lines", key: "lines", value: canvasObjects.filter((object) => object.type === "line").length },
            { label: "Circles", key: "circles", value: canvasObjects.filter((object) => object.type === "circle").length },
            { label: "Rectangles", key: "rects", value: canvasObjects.filter((object) => object.type === "rect").length },
            { label: "Code steps", key: "steps", value: canvasSteps.length },
            ...Object.entries(canvasVariables).map(([name, value]) => ({
                label: `Variable ${name}`,
                key: `variable-${name}`,
                value,
            })),
        ];
    const activeStepLabel = activeSteps.length > 0
        ? `${activeSteps.length} code steps applied`
        : "Waiting for output";

    const setupFields = useMemo(() => [
        { key: "gravity", label: "Gravity", min: -20, max: 30, step: 0.1 },
        { key: "speed", label: "Speed", min: 0, max: 80, step: 1 },
        { key: "angle", label: "Angle", min: -20, max: 85, step: 1 },
        { key: "dt", label: "Time step", min: 0.01, max: 0.2, step: 0.01 },
    ], []);

    const stopPlayback = useCallback(() => {
        setIsPlaying(false);
        window.clearInterval(animationTimerRef.current);
        animationTimerRef.current = null;
    }, []);

    const runLab = useCallback(async () => {
        setIsRunning(true);
        setError("");
        setMessage("");
        stopPlayback();

        try {
            if (activeLab === "projectile") {
                const result = await simulateProjectile({ setup, updateCode: projectileCode });
                const nextFrames = result.frames || [];
                setFrames(nextFrames);
                setActiveIndex(0);
                setMessage(result.message || "Simulation ran.");
                setIsPlaying(nextFrames.length > 1);
                return;
            }

            const result = await renderCanvas({ code: canvasCode });
            setCanvasObjects(result.objects || []);
            setCanvasSteps(result.steps || []);
            setCanvasVariables(result.variables || {});
            setMessage(result.message || "Canvas rendered.");
        } catch (requestError) {
            setError(requestError.message || "Visual Python request failed.");
        } finally {
            setIsRunning(false);
        }
    }, [activeLab, canvasCode, projectileCode, setup, stopPlayback]);

    const handleExplain = async () => {
        setIsExplaining(true);
        setError("");

        try {
            const result = await explainVisualPythonCode({ lab: activeLab, updateCode: activeCode });
            setExplanation(result.explanation || "No explanation returned.");
        } catch (requestError) {
            setError(requestError.message || "Could not explain the code.");
        } finally {
            setIsExplaining(false);
        }
    };

    const switchLab = (lab) => {
        stopPlayback();
        setActiveLab(lab);
        setIsLabsOpen(false);
        setError("");
        setMessage("");
        setExplanation("");
    };

    const stepBackward = () => {
        stopPlayback();
        setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
    };

    const stepForward = () => {
        stopPlayback();
        setActiveIndex((currentIndex) => Math.min(currentIndex + 1, finalFrameIndex));
    };

    const resetTimeline = () => {
        stopPlayback();
        setActiveIndex(0);
    };

    const togglePlayback = () => {
        if (!canUseTimeline || frames.length < 2) return;

        setIsPlaying((currentValue) => {
            if (currentValue) return false;

            if (activeIndex >= finalFrameIndex) {
                setActiveIndex(0);
            }

            return true;
        });
    };

    useEffect(() => {
        if (!sketchHostRef.current || p5InstanceRef.current) return undefined;

        let isCancelled = false;

        const createSketch = (P5) => new P5((sketch) => {
            const padding = 34;

            const drawProjectile = (sketchFrames, sketchIndex) => {
                const width = sketch.width;
                const height = sketch.height;
                const groundY = height - padding;

                sketch.stroke("#dbe4f0");
                sketch.strokeWeight(2);
                sketch.line(padding, groundY, width - padding, groundY);

                if (sketchFrames.length === 0) {
                    sketch.noStroke();
                    sketch.fill("#52637a");
                    sketch.textAlign(sketch.CENTER, sketch.CENTER);
                    sketch.text("Run the simulation to draw a projectile path.", width / 2, height / 2);
                    return;
                }

                const { maxX, maxY } = frameBounds(sketchFrames);
                const scaleX = (width - padding * 2) / Math.max(maxX, 1);
                const scaleY = (height - padding * 2) / Math.max(maxY, 1);
                const scale = Math.min(scaleX, scaleY);

                sketch.noFill();
                sketch.stroke("#2563eb");
                sketch.strokeWeight(3);
                sketch.beginShape();
                sketchFrames.forEach((frame) => {
                    sketch.vertex(padding + frame.x * scale, groundY - Math.max(frame.y, 0) * scale);
                });
                sketch.endShape();

                const selectedFrame = sketchFrames[Math.min(sketchIndex, sketchFrames.length - 1)];
                sketch.noStroke();
                sketch.fill("#ef4444");
                sketch.circle(padding + selectedFrame.x * scale, groundY - Math.max(selectedFrame.y, 0) * scale, 18);
            };

            const drawCanvas = (objects) => {
                const width = sketch.width;
                const height = sketch.height;
                const plotLeft = 52;
                const plotRight = width - 24;
                const plotTop = 22;
                const plotBottom = height - 42;
                const plotWidth = plotRight - plotLeft;
                const plotHeight = plotBottom - plotTop;
                const bounds = getCanvasBounds(objects, plotWidth, plotHeight);
                const spanX = bounds.maxX - bounds.minX || 1;
                const spanY = bounds.maxY - bounds.minY || 1;
                const scale = Math.min(plotWidth / spanX, plotHeight / spanY);
                const usedWidth = spanX * scale;
                const usedHeight = spanY * scale;
                const originX = plotLeft + (plotWidth - usedWidth) / 2 - bounds.minX * scale;
                const originY = plotTop + (plotHeight - usedHeight) / 2 + bounds.maxY * scale;
                const toScreenX = (x) => originX + x * scale;
                const toScreenY = (y) => originY - y * scale;
                const scaleLength = (value) => Math.abs(value) * scale;
                const xTicks = buildTicks(bounds.minX, bounds.maxX);
                const yTicks = buildTicks(bounds.minY, bounds.maxY);

                sketch.stroke("#dbe4f0");
                sketch.strokeWeight(1);
                xTicks.forEach((tick) => {
                    const x = toScreenX(tick);
                    sketch.line(x, plotTop, x, plotBottom);
                });
                yTicks.forEach((tick) => {
                    const y = toScreenY(tick);
                    sketch.line(plotLeft, y, plotRight, y);
                });

                sketch.noFill();
                sketch.stroke("#cfd9e8");
                sketch.rect(plotLeft, plotTop, plotWidth, plotHeight);

                sketch.stroke("#8a99ad");
                sketch.strokeWeight(2);
                if (bounds.minY <= 0 && bounds.maxY >= 0) {
                    sketch.line(plotLeft, toScreenY(0), plotRight, toScreenY(0));
                }
                if (bounds.minX <= 0 && bounds.maxX >= 0) {
                    sketch.line(toScreenX(0), plotTop, toScreenX(0), plotBottom);
                }

                sketch.noStroke();
                sketch.fill("#52637a");
                sketch.textSize(11);
                sketch.textAlign(sketch.CENTER, sketch.TOP);
                xTicks.forEach((tick) => {
                    const x = toScreenX(tick);
                    if (x >= plotLeft - 1 && x <= plotRight + 1) {
                        sketch.text(formatTick(tick), x, plotBottom + 6);
                    }
                });
                sketch.textAlign(sketch.RIGHT, sketch.CENTER);
                yTicks.forEach((tick) => {
                    const y = toScreenY(tick);
                    if (y >= plotTop - 1 && y <= plotBottom + 1) {
                        sketch.text(formatTick(tick), plotLeft - 8, y);
                    }
                });

                if (objects.length === 0) {
                    sketch.noStroke();
                    sketch.fill("#52637a");
                    sketch.textAlign(sketch.CENTER, sketch.CENTER);
                    sketch.text("Render the canvas to draw points, lines, circles, and rectangles.", width / 2, height / 2);
                    return;
                }

                objects.forEach((object) => {
                    sketch.stroke("#0f766e");
                    sketch.strokeWeight(3);
                    sketch.fill("rgba(15, 118, 110, 0.14)");

                    if (object.type === "point") {
                        if (!isFiniteNumber(object.x) || !isFiniteNumber(object.y)) return;
                        sketch.noStroke();
                        sketch.fill("#ef4444");
                        sketch.circle(toScreenX(object.x), toScreenY(object.y), 14);
                    }

                    if (object.type === "line") {
                        if (
                            !isFiniteNumber(object.x1)
                            || !isFiniteNumber(object.y1)
                            || !isFiniteNumber(object.x2)
                            || !isFiniteNumber(object.y2)
                        ) return;
                        sketch.line(toScreenX(object.x1), toScreenY(object.y1), toScreenX(object.x2), toScreenY(object.y2));
                    }

                    if (object.type === "circle") {
                        if (
                            !isFiniteNumber(object.x)
                            || !isFiniteNumber(object.y)
                            || !isFiniteNumber(object.radius)
                        ) return;
                        const diameter = Math.max(scaleLength(object.radius) * 2, 8);
                        sketch.circle(toScreenX(object.x), toScreenY(object.y), diameter);
                    }

                    if (object.type === "rect") {
                        if (
                            !isFiniteNumber(object.x)
                            || !isFiniteNumber(object.y)
                            || !isFiniteNumber(object.width)
                            || !isFiniteNumber(object.height)
                        ) return;
                        const x1 = toScreenX(object.x);
                        const y1 = toScreenY(object.y);
                        const x2 = toScreenX(object.x + object.width);
                        const y2 = toScreenY(object.y + object.height);
                        sketch.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
                    }
                });
            };

            sketch.setup = () => {
                const hostBounds = sketchHostRef.current.getBoundingClientRect();
                const canvas = sketch.createCanvas(hostBounds.width || 760, hostBounds.height || 420);
                canvas.parent(sketchHostRef.current);
                sketch.noLoop();
            };

            sketch.draw = () => {
                const { lab, frames: sketchFrames, activeIndex: sketchIndex, objects } = sketchStateRef.current;
                sketch.background("#f8fbff");
                if (lab === "canvas") {
                    drawCanvas(objects);
                } else {
                    drawProjectile(sketchFrames, sketchIndex);
                }
            };

            sketch.windowResized = () => {
                const hostBounds = sketchHostRef.current.getBoundingClientRect();
                sketch.resizeCanvas(hostBounds.width || 760, hostBounds.height || 420);
            };
        }, sketchHostRef.current);

        import("p5").then(({ default: P5 }) => {
            if (isCancelled || !sketchHostRef.current) return;
            p5InstanceRef.current = createSketch(P5);
        });

        return () => {
            isCancelled = true;
            p5InstanceRef.current?.remove();
            p5InstanceRef.current = null;
            window.clearInterval(animationTimerRef.current);
        };
    }, []);

    useEffect(() => {
        sketchStateRef.current = { lab: activeLab, frames, activeIndex, objects: canvasObjects };
        p5InstanceRef.current?.redraw();
    }, [activeLab, frames, activeIndex, canvasObjects]);

    useEffect(() => {
        if (!isPlaying || frames.length < 2) {
            window.clearInterval(animationTimerRef.current);
            animationTimerRef.current = null;
            return undefined;
        }

        animationTimerRef.current = window.setInterval(() => {
            setActiveIndex((currentIndex) => {
                if (currentIndex >= frames.length - 1) {
                    window.clearInterval(animationTimerRef.current);
                    animationTimerRef.current = null;
                    setIsPlaying(false);
                    return currentIndex;
                }

                return currentIndex + 1;
            });
        }, 80);

        return () => {
            window.clearInterval(animationTimerRef.current);
            animationTimerRef.current = null;
        };
    }, [frames.length, isPlaying]);

    const updateSetupValue = (key, value) => {
        setSetup((currentSetup) => ({
            ...currentSetup,
            [key]: Number(value),
        }));
    };

    return (
        <section className={styles.container}>
            <div className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Visual Python</p>
                    <h2 className={styles.title}>{labConfig.title}</h2>
                    <p className={styles.subtitle}>{labConfig.subtitle}</p>
                </div>
                <div className={styles.labsMenuWrap}>
                    {isLabsOpen && (
                        <div className={styles.labsMenu}>
                            <button
                                className={`${styles.labOption} ${activeLab === "projectile" ? styles.labOptionActive : ""}`}
                                type="button"
                                onClick={() => switchLab("projectile")}
                            >
                                Projectile Motion
                            </button>
                            <button
                                className={`${styles.labOption} ${activeLab === "canvas" ? styles.labOptionActive : ""}`}
                                type="button"
                                onClick={() => switchLab("canvas")}
                            >
                                Python Canvas
                            </button>
                            {["Spring Motion", "Pendulum", "Orbit", "Electric Field", "Wave"].map((lab) => (
                                <button className={styles.labOption} type="button" disabled key={lab}>
                                    {lab}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        className={styles.labsButton}
                        type="button"
                        onClick={() => setIsLabsOpen((currentValue) => !currentValue)}
                    >
                        Labs
                    </button>
                </div>
            </div>

            <div className={styles.labGrid}>
                <div className={styles.leftCol}>
                    <div className={styles.editorPanel}>
                        <div className={styles.panelHeader}>
                            <h3>{labConfig.editorTitle}</h3>
                            <button className={styles.secondaryButton} type="button" onClick={handleExplain} disabled={isExplaining}>
                                {isExplaining ? "Explaining..." : "Explain"}
                            </button>
                        </div>
                        <textarea
                            className={styles.codeEditor}
                            value={activeCode}
                            spellCheck="false"
                            onChange={(event) => setActiveCode(event.target.value)}
                        />
                        <div className={styles.codeTrace}>
                            {codeLines.map((line) => (
                                <div
                                    className={`${styles.codeLine} ${activeLineNumbers.has(line.lineNumber) ? styles.codeLineActive : ""}`}
                                    key={line.id}
                                >
                                    <span>{line.lineNumber}</span>
                                    <code>{line.text}</code>
                                </div>
                            ))}
                        </div>
                        <button className={styles.primaryButton} type="button" onClick={runLab} disabled={isRunning}>
                            {isRunning ? labConfig.runningLabel : labConfig.runLabel}
                        </button>

                        {activeLab === "projectile" && (
                            <div className={styles.controls}>
                                {setupFields.map((field) => (
                                    <label className={styles.control} key={field.key}>
                                        <span>{field.label}</span>
                                        <input
                                            type="number"
                                            min={field.min}
                                            max={field.max}
                                            step={field.step}
                                            value={setup[field.key]}
                                            onChange={(event) => updateSetupValue(field.key, event.target.value)}
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={styles.explainPanel}>
                        <h3>What The Code Is Doing</h3>
                        <p>{explanation || "Click Explain to get a short breakdown of your code."}</p>
                        {error && <p className={styles.error}>{error}</p>}
                    </div>

                    <div className={styles.actionsPanel}>
                        <h3>Visual Steps</h3>
                        <div className={styles.actionList}>
                            {visualActions.map((action, index) => (
                                <div
                                    className={`${styles.actionBlock} ${activeSteps.length > 0 ? styles.actionBlockActive : ""}`}
                                    key={action.id}
                                >
                                    <span className={styles.actionStep}>Step {index + 1}</span>
                                    <strong>{action.label}</strong>
                                    {action.change && <span className={styles.actionChange}>{action.target}: {action.change}</span>}
                                    <code>{action.text}</code>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.rightCol}>
                    <div className={styles.visualPanel}>
                        <div ref={sketchHostRef} className={styles.sketchHost} />
                        {activeLab === "projectile" && (
                            <div className={styles.timelinePanel}>
                                <div className={styles.timelineButtons}>
                                    <button type="button" onClick={resetTimeline} disabled={!canUseTimeline}>Reset</button>
                                    <button type="button" onClick={stepBackward} disabled={!canUseTimeline || activeIndex <= 0}>Back</button>
                                    <button type="button" onClick={togglePlayback} disabled={!canUseTimeline || frames.length < 2}>
                                        {isPlaying ? "Pause" : "Play"}
                                    </button>
                                    <button type="button" onClick={stepForward} disabled={!canUseTimeline || activeIndex >= finalFrameIndex}>Step</button>
                                </div>
                                <label className={styles.scrubber}>
                                    <span>Frame {canUseTimeline ? activeIndex : 0} / {finalFrameIndex}</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max={finalFrameIndex}
                                        value={activeIndex}
                                        disabled={!canUseTimeline}
                                        onChange={(event) => {
                                            stopPlayback();
                                            setActiveIndex(Number(event.target.value));
                                        }}
                                    />
                                </label>
                            </div>
                        )}
                        <div className={styles.statusRow}>
                            <span>{message || "Ready to run."}</span>
                            {activeLab === "projectile" && activeFrame && (
                                <span>
                                    t={activeFrame.t} x={activeFrame.x} y={activeFrame.y} vy={activeFrame.vy}
                                </span>
                            )}
                            {activeLab === "canvas" && canvasObjects.length > 0 && (
                                <span>{canvasObjects.length} objects on canvas</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.statePanel}>
                        <div className={styles.panelHeader}>
                            <h3>{activeLab === "projectile" ? "State Inspector" : "Canvas Inspector"}</h3>
                            <span className={styles.activeStep}>{activeStepLabel}</span>
                        </div>
                        <div className={styles.stateGrid}>
                            {stateRows.map((row) => (
                                <div className={styles.stateCell} key={row.key}>
                                    <span>{row.label}</span>
                                    <strong>{formatFrameValue(row.value)}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
