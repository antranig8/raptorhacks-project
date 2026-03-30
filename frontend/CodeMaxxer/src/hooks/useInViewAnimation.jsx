import { useEffect, useRef, useState } from 'react'

export default function useInViewAnimation({ threshold = 0.2, rootMargin = '0px', once = true, onVisible } = {}) {
    const ref = useRef(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const element = ref.current
        if (!element) return

        if (isVisible && once) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                    if (onVisible) {
                        onVisible(entry)
                    }
                    if (once && element) {
                        observer.unobserve(element)
                    }
                }
            },
            {
                threshold,
                rootMargin,
            }
        )

        observer.observe(element)

        return () => {
            observer.disconnect()
        }
    }, [threshold, rootMargin, once, isVisible])

    return { ref, isVisible }
}
