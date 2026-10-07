# Project Status

What has been built and verified, and what the project owner still has to do by hand.
Last updated: 2026-10-07.

- **Scope and requirements:** [`PROJECT_SCOPE.md`](PROJECT_SCOPE.md)
- **Running it locally:** [`HOW_TO_RUN.md`](HOW_TO_RUN.md)
- **Putting it online:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## Part 1 — Completed

### Phase 1 — Security fixes

| Fix | Where |
| :-- | :-- |
| Businesses can no longer approve themselves (column grants on `businesses`) | `supabase/migrations/009_business_hardening.sql` |
| Customers can't create pre-confirmed bookings; owners can only change `status`, along valid transitions | `009` |
| A booking must use a service of that business, the business must be approved, appointments must be in the future | `009` (trigger) |
| Rejecting a business with view history no longer fails (`interactions → places` cascades) | `009` |
| Community places must be credited to their author as `user_added`, with a server-generated id | `009` |
| New civic reports must start as `reported` | `009` |
| Stored XSS in the dashboard map popups fixed; only `http(s)` photo links rendered | `admin-dashboard/lib/html_safety.py` |
| `POST /interactions` takes the user from a verified Supabase token, not the request body | `recommendation-service/security.py` |
| `POST /recommendations/refresh` requires `X-Admin-Key` | `security.py` |
| Dashboard flags verification documents from another business's folder | `pages/1_Verify_Businesses.py` |
| Dashboard rolls back its shared DB connection after a failed write | `app.py`, `pages/` |

### Phase 2 — Features from the PRD

| Feature | Where |
| :-- | :-- |
| **Search screen** (search bar on Home; nearest matches first; "add it" when nothing matches) | `mobile/src/features/search/` |
| **Add a place** (community curation, located by GPS) | `mobile/src/features/place/AddPlaceScreen.tsx` |
| **Save / "I've been here"** buttons feeding the collaborative model | `PlaceDetailScreen.tsx`, `lib/interactions.ts` |
| Interactions written straight to Supabase under RLS (recorded even if the service is down) | `mobile/src/lib/interactions.ts` |
| **Idempotent seeding** (`osm_id` + upsert) and merge of earlier duplicate seed rows | `010_places_dedupe_and_search.sql`, `supabase/seed/seed_places.py` |
| `search_places` capped at 50 results, also matches category/type | `010` |
| **Recommendations refresh** every 30 min, and immediately when a business is approved | `recommendation-service/main.py`, `admin-dashboard/lib/recommendations.py` |
| A new place shows "no similar places yet" instead of an error | `mobile/src/lib/recommendations.ts` |
| **Customers can cancel bookings**; status rules depend on who is changing them | `011_booking_cancellation.sql`, `MyBookingsScreen.tsx` |
| Deleting a booked service hides it instead of failing | `mobile/src/lib/businesses.ts` |

### Phase 3 — Evaluation and deployment

| Item | Where |
| :-- | :-- |
| Synthetic interaction generator (reproducible, `--purge` to remove) | `recommendation-service/scripts/generate_synthetic_interactions.py` |
| `evaluate.py --compare`: content vs collaborative vs hybrid on one temporal split | `recommendation-service/evaluate.py` |
| Reference evaluation results and findings | `docs/EVALUATION.md` |
| Docker image + Render blueprint for the recommendation service | `recommendation-service/Dockerfile`, `render.yaml` |
| EAS profile for an installable Android APK | `mobile/eas.json` |
| Step-by-step free-tier deployment guide | `docs/DEPLOYMENT.md` |

### Phase 4 — Tests, docs, cleanup

| Item | Result |
| :-- | :-- |
| Database: `supabase/test_rls.sql` | 55 self-checking assertions — all pass on migrations 001–011 |
| Recommendation service: `python -m pytest` | 66 tests pass, 92% coverage of source |
| Admin dashboard: `python -m pytest tests` | 15 tests pass |
| Mobile: `npm test` | 64 tests pass, 98% line coverage of `src/lib/` |
| Mobile: `npm run typecheck`, `npx expo export --platform android` | clean / bundle builds |
| Docs rewritten for React Native + migrations 001–011 | README, HOW_TO_RUN, PROJECT_SCOPE, methodology (+ new §11 Local Business), every component README, API docs, CLAUDE.md |
| Old Flutter build leftovers deleted and git-ignored | `mobile/` |

### Bugs found by the end-to-end runs (fixed, each with a regression test)

| Bug | Impact before the fix |
| :-- | :-- |
| ALS matrix passed to `implicit` transposed | Hybrid crashed (more places than users) or blended *user* similarity into place recommendations |
| SQLAlchemy 2.1 changed the default Postgres driver | A fresh `pip install` — including the Render build — crashed at startup |
| Shared `last_scoring_path` and non-atomic cache swap | Concurrent requests could get the wrong scoring path or a mismatched matrix row |
| `formatDistance` floating-point rounding | 950 m displayed as "0.9 km" |

### How it was verified — and the limit of that

Everything above was run locally against **PGlite** (real Postgres compiled to WebAssembly) with all
11 migrations applied, Supabase's `auth`/`storage` schemas and default grants recreated, and PostGIS
replaced by small stubs. That covered the SQL suite, an end-to-end evaluation run through the real
psycopg2/SQLAlchemy code, and the real Streamlit dashboard pages (including approving a business
through the UI).

