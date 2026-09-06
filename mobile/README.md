# CityGuide Mobile (React Native / Expo)

The mobile client for CityGuide: browse local places on an OSM-based map, see
what the recommendation model considers similar, and report civic issues with a
photo and a GPS tag.

Rebuilt in React Native + Expo, replacing the previous Flutter implementation.
The backend is unchanged — same Supabase project, same RPCs, same FastAPI
recommendation service.

---

## Quick start

```bash
cd mobile
npm install
cp .env.example .env      # then fill it in — see "Environment" below
npx expo start
```

Press `a` for an Android emulator, `i` for an iOS simulator, or scan the QR code
with Expo Go. No `expo prebuild` is needed: every native module used here is
included in Expo Go.

---

## Environment

All variables are `EXPO_PUBLIC_*` so Expo inlines them at build time. **Restart
with `npx expo start --clear` after changing `.env`** — inlined values are baked
into the bundle.

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key — safe to ship, RLS protects the data |
| `EXPO_PUBLIC_RECOMMENDATIONS_URL` | no | FastAPI service. Blank disables "Similar places" cleanly |
| `EXPO_PUBLIC_MAP_TILE_URL` | no | Hosted OSM-style raster tiles. Blank renders markers with no basemap |
| `EXPO_PUBLIC_MAP_ATTRIBUTION` | no | Attribution string shown on the map |
| `EXPO_PUBLIC_DEV_SKIP_AUTH` | no | Skip login. Reporting stays disabled — inserts need a real `auth.uid()` |

Reaching the FastAPI service from a device:

| Target | URL |
|---|---|
| Android emulator | `http://10.0.2.2:8000` |
| iOS simulator | `http://127.0.0.1:8000` |
| Physical device | `http://<your-LAN-IP>:8000` |

---

## Map tiles — read this before debugging a blank map

Do **not** point `EXPO_PUBLIC_MAP_TILE_URL` at `https://tile.openstreetmap.org/...`.
`react-native-maps` blocks OSM's own tile servers on Android, so tiles fail
silently there while working fine on iOS. Use a hosted OSM-style raster source:

```
# Mapbox (free tier)
https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=YOUR_TOKEN

# MapTiler
https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=YOUR_KEY
```

On Android the map sets `mapType="none"` whenever a tile URL is configured, so
the Google basemap does not render underneath and fight with the raster tiles.

### Why `react-native-maps` and not `@maplibre/maplibre-react-native`

1. **Expo compatibility.** `react-native-maps` is included in Expo Go and has a
   first-party config plugin. MapLibre is native-only and needs a custom dev
   client, so nobody could see a map without an EAS build first.
2. **Custom markers are JSX.** `<Marker>` renders React children, so the
   per-category pins in `features/map/components/CategoryMarker.tsx` are ordinary
   components with animated selected states. MapLibre would push that into
   `SymbolLayer` plus pre-registered sprite images.

---

## Backend contract

Nothing in this app modifies the schema. It talks to:

- **`nearby_places(lat, lng, radius_meters, filter_category)`** — distance-ordered
  places with `location` already unpacked to `lat`/`lng`.
- **`search_places(search_query, lat, lng)`** — note the parameter is
  `search_query`, not `query`.
- **`problem_reports`** — direct table access. Its `location` is a raw
  `geography` column, so PostgREST returns hex EWKB; it is decoded client-side in
  `lib/geo.ts` (`parsePostgisPoint`) rather than adding a migration.
- **`storage/reports`** — public bucket for report photos, authenticated upload.
- **`GET /recommendations`** and **`POST /interactions`** on the FastAPI service.

### A note on "your reports"

RLS on `problem_reports` only exposes rows where `user_id = auth.uid()`, unless
the user's profile role is `authority` or `admin`. An ordinary user therefore
cannot see a city-wide issue feed, and the Home section is titled **"Your reports
nearby"** to say so rather than implying otherwise. Making it city-wide needs a
new `SECURITY DEFINER` RPC returning anonymised nearby reports — a backend
change, deliberately not made here.

---

## Structure

```
src/
├── App.tsx                  # providers: Query → Auth → Navigation
├── providers/               # AuthProvider (Supabase session)
├── navigation/              # Root stack + bottom tabs
├── design/                  # ← visual identity lives here
│   ├── tokens.ts            #   palette, spacing, radii, type scale, shadows
│   ├── typography.tsx       #   <Text variant="…"> primitives
│   └── components/          #   Button · Card · Chip · Skeleton · EmptyState · …
├── features/
│   ├── auth/  home/  map/  place/  report/  profile/
├── lib/                     # supabase · env · places · reports · recommendations · geo
├── hooks/                   # useLocation · usePlaces
├── constants/categories.ts  # category → icon + colour, shared by markers & chips
└── types/
```

`design/` sits outside `features/` on purpose: every screen composes the same
primitives, so spacing and colour stay consistent by construction rather than by
discipline. **No feature file should contain a hex value or a raw pixel margin** —
if a token is missing, add it to `design/tokens.ts`.

### Visual identity — "Terracotta & Ink"

Warm paper canvas (`#FBF8F4`), near-black ink (`#16181D`), terracotta primary
(`#E0562F`) for actions and selected states, deep teal (`#0E6E62`) as the
secondary accent. Type is Plus Jakarta Sans for headings over Inter for body on a
7-step scale; spacing is a strict 4pt scale. A six-colour category ramp
(`categoryPalette`) means a colour always signifies the same category, whether it
appears on a map marker, a filter chip or a card tag.

---

## Checks

```bash
npm run typecheck        # tsc --noEmit
npx expo export --platform android   # verify the bundle builds
```
