# How to Run CityGuide Project

This guide provides step-by-step instructions for setting up and running all components of the **CityGuide** monorepo on your local machine.

---

## 📋 System Prerequisites

Before getting started, make sure you have the following installed on your system:

| Component | Required Runtime / Tool | Recommended Version |
| :--- | :--- | :--- |
| **Recommendation Service** | Python | 3.10+ |
| **Admin Dashboard** | Python | 3.10+ |
| **Mobile App** | Flutter SDK & Android Studio / Emulator | Flutter 3.x+ / Dart 3.x+ |
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

## 📱 4. Mobile Application (Flutter)

The mobile client is the primary application for community members to browse maps, get recommendations, and report civic issues.

### Steps:
1. Ensure your Flutter environment is ready:
   ```bash
   flutter doctor
   ```
2. Start an Android emulator from Android Studio or connect a physical Android device with USB debugging enabled.
3. Navigate to the `mobile` folder:
   ```bash
   cd mobile
   ```

4. Install the Flutter dependencies:
   ```bash
   flutter pub get
   ```

5. Configure environment variables / constants:
   - Copy `.env.example` to `.env` (if present) or verify Supabase configuration keys in the app config.
   - Point the backend URL to your running Recommendation Service (`http://10.0.2.2:8000` for Android Emulator localhost access).

6. Run the app:
   ```bash
   flutter run
   ```

---

## 🛠️ Summary of Common Commands

| Service | Working Directory | Start Command | Default URL / Port |
| :--- | :--- | :--- | :--- |
| **Recommendation Service** | `/recommendation-service` | `uvicorn main:app --reload` | `http://127.0.0.1:8000` |
| **Admin Dashboard** | `/admin-dashboard` | `streamlit run app.py` | `http://localhost:8501` |
| **Mobile Client** | `/mobile` | `flutter run` | Android Device / Emulator |
| **Supabase Local** | `/supabase` or root | `supabase start` | `http://127.0.0.1:54321` |
