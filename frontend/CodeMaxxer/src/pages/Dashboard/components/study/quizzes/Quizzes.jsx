import { useState } from 'react'
import styles from '@dashboard/styles/Quizzes.module.css'
import ProgressSummary from './ProgressSummary'
import Question from './Question'
import QuizEditor from './QuizEditor'

const QUESTIONS = [
    {
        number: 1,
        prompt: "Which of the following describes the fastest storage locations available to the CPU for executing instructions?",
        isSkippable: true,
        choices: [
            { id: 'A', label: 'Main Memory (RAM)', isCorrect: false },
            { id: 'B', label: 'Registers', isCorrect: true, reasoning: 'Registers are located directly within the CPU and provide the lowest latency for data access.' },
            { id: 'C', label: 'Virtual Memory', isCorrect: false },
            { id: 'D', label: 'Level 1 Cache', isCorrect: false }
        ]
    },
    {
        number: 2,
        prompt: "What is a primary difference between the CMP and SUB instructions in x86 assembly?",
        isSkippable: false,
        choices: [
            { id: 'A', label: 'CMP is significantly faster than SUB', isCorrect: false },
            { id: 'B', label: 'SUB is only used for signed integers', isCorrect: false },
            { id: 'C', label: 'SUB does not update the CPU flags', isCorrect: false },
            { id: 'D', label: 'CMP does not store the result in the destination operand', isCorrect: true, reasoning: 'CMP performs a subtraction but only updates flags without modifying operands.' }
        ]
    }
];

export default function Quizzes() {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [results, setResults] = useState({}); // { index: 'correct' | 'wrong' }

    const currentQuestion = QUESTIONS[currentIdx];
    const total = QUESTIONS.length;

    const handleResult = (isCorrect) => {
        setResults(prev => ({
            ...prev,
            [currentIdx]: isCorrect ? 'correct' : 'wrong'
        }));
    };

    const correctCount = Object.values(results).filter(v => v === 'correct').length;
    const wrongCount = Object.values(results).filter(v => v === 'wrong').length;
    const answeredCount = Object.keys(results).length;

    return (
        <section className={styles.container}>
            <div className={styles.grid}>
                <div className={styles.leftCol}>
                    <QuizEditor onGenerate={(data) => console.log('Generate Quiz:', data)} />
                </div>
                <div className={styles.rightCol}>
                    <ProgressSummary
                        title="Computer Architecture Quiz"
                        answered={answeredCount}
                        correct={correctCount}
                        wrong={wrongCount}
                        total={total}
                        results={results}
                    />
                    <div className={styles.questionSection}>
                        <Question
                            key={currentIdx}
                            {...currentQuestion}
                            isFirst={currentIdx === 0}
                            isLast={currentIdx === QUESTIONS.length - 1}
                            onResult={handleResult}
                            onNext={() => setCurrentIdx(prev => prev + 1)}
                            onBack={() => setCurrentIdx(prev => prev - 1)}
                            onSubmit={() => alert('Quiz Submitted!')}
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}
