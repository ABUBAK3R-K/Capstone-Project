import { supabase } from './supabase';
import { parsePostgisPoint, type LatLng } from './geo';
import type { Place, ProblemReport } from '@/types/place';

export const DEFAULT_RADIUS_M = 5_000;
export const WIDE_RADIUS_M = 10_000;

/**
 * `nearby_places(lat, lng, radius_meters, filter_category)` — returns places
 * ordered by distance, with location already unpacked into lat/lng by the RPC
 * (supabase/migrations/004_api_hardening.sql).
 */
export async function fetchNearbyPlaces(
  center: LatLng,
  options: { radius?: number; category?: string | null } = {},
): Promise<Place[]> {
  const { data, error } = await supabase.rpc('nearby_places', {
    lat: center.lat,
    lng: center.lng,
    radius_meters: options.radius ?? DEFAULT_RADIUS_M,
    filter_category: options.category ?? null,
  });

  if (error) throw error;
  return (data ?? []) as Place[];
}

/**
 * `search_places(search_query, lat, lng)` — note the parameter is named
 * `search_query`, not `query`.
 */
export async function searchPlaces(query: string, center: LatLng): Promise<Place[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.rpc('search_places', {
    search_query: trimmed,
    lat: center.lat,
    lng: center.lng,
  });

  if (error) throw error;
  return (data ?? []) as Place[];
}

/**
 * Civic issues visible to the signed-in user.
 *
 * RLS on problem_reports (supabase/migrations/002_rls_and_functions.sql) only
 * exposes rows the user owns, unless their profile role is authority/admin. So
 * for an ordinary user this is "my reports", and the UI says exactly that
 * rather than implying it is a city-wide feed.
 *
 * `location` comes back as hex EWKB because it is a raw geography column, so it
 * is decoded client-side; there is no server-side radius filter available here.
 */
export async function fetchVisibleReports(limit = 20): Promise<ProblemReport[]> {
  const { data, error } = await supabase
    .from('problem_reports')
    .select('id, category, description, photo_url, status, created_at, resolved_at, location')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const point = parsePostgisPoint((row as { location?: unknown }).location);
    return {
      id: row.id as string,
      category: row.category as string | null,
      description: row.description as string | null,
      photo_url: row.photo_url as string | null,
      status: (row.status ?? 'reported') as ProblemReport['status'],
      created_at: row.created_at as string,
      resolved_at: row.resolved_at as string | null,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    };
  });
}
