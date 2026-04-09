import supabase from "@/utils/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const COMPLETED_LEAF_XP = 100;
export const MOCK_SKILL_TREE_ID = "mock-skill-tree";

async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error("No authenticated session found.");
    }

    return session.access_token;
}

async function requestSkillTrees(path, options = {}) {
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
            skillTreeId: MOCK_SKILL_TREE_ID,
            treeName: "Mock Skill Tree",
            data: mockData,
        };
    }

    return {
        skillTreeId: selectedTree.id,
        treeName: selectedTree.name,
        data: transformSkillTreeRecord(selectedTree),
    };
}

export async function createSkillTree(treeName, userPrompt) {
    // Send the raw user request so the backend can normalize it into a canonical goal first.
    return requestSkillTrees("/skill-trees", {
        method: "POST",
        body: JSON.stringify({
            name: treeName,
            prompt: userPrompt,
        }),
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
