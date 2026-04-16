from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator
from postgrest import APIError as PostgrestAPIError

from ..auth.auth import get_current_user
from ..auth.supabase import client as supabase_client
from ..auth.user import User
from ..dependencies.ai import get_ai_platform
from ..schemas.ai import SkillTreeNode
from ..schemas.learn import LEARN_LESSON_VERSION, LearnLesson, LearnLessonRequest, LearnLessonResponse
from ..services.learn import generate_learn_lesson
from ..services.skill_tree import (
    build_skill_tree_user_prompt,
    canonicalize_skill_tree,
    generated_tree_to_node,
    load_skill_tree_system_prompt,
    parse_skill_tree_response,
    resolve_skill_tree_goal,
)
from ..services.prompts import load_prompt


# Supabase table expected by these routes.
SKILL_TREES_TABLE = "skill_trees"
LEARN_LESSONS_TABLE = "learn_lessons"

router = APIRouter()


class SkillTreeCreateRequest(BaseModel):
    # The frontend supplies a display name and either a normalized goal or a raw prompt.
    name: str = Field(
        min_length=1,
        max_length=120,
        validation_alias=AliasChoices("name", "title"),
    )
    goal: Optional[str] = Field(default=None, min_length=3, max_length=300)
    prompt: Optional[str]= Field(default=None, min_length=3, max_length=800)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value

    @field_validator("goal", "prompt")
    @classmethod
    def _strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value

    @model_validator(mode="after")
    def _require_goal_or_prompt(self) -> "SkillTreeCreateRequest":
        # Force callers to provide at least one input that can drive tree generation.
        if not self.goal and not self.prompt:
            raise ValueError("Either goal or prompt is required.")
        return self


class SkillTreeUpdateRequest(BaseModel):
    # All fields are optional here so PATCH can update only the changed pieces.
    name: Optional[str] = Field(
        default=None,
        max_length=120,
        validation_alias=AliasChoices("name", "title"),
    )
    tree: Optional[SkillTreeNode] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank.")
        return value


class SkillTreeRecord(BaseModel):
    # This is the API shape returned to the frontend.
    id: str
    name: str
    goal: str
    tree: SkillTreeNode
    completed_node_ids: list[str] = Field(default_factory=list)
    is_active: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# Validate the stored JSON payload and normalize it into the API node schema.
def _normalize_tree_payload(raw_tree: Any) -> SkillTreeNode:
    # Supabase JSON columns may come back as a dict already; validate it before returning it.
    try:
        return canonicalize_skill_tree(SkillTreeNode.model_validate(raw_tree))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Saved skill tree data is invalid.",
        ) from exc


# Convert a raw database record into the response shape expected by the frontend.
def _record_to_response(record: dict[str, Any]) -> SkillTreeRecord:
    completed_node_ids = record.get("completed_node_ids") or []
    if not isinstance(completed_node_ids, list):
        completed_node_ids = []

    return SkillTreeRecord(
        id=str(record["id"]),
        name=(record.get("title") or record.get("goal") or "").strip(),
        goal=record["goal"],
        tree=_normalize_tree_payload(record.get("tree_json")),
        completed_node_ids=[str(node_id) for node_id in completed_node_ids],
        is_active=bool(record.get("is_active", False)),
        created_at=record.get("created_at"),
        updated_at=record.get("updated_at"),
    )


def _lesson_record_to_response(record: dict[str, Any]) -> LearnLessonResponse:
    # Supabase stores the lesson as JSONB; validate it before trusting the cached payload.
    try:
        lesson = LearnLesson.model_validate(record.get("lesson"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cached learn lesson data is invalid.",
        ) from exc

    return LearnLessonResponse(lesson=lesson, source="cache")


# Map lower-level storage exceptions into stable HTTP responses.
def _handle_supabase_error(exc: Exception) -> HTTPException:
    # Convert lower-level storage errors into API-friendly HTTP errors.
    if isinstance(exc, PostgrestAPIError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase request failed: {exc.message}",
        )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Skill tree storage failed.",
    )


def _list_skill_tree_records_for_user(current_user: User) -> list[dict[str, Any]]:
    try:
        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .select("*")
            .eq("user_id", str(current_user.uuid))
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    return response.data or []


