import { useState, useEffect, useRef } from 'react'
import styles from '@dashboard/styles/Typing.module.css'
import TextArea from '@d_general/typing/TextArea'
import { randomText } from './wordBank'
import TypingEditor from './TypingEditor'
import CustomLineChart from '@d_general/dashboard/CustomLineChart'

// Typing chart will use live session data provided by the TextArea

export default function Typing() {
    const [input, setInput] = useState('')
    const [isTopActive, setIsTopActive] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [isTablet, setIsTablet] = useState(false)
    const [realtimeChartData, setRealtimeChartData] = useState(null)
    const lastChartUpdate = useRef(0)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 700)
            setIsTablet(window.innerWidth <= 1024)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const handleStart = () => {
    }

    const [practiceTemplate, setPracticeTemplate] = useState(() => randomText())

    const buildRealtimeFromHistory = (history, sessionStartParam) => {
        if (!history || history.length === 0) return null
        const start = sessionStartParam || history[0].timestamp

        const wpmSeries = []
        const epmSeries = []

        for (let i = 0; i < history.length; i++) {
            const entry = history[i]
            const elapsedSec = Math.floor((entry.timestamp - start) / 1000)
            const elapsedMin = Math.max(1 / 60, (entry.timestamp - start) / 60000)
            const wpm = Math.round((entry.value.length / 5) / elapsedMin)

            // Count character mismatches as errors at each snapshot
            let errors = 0
            for (let j = 0; j < entry.value.length; j++) {
                if (entry.value[j] !== (practiceTemplate[j] || '')) errors++
            }
            const epm = Math.round(errors / elapsedMin)

            wpmSeries.push({ x: elapsedSec, y: wpm })
            epmSeries.push({ x: elapsedSec, y: epm })
        }

        const smoothedEpm = movingAverage(epmSeries, 3)
        const smoothedWpm = movingAverage(wpmSeries, 3)
        const interpEpm = interpolateSeries(smoothedEpm, 0.5)
        const interpWpm = interpolateSeries(smoothedWpm, 0.5)

        return [interpEpm, interpWpm]
    }

    // Smooth / interpolate helpers
    const movingAverage = (series, window = 3) => {
        if (!series || series.length === 0) return series
        const out = []
        for (let i = 0; i < series.length; i++) {
            const start = Math.max(0, i - Math.floor(window / 2))
            const end = Math.min(series.length - 1, i + Math.floor(window / 2))
            let sum = 0
            let count = 0
            for (let j = start; j <= end; j++) {
                sum += series[j].y
                count++
            }
            out.push({ x: series[i].x, y: sum / count })
        }
        return out
    }

    const interpolateSeries = (series, step = 0.5) => {
        if (!series || series.length === 0) return series
        const out = []
        for (let i = 0; i < series.length - 1; i++) {
            const a = series[i]
            const b = series[i + 1]
            out.push({ x: a.x, y: a.y })
            const deltaX = b.x - a.x
            const steps = Math.max(1, Math.floor(deltaX / step))
            for (let s = 1; s < steps; s++) {
                const t = s / steps
                const x = a.x + t * deltaX
                const y = a.y + t * (b.y - a.y)
                out.push({ x, y })
            }
        }
        out.push(series[series.length - 1])
        return out
    }

    if (isMobile) {
        return (
            <div className={styles.mobileWarning}>
                Typing on mobile is not supported.
            </div>
        )
    }

    if (isTablet) {
        return (
            <section className={styles.tabletContainer}>
                <div className={styles.tabletHeaderCard}>
                    <h2 className={styles.title}>Practice Typing</h2>
                </div>
                <div className={styles.tabletEditorCard}>
                    <TypingEditor onStart={handleStart} isTablet={true} />
                </div>
                <div className={`${styles.tabletTextAreaCard} ${isTopActive ? styles.active : ''}`}>
                    <TextArea
                        target={practiceTemplate}
                        onChange={(next, history) => {
                            setInput(next)
                            const now = Date.now()
                            if (history && history.length > 0 && now - lastChartUpdate.current > 1000) {
                                const chart = buildRealtimeFromHistory(history)
                                setRealtimeChartData(chart)
                                lastChartUpdate.current = now
                            }
                        }}
                        onActiveChange={setIsTopActive}
                        onRequestNewTarget={() => {
                            setPracticeTemplate(randomText())
                            setRealtimeChartData(null)
                        }}
                        onComplete={(session) => {
                            const { history, sessionStart } = session
                            const chart = buildRealtimeFromHistory(history, sessionStart)
                            if (chart) setRealtimeChartData(chart)
                        }}
                    />
                </div>
                <div className={styles.tabletAnalyticsCard}>
                    <CustomLineChart
                        title="Typing Performance"
                        lines={[
                            { name: 'EPM', color: '#3b82f6' },
                            { name: 'WPM', color: '#10b981' }
                        ]}
                        showTimeControls={false}
                        xAxisType="seconds"
                        data={realtimeChartData}
                    />
                </div>
            </section>
        );
    }

    return (
        <section className={styles.container}>
            <div className={styles.leftColumn}>
                <div className={`${styles.typingArea} ${isTopActive ? styles.active : ''}`}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>Practice Typing</h2>
                    </div>
                    <div className={styles.typingAreaContent}>
                        <TextArea
                            target={practiceTemplate}
                            onChange={(next, history) => {
                                setInput(next)
                                const now = Date.now()
                                if (history && history.length > 0 && now - lastChartUpdate.current > 1000) {
                                    const chart = buildRealtimeFromHistory(history)
                                    setRealtimeChartData(chart)
                                    lastChartUpdate.current = now
                                }
                            }}
                            onActiveChange={setIsTopActive}
                            onRequestNewTarget={() => {
                                setPracticeTemplate(randomText())
                                setRealtimeChartData(null)
                            }}
                            onComplete={(session) => {
                                const { history, sessionStart } = session
                                const chart = buildRealtimeFromHistory(history, sessionStart)
                                if (chart) setRealtimeChartData(chart)
                            }}
                        />
                    </div>
                </div>
                <div className={styles.analyticsArea}>
                    <CustomLineChart
                        title="Typing Performance"
                        lines={[
                            { name: 'EPM', color: '#3b82f6' },
                            { name: 'WPM', color: '#10b981' }
                        ]}
                        showTimeControls={false}
                        xAxisType="seconds"
                        data={realtimeChartData}
                    />
                </div>
            </div>
            {/* <TypingEditor onStart={handleStart} isTablet={false} /> */}
        </section>
    )
}
