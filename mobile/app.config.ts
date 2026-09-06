import type { ExpoConfig } from 'expo/config';

/**
 * Runtime configuration is read from EXPO_PUBLIC_* env vars (see .env.example),
 * which Expo inlines into the bundle automatically. Anything genuinely secret
 * must not live here — the anon key is safe because RLS is what protects data.
 */
const config: ExpoConfig = {
  name: 'CityGuide',
  slug: 'cityguide',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'cityguide',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#16181D',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.cityguide.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'CityGuide uses your location to show places and civic issues near you.',
      NSCameraUsageDescription:
        'CityGuide uses the camera so you can photograph a civic issue when reporting it.',
      NSPhotoLibraryUsageDescription:
        'CityGuide needs photo access so you can attach an existing picture to a report.',
    },
  },
  android: {
    package: 'com.cityguide.app',
    adaptiveIcon: {
      backgroundColor: '#16181D',
    },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
    ],
  },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'CityGuide uses your location to show places and civic issues near you.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'CityGuide needs photo access so you can attach an existing picture to a report.',
        cameraPermission:
          'CityGuide uses the camera so you can photograph a civic issue when reporting it.',
      },
    ],
    'expo-font',
  ],
  experiments: {
    typedRoutes: false,
  },
};

export default config;
