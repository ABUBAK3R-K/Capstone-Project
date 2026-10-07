import { argsOf, mockQuery, type MockQuery } from './supabaseMock';

// env.ts throws at import without EXPO_PUBLIC_* values, and supabase.ts would
// build a real client — neither belongs in a unit test.
jest.mock('../env', () => ({
  env: { recommendationsUrl: 'http://recs.test' },
  hasRecommendationService: true,
}));
jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

import { supabase } from '../supabase';
import { cancelBooking, submitAppointment, submitOrder, updateBookingStatus } from '../bookings';
import { removeBusinessService } from '../businesses';
import { errorMessage } from '../errors';
import { fetchPlaceMarks, logInteraction, recordInteraction } from '../interactions';
import { contributePlace, searchPlaces } from '../places';
import { fetchSimilarPlaces } from '../recommendations';
import type { BusinessService } from '@/types/business';

const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;

/** Queue one mocked query per expected `supabase.from(...)` call. */
function expectQueries(...queries: MockQuery[]): void {
  for (const query of queries) from.mockReturnValueOnce(query.builder);
}

afterEach(() => {
  jest.resetAllMocks();
});

// ─── interactions ───────────────────────────────────────────────────────────

describe('interactions', () => {
  it('records an interaction as the given user', async () => {
    const query = mockQuery({});
    expectQueries(query);

    await recordInteraction('user-1', 'place-1', 'favorite');

    expect(from).toHaveBeenCalledWith('interactions');
    expect(argsOf(query.calls, 'insert')).toEqual([
      { user_id: 'user-1', place_id: 'place-1', interaction_type: 'favorite' },
    ]);
  });

  it('surfaces insert errors from recordInteraction', async () => {
    expectQueries(mockQuery({ error: { message: 'rls violation' } }));
    await expect(recordInteraction('u', 'p', 'visit')).rejects.toEqual({ message: 'rls violation' });
  });

  it('never lets a failed passive view escape logInteraction', async () => {
    expectQueries(mockQuery({ error: { message: 'offline' } }));
    expect(() => logInteraction('u', 'p')).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve)); // let the rejection settle unhandled-free
  });

  it('derives saved/visited from the user’s own favorite/visit rows', async () => {
    const query = mockQuery({ data: [{ interaction_type: 'visit' }, { interaction_type: 'visit' }] });
    expectQueries(query);

    await expect(fetchPlaceMarks('user-1', 'place-1')).resolves.toEqual({ saved: false, visited: true });
    expect(argsOf(query.calls, 'in')).toEqual(['interaction_type', ['favorite', 'visit']]);
  });
});

// ─── places ─────────────────────────────────────────────────────────────────

describe('contributePlace', () => {
  const input = {
    userId: 'user-1',
    name: '  Corner Bakery ',
    category: 'Shops',
    subcategory: ' bakery ',
    description: '',
    address: '  ',
    location: { lat: 12.97, lng: 77.59 },
  };

  it('inserts a trimmed, user-credited row and returns it in RPC shape', async () => {
    const query = mockQuery({ data: { id: 'new-id', created_at: '2026-10-07T10:00:00Z' } });
    expectQueries(query);

    const place = await contributePlace(input);

    expect(argsOf(query.calls, 'insert')).toEqual([
      {
        name: 'Corner Bakery',
        category: 'Shops',
        subcategory: 'bakery',
        description: null,
        address: null,
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        source: 'user_added',
        created_by: 'user-1',
      },
    ]);
    expect(place).toMatchObject({ id: 'new-id', name: 'Corner Bakery', lat: 12.97, lng: 77.59, source: 'user_added' });
  });

  it('never sends an id — ids are server-generated (migration 009)', async () => {
    const query = mockQuery({ data: { id: 'x', created_at: 'y' } });
    expectQueries(query);
    await contributePlace(input);
    expect(argsOf(query.calls, 'insert')?.[0]).not.toHaveProperty('id');
  });

  it('throws the database error', async () => {
    expectQueries(mockQuery({ error: { message: 'new row violates row-level security policy' } }));
    await expect(contributePlace(input)).rejects.toEqual({ message: 'new row violates row-level security policy' });
  });
});

describe('searchPlaces', () => {
  it('skips the round-trip for a blank query', async () => {
    await expect(searchPlaces('   ', { lat: 1, lng: 2 })).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls search_places with the search_query parameter name', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'p' }], error: null });
    await expect(searchPlaces(' bakery ', { lat: 1, lng: 2 })).resolves.toEqual([{ id: 'p' }]);
    expect(rpc).toHaveBeenCalledWith('search_places', { search_query: 'bakery', lat: 1, lng: 2 });
  });
});

