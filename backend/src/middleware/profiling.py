from __future__ import annotations

import os
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.routing import Match
from starlette.types import ASGIApp

# ---------------------------------------------------------------------------
# Pyinstrument profiling middleware
#
# Enabled only when PROFILING_ENABLED=true in the environment.
# Never turn this on in production — it adds ~5–10 % overhead per request.
#
# Install:
#   pip install pyinstrument
#
# Usage:
#   PROFILING_ENABLED=true uvicorn app.main:app --reload
#
# Then hit any endpoint with ?profile=1 appended:
#   GET /quiz/generate?profile=1
#   POST /quiz/generate?profile=1   (query param works on POST too)
#
# The response body is replaced with an HTML flame graph you can open in
# the browser. All other requests are passed through untouched.
#
# To profile every request regardless of query param (useful for load tests),
# set PROFILING_ALL=true as well. The HTML is then written to
# /tmp/profile_<method>_<path>.html instead of returned in the response body,
# so it doesn't break JSON clients.
# ---------------------------------------------------------------------------

_ENABLED = os.getenv("PROFILING_ENABLED", "").lower() in ("1", "true", "yes")
_PROFILE_ALL = os.getenv("PROFILING_ALL", "").lower() in ("1", "true", "yes")


class PyinstrumentMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, interval: float = 0.001) -> None:
        super().__init__(app)
        self.interval = interval  # sampling interval in seconds; lower = more precise but more overhead

        if _ENABLED:
            try:
                import pyinstrument  # noqa: F401
            except ImportError as exc:
                raise RuntimeError(
                    "PROFILING_ENABLED is set but pyinstrument is not installed. "
                    "Run: pip install pyinstrument"
                ) from exc

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not _ENABLED:
            return await call_next(request)

        profile_this = _PROFILE_ALL or request.query_params.get("profile") == "1"
        if not profile_this:
            return await call_next(request)

        from pyinstrument import Profiler

        profiler = Profiler(interval=self.interval, async_mode="enabled")
        profiler.start()
        try:
            response = await call_next(request)
        finally:
            profiler.stop()

        if _PROFILE_ALL:
            # Write to disk so JSON clients are not broken.
            safe_path = request.url.path.strip("/").replace("/", "_") or "root"
            out_path = f"/tmp/profile_{request.method}_{safe_path}.html"
            profiler.write_html(out_path)
            # Still return the real response so automated tests pass.
            return response

        # ?profile=1 replaces the response with the flame graph HTML.
        html = profiler.output_html()
        return Response(content=html, media_type="text/html")