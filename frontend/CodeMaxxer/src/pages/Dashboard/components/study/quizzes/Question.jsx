import { useState } from 'react';
import supabase from '@utils/supabase'
import styles from '@dashboard/styles/Question.module.css';

/**
 * Question component
 * Props:
 * - number: index of question
 * - quiz_id: Id of the current quiz
 * - prompt: the question text
 * - type: 'Multiple' | 'Single' | 'SelectAll' | 'Coding' (coding logic can be stubbed)
 * - choices: array of { id, label, isCorrect, reasoning }
 *   each choice should include reasoning to explain why it is correct or incorrect
 * - onResult: callback(result: boolean)
 */
export default function Question({
    number = 1,
    quiz_id = '',
    userGuidance = '',
    prompt = '',
    type = 'Single',
    choices = [],
    answerHint = '',
    onResult,
    isSkippable = true,
    isFirst = false,
    isLast = false,
    onNext,
    onBack,
    onSubmit
}) {
    const [selectedId, setSelectedId] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [codeAnswer, setCodeAnswer] = useState(userGuidance);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const isMultiChoice = type === 'Multiple' || type === 'SelectAll';

    const evaluateMultiChoice = (selected) => {
        const correctIds = choices.filter(c => c.isCorrect).map(c => c.id);
        if (selected.length !== correctIds.length) return false;
        return correctIds.every(id => selected.includes(id));
    };

    const handleSelect = (id) => {
        if (type === 'Coding') return;

        if (isMultiChoice) {
            const nextSelectedIds = selectedIds.includes(id)
                ? selectedIds.filter(item => item !== id)
                : [...selectedIds, id];

            setSelectedIds(nextSelectedIds);
            const submitted = nextSelectedIds.length > 0;
            setIsSubmitted(submitted);

            if (onResult) {
                onResult(submitted ? evaluateMultiChoice(nextSelectedIds) : false);
            }
            return;
        }

        if (isSubmitted) return;
        setSelectedId(id);
        setIsSubmitted(true);

        const choice = choices.find(c => c.id === id);
        if (onResult) {
            onResult(choice?.isCorrect || false);
        }
    };

    const handleCodeChange = (value) => {
        setCodeAnswer(value);
    };

    const renderChoice = (choice) => {
        const isSelected = isMultiChoice ? selectedIds.includes(choice.id) : selectedId === choice.id;
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

    const testCode = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()

            const res = await fetch("http://localhost:8000/api/v1/private/quiz/answer-code", {
                method: 'POST',
                body: JSON.stringify({
                    quiz_id: quiz_id,
                    question_index: (number-1),
                    answer: codeAnswer
                }),
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            })
            const data = await res.json()
            if(data.error == null){
                onResult(true)
                setIsSubmitted(true)
            }else{
                onResult(false)
                setIsSubmitted(true)
            }
        } catch (err) {
            console.error("Fetch error:", err)
        }
    }

    const renderCoding = () => (
        <div className={styles.codingContainer}>
            <textarea
                className={styles.codingTextarea}
                value={codeAnswer}
                onChange={(e) => handleCodeChange(e.target.value)}
            />
            <button onClick={()=>testCode()}>TEST CODE</button>

            {isSubmitted && answerHint && (
                <div className={styles.feedback}>
                    <div className={styles.status}>
                        <span className={styles.statusIcon}>✓</span>
                        <span className={styles.statusText}>Answer received</span>
                    </div>
                    <p className={styles.reasoning}>{answerHint}</p>
                </div>
            )}
        </div>
    );

    return (
        <div className={styles.questionContainer}>
            <h3 className={styles.prompt}>
                <span className={styles.number}>{number}.</span> {prompt}
            </h3>

            <div className={styles.choicesList}>
                {type === 'Coding' ? renderCoding() : choices.map(renderChoice)}
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
