import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';

import { FALLBACK_CENTER, type LatLng } from '@/lib/geo';

type Status = 'resolving' | 'granted' | 'fallback';

interface LocationContextValue {
  coords: LatLng | null;
  /** Never null once resolution finishes — safe to key queries on. */
  center: LatLng;
  isResolving: boolean;
  /** True when we fell back to the city centre instead of a real fix. */
  isFallback: boolean;
  retry: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Resolves the device position once for the whole app.
 *
 * Home, Map and Profile all need coordinates. Resolving per-screen fired three
 * concurrent permission requests and three GPS fixes on cold start, so this is
 * hoisted to a single provider.
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>('resolving');

  const resolve = useCallback(async () => {
    setStatus('resolving');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setCoords(FALLBACK_CENTER);
        setStatus('fallback');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setStatus('granted');
    } catch {
      setCoords(FALLBACK_CENTER);
      setStatus('fallback');
    }
  }, []);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  const value = useMemo<LocationContextValue>(
    () => ({
      coords,
      center: coords ?? FALLBACK_CENTER,
      isResolving: status === 'resolving',
      isFallback: status === 'fallback',
      retry: () => void resolve(),
    }),
    [coords, resolve, status],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used inside <LocationProvider>');
  return context;
}
