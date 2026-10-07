# CityGuide — Community-Curated City Guide

A city guide app with three jobs:

1. **Discovery** — find local shops, parks, temples and services on a map, search them, and get
   "similar places" recommendations for anywhere you look. Anyone signed in can add a missing place.
2. **Civic reporting** — photograph a pothole, garbage, a broken street light, etc.; the GPS location
   is captured automatically, and municipal authorities triage it on a web dashboard.
3. **Local business** — businesses register, get verified by an admin, list their services, and take
   appointment bookings and orders from customers.

A four-person capstone project, built entirely on free tiers and open data — no paid APIs.

---

## Tech stack

| Piece | Directory | Stack |
| :-- | :-- | :-- |
| Mobile app | [`/mobile`](./mobile) | React Native + Expo (managed), TypeScript, TanStack Query, `react-native-maps` |
| Recommendation service | [`/recommendation-service`](./recommendation-service) | Python 3.10+, FastAPI, scikit-learn (TF-IDF), `implicit` (ALS) |
| Admin dashboard | [`/admin-dashboard`](./admin-dashboard) | Python, Streamlit, Folium |
| Backend | [`/supabase`](./supabase) | Supabase: PostgreSQL + PostGIS, Auth, Storage, Row Level Security |

The mobile client was rebuilt from Flutter to React Native; the backend and recommendation service
were unaffected. Place data is bootstrapped from the OpenStreetMap Overpass API.

## How it fits together

```
 mobile app ──(supabase-js: RPCs + RLS-gated tables)──► Supabase Postgres ◄──(psycopg2)── admin dashboard
     │                                                        ▲
     └──(HTTP: GET /recommendations)──► recommendation service ┘ (SQLAlchemy, builds similarity matrix)
```

Postgres is the single source of truth. **Row Level Security is the authorization boundary** — the
anon key ships in the app by design, so every table is protected server-side (`supabase/migrations/`,
verified by `supabase/test_rls.sql`).

The recommender is a hybrid: content similarity (TF-IDF over category/type/description, fused with
geographic proximity) for every place from day one, blended with collaborative filtering (implicit
ALS over view/save/visit history) once a place has enough interactions.

## Repository layout and owners

| Folder | Owner | What's in it |
| :-- | :-- | :-- |
| [`/mobile`](./mobile) | Mobile developer | Map, search, place detail, similar places, add-a-place, reporting, bookings, business owner screens |
| [`/recommendation-service`](./recommendation-service) | Recommendation engineer | Strategies, API, offline evaluation, synthetic data generator |
| [`/admin-dashboard`](./admin-dashboard) | Admin / web developer | Report triage, business verification and management |
| [`/supabase`](./supabase) | Backend / database developer | Migrations `001`–`011`, RLS test suite, OSM seed script |
| [`/docs`](./docs) | Everyone | Methodology, evaluation results, deployment guide |

## Getting started

- **Run it locally:** [`HOW_TO_RUN.md`](./HOW_TO_RUN.md)
- **Deploy it (free tier):** [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- **Scope:** [`PROJECT_SCOPE.md`](./PROJECT_SCOPE.md) · **Status + your to-do list:** [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)

## Tests

| Piece | Command | |
| :-- | :-- | :-- |
| Database (RLS, grants, triggers) | run `supabase/test_rls.sql` in the SQL editor | must end `ALL RLS CHECKS PASSED` |
| Recommendation service | `cd recommendation-service && pip install -r requirements-dev.txt && python -m pytest` | |
| Admin dashboard | `cd admin-dashboard && python -m pytest tests` | |
| Mobile | `cd mobile && npm test && npm run typecheck` | |
