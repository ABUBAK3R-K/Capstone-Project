# PROJECT_SCOPE.md

## What CityGuide actually is

CityGuide is a community-curated city guide app with two purposes:

1. **Discovery** — let citizens find local businesses, shops, and public/religious places on a
   map, search for places, and see "similar places" recommendations for anywhere they view.
2. **Civic reporting** — let citizens report civic problems (potholes, garbage, broken street
   lights, water leakage, damaged roads) with a photo and an automatically captured GPS location,
   and let municipal authorities triage and resolve those reports through a dedicated dashboard.

A hard constraint on the whole project: **no paid third-party API**. Maps use OpenStreetMap-style
tiles, place data is bootstrapped from the OSM Overpass API, and every backend piece runs on a
free tier.

It is a four-person capstone project, split into four independently ownable pieces that share one
Postgres database as the single source of truth:

| Piece | Directory | What it owns |
|---|---|---|
| Mobile app | `/mobile` | The only user-facing surface — map, search, place detail, similar places, reporting |
| Backend & DB | `/supabase` | Schema, RLS (the actual security boundary), spatial RPCs, storage |
| Recommendation service | `/recommendation-service` | Computes "similar places" from content + interaction history |
| Admin dashboard | `/admin-dashboard` | Where authorities triage and resolve reports |

The mobile client was originally built in Flutter and was **rebuilt from scratch in React
Native + Expo**; the backend and the recommendation service were not touched by that rebuild.

## Explicitly out of scope

- **A city-wide "problems near you" feed.** RLS on `problem_reports` only exposes a row to the
  user who created it, unless their `profiles.role` is `authority`/`admin`. Surfacing other
  citizens' reports on a map or feed would require a new `SECURITY DEFINER` RPC that returns
  anonymised report locations — that RPC does not exist and is not planned. The mobile app does
  not show other users' reports anywhere; a signed-in user only ever sees their own report history
  (on the Profile screen, as status counts).
- Paid maps/geocoding APIs, push notifications, in-app messaging, multi-language support,
  iOS App Store / Play Store distribution — none of these were ever part of the plan.

## Done

**Backend (`/supabase`)** — the most complete piece.
- Full schema: `profiles`, `places`, `interactions`, `problem_reports`, with `geography(Point,4326)`
  locations and GiST spatial indexes.
- RLS on all four tables: `places` public-read/auth-insert; `problem_reports` owner-insert,
  owner-or-authority read, authority-only status update; `profiles.role` is not client-writable
  (closes a self-promotion privilege-escalation path); `interactions` are owner-scoped.
- `nearby_places(lat, lng, radius_meters, filter_category)` and `search_places(search_query, lat, lng)`
  RPCs — flat, typed, no raw PostGIS geometry returned.
