import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/place.dart';

// We'll keep Problem here temporarily as a dummy until we wire it up fully
class Problem {
  final String id;
  final String title;
  final String status;
  Problem({required this.id, required this.title, required this.status});
}

class PlacesService {
  final _supabase = Supabase.instance.client;
  
  /// Fetches real nearby places from the PostGIS database via Supabase RPC
  Future<List<Place>> getNearbyPlaces(double lat, double lng, {int radius = 5000, String? category}) async {
    try {
      final response = await _supabase.rpc('nearby_places', params: {
        'lat': lat,
        'lng': lng,
        'radius_meters': radius,
        'filter_category': category,
      });

      final List<dynamic> data = response as List<dynamic>;
      return data.map((json) => Place.fromJson(json)).toList();
    } catch (e) {
      print('Error fetching nearby places: $e');
      return [];
    }
  }

  /// Extracts unique categories from the nearby places
  Future<List<String>> getCategories(double lat, double lng) async {
    final places = await getNearbyPlaces(lat, lng);
    final categories = places.map((p) => p.category).toSet().toList();
    return categories.isNotEmpty ? categories : ['Shops', 'Religious', 'Public Parks'];
  }

  /// Fetches a small list of recent places for the home screen
  Future<List<Place>> getRecentPlaces(double lat, double lng) async {
    final places = await getNearbyPlaces(lat, lng, radius: 10000);
    return places.take(5).toList();
  }

  // Still dummy for now
  Future<List<Problem>> getNearbyProblems() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return [
      Problem(id: '101', title: 'Pothole on Main St', status: 'reported'),
      Problem(id: '102', title: 'Broken Streetlight', status: 'in_progress'),
    ];
  }
}
