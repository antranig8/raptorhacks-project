from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from postgrest import APIError as PostgrestAPIError

from ..auth.auth import get_current_user
from ..auth.supabase import client as supabase_client
from ..auth.user import User
from ..schemas.ai import SkillTreeNode


# Supabase table expected by these routes.
SKILL_TREES_TABLE = "skill_trees"

router = APIRouter()


class SkillTreeCreateRequest(BaseModel):
    # "goal" is the original learning target the tree was generated from.
    goal: str = Field(min_length=3, max_length=300)
    # "title" lets the user rename the tree in the UI without changing the goal itself.
    title: str | None = Field(default=None, max_length=120)
    # "tree" is the nested node structure the frontend already knows how to render.
    tree: SkillTreeNode
    is_active: bool = False


class SkillTreeUpdateRequest(BaseModel):
    # All fields are optional here so PATCH can update only the changed pieces.
    title: str | None = Field(default=None, max_length=120)
    tree: SkillTreeNode | None = None
    is_active: bool | None = None


class SkillTreeRecord(BaseModel):
    # This is the shape returned to the frontend after reading from Supabase.
    id: str
    user_id: str
    goal: str
    title: str | None = None
    tree: SkillTreeNode
    is_active: bool = False
    created_at: str | None = None
    updated_at: str | None = None


def _normalize_tree_payload(raw_tree: Any) -> SkillTreeNode:
    # Supabase JSON columns may come back as a dict already; validate it before returning it.
    try:
        return SkillTreeNode.model_validate(raw_tree)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Saved skill tree data is invalid.",
        ) from exc


def _record_to_response(record: dict[str, Any]) -> SkillTreeRecord:
    # Supabase stores the tree in "tree_json", but the API returns it as "tree"
    # so the frontend works with a cleaner response shape.
    return SkillTreeRecord(
        id=str(record["id"]),
        user_id=str(record["user_id"]),
        goal=record["goal"],
        title=record.get("title"),
        tree=_normalize_tree_payload(record.get("tree_json")),
        is_active=bool(record.get("is_active", False)),
        created_at=record.get("created_at"),
        updated_at=record.get("updated_at"),
    )


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


@router.post("/skill-trees", response_model=SkillTreeRecord, status_code=status.HTTP_201_CREATED)
async def create_skill_tree(
    request: SkillTreeCreateRequest,
    current_user: User = Depends(get_current_user),
):
    # Save a generated tree so the user can come back to it later instead of losing it after one request.
    # "user_id"comes from the verified auth token, not from the client body.
    payload = {
        "user_id": str(current_user.uuid),
        "goal": request.goal,
        "title": request.title,
        "tree_json": request.tree.model_dump(),
        "is_active": request.is_active,
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


@router.patch("/skill-trees/{skill_tree_id}", response_model=SkillTreeRecord)
async def update_skill_tree(
    skill_tree_id: str,
    request: SkillTreeUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    # Allow the app to rename a tree, mark it active, or save updated progress back into Supabase.
    # We build the update payload manually so missing PATCH fields do not overwrite stored data.
    updates: dict[str, Any] = {}

    if request.title is not None:
        # Rename the saved tree without touching the generated content.
        updates["title"] = request.title
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
