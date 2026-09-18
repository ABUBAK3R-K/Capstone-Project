# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CityGuide — a community-curated city guide app: map of local places, a "similar places" recommendation
engine, and a photo+GPS civic problem-reporting flow that authorities triage. Four-part monorepo, one
directory per workstream:

| Directory | Stack | Role |
|---|---|---|
| `/mobile` | React Native + Expo (managed), TypeScript | User-facing app |
| `/recommendation-service` | Python 3.10+, FastAPI | "Similar places" microservice |
| `/admin-dashboard` | Python, Streamlit | Authority triage UI |
| `/supabase` | PostgreSQL + PostGIS, SQL migrations | Single source of truth for all three above |

**The mobile client was rebuilt from Flutter to React Native; the backend (Supabase schema/RPCs and the
FastAPI service) did not change.** Root `README.md`, `admin-dashboard/README.md`, `supabase/README.md`,
and `docs/PROPOSED_METHODOLOGY.md` still describe the old Flutter stack and an older migration count —
treat `mobile/README.md`, `mobile/replacing_flutter.md`, and the actual SQL/Python source as current
truth over those docs. Flutter build artifacts (`mobile/android/`, `mobile/ios/Flutter/`, `mobile/macos/`,
`mobile/windows/`, `mobile/.dart_tool/`, `.flutter-plugins-dependencies`) are dead leftovers from the old
client — do not resurrect or reference them. Note `mobile/macos/` and `mobile/windows/` are **not** in
`.gitignore`, unlike `android/`/`ios/`; don't `git add -A` inside `mobile/` without checking status first.

## Commands

### Mobile (`/mobile`)
```bash
npm install
cp .env.example .env        # fill in EXPO_PUBLIC_* values, see below
npx expo start               # press a / i, or scan QR with Expo Go — no expo prebuild needed
npm run typecheck            # tsc --noEmit
npx expo export --platform android   # verify the bundle actually builds
```
After editing `.env`, restart with `npx expo start --clear` — values are inlined at build time, not read at runtime.

### Recommendation service (`/recommendation-service`)
```bash
python -m venv .venv && .venv\Scripts\activate     # Windows; source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env         # set DATABASE_URL to a Supabase pooler connection string
uvicorn main:app --reload --port 8000     # Swagger at /docs
```
Evaluate the model offline: `python evaluate.py` (temporal 80/20 split, precision/recall@5/10, catalog coverage — see gotcha below).

### Admin dashboard (`/admin-dashboard`)
```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env         # SUPABASE_URL, SUPABASE_KEY, DATABASE_URL, SKIP_AUTH
streamlit run app.py         # http://localhost:8501
```

### Supabase (`/supabase`)
Apply `migrations/001_initial_schema.sql` through `007_rls_profiles_interactions.sql` **in order** against
a Supabase Cloud project's SQL editor, or locally via `supabase start && supabase db reset`. There is no
single "run migrations" command in this repo — apply the numbered files sequentially.

Seed real place data (optional, requires the Overpass API and a service-role key):
```bash
cd supabase/seed
pip install -r requirements.txt
cp .env.example .env
python seed_places.py
```

There is no test runner across the repo. `supabase/test_rls.sql` is a manual SQL script (run it directly
against the DB, e.g. via `psql` or the Supabase SQL editor) that exercises `problem_reports` RLS policies;
it does not cover the `profiles`/`interactions` policies added in migration `007`.

## Architecture

### Data flow and ownership
Supabase Postgres is the single source of truth. The mobile app and the recommendation service both
connect to it directly — the mobile app through `@supabase/supabase-js` (RPCs + RLS-gated table access),
the recommendation service through SQLAlchemy/psycopg2 with a service-level connection. There is no sync
layer between them. The admin dashboard also reads/writes the same `problem_reports` table directly via
psycopg2, independent of the FastAPI service.

The mobile app never issues raw SQL or reads PostGIS geometry directly for places — it calls two RPCs
defined in `supabase/migrations/004_api_hardening.sql`:
- `nearby_places(lat, lng, radius_meters, filter_category)` — flat, distance-ordered rows, `location`
  already unpacked to `lat`/`lng`.
- `search_places(search_query, lat, lng)` — note the parameter is `search_query`, not `query`.

`problem_reports`, by contrast, is read via **direct table access** (not an RPC), so its `location` column
comes back as raw hex EWKB over PostgREST; `mobile/src/lib/geo.ts` (`parsePostgisPoint`) decodes it
client-side rather than adding a migration to unpack it server-side.

### Security model
RLS is the actual authorization boundary — not client-side checks. Key policies, mostly in
`002_rls_and_functions.sql`, `006_profile_provisioning.sql`, `007_rls_profiles_interactions.sql`:
- `places`: public read, authenticated insert.
- `problem_reports`: insert requires `user_id = auth.uid()`; a regular user can only *read their own*
  reports (this is why the mobile Home screen is titled "Your reports nearby," not a city-wide feed —
  city-wide visibility would need a new `SECURITY DEFINER` RPC, deliberately not added); `authority`/`admin`
  roles can read all reports and are the only roles that can update status.
