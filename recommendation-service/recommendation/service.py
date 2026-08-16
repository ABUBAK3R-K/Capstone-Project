import numpy as np
from sqlalchemy.orm import Session
from .strategy import RecommendationStrategy


class RecommendationService:
    def __init__(self, strategy: RecommendationStrategy):
        """
        Initializes the service with a specific recommendation strategy.
        """
        self.strategy = strategy
        
        # In-memory cache
        self.place_ids = []
        self.similarity_matrix = np.array([])
        self.place_index_map = {}

        # Scoring path tracking (populated per-request)
        self.last_scoring_path = "unknown"

    def refresh_cache(self, db: Session):
        """
        Recomputes the similarity matrix using the injected strategy.
        Should be called on app startup and via the /refresh endpoint.
        """
        place_ids, sim_matrix = self.strategy.build_matrix(db)
        
        self.place_ids = place_ids
        self.similarity_matrix = sim_matrix
        self.place_index_map = {pid: idx for idx, pid in enumerate(self.place_ids)}
        
        return len(self.place_ids)

    def get_similar_places(self, place_id: str, limit: int = 10):
        """
        Retrieves the top-N similar places for a given place_id using the cached matrix.
        Also records which scoring path (blended vs content_only) served this request.
        """
        if place_id not in self.place_index_map:
            self.last_scoring_path = "unknown"
            return []

        # Determine scoring path from the strategy if it's a HybridStrategy
        if hasattr(self.strategy, 'scoring_paths'):
            self.last_scoring_path = self.strategy.scoring_paths.get(
                place_id, "content_only"
            )
        else:
            self.last_scoring_path = "content_only"

        idx = self.place_index_map[place_id]
        
        # O(1) lookup for this place's similarity row
        similarities = self.similarity_matrix[idx]
        
        # Find indices of the top-N scores
        num_places = len(similarities)
        fetch_count = min(limit, num_places)
        
        top_indices = np.argsort(similarities)[-fetch_count:][::-1]
        
        results = []
        for i in top_indices:
            score = float(similarities[i])
            # Skip the item itself if its score is marked as -1.0
            if score < 0:
                continue
                
            results.append({
                "place_id": self.place_ids[i],
                "similarity_score": round(score, 4),
                "scoring_path": self.last_scoring_path,
            })
            
        return results
