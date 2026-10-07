import threading

import numpy as np

from conftest import FakeSession
from recommendation.service import RecommendationService
from recommendation.strategy import RecommendationStrategy


class FixedStrategy(RecommendationStrategy):
    def __init__(self, ids, matrix, scoring_paths=None):
        self.ids, self.matrix = ids, np.asarray(matrix, dtype=np.float32)
        if scoring_paths is not None:
            self.scoring_paths = scoring_paths

    def build_matrix(self, db, cutoff_time=None):
        return list(self.ids), self.matrix.copy()


MATRIX = [
    [-1.0, 0.9, 0.2, 0.5],
    [0.9, -1.0, 0.4, 0.1],
    [0.2, 0.4, -1.0, 0.3],
    [0.5, 0.1, 0.3, -1.0],
]


def service_with(ids=("a", "b", "c", "d"), matrix=MATRIX, scoring_paths=None):
    service = RecommendationService(FixedStrategy(ids, matrix, scoring_paths))
    service.refresh_cache(FakeSession())
    return service


def test_unknown_place_returns_empty_with_unknown_path():
    result = service_with().get_similar_places("zzz")
    assert result.recommendations == [] and result.scoring_path == "unknown"


def test_results_are_ranked_and_never_include_the_place_itself():
    result = service_with().get_similar_places("a", limit=10)
    ids = [r["place_id"] for r in result.recommendations]
    assert ids == ["b", "d", "c"]
    assert "a" not in ids


def test_limit_is_respected():
    assert len(service_with().get_similar_places("a", limit=2).recommendations) == 2


def test_scoring_path_comes_from_the_build_that_served_it():
    service = service_with(scoring_paths={"a": "blended"})
    assert service.get_similar_places("a").scoring_path == "blended"
    assert service.get_similar_places("b").scoring_path == "content_only"
    assert all(r["scoring_path"] == "blended" for r in service.get_similar_places("a").recommendations)


def test_refresh_replaces_the_whole_cache():
    service = service_with()
    service.strategy = FixedStrategy(["x", "y"], [[-1.0, 0.7], [0.7, -1.0]])

    assert service.refresh_cache(FakeSession()) == 2
    assert service.cached_place_ids == ["x", "y"]
    assert service.get_similar_places("a").recommendations == []
    assert service.get_similar_places("x").recommendations[0]["place_id"] == "y"


def test_empty_build_serves_nothing():
    service = RecommendationService(FixedStrategy([], np.array([])))
    assert service.refresh_cache(FakeSession()) == 0
    assert service.get_similar_places("a").recommendations == []


def test_concurrent_reads_during_refresh_always_see_a_consistent_build():
    """A reader must never pair one build's index map with another build's
    matrix — that returned wrong rows or raised IndexError before the cache
    became a single immutable snapshot."""
    small = FixedStrategy(["a", "b"], [[-1.0, 0.5], [0.5, -1.0]])
    big_ids = [f"p{i}" for i in range(200)] + ["a", "b"]
    big_matrix = np.full((202, 202), 0.1, dtype=np.float32)
    np.fill_diagonal(big_matrix, -1.0)
    big = FixedStrategy(big_ids, big_matrix)

    service = RecommendationService(small)
    service.refresh_cache(FakeSession())
    errors = []
    stop = threading.Event()

    def reader():
        while not stop.is_set():
            try:
                for rec in service.get_similar_places("a", limit=5).recommendations:
                    assert rec["place_id"] != "a"
            except Exception as e:  # noqa: BLE001 - any failure is the bug
                errors.append(e)
                return

    threads = [threading.Thread(target=reader) for _ in range(4)]
    for t in threads:
        t.start()
    for i in range(50):
        service.strategy = big if i % 2 else small
        service.refresh_cache(FakeSession())
    stop.set()
    for t in threads:
        t.join()

    assert errors == []
