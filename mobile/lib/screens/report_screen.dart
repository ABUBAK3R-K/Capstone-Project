import 'package:flutter/material.dart';

class ReportScreen extends StatelessWidget {
  const ReportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report an Issue')),
      body: const Center(
        child: Text(
          'Civic reporting flow coming soon in Phase 2.',
          style: TextStyle(fontSize: 16),
        ),
      ),
    );
  }
}
