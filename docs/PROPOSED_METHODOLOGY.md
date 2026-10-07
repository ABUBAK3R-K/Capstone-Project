# Proposed Methodology — CityGuide

> Community-Curated City Guide with a Hybrid Place-Recommendation Engine
> and a Photo-Based Civic Problem Reporting Workflow

---

## 1. Overview of the Proposed Approach

The proposed system, **CityGuide**, is developed as a four-module monorepo in which a
React Native (Expo) mobile client, a Python recommendation microservice, a Streamlit authority
dashboard and a Supabase (PostgreSQL + PostGIS) backend are built and integrated
incrementally. The methodology is deliberately **phase-wise and evidence-driven**: the
recommender begins as a purely content-and-proximity model that works from day one with
zero user history, and is then progressively upgraded to a hybrid model as implicit
interaction data accumulates, with an automatic cold-start fallback guaranteeing that
recommendation quality never degrades below the Phase-1 baseline.

Three functional pillars are addressed:

1. **Discovery** — helping citizens find local businesses, shops and public/religious
   places, and surfacing *similar places* for any place they view.
2. **Civic participation** — allowing citizens to report civic problems (potholes,
   garbage, street lights, water leakage, damaged roads) with a photograph and an
   automatically captured GPS coordinate, and allowing municipal authorities to triage
   and resolve those reports through a dedicated dashboard.
3. **Local business** — allowing businesses to register, be verified by an administrator,
   publish their services, and accept appointment bookings and orders from citizens (§11).

A guiding non-functional constraint is that **no paid third-party API is used**. Maps are
rendered from hosted OpenStreetMap-style raster tiles through `react-native-maps`, place
data is bootstrapped from
the OSM Overpass API, and all backend services run on free-tier or open-source stacks.

---

## 2. System Development Methodology

An **incremental-iterative (Agile) model** is adopted, organised into milestones, with the
monorepo partitioned by role so that four team members can work in parallel against
contract-first interfaces.

| Module | Directory | Technology | Responsibility |
| :-- | :-- | :-- | :-- |
| Mobile Client | `/mobile` | React Native + Expo (TypeScript), `react-native-maps`, `@supabase/supabase-js`, TanStack Query, `expo-location`, `expo-image-picker` | Maps, search, place detail, similar-places, add-a-place, report capture, bookings, business owner screens |
| Recommendation Service | `/recommendation-service` | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy, scikit-learn, SciPy, `implicit` | Similarity computation, interaction logging, offline evaluation |
| Admin Dashboard | `/admin-dashboard` | Streamlit, Pandas, psycopg2, Folium | Authority login, report triage, geospatial overview, business verification |
| Backend & Database | `/supabase` | PostgreSQL + PostGIS, Supabase Auth, Supabase Storage | Schema, RLS policies, RPC functions, storage, seeding |

Interfaces are frozen before implementation: the database contract is expressed as
versioned SQL migrations (`001_initial_schema.sql` → `011_booking_cancellation.sql`), and the
service contract is expressed as a documented REST surface (`recommendation-service/API.md`)
consumed by the mobile client. This allows module owners to develop and test
independently and integrate at milestone boundaries.

---

## 3. Proposed System Architecture

The system follows a **four-tier layered architecture**:

**(a) Presentation Tier — React Native (Expo) client.**
The client was originally prototyped in Flutter and rebuilt in React Native with the Expo
managed workflow, so it runs in Expo Go with no native build step; the other three tiers were
unaffected. An `AuthProvider` holds the Supabase session and the user's `account_type`, and
the root navigator routes customers and business owners to separate tab sets. Screens are
composed over a typed data layer (`src/lib/`: Supabase RPCs and RLS-gated table access) with
TanStack Query caching, plus HTTP calls to the recommendation microservice, and share one
design system (`src/design/`).

**(b) Intelligence Tier — FastAPI recommendation microservice.**
A stateless HTTP service that owns the similarity model. It exposes
`POST /interactions`, `GET /recommendations`, `POST /recommendations/refresh`,
`GET /interactions/stats` and `GET /health`, and maintains an in-memory similarity cache
that is pre-populated during the FastAPI `lifespan` startup hook.

**(c) Data Tier — Supabase.**
PostgreSQL with the PostGIS extension stores `profiles`, `places`, `interactions`,
`problem_reports`, `businesses`, `business_services` and `bookings`. Locations are stored as `geography(Point, 4326)` and accelerated by GiST
spatial indexes (`places_location_idx`, `reports_location_idx`). Supabase Auth issues JWTs,
and a public `reports` storage bucket holds evidence photographs.

**(d) Administration Tier — Streamlit dashboard.**
A role-gated web interface for authorities, reading `problem_reports` over psycopg2 and
rendering a Folium marker map plus per-report action controls, and for administrators,
reviewing and approving business registrations.

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
3. **Loading.** Records are upserted into `places` through the Supabase service-role client,
   keyed on each element's OSM identity (`osm_id`), so re-running the seeder refreshes rather
   than duplicates the catalogue. The service-role key is confined to this offline script and
   never ships in the mobile binary.
