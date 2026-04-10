import React, { useEffect, useState } from 'react'
import { VictoryPie } from 'victory'
import styles from './Quadrant1.module.css'

export default function Quadrant1({ userData }) {

    if (!userData) return <div>Loading...</div>;

    const [ answers, setAnswers ] = useState([0.5, 0.5])

    useEffect(() => {
        const quizEvents = userData.quiz_complete.events;

        const { totalRight, totalQuestions } = quizEvents.reduce(
            (acc, e) => {
                acc.totalRight += e.right_questions;
                acc.totalQuestions += e.total_questions;
                return acc;
            },
            { totalRight: 0, totalQuestions: 0 }
        );


        setAnswers([totalRight, (totalQuestions-totalRight)])

    }, [userData])

    return (
        <div className={styles.root}>
            <div className={styles.stack}>
                <div className={styles.stackItem}>
                    <h3 className={styles.title}>Quizzes</h3>
                    <div className={styles.chartContainer}>
                        <VictoryPie
                            data={[
                                { x: "Correct", y: answers[0] },
                                { x: "Wrong", y: answers[1] }
                            ]}
                            colorScale={["#22c55e", "#ef4444"]}
                            height={180}
                            padding={20}
                            labelRadius={40}
                            labels={({ datum }) => `${datum.y}`}
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

