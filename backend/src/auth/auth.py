import jwt
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .security import verify_token
from .user import User

bearer = HTTPBearer()
optional_bearer = HTTPBearer(auto_error=False)


def _user_from_supabase_claims(claims: dict) -> User:
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    email = claims.get("email")
    user_metadata = claims.get("user_metadata") or {}
    app_metadata = claims.get("app_metadata") or {}

    username = (
        user_metadata.get("username")
        or user_metadata.get("user_name")
        or user_metadata.get("full_name")
        or app_metadata.get("provider")
        or email
        or str(user_id)
    )

    try:
        return User(uuid=UUID(str(user_id)), username=username, email=email)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid user id in token: {exc}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    try:
        claims = await verify_token(credentials.credentials)
        return _user_from_supabase_claims(claims)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
):
    if credentials is None:
        return None

    return await get_current_user(credentials)
