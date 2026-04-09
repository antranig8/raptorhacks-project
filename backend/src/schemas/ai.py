from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class UsageInfo(BaseModel):
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    total_tokens: Optional[int]


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=800, ge=1, le=4000)


class ChatResponse(BaseModel):
    message: ChatMessage
    usage: Optional[UsageInfo]


class SkillTreeGenerateRequest(BaseModel):
    # Accept either a normalized goal or the user's raw free-form prompt.
    goal: str | None = Field(default=None, min_length=3, max_length=300)
    prompt: str | None = Field(default=None, min_length=3, max_length=800)


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


class SkillTreeNode(BaseModel):
    id: Optional[str]
    name: str
    difficulty: Optional[str]
    children: Optional[list["SkillTreeNode"]]


SkillTreeNode.model_rebuild()


class SkillTreeResponse(BaseModel):
    tree: SkillTreeNode
