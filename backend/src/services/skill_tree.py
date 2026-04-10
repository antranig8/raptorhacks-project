from __future__ import annotations

import json
import re
from typing import Optional

from pydantic import ValidationError

from ..ai.base import AIPlatform
from ..schemas.ai import ExtractedGoal, GeneratedSkillTree, SkillTreeNode
from .prompts import load_prompt


# Load the system prompt template used for AI skill tree generation.
def load_skill_tree_system_prompt() -> Optional[str]:
    return load_prompt("skill_tree_prompt.md")


# Load the system prompt that turns a messy user request into one canonical goal.
def load_goal_extraction_system_prompt() -> Optional[str]:
    return load_prompt("goal_extraction_prompt.md")


# Turn the user's goal into the plain prompt sent to the model.
def build_skill_tree_user_prompt(goal: str) -> str:
    # Keep the user prompt simple; the system prompt carries most of the formatting rules.
    return goal.strip()


# Turn the user's raw request into the plain prompt used by the goal extraction step.
def build_goal_extraction_user_prompt(prompt: str) -> str:
    # The extractor should see the original wording so it can infer the user's real intent.
    return prompt.strip()


# Structured AI routes often receive JSON wrapped in markdown fences or with a
# little surrounding text. Normalize that before strict schema validation.
def _load_json_payload(raw_text: str, error_message: str) -> dict:
    cleaned_text = (raw_text or "").strip()
    cleaned_text = re.sub(r"```json|```", "", cleaned_text, flags=re.IGNORECASE).strip()
    cleaned_text = re.sub(r"<think>.*?</think>", "", cleaned_text, flags=re.DOTALL).strip()

    if not cleaned_text:
        raise ValueError(error_message)

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned_text, flags=re.DOTALL)
        if not match:
            raise ValueError(error_message) from None

        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise ValueError(error_message) from exc


# Parse the goal extraction response JSON and validate that it contains a usable goal.
def parse_goal_extraction_response(raw_text: str) -> ExtractedGoal:
    try:
        # The extractor must answer with JSON only so the caller can chain it into tree generation.
        payload = _load_json_payload(raw_text, "AI returned invalid JSON for goal extraction.")
    except ValueError:
        raise

    try:
        # Validate the shape before any downstream route trusts the normalized goal.
        return ExtractedGoal.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("AI returned JSON that did not match the goal extraction schema.") from exc


# Resolve the final canonical goal from either an explicit goal or a raw free-form prompt.
def resolve_skill_tree_goal(ai_platform: AIPlatform, goal: Optional[str], prompt: Optional[str]) -> str:
    # Prefer a provided goal so callers can bypass normalization when they already have one.
    if goal is not None and goal.strip():
        return goal.strip()

    if prompt is None or not prompt.strip():
        raise ValueError("A goal or prompt is required to generate a skill tree.")

    system_prompt = load_goal_extraction_system_prompt()
    messages: list[dict[str, str]] = []

    if system_prompt:
        # Add explicit instructions so the model returns one clean goal instead of a whole tree.
        messages.append({"role": "system", "content": system_prompt})

    messages.append({"role": "user", "content": build_goal_extraction_user_prompt(prompt)})

    try:
        # Run the lightweight normalization pass before sending anything into the tree builder.
        response_text, _ = ai_platform.chat_messages(messages, temperature=0.1, max_tokens=200)
        extracted_goal = parse_goal_extraction_response(response_text)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("AI provider request failed during goal extraction.") from exc

    return extracted_goal.goal.strip()


# Parse the AI response JSON and validate it against the generated tree schema.
def parse_skill_tree_response(raw_text: str) -> GeneratedSkillTree:
    try:
        # The AI is expected to return JSON, not free-form text.
        payload = _load_json_payload(raw_text, "AI returned invalid JSON for skill tree generation.")
    except ValueError:
        raise

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
