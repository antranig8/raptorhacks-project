from __future__ import annotations

import json

from pydantic import ValidationError

from ..schemas.ai import GeneratedSkillTree, SkillTreeNode
from .prompts import load_prompt


def load_skill_tree_system_prompt() -> str | None:
    return load_prompt("skill_tree_prompt.md")


def build_skill_tree_user_prompt(goal: str) -> str:
    return goal.strip()


def parse_skill_tree_response(raw_text: str) -> GeneratedSkillTree:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI returned invalid JSON for skill tree generation.") from exc

    try:
        return GeneratedSkillTree.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("AI returned JSON that did not match the skill tree schema.") from exc


def generated_tree_to_node(tree: GeneratedSkillTree) -> SkillTreeNode:
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
