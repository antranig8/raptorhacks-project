import React, { useState, useEffect } from 'react'
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryLegend } from 'victory'
import styles from './CustomLineChart.module.css'

const RANGES = ['1W', '1M', '3M', 'YTD', '1Y', 'ALL']

export default function CustomLineChart({ title, initialDataGenerator, lines = [] }) {
    const [timeRange, setTimeRange] = useState('1M')
    const [chartData, setChartData] = useState([])

    useEffect(() => {
        setChartData(initialDataGenerator(timeRange))
    }, [timeRange, initialDataGenerator])

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
            </div>
            <div className={styles.chartContainer}>
                <VictoryChart
                    width={800}
                    theme={VictoryTheme.material}
                    height={200}
                    padding={{ top: 40, bottom: 20, left: 40, right: 10 }}
                >
                    {lines.length > 0 && (
                        <VictoryLegend x={40} y={0}
                            orientation="horizontal"
                            gutter={20}
                            style={{ labels: { fontFamily: "'Inter', sans-serif" } }}
                            data={lines.map(line => ({ name: line.name, symbol: { fill: line.color } }))}
                        />
                    )}
                    <VictoryAxis tickFormat={() => ''} style={{ axis: { stroke: "#cbd5e1" }, grid: { stroke: "transparent" } }} />
                    <VictoryAxis dependentAxis style={{ axis: { stroke: "transparent" }, grid: { stroke: "#f1f5f9" } }} />
                    {lines.map((line, idx) => (
                        <VictoryLine
                            key={idx}
                            data={Array.isArray(chartData[0]) ? chartData[idx] : chartData}
                            style={{ data: { stroke: line.color, strokeWidth: 3 } }}
                        />
                    ))}
                </VictoryChart>
            </div>
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
        </div>
    )
}
