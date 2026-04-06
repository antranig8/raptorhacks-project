from __future__ import annotations

import json

from pydantic import ValidationError

from ..schemas.ai import GeneratedSkillTree, SkillTreeNode
from .prompts import load_prompt


def load_skill_tree_system_prompt() -> str | None:
    return load_prompt("skill_tree_prompt.md")


def build_skill_tree_user_prompt(goal: str) -> str:
    # Keep the user prompt simple; the system prompt carries most of the formatting rules.
    return goal.strip()


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
