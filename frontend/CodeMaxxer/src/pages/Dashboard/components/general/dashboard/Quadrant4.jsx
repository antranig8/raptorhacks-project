import React, { useCallback } from 'react'
import { VictoryPie } from 'victory'
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
    const getQuizzesTakenData = useCallback((range) => generateData(range), []);

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                {/* Top Row: Quizzes Pie (Weight 1) */}
                <div className={styles.stackItemSmall}>
                    <h3 className={styles.title}>Quizzes</h3>
                    <div className={styles.chartContainer}>
                        <VictoryPie
                            data={[
                                { x: "Correct", y: 75 },
                                { x: "Wrong", y: 25 }
                            ]}
                            colorScale={["#22c55e", "#ef4444"]}
                            height={180}
                            padding={20}
                            labelRadius={40}
                            labels={({ datum }) => `${datum.y}%`}
                            style={{
                                labels: {
                                    fontSize: 12,
                                    fill: "white",
                                    fontWeight: "bold",
                                    fontFamily: "'Inter', sans-serif"
                                }
                            }}
                        />
                    </div>
                    <div className={styles.legendWrapper}>
                        <div className={styles.legendItem}><span className={styles.dot} style={{ background: '#22c55e' }}></span> Correct</div>
                        <div className={styles.legendItem}><span className={styles.dot} style={{ background: '#ef4444' }}></span> Wrong</div>
                    </div>
                </div>

                {/* Bottom Row: Quizzes Taken Line (Weight 2) */}
                <div className={styles.stackItemLarge}>
                    <CustomLineChart
                        title="Quizzes Taken"
                        initialDataGenerator={getQuizzesTakenData}
                        lines={[{ name: "Quizzes", color: "#3b82f6" }]}
                    />
                </div>
            </div>
        </div>
    )
}
