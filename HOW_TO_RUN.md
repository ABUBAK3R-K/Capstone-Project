# How to Run CityGuide Project

This guide provides step-by-step instructions for setting up and running all components of the **CityGuide** monorepo on your local machine.

---

## ⚡ Quick Start (dev mode, no login)

Supabase Auth is not wired up yet (the `profiles` table has no rows, so no account
can pass the authority/admin role check). Both apps therefore ship a **dev auth
bypass** that is already switched on in the local `.env` files:

| Component | Flag | File |
| :--- | :--- | :--- |
| Admin Dashboard | `SKIP_AUTH=true` | `admin-dashboard/.env` |
| Mobile App | `DEV_SKIP_AUTH=true` | `mobile/.env` |

Set either flag to `false` to get the normal login screen back.

Three terminals:

```bash
# 1. Recommendation API  -> http://127.0.0.1:8000/docs
cd recommendation-service && .venv/Scripts/python -m uvicorn main:app --reload --port 8000

# 2. Admin dashboard     -> http://localhost:8501
cd admin-dashboard && .venv/Scripts/python -m streamlit run app.py

# 3. Mobile app          -> press `a` for Android, `i` for iOS, or scan with Expo Go
cd mobile && npx expo start
```

**What works without logging in:** the map, place lists, place details and
"similar places" recommendations, and the whole admin dashboard.
**What does not:** submitting a problem report and logging interactions — both
need a real Supabase user, because `problem_reports` / `interactions` have a
foreign key to `profiles` and RLS only allows authenticated inserts.

---

## 📋 System Prerequisites

Before getting started, make sure you have the following installed on your system:

| Component | Required Runtime / Tool | Recommended Version |
| :--- | :--- | :--- |
| **Recommendation Service** | Python | 3.10+ |
| **Admin Dashboard** | Python | 3.10+ |
| **Mobile App** | Node.js & Expo Go (or Android Studio / Xcode emulator) | Node 18+ / Expo SDK 52 |
| **Database** | Supabase CLI (Local) or Supabase Cloud Account | Latest |
| **Version Control** | Git | Latest |

---

## 🗄️ 1. Database & Backend Setup (Supabase)

You can use either a **Supabase Cloud** project or the **local Supabase CLI**.

### Option A: Supabase Cloud (Recommended)
1. Log in to [Supabase](https://supabase.com/) and create a new project.
2. Go to the **SQL Editor** in your Supabase Dashboard.
3. Apply the schema migration located at:
   - [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
4. (Optional) Run any seed scripts located in `supabase/seed/` if test data is required.
5. Retrieve your project connection credentials from **Project Settings > Database** and **Project Settings > API**:
   - `DATABASE_URL` (Direct or Session Pooler Postgres connection string)
   - `SUPABASE_URL`
   - `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`

### Option B: Local Supabase CLI
1. Open a terminal in the root or `supabase` directory.
2. Start the local Supabase containers:
   ```bash
   supabase start
   ```
3. Apply the migrations:
   ```bash
   supabase db reset
   ```

---

## 🐍 2. Recommendation Microservice (FastAPI)

The recommendation service calculates similar places and serves APIs consumed by the mobile client.

### Steps:
1. Open a terminal and navigate to the `recommendation-service` folder:
   ```bash
   cd recommendation-service
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set:
   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-DB-HOST]:5432/postgres"
   PORT=8000
   ENVIRONMENT=development
   ```

5. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

6. Verify the service:
   - API Root: [http://127.0.0.1:8000](http://127.0.0.1:8000)
   - Interactive Swagger Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 📊 3. Admin Dashboard (Streamlit)

The admin dashboard provides municipal authorities with a web interface to review and update reported civic problems.

### Steps:
1. Open a new terminal and navigate to the `admin-dashboard` folder:
   ```bash
   cd admin-dashboard
   ```

2. Activate your virtual environment (or create a new one):
   - **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase connection parameters in `.env`:
   ```env
   SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_KEY="your-supabase-service-or-anon-key"
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-DB-HOST]:5432/postgres"
   ```

5. Run the Streamlit dashboard:
   ```bash
   streamlit run app.py
   ```

6. Open your browser at [http://localhost:8501](http://localhost:8501).

---

## 📱 4. Mobile Application (React Native / Expo)

The mobile client is the primary application for community members to browse maps, get recommendations, and report civic issues. It was rebuilt in React Native (Expo managed workflow) — the previous Flutter implementation has been removed.

### Steps:
1. Ensure Node.js 18+ is installed:
   ```bash
   node -v
   ```
2. Navigate to the `mobile` folder and install dependencies:
   ```bash
   cd mobile
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` and fill it in.
   - All keys are prefixed `EXPO_PUBLIC_` so Expo inlines them at build time.
   - `EXPO_PUBLIC_RECOMMENDATIONS_URL` → `http://10.0.2.2:8000` for an Android emulator, `http://127.0.0.1:8000` for an iOS simulator, or your machine's LAN IP for a physical device.
   - `EXPO_PUBLIC_MAP_TILE_URL` → a hosted OSM-style raster tile URL (Mapbox / MapTiler). **Do not use `tile.openstreetmap.org`** — `react-native-maps` blocks it on Android and the map will be blank there. See `mobile/README.md`.

4. Start the dev server:
   ```bash
   npx expo start
   ```
   Then press `a` for an Android emulator, `i` for an iOS simulator, or scan the QR code with Expo Go. No `expo prebuild` is required.

5. Useful checks:
   ```bash
   npm run typecheck                    # tsc --noEmit
   npx expo export --platform android   # verify the bundle builds
   ```

> After editing `.env`, restart with `npx expo start --clear` — inlined values are baked into the bundle.

---

## 🛠️ Summary of Common Commands

| Service | Working Directory | Start Command | Default URL / Port |
| :--- | :--- | :--- | :--- |
| **Recommendation Service** | `/recommendation-service` | `uvicorn main:app --reload` | `http://127.0.0.1:8000` |
| **Admin Dashboard** | `/admin-dashboard` | `streamlit run app.py` | `http://localhost:8501` |
| **Mobile Client** | `/mobile` | `npx expo start` | Expo Go / Emulator |
| **Supabase Local** | `/supabase` or root | `supabase start` | `http://127.0.0.1:54321` |