- `profiles.role` is **not** client-writable (column-level `REVOKE`, migration `007`) — this closes a real
  self-promotion privilege-escalation path where a user could otherwise `UPDATE profiles SET role='admin'`.
  A `SECURITY DEFINER` trigger (`006`) auto-creates a `profiles` row on signup.
- Both the mobile app and the admin dashboard implement a **dev-only auth bypass** for local development
  without seeded accounts: `EXPO_PUBLIC_DEV_SKIP_AUTH` (mobile) and `SKIP_AUTH` (admin-dashboard). Under
  the mobile bypass, reporting/interactions stay disabled since those inserts require a real `auth.uid()`.
  The admin dashboard's role check is still server-side (a second psycopg2 query against `profiles.role`)
  even outside the bypass path — never trust a client-supplied role.

### Recommendation service — Strategy pattern
`recommendation-service/recommendation/` implements an abstract `RecommendationStrategy.build_matrix(db) ->
(place_ids, similarity_matrix)` (`strategy.py`), with three concrete strategies composed at runtime by
`RecommendationService` (`service.py`):
- **Content** (`strategy.py`): TF-IDF over `category`+`subcategory`+`description`, fused 0.7/0.3 with a
  Haversine geo-decay similarity (`exp(-dist_km/2.0)`), diagonal forced to `-1.0` so a place never
  recommends itself. Needs zero interaction history — this is the cold-start baseline.
- **Collaborative** (`collaborative.py`): implicit ALS (`implicit.als`, 50 factors) over weighted
  `visit`/`favorite`/`view` interactions, falling back to `TruncatedSVD` if the `implicit` package isn't
  importable; a guard clause returns an empty matrix below 2 distinct users/places.
- **Hybrid** (`collaborative.py`, `HybridStrategy`) — the strategy actually wired into `main.py`. Per
  place, it blends content+collaborative scores (β=0.5) only if that place has ≥5 recorded interactions
  (`COLD_START_THRESHOLD`); otherwise it falls back to pure content scores. The chosen path (`blended` vs
  `content_only`) is returned in the API response and logged — this is the mechanism for auditing how far
  the system has moved out of cold start for a given place.

The full similarity matrix is computed once at FastAPI `lifespan` startup and rebuilt on demand via
`POST /recommendations/refresh` (e.g. after reseeding) — it is not recomputed per-request.

`GET /health` actually pings the database (`SELECT 1` against the engine) and returns 503 with
`database_connected: false` if it can't connect — a set-but-wrong `DATABASE_URL` no longer reports
healthy while `/recommendations` silently 404s from an empty cache.

`evaluate.py` trains only on the training split: `build_matrix` on every strategy takes an optional
`cutoff_time`, and `CollaborativeFilteringStrategy`/`HybridStrategy` filter their `interactions` queries
by it (`recommendation/collaborative.py`). Production callers (`main.py`'s startup/`/refresh`) omit
`cutoff_time`, so this doesn't change served behavior — it only affects the offline evaluation.

### Mobile app structure
```
src/
├── design/          # visual identity: tokens.ts (palette/spacing/type), typography.tsx, primitives
├── features/         # one folder per screen area: auth, home, map, place, report, profile
├── lib/              # supabase client, env loading, RPC wrappers, recommendations fetch, geo decode
├── navigation/        # root stack + bottom tabs (Home, Map, Report, Profile)
└── providers/         # AuthProvider (Supabase session), LocationProvider
```
`design/` is intentionally separate from `features/` — every screen composes the same primitives so
spacing/color stay consistent by construction. No feature file should contain a raw hex value or pixel
margin; add missing tokens to `design/tokens.ts` instead.

All config is `EXPO_PUBLIC_*`-prefixed and inlined at build time by `mobile/src/lib/env.ts`, which throws
at module-load time (during `App.tsx` bootstrap, before any UI renders) if `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY` are missing — there is no error boundary, so a misconfigured `.env` is a
hard crash, not a degraded UI. `EXPO_PUBLIC_RECOMMENDATIONS_URL` and `EXPO_PUBLIC_MAP_TILE_URL` are
optional and degrade cleanly (no "Similar places" section; markers with no basemap, respectively).

**Map tiles**: never point `EXPO_PUBLIC_MAP_TILE_URL` at `tile.openstreetmap.org` — `react-native-maps`
blocks OSM's own tile servers on Android specifically (silent failure, works fine on iOS). Use a hosted
OSM-style raster source (Mapbox/MapTiler free tier). `react-native-maps` was chosen over
`@maplibre/maplibre-react-native` for Expo Go compatibility (no custom dev client needed) and because
`<Marker>` renders JSX, which is how the per-category animated markers in
`features/map/components/CategoryMarker.tsx` are built.

Reaching the FastAPI service from a device during development: `http://10.0.2.2:8000` (Android emulator),
`http://127.0.0.1:8000` (iOS simulator), or your machine's LAN IP (physical device) — none of these work
unmodified for a demo off a single dev machine or a deployed environment.
