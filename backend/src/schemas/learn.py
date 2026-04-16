from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


LEARN_LESSON_VERSION = 1


class LearnExample(BaseModel):
    language: str = Field(min_length=1, max_length=60)
    code: str = Field(min_length=1, max_length=3000)
    explanation: str = Field(min_length=1, max_length=1000)


class LearnCommonMistake(BaseModel):
    mistake: str = Field(min_length=1, max_length=500)
    explanation: str = Field(min_length=1, max_length=1000)


class LearnLesson(BaseModel):
    # Keep this versioned so cached lessons can be regenerated when the UI format changes.
    version: int = Field(default=LEARN_LESSON_VERSION)
    title: str = Field(min_length=1, max_length=160)
    meaning: str = Field(min_length=1, max_length=1200)
    whyItMatters: str = Field(min_length=1, max_length=800)
    example: LearnExample
    keyTakeaways: list[str] = Field(min_length=1, max_length=6)
    commonMistake: LearnCommonMistake


class LearnLessonRequest(BaseModel):
    # The clicked node identifies the cached lesson row and gives the AI enough context.
    node_id: str = Field(min_length=1, max_length=200)
    tree_title: Optional[str] = Field(default=None, max_length=160)
    node_title: str = Field(min_length=1, max_length=160)
    difficulty: str = Field(default="beginner", min_length=1, max_length=40)
    force_regenerate: bool = False

    @field_validator("node_id", "tree_title", "node_title", "difficulty")
    @classmethod
    def _strip_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value


class LearnLessonResponse(BaseModel):
    lesson: LearnLesson
    source: Literal["cache", "ai"]
