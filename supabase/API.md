# Supabase Mobile API Guide

This document outlines the Remote Procedure Calls (RPCs) exposed by Supabase to the `/mobile` app, specifically designed to abstract away the complexity of PostGIS and make integrations simple for Flutter.

## `nearby_places`

Finds places within a given radius, extracting the PostGIS binary format into easily parsable `lat` and `lng` floats.

**Called from:** 
- `/mobile/lib/screens/map_screen.dart` (To populate map markers)
- `/mobile/lib/screens/home_screen.dart` (To fetch 'Nearby Categories' and 'Recently Added Places')

### Parameters
- `lat` (float): User's current latitude.
- `lng` (float): User's current longitude.
- `radius_meters` (int): Search radius in meters.
- `filter_category` (text, optional): Restrict to a specific category (e.g., 'Restaurants'). Supplying `null` returns all.

### Returns
An array of objects:
```json
[
  {
    "id": "uuid",
    "name": "Central Park",
    "category": "Public Parks",
    "subcategory": null,
    "description": "A beautiful park.",
    "lat": 12.9716,
    "lng": 77.5946,
    "address": null,
    "images": null,
    "source": "osm_seed",
    "created_by": null,
    "created_at": "2026-08-15T12:00:00Z"
  }
]
```

### Flutter Usage Example
```dart
final data = await Supabase.instance.client.rpc('nearby_places', params: {
  'lat': 12.9716,
  'lng': 77.5946,
  'radius_meters': 5000,
  'filter_category': null,
});
```

---

## `search_places`

Performs an `ILIKE` search across the `name` and `description` columns, ordering the results strictly by geographic proximity.

**Called from:** 
- (Future Implementation) `/mobile/lib/screens/search_screen.dart`

### Parameters
- `search_query` (text): The string query to search for.
- `lat` (float): User's current latitude (for distance ranking tiebreakers).
- `lng` (float): User's current longitude (for distance ranking tiebreakers).

### Returns
Matches the exact same array shape as `nearby_places`, making it highly reusable in existing UI components.

### Flutter Usage Example
```dart
final data = await Supabase.instance.client.rpc('search_places', params: {
  'search_query': 'cafe',
  'lat': 12.9716,
  'lng': 77.5946,
});
```
