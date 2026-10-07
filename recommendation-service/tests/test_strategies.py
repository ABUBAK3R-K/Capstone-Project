import builtins

import numpy as np
import pytest

from conftest import COLLAB_SQL, COUNTS_SQL, PLACES_SQL, FakeSession, interaction_group, place, row
from recommendation.collaborative import COLD_START_THRESHOLD, CollaborativeFilteringStrategy, HybridStrategy
from recommendation.strategy import ContentProximityStrategy, RecommendationStrategy

# Two bakeries a few hundred metres apart, a temple next to bakery A, and a
# bakery far away — enough to separate the text and geo signals.
PLACES = [
    place("bakery-a", "Shops", 12.9700, 77.5900, "bakery", "fresh bread and cakes"),
    place("bakery-b", "Shops", 12.9720, 77.5920, "bakery", "bread cakes pastries"),
    place("temple", "Religious", 12.9701, 77.5901, "hindu", "historic temple"),
    place("bakery-far", "Shops", 13.0700, 77.6900, "bakery", "fresh bread and cakes"),
]


def content_session():
    return FakeSession([(PLACES_SQL, PLACES)])


# ─── Content strategy ───────────────────────────────────────────────────────


def test_content_returns_empty_when_catalogue_is_empty():
    ids, matrix = ContentProximityStrategy().build_matrix(FakeSession([(PLACES_SQL, [])]))
    assert ids == [] and matrix.size == 0


def test_content_matrix_is_square_float32_with_self_excluded():
    ids, matrix = ContentProximityStrategy().build_matrix(content_session())

    assert ids == [p.id for p in PLACES]
    assert matrix.shape == (4, 4)
    assert matrix.dtype == np.float32
    assert np.all(np.diag(matrix) == -1.0)


def test_content_prefers_textually_similar_place_over_merely_nearby_one():
    ids, matrix = ContentProximityStrategy().build_matrix(content_session())
    a = ids.index("bakery-a")

    # The temple is closer to bakery A than bakery B is, but bakery B shares
    # its category/type/description — the 0.7 text weight should win.
    assert matrix[a, ids.index("bakery-b")] > matrix[a, ids.index("temple")]


def test_content_geo_decay_breaks_ties_between_identical_text():
    ids, matrix = ContentProximityStrategy().build_matrix(content_session())
    b = ids.index("bakery-b")

    # bakery-a and bakery-far have identical text; the nearer one must score higher.
    assert matrix[b, ids.index("bakery-a")] > matrix[b, ids.index("bakery-far")]


# ─── Collaborative strategy ─────────────────────────────────────────────────


def test_collaborative_needs_two_users_and_two_places():
    one_user = [interaction_group("u1", "p1"), interaction_group("u1", "p2")]
    ids, matrix = CollaborativeFilteringStrategy().build_matrix(FakeSession([(COLLAB_SQL, one_user)]))
    assert ids == [] and matrix.size == 0


def test_collaborative_returns_empty_without_interactions():
    ids, matrix = CollaborativeFilteringStrategy().build_matrix(FakeSession())
    assert ids == [] and matrix.size == 0


def test_collaborative_passes_cutoff_to_sql():
    session = FakeSession([(COLLAB_SQL, [])])
    CollaborativeFilteringStrategy().build_matrix(session, cutoff_time="2026-01-01")

    sql, params = session.executed[0]
    assert "created_at <= :cutoff_time" in sql
    assert params == {"cutoff_time": "2026-01-01"}


def test_collaborative_svd_fallback_when_implicit_is_missing(monkeypatch):
    real_import = builtins.__import__

    def no_implicit(name, *args, **kwargs):
        if name.startswith("implicit"):
            raise ImportError("simulated: implicit not installed")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", no_implicit)

    groups = [
        interaction_group("u1", "p1", "visit"),
        interaction_group("u1", "p2", "favorite"),
        interaction_group("u2", "p1", "view"),
        interaction_group("u2", "p3", "view"),
        interaction_group("u3", "p2", "view"),
        interaction_group("u3", "p3", "visit"),
    ]
    ids, matrix = CollaborativeFilteringStrategy(factors=2).build_matrix(FakeSession([(COLLAB_SQL, groups)]))

    assert ids == ["p1", "p2", "p3"]
    assert matrix.shape == (3, 3)
    assert matrix.dtype == np.float32
    assert np.all(np.diag(matrix) == -1.0)


# ─── Hybrid strategy ────────────────────────────────────────────────────────


class FixedStrategy(RecommendationStrategy):
    def __init__(self, ids, matrix):
        self.ids, self.matrix = ids, matrix

    def build_matrix(self, db, cutoff_time=None):
        return list(self.ids), self.matrix.copy()


