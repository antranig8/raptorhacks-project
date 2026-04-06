from typing import Annotated

from fastapi import APIRouter, Depends
from ..piston.piston import PistonWrapper, PistonOutput
from contextlib import asynccontextmanager

from ..auth.auth import get_current_user
from ..auth.user import User
from . import ai
from . import skill_tree

piston = PistonWrapper()

@asynccontextmanager
async def lifespan(route: APIRouter):
    # Start and stop the shared Piston client with this router
    await piston.initialize()
    yield
    await piston.cleanup()


router = APIRouter(lifespan=lifespan)
# Attach the AI routes to the final router instance.
# If this happens before `router` is reassigned, those routes are lost.
router.include_router(ai.router, prefix="/ai", tags=["ai"])
router.include_router(skill_tree.router, tags=["skill-trees"])

@router.get("/test/")
async def read_users(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

@router.get("/test_code/")
async def test_code(current_user: Annotated[User, Depends(get_current_user)], language: str, code: str) -> PistonOutput:
    output = await piston.test_code(language, code)
    return output
