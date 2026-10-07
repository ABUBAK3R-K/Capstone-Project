# Supabase Mobile API Guide

How the `/mobile` app talks to the database. Everything goes through `@supabase/supabase-js` with the
anon key and the signed-in user's session, so **RLS and column grants decide what each call may do**
— the client code is a convenience, not the boundary.

Client code lives in `mobile/src/lib/` (`places.ts`, `interactions.ts`, `reports.ts`, `businesses.ts`,
`bookings.ts`).

---

## RPCs

### `nearby_places(lat, lng, radius_meters, filter_category)`

Places within a radius, nearest first, with the PostGIS location already unpacked to `lat`/`lng`.

| Parameter | Type | Notes |
| :-- | :-- | :-- |
| `lat`, `lng` | float | Centre point |
| `radius_meters` | int | Search radius |
| `filter_category` | text \| null | e.g. `'Shops'`; `null` returns every category |

Returns rows of:
```json
{
  "id": "uuid", "name": "Central Park", "category": "Public Parks", "subcategory": null,
  "description": "A beautiful park.", "lat": 12.9716, "lng": 77.5946, "address": null,
  "images": null, "source": "osm_seed", "created_by": null, "created_at": "2026-08-15T12:00:00Z"
}
```

Used by Home and Map (`fetchNearbyPlaces` in `lib/places.ts`):
```ts
const { data } = await supabase.rpc('nearby_places', {
  lat: 12.9716, lng: 77.5946, radius_meters: 5000, filter_category: null,
});
```

### `search_places(search_query, lat, lng)`

Case-insensitive match on name, description, category or type; **at most 50 results**, nearest first
(migration `010`). Same row shape as `nearby_places`. Note the parameter is `search_query`, not `query`.

Used by the Search screen (`searchPlaces` in `lib/places.ts`):
```ts
const { data } = await supabase.rpc('search_places', { search_query: 'bakery', lat: 12.97, lng: 77.59 });
```

---

## Direct table access

| Table | What the app does | What the database enforces |
| :-- | :-- | :-- |
| `places` | Insert a community contribution (Add a place) | `created_by` must be you, `source` must be `'user_added'`, `id` is server-generated (`009`) |
| `interactions` | Insert `view` / `favorite` / `visit`; read your own saved/visited marks | Insert only as yourself; read only your own; no update/delete (`007`) |
| `problem_reports` | Insert a report; read your own | Insert only as yourself and only as `status = 'reported'` (`009`); read own rows only (authority/admin read all) |
| `profiles` | Read your own; rename yourself | `role` and `account_type` are not client-writable (`007`, `008`) |
| `businesses` | Owner creates/edits their listing; anyone reads approved listings | `verification_status` is admin-only; owner can't reassign `owner_id` (`009`) |
| `business_services` | Owner manages their services; customers read active services of approved businesses | Ownership via the parent business |
| `bookings` | Customer books / orders / cancels; owner accepts, declines, completes | Clients write only `status`; a trigger validates the service/business on insert and allows only `pending → confirmed/declined → completed` (owner) or `pending/confirmed → cancelled` (customer) (`009`, `011`) |

### Storage

| Bucket | Access |
| :-- | :-- |
| `reports` | Public read; authenticated upload — report photos |
| `business-verification` | Private. Owners upload/read under `{business_id}/…`; authority/admin read. The dashboard previews files via short-lived signed URLs |

### Geography columns over PostgREST

Columns read directly from tables (not via the RPCs) — `problem_reports.location`,
`businesses.location` — come back as hex EWKB. `parsePostgisPoint` in `mobile/src/lib/geo.ts`
decodes them. Inserts send GeoJSON (`toGeoJsonPoint`): `{ "type": "Point", "coordinates": [lng, lat] }`.
