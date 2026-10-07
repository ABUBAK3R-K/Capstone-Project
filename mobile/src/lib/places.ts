import { supabase } from './supabase';
import { parsePostgisPoint, toGeoJsonPoint, type LatLng } from './geo';
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
 * `search_query`, not `query`. Matches name, description, category and type;
 * returns at most the 50 nearest matches (migration 010).
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

export interface ContributePlaceInput {
  userId: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  address: string;
  location: LatLng;
}

/**
 * Community curation: a signed-in user adds a place to the shared catalogue.
 * The insert policy (migration 009) only accepts rows credited to the caller
 * (`created_by = auth.uid()`) with `source = 'user_added'`, and the id is
 * always server-generated.
 *
 * Returns the new row in the same shape the RPCs produce, so the caller can
 * open it straight away without a refetch.
 */
export async function contributePlace(input: ContributePlaceInput): Promise<Place> {
  const row = {
    name: input.name.trim(),
    category: input.category,
    subcategory: input.subcategory.trim() || null,
    description: input.description.trim() || null,
    address: input.address.trim() || null,
  };

  const { data, error } = await supabase
    .from('places')
    .insert({
      ...row,
      location: toGeoJsonPoint(input.location),
      source: 'user_added',
      created_by: input.userId,
    })
    .select('id, created_at')
    .single();

  if (error) throw error;
  return {
    ...row,
    id: data.id as string,
    created_at: data.created_at as string,
    created_by: input.userId,
    lat: input.location.lat,
    lng: input.location.lng,
    images: null,
    source: 'user_added',
  };
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
