"""
Phase 2 Scaffold: Collaborative Filtering Strategy

This module will eventually implement a collaborative filtering approach
that leverages real user interaction data (views, favorites, shares)
to generate personalized place recommendations.

STATUS: Skeleton only — do NOT use in production yet.
TRIGGER: Begin implementation once /interactions/stats shows:
  - At least 50 unique users
  - At least 200 total interactions
  - Coverage across 30+ unique places
"""

import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
from .strategy import RecommendationStrategy


class CollaborativeFilteringStrategy(RecommendationStrategy):
    """
    TODO: Phase 2 — User-Item collaborative filtering.

    High-level approach:
    1. Query the `interactions` table to build a user-item interaction matrix.
    2. Apply implicit ALS (Alternating Least Squares) or SVD to factorize
       the matrix into user and item latent factors.
    3. For a given place_id, find the item factor vector and compute
       cosine similarity against all other item vectors.
    4. Return the top-N most similar items as recommendations.

    Libraries to consider:
    - `implicit` (lightweight, fast ALS for implicit feedback)
    - `scipy.sparse` for efficient matrix storage
    - `surprise` (heavier, but has more algorithms)

    Integration plan:
    - This class implements RecommendationStrategy.build_matrix(), so it
      can be swapped in or blended with ContentProximityStrategy.
    - main.py will eventually create a HybridStrategy that combines
      content-based scores (Phase 1) with collaborative scores (Phase 2)
      using a tunable weight parameter.
    """

    def __init__(self, interaction_weight=0.5):
        """
        Args:
            interaction_weight: How much to weight collaborative scores
                                when blending with content-based scores.
                                (0.0 = pure content, 1.0 = pure collaborative)
        """
        self.interaction_weight = interaction_weight

    def build_matrix(self, db: Session):
        """
        TODO: Implement the following steps:

        Step 1: Fetch interactions
        --------------------------
        query = text('''
            SELECT user_id, place_id, COUNT(*) as interaction_count
            FROM interactions
            GROUP BY user_id, place_id
        ''')
        interactions = db.execute(query).fetchall()

        Step 2: Build sparse user-item matrix
        --------------------------------------
        # Map user_ids and place_ids to integer indices
        # Create a scipy.sparse.csr_matrix of shape (n_users, n_places)
        # Values = interaction_count (implicit signal strength)

        Step 3: Factorize
        -----------------
        # Option A: implicit.als.AlternatingLeastSquares
        #   model = AlternatingLeastSquares(factors=50)
        #   model.fit(user_item_matrix)
        #   item_factors = model.item_factors  # shape: (n_places, 50)
        #
        # Option B: sklearn TruncatedSVD
        #   svd = TruncatedSVD(n_components=50)
        #   item_factors = svd.fit_transform(user_item_matrix.T)

        Step 4: Compute item-item similarity
        -------------------------------------
        # sim_matrix = cosine_similarity(item_factors)
        # np.fill_diagonal(sim_matrix, -1.0)
        # return place_ids, sim_matrix
        """

        # Placeholder: return empty until implemented
        return [], np.array([])


class HybridStrategy(RecommendationStrategy):
    """
    TODO: Phase 2 — Blends content-based and collaborative scores.

    Usage in main.py:
        content_strategy = ContentProximityStrategy(...)
        collab_strategy = CollaborativeFilteringStrategy(...)
        hybrid = HybridStrategy(content_strategy, collab_strategy, blend=0.6)
        rec_service = RecommendationService(strategy=hybrid)

    The `blend` parameter controls the mix:
        final_score = blend * content_score + (1 - blend) * collab_score

    When collab data is sparse (early days), blend should be high (0.8+).
    As interaction volume grows, gradually lower blend toward 0.5.
    """

    def __init__(self, content_strategy, collab_strategy, blend=0.7):
        self.content_strategy = content_strategy
        self.collab_strategy = collab_strategy
        self.blend = blend

    def build_matrix(self, db: Session):
        """
        TODO: Implement blending logic:
        1. Build both matrices independently.
        2. Align place_ids (they must match).
        3. Weighted sum: blend * content_matrix + (1 - blend) * collab_matrix.
        4. Return the combined (place_ids, blended_matrix).
        """
        # Placeholder: fall back to content-only for now
        return self.content_strategy.build_matrix(db)
