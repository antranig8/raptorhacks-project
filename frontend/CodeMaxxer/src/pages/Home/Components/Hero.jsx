import styles from './styles/Hero.module.css'

function Hero() {
    return (
        <section className={styles.hero}>
            <div className={styles.content}>
                <div className={styles.topContent}>
                    <h1 className={styles.title}>Code Maxxer</h1>
                    <p className={styles.subtitle}>Gamify Your Programming Career</p>
                    <button className={styles.ctaButton}>
                        Show me how <span className={styles.ctaArrow}>↓</span>
                    </button>
                </div>
            </div>
        </section>
    )
}

export default Hero
