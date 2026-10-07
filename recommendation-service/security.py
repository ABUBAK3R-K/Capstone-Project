"""
Request authentication for the write endpoints.

This service connects over DATABASE_URL as the postgres role, which bypasses
RLS entirely. So unlike the mobile app's direct Supabase calls, nothing in the
database stops a forged write here — these dependencies are the only boundary.

- POST /interactions: the caller's Supabase access token is verified against
  Supabase Auth and the user id comes from the token, never the request body.
  Asking Auth (`GET /auth/v1/user`) rather than checking the JWT locally works
  for both legacy HS256 and newer asymmetric signing keys, and needs no JWT
  secret in this service's .env.
- POST /recommendations/refresh: a shared admin key, since it's an operator
  action (an O(N^2) rebuild), not something any app user should trigger.
"""

import json
import logging
import os
import secrets
import urllib.error
import urllib.request
from typing import Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()

logger = logging.getLogger("recommendation-service")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")

AUTH_TIMEOUT_SECONDS = 5
# Supabase Auth answers a bad/expired token with 401 or 403 (and 400 for a
# malformed one) — all mean "not a valid session", not "Auth is down".
REJECTED_TOKEN_STATUSES = {400, 401, 403}


def _fetch_supabase_user(token: str) -> dict:
    request = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
    )
    with urllib.request.urlopen(request, timeout=AUTH_TIMEOUT_SECONDS) as response:
        return json.load(response)


def require_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """FastAPI dependency: the verified Supabase user id of the caller."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        # Fail closed: without these the token can't be checked, and accepting
        # unverified writes is exactly the hole this module exists to close.
        raise HTTPException(
            status_code=503,
            detail="Interaction logging is disabled: SUPABASE_URL / SUPABASE_ANON_KEY are not configured.",
        )

    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Missing bearer token.")

    try:
        user = _fetch_supabase_user(token.strip())
    except urllib.error.HTTPError as e:
        if e.code in REJECTED_TOKEN_STATUSES:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        logger.error(f"Auth: Supabase Auth returned {e.code} while verifying a token")
        raise HTTPException(status_code=502, detail="Could not verify token with Supabase Auth.")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        logger.error(f"Auth: could not reach Supabase Auth - {e}")
        raise HTTPException(status_code=502, detail="Could not verify token with Supabase Auth.")

    user_id = user.get("id") if isinstance(user, dict) else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return user_id


def require_admin_key(x_admin_key: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency: the caller presented the configured X-Admin-Key."""
    if not ADMIN_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Cache refresh over HTTP is disabled: ADMIN_API_KEY is not configured.",
        )
    if not x_admin_key or not secrets.compare_digest(x_admin_key, ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Invalid admin key.")
