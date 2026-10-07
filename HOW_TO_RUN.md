# How to Run CityGuide Locally

Four pieces, one shared database. Set up Supabase first; the other three only need its credentials.
To put it online instead, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). For what's finished and the
setup steps only the project owner can do (credentials, live database, deploy), see
[`PROJECT_STATUS.md`](PROJECT_STATUS.md).

| Component | Runtime |
| :-- | :-- |
| Recommendation service, admin dashboard | Python 3.10+ |
| Mobile app | Node.js 18+, plus Expo Go on a phone or an Android/iOS emulator |
| Database | A Supabase Cloud project (free) |

---

## 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com/).
2. In **SQL Editor**, run every file in [`supabase/migrations/`](supabase/migrations) **in order**,
   `001_initial_schema.sql` through `011_booking_cancellation.sql`. There is no single migrate
   command — run them one after another.
3. Run [`supabase/test_rls.sql`](supabase/test_rls.sql). It must end with `ALL RLS CHECKS PASSED`
   (it rolls itself back, so it leaves no data behind).
4. Give one account dashboard access. Sign up through the app (or **Authentication → Add user**), then:
   ```sql
   update profiles set role = 'authority'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
5. Optional — load real places from OpenStreetMap: [`supabase/seed/README.md`](supabase/seed/README.md).
6. Collect from **Project Settings**:
   - **API → Project URL** and **anon public key**
   - **API → service_role key** (dashboard document previews and the seed script only — never the app)
   - **Database → Connection string → Session pooler** → `DATABASE_URL`, with the password
     percent-encoded (see `recommendation-service/.env.example`)

### Already have a project with older migrations?

Don't re-run the old files. Apply only the ones you're missing, in order, then re-run the test suite.
For a project that stopped at `008_business_accounts.sql`, that is:

1. `009_business_hardening.sql`
2. `010_places_dedupe_and_search.sql`
3. `011_booking_cancellation.sql`
4. `test_rls.sql` → must end `ALL RLS CHECKS PASSED`

After `009`, audit approved businesses (`PROJECT_STATUS.md`, step 3), and make sure everyone runs
the updated mobile app. Older builds send a column `009` no longer accepts when a business answers
a booking.

---

## 2. Recommendation service (FastAPI)

```bash
cd recommendation-service
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_API_KEY
uvicorn main:app --reload --port 8000
```

- Swagger UI: <http://127.0.0.1:8000/docs>
- <http://127.0.0.1:8000/health> must report `"database_connected": true`.
- Rebuild the cache after seeding:
  `curl -X POST http://127.0.0.1:8000/recommendations/refresh -H "X-Admin-Key: <ADMIN_API_KEY>"`
  (it also rebuilds itself every `REFRESH_INTERVAL_MINUTES`).

### Offline evaluation

```bash
python scripts/generate_synthetic_interactions.py      # only if there's no real interaction history yet
python evaluate.py --compare                            # content vs collaborative vs hybrid
python scripts/generate_synthetic_interactions.py --purge
```

Results and how to read them: [`docs/EVALUATION.md`](docs/EVALUATION.md).

### Tests

```bash
pip install -r requirements-dev.txt
python -m pytest            # no database needed
```

---

## 3. Admin dashboard (Streamlit)

```bash
cd admin-dashboard
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY (+ optional keys)
streamlit run app.py              # http://localhost:8501
```

Sign in with the account promoted in step 1.4. Pages: **Civic Reports** (map + status workflow),
**Verify Businesses**, **Manage Businesses**.

`SKIP_AUTH=true` in `.env` bypasses the login for local development only.

---

## 4. Mobile app (React Native / Expo)

```bash
cd mobile
npm install
cp .env.example .env
npx expo start                    # a = Android emulator, i = iOS simulator, or scan the QR with Expo Go
```

Fill in `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` — **required**; the app refuses to start
  without them.
- `EXPO_PUBLIC_RECOMMENDATIONS_URL` — `http://10.0.2.2:8000` (Android emulator),
  `http://127.0.0.1:8000` (iOS simulator), or your machine's LAN IP (physical phone). Blank hides
  "Similar places".
- `EXPO_PUBLIC_MAP_TILE_URL` — a hosted OSM-style raster source (Mapbox / MapTiler free tier). **Not**
  `tile.openstreetmap.org`: `react-native-maps` blocks it on Android. Blank shows markers without a basemap.

After editing `.env`, restart with `npx expo start --clear` — the values are baked into the bundle.

`EXPO_PUBLIC_DEV_SKIP_AUTH=true` lets you browse without an account; reporting, adding places,
saving and booking stay disabled because they need a real signed-in user.

Checks:
```bash
npm test                              # unit tests (Jest)
npm run typecheck                     # tsc --noEmit
npx expo export --platform android    # the bundle actually builds
```

---

## Command summary

| Component | Directory | Start | URL |
| :-- | :-- | :-- | :-- |
| Recommendation service | `recommendation-service/` | `uvicorn main:app --reload --port 8000` | <http://127.0.0.1:8000> |
| Admin dashboard | `admin-dashboard/` | `streamlit run app.py` | <http://localhost:8501> |
| Mobile app | `mobile/` | `npx expo start` | Expo Go / emulator |
