from __future__ import annotations

import os
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..auth.db import get_user_by_username
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

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    user = get_user_by_username(form_data.username)
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        subject=str(user.uuid),
        expires_delta=_access_token_expires_delta(),
    )
    return Token(access_token=access_token, token_type="bearer")
