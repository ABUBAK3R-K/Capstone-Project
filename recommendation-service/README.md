# Recommendation Microservice (/recommendation-service)

This directory contains the Python FastAPI microservice responsible for generating "similar places" recommendations. It connects directly to the Supabase PostgreSQL database to compute recommendations based on user interactions and geographic locations.

## 🧑‍💻 Owner
* **Role:** Recommendation Engineer (User)
* **Responsibilities:** Setting up the FastAPI microservice, establishing a connection to PostgreSQL (via SQLAlchemy or asyncpg), implementing recommendation logic (collaborative filtering, content-based, or geofenced popularity), and providing API endpoints for the Flutter mobile app.

## 🛠️ Tech Stack
* **Language:** Python 3.10+
* **Framework:** FastAPI
* **WebServer:** Uvicorn
* **Database Driver:** SQLAlchemy / asyncpg / psycopg2 (connecting directly to Supabase Postgres)

## 🚀 Running Locally

1. **Navigate to directory:**
   ```bash
   cd recommendation-service
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Setup Environment Variables:**
   ```bash
   cp .env.example .env
   # Open .env and fill in your Supabase connection credentials
   ```

5. **Start the server:**
   ```bash
   uvicorn main:app --reload
   ```
   The service will be available at `http://127.0.0.1:8000` (docs available at `/docs`).
