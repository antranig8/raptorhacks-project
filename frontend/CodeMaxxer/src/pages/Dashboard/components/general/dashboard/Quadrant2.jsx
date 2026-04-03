import React, { useCallback } from 'react'
import CustomLineChart from './CustomLineChart'
import styles from './Quadrant2.module.css'

// Helper to generate some dummy data to simulate variations across time
const generateData = (range, linesCount = 1) => {
    const points = range === '1D' ? 10 : range === '1W' ? 7 : range === '1M' ? 30 : 12;
    const dataSets = [];
    for (let i = 0; i < linesCount; i++) {
        const lineData = [];
        let startY = Math.random() * 50 + 10;
        for (let j = 0; j < points; j++) {
            startY += (Math.random() - 0.4) * 10;
            lineData.push({ x: j, y: Math.max(0, startY) });
        }
        dataSets.push(lineData);
    }
    return linesCount === 1 ? dataSets[0] : dataSets;
};

export default function Quadrant2() {
    const getOverallData = useCallback((range) => generateData(range, 1), []);
    const getSkillData = useCallback((range) => generateData(range, 2), []);

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
                    <CustomLineChart
                        title="Overall Exp"
                        initialDataGenerator={getOverallData}
                        lines={[{ name: "Global XP", color: "#22c55e" }]}
                    />
                </div>
                <div className={styles.stackItem}>
                    <CustomLineChart
                        title="Exp by Skill"
                        initialDataGenerator={getSkillData}
                        lines={[
                            { name: "Frontend", color: "#3b82f6" },
                            { name: "Backend", color: "#f59e0b" }
                        ]}
                    />
                </div>
            </div>
        </div>
    )
}
