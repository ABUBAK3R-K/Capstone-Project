# PROJECT_SCOPE.md

## What CityGuide actually is

CityGuide is a community-curated city guide app with three purposes:

1. **Discovery** — let citizens find local businesses, shops, and public/religious places on a map,
   search for places, add places that are missing, and see "similar places" recommendations for
   anywhere they view.
2. **Civic reporting** — let citizens report civic problems (potholes, garbage, broken street lights,
   water leakage, damaged roads) with a photo and an automatically captured GPS location, and let
   municipal authorities triage and resolve those reports through a dedicated dashboard.
3. **Local business** — let businesses register, be verified by an admin, list their services, and
   receive appointment bookings and orders from customers.

A hard constraint on the whole project: **no paid third-party API**. Maps use OpenStreetMap-style
tiles, place data is bootstrapped from the OSM Overpass API, and every backend piece runs on a
free tier.

It is a four-person capstone project, split into four independently ownable pieces that share one
Postgres database as the single source of truth:

| Piece | Directory | What it owns |
|---|---|---|
| Mobile app | `/mobile` | Both user-facing surfaces — customer (map, search, place detail, similar places, add a place, reporting, bookings) and business owner (listing, services, incoming bookings) |
| Backend & DB | `/supabase` | Schema, RLS (the actual security boundary), spatial RPCs, storage, triggers |
| Recommendation service | `/recommendation-service` | Computes "similar places" from content + interaction history; offline evaluation |
| Admin dashboard | `/admin-dashboard` | Report triage; business verification and management |

The mobile client was originally built in Flutter and was **rebuilt from scratch in React
Native + Expo**; the backend and the recommendation service were not touched by that rebuild.

## Explicitly out of scope

- **A city-wide "problems near you" feed.** RLS on `problem_reports` only exposes a row to the
  user who created it, unless their `profiles.role` is `authority`/`admin`. Surfacing other
  citizens' reports would require a new `SECURITY DEFINER` RPC returning anonymised report
  locations — not planned. A signed-in user only ever sees their own report history (on the
  Profile screen, as status counts).
- **Payments.** Bookings and orders are requests the business accepts or declines; no money moves
  through the app.
- Paid maps/geocoding APIs, push notifications, in-app messaging, multi-language support,
  iOS App Store / Play Store distribution.

## Done

**Backend (`/supabase`)** — migrations `001`–`011`.
- Schema: `profiles`, `places`, `interactions`, `problem_reports`, `businesses`,
  `business_services`, `bookings`, with `geography(Point,4326)` locations and GiST indexes.
- RLS **and column grants** on every client-reachable table. Locked columns: `profiles.role` /
  `account_type`, `businesses.verification_status` / `owner_id`, `bookings` (clients write only
  `status`), `places.id` / `osm_id`. New reports must start `reported`; community places must be
  credited to their author as `user_added`.
- Triggers: profile provisioning on signup; approved businesses mirrored into `places`; booking
  validation (service belongs to the business, business approved, appointment in the future);
  role-aware booking transitions (owner: accept/decline/complete; customer: cancel).
- `nearby_places` and `search_places` RPCs (search capped at 50, matches category/type too).
- Storage: public `reports` bucket; private `business-verification` bucket.
- Idempotent OSM seeding (`osm_id` + upsert; earlier duplicates merged by migration `010`).
- `test_rls.sql`: 55 self-checking assertions across all of the above.

**Recommendation service (`/recommendation-service`)**
- Content (TF-IDF + geo-decay), collaborative (implicit ALS, SVD fallback) and the served hybrid
  with per-place cold-start fallback and an auditable scoring path.
- Similarity cache swapped atomically; rebuilt at startup, periodically
  (`REFRESH_INTERVAL_MINUTES`), on admin-key-protected `/recommendations/refresh`, and after
  business approvals from the dashboard.
- `POST /interactions` attributes writes to the verified Supabase token's user.
- Offline evaluation with a three-way strategy comparison, plus a reproducible synthetic
  interaction generator for pre-launch evaluation (`docs/EVALUATION.md`).
- Docker image + Render blueprint.
- pytest suite (66 tests, ~92% coverage), no database required.

**Admin dashboard (`/admin-dashboard`)**
- Supabase Auth login with a server-side role check.
- Report triage: status metrics, filters, Folium map (all citizen-written fields escaped), status
  workflow `reported` → `in_progress` → `fixed` with `resolved_at`.
- Business verification (documents via signed URLs, borrowed-document warning) and management.

**Mobile app (`/mobile`)**
- Auth with customer/business account types and separate navigators.
- Home, Map (category filters, custom markers), **Search**, Place detail with Similar places,
  **Save / "I've been here"** (feeding the collaborative model), **Add a place**.
- Report flow: camera/gallery, GPS at capture, upload with retry.
- Bookings and orders, **customer cancellation**; business dashboard, services, incoming bookings.
- Design system in `src/design/` used across every screen.
- Jest unit tests for the data layer (64 tests, ~98% line coverage of `src/lib/`).

**Docs** — `README.md`, `HOW_TO_RUN.md`, `docs/DEPLOYMENT.md`, `docs/EVALUATION.md`, and each
piece's README describe the current React Native stack and migrations `001`–`011`.

## Left to do

These need the project owner's accounts or credentials — the code side is ready for each. Each one,
step by step with exact commands, is in [`PROJECT_STATUS.md`](PROJECT_STATUS.md) (Part 2).

- **Apply migrations `009`–`011`** to the live Supabase project, then run `test_rls.sql`
  (must end `ALL RLS CHECKS PASSED`).
- **Audit existing approved businesses.** Before `009`, a business could approve itself; there is
  no audit trail, so compare `select … from businesses where verification_status = 'approved'`
  against the approvals admins actually made.
- **Fill credentials:** real `DATABASE_URL` in `recommendation-service/.env` and
  `admin-dashboard/.env`; `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `ADMIN_API_KEY` in the service's
  `.env`; a free Mapbox/MapTiler tile URL in `mobile/.env`.
- **Ship the updated mobile app together with `009`.** Older builds send a column `009` no longer
  accepts when a business answers a booking.
- **Smoke-test on a real phone.** The screens typecheck and bundle but haven't been tapped through on
  a device.
- **Deploy** per `docs/DEPLOYMENT.md` (Render, Streamlit Community Cloud, Expo Go or an EAS APK).
- **Run the evaluation on the real catalogue** (`docs/EVALUATION.md` → Reproducing) and put the
  numbers in the report.
- **Decide on recommender settings.** The evaluation found 50 ALS factors and the 50/50 blend
  underperform smaller/tuned settings; they were left as documented pending this decision.
- **Re-seed** with the new idempotent seed script if the catalogue should be refreshed.
- **Commit** the Phase 2–4 work (Phase 1 is committed).
