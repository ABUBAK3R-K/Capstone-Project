# OSM Seed Script for Supabase

This Python script queries the [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) for points of interest (shops, parks, hospitals, etc.) within a specified geographic area and inserts them directly into your Supabase `places` table using the PostGIS format.

## 🚀 Setup

1. Make sure you have Python installed.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create your local environment file:
   ```bash
   cp .env.example .env
   ```
4. **Get your keys:** Go to your Supabase Dashboard -> Project Settings -> API. 
   - Copy the `Project URL` to `SUPABASE_URL`.
   - Copy the `service_role` secret to `SUPABASE_SERVICE_ROLE_KEY`.

## 🗺️ How to use the Bounding Box (BBOX)

The script queries OSM based on a geographic bounding box. The Overpass API expects the format: `south,west,north,east` (or `minLat, minLon, maxLat, maxLon`).

1. Go to [bboxfinder.com](http://bboxfinder.com/).
2. Zoom into your target neighborhood or city.
3. Draw a rectangle over the area.
4. Note the coordinates at the bottom. **Warning**: bboxfinder usually outputs `lng, lat, lng, lat`. Ensure you order them properly for the script.
5. Open `seed_places.py` and replace the `BBOX` variable at the bottom.
6. Run the script:
   ```bash
   python seed_places.py
   ```

## 🔁 Re-running is safe

Each place is stored with its OpenStreetMap identity in `places.osm_id` (e.g. `node/123456`, added by
migration `010`), and the script **upserts** on it — a second run updates existing rows instead of
duplicating them. Apply migration `010` before running this version of the script.

Rows seeded by older versions (before `osm_id` existed) are matched to the fetched OSM data by
name + category + exact coordinates and adopted in place. Migration `010` also merged any exact
duplicates those older runs had already created.

After seeding, rebuild the recommendation cache so new places appear in "Similar places":
`curl -X POST <service-url>/recommendations/refresh -H "X-Admin-Key: <ADMIN_API_KEY>"`
(the service also refreshes itself periodically — see `recommendation-service/.env.example`).

## ⚠️ Important Security Warning
This script uses the **Supabase Service Role Key**. This key has admin privileges and bypasses all Row Level Security (RLS) policies. **Do not** accidentally commit your `.env` file, and **never** bundle this key into the mobile app!
