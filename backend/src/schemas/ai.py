from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class UsageInfo(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=800, ge=1, le=4000)


class ChatResponse(BaseModel):
    message: ChatMessage
    usage: Optional[UsageInfo] = None


class SkillTreeGenerateRequest(BaseModel):
    # Accept either a normalized goal or the user's raw free-form prompt.
    goal: Optional[str] = Field(default=None, min_length=3, max_length=300)
    prompt: Optional[str] = Field(default=None, min_length=3, max_length=800)


class ExtractedGoal(BaseModel):
    # Keep the normalization payload minimal so the parser remains robust.
    goal: str = Field(min_length=3, max_length=300)


class GeneratedSubskill(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    difficulty: Literal["beginner", "intermediate", "advanced"]


class GeneratedSkill(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    subskills: list[GeneratedSubskill] = Field(min_length=2, max_length=5)


class GeneratedSkillTree(BaseModel):
    goal: str
    skills: list[GeneratedSkill] = Field(min_length=3, max_length=6)


class GeneratedAdvancementNode(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    difficulty: Literal["beginner", "intermediate", "advanced"]


class GeneratedAdvancementBranch(BaseModel):
    children: list[GeneratedAdvancementNode] = Field(min_length=2, max_length=3)


class SkillTreeNodeMetadata(BaseModel):
    # Store per-node progression directly on the tree so the frontend can
    # render unlock state without separately hydrating node progress.
    xp: int = Field(default=0, ge=0)
    unlock_threshold_xp: int = Field(default=100, ge=1)
    advancement_count: int = Field(default=0, ge=0, le=3)
    max_advancements: int = Field(default=3, ge=0, le=3)
    last_unlocked_at: Optional[str] = None
    branch_history: list[str] = Field(default_factory=list)
    analytics: dict[str, Any] = Field(default_factory=dict)


class SkillTreeNode(BaseModel):
    id: Optional[str] = None
    name: str
    difficulty: Optional[str] = None
    children: Optional[list["SkillTreeNode"]] = None
    metadata: Optional[SkillTreeNodeMetadata] = None


SkillTreeNode.model_rebuild()


class SkillTreeResponse(BaseModel):
    tree: SkillTreeNode
