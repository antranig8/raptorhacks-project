from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from postgrest import APIError as PostgrestAPIError

from ..middleware.timeouts import with_ai_timeout

from ..telemetry.telemetry import insert_exp_event, insert_quiz_complete_event
from ..auth.auth import get_current_user
from ..auth.supabase import client as supabase_client
from ..auth.user import User
from ..dependencies.ai import advancement_platform, quiz_platform
from ..piston.piston import piston
from ..schemas.ai import SkillTreeNode, SkillTreeNodeMetadata
from ..schemas.quiz import (
    ClientQuizChoice,
    ClientQuizQuestion,
    QuizAnswerRequest,
    QuizAnswerResult,
    QuizByNodeRequest,
    QuizDefinition,
    QuizGenerateRequest,
    QuizHintRequest,
    QuizHintResult,
    QuizQuestion,
    QuizResponse,
    QuizSubmissionRequest,
    QuizSubmissionResult,
)
from ..services.skill_tree import (
    build_default_node_metadata,
    build_skill_tree_advancement_user_prompt,
    canonicalize_skill_tree,
    parse_skill_tree_advancement_response,
)


logger = logging.getLogger(__name__)

router = APIRouter()

QUIZ_TABLE = "quizzes"
SKILL_TREES_TABLE = "skill_trees"
QUIZ_DONE_TABLE = "quiz_done"
MOCK_SKILL_TREE_ID = "mock-skill-tree"
XP_PER_CORRECT_ANSWER = 25

# Single source of truth for languages the execution backend supports.
# Keep in sync with the language reference .md file merged into the quiz
# system prompt — if a language is added or removed there, update this set too.
SUPPORTED_LANGUAGES: frozenset[str] = frozenset({
    "haskell", "sqlite3", "forth", "nasm64", "bash", "fsharp.net", "swift",
    "ponylang", "crystal", "elixir", "yeethon", "vlang", "c++", "nasm",
    "pascal", "raku", "japt", "powershell", "jelly", "vyxal", "llvm_ir",
    "iverilog", "emacs", "lolcode", "python", "fortran", "typescript",
    "rockstar", "befunge93", "csharp", "ruby", "php", "coffeescript", "d",
    "lisp", "groovy", "cow", "julia", "freebasic", "javascript", "racket",
    "dart", "nim", "samarium", "octave", "fsi", "lua", "basic", "retina",
    "perl", "golfscript", "csharp.net", "emojicode", "kotlin", "husk",
    "scala", "paradoc", "zig", "dash", "awk", "ocaml", "cjam", "java",
    "cobol", "prolog", "rscript", "file", "forte", "python2", "erlang",
    "basic.net", "pure", "clojure", "smalltalk", "go", "dragon",
    "brachylog", "osabie", "bqn", "rust", "matl", "pyth", "c", "brainfuck",
})


def _handle_supabase_error(exc: Exception) -> HTTPException:
    if isinstance(exc, PostgrestAPIError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc.message}",
        )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Quiz storage failed.",
    )


def _normalize_output(value: Optional[str]) -> str:
    # Normalize stdout before comparison so harmless formatting differences
    # do not fail otherwise-correct coding answers.
    if value is None:
        return ""
    return value.replace("\r\n", "\n").replace("\r", "\n").strip()


def _sanitize_raw_ai_response(raw_text: str) -> str:
    # Strip <think>...</think> blocks that reasoning models emit before the
    # JSON payload. Must run before any JSON extraction logic since think
    # blocks often contain braces that confuse find("{") / rfind("}").
    cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL | re.IGNORECASE).strip()

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL | re.IGNORECASE)
    if fence_match:
        return fence_match.group(1).strip()

    # If the model added prose before or after the JSON object, extract the
    # outermost { ... } block. Do this AFTER stripping think blocks so stray
    # braces inside the reasoning don't produce a false match.
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return cleaned[start:end + 1]

    return cleaned

