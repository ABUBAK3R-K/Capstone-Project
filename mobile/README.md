# CityGuide Mobile (React Native / Expo)

The mobile client for CityGuide: browse and search local places on an OSM-based
map, see what the recommendation model considers similar, add missing places,
report civic issues with a photo and a GPS tag, and book local businesses. A
second tab set serves business owners (listing, services, incoming bookings).

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
| `EXPO_PUBLIC_MAP_TILE_SIZE` | no | Tile edge in px: 512 for Mapbox @2x, 256 for most others |
| `EXPO_PUBLIC_DEV_SKIP_AUTH` | no | Skip login. Reporting, adding places, saving and booking stay disabled — they need a real `auth.uid()` |

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

The full table of what the app reads and writes, and what the database enforces
for each, is in [`../supabase/API.md`](../supabase/API.md). In short:

- **`nearby_places`** / **`search_places`** RPCs — flat, distance-ordered rows.
  `search_places` takes `search_query` (not `query`) and returns ≤ 50 matches.
- **Direct table access, all RLS-gated:** `places` (Add a place), `interactions`
  (view / save / visit — logged straight to Supabase, so feedback is kept even
  when the recommendation service is down), `problem_reports`, `profiles`,
  `businesses`, `business_services`, `bookings`.
- Geography columns read from tables come back as hex EWKB and are decoded in
  `lib/geo.ts` (`parsePostgisPoint`); inserts send GeoJSON.
- **Storage:** `reports` (public photos) and `business-verification` (private).
- **`GET /recommendations`** on the FastAPI service. A 404 (place not in the
  cache yet — e.g. just added) is treated as "no similar places yet".

### A note on "your reports"

RLS on `problem_reports` only exposes rows where `user_id = auth.uid()`, unless
the user's profile role is `authority` or `admin`. An ordinary user therefore
only ever sees their own reports — as status counts on the Profile screen. A
city-wide issue feed would need a new `SECURITY DEFINER` RPC returning anonymised
reports, and is explicitly out of scope (`PROJECT_SCOPE.md`).

---

## Structure

```
src/
├── App.tsx                  # providers: Query → Auth → Location → Navigation
├── providers/               # AuthProvider (session + profile/account type), LocationProvider
├── navigation/              # Root stack, customer tabs, business-owner tabs
├── design/                  # ← visual identity lives here
│   ├── tokens.ts            #   palette, spacing, radii, type scale, shadows
│   ├── typography.tsx       #   <Text variant="…"> primitives
│   └── components/          #   Button · Card · Chip · Skeleton · EmptyState · …
├── features/
│   ├── auth/                #   welcome, customer + business sign-in
│   ├── home/  map/  search/ #   discovery
│   ├── place/               #   place detail, similar places, save/visit, add a place
│   ├── report/              #   civic report flow
│   ├── booking/             #   appointment + order checkout
│   ├── business/            #   owner dashboard, services, bookings, profile
│   └── profile/             #   report stats, my bookings, contribute
├── lib/                     # supabase · env · places · interactions · reports · bookings · businesses · recommendations · geo
│   └── __tests__/           #   Jest unit tests for lib/
├── hooks/                   # usePlaces · useBusiness · useDebouncedValue
├── constants/categories.ts  # category → icon + colour, shared by markers & chips
└── types/
```

`design/` sits outside `features/` on purpose: every screen composes the same
primitives, so spacing and colour stay consistent by construction rather than by
discipline. **No feature file should contain a hex value or a raw pixel margin** —
if a token is missing, add it to `design/tokens.ts`.

### Visual identity — "Terracotta & Ink"

Warm paper canvas (`#EDE6DB`), near-black ink (`#140E0C`), terracotta primary
(`#DA611B`) for actions and selected states, slate teal (`#4D7276`) as the
secondary. Type pairs Fraunces (display) with Figtree (body); spacing is a strict
4pt scale. A category colour ramp (`categoryPalette`) means a colour always
signifies the same category, whether on a map marker, a filter chip or a card tag.
`design/tokens.ts` is the source of truth if this paragraph ever drifts.

---

## Checks

```bash
npm test                 # Jest unit tests (lib/)
npm run typecheck        # tsc --noEmit
npx expo export --platform android   # verify the bundle builds
```

## Distributing a build

Expo Go is enough for development and live demos. For an installable APK, see
`eas.json` and [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) — remember EAS
never sees your git-ignored `.env`, so the `EXPO_PUBLIC_*` values must be set
with `eas env:create` first.
