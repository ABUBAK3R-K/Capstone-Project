// Dummy models for now, pending real API integration
class Place {
  final String id;
  final String name;
  final String category;
  Place({required this.id, required this.name, required this.category});
}

class Problem {
  final String id;
  final String title;
  final String status;
  Problem({required this.id, required this.title, required this.status});
}

class PlacesService {
  // Later we'll inject Supabase client here and query real Postgres tables
  
  Future<List<String>> getCategories() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return ['Restaurants', 'Shops', 'Religious', 'Public Parks'];
  }

  Future<List<Place>> getRecentPlaces() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return [
      Place(id: '1', name: 'Downtown Cafe', category: 'Restaurants'),
      Place(id: '2', name: 'Central Park', category: 'Public Parks'),
      Place(id: '3', name: 'Local Grocer', category: 'Shops'),
    ];
  }

  Future<List<Problem>> getNearbyProblems() async {
    await Future.delayed(const Duration(milliseconds: 500));
    return [
      Problem(id: '101', title: 'Pothole on Main St', status: 'reported'),
      Problem(id: '102', title: 'Broken Streetlight', status: 'in_progress'),
    ];
  }
}
