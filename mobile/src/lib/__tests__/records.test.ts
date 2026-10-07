import { argsOf, mockQuery, type MockQuery } from './supabaseMock';

jest.mock('../env', () => ({ env: { recommendationsUrl: '' }, hasRecommendationService: false }));

const mockStorageBucket = { upload: jest.fn(), getPublicUrl: jest.fn() };
jest.mock('../supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), storage: { from: jest.fn(() => mockStorageBucket) } },
}));

import { supabase } from '../supabase';
import { fetchBusinessBookings, fetchCustomerBookings } from '../bookings';
import {
  addVerificationDocument,
  createBusiness,
  createBusinessService,
  fetchActiveBusinessServices,
  fetchAllBusinessServices,
  fetchBusinessById,
  fetchOwnBusiness,
  setServiceActive,
  updateBusiness,
  uploadVerificationDocument,
} from '../businesses';
import { fetchNearbyPlaces, fetchVisibleReports } from '../places';
import { base64ToBytes, submitReport, uploadReportPhoto } from '../reports';
import type { Business } from '@/types/business';

const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;

function expectQueries(...queries: MockQuery[]): void {
  for (const query of queries) from.mockReturnValueOnce(query.builder);
}

/** Hex EWKB for POINT(lng lat), SRID 4326 — how PostgREST returns geography. */
function ewkb(lng: number, lat: number): string {
  const view = new DataView(new ArrayBuffer(25));
  view.setUint8(0, 1);
  view.setUint32(1, 0x20000001, true);
  view.setUint32(5, 4326, true);
  view.setFloat64(9, lng, true);
  view.setFloat64(17, lat, true);
  return Array.from(new Uint8Array(view.buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

afterEach(() => {
  jest.clearAllMocks();
  from.mockReset();
  rpc.mockReset();
  mockStorageBucket.upload.mockReset();
  mockStorageBucket.getPublicUrl.mockReset();
});

// ─── places ─────────────────────────────────────────────────────────────────

describe('places reads', () => {
  it('calls nearby_places with defaults', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'p' }], error: null });
    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 })).resolves.toEqual([{ id: 'p' }]);
    expect(rpc).toHaveBeenCalledWith('nearby_places', { lat: 1, lng: 2, radius_meters: 5000, filter_category: null });
  });

  it('throws nearby_places errors', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });
    await expect(fetchNearbyPlaces({ lat: 1, lng: 2 }, { radius: 10, category: 'Shops' })).rejects.toEqual({
      message: 'rpc failed',
    });
  });

  it('decodes report locations from EWKB and defaults status', async () => {
    expectQueries(
      mockQuery({
        data: [
          { id: 'r1', category: 'Pothole', location: ewkb(77.59, 12.97), status: 'fixed', created_at: 'c' },
          { id: 'r2', category: null, location: null, status: null, created_at: 'c' },
        ],
      }),
    );

    const [first, second] = await fetchVisibleReports(5);

    expect(first).toMatchObject({ id: 'r1', lat: 12.97, lng: 77.59, status: 'fixed' });
    expect(second).toMatchObject({ id: 'r2', lat: null, lng: null, status: 'reported' });
  });
});

// ─── reports ────────────────────────────────────────────────────────────────

