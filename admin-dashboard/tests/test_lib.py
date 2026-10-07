"""Unit tests for the dashboard's non-Streamlit logic.

    pip install pytest
    python -m pytest admin-dashboard/tests
"""

import sys
import urllib.error
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib import recommendations  # noqa: E402
from lib.html_safety import is_http_url, report_popup_html  # noqa: E402

# ─── html_safety ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("value, expected", [
    ("https://cdn.example/x.jpg", True),
    ("HTTP://cdn.example/x.jpg", True),
    ("  https://cdn.example/x.jpg", True),
    ("javascript:alert(1)", False),
    ("data:text/html,<script>alert(1)</script>", False),
    ("//evil.example/x.jpg", False),
    ("", False),
    (None, False),
    (float("nan"), False),  # what pandas hands over for a NULL photo_url
])
def test_is_http_url(value, expected):
    assert is_http_url(value) is expected


def test_popup_escapes_every_user_controlled_field():
    html = report_popup_html(
        category="<b>Pothole</b>",
        status="reported",
        description='<img src=x onerror="alert(1)">',
        photo_url="https://x/a.jpg\" onmouseover=\"alert(1)",
    )

    assert "<img" not in html
    assert "onerror=\"" not in html
    assert "&lt;b&gt;Pothole&lt;/b&gt;" in html
    # The URL can't break out of its attribute: its quotes are entity-encoded.
    assert 'href="https://x/a.jpg&quot; onmouseover=&quot;alert(1)"' in html
    assert 'rel="noopener noreferrer"' in html


def test_popup_drops_non_http_photo_links_and_empty_description():
    html = report_popup_html("Garbage", "fixed", description=None, photo_url="javascript:alert(1)")
    assert html == "<b>Garbage</b><br>Status: fixed"


# ─── recommendations.trigger_refresh ────────────────────────────────────────


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(recommendations, "RECOMMENDATIONS_URL", "https://recs.example")
    monkeypatch.setattr(recommendations, "ADMIN_API_KEY", "s3cret")


def test_trigger_is_a_noop_when_unconfigured(monkeypatch):
    monkeypatch.setattr(recommendations, "RECOMMENDATIONS_URL", "")
    started = []
    monkeypatch.setattr(recommendations.threading, "Thread", lambda **kw: started.append(kw))

    assert recommendations.trigger_refresh() is False
    assert started == []


def test_trigger_starts_a_background_refresh(configured, monkeypatch):
    started = []

    class FakeThread:
        def __init__(self, **kwargs):
            started.append(kwargs)

        def start(self):
            started[-1]["started"] = True

    monkeypatch.setattr(recommendations.threading, "Thread", FakeThread)

    assert recommendations.trigger_refresh() is True
    assert started[0]["daemon"] is True and started[0]["started"] is True


def test_refresh_request_carries_the_admin_key(configured, monkeypatch):
    sent = {}

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def fake_urlopen(request, timeout):
        sent.update(url=request.full_url, method=request.get_method(), key=request.get_header("X-admin-key"))
        return Response()

    monkeypatch.setattr(recommendations.urllib.request, "urlopen", fake_urlopen)
    recommendations._post_refresh()

    assert sent == {"url": "https://recs.example/recommendations/refresh", "method": "POST", "key": "s3cret"}


def test_refresh_failure_is_logged_not_raised(configured, monkeypatch):
    def unreachable(request, timeout):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(recommendations.urllib.request, "urlopen", unreachable)
    recommendations._post_refresh()  # must not raise on the background thread