4. **Community curation.** Signed-in users add missing places from the app ("Add a place"),
   located by their current GPS fix. The database credits each contribution to its author and
   marks it `source = 'user_added'`, so contributions are distinguishable from imported and
   verified-business entries.
5. **Implicit feedback collection.** Opening a place-detail screen records a `view`; the
   **Save** and **"I've been here"** actions record `favorite` and `visit`, the stronger
   signals. The client writes these directly to the `interactions` table under RLS, so
   feedback is captured even if the recommendation service is unavailable. These rows form the
   training corpus of the collaborative model.

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
The full matrix is therefore built **once at service startup** (FastAPI `lifespan` hook),
rebuilt periodically in the background, and on demand through an admin-key-protected
`POST /recommendations/refresh` (triggered automatically when a business is approved). Each
build is swapped in as a single immutable snapshot, so concurrent requests never observe a
half-updated cache. At
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

- **Row Level Security** is enabled on every client-reachable table.
- **Column-level grants** complement RLS: a row policy decides *which rows* a user may write,
  grants decide *which columns*. Privilege-bearing columns — `profiles.role`,
  `businesses.verification_status`, every `bookings` column except `status` — are not
  client-writable at all. (Revoking a single column is ineffective while the role holds a
  table-wide grant, so each table's grants are revoked and the writable columns granted back.)
- `places` are publicly readable; a signed-in user may add a place only as its credited author,
  with `source = 'user_added'` and a server-generated id.
- A user may insert a report only with `user_id = auth.uid()` and `status = 'reported'`, and may
  read only their own reports; users holding the `authority` or `admin` role may read all reports.
- **Only** `authority` / `admin` roles may update a report's status.
- **Interactions** may be inserted only as oneself, read only by oneself, and are append-only.
- **Business data:** only approved listings are public; only administrators can approve; booking
  inserts are validated by trigger (the service must belong to the business, the business must
  be approved, an appointment must be in the future), and status changes follow role-specific
  transitions (§11).
- Storage policies permit public read of report images, authenticated upload, and
  owner-restricted update/delete; business verification documents live in a private bucket.
- The mobile client never issues ad-hoc SQL; it calls hardened **PostGIS RPC functions**
  (`nearby_places`, `search_places`) that return a flat, explicitly typed projection with
  latitude and longitude already unpacked — a narrow, auditable API surface.
- The Streamlit dashboard authenticates through Supabase Auth and then performs a second,
  server-side role verification against `profiles` before rendering any data. Citizen-written
  fields rendered as HTML (map popups) are escaped.
- The recommendation service connects with a privileged database role, so its write endpoint
  verifies the caller's Supabase access token and takes the user identity from the token, never
  from the request body.
- These rules are verified by a self-checking SQL suite (`supabase/test_rls.sql`) that attempts
  each forbidden action as an ordinary client and asserts it is refused.

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
- **Ablation.** `evaluate.py --compare` scores the content-only, collaborative-only and hybrid
  strategies on the identical split with production hyperparameters, isolating what each
  component contributes.
- **Pre-launch data.** Before real usage exists, a seeded, documented synthetic generator
  (`scripts/generate_synthetic_interactions.py`) produces a reproducible interaction history
  (users with category/proximity preferences and shared taste groups). Results on it validate
  the pipeline and compare strategies; they are not claims of real-world accuracy.
- **Operational monitoring.** `GET /interactions/stats` reports total interactions, unique
  users, unique places and the count of `collab_ready` places (≥ 5 interactions), providing
  a live readiness signal for the collaborative phase.

Results of the reference run, and the findings drawn from them, are in `docs/EVALUATION.md`.

---

## 9. Phase-Wise Implementation Plan

| Phase | Objective | Key Deliverables |
| :-- | :-- | :-- |
| **P0 — Foundation** | Schema, auth, RLS, storage, OSM seeding | Migrations 001–003, `seed_places.py` |
| **P1 — Discovery + Content Recommender** | Map, search, place detail, TF-IDF + Haversine engine | `nearby_places` RPC, `ContentProximityStrategy` |
| **P2 — Civic Reporting** | Photo + GPS capture, upload, authority triage | `ReportScreen`, Streamlit dashboard, migration 005 |
| **P3 — Hybrid Recommender** | Implicit-feedback ALS, hybrid fusion, cold-start fallback | `CollaborativeFilteringStrategy`, `HybridStrategy` |
| **P4 — Hardening + Evaluation** | Flat RPC projections, structured logging, offline metrics | Migration 004, `evaluate.py`, scoring-path logging |
| **P5 — Client rebuild** | Rebuild the client in React Native / Expo on the unchanged backend | `/mobile` rewrite, migrations 006–007 (profile provisioning, RLS on profiles/interactions) |
| **P6 — Local Business** | Business accounts, verification, services, bookings | Migrations 008, 011; business screens; dashboard verification pages |
| **P7 — Security + Quality** | Column grants, booking validation, search, community curation, tests, deployment | Migrations 009–010, `test_rls.sql`, pytest/Jest suites, `docs/DEPLOYMENT.md` |

---

## 10. Tools and Technologies (Tech Stack)

### 10.1 Summary by Tier

| Tier | Technology | Justification |
| :-- | :-- | :-- |
| Presentation | React Native 0.76 + Expo SDK 52, TypeScript | One codebase for Android and iOS; runs in Expo Go with no native build |
| Mapping | OpenStreetMap-style raster tiles via `react-native-maps` | Open data; JSX markers; free-tier hosted tiles |
| Intelligence | Python 3.10+, FastAPI, Uvicorn | Async REST, automatic OpenAPI/Swagger, mature ML ecosystem |
| Machine Learning | scikit-learn, SciPy, NumPy, `implicit` | TF-IDF, cosine/Haversine, sparse matrices, implicit-feedback ALS |
| Data Access | SQLAlchemy 2.x, psycopg2 | Session-scoped ORM/Core access to Supabase Postgres |
| Data | PostgreSQL + PostGIS | Native `geography` types, GiST indexes, distance operators |
| BaaS | Supabase — Auth, Storage, RPC, RLS | Managed JWT auth and policy-level security on a free tier |
| Administration | Streamlit, Pandas, Folium | Rapid, data-centric internal tooling with map rendering |
| Ingestion | OSM Overpass API, `requests` | Free bulk source of real place data |
| Version control | Git monorepo | Role-partitioned parallel development |

### 10.2 Module-Level Dependency Manifest

**Mobile Client — `/mobile` (`package.json`, Expo SDK 52)**

| Package | Version | Purpose |
| :-- | :-- | :-- |
| `expo` | ~52.0 | Managed workflow, build tooling, Expo Go compatibility |
| `react-native` | 0.76 | UI runtime (New Architecture enabled) |
| `@supabase/supabase-js` | ^2.48 | Auth, RPC calls, table access, storage uploads |
| `@tanstack/react-query` | ^5.66 | Server-state caching, retries, optimistic updates |
| `@react-navigation/*` | ^7 | Native stack + bottom tabs |
| `react-native-maps` | 1.18 | Map view, raster tile overlay, JSX markers |
| `expo-location` | ~18.0 | GPS acquisition and permission handling |
| `expo-image-picker` | ~16.0 | Camera / gallery capture for report photos |
| `react-native-reanimated` | ~3.16 | UI-thread animations |
| `jest-expo` + `jest` | ~52.0 / ~29.7 | Unit tests (dev) |
| `typescript` | ^5.3 | Static typing (dev) |

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
| `pytest`, `httpx` | ≥ 8.0 / ≥ 0.27 | Test suite and API test client (dev, `requirements-dev.txt`) |

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
(`reports` and `business-verification` buckets), Row Level Security policies and column
grants, SQL RPC functions (`nearby_places`, `search_places`), triggers, eleven versioned
migrations, a self-checking RLS test suite, and a Python seeding script
(`supabase`, `requests`, `python-dotenv`).

### 10.3 Runtime Endpoints

| Service | Command | Default endpoint |
| :-- | :-- | :-- |
| Recommendation Service | `uvicorn main:app --reload --port 8000` | `http://127.0.0.1:8000` (Swagger at `/docs`) |
| Admin Dashboard | `streamlit run app.py` | `http://localhost:8501` |
| Mobile Client | `npx expo start` | Expo Go / Android emulator (`10.0.2.2:8000` for host loopback) |
| Supabase (local) | `supabase start` | `http://127.0.0.1:54321` |

---

## 11. Local Business Methodology

A third pillar extends the catalogue from public data to businesses that manage their own
presence, without weakening the trust model of the first two.

1. **Registration.** A user signs up with `account_type = 'business'` (fixed at signup, not
   client-writable afterwards) and creates one listing — name, category, location, contact
   details — which starts as `pending`. Verification documents are uploaded to a private
   storage bucket under the business's own folder.
2. **Verification.** An administrator reviews pending listings and their documents on the
   dashboard (via short-lived signed URLs) and approves or rejects them. Approval is an
   administrative act only: the listing owner can edit their details but can never set the
   verification status, enforced by column grants rather than by the client.
3. **Publication.** A database trigger mirrors every approved listing into `places` under the
   same identifier, so approved businesses appear in map, search and recommendations with no
   change to the RPCs or the recommender; rejection removes the mirrored row (and its
   interaction history). The dashboard then triggers a recommendation-cache rebuild.
4. **Services and bookings.** Owners publish services of two kinds — `appointment` (with a
   requested time) and `order` (with a quantity; several lines grouped into one order). A
   booking insert is validated by trigger: the service must belong to the business, be active,
   and the business must be approved; appointments must be in the future; the service type is
   snapshotted from the service rather than trusted from the client; and every booking starts
   `pending`.
5. **Lifecycle.** Status changes are role-specific and enforced in the database:

   | Actor | Allowed transitions |
   | :-- | :-- |
   | Business owner | `pending → confirmed`, `pending → declined`, `confirmed → completed` |
   | Customer | `pending → cancelled`, `confirmed → cancelled` |

   The owner's first response stamps `responded_at`, mirroring `resolved_at` on civic
   reports. With no push notifications in scope, customers see responses by polling.
