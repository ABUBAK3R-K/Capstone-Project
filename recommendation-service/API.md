# Recommendation Service API

Base URL: `http://<HOST>:8000` (default local: `http://localhost:8000`)

---

## `POST /interactions`

Logs a user-place interaction. **The Flutter app must call this every time a user opens a Place Detail screen.**

### Request Body
```json
{
  "user_id": "11111111-1111-1111-1111-111111111111",
  "place_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "interaction_type": "view"
}
```

| Field              | Type   | Required | Notes                                      |
|--------------------|--------|----------|--------------------------------------------|
| `user_id`          | string | yes      | The authenticated Supabase user UUID       |
| `place_id`         | string | yes      | The UUID of the place being viewed         |
| `interaction_type` | string | yes      | One of: `view`, `favorite`, `share`        |

### Response `200 OK`
```json
{ "status": "ok" }
```

### Flutter Usage (for M2)
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> logInteraction(String userId, String placeId) async {
  await http.post(
    Uri.parse('http://<HOST>:8000/interactions'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'user_id': userId,
      'place_id': placeId,
      'interaction_type': 'view',
    }),
  );
}
```
Call this inside `PlaceDetailScreen.initState()`.

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

Manually rebuilds the in-memory similarity matrix from the current database state. Call this after seeding new places.

### Response `200 OK`
```json
{
  "status": "success",
  "message": "Cache rebuilt for 150 places.",
  "cached_places_count": 150
}
```

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
