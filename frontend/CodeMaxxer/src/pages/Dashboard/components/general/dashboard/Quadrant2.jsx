import React, { useState } from 'react'
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme, VictoryLegend } from 'victory'
import styles from './Quadrant2.module.css'

const RANGES = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL']

// Helper to generate some dummy data to simulate variations across time
const generateData = (range, lines = 1) => {
    const points = range === '1D' ? 10 : range === '1W' ? 7 : range === '1M' ? 30 : 12;
    const dataSets = [];
    for (let i = 0; i < lines; i++) {
        const lineData = [];
        let startY = Math.random() * 50 + 10;
        for (let j = 0; j < points; j++) {
            startY += (Math.random() - 0.4) * 10; // Slight upward trend
            lineData.push({ x: j, y: Math.max(0, startY) });
        }
        dataSets.push(lineData);
    }
    return dataSets;
};

const ChartTitle = ({ title }) => (
    <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
    </div>
);

const TimeSelector = ({ activeRange, onRangeChange }) => (
    <div className={styles.timeSelectorContainer}>
        <div className={styles.timeSelector}>
            {RANGES.map((r) => (
                <button
                    key={r}
                    className={`${styles.timeBtn} ${activeRange === r ? styles.timeBtnActive : ''}`}
                    onClick={() => onRangeChange(r)}
                >
                    {r}
                </button>
            ))}
        </div>
    </div>
);

export default function Quadrant2() {
    const [timeRange, setTimeRange] = useState('1M')

    const dataTop = generateData(timeRange, 1)[0]
    const dataBottom = generateData(timeRange, 2) // Multiple lines for different skills

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
                    <ChartTitle title="Overall Exp" />
                    <div className={styles.chartContainer}>
                        <VictoryChart width={800} theme={VictoryTheme.material} height={200} padding={{ top: 30, bottom: 20, left: 40, right: 10 }}>
                            <VictoryLegend x={40} y={0}
                                orientation="horizontal"
                                gutter={20}
                                data={[{ name: "Global XP", symbol: { fill: "#22c55e" } }]}
                            />
                            <VictoryAxis tickFormat={() => ''} style={{ axis: { stroke: "#cbd5e1" }, grid: { stroke: "transparent" } }} />
                            <VictoryAxis dependentAxis style={{ axis: { stroke: "transparent" }, grid: { stroke: "#f1f5f9" } }} />
                            <VictoryLine data={dataTop} style={{ data: { stroke: "#22c55e", strokeWidth: 3 } }} />
                        </VictoryChart>
                    </div>
                    <TimeSelector activeRange={timeRange} onRangeChange={setTimeRange} />
                </div>
                <div className={styles.stackItem}>
                    <ChartTitle title="Exp by Skill" />
                    <div className={styles.chartContainer}>
                        <VictoryChart width={800} theme={VictoryTheme.material} height={200} padding={{ top: 30, bottom: 20, left: 40, right: 10 }}>
                            <VictoryLegend x={40} y={0}
                                orientation="horizontal"
                                gutter={20}
                                data={[
                                    { name: "Frontend", symbol: { fill: "#3b82f6" } },
                                    { name: "Backend", symbol: { fill: "#f59e0b" } }
                                ]}
                            />
                            <VictoryAxis tickFormat={() => ''} style={{ axis: { stroke: "#cbd5e1" }, grid: { stroke: "transparent" } }} />
                            <VictoryAxis dependentAxis style={{ axis: { stroke: "transparent" }, grid: { stroke: "#f1f5f9" } }} />
                            <VictoryLine data={dataBottom[0]} style={{ data: { stroke: "#3b82f6", strokeWidth: 3 } }} />
                            <VictoryLine data={dataBottom[1]} style={{ data: { stroke: "#f59e0b", strokeWidth: 3 } }} />
                        </VictoryChart>
                    </div>
                    <TimeSelector activeRange={timeRange} onRangeChange={setTimeRange} />
                </div>
            </div>
        </div>
    )
}
