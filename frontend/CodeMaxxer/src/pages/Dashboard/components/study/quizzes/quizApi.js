import supabase from "@utils/supabase";

const rawApiBaseUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const API_BASE_URL = rawApiBaseUrl.endsWith("/api/v1/private")
    ? rawApiBaseUrl
    : `${rawApiBaseUrl}/api/v1/private`;

async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error("No authenticated session found.");
    }

    return session.access_token;
}

async function requestQuiz(path, options = {}) {
    // Centralize auth + error handling so every quiz request uses the same
    // stateless contract and failure behavior.
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || "Quiz request failed.");
    }

    return response.json();
}

export async function fetchQuizByNode({ skillTreeId, nodeId, nodeName = null, skillTreeName = null, forceRegenerate = false }) {
    // Fetch-or-create endpoint keyed by the clicked skill tree node.
    return requestQuiz("/quiz/by-node", {
        method: "POST",
        body: JSON.stringify({
            skill_tree_id: skillTreeId,
            node_id: nodeId,
            node_name: nodeName,
            skill_tree_name: skillTreeName,
            force_regenerate: forceRegenerate,
        }),
    });
}

export async function generateQuiz({ language, prompt }) {
    // Standalone quiz generation uses a direct language + topic request
    // instead of a saved skill-tree node.
    return requestQuiz("/quiz/generate", {
        method: "POST",
        body: JSON.stringify({
            language,
            prompt,
        }),
    });
}

export async function submitQuizAnswer({ quizId, nodeId, questionIndex, answer }) {
    // Per-question validation keeps the UI responsive without needing any
    // quiz session state on the backend.
    return requestQuiz("/quiz/submit-answer", {
        method: "POST",
        body: JSON.stringify({
            quiz_id: quizId,
            node_id: nodeId,
            question_index: questionIndex,
            answer,
        }),
    });
}

export async function submitQuiz({ quizId, nodeId, answers }) {
    // Final submission sends the locally-stored answers back in one payload.
    return requestQuiz("/quiz/submit", {
        method: "POST",
        body: JSON.stringify({
            quiz_id: quizId,
            node_id: nodeId,
            answers: answers.map((entry) => ({
                quiz_id: quizId,
                node_id: nodeId,
                question_index: entry.questionIndex,
                answer: entry.answer,
            })),
        }),
    });
}
