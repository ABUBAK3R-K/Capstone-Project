export interface LatLng {
  lat: number;
  lng: number;
}

/** Bengaluru city centre — the fallback whenever device location is unavailable. */
export const FALLBACK_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 };

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. Accurate enough at city scale. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** "220 m" / "1.4 km" / "12 km" — never more precision than is meaningful. */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '';
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * Decodes a PostGIS point.
 *
 * `nearby_places` / `search_places` already unpack location into lat+lng, but
 * `problem_reports.location` is a raw `geography` column, and PostgREST
 * serialises that as hex EWKB (e.g. "0101000020E6100000...."). Rather than add
 * a migration for one column, we decode it here.
 *
 * Also tolerates a GeoJSON object, in case the column is ever exposed that way.
 */
export function parsePostgisPoint(value: unknown): LatLng | null {
  if (!value) return null;

  if (typeof value === 'object') {
    const geo = value as { coordinates?: unknown };
    if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
      const [lng, lat] = geo.coordinates as number[];
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }
    return null;
  }

  if (typeof value !== 'string') return null;
  return decodeEwkbHexPoint(value);
}

function decodeEwkbHexPoint(hex: string): LatLng | null {
  const clean = hex.trim();
  // Byte order (1) + type (4) + optional SRID (4) + two doubles (16).
  if (clean.length < 42 || /[^0-9a-fA-F]/.test(clean)) return null;

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;

  const geometryType = view.getUint32(1, littleEndian);
  // Low 16 bits carry the base type; 1 === Point. Anything else is not ours.
  if ((geometryType & 0xffff) !== 1) return null;

  // 0x20000000 flags an embedded SRID, which shifts the coordinates by 4 bytes.
  const hasSrid = (geometryType & 0x20000000) !== 0;
  const offset = hasSrid ? 9 : 5;
  if (bytes.length < offset + 16) return null;

  const lng = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** GeoJSON payload accepted by PostgREST when inserting into a geography column. */
export function toGeoJsonPoint({ lat, lng }: LatLng) {
  return { type: 'Point' as const, coordinates: [lng, lat] };
}

/** Map region that comfortably frames the given radius around a point. */
export function regionForRadius(center: LatLng, radiusMeters: number) {
  const latitudeDelta = (radiusMeters * 2.4) / 111_320;
  const lngScale = Math.max(Math.cos(toRadians(center.lat)), 0.01);
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta,
    longitudeDelta: latitudeDelta / lngScale,
  };
}
