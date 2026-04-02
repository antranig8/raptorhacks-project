from pydantic import BaseModel
from uuid import UUID

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    uuid: UUID
    username: str

class UserInDB(User):
    hashed_password: str
