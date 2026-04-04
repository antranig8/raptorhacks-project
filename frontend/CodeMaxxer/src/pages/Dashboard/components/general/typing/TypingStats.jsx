import { useEffect, useState } from 'react'
import { FaTachometerAlt, FaClock } from 'react-icons/fa'
import styles from '@dashboard/styles/TextArea.module.css'

export default function TypingStats({ startTimestamp, active, completed, duration = 60, wpm = 0, onTimeUp }) {
    const [remaining, setRemaining] = useState(duration)

    useEffect(() => {
        let timer = null

        const update = () => {
            if (!startTimestamp || completed) {
                setRemaining(duration)
                return
            }

            const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000)
            const rem = Math.max(0, duration - elapsedSec)
            setRemaining(rem)

            if (rem <= 0) {
                if (onTimeUp) onTimeUp()
                return
            }
            timer = setTimeout(update, 250)
        }

        update()

        return () => clearTimeout(timer)
    }, [startTimestamp, active, completed, duration, onTimeUp])

    return (
        <div className={styles.typingHeader}>
            <div className={styles.statItem}>
                <FaTachometerAlt className={styles.statIcon} />
                <div style={{ fontWeight: 700, color: '#1d4ed8' }}>WPM: {wpm}</div>
            </div>

            <div className={styles.statItem}>
                <FaClock className={styles.statIcon} />
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'rgba(100,116,139,0.9)' }}>{remaining}s</div>
            </div>
        </div>
    )
}
