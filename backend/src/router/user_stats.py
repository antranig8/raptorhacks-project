from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from ..auth.user import User
from ..auth.auth import get_current_user
from ..telemetry.telemetry import Events, get_exp_events, get_quiz_complete_events, ExpEvent, QuizCompleteEvent
import re
from datetime import timedelta

router = APIRouter()



DURATION_REGEX = re.compile(r"^(\d+)([smhdw])$")

UNIT_MAP = {
    "s": "seconds",
    "m": "minutes",
    "h": "hours",
    "d": "days",
    "w": "weeks",
}

def parse_range(range_str: str) -> timedelta:
    match = DURATION_REGEX.match(range_str)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid range format. Use formats like 30m, 24h, 7d, 1w",
        )

    value, unit = match.groups()
    value = int(value)

    return timedelta(**{UNIT_MAP[unit]: value})

class UserStats(BaseModel):
    exp: Events[ExpEvent]
    quiz_complete: Events[QuizCompleteEvent]

@router.get("/", response_model=UserStats)
async def get_user_stats(current_user: User = Depends(get_current_user),
                         range: str = Query("24h")):
    delta = parse_range(range)
    exp = get_exp_events(user_id=current_user.uuid, delta=delta)
    quiz_complete = get_quiz_complete_events(user_id=current_user.uuid, delta=delta)
    return UserStats(exp=exp, quiz_complete=quiz_complete)