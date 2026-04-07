from __future__ import annotations

import json
import re

from pydantic import ValidationError

from ..schemas.ai import GeneratedSkillTree, SkillTreeNode
from .prompts import load_prompt


# Load the system prompt template used for AI skill tree generation.
def load_skill_tree_system_prompt() -> str | None:
    return load_prompt("skill_tree_prompt.md")


# Turn the user's goal into the plain prompt sent to the model.
def build_skill_tree_user_prompt(goal: str) -> str:
    # Keep the user prompt simple; the system prompt carries most of the formatting rules.
    return goal.strip()


# Parse the AI response JSON and validate it against the generated tree schema.
def parse_skill_tree_response(raw_text: str) -> GeneratedSkillTree:
    try:
        # The AI is expected to return JSON, not free-form text.
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI returned invalid JSON for skill tree generation.") from exc

    try:
        # Validate the JSON shape before the API returns anything to the frontend.
        return GeneratedSkillTree.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("AI returned JSON that did not match the skill tree schema.") from exc


# Convert the generated schema into the recursive node shape used by the app.
def generated_tree_to_node(tree: GeneratedSkillTree) -> SkillTreeNode:
    # Convert the generated skill/subskill structure into the recursive node format used by the UI.
    return SkillTreeNode(
        name=tree.goal,
        children=[
            SkillTreeNode(
                name=skill.name,
                children=[
                    SkillTreeNode(name=subskill.name, difficulty=subskill.difficulty)
                    for subskill in skill.subskills
                ],
            )
            for skill in tree.skills
        ],
    )


# Build a stable slug fragment that can be used as a node id.
def slugify_tree_id(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "node"


# Walk the tree and assign unique, stable ids to every node.
def canonicalize_skill_tree(tree: SkillTreeNode) -> SkillTreeNode:
    used_ids: set[str] = set()

    def _canonicalize(node: SkillTreeNode, fallback_prefix: str, index: int) -> SkillTreeNode:
        base_id = slugify_tree_id(node.id or node.name or f"{fallback_prefix}-{index}")
        node_id = base_id
        suffix = 2
        while node_id in used_ids:
            node_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(node_id)

        children = [
            _canonicalize(child, f"{node_id}-child", child_index)
            for child_index, child in enumerate(node.children or [], start=1)
        ]

        return SkillTreeNode(
            id=node_id,
            name=node.name,
            difficulty=node.difficulty,
            children=children or None,
        )

    return _canonicalize(tree, "root", 1)
