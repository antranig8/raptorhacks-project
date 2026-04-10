import React from 'react'
import { VictoryPie } from 'victory'
import styles from './Quadrant1.module.css'

export default function Quadrant1() {
    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
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
            </div>
        </div>
    )
}

