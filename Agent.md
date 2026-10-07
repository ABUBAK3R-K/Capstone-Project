# Agent Codebase Analysis

## Overview
This repository (`Capstone-Project`) is a monorepo for "CityGuide", a community-curated city guide:
a map of local places with search and "similar places" recommendations, community-added places, a
photo + GPS civic problem-reporting flow, and local-business listings with bookings.

The detailed, maintained guide for agents is [`CLAUDE.md`](CLAUDE.md); this file is a short summary.

## Architecture & Components

1. **Mobile Application (`/mobile`)**
   - **Stack:** React Native + Expo (managed workflow), TypeScript. Rebuilt from an earlier Flutter
     client; Flutter build leftovers are not used.
   - **Key Tech:** `@supabase/supabase-js`, TanStack Query, `react-native-maps` with hosted
     OSM-style tiles.
   - **Role:** The only user-facing app — customer screens and business-owner screens.

2. **Recommendation Service (`/recommendation-service`)**
   - **Stack:** Python 3.10+, FastAPI, SQLAlchemy + psycopg2, scikit-learn, `implicit`.
   - **Role:** Hybrid content + collaborative "similar places", offline evaluation.

3. **Admin Dashboard (`/admin-dashboard`)**
   - **Stack:** Python, Streamlit, psycopg2, Folium, Supabase Auth.
   - **Role:** Authority report triage; business verification and management.

4. **Database & Backend (`/supabase`)**
   - **Stack:** PostgreSQL + PostGIS, Supabase Auth, Supabase Storage.
   - **Role:** Single source of truth. Migrations `001`–`011`; RLS + column grants are the security
     boundary, verified by `test_rls.sql`.

## Shared Documentation (`/docs`)
Methodology (`PROPOSED_METHODOLOGY.md`), evaluation results (`EVALUATION.md`), deployment
(`DEPLOYMENT.md`), and architecture-diagram prompts.

## Project Execution Map
- `/mobile`: `npx expo start` (tests: `npm test`, `npm run typecheck`).
- `/recommendation-service`: `uvicorn main:app --reload` (tests: `python -m pytest`).
- `/admin-dashboard`: `streamlit run app.py` (tests: `python -m pytest tests`).
- `/supabase`: apply `migrations/` in order in the Supabase SQL editor; then run `test_rls.sql`.
