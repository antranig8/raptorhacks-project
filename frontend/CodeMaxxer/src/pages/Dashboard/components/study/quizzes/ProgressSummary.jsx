import { useState, useEffect } from "react";
import styles from "@dashboard/styles/ProgressSummary.module.css";

function TimedProgressBar({ isTimed, onTimeUp }) {
    const totalTime = 60; // 1 minute hardcoded per prompt for demo
    const [timeLeft, setTimeLeft] = useState(totalTime);

    useEffect(() => {
        if (!isTimed) return;

        if (timeLeft <= 0) {
            if (onTimeUp) onTimeUp();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [isTimed, timeLeft, onTimeUp]);

    if (!isTimed) return null;

    const percentage = (timeLeft / totalTime) * 100;

    let colorClass = styles.red;
    if (percentage >= 70) colorClass = styles.green;
    else if (percentage >= 40) colorClass = styles.orange;

    return (
        <div className={styles.timedBarContainer}>
            <div
                className={`${styles.timedBarFill} ${colorClass}`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

export default function ProgressSummary({ title = "Quiz Progress", answered = 0, correct = 0, wrong = 0, total = 0, results = [], isTimed = false, onTimeUp }) {
    const segments = Array.from({ length: total }, (_, i) => i);

    return (
        <section className={styles.progressSummary}>
            <h2 className={styles.quizTitle}>{title}</h2>
            <TimedProgressBar isTimed={isTimed} onTimeUp={onTimeUp} />
            <div className={styles.segmentsContainer}>
                {segments.map((index) => {
                    const result = results[index];
                    let segmentClass = styles.segment;
                    if (result === "correct") segmentClass += ` ${styles.correct}`;
                    else if (result === "wrong") segmentClass += ` ${styles.wrong}`;
                    else if (index < answered && !result) segmentClass += ` ${styles.filled}`;

                    return (
                        <div
                            key={index}
                            className={segmentClass}
                        />
                    );
                })}
            </div>

            <div className={styles.statsGroup}>
                <span className={styles.fraction}>{answered} / {total}</span>

                <div className={styles.badgeContainer}>
                    <div className={styles.wrongBadge}>
                        <span className={styles.icon}>&#10005;</span>
                        <span className={styles.value}>{wrong}</span>
                    </div>
                    <div className={styles.correctBadge}>
                        <span className={styles.icon}>&#10003;</span>
                        <span className={styles.value}>{correct}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