def reference_blend(content_ids, content, collab_ids, collab, counts, blend):
    """The original per-cell loop HybridStrategy used before vectorization —
    kept here as the specification the vectorized version must reproduce."""
    collab_idx = {pid: i for i, pid in enumerate(collab_ids)}
    final = content.copy()
    for i, pid_i in enumerate(content_ids):
        if not (pid_i in collab_idx and counts.get(pid_i, 0) >= COLD_START_THRESHOLD):
            continue
        ci = collab_idx[pid_i]
        for j, pid_j in enumerate(content_ids):
            if i == j or pid_j not in collab_idx:
                continue
            collab_score = max(collab[ci][collab_idx[pid_j]], 0.0)
            content_score = max(content[i][j], 0.0)
            final[i][j] = blend * content_score + (1 - blend) * collab_score
    return final


def random_similarity(rng, n):
    m = rng.uniform(-0.2, 1.0, size=(n, n)).astype(np.float32)
    np.fill_diagonal(m, -1.0)
    return m


def test_hybrid_vectorized_blend_matches_reference_loop():
    rng = np.random.default_rng(7)
    content_ids = [f"p{i}" for i in range(12)]
    collab_ids = ["p7", "p1", "p3", "p10", "p5", "p0"]  # subset, different order
    content = random_similarity(rng, len(content_ids))
    collab = random_similarity(rng, len(collab_ids))
    counts = {"p7": 9, "p1": COLD_START_THRESHOLD, "p3": COLD_START_THRESHOLD - 1, "p10": 30, "p0": 0}

    session = FakeSession([(COUNTS_SQL, [row(place_id=k, cnt=v) for k, v in counts.items()])])
    hybrid = HybridStrategy(FixedStrategy(content_ids, content), FixedStrategy(collab_ids, collab), blend=0.5)
    ids, final = hybrid.build_matrix(session)

    expected = reference_blend(content_ids, content, collab_ids, collab, counts, 0.5)
    assert ids == content_ids
    np.testing.assert_allclose(final, expected, rtol=1e-6, atol=1e-6)
    assert np.all(np.diag(final) == -1.0)


def test_hybrid_scoring_paths_follow_cold_start_threshold():
    content_ids = ["a", "b", "c"]
    content = random_similarity(np.random.default_rng(1), 3)
    collab = random_similarity(np.random.default_rng(2), 2)
    counts = [row(place_id="a", cnt=COLD_START_THRESHOLD), row(place_id="b", cnt=COLD_START_THRESHOLD - 1)]

    hybrid = HybridStrategy(FixedStrategy(content_ids, content), FixedStrategy(["a", "b"], collab))
    hybrid.build_matrix(FakeSession([(COUNTS_SQL, counts)]))

    assert hybrid.scoring_paths == {"a": "blended", "b": "content_only", "c": "content_only"}


def test_hybrid_is_pure_content_when_no_collaborative_data():
    content_ids = ["a", "b"]
    content = random_similarity(np.random.default_rng(3), 2)
    hybrid = HybridStrategy(FixedStrategy(content_ids, content), FixedStrategy([], np.array([])))

    ids, final = hybrid.build_matrix(FakeSession())

    np.testing.assert_array_equal(final, content)
    assert set(hybrid.scoring_paths.values()) == {"content_only"}


@pytest.mark.parametrize("cutoff", [None, "2026-03-01"])
def test_hybrid_forwards_cutoff_to_both_strategies(cutoff):
    seen = []

    class Recording(FixedStrategy):
        def build_matrix(self, db, cutoff_time=None):
            seen.append(cutoff_time)
            return super().build_matrix(db, cutoff_time)

    m = random_similarity(np.random.default_rng(4), 2)
    HybridStrategy(Recording(["a", "b"], m), Recording(["a", "b"], m)).build_matrix(FakeSession(), cutoff)
    assert seen == [cutoff, cutoff]


def test_collaborative_als_returns_one_row_per_place_not_per_user():
    """Regression: the matrix used to be fed to implicit transposed (the
    pre-0.5 API), so item factors came back per *user*. With more places than
    users the hybrid then crashed; with more users it blended user similarity."""
    pytest.importorskip("implicit")

    # 3 users, 6 places: the shapes differ, so a transpose can't hide.
    groups = [interaction_group(f"u{u}", f"p{p}", "visit") for u in range(3) for p in range(6) if (u + p) % 2 == 0]
    groups += [interaction_group("u0", "p1"), interaction_group("u1", "p2"), interaction_group("u2", "p3")]
    ids, matrix = CollaborativeFilteringStrategy(factors=2, iterations=3).build_matrix(
        FakeSession([(COLLAB_SQL, groups)])
    )

    assert ids == [f"p{p}" for p in range(6)]
    assert matrix.shape == (6, 6)
