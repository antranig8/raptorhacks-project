from typing import Generic, Literal, Optional, TypeVar, Union

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, TypeAdapter
from supabase import PostgrestAPIError

from ..auth.supabase import client as supabase_client
from datetime import datetime, timedelta, timezone
from uuid import UUID
EVENT_TABLE = "events"



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

class Event(BaseModel):
    type: str
    timestamp: datetime = datetime.now(timezone.utc)

class ExpEvent(Event):
    type: Literal["exp"] = "exp"
    quiz_id: UUID
    exp_gained: int

class QuizCompleteEvent(Event):
    type: Literal["quiz_complete"] = "quiz_complete"
    right_questions: int
    total_questions: int
    quiz_id: UUID

EventUnion = Union[ExpEvent, QuizCompleteEvent]
event_adapter = TypeAdapter(list[EventUnion])
T = TypeVar("T", bound=Event)

class Events(BaseModel, Generic[T]):
    events: list[T] = Field(default_factory=list)


def _normalize_event(row: dict) -> dict:
    return {
        "type": row["scope"],
        "timestamp": row["created_at"],
        **row["data"],
    }

def _parse_events(rows: list[dict]) -> list[EventUnion]:
    normalized = [_normalize_event(r) for r in rows]
    return event_adapter.validate_python(normalized)

def get_quiz_complete_events(user_id: UUID, delta: timedelta) -> Events:
    now = datetime.now(timezone.utc)
    since = now - delta
    response = (
        supabase_client.table(EVENT_TABLE)
        .select("user_id, scope, data, created_at")
        .eq("user_id", str(user_id))
        .eq("scope", "quiz_complete")
        .gte("created_at", since.isoformat())
        .execute()
    )

    if not response.data:
        return Events(events=[])

    events = _parse_events(response.data)

    return Events(events=events)


def insert_exp_event(user_id: UUID, quiz_id: UUID, exp_gained: int):
    payload = {
        "user_id": str(user_id),
        "scope": "exp",
        "data": ExpEvent(quiz_id=quiz_id, exp_gained=exp_gained).model_dump(mode='json')
    }

    try:
        supabase_client.table(EVENT_TABLE).insert(payload).execute()
    except Exception as exc:
        raise _handle_supabase_error(exc)
    

def insert_quiz_complete_event(user_id: UUID, quiz_id: UUID, right_questions: int, total_questions: int):
    payload = {
        "user_id": str(user_id),
        "scope": "quiz_complete",
        "data": QuizCompleteEvent(quiz_id=quiz_id, right_questions=right_questions, total_questions=total_questions).model_dump(mode='json')
    }

    try:
        supabase_client.table(EVENT_TABLE).insert(payload).execute()
    except Exception as exc:
        raise _handle_supabase_error(exc)

def get_exp_events(user_id: UUID, delta: timedelta) -> Events:
    now = datetime.now(timezone.utc)
    since = now - delta
    response = (
        supabase_client.table(EVENT_TABLE)
        .select("user_id, scope, data, created_at")
        .eq("user_id", str(user_id))
        .eq("scope", "exp")
        .gte("created_at", since.isoformat())
        .execute()
    )

    if not response.data:
        return Events(events=[])

    events = _parse_events(response.data)

    return Events(events=events)