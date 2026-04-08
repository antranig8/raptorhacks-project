import time
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status

from .auth import get_current_user, get_optional_current_user
from .user import User

AUTH_RATE_LIMIT = 120
AUTH_TIME_WINDOW_SECONDS = 60

GLOBAL_RATE_LIMIT = 3
GLOBAL_TIME_WINDOW_SECONDS = 60

user_requests: dict[str, list[float]] = defaultdict(list)

# actual rate limiter
def apply_rate_limit(user_id: str) -> bool:
    current_time = time.time()

    if user_id == "global_unauthenticated_user" or user_id.startswith("public:"):
        rate_limit = GLOBAL_RATE_LIMIT
        time_window = GLOBAL_TIME_WINDOW_SECONDS
    else:
        rate_limit = AUTH_RATE_LIMIT
        time_window = AUTH_TIME_WINDOW_SECONDS

    user_requests[user_id] = [
        t for t in user_requests[user_id] if t > current_time - time_window
    ]

    if len(user_requests[user_id]) >= rate_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )

    user_requests[user_id].append(current_time)
    return True

# client ip
def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client and request.client.host:
        return request.client.host

    return "unknown-client"

# for a public user
def rate_limit_public(request: Request) -> bool:
    client_ip = _client_ip(request)
    return apply_rate_limit(f"public:{client_ip}")

# once authenticated
def rate_limit_authenticated(
    current_user: User = Depends(get_current_user),
) -> bool:
    return apply_rate_limit(f"user:{current_user.uuid}")


def rate_limit_chat(
    request: Request,
    current_user: User | None = Depends(get_optional_current_user),
) -> bool:
    if current_user is not None:
        return apply_rate_limit(f"user:{current_user.uuid}")

    client_ip = _client_ip(request)
    return apply_rate_limit(f"public:{client_ip}")
