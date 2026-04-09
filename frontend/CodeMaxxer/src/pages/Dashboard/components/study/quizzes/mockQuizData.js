import questionData from "./questions.json";
import { MOCK_SKILL_TREE_ID } from "@d_general/skilltree/skillTreeData";

const BASE_QUESTIONS = questionData.questions;

function cloneQuestions() {
    return BASE_QUESTIONS.map((question) => ({
        ...question,
        choices: (question.choices || []).map((choice) => ({ ...choice })),
    }));
}

export function buildMockQuiz(nodeId, nodeName) {
    return {
        quiz_id: `mock-quiz-${nodeId}`,
        skill_tree_id: MOCK_SKILL_TREE_ID,
        node_id: nodeId,
        title: `${nodeName || "Mock"} Quiz`,
        questions: cloneQuestions(),
        isMock: true,
    };
}

export function evaluateMockAnswer(question, questionIndex, answer) {
    if (question.type === "Coding") {
        const normalizedAnswer = String(answer || "").trim().toLowerCase();
        const looksCorrect = normalizedAnswer.length > 0 && (
            normalizedAnswer.includes("reverse")
            || normalizedAnswer.includes("factorial")
            || normalizedAnswer.includes("reversed")
            || normalizedAnswer.includes("return")
        );

        return {
            question_index: questionIndex,
            correct: looksCorrect,
            reasoning: looksCorrect ? "Mock coding check passed." : "Mock coding check did not recognize that solution.",
            error: looksCorrect ? null : "Mock validation only does a lightweight keyword check.",
        };
    }

    const selectedAnswers = Array.isArray(answer) ? answer : [answer];
    const normalizedAnswers = new Set(selectedAnswers.filter(Boolean));
    const correctAnswers = new Set(
        (question.choices || [])
            .filter((choice) => choice.isCorrect)
            .map((choice) => choice.id),
    );

    const isCorrect = normalizedAnswers.size === correctAnswers.size
        && [...correctAnswers].every((value) => normalizedAnswers.has(value));

    const selectedChoice = (question.choices || []).find((choice) => normalizedAnswers.has(choice.id));
    return {
        question_index: questionIndex,
        correct: isCorrect,
        reasoning: selectedChoice?.reasoning || null,
        error: null,
    };
}
