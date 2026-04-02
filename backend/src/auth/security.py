from __future__ import annotations

import certifi
import httpx
import json
import time

from jwt.algorithms import ECAlgorithm, RSAAlgorithm

from .supabase import SUPABASE_URL

import jwt

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
