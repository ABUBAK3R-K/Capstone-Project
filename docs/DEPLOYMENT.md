# Deploying CityGuide

Everything here runs on a free tier. Order matters: the database first, then the two Python services,
then the mobile app (which needs the services' URLs baked in at build time).

| Piece | Where | Cost | Config in this repo |
|---|---|---|---|
| Database, auth, storage | Supabase Cloud | free | `supabase/migrations/` |
| Recommendation service | Render (Docker web service) | free | `render.yaml`, `recommendation-service/Dockerfile` |
| Admin dashboard | Streamlit Community Cloud | free | `admin-dashboard/requirements.txt` |
| Mobile app | Expo Go (demo) or EAS Build APK | free | `mobile/eas.json` |

---

## 1. Supabase

1. Create a project, then in **SQL Editor** run every file in `supabase/migrations/`, **in order**
   (`001_…` through `011_…`).
2. Run `supabase/test_rls.sql` in the same editor. It must end with `ALL RLS CHECKS PASSED`; any
   `FAIL: …` names the policy that is wrong. It rolls itself back, so it is safe on a live project.
3. Edit the email at the bottom of `006_profile_provisioning.sql` (or run the `update profiles set
   role = 'authority' …` statement yourself) so at least one account can sign in to the dashboard.
4. Seed places (optional): `supabase/seed/README.md`.
5. Collect, from **Project Settings**:
   - **API → Project URL** and **anon public key** → mobile app, recommendation service, dashboard.
   - **API → service_role key** → dashboard (document previews) and the seed script only. Never the app.
   - **Database → Connection string → Session pooler** → `DATABASE_URL` for both Python services.
     Percent-encode the password (`recommendation-service/.env.example` shows how).

## 2. Recommendation service → Render

1. Push the repo to GitHub. In Render: **New → Blueprint**, select the repo. `render.yaml` defines the
   service.
2. Fill the prompted values: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. `ADMIN_API_KEY` is
   generated for you — copy it from the service's **Environment** tab for step 3.
3. Wait for the deploy, then open `https://<service>.onrender.com/health`. It must say
   `"database_connected": true`; a 503 means `DATABASE_URL` is wrong.

Notes:
- **Free instances sleep after ~15 minutes idle** and take ~30–60 s to wake. Open `/health` a minute
  before a demo. While it's waking, the app's "Similar places" row shows its retry state; nothing else
  in the app depends on the service.
- **Memory.** The similarity cache is an N×N float32 matrix (a few copies exist briefly during a
  rebuild). ~2,000 places is comfortably inside the free 512 MB; beyond ~5,000, use a paid instance or
  seed a smaller bounding box.
- The service rebuilds its cache every `REFRESH_INTERVAL_MINUTES` (30 by default), so new community
  places and approved businesses pick up recommendations without manual action.

## 3. Admin dashboard → Streamlit Community Cloud

1. <https://share.streamlit.io> → **Create app** → this repo, branch `main`, main file
   `admin-dashboard/app.py`. Under **Advanced settings** pick Python 3.11.
2. **Secrets** (TOML — Streamlit exposes top-level keys as environment variables, which is what the
   dashboard reads):

   ```toml
   DATABASE_URL = "postgresql://postgres.<ref>:<encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   SUPABASE_URL = "https://<ref>.supabase.co"
   SUPABASE_ANON_KEY = "<anon key>"
   SUPABASE_SERVICE_ROLE_KEY = "<service_role key>"
   RECOMMENDATIONS_URL = "https://<service>.onrender.com"
   ADMIN_API_KEY = "<the key Render generated>"
   SKIP_AUTH = "false"
   ```

   Never set `SKIP_AUTH = "true"` on a public deployment — it removes the login.
3. Sign in with the account you promoted to `authority` in step 1.3.

## 4. Mobile app

The app reads `EXPO_PUBLIC_*` values at **build/bundle time**, so they must point at the deployed
services before you start or build it.

### Option A — Expo Go (fastest for a live demo)

```bash
cd mobile
# .env: EXPO_PUBLIC_RECOMMENDATIONS_URL=https://<service>.onrender.com, plus Supabase URL/key and tile URL
npx expo start --clear --tunnel
```

`--tunnel` makes the dev server reachable from phones on any network, not only your Wi-Fi. Audience
members install **Expo Go** and scan the QR code. Your laptop must stay on with the dev server running.

### Option B — Installable Android APK (no laptop needed)

```bash
npm install -g eas-cli
cd mobile
eas login
eas init                       # links the project to your Expo account (first time only)

# .env is git-ignored, so EAS never sees it — give the build its values explicitly:
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_RECOMMENDATIONS_URL --value https://<service>.onrender.com --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_MAP_TILE_URL --value "<tile url>" --visibility plaintext

eas build --platform android --profile preview
```

The build finishes with a download link / QR code for the APK. Skipping the `eas env` step produces
an APK that crashes on launch — `src/lib/env.ts` throws when the Supabase values are missing.

## Post-deploy checklist

- [ ] `test_rls.sql` → `ALL RLS CHECKS PASSED` on the live project
- [ ] `/health` → `database_connected: true`
- [ ] Dashboard login works with the authority account; a test report appears on its map
- [ ] In the app: sign up, open a place (Similar places loads), Save it, add a place, file a report
- [ ] `curl -X POST https://<service>.onrender.com/recommendations/refresh -H "X-Admin-Key: <key>"` → 200