def _get_owned_skill_tree_record(skill_tree_id: str, current_user: User) -> dict[str, Any]:
    try:
        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .select("id,title,goal")
            .eq("id", skill_tree_id)
            .eq("user_id", str(current_user.uuid))
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=404, detail="Skill tree not found.")

    return response.data[0]


def _get_cached_learn_lesson(
    skill_tree_id: str,
    node_id: str,
    current_user: User,
    version: int = LEARN_LESSON_VERSION,
) -> dict[str, Any] | None:
    try:
        response = (
            supabase_client.table(LEARN_LESSONS_TABLE)
            .select("*")
            .eq("user_id", str(current_user.uuid))
            .eq("skill_tree_id", skill_tree_id)
            .eq("node_id", node_id)
            .eq("version", version)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        return None

    return response.data[0]


def _insert_learn_lesson(
    skill_tree_id: str,
    request: LearnLessonRequest,
    current_user: User,
    lesson: LearnLesson,
    tree_title: str,
) -> dict[str, Any]:
    payload = {
        "user_id": str(current_user.uuid),
        "skill_tree_id": skill_tree_id,
        "node_id": request.node_id,
        "tree_title": tree_title,
        "node_title": request.node_title,
        "difficulty": request.difficulty,
        "lesson": lesson.model_dump(),
        "version": LEARN_LESSON_VERSION,
    }

    try:
        response = (
            supabase_client.table(LEARN_LESSONS_TABLE)
            .insert(payload)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=500, detail="Learn lesson was not cached.")

    return response.data[0]


def _update_learn_lesson(
    cached_record: dict[str, Any],
    request: LearnLessonRequest,
    current_user: User,
    lesson: LearnLesson,
    tree_title: str,
) -> dict[str, Any]:
    payload = {
        "tree_title": tree_title,
        "node_title": request.node_title,
        "difficulty": request.difficulty,
        "lesson": lesson.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    try:
        response = (
            supabase_client.table(LEARN_LESSONS_TABLE)
            .update(payload)
            .eq("id", cached_record["id"])
            .eq("user_id", str(current_user.uuid))
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=500, detail="Learn lesson was not updated.")

    return response.data[0]


def _generate_learn_lesson(tree_title: str, node_title: str, difficulty: str) -> LearnLesson:
    ai_platform = get_ai_platform()

    try:
        return generate_learn_lesson(ai_platform, tree_title, node_title, difficulty)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider request failed.") from exc


# Generate a new skill tree from either a normalized goal or a free-form user prompt.
def _generate_skill_tree(goal: Optional[str], prompt: Optional[str]) -> tuple[str, SkillTreeNode]:
    ai_platform = get_ai_platform()
    resolved_goal = resolve_skill_tree_goal(ai_platform, goal, prompt)
    system_prompt = load_skill_tree_system_prompt()
    messages: list[dict[str, str]] = []

    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    messages.append({"role": "user", "content": build_skill_tree_user_prompt(resolved_goal)})

    try:
        response_text, _ = ai_platform.chat_messages(messages, temperature=0.2, max_tokens=1200)
        generated_tree = parse_skill_tree_response(response_text)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI provider request failed.") from exc

    return resolved_goal, canonicalize_skill_tree(generated_tree_to_node(generated_tree))

# Create and save a new generated skill tree for the current user.
@router.post("/skill-trees", response_model=SkillTreeRecord, status_code=status.HTTP_201_CREATED)
async def create_skill_tree(
    request: SkillTreeCreateRequest,
    current_user: User = Depends(get_current_user),
):
    # Generate and persist a new tree from either the explicit goal or the raw user prompt.
    resolved_goal, tree = _generate_skill_tree(request.goal, request.prompt)

    payload = {
        "user_id": str(current_user.uuid),
        "goal": resolved_goal,
        "title": request.name,
        "tree_json": tree.model_dump(),
        "is_active": True,
    }

    try:
        # A newly created tree becomes the user's current roadmap immediately.
        (
            supabase_client.table(SKILL_TREES_TABLE)
            .update({"is_active": False})
            .eq("user_id", str(current_user.uuid))
            .execute()
        )

        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .insert(payload)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=500, detail="Skill tree was not created.")

    return _record_to_response(response.data[0])

# List the current user's saved skill trees, newest first.
@router.get("/skill-trees", response_model=list[SkillTreeRecord])
async def list_skill_trees(current_user: User = Depends(get_current_user)):
    # Return all saved trees for the logged-in user, newest first.
    return [_record_to_response(record) for record in _list_skill_tree_records_for_user(current_user)]

# Fetch one saved skill tree if it belongs to the current user.
@router.get("/skill-trees/{skill_tree_id}", response_model=SkillTreeRecord)
async def get_skill_tree(skill_tree_id: str, current_user: User = Depends(get_current_user)):
    # Load one saved tree, but only if it belongs to the current user.
    try:
        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .select("*")
            .eq("id", skill_tree_id)
            .eq("user_id", str(current_user.uuid))
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=404, detail="Skill tree not found.")

    return _record_to_response(response.data[0])


