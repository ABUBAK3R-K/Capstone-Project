import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    exit(1)

# Initialize Supabase client with the SERVICE ROLE KEY
# WARNING: Never use this key in client-side applications!
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def fetch_osm_data(bbox):
    """
    Fetches point-of-interest data from OSM Overpass API for a given bounding box.
    bbox format: "south,west,north,east"
    """
    overpass_url = "http://overpass-api.de/api/interpreter"
    
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
    response = requests.post(overpass_url, data={'data': overpass_query})
    response.raise_for_status()
    return response.json()

def seed_supabase(osm_data):
    """
    Parses OSM data and inserts it into the Supabase 'places' table.
    """
    places_to_insert = []
    
    for element in osm_data.get("elements", []):
        if element["type"] == "node":
            tags = element.get("tags", {})
            name = tags.get("name")
            
            if not name:
                continue # Skip unnamed locations
                
            # Determine category based on tags
            category = "Other"
            subcategory = None
            if "shop" in tags:
                category = "Shops"
                subcategory = tags.get("shop")
            elif tags.get("amenity") == "place_of_worship":
                category = "Religious"
                subcategory = tags.get("religion")
            elif "tourism" in tags:
                category = "Tourism"
                subcategory = tags.get("tourism")
            elif tags.get("leisure") == "park":
                category = "Public Parks"
            elif "amenity" in tags:
                category = "Public Services"
                subcategory = tags.get("amenity")

            lon = element["lon"]
            lat = element["lat"]
            
            place = {
                "name": name,
                "category": category,
                "subcategory": subcategory,
                # PostGIS POINT format: POINT(lon lat)
                "location": f"POINT({lon} {lat})",
                "source": "osm_seed"
            }
            places_to_insert.append(place)

    if not places_to_insert:
        print("No valid places found to insert.")
        return

    print(f"Prepared {len(places_to_insert)} places. Inserting into Supabase...")
    
    # Insert in batches of 100 to avoid request payload limits
    batch_size = 100
    for i in range(0, len(places_to_insert), batch_size):
        batch = places_to_insert[i:i+batch_size]
        try:
            response = supabase.table("places").insert(batch).execute()
            print(f"Inserted batch {i//batch_size + 1} ({len(batch)} places)")
        except Exception as e:
            print(f"Error inserting batch: {e}")

if __name__ == "__main__":
    # Default bounding box for a small test area (e.g., Central London)
    # Get your own bbox from http://bboxfinder.com/ (Format: minLat, minLon, maxLat, maxLon)
    # Warning: bboxfinder uses (lng, lat). Overpass expects (south, west, north, east)
    BBOX = "51.5000,-0.1300,51.5200,-0.1000" 
    
    try:
        data = fetch_osm_data(BBOX)
        seed_supabase(data)
        print("Seeding complete!")
    except Exception as e:
        print(f"Script failed: {e}")
