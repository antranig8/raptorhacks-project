import styles from '@home/styles/Hero.module.css'

function Hero() {
    return (
        <section className={styles.hero}>
            <div className={styles.content}>
                <div className={styles.topContent}>
                    <h1 className={styles.title}>Max Out Your Coding Stats</h1>
                    <p className={styles.subtitle}>Learn flexibly, Learn faster, Learn better.</p>
                    <button className={styles.ctaButton}>
                        Show me how <span className={styles.ctaArrow}>↓</span>
                    </button>
                </div>
            </div>
        </section>
    )
}

export default Hero
