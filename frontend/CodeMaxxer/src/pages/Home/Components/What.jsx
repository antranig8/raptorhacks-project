import styles from '@home/styles/What.module.css'
import useInViewAnimation from '@/hooks/useInViewAnimation'

const cardData = [
    {
        title: 'AI Skill Trees',
        description: 'Turn one learning goal into a structured roadmap with clear nodes, progression, and next steps.',
    },
    {
        title: 'Node-Based Quizzes',
        description: 'Open any skill node and generate a quiz focused on that exact concept instead of generic trivia.',
    },
    {
        title: 'Code Challenges',
        description: 'Practice coding questions with runnable snippets, expected output, and answer validation.',
    },
    {
        title: 'Language-Aware Practice',
        description: 'Generate quizzes around the language you want to study so the practice matches your stack.',
    },
    {
        title: 'Saved Roadmaps',
        description: 'Keep multiple plans, switch between them, and return to the one you want to focus on.',
    },
    {
        title: 'Instant Feedback',
        description: 'See whether your answers were correct right away and keep moving without losing momentum.',
    },
]

function What() {
    const { ref, isVisible } = useInViewAnimation({ threshold: 0.1, rootMargin: '0px 0px -90px 0px' })

    return (
        <section ref={ref} className={`${styles.whatSection} ${isVisible ? styles.visible : styles.hidden}`} aria-label="What we do">
            <div className={styles.headerRow}>
                <h2 className={styles.title}>Features</h2>
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