@router.post("/skill-trees/{skill_tree_id}/learn", response_model=LearnLessonResponse)
async def get_learn_lesson(
    skill_tree_id: str,
    request: LearnLessonRequest,
    current_user: User = Depends(get_current_user),
):
    # Guard the cache lookup with tree ownership so users cannot probe another user's roadmap.
    tree_record = _get_owned_skill_tree_record(skill_tree_id, current_user)
    tree_title = request.tree_title or tree_record.get("title") or tree_record.get("goal") or "Skill tree"

    # Fast path: return the validated JSONB lesson unless the user explicitly asks for a new one.
    cached_lesson = _get_cached_learn_lesson(skill_tree_id, request.node_id, current_user)
    if cached_lesson is not None and not request.force_regenerate:
        return _lesson_record_to_response(cached_lesson)

    # Cache miss or regeneration: generate, validate, then insert or replace the cached payload.
    generated_lesson = _generate_learn_lesson(tree_title, request.node_title, request.difficulty)
    if cached_lesson is not None:
        _update_learn_lesson(cached_lesson, request, current_user, generated_lesson, tree_title)
    else:
        _insert_learn_lesson(skill_tree_id, request, current_user, generated_lesson, tree_title)
    return LearnLessonResponse(lesson=generated_lesson, source="ai")

# Update mutable fields on a saved skill tree owned by the current user.
@router.patch("/skill-trees/{skill_tree_id}", response_model=SkillTreeRecord)
async def update_skill_tree(
    skill_tree_id: str,
    request: SkillTreeUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    # Allow the app to rename a tree, mark it active, or save updated progress back into Supabase.
    # We build the update payload manually so missing PATCH fields do not overwrite stored data.
    updates: dict[str, Any] = {}

    if request.name is not None:
        # Rename the saved tree without touching the generated content.
        updates["title"] = request.name
    if request.tree is not None:
        # Replace the stored tree JSON when the frontend sends back progress or structure changes.
        updates["tree_json"] = canonicalize_skill_tree(request.tree).model_dump()
    if request.is_active is not None:
        # Let the UI mark one tree as the user's current active roadmap.
        updates["is_active"] = request.is_active

    if not updates:
        # Reject empty PATCH requests so the client knows nothing was actually changed.
        raise HTTPException(status_code=400, detail="No skill tree changes were provided.")

    try:
        if request.is_active is True:
            # Keep one active plan at a time by clearing the flag on the user's other saved trees.
            (
                supabase_client.table(SKILL_TREES_TABLE)
                .update({"is_active": False})
                .eq("user_id", str(current_user.uuid))
                .execute()
            )

        # Update only the matching row that belongs to the current authenticated user.
        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .update(updates)
            .eq("id", skill_tree_id)
            .eq("user_id", str(current_user.uuid))
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        # If Supabase returns no rows, either the id does not exist or it is not owned by this user.
        raise HTTPException(status_code=404, detail="Skill tree not found.")

    # Return the updated record in the same API shape used by create/list/get.
    return _record_to_response(response.data[0])


@router.delete("/skill-trees/{skill_tree_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill_tree(skill_tree_id: str, current_user: User = Depends(get_current_user)):
    try:
        response = (
            supabase_client.table(SKILL_TREES_TABLE)
            .delete()
            .eq("id", skill_tree_id)
            .eq("user_id", str(current_user.uuid))
            .execute()
        )
    except Exception as exc:
        raise _handle_supabase_error(exc)

    if not response.data:
        raise HTTPException(status_code=404, detail="Skill tree not found.")
