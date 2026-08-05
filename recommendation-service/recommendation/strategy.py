from abc import ABC, abstractmethod
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity, haversine_distances

class RecommendationStrategy(ABC):
    @abstractmethod
    def build_matrix(self, db: Session):
        """
        Builds and returns a tuple of (place_ids_list, similarity_matrix).
        The similarity_matrix is a 2D numpy array where matrix[i][j] is the similarity score
        between place_ids_list[i] and place_ids_list[j].
        """
        pass

class ContentProximityStrategy(RecommendationStrategy):
    def __init__(self, text_weight=0.7, geo_weight=0.3, geo_decay_km=2.0):
        self.text_weight = text_weight
        self.geo_weight = geo_weight
        self.geo_decay_km = geo_decay_km
        self.earth_radius_km = 6371.0

    def build_matrix(self, db: Session):
        # 1. Fetch all places with their extracted Lat/Lon from PostGIS
        query = text("""
            SELECT 
                id, 
                category, 
                subcategory, 
                description, 
                ST_Y(location::geometry) as lat, 
                ST_X(location::geometry) as lon 
            FROM places
        """)
        
        results = db.execute(query).fetchall()
        
        if not results:
            return [], np.array([])

        place_ids = []
        corpus = []
        coords = []

        for row in results:
            place_ids.append(str(row.id))
            
            # 2. Build text representation for TF-IDF
            cat = row.category or ""
            subcat = row.subcategory or ""
            desc = row.description or ""
            corpus.append(f"{cat} {subcat} {desc}")
            
            # 3. Extract coordinates
            coords.append([row.lat, row.lon])

        # 4. Compute Content (Text) Similarity using TF-IDF
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(corpus)
        text_sim_matrix = cosine_similarity(tfidf_matrix, tfidf_matrix)

        # 5. Compute Geographic Proximity Similarity using Haversine
        # Convert coords to radians for sklearn's haversine_distances
        coords_rad = np.radians(np.array(coords))
        dist_rad = haversine_distances(coords_rad, coords_rad)
        dist_km = dist_rad * self.earth_radius_km
        
        # Normalize distance into a similarity score (decay function)
        # 0 km -> sim of 1.0. If dist == geo_decay_km, sim is roughly 0.36
        geo_sim_matrix = np.exp(-dist_km / self.geo_decay_km)

        # 6. Blend Similarities
        blended_sim_matrix = (self.text_weight * text_sim_matrix) + (self.geo_weight * geo_sim_matrix)

        # To prevent recommending the exact same place, set self-similarity to -1
        np.fill_diagonal(blended_sim_matrix, -1.0)

        return place_ids, blended_sim_matrix
