import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "@dashboardStyles/pages/VisualPythonLab.module.css";
import { explainVisualPythonCode, simulateProjectile } from "./visualPythonApi";

const DEFAULT_UPDATE_CODE = `vy = vy - gravity * dt
x = x + vx * dt
y = y + vy * dt`;

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

export default function VisualPythonLab() {
    const sketchHostRef = useRef(null);
    const p5InstanceRef = useRef(null);
    const sketchStateRef = useRef({ frames: [], activeIndex: 0 });
    const animationTimerRef = useRef(null);
    const [setup, setSetup] = useState(DEFAULT_SETUP);
    const [updateCode, setUpdateCode] = useState(DEFAULT_UPDATE_CODE);
    const [frames, setFrames] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isExplaining, setIsExplaining] = useState(false);
    const [isLabsOpen, setIsLabsOpen] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [explanation, setExplanation] = useState("");

    const activeFrame = frames[Math.min(activeIndex, Math.max(frames.length - 1, 0))];

    const setupFields = useMemo(() => [
        { key: "gravity", label: "Gravity", min: -20, max: 30, step: 0.1 },
        { key: "speed", label: "Speed", min: 0, max: 80, step: 1 },
        { key: "angle", label: "Angle", min: -20, max: 85, step: 1 },
        { key: "dt", label: "Time step", min: 0.01, max: 0.2, step: 0.01 },
    ], []);

    const runSimulation = useCallback(async () => {
        setIsRunning(true);
        setError("");
        setMessage("");
        window.clearInterval(animationTimerRef.current);

        try {
            const result = await simulateProjectile({ setup, updateCode });
            const nextFrames = result.frames || [];
            setFrames(nextFrames);
            setActiveIndex(0);
            setMessage(result.message || "Simulation ran.");

            if (nextFrames.length > 1) {
                let frameIndex = 0;
                animationTimerRef.current = window.setInterval(() => {
                    frameIndex += 1;
                    setActiveIndex(frameIndex);
                    if (frameIndex >= nextFrames.length - 1) {
                        window.clearInterval(animationTimerRef.current);
                        animationTimerRef.current = null;
                    }
                }, 28);
            }
        } catch (requestError) {
            setError(requestError.message || "Simulation failed.");
        } finally {
            setIsRunning(false);
        }
    }, [setup, updateCode]);

    const handleExplain = async () => {
        setIsExplaining(true);
        setError("");

        try {
            const result = await explainVisualPythonCode({ updateCode });
            setExplanation(result.explanation || "No explanation returned.");
        } catch (requestError) {
            setError(requestError.message || "Could not explain the code.");
        } finally {
            setIsExplaining(false);
        }
    };

    useEffect(() => {
        if (!sketchHostRef.current || p5InstanceRef.current) return undefined;

        let isCancelled = false;

        const createSketch = (P5) => new P5((sketch) => {
            const padding = 34;

            const drawFrame = () => {
                const { frames: sketchFrames, activeIndex: sketchIndex } = sketchStateRef.current;
                const width = sketch.width;
                const height = sketch.height;
                const groundY = height - padding;

                sketch.background("#f8fbff");
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

                const activeFrame = sketchFrames[Math.min(sketchIndex, sketchFrames.length - 1)];
                sketch.noStroke();
                sketch.fill("#ef4444");
                sketch.circle(padding + activeFrame.x * scale, groundY - Math.max(activeFrame.y, 0) * scale, 18);
            };

            sketch.setup = () => {
                const hostBounds = sketchHostRef.current.getBoundingClientRect();
                const canvas = sketch.createCanvas(hostBounds.width || 760, hostBounds.height || 420);
                canvas.parent(sketchHostRef.current);
                sketch.noLoop();
            };

            sketch.draw = () => {
                drawFrame();
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
        sketchStateRef.current = { frames, activeIndex };
        p5InstanceRef.current?.redraw();
    }, [frames, activeIndex]);

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
                    <h2 className={styles.title}>Projectile Motion Lab</h2>
                    <p className={styles.subtitle}>
                        Change the Python update lines, run the simulation, and watch how the path changes.
                    </p>
                </div>
                <div className={styles.labsMenuWrap}>
                    {isLabsOpen && (
                        <div className={styles.labsMenu}>
                            <button className={`${styles.labOption} ${styles.labOptionActive}`} type="button">
                                Projectile Motion
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
                <div className={styles.editorPanel}>
                    <div className={styles.panelHeader}>
                        <h3>Python Update Code</h3>
                        <button className={styles.secondaryButton} type="button" onClick={handleExplain} disabled={isExplaining}>
                            {isExplaining ? "Explaining..." : "Explain"}
                        </button>
                    </div>
                    <textarea
                        className={styles.codeEditor}
                        value={updateCode}
                        spellCheck="false"
                        onChange={(event) => setUpdateCode(event.target.value)}
                    />
                    <button className={styles.primaryButton} type="button" onClick={runSimulation} disabled={isRunning}>
                        {isRunning ? "Running..." : "Run Simulation"}
                    </button>

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
                </div>

                <div className={styles.visualPanel}>
                    <div ref={sketchHostRef} className={styles.sketchHost} />
                    <div className={styles.statusRow}>
                        <span>{message || "Ready to run."}</span>
                        {activeFrame && (
                            <span>
                                t={activeFrame.t} x={activeFrame.x} y={activeFrame.y} vy={activeFrame.vy}
                            </span>
                        )}
                    </div>
                </div>

                <div className={styles.explainPanel}>
                    <h3>What The Code Is Doing</h3>
                    <p>{explanation || "Click Explain to get a physics-focused breakdown of your update code."}</p>
                    {error && <p className={styles.error}>{error}</p>}
                </div>
            </div>
        </section>
    );
}
