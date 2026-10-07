# System Architecture Diagram — Image Generation Prompt

Two assets are provided:

1. **Prompt A** — a full descriptive prompt for an image-generation model
   (Nano Banana / Gemini Image, GPT Image, Midjourney, Ideogram, Firefly).
2. **Prompt B** — a short, style-only variant for models that lose coherence on long prompts.
3. **Fallback** — a Mermaid source that renders a pixel-accurate diagram with perfect text.

> **Practical note:** diffusion image models routinely misspell text inside boxes. For a
> capstone report, generate the image for visual appeal but verify every label, or use the
> Mermaid fallback (renders directly on GitHub, or export as SVG from mermaid.live) when
> label accuracy matters more than styling. Ideogram and GPT Image handle in-image text best.

---

## Prompt A — Full Prompt

```
A clean, professional software system architecture diagram for a mobile application
called "CityGuide", drawn as a flat vector infographic on a white background,
horizontal 16:9 layout, arranged in four clearly separated horizontal layers with
rounded-rectangle boxes, thin grey borders, soft drop shadows, and labelled arrows.
Modern technical documentation style, muted professional palette of teal, indigo,
amber and slate grey, clean sans-serif labels, generous white space, no photorealism,
no 3D, no clutter.

LAYER 1 - TOP - "PRESENTATION LAYER (React Native / Expo App)" - a wide teal-tinted band
containing six small rounded boxes in a row, each with a simple line icon:
"Auth - Customer / Business" (lock icon), "Map + Search - OpenStreetMap" (map pin icon),
"Place Detail + Similar Places + Save" (list icon), "Report Screen - Camera + GPS"
(camera icon), "Bookings + Orders" (calendar icon), "Business Owner Dashboard" (shop icon).

LAYER 2 - UPPER MIDDLE - two separate boxes side by side, connected downward:
On the LEFT, an indigo-tinted box labelled "RECOMMENDATION MICROSERVICE (Python
FastAPI)" containing three stacked inner boxes:
  - "Content + Proximity Strategy - TF-IDF + Haversine"
  - "Collaborative Filtering - Implicit ALS"
  - "Hybrid Strategy - Blend + Cold-Start Fallback"
and beneath them a small amber box labelled "In-Memory Similarity Matrix Cache".
On the RIGHT, an amber-tinted box labelled "ADMIN DASHBOARD (Streamlit)" containing
three inner boxes: "Report Triage + Status Update", "Folium Map + Analytics" and
"Business Verification".

LAYER 3 - LOWER MIDDLE - a wide slate-grey band labelled "BACKEND SERVICES (Supabase)"
containing four boxes in a row: "Supabase Auth (JWT)", "Row Level Security + Column Grants",
"Supabase Storage - reports + verification buckets", "RPC Functions - nearby_places, search_places".

LAYER 4 - BOTTOM - a dark navy band labelled "DATA LAYER - PostgreSQL + PostGIS"
containing seven cylinder database-table shapes labelled: "profiles", "places
(geography Point 4326)", "interactions", "problem_reports", "businesses",
"business_services", "bookings". Below this band, a small
detached box on the left labelled "OSM Overpass API - Place Seeding" with a dashed
arrow pointing up into the "places" table.

ARROWS AND LABELS:
- From "Place Detail" down to the Recommendation Microservice, labelled "GET /recommendations".
- From "Place Detail" down past the microservice to Row Level Security, labelled
  "view / save / visit interactions".
- From "Map + Search" down past the microservice, straight to the Backend Services layer,
  labelled "Supabase RPC - nearby_places, search_places".
- From "Bookings + Orders" and "Business Owner Dashboard" down to Row Level Security,
  labelled "bookings (RLS + triggers)".
- From "Report Screen" down to Supabase Storage, labelled "Photo Upload + GPS Insert".
- From the Recommendation Microservice down to the Data Layer, labelled "SQLAlchemy".
- From the Admin Dashboard down to the Data Layer, labelled "psycopg2 - Read + Update Status".
- From the Admin Dashboard across to the Recommendation Microservice, a thin dashed arrow
  labelled "refresh on approval".
- A small legend box in the bottom-right corner with three coloured dots labelled
  "REST/HTTP", "SQL", "Auth".

Everything must be legible, evenly aligned, symmetrical, and centred.
```

