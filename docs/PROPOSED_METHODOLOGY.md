# Proposed Methodology — CityGuide

> Community-Curated City Guide with a Hybrid Place-Recommendation Engine
> and a Photo-Based Civic Problem Reporting Workflow

---

## 1. Overview of the Proposed Approach

The proposed system, **CityGuide**, is developed as a four-module monorepo in which a
Flutter mobile client, a Python recommendation microservice, a Streamlit authority
dashboard and a Supabase (PostgreSQL + PostGIS) backend are built and integrated
incrementally. The methodology is deliberately **phase-wise and evidence-driven**: the
recommender begins as a purely content-and-proximity model that works from day one with
zero user history, and is then progressively upgraded to a hybrid model as implicit
interaction data accumulates, with an automatic cold-start fallback guaranteeing that
recommendation quality never degrades below the Phase-1 baseline.

Two functional pillars are addressed:

1. **Discovery** — helping citizens find local businesses, shops and public/religious
   places, and surfacing *similar places* for any place they view.
2. **Civic participation** — allowing citizens to report civic problems (potholes,
   garbage, street lights, water leakage, damaged roads) with a photograph and an
   automatically captured GPS coordinate, and allowing municipal authorities to triage
   and resolve those reports through a dedicated dashboard.

A guiding non-functional constraint is that **no paid third-party API is used**. Maps are
rendered from OpenStreetMap tiles through `flutter_map`, place data is bootstrapped from
the OSM Overpass API, and all backend services run on free-tier or open-source stacks.

---

## 2. System Development Methodology

An **incremental-iterative (Agile) model** is adopted, organised into milestones, with the
monorepo partitioned by role so that four team members can work in parallel against
contract-first interfaces.

| Module | Directory | Technology | Responsibility |
| :-- | :-- | :-- | :-- |
| Mobile Client | `/mobile` | Flutter (Dart), `flutter_map`, `supabase_flutter`, `geolocator`, `image_picker` | Maps, search, place detail, similar-places, report capture |
| Recommendation Service | `/recommendation-service` | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, scikit-learn, SciPy, `implicit` | Similarity computation, interaction logging, offline evaluation |
| Admin Dashboard | `/admin-dashboard` | Streamlit, Pandas, psycopg2, Folium | Authority login, report triage, geospatial overview |
| Backend & Database | `/supabase` | PostgreSQL + PostGIS, Supabase Auth, Supabase Storage | Schema, RLS policies, RPC functions, storage, seeding |

Interfaces are frozen before implementation: the database contract is expressed as
versioned SQL migrations (`001_initial_schema.sql` → `005_resolved_at.sql`), and the
service contract is expressed as a documented REST surface (`recommendation-service/API.md`)
consumed by the mobile client. This allows module owners to develop and test
independently and integrate at milestone boundaries.

---

## 3. Proposed System Architecture

The system follows a **four-tier layered architecture**:

**(a) Presentation Tier — Flutter Android client.**
Authentication is handled by `supabase_flutter`; an `AuthWrapper` gates the application
between the auth screen and the main navigation shell. Map, home, place-detail, report and
profile screens are composed over a `PlacesService` (Supabase RPC) and direct HTTP calls to
the recommendation microservice.

**(b) Intelligence Tier — FastAPI recommendation microservice.**
A stateless HTTP service that owns the similarity model. It exposes
`POST /interactions`, `GET /recommendations`, `POST /recommendations/refresh`,
`GET /interactions/stats` and `GET /health`, and maintains an in-memory similarity cache
that is pre-populated during the FastAPI `lifespan` startup hook.

**(c) Data Tier — Supabase.**
PostgreSQL with the PostGIS extension stores `profiles`, `places`, `interactions` and
`problem_reports`. Locations are stored as `geography(Point, 4326)` and accelerated by GiST
spatial indexes (`places_location_idx`, `reports_location_idx`). Supabase Auth issues JWTs,
and a public `reports` storage bucket holds evidence photographs.

**(d) Administration Tier — Streamlit dashboard.**
A role-gated web interface for authorities, reading `problem_reports` over psycopg2 and
rendering a Folium marker map plus per-report action controls.

Both the intelligence tier and the administration tier connect to the *same* PostgreSQL
instance the mobile client reaches through Supabase, so the database is the single source
of truth and no data synchronisation layer is required.

---

## 4. Data Acquisition and Preparation

1. **Bootstrapping the place catalogue.** `supabase/seed/seed_places.py` issues an
   Overpass QL query against the OSM Overpass API for a supplied bounding box, retrieving
   `shop`, `amenity=place_of_worship`, `amenity=hospital`, `amenity=police`, `leisure=park`
   and `tourism` nodes.
