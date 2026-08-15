import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from recommendation.strategy import ContentProximityStrategy
from recommendation.service import RecommendationService

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("recommendation-service")

# Initialize Recommendation Service
strategy = ContentProximityStrategy(text_weight=0.7, geo_weight=0.3, geo_decay_km=2.0)
rec_service = RecommendationService(strategy=strategy)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: prepopulate cache
    try:
        # We handle this carefully in case DB is not yet set up
        if os.getenv("DATABASE_URL"):
            db = next(get_db())
            try:
                count = rec_service.refresh_cache(db)
                logger.info(f"Startup: Cached recommendations for {count} places.")
            finally:
                db.close()
        else:
            logger.warning("Startup: DATABASE_URL not set, skipping cache prepopulation.")
    except Exception as e:
        logger.error(f"Startup: Failed to prepopulate cache - {e}")
    
    yield
    # Shutdown logic goes here (if any)

# Initialize FastAPI application
app = FastAPI(
    title="CityGuide Recommendation Service",
    description="Python FastAPI service for geographic and interaction-based recommendations",
    version="0.2.0",
    lifespan=lifespan
)

# Enable CORS for local cross-origin development (e.g., from web dashboards or local mobile tests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Models ---
class InteractionRequest(BaseModel):
    user_id: str
    place_id: str
    interaction_type: str  # e.g., 'view', 'favorite', 'share'


@app.get("/")
def read_root():
    return {
        "message": "Welcome to the CityGuide Recommendation Service API. Visit /docs for Swagger documentation."
    }

@app.get("/health", status_code=200)
def health_check():
    """
    Service health check endpoint.
    """
    db_configured = bool(os.getenv("DATABASE_URL"))
    
    return {
        "status": "healthy",
        "database_configured": db_configured,
        "service": "recommendation-service"
    }


@app.post("/interactions")
def log_interaction(interaction: InteractionRequest, db: Session = Depends(get_db)):
    """
    Logs a user-place interaction (e.g., 'view') into the interactions table.
    Called by the Flutter app whenever a user opens a place detail screen.
    """
    try:
        db.execute(
            text("""
                INSERT INTO interactions (user_id, place_id, interaction_type)
                VALUES (:user_id, :place_id, :interaction_type)
            """),
            {
                "user_id": interaction.user_id,
                "place_id": interaction.place_id,
                "interaction_type": interaction.interaction_type,
            }
        )
        db.commit()

        logger.info(
            f"INTERACTION | user={interaction.user_id} | place={interaction.place_id} | type={interaction.interaction_type}"
        )

        return {"status": "ok"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log interaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/interactions/stats")
def interaction_stats(db: Session = Depends(get_db)):
    """
    Returns basic interaction volume stats so you can track
    when there's enough data to begin Phase 2 (collaborative filtering).
    """
    try:
        result = db.execute(text("""
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT place_id) as unique_places
            FROM interactions
        """)).fetchone()

        return {
            "total_interactions": result.total,
            "unique_users": result.unique_users,
            "unique_places": result.unique_places,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/recommendations")
def get_recommendations(place_id: str, limit: int = 10, db: Session = Depends(get_db)):
    """
    Get top-N similar places for a given place_id.
    Returns fully hydrated place data (no raw PostGIS objects).
    """
    raw_results = rec_service.get_similar_places(place_id, limit=limit)
    if not raw_results:
        raise HTTPException(status_code=404, detail="Place not found in cache or cache is empty.")
    
    # Hydrate: fetch full place details for the recommended IDs
    rec_ids = [r["place_id"] for r in raw_results]
    score_map = {r["place_id"]: r["similarity_score"] for r in raw_results}

    # Build a parameterized query for the recommended place IDs
    placeholders = ", ".join([f":id_{i}" for i in range(len(rec_ids))])
    params = {f"id_{i}": pid for i, pid in enumerate(rec_ids)}

    rows = db.execute(
        text(f"""
            SELECT
                id, name, category, subcategory, description,
                ST_Y(location::geometry) as lat,
                ST_X(location::geometry) as lng,
                address, images
            FROM places
            WHERE id::text IN ({placeholders})
        """),
        params
    ).fetchall()

    # Build the hydrated response, preserving the similarity order
    row_map = {str(r.id): r for r in rows}
    hydrated = []
    for rec_id in rec_ids:
        row = row_map.get(rec_id)
        if row:
            hydrated.append({
                "place_id": str(row.id),
                "name": row.name,
                "category": row.category,
                "subcategory": row.subcategory,
                "description": row.description,
                "lat": row.lat,
                "lng": row.lng,
                "address": row.address,
                "images": row.images,
                "similarity_score": score_map.get(rec_id, 0.0),
            })

    return {"place_id": place_id, "recommendations": hydrated}


@app.post("/recommendations/refresh")
def refresh_recommendations(db: Session = Depends(get_db)):
    """
    Manually triggers a rebuild of the recommendation similarity matrix cache.
    """
    try:
        count = rec_service.refresh_cache(db)
        logger.info(f"Cache refresh: rebuilt for {count} places.")
        return {"status": "success", "message": f"Cache rebuilt for {count} places.", "cached_places_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
