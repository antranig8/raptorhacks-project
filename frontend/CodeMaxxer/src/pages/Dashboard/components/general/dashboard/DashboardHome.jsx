import styles from '@dashboard/styles/DashboardHome.module.css'

export default function DashboardHome() {
    return (
        <section className={styles.container}>
            <div className={styles.grid}>
                <div className={styles.card}></div>
                <div className={`${styles.card} ${styles.cardTall2}`}>
                    <div className={styles.stack2}>
                        <div className={styles.stackItem2}></div>
                        <div className={styles.stackItem2}></div>
                    </div>
                </div>
                <div className={styles.card}></div>
                <div className={`${styles.card} ${styles.cardTall}`}>
                    <div className={styles.stack}>
                        <div className={styles.stackItem}></div>
                        <div className={styles.stackItem}></div>
                        <div className={styles.stackItem}></div>
                    </div>
                </div>
            </div>
        </section>
    )
}