describe('reports', () => {
  it('decodes base64 without atob', () => {
    expect(Array.from(base64ToBytes('SGVsbG8='))).toEqual([72, 101, 108, 108, 111]);
    expect(Array.from(base64ToBytes('SGk\n'))).toEqual([72, 105]);
  });

  it('uploads the photo then inserts a reported row as the user', async () => {
    mockStorageBucket.upload.mockResolvedValueOnce({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://cdn/x.jpg' } });
    const insert = mockQuery({});
    expectQueries(insert);

    await submitReport({
      userId: 'u1',
      photoBase64: 'SGVsbG8=',
      category: 'Garbage',
      description: '  ',
      location: { lat: 12.9, lng: 77.6 },
    });

    expect(argsOf(insert.calls, 'insert')).toEqual([
      {
        user_id: 'u1',
        photo_url: 'https://cdn/x.jpg',
        category: 'Garbage',
        location: { type: 'Point', coordinates: [77.6, 12.9] },
        description: null,
        status: 'reported',
      },
    ]);
  });

  it('retries a failed upload and gives up with the last error', async () => {
    jest.useFakeTimers();
    mockStorageBucket.upload.mockResolvedValue({ error: new Error('network') });

    const attempt = uploadReportPhoto('SGVsbG8=', 'u1', 2);
    const settled = expect(attempt).rejects.toThrow('network');
    await jest.advanceTimersByTimeAsync(5_000);
    await settled;

    expect(mockStorageBucket.upload).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

// ─── businesses ─────────────────────────────────────────────────────────────

const businessRow = {
  id: 'b1',
  owner_id: 'o1',
  name: 'Salon',
  category: 'Shops',
  description: null,
  location: ewkb(77.6, 12.9),
  address: null,
  operating_hours: null,
  contact_phone: null,
  contact_email: null,
  offers: null,
  verification_status: 'pending',
  verification_documents: null,
  created_at: 'c',
};

describe('businesses', () => {
  it('maps a business row, decoding its location', async () => {
    expectQueries(mockQuery({ data: businessRow }), mockQuery({ data: null }));

    await expect(fetchOwnBusiness('o1')).resolves.toMatchObject({ id: 'b1', lat: 12.9, lng: 77.6, operating_hours: {} });
    await expect(fetchBusinessById('missing')).resolves.toBeNull();
  });

  it('creates a business without a client-chosen verification status', async () => {
    const insert = mockQuery({ data: businessRow });
    expectQueries(insert);

    await createBusiness({
      ownerId: 'o1',
      name: ' Salon ',
      category: 'Shops',
      description: '',
      location: { lat: 12.9, lng: 77.6 },
      address: '',
      contactPhone: ' 123 ',
      contactEmail: '',
    });

    const sent = argsOf(insert.calls, 'insert')?.[0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('verification_status');
    expect(sent).toMatchObject({ name: 'Salon', contact_phone: '123', description: null });
  });

  it('converts a location patch to GeoJSON and appends verification documents', async () => {
    const update = mockQuery({});
    const docs = mockQuery({});
    expectQueries(update, docs);

    await updateBusiness('b1', { name: 'New', location: { lat: 1, lng: 2 } });
    await addVerificationDocument({ ...businessRow, verification_documents: ['b1/a.jpg'] } as unknown as Business, 'b1/b.jpg');

    expect(argsOf(update.calls, 'update')).toEqual([{ name: 'New', location: { type: 'Point', coordinates: [2, 1] } }]);
    expect(argsOf(docs.calls, 'update')).toEqual([{ verification_documents: ['b1/a.jpg', 'b1/b.jpg'] }]);
  });

  it('uploads verification documents under the business folder', async () => {
    mockStorageBucket.upload.mockResolvedValueOnce({ error: null });
    const path = await uploadVerificationDocument('b1', new Uint8Array([1]), 'jpg');
    expect(path).toMatch(/^b1\/\d+\.jpg$/);
  });

  it('maps services and only sends duration for appointments', async () => {
    const serviceRow = { id: 's1', business_id: 'b1', name: 'Cut', price: '200.00', service_type: 'order', is_active: 1 };
    const create = mockQuery({ data: serviceRow });
    expectQueries(create, mockQuery({ data: [serviceRow] }), mockQuery({ data: [] }), mockQuery({}));

    const created = await createBusinessService({
      businessId: 'b1',
      name: 'Cut',
      description: '',
      price: '200',
      serviceType: 'order',
      durationMinutes: '30',
    });
    expect(created).toMatchObject({ price: 200, is_active: true });
    expect((argsOf(create.calls, 'insert')?.[0] as Record<string, unknown>).duration_minutes).toBeNull();

    await expect(fetchAllBusinessServices('b1')).resolves.toHaveLength(1);
    await expect(fetchActiveBusinessServices('b1')).resolves.toEqual([]);
    await expect(setServiceActive('s1', false)).resolves.toBeUndefined();
  });
});

// ─── bookings reads ─────────────────────────────────────────────────────────

describe('booking reads', () => {
  it('flattens embedded service and business names', async () => {
    const bookingRow = {
      id: 'k1',
      business_id: 'b1',
      customer_id: 'c1',
      service_id: 's1',
      service_type: 'order',
      quantity: '2',
      status: 'pending',
      created_at: 'c',
      business_services: { name: 'Cut' },
      businesses: { name: 'Salon' },
    };
    expectQueries(mockQuery({ data: [bookingRow] }), mockQuery({ error: { message: 'denied' } }));

    await expect(fetchCustomerBookings('c1')).resolves.toEqual([
      expect.objectContaining({ quantity: 2, service_name: 'Cut', business_name: 'Salon', notes: null }),
    ]);
    await expect(fetchBusinessBookings('b1')).rejects.toEqual({ message: 'denied' });
  });
});
