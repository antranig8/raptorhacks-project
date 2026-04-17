from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError

from ..schemas.learn import LEARN_LESSON_VERSION, LearnLesson
from .prompts import load_prompt


LEARN_LESSON_PROMPT = "learn_lesson_prompt.md"
LEARN_LESSON_MAX_TOKENS = 750


def load_learn_lesson_json(raw_text: str) -> dict[str, Any]:
    # Models occasionally wrap JSON in fences or reasoning text; recover only the object payload.
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
        raise ValueError("AI returned an empty Learn lesson.")

    try:
        return json.loads(cleaned_text)
    except json.JSONDecodeError:
        json_object_text = extract_first_json_object(cleaned_text)
        if json_object_text is None:
            raise ValueError("AI returned invalid JSON for Learn lesson generation.") from None

        try:
            return json.loads(json_object_text)
        except json.JSONDecodeError as exc:
            raise ValueError("AI returned invalid JSON for Learn lesson generation.") from exc


def extract_first_json_object(text: str) -> str | None:
    # Regex is brittle when code examples contain braces, so walk the text and
    # return the first balanced JSON object while respecting quoted strings.
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


def parse_learn_lesson_response(raw_text: str) -> LearnLesson:
    payload = load_learn_lesson_json(raw_text)
    payload = normalize_learn_lesson_payload(payload)
    payload["version"] = LEARN_LESSON_VERSION

    try:
        # Validate before saving to Supabase or returning the result to the frontend.
        return LearnLesson.model_validate(payload)
    except ValidationError as exc:
        raise ValueError("AI returned JSON that did not match the Learn lesson schema.") from exc


def normalize_learn_lesson_payload(payload: Any) -> dict[str, Any]:
    # Keep Learn generation resilient like quiz generation: accept common wrapper
    # shapes but return the exact schema the frontend expects.
    if not isinstance(payload, dict):
        return {}

    if isinstance(payload.get("lesson"), dict):
        payload = payload["lesson"]
    elif isinstance(payload.get("learn"), dict):
        payload = payload["learn"]

    example = payload.get("example") if isinstance(payload.get("example"), dict) else {}
    common_mistake = payload.get("commonMistake")
    if not isinstance(common_mistake, dict):
        common_mistake = payload.get("common_mistake") if isinstance(payload.get("common_mistake"), dict) else {}

    raw_takeaways = payload.get("keyTakeaways")
    if not isinstance(raw_takeaways, list):
        raw_takeaways = payload.get("key_takeaways") if isinstance(payload.get("key_takeaways"), list) else []

    takeaways = [
        str(takeaway).strip()
        for takeaway in raw_takeaways
        if str(takeaway or "").strip()
    ][:4]

    return {
        "title": str(payload.get("title") or payload.get("name") or "Learn Lesson").strip(),
        "meaning": str(payload.get("meaning") or payload.get("description") or "").strip(),
        "whyItMatters": str(
            payload.get("whyItMatters") or payload.get("why_it_matters") or payload.get("why") or ""
        ).strip(),
        "example": {
            "language": str(example.get("language") or example.get("subject") or "general").strip(),
            "code": str(example.get("code") or example.get("content") or example.get("example") or "").strip(),
            "explanation": str(example.get("explanation") or example.get("description") or "").strip(),
        },
        "keyTakeaways": takeaways,
        "commonMistake": {
            "mistake": str(common_mistake.get("mistake") or common_mistake.get("title") or "").strip(),
            "explanation": str(
                common_mistake.get("explanation") or common_mistake.get("description") or ""
            ).strip(),
        },
    }


def build_learn_lesson_messages(
    tree_title: str,
    node_title: str,
    difficulty: str,
) -> list[dict[str, str]]:
    system_prompt = load_prompt(LEARN_LESSON_PROMPT) or (
        "Return one valid JSON object for a short Learn lesson. No markdown."
    )
    user_prompt = (
        "Generate a Learn lesson as valid JSON only.\n"
        f"Skill tree: {tree_title.strip()}\n"
        f"Clicked node: {node_title.strip()}\n"
        f"Difficulty: {difficulty.strip()}\n"
        "Return exactly one JSON object matching the schema."
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def generate_learn_lesson(ai_platform: Any, tree_title: str, node_title: str, difficulty: str) -> LearnLesson:
    messages = build_learn_lesson_messages(tree_title, node_title, difficulty)
    response_text, _ = ai_platform.chat_messages(messages, temperature=0.2, max_tokens=LEARN_LESSON_MAX_TOKENS)
    return parse_learn_lesson_response(response_text)
