from typing import Annotated

from fastapi import APIRouter, Depends

from ..auth.auth import get_current_user
from ..auth.user import User
from . import ai

router = APIRouter()
router.include_router(ai.router, prefix="/ai", tags=["ai"])

@router.get("/test/")
async def read_users(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
