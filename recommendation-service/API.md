# Recommendation Service API

Base URL: `http://<HOST>:8000` (default local: `http://localhost:8000`)

---

## `POST /interactions`

Logs a user-place interaction for the **signed-in user who owns the bearer token**. The mobile app
calls this every time a user opens a Place Detail screen (`mobile/src/lib/recommendations.ts`).

The user is taken from the verified Supabase access token, never from the request body: this service
writes over `DATABASE_URL`, which bypasses RLS, so the token check (`security.py`) is the only thing
stopping forged interaction history.

### Headers
| Header          | Required | Notes                                              |
|-----------------|----------|----------------------------------------------------|
| `Authorization` | yes      | `Bearer <Supabase access token>` of the signed-in user |

### Request Body
```json
{
  "place_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "interaction_type": "view"
}
```

| Field              | Type   | Required | Notes                                      |
|--------------------|--------|----------|--------------------------------------------|
| `place_id`         | UUID   | yes      | The place being interacted with            |
| `interaction_type` | string | yes      | One of: `view`, `favorite`, `visit`        |

### Responses
| Status | When |
|--------|------|
| `200`  | `{ "status": "ok" }` |
| `401`  | Missing, invalid, or expired token |
| `422`  | `place_id` isn't a UUID, or `interaction_type` isn't one of the three allowed values |
| `502`  | Supabase Auth couldn't be reached to verify the token |
| `503`  | `SUPABASE_URL` / `SUPABASE_ANON_KEY` aren't configured — the endpoint fails closed |

### Mobile usage
```ts
const { data } = await supabase.auth.getSession();
await fetch(`${env.recommendationsUrl}/interactions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session?.access_token}`,
  },
  body: JSON.stringify({ place_id: placeId, interaction_type: 'view' }),
});
```

---

## `GET /recommendations`

Returns the top-N similar places for a given place, fully hydrated with name, coordinates, and category — no raw PostGIS objects.

### Query Parameters
| Param      | Type   | Default | Notes                          |
|------------|--------|---------|--------------------------------|
| `place_id` | string | —       | Required. The UUID of the place |
| `limit`    | int    | 10      | Max results to return           |

### Example Request
```
GET /recommendations?place_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&limit=5
```

### Response `200 OK`
```json
{
  "place_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "recommendations": [
    {
      "place_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "name": "Central Park",
      "category": "Public Parks",
      "subcategory": null,
      "description": "A beautiful park.",
      "lat": 12.9716,
      "lng": 77.5946,
      "address": null,
      "images": null,
      "similarity_score": 0.8523
    }
  ]
}
```

### Flutter Usage (for M2)
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<List<Place>> getSimilarPlaces(String placeId) async {
  final response = await http.get(
    Uri.parse('http://<HOST>:8000/recommendations?place_id=$placeId&limit=5'),
  );
  final data = jsonDecode(response.body);
  final recs = data['recommendations'] as List;
  return recs.map((json) => Place.fromJson(json)).toList();
}
```
Wire this into the "Similar Places" section of `PlaceDetailScreen`.

---

## `GET /interactions/stats`

Returns interaction volume metrics. Use this to monitor when enough data has accumulated to begin Phase 2 collaborative filtering.

### Response `200 OK`
```json
{
  "total_interactions": 142,
  "unique_users": 12,
  "unique_places": 35
}
```

---

## `POST /recommendations/refresh`

Manually rebuilds the in-memory similarity matrix from the current database state. Call this after
seeding new places or approving businesses. It's an O(N²) rebuild, so it's an operator action: it
requires the `X-Admin-Key` header to match `ADMIN_API_KEY`, and returns `503` if that variable isn't set.

```bash
curl -X POST http://localhost:8000/recommendations/refresh -H "X-Admin-Key: $ADMIN_API_KEY"
```

### Response `200 OK`
```json
{
  "status": "success",
  "message": "Cache rebuilt for 150 places.",
  "cached_places_count": 150
}
```
`403` if the key is missing or wrong.

---

## `GET /health`

Simple health check.

### Response `200 OK`
```json
{
  "status": "healthy",
  "database_configured": true,
  "service": "recommendation-service"
}
```
