from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator
from postgrest import APIError as PostgrestAPIError

from ..auth.auth import get_current_user
from ..auth.supabase import client as supabase_client
from ..auth.user import User
from ..dependencies.ai import get_ai_platform
from ..schemas.ai import SkillTreeNode
from ..services.skill_tree import (
    build_skill_tree_user_prompt,
    canonicalize_skill_tree,
    generated_tree_to_node,
    load_skill_tree_system_prompt,
    parse_skill_tree_response,
    resolve_skill_tree_goal,
)


# Supabase table expected by these routes.
SKILL_TREES_TABLE = "skill_trees"

router = APIRouter()


class SkillTreeCreateRequest(BaseModel):
    # The frontend supplies a display name and either a normalized goal or a raw prompt.
    name: str = Field(
        min_length=1,
        max_length=120,
        validation_alias=AliasChoices("name", "title"),
    )
    goal: str | None = Field(default=None, min_length=3, max_length=300)
    prompt: str | None = Field(default=None, min_length=3, max_length=800)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value

    @field_validator("goal", "prompt")
    @classmethod
    def _strip_optional_text(cls, value: str | None) -> str | None:
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
    tree: Optional[SkillTreeNode]
    is_active: Optional[bool]

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
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
    created_at: Optional[str]
    updated_at: Optional[str]


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


# Generate a new skill tree from either a normalized goal or a free-form user prompt.
def _generate_skill_tree(goal: str | None, prompt: str | None) -> tuple[str, SkillTreeNode]:
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
    }

    try:
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

    return [_record_to_response(record) for record in response.data or []]

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
        updates["tree_json"] = request.tree.model_dump()
    if request.is_active is not None:
        # Let the UI mark one tree as the user's current active roadmap.
        updates["is_active"] = request.is_active

    if not updates:
        # Reject empty PATCH requests so the client knows nothing was actually changed.
        raise HTTPException(status_code=400, detail="No skill tree changes were provided.")

    try:
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
