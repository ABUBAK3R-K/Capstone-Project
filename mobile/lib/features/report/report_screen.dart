import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  File? _imageFile;
  Position? _location;
  final _descriptionController = TextEditingController();
  
  bool _isSubmitting = false;
  bool _uploadFailed = false;
  String? _failureMessage;
  String _selectedCategory = 'Pothole';
  final List<String> _categories = [
    'Pothole',
    'Garbage',
    'Street Light',
    'Water Leakage',
    'Damaged Road',
    'Other'
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _captureImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.camera, 
      imageQuality: 70
    );
    
    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
        _uploadFailed = false;
        _failureMessage = null;
      });
      // Auto-capture GPS the moment photo is taken
      await _captureLocation();
    }
  }

  Future<void> _pickFromGallery() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 70,
    );
    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
        _uploadFailed = false;
        _failureMessage = null;
      });
      await _captureLocation();
    }
  }

  Future<void> _captureLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return;

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) return;
      }
      
      final position = await Geolocator.getCurrentPosition();
      setState(() => _location = position);
    } catch (e) {
      debugPrint('Location error: $e');
    }
  }

  Future<String?> _uploadImage() async {
    if (_imageFile == null) return null;

    final supabase = Supabase.instance.client;
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('User not logged in');

    final fileName = '$userId-${DateTime.now().millisecondsSinceEpoch}.jpg';
    final path = 'public/$fileName';

    // Attempt upload with retry
    const maxRetries = 3;
    for (int attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await supabase.storage.from('reports').upload(path, _imageFile!);
        return supabase.storage.from('reports').getPublicUrl(path);
      } catch (e) {
        debugPrint('Upload attempt $attempt failed: $e');
        if (attempt == maxRetries) rethrow;
        // Brief pause before retry
        await Future.delayed(Duration(seconds: attempt));
      }
    }
    return null;
  }

  Future<void> _submitReport() async {
    if (_imageFile == null || _location == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please capture an image and ensure location is enabled.')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
      _uploadFailed = false;
      _failureMessage = null;
    });

    try {
      // 1. Upload image (with auto-retry)
      final imageUrl = await _uploadImage();
      if (imageUrl == null) throw Exception('Photo upload returned no URL');

      // 2. Insert into problem_reports
      final supabase = Supabase.instance.client;
      final userId = supabase.auth.currentUser!.id;
      final locationGeoJson = {
        'type': 'Point',
        'coordinates': [_location!.longitude, _location!.latitude]
      };

      await supabase.from('problem_reports').insert({
        'user_id': userId,
        'photo_url': imageUrl,
        'category': _selectedCategory,
        'location': locationGeoJson,
        'description': _descriptionController.text.trim(),
        'status': 'reported'
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Report submitted successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        // Reset form
        setState(() {
          _imageFile = null;
          _location = null;
          _descriptionController.clear();
          _uploadFailed = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _uploadFailed = true;
          _failureMessage = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report an Issue')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Image Preview Area
            GestureDetector(
              onTap: _captureImage,
              child: Container(
                height: 200,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[400]!),
                ),
                child: _imageFile != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.file(_imageFile!, fit: BoxFit.cover, width: double.infinity),
                      )
                    : const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.camera_alt, size: 48, color: Colors.grey),
                          SizedBox(height: 8),
                          Text('Tap to take a photo'),
                        ],
                      ),
              ),
            ),

            const SizedBox(height: 8),

            // Gallery option
            TextButton.icon(
              onPressed: _pickFromGallery,
              icon: const Icon(Icons.photo_library),
              label: const Text('Or pick from gallery'),
            ),
            
            const SizedBox(height: 8),
            
            // Location Indicator
            if (_location != null)
              Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.green, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Location acquired: ${_location!.latitude.toStringAsFixed(4)}, ${_location!.longitude.toStringAsFixed(4)}',
                      style: const TextStyle(color: Colors.green),
                    ),
                  ),
                ],
              ),
              
            const SizedBox(height: 24),
            
            // Category Dropdown
            DropdownButtonFormField<String>(
              value: _selectedCategory,
              decoration: const InputDecoration(
                labelText: 'Category',
                border: OutlineInputBorder(),
              ),
              items: _categories.map((cat) {
                return DropdownMenuItem(value: cat, child: Text(cat));
              }).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedCategory = val);
              },
            ),
            
            const SizedBox(height: 16),
            
            // Description Field
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description (Optional)',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
              maxLines: 4,
            ),
            
            const SizedBox(height: 24),

            // Upload failure banner with retry
            if (_uploadFailed) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red[300]!),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red[700]),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Submission failed. Your report was not lost.',
                            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red[700]),
                          ),
                        ),
                      ],
                    ),
                    if (_failureMessage != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        _failureMessage!,
                        style: TextStyle(fontSize: 12, color: Colors.red[400]),
                      ),
                    ],
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _submitReport,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Retry Submission'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red[600],
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            
            // Submit Button
            _isSubmitting
                ? const Center(child: CircularProgressIndicator())
                : ElevatedButton.icon(
                    onPressed: _submitReport,
                    icon: const Icon(Icons.send),
                    label: const Text('Submit Report'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}