2. **Cleaning and normalisation.** Unnamed nodes are discarded, and raw OSM tags are mapped
   onto the project's own `category` / `subcategory` taxonomy.
3. **Loading.** Records are inserted into `places` through the Supabase service-role client;
   the service-role key is confined to this offline seeding script and never ships in the
   mobile binary.
4. **Community curation.** Authenticated users may contribute additional places, marked by
   the `source` column, so the catalogue grows beyond the OSM import.
5. **Implicit feedback collection.** Every time a user opens a place-detail screen, the
   client posts a `view` interaction; `favorite` and `visit` events provide stronger
   signals. These rows form the training corpus of the collaborative model.

---

## 5. Recommendation Methodology

### 5.1 Strategy-Pattern Design

The engine is built around an abstract `RecommendationStrategy` interface exposing a single
operation, `build_matrix(db) → (place_ids, similarity_matrix)`. Every algorithm — content,
collaborative and hybrid — implements this interface, and `RecommendationService` is
constructed with a strategy injected at runtime. This makes algorithms interchangeable
without modifying the service, the API layer or the client, and makes each algorithm
independently testable — the central design decision that enables the phase-wise plan.

### 5.2 Phase 1 — Content-and-Proximity Similarity

For each place, a textual document is formed by concatenating `category`, `subcategory` and
`description`. The corpus is vectorised with **TF-IDF** (English stop-words removed) and a
pairwise **cosine similarity** matrix `S_text` is computed.

In parallel, latitude/longitude pairs are extracted from PostGIS via `ST_Y`/`ST_X`, converted
to radians, and a pairwise **Haversine** distance matrix `D` (in kilometres) is computed.
Distance is converted into a bounded similarity by an **exponential decay**:

    S_geo(i, j) = exp( − D(i, j) / τ ),    τ = 2.0 km

so that co-located places score ≈ 1.0 and places one decay-length apart score ≈ 0.37.

The two signals are linearly fused:

    S_content = w_text · S_text + w_geo · S_geo,    w_text = 0.7,  w_geo = 0.3

The diagonal is set to −1.0 so that a place is never returned as its own recommendation.
This strategy requires **no user history**, which is what allows the product to launch
against a cold catalogue.

### 5.3 Phase 2 — Collaborative Filtering on Implicit Feedback

Interactions are aggregated per `(user, place, type)` and converted to confidence weights
that reflect the strength of intent:

| Interaction | Weight | Rationale |
| :-- | :-- | :-- |
| `visit` | 3.0 | Strongest — the user physically went there |
| `favorite` | 2.0 | Deliberate, conscious action |
| `view` | 1.0 | Passive / exploratory, weakest signal |

A sparse **CSR user–item matrix** is assembled from `count × weight`. It is factorised with
**Alternating Least Squares for implicit feedback** (`implicit.als`, 50 latent factors, 15
iterations, regularisation 0.01, fixed random seed 42 for reproducibility). Where the
`implicit` library is unavailable, the pipeline degrades gracefully to **Truncated SVD**
with an automatically clamped component count. Item–item **cosine similarity** over the
learned item factors yields `S_collab`. A guard clause aborts the strategy when fewer than
two distinct users or places exist, returning an empty matrix rather than an unstable model.

### 5.4 Hybrid Fusion with Cold-Start Fallback

The `HybridStrategy` composes the two strategies. For every place *i* it decides a
**scoring path**:

- If *i* appears in the collaborative matrix **and** has at least
  `COLD_START_THRESHOLD = 5` recorded interactions, its row is fused as

      S_final(i, j) = β · S_content(i, j) + (1 − β) · S_collab(i, j),   β = 0.5

  with negative scores clamped to zero to prevent diagonal leakage from contaminating
  off-diagonal cells; the path is recorded as **`blended`**.
- Otherwise the row is left as its pure content-based scores and the path is recorded as
  **`content_only`**.

Because the content matrix covers the *entire* catalogue while the collaborative matrix
covers only interacted-with places, this per-place decision guarantees complete coverage:
a new place is always recommendable, and quality can only improve as interaction volume
grows. The chosen path is returned in the API response and written to the service log for
every request, making the system's behaviour auditable rather than opaque.

### 5.5 Precomputation, Caching and Serving

Similarity computation is an offline O(N²) operation; online serving must be interactive.
The full matrix is therefore built **once at service startup** (FastAPI `lifespan` hook) and
rebuilt on demand through `POST /recommendations/refresh` after new places are seeded. At
query time the service performs an O(1) dictionary lookup of the place's row index, an
`argsort` to select the top-N scores, and a single SQL round-trip to **hydrate** the returned
identifiers into complete place records (name, category, coordinates, address, images) so the
client never receives raw PostGIS geometry or has to issue follow-up queries.

