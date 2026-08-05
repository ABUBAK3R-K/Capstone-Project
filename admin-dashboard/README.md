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
*(Future setup will populate this folder with)*
* `app.py`: Streamlit main dashboard script
* `requirements.txt`: Python packages (streamlit, pandas, supabase, etc.)
* `.env.example`: Configuration variables for local development
