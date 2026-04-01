import styles from '@dashboard/styles/Quizzes.module.css'

export default function Quizzes() {
    return (
        <section className={styles.container}>
            <div className={styles.grid}>
                <div className={styles.leftCol} />
                <div className={styles.rightCol}>
                    <div className={styles.topRow} />
                    <div className={styles.bottomRow} />
                </div>
            </div>
        </section>
    )
}
