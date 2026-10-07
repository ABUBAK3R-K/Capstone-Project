# Backend Database (/supabase)

Schema, Row Level Security, RPC functions, storage and seeding for the shared Postgres database.
Everything else in the repo reads and writes this one database.

## 🧑‍💻 Owner
* **Role:** Backend / Database Developer
* **Responsibilities:** migrations, RLS and column grants (the real security boundary), PostGIS
  indexes and RPCs, storage buckets, triggers, seeding.

## 🛠️ Tech Stack
* PostgreSQL + PostGIS (`geography(Point, 4326)`, GiST indexes)
* Supabase Auth (`profiles` provisioned by trigger), Supabase Storage, Row Level Security

## 📂 Contents

### `migrations/` — apply in order, `001` → `011`

| File | What it does |
| :-- | :-- |
| `001_initial_schema.sql` | `profiles`, `places`, `interactions`, `problem_reports`; PostGIS + GiST indexes |
| `002_rls_and_functions.sql` | RLS on `places` / `problem_reports`; first `nearby_places` |
| `003_storage_bucket.sql` | Public `reports` bucket for report photos |
| `004_api_hardening.sql` | `nearby_places` / `search_places` return flat `lat`/`lng` instead of raw geometry |
| `005_resolved_at.sql` | `problem_reports.resolved_at` for resolution-time analytics |
| `006_profile_provisioning.sql` | Trigger that creates a `profiles` row on signup (+ backfill) |
| `007_rls_profiles_interactions.sql` | RLS + column grants on `profiles` (role not self-writable) and `interactions` (append-only, own rows) |
| `008_business_accounts.sql` | `businesses`, `business_services`, `bookings`; approved businesses mirrored into `places`; private `business-verification` bucket |
| `009_business_hardening.sql` | Column grants so businesses can't self-approve and customers can't self-confirm; booking validation and status-transition triggers; contributions to `places` credited to their author; reports must start `reported` |
| `010_places_dedupe_and_search.sql` | `places.osm_id` (idempotent seeding) + merge of duplicate seed rows; `search_places` capped at 50 and matching category/type |
| `011_booking_cancellation.sql` | Customers can cancel their own bookings; role-aware status transitions |

**The column-lock rule** (learned the hard way in 008 → 009): to make a column read-only for
clients, `revoke all` on the table and `grant` back only the writable columns. A bare
`revoke update (col)` does nothing while Supabase's default table-level grant exists.

### `test_rls.sql`
A self-checking suite (55 checks) for RLS, column grants and triggers across `problem_reports`,
`profiles`, `interactions`, `businesses`, `bookings` and `places`. Run the whole file in the SQL
editor as `postgres` after the migrations: it raises `FAIL: …` on the first broken rule and ends with
`ALL RLS CHECKS PASSED`. Everything runs inside a transaction that is rolled back.

### `seed/`
OSM Overpass → `places` seeder. Idempotent (upserts on `osm_id`). See [`seed/README.md`](seed/README.md).

### `API.md`
The RPCs and table access the mobile app uses.
