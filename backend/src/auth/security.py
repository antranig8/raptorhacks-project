from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import httpx
import certifi
from datetime import datetime, timedelta, timezone
from jwt.algorithms import RSAAlgorithm, ECAlgorithm
import time
import json
from typing import Any
from .supabase import SUPABASE_URL, client

import jwt

ALGORITHM = "HS256"
PASSWORD_HASH_ITERATIONS = 210_000
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
CACHE_TTL = 600

_cache = {"jwks": None, "fetched_at": 0.0}



async def get_jwks(force_refresh: bool = False) -> dict:
    now = time.monotonic()
    cache_expired = (now - _cache["fetched_at"]) > CACHE_TTL

    if force_refresh or cache_expired or _cache["jwks"] is None:
        async with httpx.AsyncClient(verify=certifi.where()) as client:
            response = await client.get(JWKS_URL, timeout=5.0)
            response.raise_for_status()
            _cache["jwks"] = response.json()
            _cache["fetched_at"] = now

    return _cache["jwks"]


def _get_public_key(kid: str, jwks: dict):
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            alg = key_data.get("alg", "RS256")
            if alg.startswith("RS"):
                return RSAAlgorithm.from_jwk(json.dumps(key_data))
            elif alg.startswith("ES"):
                return ECAlgorithm.from_jwk(json.dumps(key_data))
    return None


async def verify_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")

    jwks = await get_jwks()
    public_key = _get_public_key(kid, jwks)

    if public_key is None:
        jwks = await get_jwks(force_refresh=True)
        public_key = _get_public_key(kid, jwks)

    if public_key is None:
        raise ValueError(f"No matching key found for kid: {kid}")

    return jwt.decode(
        token,
        public_key,
        algorithms=["RS256", "ES256"],
        options={"verify_aud": False},
    )

def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def get_jwt_secret_key() -> str:
    client.auth._fetch_jwks
    secret_key = os.getenv("JWT_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("JWT_SECRET_KEY env var is required for JWT auth")
    return secret_key


def create_access_token(
    *,
    subject: str,
    expires_delta: timedelta,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {"sub": subject, "iat": now, "exp": now + expires_delta}
    if additional_claims:
        payload.update(additional_claims)
    return jwt.encode(payload, get_jwt_secret_key(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, get_jwt_secret_key(), algorithms=[ALGORITHM])


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS
    )
    return (
        f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}$"
        f"{_b64encode(salt)}${_b64encode(digest)}"
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, iterations_raw, salt_b64, digest_b64 = hashed_password.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = _b64decode(salt_b64)
        expected_digest = _b64decode(digest_b64)
    except (ValueError, TypeError):
        return False

    computed_digest = hashlib.pbkdf2_hmac(
        "sha256", plain_password.encode("utf-8"), salt, iterations
    )
    return hmac.compare_digest(computed_digest, expected_digest)
