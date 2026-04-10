import React, { useState, useEffect, useRef, useMemo } from 'react'
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryLegend } from 'victory'
import styles from './CustomLineChart.module.css'

const RANGES = ['1W', '1M', '3M', 'YTD', '1Y', 'ALL']

export default function CustomLineChart({ title, lines = [], showTimeControls = true, xAxisType = 'date', data = null, onRangeChange }) {
    const [timeRange, setTimeRange] = useState('1M')
    const containerRef = useRef(null)
    const [dimensions, setDimensions] = useState({ width: 800, height: 200 })
    const chartData = data

    useEffect(() => {
        if (onRangeChange) {
            onRangeChange(timeRange)
        }
    }, [timeRange, onRangeChange])

    useEffect(() => {
        if (!containerRef.current) return

        const updateDimensions = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect()
                if (width > 0 && height > 0) {
                    setDimensions({ width, height })
                }
            }
        }

        // Initial measure
        updateDimensions()

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect
                if (width > 0 && height > 0) {
                    setDimensions({ width, height })
                }
            }
        })

        resizeObserver.observe(containerRef.current)
        return () => resizeObserver.disconnect()
    }, [])

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
            </div>
            <div className={styles.chartContainer} ref={containerRef}>
                <div className={styles.chartWrapper}>
                    <VictoryChart
                        width={dimensions.width}
                        height={dimensions.height}
                        theme={VictoryTheme.material}
                        padding={{ top: 20, bottom: 40, left: 50, right: 30 }}
                    >
                        {lines.length > 0 && (
                            <VictoryLegend x={40} y={0}
                                orientation="horizontal"
                                gutter={20}
                                style={{ labels: { fontFamily: "'Inter', sans-serif" } }}
                                data={lines.map(line => ({ name: line.name, symbol: { fill: line.color } }))}
                            />
                        )}
                        <VictoryAxis
                            tickFormat={(t) => xAxisType === 'seconds' ? `${t}s` : ''}
                            style={{
                                axis: { stroke: "#cbd5e1" },
                                grid: { stroke: "transparent" },
                                ticks: { stroke: "transparent" },
                                tickLabels: {
                                    fontSize: 10,
                                    padding: 5,
                                    fill: xAxisType === 'seconds' ? "#64748b" : "transparent"
                                }
                            }}
                        />
                        <VictoryAxis
                            dependentAxis
                            style={{
                                axis: { stroke: "transparent" },
                                grid: { stroke: "#f1f5f9" },
                                tickLabels: { padding: 5 }
                            }}
                        />
                        {lines.map((line, idx) => (
                            <VictoryLine
                                key={idx}
                                interpolation="monotoneX"
                                data={chartData ? (Array.isArray(chartData[0]) ? chartData[idx] : chartData) : []}
                                style={{ data: { stroke: line.color, strokeWidth: 3 } }}
                            />
                        ))}
                    </VictoryChart>
                </div>
            </div>
            {showTimeControls && (
                <div className={styles.timeSelectorContainer}>
                    <div className={styles.timeSelector}>
                        {RANGES.map((r) => (
                            <button
                                key={r}
                                className={`${styles.timeBtn} ${timeRange === r ? styles.timeBtnActive : ''}`}
                                onClick={() => setTimeRange(r)}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
