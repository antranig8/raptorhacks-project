import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import styles from "@dashboard/styles/Quizzes.module.css";
import ProgressSummary from "./ProgressSummary";
import Question from "./Question";
import QuizEditor from "./QuizEditor";
import { fetchQuizByNode, fetchQuizHint, generateQuiz, submitQuiz, submitQuizAnswer } from "./quizApi";
import { evaluateMockAnswer } from "./mockQuizData";
import questionData from "./questions.json";

const STATIC_MOCK_QUESTIONS = questionData.questions;

export default function Quizzes() {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const skillTreeId = searchParams.get("skillTreeId");
    const nodeId = searchParams.get("nodeId");
    const nodeName = useMemo(
        () => location.state?.nodeName || nodeId || "Selected Node",
        [location.state?.nodeName, nodeId],
    );
    const skillTreeName = useMemo(
        () => location.state?.skillTreeName || "Skill Tree",
        [location.state?.skillTreeName],
    );
    const hasNodeLinkedContext = Boolean(skillTreeId && nodeId);

    const [quiz, setQuiz] = useState(null);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [results, setResults] = useState({});
    const [answers, setAnswers] = useState({});
    const [hints, setHints] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [submissionMessage, setSubmissionMessage] = useState("");
    const [submissionDetails, setSubmissionDetails] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validatingIndex, setValidatingIndex] = useState(null);
    const [hintLoadingIndex, setHintLoadingIndex] = useState(null);
    const [isQuizMode, setIsQuizMode] = useState(hasNodeLinkedContext);
    const [isQuizComplete, setIsQuizComplete] = useState(false);

    const isMockMode = Boolean(quiz?.isMock);
    const activeQuestions = quiz?.questions || STATIC_MOCK_QUESTIONS;
    const currentQuestion = activeQuestions[currentIdx] || null;
    const total = activeQuestions.length;

    useEffect(() => {
        // Keep the original mock quizzes page behavior by default, but switch
        // into quiz mode immediately when the page is opened from a node click.
        setIsQuizMode(hasNodeLinkedContext);
    }, [hasNodeLinkedContext]);

    useEffect(() => {
        // Reset local quiz state whenever the route points at a different
        // skill tree node, then fetch the saved/generated quiz for that node.
        setQuiz(null);
        setResults({});
        setAnswers({});
        setHints({});
        setCurrentIdx(0);
        setSubmissionMessage("");
        setSubmissionDetails(null);
        setValidatingIndex(null);
        setHintLoadingIndex(null);
        setIsQuizComplete(false);

        if (!hasNodeLinkedContext) {
            setError("");
            return;
        }

        let isCancelled = false;

        const loadQuiz = async () => {
            setLoading(true);
            setError("");

            try {
                const nextQuiz = await fetchQuizByNode({
                    skillTreeId,
                    nodeId,
                    nodeName,
                    skillTreeName,
                });
                if (!isCancelled) {
                    setQuiz(nextQuiz);
                }
            } catch (requestError) {
                if (!isCancelled) {
                    setError(requestError.message || "Failed to load quiz.");
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        loadQuiz();

        return () => {
            isCancelled = true;
        };
    }, [hasNodeLinkedContext, skillTreeId, nodeId]);

    const handleGenerateQuiz = async ({ language, prompt, configs = [] }) => {
        // The standalone editor now calls the backend so freeform quizzes use
        // the same generation and grading contract as node-linked quizzes.
        setIsQuizMode(true);
        setLoading(true);
        setError("");
        setSubmissionMessage("");
        setSubmissionDetails(null);

        try {
            const hardMode = configs.includes("hard");
            const isTimed = configs.includes("timing");
            const nextQuiz = await generateQuiz({
                language,
                prompt,
                allowHints: configs.includes("hints") && !hardMode,
                allowExplanations: configs.includes("explanations") && !hardMode,
                hardMode,
            });
            setQuiz({ ...nextQuiz, isTimed });
        } catch (requestError) {
            setError(requestError.message || "Failed to generate quiz.");
            setIsQuizMode(false);
            return;
        } finally {
            setLoading(false);
        }

        setCurrentIdx(0);
        setResults({});
        setAnswers({});
        setHints({});
        setSubmissionMessage("");
        setSubmissionDetails(null);
        setIsQuizComplete(false);
    };

    const handleMockResult = (isCorrect, answer) => {
        setAnswers((prev) => ({
            ...prev,
            [currentIdx]: answer,
        }));
        setResults((prev) => ({
            ...prev,
            [currentIdx]: { correct: isCorrect },
        }));
    };

    const handleValidateAnswer = async (answer) => {
        if (!quiz) {
            return;
        }

        // Store validation results locally in the page so the backend stays
        // stateless between checks.
        setError("");
        setValidatingIndex(currentIdx);

        try {
            if (quiz.isMock) {
                const result = evaluateMockAnswer(quiz.questions[currentIdx], currentIdx, answer);
                setAnswers((prev) => ({
                    ...prev,
                    [currentIdx]: answer,
                }));
                setResults((prev) => ({
                    ...prev,
                    [currentIdx]: result,
                }));
                return;
            }

            const result = await submitQuizAnswer({
                quizId: quiz.quiz_id,
                nodeId: quiz.node_id,
                questionIndex: currentIdx,
                answer,
            });

            setAnswers((prev) => ({
                ...prev,
                [currentIdx]: answer,
            }));
            setResults((prev) => ({
                ...prev,
                [currentIdx]: result,
            }));
        } catch (requestError) {
            setError(requestError.message || "Failed to validate answer.");
        } finally {
            setValidatingIndex(null);
        }
    };

    const handleRequestHint = async () => {
        if (!quiz || quiz.isMock || !quiz.allow_hints || hints[currentIdx]) {
            return;
        }

        setError("");
        setHintLoadingIndex(currentIdx);

        try {
            const result = await fetchQuizHint({
                quizId: quiz.quiz_id,
                nodeId: quiz.node_id,
                questionIndex: currentIdx,
            });
            setHints((prev) => ({
                ...prev,
                [currentIdx]: result.hint,
            }));
        } catch (requestError) {
            setError(requestError.message || "Failed to load hint.");
        } finally {
            setHintLoadingIndex(null);
        }
    };

    const handleSubmitQuiz = async () => {
        if (isMockMode && !quiz) {
            setIsQuizMode(false);
            setSubmissionMessage("Mock quiz submitted.");
            return;
        }

        if (!quiz) {
            return;
        }

        // The frontend is responsible for collecting the answers it wants
        // graded and sending them back as a self-contained request.
        const preparedAnswers = Object.entries(answers).map(([questionIndex, answer]) => ({
            questionIndex: Number(questionIndex),
            answer,
        }));

        if (preparedAnswers.length === 0) {
            setSubmissionMessage("Answer at least one question before submitting.");
            return;
        }

        setIsSubmitting(true);
        setSubmissionMessage("");
        setSubmissionDetails(null);
        setError("");

        try {
            if (quiz.isMock) {
                const correctAnswers = Object.values(results).filter((result) => result?.correct).length;
                setSubmissionMessage(`Submitted! You got ${correctAnswers} out of ${quiz.questions.length} right.`);
                setIsQuizComplete(true);
                return;
            }

            const submission = await submitQuiz({
                quizId: quiz.quiz_id,
                nodeId: quiz.node_id,
                answers: preparedAnswers,
            });

            const unlockedNames = Array.isArray(submission.unlocked_children)
                ? submission.unlocked_children.map((child) => child?.name).filter(Boolean)
                : [];
            let message = `Submitted! You got ${submission.correct_answers} out of ${submission.total_questions} right and earned ${submission.exp_gained ?? 0} XP.`;
            if (submission.branch_unlocked && unlockedNames.length > 0) {
                message += ` New branch unlocked: ${unlockedNames.join(", ")}.`;
            }
            setSubmissionMessage(message);
            setSubmissionDetails(submission);
            setIsQuizComplete(true);
        } catch (requestError) {
            setError(requestError.message || "Failed to submit quiz.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const answeredCount = useMemo(
        () => Object.values(results).filter(Boolean).length,
        [results],
    );
    const correctCount = useMemo(
        () => Object.values(results).filter((value) => value?.correct).length,
        [results],
    );
    const wrongCount = useMemo(
        () => Object.values(results).filter((value) => value && !value.correct).length,
        [results],
    );

    return (
        <section className={styles.container}>
            <div className={`${styles.fullCol} ${isQuizMode ? styles.quizMode : styles.editorMode}`}>
                <div className={styles.leftCol}>
                    {hasNodeLinkedContext ? (
                        <div className={styles.placeholder}>
                            <h3 className={styles.placeholderTitle}>Node-Linked Quiz</h3>
                            <p className={styles.placeholderText}>
                                {`Loaded from ${skillTreeName}: ${nodeName}`}
                            </p>
                            {quiz && (
                                <button
                                    className={styles.placeholderButton}
                                    onClick={async () => {
                                        // Regeneration replaces the one saved quiz
                                        // for this node and resets local progress.
                                        setLoading(true);
                                        setError("");
                                        try {
                                            const nextQuiz = await fetchQuizByNode({
                                                skillTreeId,
                                                nodeId,
                                                nodeName,
                                                skillTreeName,
                                                forceRegenerate: true,
                                            });
                                            setQuiz(nextQuiz);
                                            setCurrentIdx(0);
                                            setResults({});
                                            setAnswers({});
                                            setHints({});
                                            setSubmissionMessage("");
                                            setSubmissionDetails(null);
                                        } catch (requestError) {
                                            setError(requestError.message || "Failed to regenerate quiz.");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    disabled={loading}
                                    type="button"
                                >
                                    {loading ? "Loading..." : "Regenerate Quiz"}
                                </button>
                            )}
                        </div>
                    ) : (
                        <QuizEditor onGenerate={handleGenerateQuiz} isGenerating={loading} error={error} />
                    )}
                </div>

                <div className={styles.rightCol}>
                    {!isQuizMode ? (
                        <div className={styles.placeholder}>
                            <h3 className={styles.placeholderTitle}>Generate Quiz</h3>
                            <p className={styles.placeholderText}>Use the editor on the left to generate a quiz.</p>
                        </div>
                    ) : loading ? (
                        <div className={styles.placeholder}>
                            <h3 className={styles.placeholderTitle}>Loading Quiz</h3>
                            <p className={styles.placeholderText}>Fetching the saved quiz for this node or generating a new one.</p>
                        </div>
                    ) : error && !quiz ? (
                        <div className={styles.placeholder}>
                            <h3 className={styles.placeholderTitle}>Quiz Error</h3>
                            <p className={styles.placeholderText}>{error}</p>
                        </div>
                    ) : isQuizComplete ? (
                        <div className={styles.placeholder}>
                            <h3 className={styles.placeholderTitle}>Quiz Submitted</h3>
                            <p className={styles.placeholderText}>{submissionMessage}</p>
                            {submissionDetails && (
                                <>
                                    <p className={styles.placeholderText}>
                                        {`Total node XP: ${submissionDetails.total_node_xp ?? 0}`}
                                    </p>
                                    {submissionDetails.branch_unlocked && Array.isArray(submissionDetails.unlocked_children) && submissionDetails.unlocked_children.length > 0 && (
                                        <p className={styles.placeholderText}>
                                            {`Unlocked topics: ${submissionDetails.unlocked_children.map((child) => child?.name).filter(Boolean).join(", ")}`}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    ) : currentQuestion ? (
                        <>
                            <ProgressSummary
                                title={quiz?.title || "Computer Architecture Quiz"}
                                answered={answeredCount}
                                correct={correctCount}
                                wrong={wrongCount}
                                total={total}
                                results={Object.fromEntries(
                                    Object.entries(results).map(([index, value]) => [
                                        index,
                                        value.correct ? "correct" : "wrong",
                                    ]),
                                )}
                                isTimed={Boolean(quiz?.isTimed)}
                                onTimeUp={handleSubmitQuiz}
                            />
                            {error && (
                                <p className={styles.placeholderText}>{error}</p>
                            )}
                            {submissionMessage && (
                                <p className={styles.placeholderText}>{submissionMessage}</p>
                            )}
                            <div className={styles.questionSection}>
                                <Question
                                    key={`${quiz?.quiz_id || "mock"}-${currentIdx}`}
                                    {...currentQuestion}
                                    number={currentIdx + 1}
                                    initialAnswer={answers[currentIdx] ?? null}
                                    validationResult={isMockMode ? null : (results[currentIdx] || null)}
                                    allowHints={Boolean(quiz?.allow_hints)}
                                    hint={hints[currentIdx] || ""}
                                    isHintLoading={hintLoadingIndex === currentIdx}
                                    isValidating={validatingIndex === currentIdx}
                                    isMockMode={isMockMode}
                                    isFirst={currentIdx === 0}
                                    isLast={currentIdx === total - 1}
                                    onValidate={handleValidateAnswer}
                                    onRequestHint={handleRequestHint}
                                    onResult={handleMockResult}
                                    onNext={() => setCurrentIdx((prev) => prev + 1)}
                                    onBack={() => setCurrentIdx((prev) => prev - 1)}
                                    onSubmit={handleSubmitQuiz}
                                />
                            </div>
                            {isSubmitting && (
                                <p className={styles.placeholderText}>Submitting quiz...</p>
                            )}
                        </>
                    ) : (
                        <div className={styles.placeholder}>
                            <h3 className={styles.placeholderTitle}>No Quiz Loaded</h3>
                            <p className={styles.placeholderText}>This node does not have a quiz yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
