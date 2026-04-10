import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import styles from "@dashboard/styles/Quizzes.module.css";
import ProgressSummary from "./ProgressSummary";
import Question from "./Question";
import QuizEditor from "./QuizEditor";
import { fetchQuizByNode, submitQuiz, submitQuizAnswer } from "./quizApi";
import { evaluateMockAnswer } from "./mockQuizData";
import { MOCK_SKILL_TREE_ID } from "@d_general/skilltree/skillTreeData";
import questionData from "./questions.json";

const STATIC_MOCK_QUESTIONS = questionData.questions;

export default function Quizzes() {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const skillTreeId = searchParams.get("skillTreeId");
    const nodeId = searchParams.get("nodeId");
    const nodeName = location.state?.nodeName || nodeId || "Selected Node";
    const skillTreeName = location.state?.skillTreeName || "Skill Tree";
    const hasNodeLinkedContext = Boolean(skillTreeId && nodeId);

    const [quiz, setQuiz] = useState(null);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [results, setResults] = useState({});
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [submissionMessage, setSubmissionMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validatingIndex, setValidatingIndex] = useState(null);
    const [isQuizMode, setIsQuizMode] = useState(hasNodeLinkedContext);

    const isMockMode = !hasNodeLinkedContext || Boolean(quiz?.isMock);
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
        setCurrentIdx(0);
        setSubmissionMessage("");
        setValidatingIndex(null);

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
    }, [hasNodeLinkedContext, skillTreeId, nodeId, nodeName, skillTreeName]);

    const handleMockGenerate = () => {
        // Restore the old static quiz flow for /dashboard/quizzes by loading
        // the sample questions.json data into a local mock quiz object.
        setQuiz({
            quiz_id: "mock-static-quiz",
            skill_tree_id: MOCK_SKILL_TREE_ID,
            node_id: "mock-static-node",
            title: "Computer Architecture Quiz",
            questions: STATIC_MOCK_QUESTIONS,
            isMock: true,
        });
        setCurrentIdx(0);
        setResults({});
        setAnswers({});
        setSubmissionMessage("");
        setError("");
        setIsQuizMode(true);
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
        setError("");

        try {
            if (quiz.isMock) {
                const correctAnswers = Object.values(results).filter((result) => result?.correct).length;
                setSubmissionMessage(`${correctAnswers} of ${quiz.questions.length} mock answers were correct.`);
                return;
            }

            const submission = await submitQuiz({
                quizId: quiz.quiz_id,
                nodeId: quiz.node_id,
                answers: preparedAnswers,
            });

            const message = `${submission.correct_answers} of ${submission.total_questions} validated answers were correct.`;
            setSubmissionMessage(message);
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
                                            setSubmissionMessage("");
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
                        <QuizEditor onGenerate={handleMockGenerate} />
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
                    ) : error && !quiz && hasNodeLinkedContext ? (
                        <div className={styles.placeholder}>
                            <h3 className={styles.placeholderTitle}>Quiz Error</h3>
                            <p className={styles.placeholderText}>{error}</p>
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
                                    isValidating={validatingIndex === currentIdx}
                                    isMockMode={isMockMode}
                                    isFirst={currentIdx === 0}
                                    isLast={currentIdx === total - 1}
                                    onValidate={handleValidateAnswer}
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
