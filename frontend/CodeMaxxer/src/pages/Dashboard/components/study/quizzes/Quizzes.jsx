import styles from '@dashboard/styles/Quizzes.module.css'

export default function Quizzes() {
    return (
        <section className={styles.container}>
            <h1 className={styles.title}>Quizzes</h1>
            <p className={styles.description}>Challenge yourself with quizzes to test your knowledge.</p>
        </section>
    )
}
