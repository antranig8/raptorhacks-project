from fastapi import APIRouter, Depends
from typing import Annotated
from ..auth.auth import get_current_user
from ..auth.user import User

router = APIRouter()

@router.get("/test/")
async def read_users(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