def _parse_quiz_definition(raw_text: str) -> QuizDefinition:
    cleaned_text = _sanitize_raw_ai_response(raw_text.strip())

    print(cleaned_text)

    # Models sometimes wrap valid JSON in ```json fences. Strip those first
    # so quiz generation can still succeed without weakening schema checks.
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned_text, re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned_text = fence_match.group(1).strip()

    # If the model adds a short explanation before or after the payload, try
    # to recover the first top-level JSON object from the response.
    if not cleaned_text.startswith("{"):
        start = cleaned_text.find("{")
        end = cleaned_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned_text = cleaned_text[start:end + 1]

    try:
        payload = json.loads(cleaned_text)
    except json.JSONDecodeError as exc:
        raise ValueError("AI returned invalid JSON for quiz generation.") from exc

    payload = _normalize_quiz_payload(payload)

    try:
        return QuizDefinition.model_validate(payload)
    except ValidationError as exc:
        raise ValueError(f"AI returned JSON that did not match the quiz schema. {exc.errors()}") from exc


def _normalize_question_type(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    mapping = {
        "single": "Single",
        "multiple": "Multiple",
        "selectall": "SelectAll",
        "select_all": "SelectAll",
        "select-all": "SelectAll",
        "coding": "Coding",
        "code": "Coding",
    }
    return mapping.get(normalized, "Single")


def _normalize_choice_id(index: int, raw_id: Any) -> str:
    if isinstance(raw_id, str) and raw_id.strip():
        return raw_id.strip()[:10]
    return ["A", "B", "C", "D"][index] if index < 4 else f"Choice{index + 1}"


def _fallback_hint(question_type: str) -> str:
    if question_type == "Coding":
        return "Check the expected output and focus on the smallest code change that produces it."
    return "Review the rule behind the question and eliminate choices that do not match it."


def _hint_for_wrong_answer(question: QuizQuestion, allow_hints: bool) -> str | None:
    if not allow_hints:
        return None
    return question.hint or _fallback_hint(question.type)


def _normalize_quiz_payload(payload: Any) -> dict[str, Any]:
    # Coerce near-miss model output into the exact quiz schema the app expects.
    if isinstance(payload, dict) and isinstance(payload.get("questions"), list):
        questions = payload["questions"]
    elif isinstance(payload, dict) and isinstance(payload.get("quiz"), dict) and isinstance(payload["quiz"].get("questions"), list):
        questions = payload["quiz"]["questions"]
    else:
        questions = []

    normalized_questions: list[dict[str, Any]] = []
    for raw_question in questions[:4]:
        if not isinstance(raw_question, dict):
            continue

        question_type = _normalize_question_type(raw_question.get("type"))
        raw_choices = raw_question.get("choices")
        if not isinstance(raw_choices, list):
            raw_choices = []

        normalized_choices = []
        if question_type != "Coding":
            for index, raw_choice in enumerate(raw_choices[:4]):
                if not isinstance(raw_choice, dict):
                    continue
                normalized_choices.append(
                    {
                        "id": _normalize_choice_id(index, raw_choice.get("id")),
                        "label": str(raw_choice.get("label") or "").strip() or f"Choice {index + 1}",
                        "isCorrect": bool(raw_choice.get("isCorrect")),
                        "reasoning": str(raw_choice.get("reasoning") or "No reasoning provided.").strip()[:300],
                    }
                )

        normalized_question = {
            "type": question_type,
            "prompt": str(raw_question.get("prompt") or "").strip()[:600],
            "isSkippable": bool(raw_question.get("isSkippable", True)),
            "hint": str(raw_question.get("hint") or _fallback_hint(question_type)).strip()[:300],
            "choices": [] if question_type == "Coding" else normalized_choices,
            "expectedStdout": None,
            "language": None,
            "codeTemplate": None,
            "userGuidance": None,
        }

        if question_type == "Coding":
            normalized_question["expectedStdout"] = str(raw_question.get("expectedStdout") or "").strip()
            normalized_question["language"] = str(raw_question.get("language") or "python").strip()[:40]
            normalized_question["codeTemplate"] = str(raw_question.get("codeTemplate") or "%s").strip()[:8000]
            normalized_question["userGuidance"] = str(raw_question.get("userGuidance") or "# Write code here").strip()[:4000]
            if "%s" not in normalized_question["codeTemplate"]:
                normalized_question["codeTemplate"] = f'{normalized_question["codeTemplate"]}\n%s'

        normalized_questions.append(normalized_question)

    return {"questions": normalized_questions}


def _ensure_quiz_quality(definition: QuizDefinition) -> QuizDefinition:
    # Reject generations that only satisfy the schema via normalization but
    # still do not contain enough real content to render a usable quiz.
    if len(definition.questions) != 4:
        raise ValueError("AI returned a quiz with the wrong number of questions.")

    for index, question in enumerate(definition.questions, start=1):
        if not question.prompt.strip():
            raise ValueError(f"AI returned question {index} without a prompt.")

        if question.type == "Coding":
            if not question.expectedStdout or not question.codeTemplate or not question.userGuidance:
                raise ValueError(f"AI returned an incomplete coding question at position {index}.")

            # Reject coding questions that use a language the execution backend
            # does not support. This catches topics like git or shell commands
            # where the model picks a non-executable "language" identifier
            # rather than real source code.
            language = (question.language or "").strip().lower()
            if language not in SUPPORTED_LANGUAGES:
                raise ValueError(
                    f'Coding question {index} uses unsupported language "{language}". '
                    "Convert to a conceptual question or pick a supported language."
                )
            continue

        if len(question.choices) != 4:
            raise ValueError(f"AI returned question {index} without 4 choices.")

        labels = [choice.label.strip() for choice in question.choices]
        if any(not label for label in labels):
            raise ValueError(f"AI returned question {index} with an empty choice label.")

    return definition


def _ensure_requested_language(definition: QuizDefinition, requested_language: str) -> QuizDefinition:
    # Standalone quiz generation should respect the language chosen in the UI.
    # If the model returns a coding question in a different language, raise a
    # ValueError so the caller's retry loop can attempt generation again.
    normalized_requested_language = requested_language.strip().lower()

    for index, question in enumerate(definition.questions, start=1):
        if question.type != "Coding":
            continue

        actual_language = (question.language or "").strip().lower()
        if actual_language != normalized_requested_language:
            raise ValueError(
                f'AI returned coding question {index} in "{actual_language or "unknown"}" '
                f'instead of the requested language "{normalized_requested_language}".'
            )

    return definition


def _find_node_by_id(node: SkillTreeNode, node_id: str) -> SkillTreeNode | None:
    # Walk the saved skill tree recursively so quiz generation can target
    # the exact node the frontend clicked.
    if node.id == node_id:
        return node

    for child in node.children or []:
        match = _find_node_by_id(child, node_id)
        if match is not None:
            return match

    return None


def _calculate_submission_xp(correct_answers: int) -> int:
    # Keep XP math simple and transparent for the first progression version:
    # each correct answer is worth 25 XP, so a perfect 4-question quiz grants 100 XP.
    return max(0, correct_answers) * XP_PER_CORRECT_ANSWER


def _current_iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_unlock_target(metadata: SkillTreeNodeMetadata) -> int:
    return metadata.unlock_threshold_xp * (metadata.advancement_count + 1)


async def _build_advancement_children(skill_tree_goal: str, node: SkillTreeNode) -> list[SkillTreeNode]:
    prompt = build_skill_tree_advancement_user_prompt(skill_tree_goal, node)
    last_error: Exception | None = None

    # Keep one retry for malformed AI output, but avoid stretching latency
    # with a third full generation attempt on every bad response.
    for _attempt in range(1):
        try:
            response_text, _ = await with_ai_timeout(
                asyncio.to_thread(
                    advancement_platform.chat_messages,
                    [{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=3000,
                ),
                label="advancement children creation",
            )
            branch = parse_skill_tree_advancement_response(response_text)
            return [
                SkillTreeNode(
                    name=child.name,
                    difficulty=child.difficulty,
                    metadata=build_default_node_metadata(),
                )
                for child in branch.children
            ]
        except ValueError as exc:
            last_error = exc
            continue
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI provider request failed: {exc}",
            ) from exc

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(last_error or "AI skill-tree advancement failed."),
    )


def _dedupe_new_children(existing_children: list[SkillTreeNode], generated_children: list[SkillTreeNode]) -> list[SkillTreeNode]:
    existing_keys = {child.id or child.name.strip().lower() for child in existing_children}
    deduped_children: list[SkillTreeNode] = []

    for child in generated_children:
        child_key = child.id or child.name.strip().lower()
        if child_key in existing_keys:
            continue
        existing_keys.add(child_key)
        deduped_children.append(child)

    return deduped_children


async def _apply_node_progression(
    node: SkillTreeNode,
    exp_gained: int,
    skill_tree_goal: str,
) -> tuple[SkillTreeNode, list[SkillTreeNode]]:
    metadata = build_default_node_metadata(node.metadata)
    metadata.xp += exp_gained
    metadata.analytics["total_exp_earned"] = metadata.xp
    unlocked_children: list[SkillTreeNode] = []

    # Each node can expand only three times. The unlock target scales with the
    # advancement count so later branches require 200 XP, then 300 XP total.
    if metadata.advancement_count < metadata.max_advancements and metadata.xp >= _next_unlock_target(metadata):
        generated_children = await _build_advancement_children(
            skill_tree_goal,
            SkillTreeNode(
                id=node.id,
                name=node.name,
                difficulty=node.difficulty,
                children=node.children,
                metadata=metadata,
            ),
        )
        unlocked_children = _dedupe_new_children(node.children or [], generated_children)
        if unlocked_children:
            metadata.advancement_count += 1
            metadata.last_unlocked_at = _current_iso_timestamp()
            metadata.branch_history.append(f"advancement-{metadata.advancement_count}")

    updated_children = list(node.children or [])
    updated_children.extend(unlocked_children)

    return (
        SkillTreeNode(
            id=node.id,
            name=node.name,
            difficulty=node.difficulty,
            children=updated_children or None,
            metadata=metadata,
        ),
        unlocked_children,
    )


async def _update_tree_for_node_progress(
    tree: SkillTreeNode,
    node_id: str,
    exp_gained: int,
    skill_tree_goal: str,
) -> tuple[SkillTreeNode, int, list[SkillTreeNode]]:
    if tree.id == node_id:
        updated_node, unlocked_children = await _apply_node_progression(tree, exp_gained, skill_tree_goal)
        metadata = build_default_node_metadata(updated_node.metadata)
        return updated_node, metadata.xp, unlocked_children

    updated_children: list[SkillTreeNode] = []
    total_node_xp = 0
    unlocked_children: list[SkillTreeNode] = []

    for child in tree.children or []:
        updated_child, child_total_node_xp, child_unlocked_children = await _update_tree_for_node_progress(
            child,
            node_id,
            exp_gained,
            skill_tree_goal,
        )
        updated_children.append(updated_child)
        if child_total_node_xp:
            total_node_xp = child_total_node_xp
        if child_unlocked_children:
            unlocked_children = child_unlocked_children

    return (
        SkillTreeNode(
            id=tree.id,
            name=tree.name,
            difficulty=tree.difficulty,
            children=updated_children or None,
            metadata=build_default_node_metadata(tree.metadata),
        ),
        total_node_xp,
        unlocked_children,
    )


def _build_quiz_prompt(skill_tree_title: str, node: SkillTreeNode) -> str:
    # The model gets both the user-facing topic and the stable node id so the
    # generated quiz stays tightly scoped to a specific roadmap node.
    difficulty = node.difficulty or "unspecified"
    return (
        "Generate a focused programming quiz as valid JSON only.\n"
        f"Skill tree: {skill_tree_title}\n"
        f"Node id: {node.id}\n"
        f"Topic: {node.name}\n"
        f"Difficulty: {difficulty}\n"
        "Return 4 questions total.\n"
        "Include at least one coding question when the topic is concrete enough for runnable code.\n"
        "Keep the quiz tightly scoped to the topic."
    )


def _build_freeform_quiz_prompt(language: str, prompt: str) -> str:
    # This prompt powers the standalone quiz editor, where the user is not
    # coming from a saved skill-tree node and instead wants a direct quiz on
    # a typed language/topic combination.
    return (
        "Generate a focused programming quiz as valid JSON only.\n"
        f"Requested language: {language}\n"
        f"Requested topic: {prompt}\n"
        "Return 4 questions total.\n"
        "Keep the quiz tightly scoped to the requested language and topic.\n"
        "If you include a coding question, prefer the requested language.\n"
        "Make the conceptual questions about the same topic, not generic trivia."
    )


async def _generate_quiz_definition(
    prompt: str,
    requested_language: str | None = None,
) -> QuizDefinition:
    # _ensure_requested_language is intentionally called inside this retry
    # loop rather than after it. A language mismatch (e.g. the model picks
    # "bash" when "python" was requested, or generates a git-command coding
    # question for a non-shell topic) is a recoverable generation error, not
    # a hard failure — giving the model a second attempt is cheaper than
    # surfacing a 502 to the user on the first bad response.
    last_error: Exception | None = None

    for _attempt in range(1):
        try:
            response_text, _ = await with_ai_timeout(
                asyncio.to_thread(
                    quiz_platform.chat_messages,
                    [{"role": "user", "content": prompt}],
                    temperature=0.2,
                    max_tokens=3000,
                ),
                label="quiz generation",
            )

            definition = _parse_quiz_definition(response_text)
            definition = _ensure_quiz_quality(definition)
            if requested_language is not None:
                definition = _ensure_requested_language(definition, requested_language)
            return definition
        except ValueError as exc:
            last_error = exc
            continue
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}") from exc

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(last_error or "AI quiz generation failed."),
    )


