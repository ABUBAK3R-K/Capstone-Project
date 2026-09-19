"""Signed-URL access to the private `business-verification` Storage bucket.

The bucket has no public read policy at all (supabase/migrations/008) — only
the owning business or an authority/admin can read it, enforced by RLS tied
to a real Supabase Auth JWT. This dashboard authenticates its *login check*
with the anon key (lib/auth.py) but does all data access through a raw
Postgres connection that bypasses RLS (lib/db.py), so there is no
JWT-bearing session available here to satisfy that storage policy.

Rather than restructure the login flow to keep a live Supabase session just
for this one screen, this uses a service-role key — confined to this
server-side dashboard process and never shipped to a client, the same
pattern supabase/seed/seed_places.py already uses for bulk writes.
"""

import os

import streamlit as st
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

BUCKET = "business-verification"


@st.cache_resource
def _service_client():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    from supabase import create_client

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def signed_document_url(path: str, expires_in: int = 3600) -> str | None:
    """A temporary, authenticated URL for one verification document, or None
    if SUPABASE_SERVICE_ROLE_KEY is not configured or the request fails."""
    client = _service_client()
    if client is None:
        return None
    try:
        result = client.storage.from_(BUCKET).create_signed_url(path, expires_in)
        return result.get("signedURL") or result.get("signedUrl")
    except Exception:
        return None
