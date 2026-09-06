import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  DEFAULT_RADIUS_M,
  WIDE_RADIUS_M,
  fetchNearbyPlaces,
  fetchVisibleReports,
} from '@/lib/places';
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
