"""The DB-orchestrating entry points — evaluate(), the synthetic generator's
main(), and the service lifespan — driven end to end over a FakeSession."""

import sys
import time
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

import evaluate
import main
from conftest import COLLAB_SQL, COUNTS_SQL, PLACES_SQL, FakeSession, interaction_group, place, row
from test_evaluation import load_generator

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

CATALOGUE = [
    place(f"p{i}", ["Shops", "Religious", "Tourism"][i % 3], 12.95 + i * 0.003, 77.58 + i * 0.003, "kind", "text")
    for i in range(12)
]


def interaction_rows():
    """3 users × 6 interactions each, time-ordered; the last ones land in the test window."""
    rows = []
    for step in range(6):
        for u in range(3):
            rows.append(row(
                user_id=f"u{u}",
                place_id=f"p{(u * 2 + step) % 12}",
                interaction_type="view",
                created_at=T0 + timedelta(hours=step * 3 + u),
            ))
    return rows


def evaluation_session():
    rows = interaction_rows()
    groups = [interaction_group(r.user_id, r.place_id) for r in rows]
    counts = {}
    for r in rows:
        counts[r.place_id] = counts.get(r.place_id, 0) + 1
    return FakeSession([
        ("ORDER BY created_at ASC", rows),
        (PLACES_SQL, CATALOGUE),
        (COLLAB_SQL, groups),
        (COUNTS_SQL, [row(place_id=k, cnt=v) for k, v in counts.items()]),
    ])


# ─── evaluate.py ────────────────────────────────────────────────────────────


def test_evaluate_compares_all_strategies_on_one_split(monkeypatch, capsys):
    monkeypatch.setattr(evaluate, "Session", evaluation_session)

    metrics = evaluate.evaluate(k_values=(5,), strategies=("content", "collaborative", "hybrid"))

    assert set(metrics) == {"content", "collaborative", "hybrid"}
    for m in metrics.values():
        assert 0.0 <= m["precision@5"] <= 1.0 and 0.0 <= m["recall@5"] <= 1.0
    out = capsys.readouterr().out
    assert "COMPARISON (same temporal split)" in out
    assert "Users in both train+test: 3" in out


def test_evaluate_refuses_too_little_data(monkeypatch):
    monkeypatch.setattr(evaluate, "Session", lambda: FakeSession([("ORDER BY created_at ASC", interaction_rows()[:5])]))
    with pytest.raises(SystemExit):
        evaluate.evaluate()


def test_session_requires_database_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "")
    with pytest.raises(SystemExit):
        evaluate.Session()


# ─── scripts/generate_synthetic_interactions.py ─────────────────────────────


def generator_session(existing=0):
    places = [row(id=p.id, category=p.category, lat=p.lat, lng=p.lon) for p in CATALOGUE]
    return FakeSession([
        ("SELECT COUNT(*) FROM auth.users", [row(count=existing)]),
        ("ST_Y(location::geometry) AS lat", places),
    ])


def run_generator(monkeypatch, session, *args):
    gen = load_generator()
    monkeypatch.setattr(gen, "SessionLocal", lambda: session)
    monkeypatch.setattr(gen, "engine", object())
    monkeypatch.setattr(sys, "argv", ["generate", *args])
    gen.main()
    return gen


def test_generator_writes_users_then_interactions(monkeypatch):
    session = generator_session()
    run_generator(monkeypatch, session, "--users", "5", "--per-user", "4")

    inserts = [(sql, params) for sql, params in session.executed if sql.strip().startswith("INSERT")]
    assert "auth.users" in inserts[0][0] and len(inserts[0][1]) == 5
    assert all("INSERT INTO interactions" in sql for sql, _ in inserts[1:])
    assert session.commits == 1


def test_generator_dry_run_writes_nothing(monkeypatch):
    session = generator_session()
    run_generator(monkeypatch, session, "--dry-run")
    assert not any(sql.strip().startswith("INSERT") for sql, _ in session.executed)


def test_generator_refuses_to_duplicate_an_existing_run(monkeypatch):
    with pytest.raises(SystemExit):
        run_generator(monkeypatch, generator_session(existing=80))


def test_generator_purge_only_targets_synthetic_accounts(monkeypatch):
    session = generator_session()
    gen = run_generator(monkeypatch, session, "--purge")

    deletes = [(sql, params) for sql, params in session.executed if "DELETE" in sql]
    assert len(deletes) == 3
    assert all(params == {"pattern": f"%@{gen.SYNTHETIC_EMAIL_DOMAIN}"} for _, params in deletes)


# ─── main.py lifespan ───────────────────────────────────────────────────────


def test_startup_builds_cache_and_periodic_refresh_keeps_running(monkeypatch):
    calls = []
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured")
    monkeypatch.setattr(main, "_refresh_with_new_session", lambda: calls.append(time.monotonic()) or 3)
    monkeypatch.setattr(main, "REFRESH_INTERVAL_MINUTES", 0.001)  # 60 ms

    with TestClient(main.app):
        time.sleep(0.5)

    assert len(calls) >= 3  # startup + periodic rebuilds


def test_startup_survives_a_failing_first_build(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://configured")

    def boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(main, "_refresh_with_new_session", boom)
    monkeypatch.setattr(main, "REFRESH_INTERVAL_MINUTES", 0)

    with TestClient(main.app) as client:
        assert client.get("/").status_code == 200


def test_no_periodic_refresh_without_a_database(monkeypatch):
    calls = []
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setattr(main, "_refresh_with_new_session", lambda: calls.append(1) or 0)
    monkeypatch.setattr(main, "REFRESH_INTERVAL_MINUTES", 0.001)

    with TestClient(main.app):
        time.sleep(0.2)

    assert calls == []
