import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize FastAPI application
app = FastAPI(
    title="CityGuide Recommendation Service",
    description="Python FastAPI service for geographic and interaction-based recommendations",
    version="0.1.0"
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
    # We can check DB connectivity status here in the future
    db_configured = bool(os.getenv("DATABASE_URL"))
    
    return {
        "status": "healthy",
        "database_configured": db_configured,
        "service": "recommendation-service"
    }
