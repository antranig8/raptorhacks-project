import React, { useMemo, useState } from 'react'
import CustomLineChart from './CustomLineChart'
import styles from './Quadrant2.module.css'

const RANGE_TO_DAYS = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    YTD: null,
    '1Y': 365,
    ALL: null,
}

function startOfDay(value) {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
}

function toDayKey(value) {
    return startOfDay(value).toISOString().slice(0, 10)
}

function to10SecKey(value) {
    const date = new Date(value)
    date.setMilliseconds(0)
    date.setSeconds(Math.floor(date.getSeconds() / 10) * 10)
    return date.toISOString()
}
function buildRangeStart(range, latestDate) {
    if (!latestDate) return null

    if (range === 'YTD') {
        return new Date(latestDate.getFullYear(), 0, 1)
    }

    const days = RANGE_TO_DAYS[range]
    if (!days) return null

    const start = new Date(latestDate)
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)
    return start
}

function aggregateExpEvents(events, range) {
    if (!events.length) return { overall: [] }

    const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    const latestDate = startOfDay(sorted[sorted.length - 1].timestamp)
    const rangeStart = buildRangeStart(range, latestDate)

    const filtered = rangeStart
        ? sorted.filter((e) => startOfDay(e.timestamp) >= rangeStart)
        : sorted

    const byDay = new Map()
    for (const event of filtered) {
        const dayKey = to10SecKey(event.timestamp)
        byDay.set(dayKey, (byDay.get(dayKey) || 0) + Number(event.exp_gained))
    }

    const dayKeys = Array.from(new Set(filtered.map((e) => to10SecKey(e.timestamp)))).sort()

    let running = 0
    const overall = dayKeys.map((dayKey) => {
        running += byDay.get(dayKey) || 0
        return { x: new Date(dayKey), y: running }
    })

    return { overall }
}

export default function Quadrant2({ userData }) {
    const [overallRange, setOverallRange] = useState('ALL')

    const expEvents = useMemo(() => userData?.exp?.events ?? [], [userData])

    const availableRanges = useMemo(() => {
        if (!expEvents.length) return ['ALL']

        const sorted = [...expEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
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
    }, [expEvents])

    const overallData = useMemo(
        () => aggregateExpEvents(expEvents, overallRange).overall,
        [expEvents, overallRange]
    )

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
                    <CustomLineChart
                        title="Overall Exp"
                        data={overallData}
                        onRangeChange={setOverallRange}
                        lines={[{ name: 'Global XP', color: '#22c55e' }]}
                        availableRanges={availableRanges}
                    />
                </div>
            </div>
        </div>
    )
}