---

## 6. Civic Problem Reporting Methodology

The reporting flow is designed to minimise user effort and maximise data reliability:

1. The user captures a photograph with the camera (or selects one from the gallery),
   compressed to 70% quality to control upload size.
2. **GPS coordinates are captured automatically the moment the photo is taken**, after
   explicit location-service and permission checks — the location is never typed by hand.
3. The user selects a category from a controlled vocabulary (Pothole, Garbage, Street Light,
   Water Leakage, Damaged Road, Other) and adds an optional description.
4. The image is uploaded to the Supabase `reports` storage bucket, and a `problem_reports`
   row is inserted with the returned public URL and a `geography(Point, 4326)` location.
   Upload failures are surfaced in the UI with a retry path rather than being silently
   swallowed.
5. Authorities triage each report on the Streamlit dashboard, advancing it through the
   lifecycle **`reported` → `in_progress` → `fixed`**; the transition to `fixed` stamps
   `resolved_at = NOW()`, enabling resolution-time analytics.

---

## 7. Security and Access-Control Methodology

Security is enforced **at the database**, not in client code, so that it cannot be bypassed
by a modified or reverse-engineered application:

- **Row Level Security** is enabled on `places` and `problem_reports`.
- `places` are publicly readable but insertable only by authenticated users.
- A user may insert a report only with `user_id = auth.uid()`, and may read only their own
  reports; users holding the `authority` or `admin` role may read all reports.
- **Only** `authority` / `admin` roles may update a report's status.
- Storage policies permit public read of report images, authenticated upload, and
  owner-restricted update/delete.
- The mobile client never issues ad-hoc SQL; it calls hardened **PostGIS RPC functions**
  (`nearby_places`, `search_places`) that return a flat, explicitly typed projection with
  latitude and longitude already unpacked — a narrow, auditable API surface.
- The Streamlit dashboard authenticates through Supabase Auth and then performs a second,
  server-side role verification against `profiles` before rendering any data.

---

## 8. Evaluation Methodology

The recommender is validated offline by `recommendation-service/evaluate.py`:

- **Temporal 80/20 split.** Interactions are ordered by `created_at`; the oldest 80% form
  the training set and the most recent 20% the test set. A time-based split (rather than a
  random one) avoids look-ahead leakage and mirrors real deployment, where the model can
  only ever learn from the past.
- **Protocol.** Only users present in both splits are evaluated. For each place a user
  interacted with during training, the top-K recommendations are generated and compared
  against the places that user actually interacted with in the test window.
- **Metrics.**
  - *Precision@K* and *Recall@K* for K = 5 and K = 10 — accuracy of the ranked list.
  - *Catalog Coverage* — the percentage of catalogue places that appear in any
    recommendation list, quantifying popularity bias and the long-tail reach of the engine.
  - *Scoring-path distribution* — the proportion of queries served by the `blended` versus
    `content_only` path, which measures how far the system has progressed out of cold start.
- **Operational monitoring.** `GET /interactions/stats` reports total interactions, unique
  users, unique places and the count of `collab_ready` places (≥ 5 interactions), providing
  a live readiness signal for the collaborative phase.

---

## 9. Phase-Wise Implementation Plan

| Phase | Objective | Key Deliverables |
| :-- | :-- | :-- |
| **P0 — Foundation** | Schema, auth, RLS, storage, OSM seeding | Migrations 001–003, `seed_places.py` |
| **P1 — Discovery + Content Recommender** | Map, search, place detail, TF-IDF + Haversine engine | `nearby_places` RPC, `ContentProximityStrategy` |
| **P2 — Civic Reporting** | Photo + GPS capture, upload, authority triage | `ReportScreen`, Streamlit dashboard, migration 005 |
| **P3 — Hybrid Recommender** | Implicit-feedback ALS, hybrid fusion, cold-start fallback | `CollaborativeFilteringStrategy`, `HybridStrategy` |
| **P4 — Hardening + Evaluation** | Flat RPC projections, structured logging, offline metrics | Migration 004, `evaluate.py`, scoring-path logging |

---

## 10. Tools and Technologies (Tech Stack)

### 10.1 Summary by Tier

