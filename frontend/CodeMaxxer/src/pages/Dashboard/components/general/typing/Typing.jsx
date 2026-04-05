import { useState, useRef, useEffect } from 'react'
import styles from '@dashboard/styles/Typing.module.css'
import TextArea from '@d_general/typing/TextArea'
import { randomText } from './wordBank'
import TypingEditor from './TypingEditor'
import CustomLineChart from '@d_general/dashboard/CustomLineChart'

// data generator for EPM and WPM series
const generateTypingMetricsData = (range) => {
    const points = range === '1W' ? 7 : range === '1M' ? 30 : range === '1D' ? 10 : 12
    const epm = []
    const wpm = []
    let currentEpm = 80
    let currentWpm = 45

    for (let i = 0; i < points; i++) {
        currentEpm = Math.max(0, currentEpm + (Math.random() - 0.5) * 15)
        currentWpm = Math.max(0, currentWpm + (Math.random() - 0.5) * 8)

        // Using i * 5 to simulate 5-second intervals on the X axis
        const seconds = i * 5
        epm.push({ x: seconds, y: Number(currentEpm.toFixed(0)) })
        wpm.push({ x: seconds, y: Number(currentWpm.toFixed(0)) })
    }

    return [epm, wpm]
}

export default function Typing() {
    const keyboard = useRef(null)
    const [input, setInput] = useState('')
    const [isTopActive, setIsTopActive] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [realtimeChartData, setRealtimeChartData] = useState(null)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 1024)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const handleStart = (config) => {
        console.log('Starting typing with config:', config);
    };

    const [practiceTemplate, setPracticeTemplate] = useState(() => randomText(25))

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

    return (
        <section className={styles.container}>
            <div className={styles.leftColumn}>
                <div className={`${styles.typingArea} ${isTopActive ? styles.active : ''}`}>
                    <h1>Practice Typing</h1>
                    <TextArea
                        target={practiceTemplate}
                        onChange={setInput}
                        onActiveChange={setIsTopActive}
                        onRequestNewTarget={() => {
                            setPracticeTemplate(randomText(25))
                            setRealtimeChartData(null)
                        }}
                        onComplete={(session) => {
                            // session: { history, sessionStart, completionTime, typed }
                            const { history, sessionStart } = session
                            if (!history || history.length === 0 || !sessionStart) return

                            const wpmSeries = []
                            const epmSeries = []

                            for (let i = 0; i < history.length; i++) {
                                const entry = history[i]
                                const elapsedSec = Math.floor((entry.timestamp - sessionStart) / 1000)
                                const elapsedMin = Math.max(1 / 60, (entry.timestamp - sessionStart) / 60000)
                                const wpm = Math.round((entry.value.length / 5) / elapsedMin)
                                const epm = Math.round(((i + 1) / elapsedMin))
                                wpmSeries.push({ x: elapsedSec, y: wpm })
                                epmSeries.push({ x: elapsedSec, y: epm })
                            }

                            // apply light smoothing then interpolate for smoother curves
                            const smoothedEpm = movingAverage(epmSeries, 3)
                            const smoothedWpm = movingAverage(wpmSeries, 3)
                            const interpEpm = interpolateSeries(smoothedEpm, 0.5)
                            const interpWpm = interpolateSeries(smoothedWpm, 0.5)

                            setRealtimeChartData([interpEpm, interpWpm])
                        }}
                    />
                </div>
                <div className={styles.analyticsArea}>
                    <CustomLineChart
                        title="Typing Performance"
                        initialDataGenerator={generateTypingMetricsData}
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
            <div className={styles.rightColumn}>
                <TypingEditor onStart={handleStart} />
            </div>
        </section>
    )
}
