import styles from '@home/styles/What.module.css'
import useInViewAnimation from '@/hooks/useInViewAnimation'

const cardData = [
    { title: 'Placeholder 1', description: 'What.' },
    { title: 'Placeholder 2', description: 'The,' },
    { title: 'Placeholder 3', description: 'Heck;' },
]

function What() {
    const { ref, isVisible } = useInViewAnimation({ threshold: 0.1, rootMargin: '0px 0px -90px 0px' })

    return (
        <section ref={ref} className={`${styles.whatSection} ${isVisible ? styles.visible : styles.hidden}`} aria-label="What we do">
            <div className={styles.headerRow}>
                <h2 className={styles.title}>What we do</h2>
                <p className={styles.subtitle}>Personalized stuff for you dumbahh.</p>
            </div>
            <div className={styles.placeholderRow}>
                {cardData.map((item, idx) => (
                    <article
                        key={item.title}
                        className={`${styles.card} ${isVisible ? styles.cardVisible : styles.cardHidden}`}
                        style={{ transitionDelay: `${idx * 130}ms` }}
                    >
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                    </article>
                ))}
            </div>
        </section>
    )
}

export default What
