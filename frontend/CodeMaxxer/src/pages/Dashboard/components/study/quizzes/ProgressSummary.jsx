import styles from "@dashboard/styles/ProgressSummary.module.css";

export default function ProgressSummary({ title = "Quiz Progress", answered = 0, correct = 0, wrong = 0, total = 0, results = [] }) {
    const segments = Array.from({ length: total }, (_, i) => i);

    return (
        <section className={styles.progressSummary}>
            <h2 className={styles.quizTitle}>{title}</h2>
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
        </section>
    );
}
