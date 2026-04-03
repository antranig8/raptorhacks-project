import { useState, useRef } from 'react'
import styles from '@dashboard/styles/Typing.module.css'
import TextArea from '@d_general/typing/TextArea'
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

        const label = i + 1
        epm.push({ x: label, y: Number(currentEpm.toFixed(0)) })
        wpm.push({ x: label, y: Number(currentWpm.toFixed(0)) })
    }

    return [epm, wpm]
}

export default function Typing() {
    const keyboard = useRef(null)
    const [input, setInput] = useState('')
    const [isTopActive, setIsTopActive] = useState(false)

    const handleStart = (config) => {
        console.log('Starting typing with config:', config);
    };

    const practiceTemplate = 'hello world'

    return (
        <section className={styles.container}>
            <div className={styles.leftColumn}>
                <div className={`${styles.typingArea} ${isTopActive ? styles.active : ''}`}>
                    <h1>Practice Typing</h1>
                    <TextArea
                        target={practiceTemplate}
                        onChange={setInput}
                        onActiveChange={setIsTopActive}
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
                />
            </div>
        </div>
        <div className={styles.rightColumn}>
            <TypingEditor onStart={handleStart} />
        </div>
    </section>
)
}
