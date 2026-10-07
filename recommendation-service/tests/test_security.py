import io
import urllib.error

import pytest
from fastapi import HTTPException

import security


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(security, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(security, "SUPABASE_ANON_KEY", "anon")
    monkeypatch.setattr(security, "ADMIN_API_KEY", "s3cret")


def http_error(code):
    return urllib.error.HTTPError("https://example.supabase.co/auth/v1/user", code, "x", {}, io.BytesIO(b""))


def fake_auth(monkeypatch, behaviour):
    def fetch(token):
        result = behaviour(token)
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(security, "_fetch_supabase_user", fetch)


def status_of(fn):
    with pytest.raises(HTTPException) as caught:
        fn()
    return caught.value.status_code


def test_valid_token_yields_the_tokens_user_id(monkeypatch):
    fake_auth(monkeypatch, lambda token: {"id": "user-123"} if token == "good" else http_error(401))
    assert security.require_user_id("Bearer good") == "user-123"
    assert security.require_user_id("bearer   good ") == "user-123"


@pytest.mark.parametrize("header", [None, "", "Basic good", "Bearer ", "good"])
def test_missing_or_malformed_header_is_401(monkeypatch, header):
    fake_auth(monkeypatch, lambda token: {"id": "user-123"})
    assert status_of(lambda: security.require_user_id(header)) == 401


@pytest.mark.parametrize("code", [400, 401, 403])
def test_rejected_token_is_401(monkeypatch, code):
    fake_auth(monkeypatch, lambda token: http_error(code))
    assert status_of(lambda: security.require_user_id("Bearer bad")) == 401


def test_auth_server_failure_is_502_not_401(monkeypatch):
    fake_auth(monkeypatch, lambda token: http_error(500))
    assert status_of(lambda: security.require_user_id("Bearer good")) == 502

    fake_auth(monkeypatch, lambda token: urllib.error.URLError("dns"))
    assert status_of(lambda: security.require_user_id("Bearer good")) == 502


def test_user_payload_without_id_is_401(monkeypatch):
    fake_auth(monkeypatch, lambda token: {})
    assert status_of(lambda: security.require_user_id("Bearer good")) == 401


def test_fails_closed_when_supabase_is_not_configured(monkeypatch):
    monkeypatch.setattr(security, "SUPABASE_URL", "")
    assert status_of(lambda: security.require_user_id("Bearer good")) == 503


def test_admin_key():
    security.require_admin_key("s3cret")
    assert status_of(lambda: security.require_admin_key(None)) == 403
    assert status_of(lambda: security.require_admin_key("nope")) == 403


def test_admin_endpoint_disabled_without_key(monkeypatch):
    monkeypatch.setattr(security, "ADMIN_API_KEY", "")
    assert status_of(lambda: security.require_admin_key("anything")) == 503


# ─── database URL normalisation ─────────────────────────────────────────────

from database import normalize_database_url  # noqa: E402


@pytest.mark.parametrize("url", [
    "postgres://u:p@host:5432/db",
    "postgresql://u:p@host:5432/db",
    "postgresql+psycopg2://u:p@host:5432/db",
])
def test_database_url_always_names_psycopg2(url):
    # SQLAlchemy 2.1 maps a bare postgresql:// to psycopg v3, which isn't installed.
    assert normalize_database_url(url) == "postgresql+psycopg2://u:p@host:5432/db"


def test_empty_database_url_stays_empty():
    assert normalize_database_url("") == ""
