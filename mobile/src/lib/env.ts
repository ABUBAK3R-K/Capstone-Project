/**
 * Expo inlines EXPO_PUBLIC_* variables at build time, so they must be read as
 * literal property accesses — `process.env[name]` does not get replaced.
 */
const raw = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  recommendationsUrl: process.env.EXPO_PUBLIC_RECOMMENDATIONS_URL,
  mapTileUrl: process.env.EXPO_PUBLIC_MAP_TILE_URL,
  mapAttribution: process.env.EXPO_PUBLIC_MAP_ATTRIBUTION,
  mapTileSize: process.env.EXPO_PUBLIC_MAP_TILE_SIZE,
  devSkipAuth: process.env.EXPO_PUBLIC_DEV_SKIP_AUTH,
};

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy mobile/.env.example to mobile/.env and fill it in, then restart Expo with --clear.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', raw.supabaseUrl),
  supabaseAnonKey: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', raw.supabaseAnonKey),

  /** FastAPI recommendation service. Empty string disables "Similar places". */
  recommendationsUrl: (raw.recommendationsUrl ?? '').replace(/\/$/, ''),

  /**
   * Raster tile template for the map. Must NOT point at tile.openstreetmap.org —
   * react-native-maps blocks OSM's own tile servers on Android. Use a hosted
   * OSM-style source (Mapbox, MapTiler, Stadia) instead. See .env.example.
   */
  mapTileUrl: raw.mapTileUrl ?? '',
  mapAttribution: raw.mapAttribution ?? '© OpenStreetMap contributors',

  /**
   * Tile edge length in px. Mapbox @2x styles serve 512; MapTiler and most
   * other raster endpoints serve 256. Getting this wrong makes labels render
   * at the wrong scale, so it is configurable rather than assumed.
   */
  mapTileSize: Number(raw.mapTileSize) || 512,

  /** Dev escape hatch: browse without signing in. Reporting stays disabled. */
  devSkipAuth: raw.devSkipAuth?.toLowerCase() === 'true',
} as const;

export const hasRecommendationService = env.recommendationsUrl.length > 0;
export const hasMapTiles = env.mapTileUrl.length > 0;
