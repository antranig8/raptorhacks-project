from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str


class User(BaseModel):
    uuid: UUID
    username: str
    email: Optional[str] = None


class UserInDB(User):
    hashed_password: str
