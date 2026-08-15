import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import '../services/places_service.dart';
import '../models/place.dart';
import 'place_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  double? _lat;
  double? _lng;
  bool _isLoadingLoc = true;

  @override
  void initState() {
    super.initState();
    _determinePosition();
  }

  Future<void> _determinePosition() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) throw Exception('Location disabled');

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) throw Exception('Location denied');
      }
      
      final position = await Geolocator.getCurrentPosition();
      if (mounted) {
        setState(() {
          _lat = position.latitude;
          _lng = position.longitude;
          _isLoadingLoc = false;
        });
      }
    } catch (e) {
      // Fallback to Bengaluru center if location fails
      if (mounted) {
        setState(() {
          _lat = 12.9716;
          _lng = 77.5946;
          _isLoadingLoc = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingLoc || _lat == null || _lng == null) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Acquiring location...'),
            ],
          ),
        ),
      );
    }

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
              _buildRecentPlaces(placesService, context),
              
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
      future: service.getCategories(_lat!, _lng!),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        
        final categories = snapshot.data!;
        if (categories.isEmpty) return const Text('No categories nearby.');

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

  Widget _buildRecentPlaces(PlacesService service, BuildContext context) {
    return FutureBuilder<List<Place>>(
      future: service.getRecentPlaces(_lat!, _lng!),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
        
        final places = snapshot.data!;
        if (places.isEmpty) return const Text('No places found recently.');

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
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => PlaceDetailScreen(place: place)),
                );
              },
            ),
          )).toList(),
        );
      },
    );
  }

  // Pending real wiring
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