def _sanitize_question(question: QuizQuestion) -> ClientQuizQuestion:
    # Strip answer keys and execution-only fields before returning quiz data
    # to the frontend. Grading always happens server-side against the saved quiz.
    return ClientQuizQuestion(
        type=question.type,
        prompt=question.prompt,
        isSkippable=question.isSkippable,
        choices=[ClientQuizChoice(id=choice.id, label=choice.label) for choice in question.choices],
        userGuidance=question.userGuidance,
        language=question.language,
    )


def _quiz_record_to_response(record: dict[str, Any]) -> QuizResponse:
    definition = QuizDefinition.model_validate(record["data"])
    return QuizResponse(
        quiz_id=str(record["id"]),
        skill_tree_id=str(record["skill_tree_id"]),
        node_id=record["node_id"],
        title=record.get("title") or f'{record["node_id"]} Quiz',
        allow_hints=definition.allowHints,
        questions=[_sanitize_question(question) for question in definition.questions],
    )


def _get_skill_tree_record(skill_tree_id: str, current_user: User) -> dict[str, Any]:
    # Every request re-loads the tree from storage instead of trusting any
    # in-memory state, which keeps the quiz flow stateless.
    try:
        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .select("id, goal, title, tree_json")
            .eq("id", skill_tree_id)
            .eq("user_id", str(current_user.uuid))
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill tree not found.")

    return response.data[0]


