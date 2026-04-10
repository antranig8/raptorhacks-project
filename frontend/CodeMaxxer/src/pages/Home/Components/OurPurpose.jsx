import styles from '@home/styles/OurPurpose.module.css'
import useInViewAnimation from '@/hooks/useInViewAnimation'

function OurPurpose() {
    const { ref, isVisible } = useInViewAnimation({ threshold: 0.15, rootMargin: '0px 0px -30px 0px' })

    return (
        <section ref={ref} className={`${styles.purpose} ${isVisible ? styles.visible : styles.hidden}`} aria-label="Our Purpose">
            <div className={`${styles.content} ${isVisible ? styles.fallInVisible : styles.fallInHidden}`} style={{ transitionDelay: '120ms' }}>
                <h2 className={styles.text}>Stop guessing what to learn next.</h2>
            </div>
        </section>
    )
}

export default OurPurpose
