import jwt
from uuid import UUID

from .db import get_user_by_uuid
from .security import decode_access_token
from .user import User
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/public/token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if not subject:
            raise credentials_exception
        user_uuid = UUID(str(subject))
    except (jwt.PyJWTError, ValueError, TypeError):
        raise credentials_exception
        
    user_in_db = get_user_by_uuid(user_uuid)
    if user_in_db is None:
        raise credentials_exception
        
    return User(uuid=user_in_db.uuid, username=user_in_db.username)
