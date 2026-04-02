from fastapi import APIRouter, Depends
from typing import Annotated
from ..auth.auth import get_current_user
from ..auth.user import User
from ..piston.piston import PistonWrapper, PistonOutput
from contextlib import asynccontextmanager

piston = PistonWrapper()

@asynccontextmanager
async def lifespan(route: APIRouter):
    await piston.initialize()
    yield
    await piston.cleanup()


router = APIRouter(lifespan=lifespan)

@router.get("/test/")
async def read_users(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

@router.get("/test_code/")
async def test_code(current_user: Annotated[User, Depends(get_current_user)], language: str, code: str) -> PistonOutput:
    output = await piston.test_code(language, code)
    return output