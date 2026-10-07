import numpy as np
import pytest
from fastapi.testclient import TestClient

import main
import security
from conftest import FakeSession, row
from database import get_db
from recommendation.service import RecommendationService
from recommendation.strategy import RecommendationStrategy

PLACE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
PLACE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


class FixedStrategy(RecommendationStrategy):
    scoring_paths = {PLACE_A: "blended"}

    def build_matrix(self, db, cutoff_time=None):
        return [PLACE_A, PLACE_B], np.array([[-1.0, 0.8], [0.8, -1.0]], dtype=np.float32)


@pytest.fixture
def session():
    return FakeSession([
        ("FROM places", [row(id=PLACE_B, name="Bakery B", category="Shops", subcategory="bakery",
                             description=None, lat=12.97, lng=77.59, address=None, images=None)]),
        ("FROM interactions", [row(total=3, unique_users=2, unique_places=2, cnt=1)]),
    ])


@pytest.fixture
def client(session, monkeypatch):
    service = RecommendationService(FixedStrategy())
    service.refresh_cache(session)
    monkeypatch.setattr(main, "rec_service", service)
    main.app.dependency_overrides[get_db] = lambda: session
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def as_user(user_id):
    main.app.dependency_overrides[security.require_user_id] = lambda: user_id


# ─── /interactions ──────────────────────────────────────────────────────────


def test_interaction_is_attributed_to_the_token_user_not_the_body(client, session):
    as_user("token-user")
    response = client.post(
        "/interactions",
        json={"place_id": PLACE_A, "interaction_type": "favorite", "user_id": "spoofed-user"},
    )

    assert response.status_code == 200
    _, params = next((sql, p) for sql, p in session.executed if "INSERT INTO interactions" in sql)
    assert params == {"user_id": "token-user", "place_id": PLACE_A, "interaction_type": "favorite"}
    assert session.commits == 1


def test_interaction_without_token_is_rejected_before_touching_the_db(client, session, monkeypatch):
    monkeypatch.setattr(security, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(security, "SUPABASE_ANON_KEY", "anon")

    response = client.post("/interactions", json={"place_id": PLACE_A, "interaction_type": "view"})

    assert response.status_code == 401
    assert not any("INSERT" in sql for sql, _ in session.executed)


@pytest.mark.parametrize("body", [
    {"place_id": "not-a-uuid", "interaction_type": "view"},
    {"place_id": PLACE_A, "interaction_type": "share"},
    {"interaction_type": "view"},
])
def test_invalid_interaction_body_is_422(client, body):
    as_user("token-user")
    assert client.post("/interactions", json=body).status_code == 422


# ─── /recommendations ───────────────────────────────────────────────────────


def test_recommendations_are_hydrated_with_scoring_path(client):
    response = client.get("/recommendations", params={"place_id": PLACE_A, "limit": 5})

    assert response.status_code == 200
    body = response.json()
    assert body["scoring_path"] == "blended"
    assert body["recommendations"] == [{
        "place_id": PLACE_B, "name": "Bakery B", "category": "Shops", "subcategory": "bakery",
        "description": None, "lat": 12.97, "lng": 77.59, "address": None, "images": None,
        "similarity_score": 0.8,
    }]


def test_unknown_place_is_404(client):
    assert client.get("/recommendations", params={"place_id": "nope"}).status_code == 404


# ─── /recommendations/refresh ───────────────────────────────────────────────


def test_refresh_requires_admin_key(client, monkeypatch):
    monkeypatch.setattr(security, "ADMIN_API_KEY", "s3cret")

    assert client.post("/recommendations/refresh").status_code == 403
    assert client.post("/recommendations/refresh", headers={"X-Admin-Key": "wrong"}).status_code == 403

    ok = client.post("/recommendations/refresh", headers={"X-Admin-Key": "s3cret"})
    assert ok.status_code == 200
    assert ok.json()["cached_places_count"] == 2


def test_refresh_disabled_when_no_admin_key_configured(client):
    assert client.post("/recommendations/refresh", headers={"X-Admin-Key": ""}).status_code == 503


# ─── /health, /interactions/stats ───────────────────────────────────────────


def test_health_is_503_without_a_database(client, monkeypatch):
    monkeypatch.setattr(main, "db_engine", None)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["database_connected"] is False


def test_stats(client):
    body = client.get("/interactions/stats").json()
    assert body == {"total_interactions": 3, "unique_users": 2, "unique_places": 2, "collab_ready_places": 1}
