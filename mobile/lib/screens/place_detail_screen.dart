import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/place.dart';

class PlaceDetailScreen extends StatefulWidget {
  final Place place;

  const PlaceDetailScreen({super.key, required this.place});

  @override
  State<PlaceDetailScreen> createState() => _PlaceDetailScreenState();
}

class _PlaceDetailScreenState extends State<PlaceDetailScreen> {
  List<Place> _similarPlaces = [];
  bool _isLoadingRecs = true;

  // Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator / Web / Desktop
  String get _apiHost {
    try {
      if (Platform.isAndroid) return '10.0.2.2';
    } catch (_) {}
    return '127.0.0.1';
  }

  @override
  void initState() {
    super.initState();
    _logInteraction();
    _fetchSimilarPlaces();
  }

  Future<void> _logInteraction() async {
    try {
      final supabase = Supabase.instance.client;
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) return; // Cannot log without user
      
      await http.post(
        Uri.parse('http://$_apiHost:8000/interactions'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'user_id': userId,
          'place_id': widget.place.id,
          'interaction_type': 'view',
        }),
      ).timeout(const Duration(seconds: 3));
    } catch (e) {
      debugPrint('Failed to log interaction: $e');
    }
  }

  Future<void> _fetchSimilarPlaces() async {
    try {
      final response = await http.get(
        Uri.parse('http://$_apiHost:8000/recommendations?place_id=${widget.place.id}&limit=5'),
      ).timeout(const Duration(seconds: 5));
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final recs = data['recommendations'] as List;
        if (mounted) {
          setState(() {
            _similarPlaces = recs.map((json) => Place.fromJson(json)).toList();
            _isLoadingRecs = false;
          });
        }
      } else {
        throw Exception('Server returned ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Failed to load recommendations: $e');
      if (mounted) {
        setState(() => _isLoadingRecs = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.place.name)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Image Placeholder
            Container(
              height: 200,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.landscape, size: 64, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            
            // Name and Category
            Text(
              widget.place.name,
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Chip(
              label: Text(widget.place.category),
              backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
            ),
            const SizedBox(height: 16),
            
            // Description
            if (widget.place.description != null && widget.place.description!.isNotEmpty) ...[
              Text(
                'Description',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(widget.place.description!, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 24),
            ],
            
            // Recommendation Section
            const Divider(),
            const SizedBox(height: 16),
            Text(
              'Similar Places',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            
            if (_isLoadingRecs)
              const Center(child: CircularProgressIndicator())
            else if (_similarPlaces.isEmpty)
              const Text('No similar places found.')
            else
              Column(
                children: _similarPlaces.map((recPlace) {
                  return Card(
                    elevation: 1,
                    margin: const EdgeInsets.only(bottom: 8.0),
                    child: ListTile(
                      leading: const CircleAvatar(
                        child: Icon(Icons.auto_awesome, color: Colors.white),
                        backgroundColor: Colors.blue,
                      ),
                      title: Text(recPlace.name),
                      subtitle: Text(recPlace.category),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        // Navigate to the recommended place
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => PlaceDetailScreen(place: recPlace),
                          ),
                        );
                      },
                    ),
                  );
                }).toList(),
              ),
          ],
        ),
      ),
    );
  }
}
