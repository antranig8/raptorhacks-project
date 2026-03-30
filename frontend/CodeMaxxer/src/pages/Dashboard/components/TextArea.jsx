import { useEffect, useRef, useState } from 'react'
import { FaMousePointer, FaRedo } from 'react-icons/fa'
import styles from './TextArea.module.css'

export default function TextArea({ target = 'hello world', onChange, onActiveChange }) {
    const [active, setActive] = useState(false)
    const [typed, setTyped] = useState('')
    const [completed, setCompleted] = useState(false)
    const [isReplaying, setIsReplaying] = useState(false)
    const [replayIndex, setReplayIndex] = useState(0)
    const [history, setHistory] = useState([])
    const [sessionStart, setSessionStart] = useState(null)
    const [completionTime, setCompletionTime] = useState(null)
    const [liveWpm, setLiveWpm] = useState(0)
    const containerRef = useRef(null)

    const remaining = target.slice(typed.length)

    const handleFocus = () => {
        if (completed || isReplaying) return
        setActive(true)
        if (onActiveChange) onActiveChange(true)
    }

    const handleBlur = () => {
        setActive(false)
        if (onActiveChange) onActiveChange(false)
    }

    const commitTyped = (next, key = '') => {
        const timestamp = Date.now()

        if (onChange) onChange(next)
        setTyped(next)

        setHistory((prev) => {
            const entry = {
                value: next,
                key,
                timestamp,
            }
            return [...prev, entry]
        })

        if (!sessionStart) {
            setSessionStart(timestamp)
        }

        const start = sessionStart || timestamp
        const elapsedMinutes = Math.max(0.001, (timestamp - start) / 60000)
        const wpm = Math.round((next.length / 5) / elapsedMinutes)
        setLiveWpm(wpm)

        if (next.length >= target.length) {
            setCompleted(true)
            setActive(false)
            setCompletionTime(timestamp)
            if (onActiveChange) onActiveChange(false)
        }
    }

    const onKeyDown = (event) => {
        if (!active || completed || isReplaying) return

        if (event.key === 'Backspace') {
            event.preventDefault()
            commitTyped(typed.slice(0, -1), 'Backspace')
            return
        }

        if (event.key === 'Enter') {
            event.preventDefault()
            commitTyped(typed + '\n', 'Enter')
            return
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            commitTyped(typed + event.key, event.key)
        }
    }

    useEffect(() => {
        if (active && containerRef.current) {
            containerRef.current.focus()
        }
    }, [active])

    useEffect(() => {
        if (!isReplaying || history.length === 0) return

        if (replayIndex >= history.length) {
            setIsReplaying(false)
            setCompleted(true)
            return
        }

        const current = history[replayIndex]
        const previous = history[replayIndex - 1]
        const delay = replayIndex === 0 ? 300 : current.timestamp - (previous?.timestamp || 0)

        const timeout = setTimeout(() => {
            setTyped(current.value)
            if (onChange) onChange(current.value)

            const startTimestamp = history[0]?.timestamp || current.timestamp
            const elapsed = Math.max(1, current.timestamp - startTimestamp)
            const elapsedMinutes = elapsed / 60000
            const wpm = Math.round((current.value.length / 5) / elapsedMinutes)
            setLiveWpm(wpm)

            setReplayIndex((prev) => prev + 1)
        }, delay)

        return () => clearTimeout(timeout)
    }, [isReplaying, replayIndex, history, onChange])

    const handleRestart = () => {
        setCompleted(false)
        setIsReplaying(false)
        setTyped('')
        setHistory([])
        setReplayIndex(0)
        setSessionStart(null)
        setCompletionTime(null)
        setLiveWpm(0)
        setActive(true)
        if (onActiveChange) onActiveChange(true)
        if (onChange) onChange('')
    }

    const handleWatchReplay = () => {
        if (history.length === 0) return
        setCompleted(false)
        setIsReplaying(true)
        setTyped('')
        setReplayIndex(0)
        setActive(false)
        if (onActiveChange) onActiveChange(false)
        if (onChange) onChange('')
    }

    const targetChars = target.split('')
    const typedChars = typed.split('')

    return (
        <div
            className={`${styles.wrapper} ${active ? styles.active : ''}`}
            ref={containerRef}
            tabIndex={0}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={onKeyDown}
            role="textbox"
            aria-label="Typing practice input"
        >
            <div className={styles.wpmBadge}>WPM: {liveWpm}</div>
            <div className={styles.content}>
                <span className={styles.typed}>
                    {typedChars.map((chr, idx) => {
                        const expected = targetChars[idx] ?? ''
                        const className = chr === expected ? styles.charCorrect : styles.charIncorrect
                        return (
                            <span key={`${idx}-${chr}`} className={className}>
                                {chr}
                            </span>
                        )
                    })}

                    {active && !isReplaying && <span className={styles.caret} />}
                </span>

                <span className={styles.remaining}>{remaining}</span>
            </div>

            {!active && !completed && !isReplaying && (
                <div className={styles.placeholder}>
                    <FaMousePointer className={styles.icon} />
                    <span>Click to select</span>
                </div>
            )}

            {(completed || isReplaying) && (
                <div className={styles.statusOverlay}>
                    <p className={styles.completedText}>{isReplaying ? 'Replaying...' : 'Completed!'}</p>
                    {completed && completionTime && sessionStart && (
                        <p className={styles.wpmText}>
                            Speed: {Math.round((typed.length / 5) / ((completionTime - sessionStart) / 60000)) || 0} WPM
                        </p>
                    )}
                    <div className={styles.toolbar}>
                        <button className={styles.button} onClick={handleRestart}>
                            <FaRedo className={styles.icon} /> Restart
                        </button>
                        <button className={styles.button} onClick={handleWatchReplay}>
                            « Watch replay
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

