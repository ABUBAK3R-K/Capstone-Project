# CityGuide - Community-Curated City Guide App

A community-curated city guide Android application that maps local businesses, shops, and public/religious places, featuring a "similar places" recommendation engine and a photo-based civic problem reporting flow that local authorities can review.

This repository is structured as a monorepo for a 4-person student capstone project.

---

## 🛠️ Tech Stack
* **Mobile Client:** Flutter (Dart) → Android target
* **Maps Integration:** OpenStreetMap (OSM) via the `flutter_map` package *(Zero paid maps APIs or keys used)*
* **Backend Database:** Supabase (PostgreSQL + PostGIS + Supabase Auth + Supabase Storage)
* **Recommendation Microservice:** Python + FastAPI (connecting directly to Supabase Postgres)
* **Admin Dashboard:** Streamlit (Python) for authority review
* **External APIs:** None. All tools/APIs are free-tier or open-source.

---

## 📂 Repository Structure & Roles

This monorepo is divided into the following key folders, each assigned to a team member:

| Folder | Role Owner | Description |
| :--- | :--- | :--- |
| [`/mobile`](./mobile) | **Mobile Developer** | Flutter mobile application containing user maps, recommendation displays, and reporting UI. |
| [`/recommendation-service`](./recommendation-service) | **Recommendation Engineer (User)** | Python FastAPI microservice that analyzes interaction history and geographical data to recommend similar places. |
| [`/admin-dashboard`](./admin-dashboard) | **Admin / Web Developer** | Streamlit application for local authorities to review, categorize, and resolve reported civic problems. |
| [`/supabase`](./supabase) | **Backend / Database Developer** | Postgres migrations, SQL schemas, custom PostGIS functions, and local Supabase setup. |
| [`/docs`](./docs) | **All Team Members (Shared)** | Product Requirements Document (PRD), API documentation, and architecture diagrams. |

---

## 🚀 Getting Started

Instructions for running each service are provided in their respective directories. Ensure you have the appropriate runtimes installed:
* Flutter SDK (3.x+) for `/mobile`
* Python 3.10+ for `/recommendation-service` and `/admin-dashboard`
* Docker / Supabase CLI (optional, for local development) for `/supabase`