- Storage bucket (`reports`) with public-read/authenticated-upload/owner-restricted-update policies.
- A trigger that auto-creates a `profiles` row on signup (closes the "no account can pass the role
  check" gap from earlier in the project).
- An OSM Overpass seeding script (`supabase/seed/seed_places.py`).

**Recommendation service (`/recommendation-service`)** — code-complete for both planned phases.
- Content-based similarity (TF-IDF over category/subcategory/description, fused with a Haversine
  geo-decay term) — works with zero user history, so the app is never cold.
- Collaborative filtering on implicit feedback (`view`/`favorite`/`visit` interactions, ALS with a
  TruncatedSVD fallback).
- A hybrid strategy that blends the two once a place has enough interactions, and falls back to
  pure content-based scoring otherwise — this is the strategy actually served in production, not
  a side experiment.
- All 5 planned endpoints (`/recommendations`, `/recommendations/refresh`, `/interactions`,
  `/interactions/stats`, `/health`) are implemented against the real database.

**Admin dashboard (`/admin-dashboard`)** — fully implemented.
- Supabase Auth login, followed by a real second server-side role check (not a client-trusted flag).
- Report map (Folium) plotting real report coordinates.
- Full status workflow — `reported` → `in_progress` → `fixed`, with `resolved_at` stamped on the
  `fixed` transition.

**Mobile app (`/mobile`)** — the React Native rebuild is functionally complete for the planned
feature set.
- Auth (sign in / sign up) via Supabase Auth, with real client-side error handling.
- Bottom-tab navigation: Home, Map, Report, Profile.
- Home: real nearby-categories, recently-added, and closest-to-you sections, all backed by
  `nearby_places`.
- Map: real markers from `nearby_places`, category filter chips, custom per-category marker icons.
- Place detail: full place info plus a "Similar places" row calling the recommendation service.
- Report flow: camera/gallery capture, GPS auto-tagged at capture time, upload to Supabase Storage
  with retry, insert into `problem_reports`.
- Profile: sign-out, a personal report-status summary (counts by `reported`/`in_progress`/`fixed`),
  and a connected-services panel showing whether the recommendation service and map tiles are
  configured.
- A cohesive design system (`src/design/`) — palette, type scale, spacing tokens, shared primitives
  — used consistently across every screen rather than default React Native styling.

**Fixed since the initial audit**
- `mobile/.env` now uses the correct `EXPO_PUBLIC_*` variable names, so the app no longer crashes
  at startup. Map tiles are still unconfigured (no token available) — see below.
- `GET /health` on the recommendation service now actually pings the database (`SELECT 1`) and
  returns 503 with `database_connected: false` on failure, instead of reporting healthy whenever
  `DATABASE_URL` was merely *set*.
- `evaluate.py` now trains only on the training split — `build_matrix()` on every strategy takes an
  optional `cutoff_time`, and the collaborative/hybrid strategies filter their `interactions` queries
  by it, so precision/recall numbers no longer include test-window data in training. Production
  callers (startup, `/recommendations/refresh`) are unaffected — they omit `cutoff_time`.
- The "problems near you" / "Your reports nearby" section has been removed from the mobile Home
  screen entirely (component and hook usage deleted), per an explicit decision to drop it from
  scope rather than build the city-wide RPC it would need.

## Left to do

**Environment / demo-readiness**
- `recommendation-service/.env` and `admin-dashboard/.env` now exist with the project's Supabase
  URL/anon key filled in, but **`DATABASE_URL` is still a placeholder** — both files need the real
  Supabase DB password (Project Settings → Database → Connection string) before either service can
  actually connect. This is the one remaining credential only the project owner has.
- `mobile/.env`'s `EXPO_PUBLIC_MAP_TILE_URL` is still blank — needs a free Mapbox or MapTiler token
  before the Map tab shows a basemap.
- Nothing is deployed anywhere yet. If a live demo needs to reach people off one LAN/laptop, the
  recommendation service and the mobile app's tile/API URLs need an actual deployment target.

**Mobile**
- `search_places` is implemented in the API layer but has no UI — there is currently no search bar
  anywhere in the app.

**Backend**
- `test_rls.sql` only covers `problem_reports` policies — the `profiles`/`interactions` RLS
  (the privilege-escalation fix) has no automated test coverage yet.
- The seed script has no de-duplication, so re-running it against an already-seeded database
  creates duplicate rows.

**Housekeeping**
- Leftover Flutter build artifacts under `/mobile` (`android/`, `ios/Flutter/`, `macos/`,
  `windows/`, `.dart_tool/`) are unused and should eventually be deleted; `macos/` and `windows/`
  are not yet in `.gitignore`.
- Several docs (`README.md`, `HOW_TO_RUN.md`, `supabase/API.md`, `recommendation-service/API.md`,
  `admin-dashboard/README.md`) still describe the old Flutter stack or an earlier state of the
  backend and need updating to match the current code.

**Not started**
- No automated tests for the mobile app or the recommendation service (only the partial
  `test_rls.sql` exists anywhere in the repo).
