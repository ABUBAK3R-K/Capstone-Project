# Agent Codebase Analysis

## Overview
This repository (`Capstone-Project`) is a monorepo for a community-curated city guide application called "CityGuide". It maps local businesses, shops, and public places, featuring a recommendation engine and a civic problem reporting system.

## Architecture & Components
The project is divided into four main components:

1. **Mobile Application (`/mobile`)**
   - **Stack:** Flutter (Dart) targeting Android.
   - **Key Tech:** OpenStreetMap via `flutter_map`, Supabase client.
   - **Role:** Main UI for users and authorities. Handles maps, problem reporting, and displaying recommendations.

2. **Recommendation Service (`/recommendation-service`)**
   - **Stack:** Python 3.10+, FastAPI, Uvicorn, SQLAlchemy/asyncpg.
   - **Role:** Microservice to compute "similar places" based on interaction history and location. Connects directly to the Supabase PostgreSQL database.

3. **Admin Dashboard (`/admin-dashboard`)**
   - **Stack:** Python, Streamlit, Pandas, Matplotlib/Seaborn, Supabase Python client.
   - **Role:** Web interface for authorities to review and update reported civic problems, with visualizations and maps.

4. **Database & Backend (`/supabase`)**
   - **Stack:** PostgreSQL with PostGIS extension, Supabase Auth, Supabase Storage.
   - **Role:** Central database storing user profiles, geographic data, and reported issues. Contains SQL migration scripts and helper setup queries.

## Shared Documentation (`/docs`)
Contains shared Product Requirements Document (PRD), API documentation, and architecture diagrams.

## Project Execution Map
- `/mobile`: Run via Flutter tools (`flutter run`).
- `/recommendation-service`: Run via Uvicorn (`uvicorn main:app --reload`).
- `/admin-dashboard`: Run via Streamlit (`streamlit run app.py`).
- `/supabase`: Manage via Supabase CLI or direct SQL execution against a hosted instance.
