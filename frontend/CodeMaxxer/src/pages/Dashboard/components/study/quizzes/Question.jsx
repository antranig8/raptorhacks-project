import { useState } from 'react';
import styles from './Question.module.css';

/**
 * Question component
 * Props:
 * - number: index of question
 * - prompt: the question text
 * - type: 'Multiple' | 'Single' | 'SelectAll' | 'Coding' (coding logic can be stubbed)
 * - choices: array of { id, label, isCorrect, reasoning }
 * - onResult: callback(result: boolean)
 */
export default function Question({ 
    number = 1, 
    prompt = '', 
    type = 'Single', 
    choices = [], 
    onResult,
    isSkippable = true,
    isFirst = false,
    isLast = false,
    onNext,
    onBack,
    onSubmit
}) {
    const [selectedId, setSelectedId] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSelect = (id) => {
        if (isSubmitted) return;
        setSelectedId(id);
        setIsSubmitted(true);
        
        const choice = choices.find(c => c.id === id);
        if (onResult) {
            onResult(choice?.isCorrect || false);
        }
    };

    const renderChoice = (choice) => {
        const isSelected = selectedId === choice.id;
        const showResult = isSubmitted && isSelected;
        
        let containerClass = styles.choice;
        if (showResult) {
            containerClass += choice.isCorrect ? ` ${styles.correct}` : ` ${styles.wrong}`;
        }

        return (
            <div 
                key={choice.id} 
                className={containerClass} 
                onClick={() => handleSelect(choice.id)}
            >
                <div className={styles.choiceHeader}>
                    <span className={styles.choiceId}>{choice.id}.</span>
                    <span className={styles.choiceLabel}>{choice.label}</span>
                </div>

                {showResult && (
                    <div className={styles.feedback}>
                        <div className={styles.status}>
                            <span className={styles.statusIcon}>
                                {choice.isCorrect ? '✓' : '✕'}
                            </span>
                            <span className={styles.statusText}>
                                {choice.isCorrect ? 'Right answer' : 'Wrong answer'}
                            </span>
                        </div>
                        {choice.reasoning && (
                            <p className={styles.reasoning}>{choice.reasoning}</p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={styles.questionContainer}>
            <h3 className={styles.prompt}>
                <span className={styles.number}>{number}.</span> {prompt}
            </h3>

            <div className={styles.choicesList}>
                {choices.map(renderChoice)}
            </div>

            <div className={styles.footer}>
                <button 
                    className={styles.backBtn} 
                    onClick={onBack}
                    disabled={isFirst}
                >
                    Back
                </button>
                <div className={styles.rightActions}>
                    {isLast ? (
                        <button 
                            className={styles.submitBtn} 
                            onClick={onSubmit}
                            disabled={!isSubmitted && !isSkippable}
                        >
                            Submit
                        </button>
                    ) : (
                        <button 
                            className={styles.nextBtn} 
                            onClick={onNext}
                            disabled={!isSubmitted && !isSkippable}
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
