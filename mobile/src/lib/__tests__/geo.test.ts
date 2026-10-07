import { distanceMeters, formatDistance, parsePostgisPoint, regionForRadius, toGeoJsonPoint } from '../geo';

/** Hex EWKB for a point, built the way PostGIS serialises it. */
function ewkbHex(lng: number, lat: number, { srid = 4326, littleEndian = true } = {}): string {
  const hasSrid = srid !== null;
  const buffer = new ArrayBuffer(hasSrid ? 25 : 21);
  const view = new DataView(buffer);
  view.setUint8(0, littleEndian ? 1 : 0);
  view.setUint32(1, hasSrid ? 0x20000001 : 1, littleEndian);
  let offset = 5;
  if (hasSrid) {
    view.setUint32(5, srid, littleEndian);
    offset = 9;
  }
  view.setFloat64(offset, lng, littleEndian);
  view.setFloat64(offset + 8, lat, littleEndian);
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('parsePostgisPoint', () => {
  it('decodes little-endian EWKB with an SRID, as PostgREST returns geography', () => {
    expect(parsePostgisPoint(ewkbHex(77.5946, 12.9716))).toEqual({ lat: 12.9716, lng: 77.5946 });
  });

  it('decodes big-endian WKB without an SRID', () => {
    expect(parsePostgisPoint(ewkbHex(-0.1276, 51.5072, { srid: null as never, littleEndian: false }))).toEqual({
      lat: 51.5072,
      lng: -0.1276,
    });
  });

  it('accepts uppercase hex and surrounding whitespace', () => {
    expect(parsePostgisPoint(`  ${ewkbHex(1, 2).toUpperCase()} `)).toEqual({ lat: 2, lng: 1 });
  });

  it('reads GeoJSON as [lng, lat]', () => {
    expect(parsePostgisPoint({ type: 'Point', coordinates: [77.6, 12.9] })).toEqual({ lat: 12.9, lng: 77.6 });
  });

  it.each([null, undefined, '', 'not-hex-at-all', '0101', 42, { coordinates: [1] }, { foo: 'bar' }])(
    'returns null for %p',
    (value) => {
      expect(parsePostgisPoint(value)).toBeNull();
    },
  );

  it('rejects non-point geometries', () => {
    const line = ewkbHex(1, 2).replace(/^01(01)/, '0102'); // type 2 = LineString
    expect(parsePostgisPoint(line)).toBeNull();
  });
});

describe('distanceMeters', () => {
  it('is zero for the same point and symmetric', () => {
    const a = { lat: 12.97, lng: 77.59 };
    const b = { lat: 12.98, lng: 77.6 };
    expect(distanceMeters(a, a)).toBe(0);
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it('matches a known distance (one degree of latitude ≈ 111.2 km)', () => {
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });
});

describe('formatDistance', () => {
  it.each([
    [0, '0 m'],
    [214, '210 m'],
    [949, '950 m'],
    [950, '1.0 km'],
    [1_449, '1.4 km'],
    [9_949, '9.9 km'],
    [12_400, '12 km'],
    [Number.NaN, ''],
    [Number.POSITIVE_INFINITY, ''],
  ])('%p m → %p', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });
});

describe('toGeoJsonPoint', () => {
  it('orders coordinates [lng, lat] as GeoJSON requires', () => {
    expect(toGeoJsonPoint({ lat: 12.9, lng: 77.6 })).toEqual({ type: 'Point', coordinates: [77.6, 12.9] });
  });
});

describe('regionForRadius', () => {
  it('centres on the point and widens longitude away from the equator', () => {
    const region = regionForRadius({ lat: 60, lng: 10 }, 1_000);
    expect(region.latitude).toBe(60);
    expect(region.longitude).toBe(10);
    expect(region.longitudeDelta).toBeCloseTo(region.latitudeDelta * 2, 5);
  });
});
