from __future__ import annotations

import os
from uuid import UUID, uuid4

from .security import hash_password
from .user import UserInDB

_users_by_username: dict[str, UserInDB] = {}
_users_by_uuid: dict[UUID, UserInDB] = {}
_initialized = False


def init_mock_db() -> None:
    global _initialized
    if _initialized:
        return
    _initialized = True

    username = os.getenv("DEV_AUTH_USERNAME", "test")
    password = os.getenv("DEV_AUTH_PASSWORD", "test")
    user_uuid_raw = os.getenv("DEV_AUTH_UUID")

    try:
        user_uuid = UUID(user_uuid_raw) if user_uuid_raw else uuid4()
    except (TypeError, ValueError):
        user_uuid = uuid4()

    user = UserInDB(uuid=user_uuid, username=username, hashed_password=hash_password(password))
    _users_by_username[username] = user
    _users_by_uuid[user.uuid] = user


def get_user_by_uuid(user_uuid: UUID) -> UserInDB | None:
    init_mock_db()
    return _users_by_uuid.get(user_uuid)


def get_user_by_username(username: str) -> UserInDB | None:
    init_mock_db()
    return _users_by_username.get(username)


def create_user(username: str, password: str) -> UserInDB:
    init_mock_db()
    if username in _users_by_username:
        raise ValueError("User already exists")
    user = UserInDB(uuid=uuid4(), username=username, hashed_password=hash_password(password))
    _users_by_username[username] = user
    _users_by_uuid[user.uuid] = user
    return user
