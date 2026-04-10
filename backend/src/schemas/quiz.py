from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator


QuestionType = Literal["Single", "Multiple", "SelectAll", "Coding"]


class QuizChoice(BaseModel):
    id: str = Field(min_length=1, max_length=10)
    label: str = Field(min_length=1, max_length=300)
    isCorrect: bool
    reasoning: str = Field(min_length=1, max_length=300)


class QuizQuestion(BaseModel):
    type: QuestionType
    prompt: str = Field(min_length=1, max_length=600)
    isSkippable: bool = True
    choices: list[QuizChoice] = Field(default_factory=list)
    expectedStdout: Optional[str]= Field(default=None, max_length=2000)
    language: Optional[str] = Field(default=None, max_length=40)
    codeTemplate: Optional[str] = Field(default=None, max_length=8000)
    userGuidance: Optional[str] = Field(default=None, max_length=4000)


class QuizDefinition(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=1, max_length=20)


class ClientQuizChoice(BaseModel):
    id: str
    label: str


class ClientQuizQuestion(BaseModel):
    type: QuestionType
    prompt: str
    isSkippable: bool
    choices: list[ClientQuizChoice] = Field(default_factory=list)
    userGuidance: Optional[str]
    language: Optional[str]


class QuizResponse(BaseModel):
    quiz_id: str
    skill_tree_id: str
    node_id: str
    title: str
    questions: list[ClientQuizQuestion]


class QuizByNodeRequest(BaseModel):
    skill_tree_id: str = Field(min_length=1)
    node_id: str = Field(min_length=1)
    node_name: Optional[str] = Field(default=None, max_length=200)
    skill_tree_name: Optional[str] = Field(default=None, max_length=200)
    force_regenerate: bool = False

    @field_validator("skill_tree_id", "node_id")
    @classmethod
    def _strip_ids(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value

    @field_validator("node_name", "skill_tree_name")
    @classmethod
    def _strip_optional_names(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


class QuizAnswerRequest(BaseModel):
    quiz_id: str = Field(min_length=1)
    node_id: str = Field(min_length=1)
    question_index: int = Field(ge=0)
    answer: Union[str, list[str]]

    @field_validator("quiz_id", "node_id")
    @classmethod
    def _strip_identity_values(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value


class QuizAnswerResult(BaseModel):
    question_index: int
    correct: bool
    reasoning: Optional[str]
    error: Optional[str]


class QuizSubmissionRequest(BaseModel):
    quiz_id: str = Field(min_length=1)
    node_id: str = Field(min_length=1)
    answers: list[QuizAnswerRequest] = Field(min_length=1)

    @field_validator("quiz_id", "node_id")
    @classmethod
    def _strip_submission_ids(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank.")
        return value


class QuizSubmissionResult(BaseModel):
    quiz_id: str
    node_id: str
    total_questions: int
    answered_questions: int
    correct_answers: int
    results: list[QuizAnswerResult]
