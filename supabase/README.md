# Backend Database (/supabase)

This directory contains Supabase configurations, database schema migrations, and helper SQL scripts. 

## 🧑‍💻 Owner
* **Role:** Backend / Database Developer
* **Responsibilities:** Writing migrations, configuring Supabase projects, designing database indexes (especially GIST for PostGIS), setting up Row Level Security (RLS) policies, and database-level functions/triggers.

## 🛠️ Tech Stack
* **Database:** PostgreSQL + PostGIS (Geographical querying)
* **Auth & Storage:** Supabase Auth (profiles schema link) and Supabase Storage (issue photo storage buckets)

## 📂 Directory Contents
* `/migrations`: SQL migration scripts containing structural updates to the database schema.
    * `001_initial_schema.sql`: Initial tables, indexes, and extensions.
