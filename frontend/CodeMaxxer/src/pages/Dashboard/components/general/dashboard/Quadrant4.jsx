import React, { useState, useMemo } from 'react'
import CustomLineChart from './CustomLineChart'
import styles from './Quadrant4.module.css'

// Helper to generate some dummy data to simulate variations across time
const generateData = (range) => {
    const points = range === '1D' ? 10 : range === '1W' ? 7 : range === '1M' ? 30 : 12;
    const lineData = [];
    let startY = Math.random() * 50 + 10;
    for (let j = 0; j < points; j++) {
        startY += (Math.random() - 0.4) * 10;
        lineData.push({ x: j, y: Math.max(0, startY) });
    }
    return lineData;
};

export default function Quadrant4() {
    const [range, setRange] = useState('1M');
    const quizData = useMemo(() => generateData(range), [range]);

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
                    <CustomLineChart
                        title="Quizzes Taken"
                        data={quizData}
                        onRangeChange={setRange}
                        lines={[{ name: "Quizzes", color: "#3b82f6" }]}
                    />
                </div>
            </div>
        </div>
    )
}

