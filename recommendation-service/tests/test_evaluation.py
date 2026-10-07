import importlib.util
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

import evaluate
from conftest import FakeSession, row
from recommendation.strategy import RecommendationStrategy

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


def load_generator():
    spec = importlib.util.spec_from_file_location("generator", SCRIPTS / "generate_synthetic_interactions.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["generator"] = module
    spec.loader.exec_module(module)
    return module


# ─── evaluate.py ────────────────────────────────────────────────────────────


def test_temporal_split_keeps_the_oldest_80_percent_for_training():
    rows = list(range(10))
    train, test = evaluate.temporal_split(rows)
    assert train == list(range(8)) and test == [8, 9]


def test_build_user_items_groups_places_per_user():
    rows = [row(user_id="u1", place_id="a"), row(user_id="u1", place_id="b"), row(user_id="u2", place_id="a")]
    assert evaluate.build_user_items(rows) == {"u1": {"a", "b"}, "u2": {"a"}}


class FixedStrategy(RecommendationStrategy):
    def build_matrix(self, db, cutoff_time=None):
        ids = ["a", "b", "c", "d"]
        m = np.array([
            [-1.0, 0.9, 0.8, 0.1],
            [0.9, -1.0, 0.2, 0.3],
            [0.8, 0.2, -1.0, 0.4],
            [0.1, 0.3, 0.4, -1.0],
        ], dtype=np.float32)
        return ids, m


def test_precision_recall_and_coverage_math():
    # u1 trained on "a"; its recommendations are b, c, d (in that order).
    # The test window has u1 visiting "b" — a hit at rank 1.
    metrics = evaluate.score_strategy(
        FakeSession(), FixedStrategy(), cutoff_time=None,
        train_users={"u1": {"a"}}, test_users={"u1": {"b"}}, eval_users={"u1"}, k_values=(1, 3),
    )

    assert metrics["precision@1"] == 1.0
    assert metrics["recall@1"] == 1.0
    assert metrics["precision@3"] == 1 / 3
    assert metrics["recall@3"] == 1.0
    assert metrics["coverage"] == 75.0  # b, c, d recommended out of a..d
    assert metrics["paths"] == {"content_only": 1}


# ─── scripts/generate_synthetic_interactions.py ─────────────────────────────


PLACES = [
    {"id": f"p{i}", "category": ["Shops", "Religious", "Tourism"][i % 3], "lat": 12.95 + i * 0.002, "lng": 77.58 + i * 0.002}
    for i in range(40)
]


# City-sized: on a tiny catalogue every user touches most places and any
# overlap signal drowns.
LARGE_PLACES = [
    {"id": f"q{i}", "category": ["Shops", "Religious", "Tourism", "Public Parks"][i % 4],
     "lat": 12.90 + (i % 20) * 0.006, "lng": 77.55 + (i // 20) * 0.006}
    for i in range(300)
]


def generate(seed=42, users=20, per_user=15, days=90, places=PLACES):
    import random

    gen = load_generator()
    rng = random.Random(seed)
    built_users = gen.make_users(rng, places, users, n_groups=4)
    return gen, built_users, gen.generate_interactions(rng, places, built_users, per_user, days)


def test_generator_is_reproducible_for_a_seed():
    _, users_a, rows_a = generate(seed=7)
    _, users_b, rows_b = generate(seed=7)
    strip = lambda rows: [(r["user_id"], r["place_id"], r["interaction_type"]) for r in rows]  # noqa: E731
    assert [u["id"] for u in users_a] == [u["id"] for u in users_b]
    assert strip(rows_a) == strip(rows_b)


def test_generator_output_is_valid_and_time_ordered():
    gen, users, rows = generate(days=30)
    place_ids = {p["id"] for p in PLACES}
    now = datetime.now(timezone.utc)

    assert rows, "expected interactions"
    assert all(r["place_id"] in place_ids for r in rows)
    assert {r["interaction_type"] for r in rows} <= set(gen.TYPE_WEIGHTS)
    assert all(now - timedelta(days=31) <= r["created_at"] <= now for r in rows)
    assert [r["created_at"] for r in rows] == sorted(r["created_at"] for r in rows)
    assert all(u["email"].endswith("@" + gen.SYNTHETIC_EMAIL_DOMAIN) for u in users)


def test_generator_taste_groups_create_shared_favourites():
    """The collaborative signal: users in the same group overlap far more than chance."""
    _, users, rows = generate(users=40, per_user=20, places=LARGE_PLACES)
    by_user = {}
    for r in rows:
        by_user.setdefault(r["user_id"], set()).add(r["place_id"])

    group_of = {u["id"]: tuple(u["group"]) for u in users}
    same, different = [], []
    ids = list(by_user)
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            jaccard = len(by_user[a] & by_user[b]) / len(by_user[a] | by_user[b])
            (same if group_of[a] == group_of[b] else different).append(jaccard)

    assert np.mean(same) > np.mean(different) * 1.5
