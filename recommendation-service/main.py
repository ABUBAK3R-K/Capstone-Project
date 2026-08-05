import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db
from recommendation.strategy import ContentProximityStrategy
from recommendation.service import RecommendationService

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
                print(f"Startup: Cached recommendations for {count} places.")
            finally:
                db.close()
        else:
            print("Startup: DATABASE_URL not set, skipping cache prepopulation.")
    except Exception as e:
        print(f"Startup: Failed to prepopulate cache - {e}")
    
    yield
    # Shutdown logic goes here (if any)

# Initialize FastAPI application
app = FastAPI(
    title="CityGuide Recommendation Service",
    description="Python FastAPI service for geographic and interaction-based recommendations",
    version="0.1.0",
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

@app.get("/recommendations")
def get_recommendations(place_id: str, limit: int = 10):
    """
    Get top-N similar places for a given place_id based on content and geographic proximity.
    """
    results = rec_service.get_similar_places(place_id, limit=limit)
    if not results:
        raise HTTPException(status_code=404, detail="Place not found in cache or cache is empty.")
    
    return {"place_id": place_id, "recommendations": results}

@app.post("/recommendations/refresh")
def refresh_recommendations(db: Session = Depends(get_db)):
    """
    Manually triggers a rebuild of the recommendation similarity matrix cache.
    """
    try:
        count = rec_service.refresh_cache(db)
        return {"status": "success", "message": f"Cache rebuilt for {count} places.", "cached_places_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
