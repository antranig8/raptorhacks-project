import supabase from "@/utils/supabase";

const rawApiBaseUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const API_BASE_URL = rawApiBaseUrl.endsWith("/api/v1/private")
    ? rawApiBaseUrl
    : `${rawApiBaseUrl}/api/v1/private`;
const COMPLETED_LEAF_XP = 100;
export const MOCK_SKILL_TREE_ID = "mock-skill-tree";
export const EMPTY_PLAN_NODE_ID = "create-plan";

export const emptyPlanData = {
    id: EMPTY_PLAN_NODE_ID,
    name: "Create Plan",
    xp: 0,
    children: [],
};

async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error("No authenticated session found.");
    }

    return session.access_token;
}

async function requestSkillTrees(path, options = {}) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/api/v1/private${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || "Skill tree request failed.");
    }

    return response.json();
}

function selectPrimarySkillTree(skillTrees) {
    if (!Array.isArray(skillTrees) || skillTrees.length === 0) {
        return null;
    }

    return skillTrees.find((tree) => tree.is_active) || skillTrees[0];
}

function mapNodeToGraph(node, completedNodeIds) {
    const children = (node.children || []).map((child) => mapNodeToGraph(child, completedNodeIds));
    const isLeaf = children.length === 0;
    const isCompleted = completedNodeIds.has(node.id);
    const xp = isLeaf
        ? (isCompleted ? COMPLETED_LEAF_XP : 0)
        : children.reduce((totalXp, child) => totalXp + child.xp, 0);

    return {
        id: node.id,
        name: node.name,
        difficulty: node.difficulty ?? null,
        completed: isCompleted,
        xp,
        children,
    };
}

export function transformSkillTreeRecord(record) {
    const completedNodeIds = new Set(record?.completed_node_ids || []);
    return mapNodeToGraph(record.tree, completedNodeIds);
}

export async function fetchDataForUser() {
    // Return both the rendered graph data and the owning skill tree id so a
    // later node click can request the correct node-linked quiz from the API.
    const skillTrees = await requestSkillTrees("/skill-trees", { method: "GET" });
    const selectedTree = selectPrimarySkillTree(skillTrees);

    if (!selectedTree) {
        return {
            skillTreeId: null,
            treeName: "Create Plan",
            data: emptyPlanData,
            isPlaceholder: true,
        };
    }

    return {
        skillTreeId: selectedTree.id,
        treeName: selectedTree.name,
        data: transformSkillTreeRecord(selectedTree),
        isPlaceholder: false,
    };
}

export async function listSkillTrees() {
    return requestSkillTrees("/skill-trees", { method: "GET" });
}

export async function setActiveSkillTree(skillTreeId) {
    return requestSkillTrees(`/skill-trees/${encodeURIComponent(skillTreeId)}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
    });
}

export async function deleteSkillTree(skillTreeId) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/skill-trees/${encodeURIComponent(skillTreeId)}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || "Skill tree request failed.");
    }
}

export async function createSkillTree(input) {
    const payload = typeof input === 'object' && input !== null
        ? input
        : { name: arguments[0], prompt: arguments[1] }

    // Callers can either send a raw prompt for backend-side normalization or
    // a direct goal when the UI already collected enough structure up front.
    return requestSkillTrees("/skill-trees", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export const mockData = {
    id: "web-development",
    name: "Web Development",
    xp: 400,
    children: [
        {
            id: "frontend",
            name: "Frontend",
            difficulty: "beginner",
            xp: 200,
            children: [
                {
                    id: "html-basics",
                    name: "HTML Basics",
                    difficulty: "beginner",
                    completed: true,
                    xp: 100,
                    children: [],
                },
                {
                    id: "css-layout",
                    name: "CSS Layout",
                    difficulty: "beginner",
                    completed: false,
                    xp: 0,
                    children: [],
                },
                {
                    id: "react-components",
                    name: "React Components",
                    difficulty: "intermediate",
                    completed: false,
                    xp: 0,
                    children: [],
                },
            ],
        },
        {
            id: "backend",
            name: "Backend",
            difficulty: "beginner",
            xp: 100,
            children: [
                {
                    id: "apis",
                    name: "REST APIs",
                    difficulty: "beginner",
                    completed: true,
                    xp: 100,
                    children: [],
                },
                {
                    id: "authentication",
                    name: "Authentication",
                    difficulty: "intermediate",
                    completed: false,
                    xp: 0,
                    children: [],
                },
            ],
        },
        {
            id: "tooling",
            name: "Tooling",
            difficulty: "beginner",
            xp: 100,
            children: [
                {
                    id: "git-basics",
                    name: "Git Basics",
                    difficulty: "beginner",
                    completed: true,
                    xp: 100,
                    children: [],
                },
                {
                    id: "debugging",
                    name: "Debugging",
                    difficulty: "intermediate",
                    completed: false,
                    xp: 0,
                    children: [],
                },
            ],
        },
    ],
};