---

## Prompt B — Short Variant

```
Flat vector software architecture diagram, white background, 16:9, four stacked
horizontal layers with rounded boxes and labelled arrows, teal/indigo/amber/slate
palette, clean sans-serif text, technical documentation style.
Layer 1 "React Native / Expo App": Auth, Map + Search (OpenStreetMap), Place Detail, Report
(Camera+GPS), Bookings, Business Dashboard.
Layer 2: left box "FastAPI Recommendation Service" containing "TF-IDF + Haversine",
"Collaborative ALS", "Hybrid + Cold-Start Fallback", "Similarity Cache"; right box
"Streamlit Admin Dashboard" containing "Report Triage", "Folium Map", "Business Verification".
Layer 3 "Supabase": Auth (JWT), Row Level Security, Storage, RPC Functions.
Layer 4 "PostgreSQL + PostGIS": tables profiles, places, interactions, problem_reports,
businesses, business_services, bookings.
Arrows labelled "GET /recommendations", "interactions (RLS)", "Supabase RPC", "bookings",
"Photo Upload", "SQLAlchemy", "psycopg2". Minimal, symmetrical, no 3D, no photorealism.
```

---

## Fallback — Mermaid Source (exact labels, GitHub-renderable)

```mermaid
flowchart TB
  subgraph L1["PRESENTATION LAYER — React Native / Expo App"]
    direction LR
    A1["Auth<br/>customer · business"]
    A2["Map + Search<br/>OpenStreetMap · react-native-maps"]
    A3["Place Detail<br/>Similar Places · Save · Visited"]
    A4["Report Screen<br/>Camera + GPS"]
    A5["Bookings + Orders"]
    A6["Business Owner<br/>listing · services · bookings"]
  end

  subgraph L2["APPLICATION LAYER"]
    direction LR
    subgraph RS["Recommendation Microservice — Python / FastAPI"]
      direction TB
      R1["ContentProximityStrategy<br/>TF-IDF 0.7 + Haversine decay 0.3"]
      R2["CollaborativeFilteringStrategy<br/>Implicit ALS · 50 factors"]
      R3["HybridStrategy<br/>β = 0.5 · cold-start threshold = 5"]
      R4[("In-Memory Similarity Matrix Cache")]
      R1 --> R3
      R2 --> R3
      R3 --> R4
    end
    subgraph AD["Admin Dashboard — Streamlit"]
      direction TB
      D1["Report Triage<br/>reported → in_progress → fixed"]
      D2["Folium Map + Metrics"]
      D3["Business Verification"]
    end
  end

  subgraph L3["BACKEND SERVICES — Supabase"]
    direction LR
    S1["Supabase Auth<br/>JWT"]
    S2["Row Level Security + Column Grants<br/>user / authority / admin"]
    S3["Storage<br/>reports · business-verification"]
    S4["RPC Functions<br/>nearby_places · search_places"]
  end

  subgraph L4["DATA LAYER — PostgreSQL + PostGIS"]
    direction LR
    T1[("profiles")]
    T2[("places<br/>geography Point 4326")]
    T3[("interactions")]
    T4[("problem_reports")]
    T5[("businesses")]
    T6[("business_services")]
    T7[("bookings")]
  end

  OSM["OSM Overpass API<br/>place seeding"] -.->|"seed_places.py"| T2

  A3 -->|"GET /recommendations"| RS
  A3 -->|"view / save / visit"| S2
  A2 -->|"Supabase RPC"| S4
  A1 -->|"sign in / sign up"| S1
  A4 -->|"photo upload"| S3
  A4 -->|"insert report + GPS"| S2
  RS -->|"SQLAlchemy"| L4
  AD -->|"psycopg2 read / update"| L4
  AD -->|"role check"| S1
  AD -.->|"refresh on approval"| RS
  A5 -->|"book / order / cancel"| S2
  A6 -->|"accept / decline"| S2
  S2 --> T7
  T5 -.->|"approved → mirrored"| T2
  S4 --> T2
  S2 --> T4
  S1 --> T1
```
