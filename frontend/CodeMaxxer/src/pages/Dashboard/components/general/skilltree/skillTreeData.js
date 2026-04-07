import supabase from "@/utils/supabase";

const API_BASE_URL = "http://localhost:8000/api/v1/private";
const COMPLETED_LEAF_XP = 100;

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
    const skillTrees = await requestSkillTrees("/skill-trees", { method: "GET" });
    const selectedTree = selectPrimarySkillTree(skillTrees);

    if (!selectedTree) {
        return mockData;
    }

    return transformSkillTreeRecord(selectedTree);
}

export async function createSkillTree(treeName, goal) {
    return requestSkillTrees("/skill-trees", {
        method: "POST",
        body: JSON.stringify({
            name: treeName,
            goal,
        }),
    });
}

export const mockData = {
    name: "No Skill Tree Yet",
    xp: 0,
    children: [],
};
