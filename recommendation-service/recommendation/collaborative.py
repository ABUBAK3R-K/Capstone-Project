"""
Phase 2: Collaborative Filtering Strategy

Uses implicit ALS to learn latent item factors from user-place interactions,
then computes item-item cosine similarity to generate recommendations.

Interaction Weights:
  - visit  = 3.0  (strongest: user physically went there)
  - favorite = 2.0  (deliberate conscious action)
  - view   = 1.0  (passive/exploratory, lowest signal)

Cold-start threshold: 5 interactions per place.
Places below this threshold receive pure content-based scores.
"""

import logging
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from .strategy import RecommendationStrategy

logger = logging.getLogger("recommendation-service")

# Implicit signal weights — higher = stronger interest signal
INTERACTION_WEIGHTS = {
    "visit": 3.0,
    "favorite": 2.0,
    "view": 1.0,
}

COLD_START_THRESHOLD = 5  # Minimum interactions before collab scores are trusted


class CollaborativeFilteringStrategy(RecommendationStrategy):
    """
    Builds an item-item similarity matrix from user interaction data
    using implicit ALS (Alternating Least Squares) factorization.
    """

    def __init__(self, factors=50, iterations=15, regularization=0.01):
        self.factors = factors
        self.iterations = iterations
        self.regularization = regularization

    def build_matrix(self, db: Session):
        """
        1. Query weighted interactions from the database.
        2. Build a sparse user-item matrix.
        3. Factorize with implicit ALS to get item latent factors.
        4. Compute item-item cosine similarity from the factors.
        """
        # Step 1: Fetch all interactions with their types
        query = text("""
            SELECT user_id::text, place_id::text, interaction_type,
                   COUNT(*) as cnt
            FROM interactions
            GROUP BY user_id, place_id, interaction_type
        """)
        rows = db.execute(query).fetchall()

        if not rows:
            logger.warning("CollaborativeFiltering: No interactions found.")
            return [], np.array([])

        # Step 2: Build index mappings
        user_set = sorted(set(r.user_id for r in rows))
        place_set = sorted(set(r.place_id for r in rows))

        if len(user_set) < 2 or len(place_set) < 2:
            logger.warning(
                f"CollaborativeFiltering: Insufficient data "
                f"({len(user_set)} users, {len(place_set)} places)."
            )
            return [], np.array([])

        user_idx = {uid: i for i, uid in enumerate(user_set)}
        place_idx = {pid: i for i, pid in enumerate(place_set)}

        n_users = len(user_set)
        n_places = len(place_set)

        # Step 3: Populate sparse matrix with weighted interaction counts
        row_indices = []
        col_indices = []
        values = []

        for r in rows:
            weight = INTERACTION_WEIGHTS.get(r.interaction_type, 1.0)
            row_indices.append(user_idx[r.user_id])
            col_indices.append(place_idx[r.place_id])
            values.append(float(r.cnt) * weight)

        user_item = csr_matrix(
            (values, (row_indices, col_indices)),
            shape=(n_users, n_places),
        )

        # Step 4: Factorize with implicit ALS
        try:
            from implicit.als import AlternatingLeastSquares

            model = AlternatingLeastSquares(
                factors=self.factors,
                iterations=self.iterations,
                regularization=self.regularization,
                random_state=42,
            )
            # implicit expects item-user matrix (items × users)
            model.fit(user_item.T.tocsr())
            item_factors = model.item_factors  # shape: (n_places, factors)
        except ImportError:
            logger.error(
                "CollaborativeFiltering: 'implicit' library not installed. "
                "Falling back to SVD."
            )
            from sklearn.decomposition import TruncatedSVD

            n_components = min(self.factors, min(n_users, n_places) - 1)
            svd = TruncatedSVD(n_components=n_components, random_state=42)
            item_factors = svd.fit_transform(user_item.T)

        # Step 5: Item-item cosine similarity
        sim_matrix = cosine_similarity(item_factors, item_factors)
        np.fill_diagonal(sim_matrix, -1.0)

        logger.info(
            f"CollaborativeFiltering: Built matrix for {n_places} places "
            f"from {len(rows)} interaction groups across {n_users} users."
        )

        return list(place_set), sim_matrix


class HybridStrategy(RecommendationStrategy):
    """
    Blends content-based (Phase 1) and collaborative (Phase 2) similarity
    matrices with automatic cold-start fallback.

    For places with >= COLD_START_THRESHOLD interactions in the collaborative
    matrix, scores are blended:
        final = blend * content + (1 - blend) * collab

    For cold-start places (fewer interactions or absent from collab matrix),
    pure content-based scores are used. The per-place scoring path is
    recorded so main.py can log it.
    """

    def __init__(self, content_strategy, collab_strategy, blend=0.5):
        self.content_strategy = content_strategy
        self.collab_strategy = collab_strategy
        self.blend = blend

        # Tracks which places got blended vs content-only scoring
        # Populated after build_matrix() runs
        self.scoring_paths = {}  # place_id -> "blended" | "content_only"

    def build_matrix(self, db: Session):
        # 1. Build content matrix (covers ALL places)
        content_ids, content_matrix = self.content_strategy.build_matrix(db)
        if not content_ids:
            return [], np.array([])

        content_id_idx = {pid: i for i, pid in enumerate(content_ids)}
        n = len(content_ids)

        # 2. Build collaborative matrix (covers only interacted-with places)
        collab_ids, collab_matrix = self.collab_strategy.build_matrix(db)
        collab_id_idx = {pid: i for i, pid in enumerate(collab_ids)}

        # 3. Count interactions per place for cold-start detection
        interaction_counts = {}
        if collab_ids:
            try:
                result = db.execute(text("""
                    SELECT place_id::text, COUNT(*) as cnt
                    FROM interactions
                    GROUP BY place_id
                """)).fetchall()
                interaction_counts = {r.place_id: r.cnt for r in result}
            except Exception as e:
                logger.error(f"HybridStrategy: Failed to fetch interaction counts: {e}")

        # 4. Build the final blended matrix
        final_matrix = content_matrix.copy()
        self.scoring_paths = {}

        for i, pid_i in enumerate(content_ids):
            has_collab_i = (
                pid_i in collab_id_idx
                and interaction_counts.get(pid_i, 0) >= COLD_START_THRESHOLD
            )

            if has_collab_i:
                self.scoring_paths[pid_i] = "blended"
                ci = collab_id_idx[pid_i]

                for j, pid_j in enumerate(content_ids):
                    if i == j:
                        continue  # diagonal stays -1

                    if pid_j in collab_id_idx:
                        cj = collab_id_idx[pid_j]
                        collab_score = collab_matrix[ci][cj]
                        if collab_score < 0:
                            collab_score = 0.0  # handle diagonal leak
                        content_score = content_matrix[i][j]
                        if content_score < 0:
                            content_score = 0.0
                        final_matrix[i][j] = (
                            self.blend * content_score
                            + (1 - self.blend) * collab_score
                        )
                    # else: keep pure content score for this pair
            else:
                self.scoring_paths[pid_i] = "content_only"
                # Row stays as content_matrix[i] — no change needed

        blended_count = sum(
            1 for v in self.scoring_paths.values() if v == "blended"
        )
        logger.info(
            f"HybridStrategy: {blended_count}/{n} places using blended scoring, "
            f"{n - blended_count} using content-only (cold-start fallback)."
        )

        return content_ids, final_matrix
