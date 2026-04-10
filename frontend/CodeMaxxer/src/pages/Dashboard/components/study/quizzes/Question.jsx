import { useState } from "react";
import styles from "@dashboard/styles/Question.module.css";

export default function Question({
    number = 1,
    prompt = "",
    type = "Single",
    choices = [],
    answerHint = "",
    userGuidance = "",
    initialAnswer = null,
    validationResult = null,
    isValidating = false,
    isMockMode = false,
    onValidate,
    onResult,
    isSkippable = true,
    isFirst = false,
    isLast = false,
    onNext,
    onBack,
    onSubmit,
}) {
    const [selectedId, setSelectedId] = useState(typeof initialAnswer === "string" && type !== "Coding" ? initialAnswer : null);
    const [selectedIds, setSelectedIds] = useState(Array.isArray(initialAnswer) ? initialAnswer : []);
    const [codeAnswer, setCodeAnswer] = useState(typeof initialAnswer === "string" && type === "Coding" ? initialAnswer : (userGuidance || ""));
    const isMultiChoice = type === "Multiple" || type === "SelectAll";
    const hasBackendValidation = Boolean(validationResult);
    const isSubmitted = isMockMode
        ? (type === "Coding" ? codeAnswer.trim().length > 0 : (isMultiChoice ? selectedIds.length > 0 : selectedId !== null))
        : hasBackendValidation;

    const evaluateMultiChoice = (selected) => {
        const correctIds = choices.filter((choice) => choice.isCorrect).map((choice) => choice.id);
        if (selected.length !== correctIds.length) return false;
        return correctIds.every((id) => selected.includes(id));
    };

    const handleSelect = (id) => {
        if (type === "Coding" || (isSubmitted && !isMockMode)) return;

        if (isMultiChoice) {
            const nextSelectedIds = selectedIds.includes(id)
                ? selectedIds.filter((item) => item !== id)
                : [...selectedIds, id];

            setSelectedIds(nextSelectedIds);

            if (isMockMode) {
                onResult?.(nextSelectedIds.length > 0 ? evaluateMultiChoice(nextSelectedIds) : false, nextSelectedIds);
            }
            return;
        }

        setSelectedId(id);

        if (isMockMode) {
            const choice = choices.find((item) => item.id === id);
            onResult?.(choice?.isCorrect || false, id);
        }
    };

    const handleCodeChange = (value) => {
        setCodeAnswer(value);

        if (isMockMode) {
            onResult?.(value.trim().length > 0, value);
        }
    };

    const handleValidate = async () => {
        // Validation is explicit instead of auto-submitting on click so the
        // user can change selections before the backend grades the answer.
        if (isMockMode || !onValidate) {
            return;
        }

        if (type === "Coding") {
            await onValidate(codeAnswer);
            return;
        }

        if (isMultiChoice) {
            await onValidate(selectedIds);
            return;
        }

        await onValidate(selectedId);
    };

    const renderChoice = (choice) => {
        const isSelected = isMultiChoice ? selectedIds.includes(choice.id) : selectedId === choice.id;
        const showResult = isSubmitted && isSelected;

        let containerClass = styles.choice;
        if (showResult) {
            const isCorrect = isMockMode ? choice.isCorrect : validationResult?.correct;
            containerClass += isCorrect ? ` ${styles.correct}` : ` ${styles.wrong}`;
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

                {showResult && isMockMode && (
                    <div className={styles.feedback}>
                        <div className={styles.status}>
                            <span className={styles.statusIcon}>
                                {choice.isCorrect ? "\u2713" : "\u2715"}
                            </span>
                            <span className={styles.statusText}>
                                {choice.isCorrect ? "Right answer" : "Wrong answer"}
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

    const renderFeedback = () => {
        if (!hasBackendValidation || isMockMode) {
            return null;
        }

        // The backend is the source of truth for correctness, so the UI only
        // renders the returned grading result and message.
        const statusIcon = validationResult.correct ? "\u2713" : "\u2715";
        const statusText = validationResult.correct ? "Correct" : "Incorrect";
        const detail = validationResult.error || validationResult.reasoning;

        return (
            <div className={styles.feedback}>
                <div className={styles.status}>
                    <span className={styles.statusIcon}>{statusIcon}</span>
                    <span className={styles.statusText}>{statusText}</span>
                </div>
                {detail && (
                    <p className={styles.reasoning}>{detail}</p>
                )}
            </div>
        );
    };

    const renderCoding = () => (
        <div className={styles.codingContainer}>
            <textarea
                className={styles.codingTextarea}
                placeholder="Enter your code or pseudocode here..."
                value={codeAnswer}
                onChange={(event) => handleCodeChange(event.target.value)}
            />

            {!isMockMode && (
                <button
                    className={styles.nextBtn}
                    onClick={handleValidate}
                    disabled={codeAnswer.trim().length === 0 || isSubmitted || isValidating}
                    type="button"
                >
                    {isValidating ? "Checking..." : "Run Check"}
                </button>
            )}

            {isMockMode && isSubmitted && answerHint && (
                <div className={styles.feedback}>
                    <div className={styles.status}>
                        <span className={styles.statusIcon}>&#10003;</span>
                        <span className={styles.statusText}>Answer received</span>
                    </div>
                    <p className={styles.reasoning}>{answerHint}</p>
                </div>
            )}

            {renderFeedback()}
        </div>
    );

    return (
        <div className={styles.questionContainer}>
            <h3 className={styles.prompt}>
                <span className={styles.number}>{number}.</span> {prompt}
            </h3>

            <div className={styles.choicesList}>
                {type === "Coding" ? renderCoding() : choices.map(renderChoice)}
                {type !== "Coding" && renderFeedback()}
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
                    {!isMockMode && type !== "Coding" && (
                        <button
                            className={styles.nextBtn}
                            onClick={handleValidate}
                            disabled={
                                isValidating
                                || isSubmitted
                                || (isMultiChoice ? selectedIds.length === 0 : !selectedId)
                            }
                            type="button"
                        >
                            {isValidating ? "Checking..." : "Check Answer"}
                        </button>
                    )}
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
