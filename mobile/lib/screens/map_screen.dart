import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../services/places_service.dart';
import '../models/place.dart';
import 'place_detail_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  LatLng? _currentPosition;
  bool _isLoading = true;
  List<Place> _places = [];
  String? _selectedCategory;
  final List<String> _categories = ['All', 'Restaurants', 'Shops', 'Religious', 'Public Parks'];
  
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
          _currentPosition = LatLng(position.latitude, position.longitude);
        });
        _fetchPlaces();
      }
    } catch (e) {
      // Fallback to Bengaluru center
      if (mounted) {
        setState(() {
          _currentPosition = const LatLng(12.9716, 77.5946);
        });
        _fetchPlaces();
      }
    }
  }

  Future<void> _fetchPlaces() async {
    if (_currentPosition == null) return;
    
    setState(() => _isLoading = true);
    
    final service = context.read<PlacesService>();
    final categoryFilter = _selectedCategory == 'All' ? null : _selectedCategory;
    
    final places = await service.getNearbyPlaces(
      _currentPosition!.latitude, 
      _currentPosition!.longitude, 
      category: categoryFilter,
    );
    
    if (mounted) {
      setState(() {
        _places = places;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_currentPosition == null && _isLoading) {
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Locating you...'),
            ],
          ),
        ),
      );
    }

    final center = _currentPosition ?? const LatLng(12.9716, 77.5946);

    return Scaffold(
      appBar: AppBar(title: const Text('City Map')),
      body: Stack(
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: center,
              initialZoom: 14.0,
            ),
            children: [
              // OpenStreetMap configuration. Zero paid APIs.
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.example.cityguide',
              ),
              MarkerLayer(
                markers: _places.map((place) {
                  return Marker(
                    point: LatLng(place.lat, place.lng),
                    width: 40,
                    height: 40,
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => PlaceDetailScreen(place: place)),
                        );
                      },
                      child: const Icon(
                        Icons.location_on,
                        color: Colors.red,
                        size: 40,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          
          // Category Filter Chips overlay
          Positioned(
            top: 10,
            left: 0,
            right: 0,
            child: SizedBox(
              height: 40,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                itemCount: _categories.length,
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  final isSelected = _selectedCategory == cat || (_selectedCategory == null && cat == 'All');
                  
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: FilterChip(
                      label: Text(cat),
                      selected: isSelected,
                      onSelected: (bool selected) {
                        setState(() {
                          _selectedCategory = cat;
                        });
                        _fetchPlaces();
                      },
                      backgroundColor: Colors.white,
                      selectedColor: Theme.of(context).colorScheme.primaryContainer,
                      elevation: 4,
                    ),
                  );
                },
              ),
            ),
          ),
          
          // Loading indicator overlay
          if (_isLoading && _currentPosition != null)
            const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
