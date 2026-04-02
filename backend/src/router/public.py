from __future__ import annotations

import os
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..auth.security import create_access_token, verify_password
from ..auth.user import Token

router = APIRouter()

def _access_token_expires_delta() -> timedelta:
    raw_minutes = os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    try:
        minutes = int(raw_minutes)
    except ValueError:
        minutes = 30
    return timedelta(minutes=max(1, minutes))
