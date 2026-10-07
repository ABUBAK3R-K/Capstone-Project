"""
Seeds the `places` table from the OpenStreetMap Overpass API.

Safe to re-run: every row carries its OSM identity in `places.osm_id`
(migration 010), and batches are upserted on it, so a second run refreshes
existing rows instead of duplicating the catalogue.

Rows seeded before migration 010 have no osm_id. On each run, those are
matched to the fetched OSM elements by name + category + exact point and get
their osm_id attached first ("claimed"), so they are updated in place rather
than duplicated alongside the new rows.
"""

import os
import struct
import sys

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    sys.exit(1)

# Initialize Supabase client with the SERVICE ROLE KEY
# WARNING: Never use this key in client-side applications!
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

SEED_SOURCE = "osm_seed"
BATCH_SIZE = 100
# Coordinates are compared after rounding, so a float round-trip through
# PostGIS never makes the same OSM node look like a different point.
COORD_PRECISION = 7
OVERPASS_TIMEOUT_SECONDS = 120


def fetch_osm_data(bbox):
    """
    Fetches point-of-interest data from OSM Overpass API for a given bounding box.
    bbox format: "south,west,north,east"
    """
    overpass_url = "https://overpass-api.de/api/interpreter"

    # Overpass QL query: looking for shops, places of worship, and other amenities
    overpass_query = f"""
    [out:json];
    (
      node["shop"]({bbox});
      node["amenity"="place_of_worship"]({bbox});
      node["amenity"="hospital"]({bbox});
      node["amenity"="police"]({bbox});
      node["leisure"="park"]({bbox});
      node["tourism"]({bbox});
    );
    out body;
    """
    print(f"Fetching data from OSM Overpass API for bbox: {bbox}...")
    response = requests.post(overpass_url, data={"data": overpass_query}, timeout=OVERPASS_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()


def categorize(tags):
    """Maps raw OSM tags onto the app's category/subcategory taxonomy."""
    if "shop" in tags:
        return "Shops", tags.get("shop")
    if tags.get("amenity") == "place_of_worship":
        return "Religious", tags.get("religion")
    if "tourism" in tags:
        return "Tourism", tags.get("tourism")
    if tags.get("leisure") == "park":
        return "Public Parks", None
    if "amenity" in tags:
        return "Public Services", tags.get("amenity")
    return "Other", None


def parse_places(osm_data):
    """OSM elements -> `places` rows, keyed by osm_id. Unnamed nodes are skipped."""
    places = {}
    for element in osm_data.get("elements", []):
        if element["type"] != "node":
            continue
        tags = element.get("tags", {})
        name = tags.get("name")
        if not name:
            continue

        category, subcategory = categorize(tags)
        osm_id = f"node/{element['id']}"
        places[osm_id] = {
            "osm_id": osm_id,
            "name": name,
            "category": category,
            "subcategory": subcategory,
            # PostGIS POINT format: POINT(lon lat)
            "location": f"POINT({element['lon']} {element['lat']})",
            "source": SEED_SOURCE,
            "_lon": element["lon"],
            "_lat": element["lat"],
        }
    return places


def decode_ewkb_point(hex_value):
    """(lon, lat) from a PostGIS hex EWKB point, as PostgREST returns geography
    columns — the same decoding mobile/src/lib/geo.ts does client-side."""
    raw = bytes.fromhex(hex_value)
    endian = "<" if raw[0] == 1 else ">"
    (geom_type,) = struct.unpack(endian + "I", raw[1:5])
    offset = 9 if geom_type & 0x20000000 else 5  # skip the SRID when present
    return struct.unpack(endian + "dd", raw[offset:offset + 16])


def match_key(name, category, lon, lat):
    return (name, category, round(lon, COORD_PRECISION), round(lat, COORD_PRECISION))


def claim_legacy_rows(places):
    """Attach osm_id to pre-010 seed rows that correspond to a fetched element."""
    legacy = (
        supabase.table("places")
        .select("id, name, category, location")
        .eq("source", SEED_SOURCE)
        .is_("osm_id", "null")
        .execute()
        .data
    )
    if not legacy:
        return 0

    by_key = {match_key(p["name"], p["category"], p["_lon"], p["_lat"]): p["osm_id"] for p in places.values()}
    claimed = 0
    for row in legacy:
        try:
            lon, lat = decode_ewkb_point(row["location"])
        except (ValueError, struct.error, TypeError):
            continue
        osm_id = by_key.get(match_key(row["name"], row["category"], lon, lat))
        if not osm_id:
            continue
        supabase.table("places").update({"osm_id": osm_id}).eq("id", row["id"]).execute()
        claimed += 1
    return claimed


def seed_supabase(osm_data):
    """
    Parses OSM data and upserts it into the Supabase 'places' table.
    Returns the number of batches that failed.
    """
    places = parse_places(osm_data)
    if not places:
        print("No valid places found to insert.")
        return 0

    claimed = claim_legacy_rows(places)
    if claimed:
        print(f"Claimed {claimed} place(s) seeded before osm_id existed.")

    rows = [{k: v for k, v in p.items() if not k.startswith("_")} for p in places.values()]
    print(f"Prepared {len(rows)} places. Upserting into Supabase...")

    failed_batches = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            supabase.table("places").upsert(batch, on_conflict="osm_id").execute()
            print(f"Upserted batch {i // BATCH_SIZE + 1} ({len(batch)} places)")
        except Exception as e:
            failed_batches += 1
            print(f"Error upserting batch {i // BATCH_SIZE + 1}: {e}")
    return failed_batches


if __name__ == "__main__":
    # Example: Central Bengaluru, India
    # Format: minLat, minLon, maxLat, maxLon (South, West, North, East)
    BBOX = "12.9500,77.5700,12.9900,77.6100"

    try:
        data = fetch_osm_data(BBOX)
        failures = seed_supabase(data)
    except Exception as e:
        print(f"Script failed: {e}")
        sys.exit(1)

    if failures:
        print(f"Seeding finished with {failures} failed batch(es) — re-run to retry; it is idempotent.")
        sys.exit(1)
    print("Seeding complete! Rebuild recommendations: POST /recommendations/refresh (X-Admin-Key).")
