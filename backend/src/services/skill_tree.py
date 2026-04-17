from __future__ import annotations

import json
import re
from typing import Optional

from pydantic import ValidationError

from ..ai.base import AIPlatform
from ..schemas.ai import (
    ExtractedGoal,
    GeneratedAdvancementBranch,
    GeneratedSkillTree,
    SkillTreeNode,
    SkillTreeNodeMetadata,
)
from .prompts import load_prompt

GOAL_EXTRACTION_MAX_TOKENS = 150


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
    cleaned_text = re.sub(
        r"<think>.*?(?:\n\s*\n|$)",
        "",
        cleaned_text,
        flags=re.DOTALL | re.IGNORECASE,
    ).strip()

    if not cleaned_text:
        raise ValueError(error_message)

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        json_object_text = _extract_first_json_object(cleaned_text)
        if json_object_text is None:
            raise ValueError(error_message) from None

        try:
            return json.loads(json_object_text)
        except json.JSONDecodeError as exc:
            raise ValueError(error_message) from exc


def _extract_first_json_object(text: str) -> str | None:
    # Code examples and model preambles can include braces, so recover the first
    # balanced object while respecting strings instead of using a greedy regex.
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape_next = False

    for index, char in enumerate(text[start:], start=start):
        if escape_next:
            escape_next = False
            continue

        if char == "\\" and in_string:
            escape_next = True
            continue

        if char == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start:index + 1]

    return None


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
        response_text, _ = ai_platform.chat_messages(
            messages,
            temperature=0.1,
            max_tokens=GOAL_EXTRACTION_MAX_TOKENS,
        )
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


def parse_skill_tree_advancement_response(raw_text: str) -> GeneratedAdvancementBranch:
    try:
        payload = _load_json_payload(raw_text, "AI returned invalid JSON for skill tree advancement.")
    except ValueError:
        raise

    try:
        return GeneratedAdvancementBranch.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("AI returned JSON that did not match the skill tree advancement schema.") from exc


def build_skill_tree_advancement_user_prompt(goal: str, node: SkillTreeNode) -> str:
    existing_children = ", ".join(child.name for child in (node.children or [])) or "None"
    advancement_count = node.metadata.advancement_count if node.metadata else 0
    next_stage = advancement_count + 1
    difficulty = node.difficulty or "advanced"
    return (
        f"Goal: {goal.strip()}\n"
        f"Current topic: {node.name.strip()}\n"
        f"Current difficulty: {difficulty}\n"
        f"Existing child topics: {existing_children}\n"
        f"Advancement stage: {next_stage} of 3\n"
        "Generate the next advanced child topics for this node."
    )


def build_default_node_metadata(existing: SkillTreeNodeMetadata | None = None) -> SkillTreeNodeMetadata:
    if existing is None:
        return SkillTreeNodeMetadata()

    return SkillTreeNodeMetadata(
        xp=max(0, existing.xp),
        unlock_threshold_xp=max(1, existing.unlock_threshold_xp),
        advancement_count=min(max(0, existing.advancement_count), 3),
        max_advancements=min(max(0, existing.max_advancements), 3),
        last_unlocked_at=existing.last_unlocked_at,
        branch_history=list(existing.branch_history or []),
        analytics=dict(existing.analytics or {}),
    )


# Convert the generated schema into the recursive node shape used by the app.
def generated_tree_to_node(tree: GeneratedSkillTree) -> SkillTreeNode:
    # Convert the generated skill/subskill structure into the recursive node format used by the UI.
    return SkillTreeNode(
        name=tree.goal,
        metadata=build_default_node_metadata(),
        children=[
            SkillTreeNode(
                name=skill.name,
                metadata=build_default_node_metadata(),
                children=[
                    SkillTreeNode(
                        name=subskill.name,
                        difficulty=subskill.difficulty,
                        metadata=build_default_node_metadata(),
                    )
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
            metadata=build_default_node_metadata(node.metadata),
        )

    return _canonicalize(tree, "root", 1)