// ─── bookings ───────────────────────────────────────────────────────────────

const service: BusinessService = {
  id: 'svc-1',
  business_id: 'biz-1',
  name: 'Haircut',
  description: null,
  price: 200,
  service_type: 'appointment',
  duration_minutes: 30,
  is_active: true,
  created_at: '2026-01-01',
};

describe('bookings', () => {
  it('never sends status or responded_at on insert (server-owned, migration 009)', async () => {
    const appointment = mockQuery({});
    const order = mockQuery({});
    expectQueries(appointment, order);

    await submitAppointment({
      businessId: 'biz-1',
      customerId: 'cust-1',
      service,
      requestedTime: '2026-12-01T10:00:00Z',
      notes: ' ',
    });
    await submitOrder({ businessId: 'biz-1', customerId: 'cust-1', lines: [{ service, quantity: 2 }], notes: '' });

    const appointmentRow = argsOf(appointment.calls, 'insert')?.[0] as Record<string, unknown>;
    const orderRows = argsOf(order.calls, 'insert')?.[0] as Record<string, unknown>[];
    for (const row of [appointmentRow, ...orderRows]) {
      expect(row).not.toHaveProperty('status');
      expect(row).not.toHaveProperty('responded_at');
    }
    expect(appointmentRow.notes).toBeNull();
    expect(orderRows[0]).toMatchObject({ quantity: 2, service_type: 'order' });
  });

  it('groups every line of one order under a single order_group_id', async () => {
    const order = mockQuery({});
    expectQueries(order);

    await submitOrder({
      businessId: 'biz-1',
      customerId: 'cust-1',
      lines: [
        { service, quantity: 1 },
        { service: { ...service, id: 'svc-2' }, quantity: 3 },
      ],
      notes: '',
    });

    const rows = argsOf(order.calls, 'insert')?.[0] as { order_group_id: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].order_group_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows[1].order_group_id).toBe(rows[0].order_group_id);
  });

  it('updates only status', async () => {
    const confirm = mockQuery({});
    const cancel = mockQuery({});
    expectQueries(confirm, cancel);

    await updateBookingStatus('b-1', 'confirmed');
    await cancelBooking('b-2');

    expect(argsOf(confirm.calls, 'update')).toEqual([{ status: 'confirmed' }]);
    expect(argsOf(cancel.calls, 'update')).toEqual([{ status: 'cancelled' }]);
    expect(argsOf(cancel.calls, 'eq')).toEqual(['id', 'b-2']);
  });
});

// ─── businesses ─────────────────────────────────────────────────────────────

describe('removeBusinessService', () => {
  it('deletes an unbooked service', async () => {
    expectQueries(mockQuery({}));
    await expect(removeBusinessService('svc-1')).resolves.toBe('deleted');
  });

  it('hides a booked service instead of failing on the foreign key', async () => {
    const hide = mockQuery({});
    expectQueries(mockQuery({ error: { code: '23503', message: 'violates foreign key constraint' } }), hide);

    await expect(removeBusinessService('svc-1')).resolves.toBe('hidden');
    expect(argsOf(hide.calls, 'update')).toEqual([{ is_active: false }]);
  });

  it('rethrows any other error', async () => {
    expectQueries(mockQuery({ error: { code: '42501', message: 'permission denied' } }));
    await expect(removeBusinessService('svc-1')).rejects.toMatchObject({ code: '42501' });
  });
});

// ─── recommendations ────────────────────────────────────────────────────────

describe('fetchSimilarPlaces', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns the recommendations list', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ recommendations: [{ place_id: 'b' }] }) });
    await expect(fetchSimilarPlaces('a', 5)).resolves.toEqual([{ place_id: 'b' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://recs.test/recommendations?place_id=a&limit=5');
  });

  it('treats 404 (not in the cache yet) as no similar places', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchSimilarPlaces('new-place')).resolves.toEqual([]);
  });

  it('still fails on real errors so the UI can offer a retry', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchSimilarPlaces('a')).rejects.toThrow('Recommendation service responded 500');
  });
});

// ─── errors ─────────────────────────────────────────────────────────────────

describe('errorMessage', () => {
  it.each([
    [new Error('boom'), 'boom'],
    [{ message: 'postgrest says no' }, 'postgrest says no'],
    [{ message: '' }, 'fallback'],
    ['a string', 'fallback'],
    [null, 'fallback'],
  ])('%p → %p', (input, expected) => {
    expect(errorMessage(input, 'fallback')).toBe(expected);
  });
});
