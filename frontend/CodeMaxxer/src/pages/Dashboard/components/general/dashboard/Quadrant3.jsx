import React, { useState, useMemo } from 'react'
import CustomLineChart from './CustomLineChart'
import styles from './Quadrant3.module.css'

// Helper to generate some dummy data to simulate variations across time
const generateData = (range) => {
    const points = range === '1D' ? 10 : range === '1W' ? 7 : range === '1M' ? 30 : 12;
    const lineData = [];
    let startY = Math.random() * 100 + 50;
    for (let j = 0; j < points; j++) {
        startY += (Math.random() - 0.4) * 20;
        lineData.push({ x: j, y: Math.max(0, startY) });
    }
    return lineData;
};

export default function Quadrant3() {
    const [range, setRange] = useState('1M');
    const locData = useMemo(() => generateData(range), [range]);

    return (
        <div className={styles.root}>
            <div className={styles.container}>
                <CustomLineChart
                    title="Lines of Code Written"
                    data={locData}
                    onRangeChange={setRange}
                    lines={[{ name: "LOC", color: "#a855f7" }]}
                />
            </div>
        </div>
    )
}
