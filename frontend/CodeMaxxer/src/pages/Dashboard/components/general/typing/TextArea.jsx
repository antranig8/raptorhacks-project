import { useEffect, useRef, useState, useCallback } from 'react'
import { FaMousePointer, FaRedo } from 'react-icons/fa'
import styles from '@dashboardStyles/typing/TextArea.module.css'
import TypingStats from './TypingStats'

export default function TextArea({ target = '', onChange, onActiveChange, onRequestNewTarget, onComplete }) {
    // This component owns the full typing-session lifecycle: input capture,
    // progress tracking, replay history, and completion reporting.
    const [active, setActive] = useState(false)
    const [typed, setTyped] = useState('')
    const [completed, setCompleted] = useState(false)
    const [isReplaying, setIsReplaying] = useState(false)
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

    // Record each keystroke snapshot so the parent can compute analytics and
    // this component can later replay the exact typing session.
    const commitTyped = (next, key = '') => {
        const timestamp = Date.now()

        setTyped(next)

        const entry = {
            value: next,
            key,
            timestamp,
        }

        const newHistory = [...history, entry]
        setHistory(newHistory)
        if (onChange) onChange(next, newHistory)

        if (!sessionStart) {
            setSessionStart(timestamp)
        }

        const start = sessionStart || timestamp
        const elapsedMinutes = Math.max(1 / 60, (timestamp - start) / 60000)
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

    // Replay uses the original per-keystroke timestamps to restore the
    // session progressively. Scheduling all timeouts relative to the start
    // prevents React render times from accumulating as a delay over time.
    useEffect(() => {
        if (!isReplaying || history.length === 0) return

        const timeouts = []
        const baseTimestamp = history[0].timestamp

        history.forEach((entry, idx) => {
            // First character plays at 300ms, rest play sequentially after
            const delay = 300 + (entry.timestamp - baseTimestamp)

            const timeout = setTimeout(() => {
                setTyped(entry.value)

                const elapsedMinutes = Math.max(1000, entry.timestamp - baseTimestamp) / 60000
                const wpm = Math.round((entry.value.length / 5) / elapsedMinutes)
                setLiveWpm(wpm)

                if (onChange) onChange(entry.value, history.slice(0, idx + 1))

                // End of replay
                if (idx === history.length - 1) {
                    setIsReplaying(false)
                    setCompleted(true)
                }
            }, delay)

            timeouts.push(timeout)
        })

        return () => timeouts.forEach(clearTimeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReplaying])

    const handleRestart = () => {
        setCompleted(false)
        setIsReplaying(false)
        setTyped('')
        setHistory([])
        setSessionStart(null)
        setCompletionTime(null)
        setLiveWpm(0)
        if (onRequestNewTarget) onRequestNewTarget()
        setActive(true)
        if (onActiveChange) onActiveChange(true)
        if (onChange) onChange('', [])
    }

    const handleWatchReplay = () => {
        if (history.length === 0) return
        setCompleted(false)
        setIsReplaying(true)
        setTyped('')
        setActive(false)
        if (onActiveChange) onActiveChange(false)
        if (onChange) onChange('', [])
    }

    useEffect(() => {
        if (!completed || !completionTime) return
        if (onComplete) {
            // The parent page uses the raw session data to build the typing
            // performance chart after the run finishes.
            onComplete({ history, sessionStart, completionTime, typed })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [completed, completionTime])

    const handleTimeUp = useCallback(() => {
        setCompleted(true)
        setActive(false)
        setCompletionTime(Date.now())
        if (onActiveChange) onActiveChange(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const targetChars = target.split('')
    const typedChars = typed.split('')

    return (
        <div
            className={`${styles.wrapper} ${active ? styles.active : ''} ${isReplaying ? styles.replaying : ''}`}
            ref={containerRef}
            tabIndex={0}
            // This is intentionally a focusable div instead of a native
            // textarea so the app can fully control typing, replay, and UI.
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={onKeyDown}
            role="textbox"
            aria-label="Typing practice input"
        >
            <TypingStats
                startTimestamp={sessionStart}
                active={active}
                completed={completed}
                duration={60}
                wpm={liveWpm}
                onTimeUp={handleTimeUp}
            />
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
                    {(completed || isReplaying) && (
                        <p className={styles.wpmText}>
                            Speed: {Math.round(liveWpm) || 0} WPM
                        </p>
                    )}
                    <div className={styles.toolbar}>
                        <button className={styles.button} onClick={handleRestart}>
                            <FaRedo className={styles.icon} /> Restart
                        </button>
                        <button className={styles.button} onClick={handleWatchReplay}>
                            {'<< Watch replay'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