def _get_quiz_record(quiz_id: str, current_user: User) -> dict[str, Any]:
    # quiz_id is the stateless handle for a saved quiz. Each validation request
    # resolves the full grading context from the database using this id.
    try:
        response = (
            supabase_client.table(QUIZ_TABLE)
            .select("id, user_id, skill_tree_id, node_id, title, data")
            .eq("id", quiz_id)
            .eq("user_id", str(current_user.uuid))
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    return response.data[0]


def _record_quiz_completion(quiz_id: str, exp_gained: int, current_user: User) -> None:
    payload = {
        "user": str(current_user.uuid),
        "quiz_id": quiz_id,
        "exp_gained": exp_gained,
    }

    insert_exp_event(user_id=current_user.uuid, quiz_id=uuid.UUID(quiz_id), exp_gained=exp_gained)

    try:
        supabase_client.table(QUIZ_DONE_TABLE).insert(payload).execute()
    except Exception as exc:
        raise _handle_supabase_error(exc)


def _persist_skill_tree_progress(
    skill_tree_id: str,
    tree: SkillTreeNode,
    current_user: User,
) -> None:
    try:
        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .update({"tree_json": canonicalize_skill_tree(tree).model_dump()})
            .eq("id", skill_tree_id)
            .eq("user_id", str(current_user.uuid))
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill tree not found.")


def _get_answer_context(request: QuizAnswerRequest, current_user: User) -> tuple[QuizQuestion, bool, bool]:
    # Validate that the submitted node_id still matches the stored quiz before
    # we grade anything, so node-linked quizzes cannot be mixed up.
    record = _get_quiz_record(request.quiz_id, current_user)

    if record["node_id"] != request.node_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quiz does not match node_id.")

    definition = QuizDefinition.model_validate(record["data"])
    try:
        return definition.questions[request.question_index], definition.allowHints, definition.allowExplanations
    except IndexError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question index is out of range.") from exc


def _get_hint_context(request: QuizHintRequest, current_user: User) -> tuple[QuizQuestion, bool]:
    record = _get_quiz_record(request.quiz_id, current_user)

    if record["node_id"] != request.node_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quiz does not match node_id.")

    definition = QuizDefinition.model_validate(record["data"])
    try:
        return definition.questions[request.question_index], definition.allowHints
    except IndexError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question index is out of range.") from exc


async def _evaluate_answer(request: QuizAnswerRequest, current_user: User) -> QuizAnswerResult:
    # This is the single grading path for both per-question checks and final
    # submission. It keeps grading logic consistent across the API.
    question, _allow_hints, allow_explanations = _get_answer_context(request, current_user)

    if question.type == "Coding":
        # Coding questions are validated by executing the submitted code inside
        # the saved template, then comparing normalized stdout to expectedStdout.
        if not isinstance(request.answer, str):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coding answers must be strings.")
        if not question.language or not question.codeTemplate:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Coding question is missing execution metadata.")

        output = await piston.test_code(question.language, question.codeTemplate % request.answer)
        compile_error = output.compile_stage.output if output.compile_stage and output.compile_stage.code not in (None, 0) else None
        run_error = output.run_stage.output if output.run_stage and output.run_stage.code not in (None, 0) else None
        if output.error:
            return QuizAnswerResult(question_index=request.question_index, correct=False, error=str(output.error))
        if compile_error:
            return QuizAnswerResult(question_index=request.question_index, correct=False, error=compile_error)
        if run_error:
            return QuizAnswerResult(question_index=request.question_index, correct=False, error=run_error)

        actual_output = _normalize_output(output.run_stage.stdout if output.run_stage else None)
        expected_output = _normalize_output(question.expectedStdout)
        is_correct = actual_output == expected_output
        return QuizAnswerResult(
            question_index=request.question_index,
            correct=is_correct,
            reasoning="Output did not match the expected result." if allow_explanations and not is_correct else None,
            error=None if is_correct else f'Expected "{expected_output}" but got "{actual_output}".',
        )

    # Multiple-choice questions grade against the stored answer key from the
    # saved quiz definition, not against anything the frontend sends back.
    selected_answers = request.answer if isinstance(request.answer, list) else [request.answer]
    normalized_answers = {value.strip() for value in selected_answers if isinstance(value, str) and value.strip()}
    correct_answers = {choice.id for choice in question.choices if choice.isCorrect}

    is_correct = normalized_answers == correct_answers
    reasoning = None
    if allow_explanations and not is_correct:
        matched_choices = [choice.reasoning for choice in question.choices if choice.id in normalized_answers]
        reasoning = matched_choices[0] if matched_choices else "That answer does not match the saved quiz."

    return QuizAnswerResult(
        question_index=request.question_index,
        correct=is_correct,
        reasoning=reasoning,
    )


@router.post("/by-node", response_model=QuizResponse, status_code=status.HTTP_200_OK)
async def get_or_create_quiz_for_node(
    request: QuizByNodeRequest,
    current_user: User = Depends(get_current_user),
):
    # Node click entry point:
    # 1. load the user's saved skill tree
    # 2. locate the clicked node by stable node_id
    # 3. return the saved quiz for that node, or generate and persist one
    # Allow the mock frontend tree to exercise real quiz generation without
    # requiring a saved backend tree record.
    if request.skill_tree_id == MOCK_SKILL_TREE_ID:
        node = SkillTreeNode(
            id=request.node_id,
            name=request.node_name or request.node_id.replace("-", " ").title(),
            difficulty=None,
            children=None,
        )
        skill_tree_title = request.skill_tree_name or "Mock Skill Tree"
    else:
        skill_tree_record = _get_skill_tree_record(request.skill_tree_id, current_user)

        tree = canonicalize_skill_tree(SkillTreeNode.model_validate(skill_tree_record["tree_json"]))
        node = _find_node_by_id(tree, request.node_id)
        if node is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Node not found in skill tree.")
        skill_tree_title = skill_tree_record.get("title") or skill_tree_record.get("goal") or node.name

    try:
        existing_response = (
            supabase_client.table(QUIZ_TABLE)
            .select("id, skill_tree_id, node_id, title, data")
            .eq("user_id", str(current_user.uuid))
            .eq("skill_tree_id", request.skill_tree_id)
            .eq("node_id", request.node_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    existing_record = existing_response.data[0] if existing_response.data else None

    # Enforce the "one quiz per node" behavior by reusing the existing quiz
    # unless the frontend explicitly requests regeneration.
    if existing_record and not request.force_regenerate:
        return _quiz_record_to_response(existing_record)

    # No requested_language for node-linked quizzes — the model picks the
    # best language for the topic. Language validity is still checked inside
    # _generate_quiz_definition via _ensure_quiz_quality.
    definition = await _generate_quiz_definition(_build_quiz_prompt(skill_tree_title, node))
    payload = {
        "user_id": str(current_user.uuid),
        "skill_tree_id": request.skill_tree_id,
        "node_id": request.node_id,
        "title": f"{node.name} Quiz",
        "data": definition.model_dump(),
    }

    try:
        if existing_record:
            # Regeneration overwrites the saved quiz for this node instead of
            # creating duplicates, while keeping the flow stateless.
            response = (
                supabase_client.table(QUIZ_TABLE)
                .update(payload)
                .eq("id", existing_record["id"])
                .eq("user_id", str(current_user.uuid))
                .execute()
            )
        else:
            payload["id"] = str(uuid.uuid4())
            response = supabase_client.table(QUIZ_TABLE).insert(payload).execute()
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        logger.error(
            "Supabase returned empty response after quiz persist. "
            "quiz_id=%s skill_tree_id=%s node_id=%s",
            payload.get("id"),
            request.skill_tree_id,
            request.node_id,
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Quiz was not created.")

    return _quiz_record_to_response(response.data[0])


@router.post("/generate", response_model=QuizResponse, status_code=status.HTTP_200_OK)
async def generate_quiz(
    request: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    # This endpoint backs the standalone quizzes page.
    # Unlike the node-linked flow, it does not depend on an existing skill
    # tree record. The request itself is the full quiz-generation context.
    #
    # requested_language is passed into _generate_quiz_definition so that
    # _ensure_requested_language runs inside the retry loop. A language
    # mismatch on attempt 1 triggers a retry rather than an immediate 502.
    definition = await _generate_quiz_definition(
        _build_freeform_quiz_prompt(request.language, request.prompt),
        requested_language=request.language,
    )
    definition.allowHints = request.allow_hints and not request.hard_mode
    definition.allowExplanations = request.allow_explanations and not request.hard_mode

    # We still persist the generated quiz so the existing answer-validation
    # and submission endpoints can grade it using the same stateless contract
    # as node-linked quizzes.
    quiz_id = str(uuid.uuid4())
    payload = {
        "id": quiz_id,
        "user_id": str(current_user.uuid),
        "skill_tree_id": MOCK_SKILL_TREE_ID,
        "node_id": f"freeform-{uuid.uuid4()}",
        "title": f"{request.language} Quiz",
        "data": definition.model_dump(),
    }

    try:
        response = supabase_client.table(QUIZ_TABLE).insert(payload).execute()
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        logger.error(
            "Supabase returned empty response after freeform quiz persist. "
            "quiz_id=%s language=%s",
            quiz_id,
            request.language,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Quiz was not created.",
        )

    return _quiz_record_to_response(response.data[0])


@router.post("/submit-answer", response_model=QuizAnswerResult, status_code=status.HTTP_200_OK)
async def submit_quiz_answer(
    request: QuizAnswerRequest,
    current_user: User = Depends(get_current_user),
):
    # Lightweight endpoint for per-question validation so the frontend can
    # check answers as the user moves through the quiz.
    return await _evaluate_answer(request, current_user)


@router.post("/hint", response_model=QuizHintResult, status_code=status.HTTP_200_OK)
async def get_quiz_hint(
    request: QuizHintRequest,
    current_user: User = Depends(get_current_user),
):
    question, allow_hints = _get_hint_context(request, current_user)
    hint = _hint_for_wrong_answer(question, allow_hints)
    if hint is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hints are not enabled for this quiz.")

    return QuizHintResult(question_index=request.question_index, hint=hint)


@router.post("/submit", response_model=QuizSubmissionResult, status_code=status.HTTP_200_OK)
async def submit_quiz(
    request: QuizSubmissionRequest,
    current_user: User = Depends(get_current_user),
):
    # Final submission reuses the same grading path but evaluates the full
    # answer set and returns an aggregated summary for the UI.
    record = _get_quiz_record(request.quiz_id, current_user)
    if record["node_id"] != request.node_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quiz does not match node_id.")
    definition = QuizDefinition.model_validate(record["data"])

    results: list[QuizAnswerResult] = []
    for answer in request.answers:
        if answer.quiz_id != request.quiz_id or answer.node_id != request.node_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All answers must target the same quiz_id and node_id.")
        results.append(await _evaluate_answer(answer, current_user))

    correct_answers = sum(1 for result in results if result.correct)
    exp_gained = _calculate_submission_xp(correct_answers)
    _record_quiz_completion(request.quiz_id, exp_gained, current_user)
    insert_quiz_complete_event(user_id=current_user.uuid, quiz_id=uuid.UUID(request.quiz_id), right_questions=correct_answers, total_questions=len(results))

    total_node_xp = 0
    unlocked_children: list[SkillTreeNode] = []
    if record["skill_tree_id"] != MOCK_SKILL_TREE_ID:
        skill_tree_record = _get_skill_tree_record(str(record["skill_tree_id"]), current_user)
        skill_tree = canonicalize_skill_tree(SkillTreeNode.model_validate(skill_tree_record["tree_json"]))
        updated_tree, total_node_xp, unlocked_children = await _update_tree_for_node_progress(
            skill_tree,
            request.node_id,
            exp_gained,
            str(skill_tree_record.get("goal") or skill_tree_record.get("title") or request.node_id),
        )
        _persist_skill_tree_progress(str(record["skill_tree_id"]), updated_tree, current_user)

    return QuizSubmissionResult(
        quiz_id=request.quiz_id,
        node_id=request.node_id,
        total_questions=len(definition.questions),
        answered_questions=len(results),
        correct_answers=correct_answers,
        results=results,
        exp_gained=exp_gained,
        total_node_xp=total_node_xp,
        branch_unlocked=bool(unlocked_children),
        unlocked_children=canonicalize_skill_tree(
            SkillTreeNode(name="unlocked-children", children=unlocked_children)
        ).children or [],
    )
