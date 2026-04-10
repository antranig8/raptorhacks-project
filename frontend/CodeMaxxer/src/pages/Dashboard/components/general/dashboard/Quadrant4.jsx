import React, { useState, useMemo } from 'react'
import CustomLineChart from './CustomLineChart'
import styles from './Quadrant4.module.css'

function to10SecKey(value) {
    const date = new Date(value)
    date.setMilliseconds(0)
    date.setSeconds(Math.floor(date.getSeconds() / 10) * 10)
    return date.toISOString()
}

function buildRangeStart(range, latestDate) {
    if (!latestDate) return null
    if (range === 'ALL') return null
    if (range === 'YTD') return new Date(latestDate.getFullYear(), 0, 1)

    const RANGE_TO_DAYS = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 }
    const days = RANGE_TO_DAYS[range]
    if (!days) return null

    const start = new Date(latestDate)
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    return start
}

function aggregateQuizEvents(events, range) {
    if (!events.length) return { overall: [] }

    const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    const latestDate = new Date(sorted[sorted.length - 1].timestamp)
    const rangeStart = buildRangeStart(range, latestDate)

    const filtered = rangeStart
        ? sorted.filter((e) => new Date(e.timestamp) >= rangeStart)
        : sorted

    const byBucket = new Map()
    for (const event of filtered) {
        const key = to10SecKey(event.timestamp)
        byBucket.set(key, (byBucket.get(key) || 0) + 1)
    }

    const bucketKeys = Array.from(new Set(filtered.map((e) => to10SecKey(e.timestamp)))).sort()

    let running = 0
    const overall = bucketKeys.map((key) => {
        running += byBucket.get(key) || 0
        return { x: new Date(key), y: running }
    })

    return { overall }
}

export default function Quadrant4({ userData }) {
    const [range, setRange] = useState('ALL')

    const quizEvents = useMemo(() => userData?.quiz_complete?.events ?? [], [userData])

    const availableRanges = useMemo(() => {
        if (!quizEvents.length) return ['ALL']

        const sorted = [...quizEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        const earliest = new Date(sorted[0].timestamp)
        const latest = new Date(sorted[sorted.length - 1].timestamp)
        const daySpan = Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24))

        return [
            daySpan >= 7   && '1W',
            daySpan >= 30  && '1M',
            daySpan >= 90  && '3M',
            daySpan >= 365 && 'YTD',
            daySpan >= 365 && '1Y',
            'ALL',
        ].filter(Boolean)
    }, [quizEvents])

    const quizData = useMemo(
        () => aggregateQuizEvents(quizEvents, range).overall,
        [quizEvents, range]
    )

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
                    <CustomLineChart
                        title="Quizzes Taken"
                        data={quizData}
                        onRangeChange={setRange}
                        lines={[{ name: 'Quizzes', color: '#3b82f6' }]}
                        availableRanges={availableRanges}
                    />
                </div>
            </div>
        </div>
    )
}