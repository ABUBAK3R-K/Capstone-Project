import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DEFAULT_RADIUS_M,
  WIDE_RADIUS_M,
  contributePlace,
  fetchNearbyPlaces,
  fetchVisibleReports,
  searchPlaces,
} from '@/lib/places';
import { fetchPlaceMarks, recordInteraction, type PlaceMarks } from '@/lib/interactions';
import { fetchSimilarPlaces } from '@/lib/recommendations';
import { distanceMeters, type LatLng } from '@/lib/geo';
import { PLACE_CATEGORIES } from '@/constants/categories';
import type { Place } from '@/types/place';

/** Round the key so tiny GPS jitter does not invalidate the cache constantly. */
const keyFor = (center: LatLng) => [center.lat.toFixed(3), center.lng.toFixed(3)];

export function useNearbyPlaces(
  center: LatLng,
  options: { radius?: number; category?: string | null; enabled?: boolean } = {},
) {
  const { radius = DEFAULT_RADIUS_M, category = null, enabled = true } = options;

  return useQuery({
    queryKey: ['nearby-places', ...keyFor(center), radius, category],
    queryFn: () => fetchNearbyPlaces(center, { radius, category }),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

/** Wider net for the Home feed so the rails are not empty in sparse areas. */
export function useHomePlaces(center: LatLng, enabled = true) {
  const query = useNearbyPlaces(center, { radius: WIDE_RADIUS_M, enabled });

  const derived = useMemo(() => {
    const places = query.data ?? [];

    // Category counts, ordered by the canonical list rather than by frequency,
    // so the rail does not reshuffle between refetches.
    const counts = new Map<string, number>();
    for (const place of places) {
      counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
    }
    const categories = PLACE_CATEGORIES.filter((meta) => counts.has(meta.name)).map((meta) => ({
      ...meta,
      count: counts.get(meta.name) ?? 0,
    }));

    // The RPC orders by distance; "recently added" needs created_at instead.
    const recent = [...places]
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, 8);

    return { places, categories, recent, closest: places.slice(0, 8) };
  }, [query.data]);

  return { ...query, ...derived };
}

/** Shortest query worth sending — one letter matches most of the catalogue. */
export const MIN_SEARCH_LENGTH = 2;

/** `query` should already be debounced by the caller. */
export function useSearchPlaces(query: string, center: LatLng, enabled = true) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ['search-places', trimmed.toLowerCase(), ...keyFor(center)],
    queryFn: () => searchPlaces(trimmed, center),
    enabled: enabled && trimmed.length >= MIN_SEARCH_LENGTH,
    // Keep the previous result list on screen while the next query loads,
    // instead of flashing back to a skeleton on every keystroke.
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}

export function useContributePlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: contributePlace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nearby-places'] });
      void queryClient.invalidateQueries({ queryKey: ['search-places'] });
    },
  });
}

/** Saved / visited state for one place, for a signed-in user. */
export function usePlaceMarks(userId: string | undefined, placeId: string) {
  return useQuery({
    queryKey: ['place-marks', userId, placeId],
    queryFn: () => fetchPlaceMarks(userId!, placeId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Records a favorite/visit. The interaction log is append-only (007), so a
 * mark can't be undone — the UI treats each as a one-way action. The marks
 * cache is updated optimistically and rolled back if the insert fails.
 */
export function useMarkPlace(userId: string | undefined, placeId: string) {
  const queryClient = useQueryClient();
  const key = ['place-marks', userId, placeId];

  return useMutation({
    mutationFn: (type: 'favorite' | 'visit') => recordInteraction(userId!, placeId, type),
    onMutate: async (type) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PlaceMarks>(key);
      const base = previous ?? { saved: false, visited: false };
      queryClient.setQueryData<PlaceMarks>(key, {
        ...base,
        ...(type === 'favorite' ? { saved: true } : { visited: true }),
      });
      return { previous };
    },
    onError: (_error, _type, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
  });
}

export function useSimilarPlaces(placeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['similar-places', placeId],
    queryFn: () => fetchSimilarPlaces(placeId!, 8),
    enabled: Boolean(placeId) && enabled,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

/** Reports the user is allowed to see, annotated with distance from `center`. */
export function useNearbyReports(center: LatLng, enabled = true) {
  const query = useQuery({
    queryKey: ['visible-reports'],
    queryFn: () => fetchVisibleReports(20),
    enabled,
    staleTime: 60 * 1000,
  });

  const reports = useMemo(() => {
    return (query.data ?? [])
      .map((report) => ({
        ...report,
        distance:
          report.lat != null && report.lng != null
            ? distanceMeters(center, { lat: report.lat, lng: report.lng })
            : null,
      }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }, [center, query.data]);

  return { ...query, reports };
}

export function withDistance(places: Place[], center: LatLng) {
  return places.map((place) => ({
    ...place,
    distance: distanceMeters(center, { lat: place.lat, lng: place.lng }),
  }));
}

export type PlaceWithDistance = Place & { distance: number };
