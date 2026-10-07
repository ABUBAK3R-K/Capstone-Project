import os
from sqlalchemy import create_engine, text

# Supabase Local Postgres URL
db_url = "postgresql+psycopg2://postgres:postgres@127.0.0.1:54322/postgres"
engine = create_engine(db_url)

places = [
    {
        "name": "Bhatkal Beach",
        "category": "Attractions",
        "subcategory": "Beach",
        "description": "A beautiful and serene beach perfect for evening walks and sunsets.",
        "lat": 13.9740,
        "lng": 74.5320,
        "address": "Bhatkal Beach, Bhatkal, Karnataka",
        "images": ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e"]
    },
    {
        "name": "Jamia Masjid Bhatkal",
        "category": "Attractions",
        "subcategory": "Religious Site",
        "description": "One of the oldest and most prominent mosques in the region with rich history.",
        "lat": 13.9788,
        "lng": 74.5517,
        "address": "Jamia Masjid Rd, Bhatkal, Karnataka",
        "images": ["https://images.unsplash.com/photo-1564303490729-16f1bb93cdd5"]
    },
    {
        "name": "Kethapayya Narayan Temple",
        "category": "Attractions",
        "subcategory": "Religious Site",
        "description": "An ancient Hindu temple featuring exquisite carvings and historical architecture.",
        "lat": 13.9850,
        "lng": 74.5580,
        "address": "Bhatkal, Karnataka",
        "images": ["https://images.unsplash.com/photo-1598285908200-a496f8c7b8c7"]
    },
    {
        "name": "City Light Restaurant",
        "category": "Food",
        "subcategory": "Restaurant",
        "description": "Popular local spot serving authentic Bhatkali biryani and coastal delicacies.",
        "lat": 13.9800,
        "lng": 74.5550,
        "address": "Main Road, Bhatkal, Karnataka",
        "images": ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4"]
    },
    {
        "name": "Bhatkal Market",
        "category": "Shops",
        "subcategory": "Bazaar",
        "description": "Bustling local market area for spices, electronics, and daily goods.",
        "lat": 13.9770,
        "lng": 74.5540,
        "address": "Market Rd, Bhatkal, Karnataka",
        "images": ["https://images.unsplash.com/photo-1533900298318-6b8da08a523e"]
    }
]

with engine.connect() as conn:
    for p in places:
        query = text("""
            INSERT INTO places (name, category, subcategory, description, location, address, images, source)
            VALUES (:name, :category, :subcategory, :description, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :address, :images, 'system')
        """)
        conn.execute(query, {
            "name": p["name"],
            "category": p["category"],
            "subcategory": p["subcategory"],
            "description": p["description"],
            "lat": p["lat"],
            "lng": p["lng"],
            "address": p["address"],
            "images": p["images"]
        })
    conn.commit()

print("Successfully inserted 5 mock places around Bhatkal!")
