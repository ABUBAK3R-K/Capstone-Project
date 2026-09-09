I'm replacing the /mobile folder of a city-guide app — it currently has
a Flutter implementation (app shell, auth, map screen, place detail,
report flow) that I'm discarding in favor of React Native. Rebuild it
from scratch in React Native, matching the same features, but treat
this as a chance to significantly improve the design and UI/UX, not
just a literal port.

BACKEND (unchanged — do not touch)
- Supabase: Postgres + PostGIS + Auth + Storage (@supabase/supabase-js)
- Two RPCs exist: nearby_places(lat, lng, radius_meters, filter_category)
  and search_places(query, lat, lng) — both return flat JSON, no raw
  PostGIS objects
- A FastAPI recommendation service exposes
  GET /recommendations?place_id={id}&limit=10

IMPORTANT MAP CONSTRAINT
Do not use react-native-maps' UrlTile approach for OpenStreetMap tiles —
it's unreliable on Android specifically (blocked by the library
maintainers after past load issues on OSM's own tile servers). Use
either:
(a) react-native-maps with a MapLibre/Mapbox-hosted OSM-style tile
    source (Mapbox free tier, no OSM rate-limit risk), or
(b) @maplibre/maplibre-react-native directly.
Pick whichever has better current Expo compatibility and explain why.

STACK
- Expo (managed workflow, unless you have a good reason not to)
- React Navigation for the tab/stack structure
- @supabase/supabase-js for auth and RPC calls
- A UI library or styling approach that lets you actually make this look
  good, not default RN styling — you decide (NativeWind/Tailwind,
  Tamagui, or hand-rolled styled-components are all fine)

DESIGN / UI/UX BAR
This needs to look like a real product, not a tutorial app. Concretely:
1. A real visual identity — pick a cohesive color palette and type scale,
   don't leave default black-on-white with default fonts.
2. Home screen should feel like a curated feed, not a form — think
   cards with imagery, clear visual hierarchy between sections (nearby
   categories, recently added, problems near you), not just stacked
   list items.
3. Map screen: category filter chips should feel tactile (selected
   state, smooth transitions), custom marker icons per category
   (shop/religious/public/etc.) instead of default pins.
4. Place detail screen: image carousel/hero image, clear typography
   hierarchy, "Similar places" as a horizontally scrolling card row,
   not a plain list.
5. Meaningful empty states and loading states (skeleton loaders over
   spinners where reasonable) — no blank white screens while data loads.
6. Smooth, subtle transitions/animations on navigation and interactions
   (React Native Reanimated is fine if it helps) — nothing gratuitous,
   just enough that it doesn't feel static.
7. Consistent spacing/padding system — no eyeballed margins.

FEATURES TO REBUILD
1. Auth: login/signup via Supabase Auth
2. Bottom tab nav: Home, Map, Report, Profile
3. Home: nearby categories, recently added places, problems near you —
   real data from nearby_places
4. Map: OSM-based tiles per the constraint above, real markers from
   nearby_places, category filter chips, tap marker → place detail
5. Place detail: full info + image(s) + "Similar places" row calling
   the recommendations endpoint
6. Report flow: camera capture (expo-image-picker or expo-camera), GPS
   auto-tag, category dropdown, description field, upload photo to
   Supabase Storage, insert into problem_reports

Before writing code: propose the folder structure, the map library
choice with your reasoning, and the visual direction (palette/type/
component style) in a couple sentences each. Then implement.