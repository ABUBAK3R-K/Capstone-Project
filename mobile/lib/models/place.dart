class Place {
  final String id;
  final String name;
  final String category;
  final String? subcategory;
  final String? description;
  final double lat;
  final double lng;
  final String? address;
  final List<String>? images;
  final String? source;

  Place({
    required this.id,
    required this.name,
    required this.category,
    this.subcategory,
    this.description,
    required this.lat,
    required this.lng,
    this.address,
    this.images,
    this.source,
  });

  factory Place.fromJson(Map<String, dynamic> json) {
    return Place(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String,
      subcategory: json['subcategory'] as String?,
      description: json['description'] as String?,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      address: json['address'] as String?,
      images: (json['images'] as List?)?.map((e) => e as String).toList(),
      source: json['source'] as String?,
    );
  }
}
