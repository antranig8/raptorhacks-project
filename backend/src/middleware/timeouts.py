from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Any, TypeVar

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tunables — adjust these to match your observed p99 latencies.
# ---------------------------------------------------------------------------

# Hard ceiling on any single HTTP request through the app. Requests that
# exceed this are cancelled and the client receives a 504.
REQUEST_TIMEOUT_SECONDS: float = 60.0

# Ceiling specifically for AI provider calls (quiz generation, skill tree
# generation, advancement). Three retries × this value = max total AI time.
AI_CALL_TIMEOUT_SECONDS: float = 30.0

# Ceiling for individual Supabase operations. Most reads/writes finish in
# well under a second on a warm connection; 10 s is a generous upper bound.
SUPABASE_CALL_TIMEOUT_SECONDS: float = 10.0

# ---------------------------------------------------------------------------
# Request-level timeout middleware
# ---------------------------------------------------------------------------

class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    """Cancel any request that takes longer than REQUEST_TIMEOUT_SECONDS.

    FastAPI / Starlette do not enforce a request timeout by default. Without
    this middleware a slow or hung upstream (AI provider, Supabase) holds the
    worker indefinitely. The middleware wraps each ASGI call in
    asyncio.wait_for so the coroutine is cancelled and the client receives a
    proper 504 rather than a connection that never resolves.
    """

    def __init__(self, app: ASGIApp, timeout: float = REQUEST_TIMEOUT_SECONDS) -> None:
        super().__init__(app)
        self.timeout = timeout

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.monotonic()
        try:
            return await asyncio.wait_for(call_next(request), timeout=self.timeout)
        except asyncio.TimeoutError:
            elapsed = time.monotonic() - start
            logger.error(
                "Request timed out after %.1fs  method=%s path=%s",
                elapsed,
                request.method,
                request.url.path,
            )
            return Response(
                content='{"detail":"Request timed out. Please try again."}',
                status_code=504,
                media_type="application/json",
            )


# ---------------------------------------------------------------------------
# Async timeout helpers for AI and Supabase calls
# ---------------------------------------------------------------------------

T = TypeVar("T")


async def with_ai_timeout(coro: Any, label: str = "AI call") -> Any:
    """Wrap an AI provider coroutine with AI_CALL_TIMEOUT_SECONDS.

    Usage (inside an async function):
        response_text, usage = await with_ai_timeout(
            asyncio.to_thread(ai_platform.chat_messages, messages, temperature=0.2, max_tokens=3000),
            label="quiz generation",
        )

    Raises asyncio.TimeoutError on expiry, which the caller's retry loop
    should catch as a ValueError-equivalent and retry.
    """
    start = time.monotonic()
    try:
        result = await asyncio.wait_for(coro, timeout=AI_CALL_TIMEOUT_SECONDS)
        logger.debug("%s completed in %.2fs", label, time.monotonic() - start)
        return result
    except asyncio.TimeoutError:
        elapsed = time.monotonic() - start
        logger.warning("%s timed out after %.1fs", label, elapsed)
        raise ValueError(f"{label} timed out after {elapsed:.1f}s") from None


async def with_supabase_timeout(coro: Any, label: str = "Supabase call") -> Any:
    """Wrap a Supabase coroutine with SUPABASE_CALL_TIMEOUT_SECONDS.

    The postgrest-py client is synchronous, so callers must wrap it in
    asyncio.to_thread before passing it here:

        result = await with_supabase_timeout(
            asyncio.to_thread(
                lambda: supabase_client.table("quizzes").insert(payload).execute()
            ),
            label="quiz insert",
        )

    Raises HTTPException 504 on expiry.
    """
    from fastapi import HTTPException, status  # local import to avoid circular

    start = time.monotonic()
    try:
        result = await asyncio.wait_for(coro, timeout=SUPABASE_CALL_TIMEOUT_SECONDS)
        logger.debug("%s completed in %.2fs", label, time.monotonic() - start)
        return result
    except asyncio.TimeoutError:
        elapsed = time.monotonic() - start
        logger.error("%s timed out after %.1fs", label, elapsed)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Database call timed out after {elapsed:.1f}s. Please try again.",
        ) from None


# ---------------------------------------------------------------------------
# Slow-call logger (non-cancelling) — useful during profiling
# ---------------------------------------------------------------------------

class SlowCallLogger:
    """Context manager that logs a warning if a block takes longer than threshold.

    Use this around synchronous blocking calls that you cannot yet make async,
    to surface hangs in logs without changing behaviour:

        with SlowCallLogger("supabase insert", threshold=2.0):
            response = supabase_client.table(...).insert(payload).execute()
    """

    def __init__(self, label: str, threshold: float = 2.0) -> None:
        self.label = label
        self.threshold = threshold
        self._start: float = 0.0

    def __enter__(self) -> "SlowCallLogger":
        self._start = time.monotonic()
        return self

    def __exit__(self, *_: Any) -> None:
        elapsed = time.monotonic() - self._start
        if elapsed >= self.threshold:
            logger.warning(
                "Slow call detected: %s took %.2fs (threshold %.1fs)",
                self.label,
                elapsed,
                self.threshold,
            )
        else:
            logger.debug("%s took %.2fs", self.label, elapsed)