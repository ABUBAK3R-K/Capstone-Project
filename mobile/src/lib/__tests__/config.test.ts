jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 6 },
}));

import * as Location from 'expo-location';

import { getPreciseLocation } from '../location';

const ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_RECOMMENDATIONS_URL',
  'EXPO_PUBLIC_MAP_TILE_URL',
  'EXPO_PUBLIC_MAP_TILE_SIZE',
  'EXPO_PUBLIC_DEV_SKIP_AUTH',
] as const;

function loadEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  let mod: typeof import('../env') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../env');
  });
  return mod!;
}

// babel-preset-expo inlines EXPO_PUBLIC_* at transform time (that is the
// production behaviour env.ts relies on), so values set at test runtime never
// reach it. Only the unconfigured path is observable here: it must fail fast.
describe('env', () => {
  it('fails fast with an actionable message when Supabase config is missing', () => {
    expect(() => loadEnv({})).toThrow(/Missing EXPO_PUBLIC_SUPABASE_URL.*\.env\.example/);
  });
});

describe('getPreciseLocation', () => {
  it('returns null rather than a guess when permission is refused', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    await expect(getPreciseLocation()).resolves.toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('returns a high-accuracy fix', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({ coords: { latitude: 12.9, longitude: 77.6 } });
    await expect(getPreciseLocation()).resolves.toEqual({ lat: 12.9, lng: 77.6 });
  });
});