**Not yet verified:** the real Supabase project, real PostGIS distance queries, the storage-bucket
policies, and the mobile screens on a device (they typecheck and bundle, but haven't been tapped
through). Your checklist below starts with closing those gaps.

---

## Part 2 — Things you need to do yourself

These need your accounts, credentials or judgment. The code side of each is ready.

### 1. Commit the work (5 min)
Phase 1 is committed. Phases 2–4 are uncommitted in the working tree — review with `git status` and
commit (or ask Claude to split it into logical commits).

### 2. Update the live database (10 min)
If your Supabase project already has `001`–`008` applied, run **only** these, in order, in the
**SQL Editor**:

1. `supabase/migrations/009_business_hardening.sql`
2. `supabase/migrations/010_places_dedupe_and_search.sql`
3. `supabase/migrations/011_booking_cancellation.sql`

Then run `supabase/test_rls.sql`. It must end with **`ALL RLS CHECKS PASSED`**. If it prints
`FAIL: …`, that line names the rule that's wrong — stop and fix it before going further.

### 3. Audit existing approved businesses (5 min)
Before `009`, any business could approve itself, and nothing recorded who approved what. Run:

```sql
select id, name, owner_id, created_at from businesses where verification_status = 'approved';
```

Compare the list with the approvals your admins actually made. For any that weren't:
`update businesses set verification_status = 'pending' where id = '…';`

### 4. Fill in credentials (15 min)
From Supabase **Project Settings**:

| Value | Where to find it | Goes into |
| :-- | :-- | :-- |
| Project URL | API | `mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL`), `recommendation-service/.env` and `admin-dashboard/.env` (`SUPABASE_URL`) |
| anon public key | API | `mobile/.env` (`EXPO_PUBLIC_SUPABASE_ANON_KEY`), both Python `.env` files (`SUPABASE_ANON_KEY`) |
| service_role key | API | `admin-dashboard/.env` (`SUPABASE_SERVICE_ROLE_KEY`) and `supabase/seed/.env` only — **never the app** |
| Session pooler connection string | Database → Connection string | `DATABASE_URL` in both Python `.env` files. Percent-encode the password (command in `recommendation-service/.env.example`) |

You also need:

- **`ADMIN_API_KEY`.** Generate it with `python -c "import secrets; print(secrets.token_urlsafe(32))"`, then put the **same value** in `recommendation-service/.env` and `admin-dashboard/.env`.
- **Map tiles.** Make a free MapTiler or Mapbox account, then set `EXPO_PUBLIC_MAP_TILE_URL` in `mobile/.env` (example URLs are in `mobile/.env.example`).
- **`RECOMMENDATIONS_URL` in `admin-dashboard/.env`.** Use `http://127.0.0.1:8000` locally, or the Render URL after step 7.

Restart Expo with `npx expo start --clear` after editing `mobile/.env`.

### 5. Ship the mobile app together with `009`
After `009`, the database refuses the old app's booking-status update (it sent `responded_at`).
Make sure everyone running the app is on the new code before businesses start accepting bookings.

### 6. Smoke-test on a real phone (20 min)
Using Expo Go, with a normal account and a business account:

- [ ] Sign up, open a place: "Similar places" loads; **Save** and **I've been here** stick after reopening
- [ ] Search for something that exists, then something that doesn't → **Add** it → it opens and shows on the map
- [ ] File a report with a photo → it appears on the dashboard map
- [ ] Business account: create listing → approve it on the dashboard → it appears in search
- [ ] Book it as a customer → accept as the business → cancel a second booking as the customer

### 7. Deploy (45–60 min)
Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md):

1. **Recommendation service on Render.** Use **New → Blueprint** and paste in the same credentials as step 4.
2. **Admin dashboard on Streamlit Community Cloud.** Paste the values into its secrets.
3. **Mobile app.** For a live demo, run `npx expo start --tunnel`. For an installable APK, run `eas build --profile preview` after setting the `eas env` values.

Afterwards, open `https://<service>.onrender.com/health`. It must show `"database_connected": true`.

### 8. Seed or refresh places (optional, 5 min)
In `supabase/seed/`, set the bounding box in `seed_places.py` and run it. It's safe to re-run now.

### 9. Run the evaluation for the report (15 min)
In `recommendation-service/`:

```bash
python scripts/generate_synthetic_interactions.py     # skip once real users exist
python evaluate.py --compare
python scripts/generate_synthetic_interactions.py --purge
```

Put the table in the report. Label synthetic-data numbers as a pipeline validation, not real-world
accuracy (see `docs/EVALUATION.md`).

### 10. Decide: recommender settings
The evaluation suggests the documented settings are not optimal:

- **Latent factors.** 50 overfits on small data; 16 factors with regularization 0.1 did ~2× better.
- **Blend weight.** The 50/50 hybrid blend gives most of the collaborative gain back.

These are stated design decisions in your methodology, so they were **left unchanged**. Either keep them and discuss the finding in the report, or change them in `recommendation-service/main.py` and `evaluate.py` and update §5 of `docs/PROPOSED_METHODOLOGY.md`. Re-run step 9 either way.

### 11. Report and diagram
- Regenerate the architecture diagram from `docs/ARCHITECTURE_DIAGRAM_PROMPT.md` (now includes business accounts).
- `docs/PROPOSED_METHODOLOGY.md` has a new **§11 Local Business Methodology** and updated §3, §4, §7, §8, §9 and §10. Carry these into the written report.
