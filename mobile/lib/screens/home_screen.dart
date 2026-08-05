import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/places_service.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Read the service from the provider tree
    final placesService = context.read<PlacesService>();

    return Scaffold(
      appBar: AppBar(title: const Text('CityGuide Home')),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle(context, 'Nearby Categories'),
              _buildCategories(placesService),
              
              const SizedBox(height: 24),
              _buildSectionTitle(context, 'Recently Added Places'),
              _buildRecentPlaces(placesService),
              
              const SizedBox(height: 24),
              _buildSectionTitle(context, 'Problems Near You'),
              _buildNearbyProblems(placesService),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Text(
        title, 
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildCategories(PlacesService service) {
    return FutureBuilder<List<String>>(
      future: service.getCategories(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        
        final categories = snapshot.data!;
        return SizedBox(
          height: 40,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: categories.length,
            itemBuilder: (context, index) {
              return Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: Chip(
                  label: Text(categories[index]),
                  backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildRecentPlaces(PlacesService service) {
    return FutureBuilder<List<Place>>(
      future: service.getRecentPlaces(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        
        final places = snapshot.data!;
        return Column(
          children: places.map((place) => Card(
            elevation: 2,
            margin: const EdgeInsets.only(bottom: 12.0),
            child: ListTile(
              leading: const CircleAvatar(
                child: Icon(Icons.place),
              ),
              title: Text(place.name),
              subtitle: Text(place.category),
              trailing: const Icon(Icons.chevron_right),
            ),
          )).toList(),
        );
      },
    );
  }

  Widget _buildNearbyProblems(PlacesService service) {
    return FutureBuilder<List<Problem>>(
      future: service.getNearbyProblems(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        
        final problems = snapshot.data!;
        return Column(
          children: problems.map((problem) => Card(
            elevation: 2,
            margin: const EdgeInsets.only(bottom: 12.0),
            child: ListTile(
              leading: const CircleAvatar(
                backgroundColor: Colors.orange,
                child: Icon(Icons.warning, color: Colors.white),
              ),
              title: Text(problem.title),
              subtitle: Text('Status: ${problem.status}'),
            ),
          )).toList(),
        );
      },
    );
  }
}
