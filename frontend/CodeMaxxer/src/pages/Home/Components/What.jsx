import styles from '@home/styles/What.module.css'

function What() {
    return (
        <section className={styles.whatSection} aria-label="What we do">
            <div className={styles.headerRow}>
                <h2 className={styles.title}>What we do</h2>
                <p className={styles.subtitle}>Gooner blah balh balh.</p>
            </div>
            <div className={styles.placeholderRow}>
                <article className={styles.card}>
                    <h3>Placeholder 1</h3>
                    <p>What.</p>
                </article>
                <article className={styles.card}>
                    <h3>Placeholder 2</h3>
                    <p>The,</p>
                </article>
                <article className={styles.card}>
                    <h3>Placeholder 3</h3>
                    <p>Heck;</p>
                </article>
            </div>
        </section>
    )
}

export default What
