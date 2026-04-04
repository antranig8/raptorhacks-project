import { useState } from 'react'
import styles from '@dashboard/styles/Quizzes.module.css'
import ProgressSummary from './ProgressSummary'
import Question from './Question'
import QuizEditor from './QuizEditor'

// Sample quiz questions are stored externally in questions.json for debugging and easier maintenance.
import questionData from './questions.json'

const QUESTIONS = questionData.questions;

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
                            number={currentIdx + 1}
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
