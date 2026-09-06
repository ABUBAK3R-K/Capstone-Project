import * as Location from 'expo-location';

import type { LatLng } from './geo';

/**
 * One-shot high-accuracy fix used by the report flow, where the coordinate is
 * the evidence rather than just a query centre. Returns null if permission is
 * refused, so the caller can prompt rather than submit a wrong location.
 */
export async function getPreciseLocation(): Promise<LatLng | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}
