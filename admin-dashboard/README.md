# Admin Dashboard (/admin-dashboard)

This directory contains the Admin Dashboard, built using **Streamlit (Python)**. It provides a lightweight web interface for city authorities and administrators to review and update reported civic problems.

## 🧑‍💻 Owner
* **Role:** Admin / Web Developer
* **Responsibilities:** Streamlit layout, connecting to Supabase database, displaying interactive map reports, providing status transition controls (`reported` ➔ `in_progress` ➔ `fixed`), and showing key analytics charts.

## 🛠️ Tech Stack
* **Framework:** Streamlit (Python)
* **Database Connection:** Supabase Python client / psycopg2 (direct Postgres)
* **Visualization:** Pandas, Matplotlib/Seaborn, and Streamlit-native maps/folium

## 📂 Directory Contents
* `app.py`: Civic problem-report triage (the default page — `streamlit run app.py`)
* `pages/1_Verify_Businesses.py`: Review pending business signups (supabase/migrations/008), approve/reject
* `pages/2_Manage_Businesses.py`: Admin override — edit or remove any business listing, independent of the owner's own access
* `lib/auth.py`, `lib/db.py`, `lib/storage.py`: Shared login gate, Postgres connection and signed-URL helper used by every page above
* `requirements.txt`: Python packages (streamlit, pandas, supabase, etc.)
* `.env.example`: Configuration variables for local development
