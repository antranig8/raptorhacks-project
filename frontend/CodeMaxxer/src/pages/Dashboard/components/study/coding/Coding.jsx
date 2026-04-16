import styles from "@dashboardStyles/study/Coding.module.css";

export default function Coding() {
    return (
        <section className={styles.container}>
            <p className={styles.eyebrow}>Study</p>
            <h1 className={styles.title}>Coding</h1>
            <p className={styles.message}>
                Coming soon. This space is reserved for focused coding practice and runnable exercises.
            </p>
        </section>
    );
}
