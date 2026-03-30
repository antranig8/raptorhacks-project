import { useEffect, useState } from 'react'
import styles from '@home/styles/Hero.module.css'
import useInViewAnimation from '@/hooks/useInViewAnimation'

function Hero() {
    const { ref, isVisible } = useInViewAnimation({ threshold: 0.15, rootMargin: '0px 0px -30px 0px' })
    const [contentVisible, setContentVisible] = useState(false)

    useEffect(() => {
        let timer
        if (isVisible) {
            timer = setTimeout(() => {
                setContentVisible(true)
            }, 700) // after backdrop fade-in completes
        } else {
            setContentVisible(false)
        }

        return () => {
            if (timer) {
                clearTimeout(timer)
            }
        }
    }, [isVisible])

    return (
        <section ref={ref} className={`${styles.hero} ${isVisible ? styles.visible : styles.hidden}`}>
            <div className={styles.content}>
                <div className={styles.topContent}>
                    <h1
                        className={`${styles.title} ${contentVisible ? styles.fallInVisible : styles.fallInHidden}`}
                        style={{ transitionDelay: '120ms' }}
                    >
                        Max Out Your Coding Stats
                    </h1>
                    <p
                        className={`${styles.subtitle} ${contentVisible ? styles.fallInVisible : styles.fallInHidden}`}
                        style={{ transitionDelay: '220ms' }}
                    >
                        Learn flexibly, Learn faster, Learn better.
                    </p>
                    <button
                        className={`${styles.ctaButton} ${contentVisible ? styles.fallInVisible : styles.fallInHidden}`}
                        style={{ transitionDelay: '320ms' }}
                    >
                        Show me how <span className={styles.ctaArrow}>↓</span>
                    </button>
                </div>
            </div>
        </section>
    )
}

export default Hero