| Tier | Technology | Justification |
| :-- | :-- | :-- |
| Presentation | Flutter 3.x / Dart 3.x (Android target) | Single codebase, native-compiled performance, rich widget set |
| Mapping | OpenStreetMap tiles via `flutter_map` | Open data, **no API key and no billing** |
| Intelligence | Python 3.10+, FastAPI, Uvicorn | Async REST, automatic OpenAPI/Swagger, mature ML ecosystem |
| Machine Learning | scikit-learn, SciPy, NumPy, `implicit` | TF-IDF, cosine/Haversine, sparse matrices, implicit-feedback ALS |
| Data Access | SQLAlchemy 2.x, psycopg2 | Session-scoped ORM/Core access to Supabase Postgres |
| Data | PostgreSQL + PostGIS | Native `geography` types, GiST indexes, distance operators |
| BaaS | Supabase — Auth, Storage, RPC, RLS | Managed JWT auth and policy-level security on a free tier |
| Administration | Streamlit, Pandas, Folium | Rapid, data-centric internal tooling with map rendering |
| Ingestion | OSM Overpass API, `requests` | Free bulk source of real place data |
| Version control | Git monorepo | Role-partitioned parallel development |

### 10.2 Module-Level Dependency Manifest

**Mobile Client — `/mobile` (`pubspec.yaml`, Dart SDK ≥ 3.0.0)**

| Package | Version | Purpose |
| :-- | :-- | :-- |
| `supabase_flutter` | ^2.5.0 | Auth, database access, storage uploads, RPC calls |
| `flutter_map` | ^6.1.0 | OpenStreetMap tile rendering and markers |
| `latlong2` | ^0.9.0 | Coordinate primitives for the map layer |
| `geolocator` | ^11.0.0 | GPS acquisition and permission handling |
| `image_picker` | ^1.2.3 | Camera / gallery capture for report photos |
| `http` | ^1.6.0 | REST calls to the recommendation microservice |
| `provider` | ^6.1.2 | State management and dependency injection |
| `flutter_dotenv` | ^5.1.0 | Secure loading of Supabase keys from `.env` |
| `flutter_lints` | ^3.0.0 | Static analysis (dev) |

**Recommendation Service — `/recommendation-service` (`requirements.txt`, Python ≥ 3.10)**

| Package | Version | Purpose |
| :-- | :-- | :-- |
| `fastapi` | ≥ 0.100.0 | REST framework, lifespan hooks, dependency injection |
| `uvicorn[standard]` | ≥ 0.22.0 | ASGI server |
| `pydantic` | ≥ 2.0.0 | Request/response schema validation |
| `sqlalchemy` | ≥ 2.0.0 | Database engine, sessions, parameterised SQL |
| `psycopg2-binary` | ≥ 2.9.6 | PostgreSQL driver |
| `scikit-learn` | ≥ 1.3.0 | TF-IDF vectoriser, cosine similarity, Haversine distances, Truncated SVD |
| `numpy` | ≥ 1.24.0 | Similarity matrix algebra and top-N `argsort` |
| `scipy` | ≥ 1.11.0 | Sparse CSR user–item matrix |
| `implicit` | ≥ 0.7.0 | Alternating Least Squares for implicit feedback |
| `python-dotenv` | ≥ 1.0.0 | Environment configuration |

**Admin Dashboard — `/admin-dashboard` (`requirements.txt`, Python ≥ 3.10)**

| Package | Version | Purpose |
| :-- | :-- | :-- |
| `streamlit` | ≥ 1.31.0 | Web UI, session state, caching (`cache_data` / `cache_resource`) |
| `pandas` | ≥ 2.2.0 | Report tabulation, filtering, status metrics |
| `folium` + `streamlit-folium` | ≥ 0.15.1 / ≥ 0.18.0 | Interactive status-coloured marker map |
| `psycopg2-binary` | ≥ 2.9.9 | Direct PostgreSQL reads and status updates |
| `supabase` | ≥ 2.3.4 | Authority login through Supabase Auth |
| `python-dotenv` | ≥ 1.0.1 | Environment configuration |

**Backend — `/supabase`**

PostgreSQL with the `postgis` and `pgcrypto` extensions; Supabase Auth, Supabase Storage
(`reports` bucket), Row Level Security policies, SQL RPC functions (`nearby_places`,
`search_places`), five versioned migrations, and a Python seeding script
(`supabase`, `requests`, `python-dotenv`).

### 10.3 Runtime Endpoints

| Service | Command | Default endpoint |
| :-- | :-- | :-- |
| Recommendation Service | `uvicorn main:app --reload --port 8000` | `http://127.0.0.1:8000` (Swagger at `/docs`) |
| Admin Dashboard | `streamlit run app.py` | `http://localhost:8501` |
| Mobile Client | `flutter run` | Android device / emulator (`10.0.2.2:8000` for host loopback) |
| Supabase (local) | `supabase start` | `http://127.0.0.1:54321` |
