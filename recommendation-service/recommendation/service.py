import threading
from dataclasses import dataclass, field

import numpy as np
from sqlalchemy.orm import Session
from .strategy import RecommendationStrategy


@dataclass(frozen=True)
class SimilarityCache:
    """One immutable build of the similarity matrix.

    Everything a lookup needs lives in a single object that is swapped in with
    one attribute assignment, so a request running while a refresh completes
    sees either the old build or the new one — never the new index map paired
    with the old matrix (which returned the wrong row, or raised IndexError
    when the catalogue had grown).
    """

    place_ids: list = field(default_factory=list)
    similarity_matrix: np.ndarray = field(default_factory=lambda: np.array([]))
    place_index_map: dict = field(default_factory=dict)
    scoring_paths: dict = field(default_factory=dict)


@dataclass(frozen=True)
class SimilarPlacesResult:
    recommendations: list
    scoring_path: str


class RecommendationService:
    def __init__(self, strategy: RecommendationStrategy):
        """
        Initializes the service with a specific recommendation strategy.
        """
        self.strategy = strategy
        self._cache = SimilarityCache()
        # Builds are serialized: HybridStrategy mutates its scoring_paths while
        # building, so two overlapping refreshes (startup, /refresh, the
        # periodic task) could otherwise interleave. Reads never take the lock.
        self._build_lock = threading.Lock()

    @property
    def cached_place_ids(self) -> list:
        return list(self._cache.place_ids)

    def refresh_cache(self, db: Session, cutoff_time=None):
        """
        Recomputes the similarity matrix using the injected strategy.
        Should be called on app startup and via the /refresh endpoint.

        `cutoff_time` is forwarded to the strategy and, for strategies that
        read `interactions`, restricts training data to rows created at or
        before that timestamp. Production callers (startup, /refresh) omit it
        to use the full dataset; evaluate.py sets it to the training cutoff.
        """
        with self._build_lock:
            place_ids, sim_matrix = self.strategy.build_matrix(db, cutoff_time)
            # HybridStrategy records blended/content_only per place during the
            # build; snapshot it alongside the matrix it describes.
            scoring_paths = dict(getattr(self.strategy, "scoring_paths", {}) or {})

        self._cache = SimilarityCache(
            place_ids=list(place_ids),
            similarity_matrix=sim_matrix,
            place_index_map={pid: idx for idx, pid in enumerate(place_ids)},
            scoring_paths=scoring_paths,
        )
        return len(place_ids)

    def get_similar_places(self, place_id: str, limit: int = 10) -> SimilarPlacesResult:
        """
        Retrieves the top-N similar places for a given place_id using the cached
        matrix, plus which scoring path (blended vs content_only) served it.
        The path is returned per call rather than stored on the service, so
        concurrent requests can't overwrite each other's answer.
        """
        cache = self._cache  # one read: every lookup below uses the same build

        if place_id not in cache.place_index_map:
            return SimilarPlacesResult(recommendations=[], scoring_path="unknown")

        scoring_path = cache.scoring_paths.get(place_id, "content_only")
        idx = cache.place_index_map[place_id]

        # O(1) lookup for this place's similarity row
        similarities = cache.similarity_matrix[idx]

        # Find indices of the top-N scores
        fetch_count = min(limit, len(similarities))
        top_indices = np.argsort(similarities)[-fetch_count:][::-1] if fetch_count > 0 else []

        results = []
        for i in top_indices:
            score = float(similarities[i])
            # Skip the item itself if its score is marked as -1.0
            if score < 0:
                continue

            results.append({
                "place_id": cache.place_ids[i],
                "similarity_score": round(score, 4),
                "scoring_path": scoring_path,
            })

        return SimilarPlacesResult(recommendations=results, scoring_path=scoring_path)
