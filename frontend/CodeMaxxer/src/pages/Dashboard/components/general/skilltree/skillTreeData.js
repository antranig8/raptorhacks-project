import supabase from "@/utils/supabase";

export async function fetchDataForUser(){
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch("http://localhost:8000/api/v1/private/skill-trees", {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
        },
    })
    const data = await res.json()
    return data
}

export async function createSkillTree(treeName, goal){
    const { data: { session } } = await supabase.auth.getSession()

    const skillTreeCreateSchema = {
            "goal": goal,
            "title": treeName,
            "tree": {
                "name": treeName,
                "difficulty": "string",
                "children": [
                "string"
                ]
            },
            "is_active": false
    }

    const res = await fetch("http://localhost:8000/api/v1/private/skill-trees", {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
        },
    })
    const data = await res.json()
    return data
}

export const mockData = {
    "name": "User",
    "xp": 12500,
    "children": [
        {
            "name": "Programming Concepts",
            "xp": 4500,
            "children": [
                {
                    "name": "Algorithms",
                    "xp": 2500,
                    "children": [
                        { "name": "Sorting", "xp": 1000 },
                        { "name": "Graph Theory", "xp": 800 },
                        { "name": "Dynamic Programming", "xp": 700 }
                    ]
                },
                {
                    "name": "Data Structures",
                    "xp": 2000,
                    "children": [
                        { "name": "Trees", "xp": 900 },
                        { "name": "Hash Tables", "xp": 600 },
                        { "name": "Linked Lists", "xp": 500 }
                    ]
                }
            ]
        },
        {
            "name": "Languages",
            "xp": 5000,
            "children": [
                {
                    "name": "C",
                    "xp": 1500,
                    "children": [
                        { "name": "Pointers", "xp": 800 },
                        { "name": "Memory Management", "xp": 700 }
                    ]
                },
                {
                    "name": "JavaScript",
                    "xp": 2000,
                    "children": [
                        { "name": "Closures", "xp": 600 },
                        { "name": "Asynchronous JS", "xp": 800 },
                        { "name": "DOM Manipulation", "xp": 600 }
                    ]
                },
                {
                    "name": "Python",
                    "xp": 1500,
                    "children": [
                        { "name": "List Comprehensions", "xp": 500 },
                        { "name": "Decorators", "xp": 600 },
                        { "name": "Generators", "xp": 400 }
                    ]
                }
            ]
        },
        {
            "name": "Tools & Frameworks",
            "xp": 3000,
            "children": [
                {
                    "name": "React",
                    "xp": 1800,
                    "children": [
                        { "name": "Hooks", "xp": 800 },
                        { "name": "Context API", "xp": 500 },
                        { "name": "Component Lifecycle", "xp": 500 }
                    ]
                },
                {
                    "name": "Git",
                    "xp": 1200,
                    "children": [
                        { "name": "Branching", "xp": 500 },
                        { "name": "Merging & Rebasing", "xp": 700 }
                    ]
                }
            ]
        }
    ]
};
