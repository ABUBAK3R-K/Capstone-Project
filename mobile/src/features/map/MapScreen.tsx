import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Chip } from '@/design/components/Chip';
import { EmptyState } from '@/design/components/EmptyState';
import { Text } from '@/design/typography';
import { palette, radius, shadows, spacing } from '@/design/tokens';
import { PLACE_CATEGORIES } from '@/constants/categories';
import { env, hasMapTiles } from '@/lib/env';
import { distanceMeters, regionForRadius } from '@/lib/geo';
import { DEFAULT_RADIUS_M } from '@/lib/places';
import { useLocation } from '@/providers/LocationProvider';
import { useNearbyPlaces } from '@/hooks/usePlaces';
import type { RootStackParamList, TabParamList } from '@/navigation/types';
import type { Place } from '@/types/place';
import { CategoryMarker } from './components/CategoryMarker';
import { PlacePeekSheet } from './components/PlacePeekSheet';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type MapRoute = RouteProp<TabParamList, 'Map'>;

export function MapScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<MapRoute>();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const { center, isResolving, isFallback, retry, override } = useLocation();
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);

  // Home can deep-link into the map with a category preselected.
  useEffect(() => {
    if (route.params?.category) setCategory(route.params.category);
  }, [route.params?.category]);

  const { data, isLoading, isError, refetch } = useNearbyPlaces(center, {
    radius: DEFAULT_RADIUS_M,
    category,
    enabled: !isResolving,
  });

  const places = data ?? [];


  useEffect(() => {
    if (!isResolving) {
      webViewRef.current?.injectJavaScript(`
        if (window.map) map.setView([${center.lat}, ${center.lng}]);
        if (window.userMarker) window.userMarker.setLatLng([${center.lat}, ${center.lng}]);
        true;
      `);
    }
  }, [isResolving, center]);

  const recenter = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.map) map.flyTo([${center.lat}, ${center.lng}], 14);
      true;
    `);
  }, [center]);

  const selectCategory = useCallback((next: string | null) => {
    setSelected(null);
    setCategory(next);
  }, []);

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        source={{
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
              <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
              <style>
                body { padding: 0; margin: 0; background-color: #f7f7f7; }
                html, body, #map { height: 100%; width: 100vw; }
                .leaflet-control-attribution { display: none !important; }
              </style>
            </head>
            <body>
              <div id="map"></div>
              <script>
                var map = L.map('map', { zoomControl: false }).setView([${center.lat}, ${center.lng}], 14);
                L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
                  maxZoom: 19,
                }).addTo(map);

                // User location dot (blue)
                var userIcon = L.divIcon({
                  html: '<div style="background-color: #007AFF; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
                  className: '',
                  iconSize: [22, 22],
                  iconAnchor: [11, 11]
                });
                window.userMarker = L.marker([${center.lat}, ${center.lng}], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

                var places = ${JSON.stringify(places)};
                places.forEach(function(place) {
                  var marker = L.marker([place.lat, place.lng]).addTo(map);
                  marker.on('click', function() {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: place.id }));
                  });
                });

                map.on('click', function() {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'deselect' }));
                });

                map.on('contextmenu', function(e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'longpress', lat: e.latlng.lat, lng: e.latlng.lng }));
                });
              </script>
            </body>
            </html>
          `,
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'select') {
              const place = places.find(p => p.id === data.id);
              if (place) setSelected(place);
            } else if (data.type === 'deselect') {
              setSelected(null);
            } else if (data.type === 'longpress') {
              override(data.lat, data.lng);
            }
          } catch (e) {}
        }}
      />

      {/* ─── Filter chips ──────────────────────────────────────────────── */}
      <View style={[styles.chipBar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="All" selected={category === null} onPress={() => selectCategory(null)} />
          {PLACE_CATEGORIES.map((meta) => (
            <Chip
              key={meta.name}
              label={meta.label}
              icon={meta.icon}
              accent={meta.color}
              selected={category === meta.name}
              onPress={() => selectCategory(category === meta.name ? null : meta.name)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ─── Status pill + recentre ────────────────────────────────────── */}
      <View style={[styles.controls, { top: insets.top + 62 }]} pointerEvents="box-none">
        <Animated.View entering={FadeIn} style={[styles.statusPill, shadows.sm]}>
          <View style={[styles.statusDot, isLoading && styles.statusDotBusy]} />
          <Text variant="caption" weight="semibold" tone="secondary">
            {isLoading ? 'Loading places…' : `${places.length} place${places.length === 1 ? '' : 's'}`}
          </Text>
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recentre map"
          onPress={recenter}
          style={({ pressed }) => [styles.iconButton, shadows.md, pressed && styles.pressed]}
        >
          <Ionicons name="locate" size={19} color={palette.ink} />
        </Pressable>
      </View>

      {/* ─── Failure / empty overlays ──────────────────────────────────── */}

      {isError ? (
        <View style={styles.overlayCard}>
          <EmptyState
            compact
            tone="danger"
            icon="cloud-offline-outline"
            title="Could not load places"
            message="The nearby_places call failed. Check your Supabase connection."
            actionLabel="Retry"
            onAction={() => void refetch()}
          />
        </View>
      ) : !isLoading && places.length === 0 ? (
        <View style={styles.overlayCard}>
          <EmptyState
            compact
            icon="search-outline"
            title="Nothing in this category"
            message={
              category
                ? `No ${category} within ${DEFAULT_RADIUS_M / 1000} km. Try another filter.`
                : `No places mapped within ${DEFAULT_RADIUS_M / 1000} km of here.`
            }
            actionLabel={category ? 'Show all' : 'Retry location'}
            onAction={category ? () => selectCategory(null) : retry}
          />
        </View>
      ) : null}

      {selected ? (
        <PlacePeekSheet
          place={selected}
          distance={distanceMeters(center, { lat: selected.lat, lng: selected.lng })}
          onOpen={() => navigation.navigate('PlaceDetail', { place: selected })}
          onDismiss={() => setSelected(null)}
        />
      ) : null}

      {/* Attribution is a licence requirement for OSM-derived tiles. */}
      <Text variant="caption" tone="faint" style={styles.attribution}>
        {env.mapAttribution}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvasSunken },
  chipBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  controls: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
  },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: palette.success },
  statusDotBusy: { backgroundColor: palette.warning },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  pressed: { opacity: 0.7 },
  notice: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.warningSoft,
  },
  noticeText: { flex: 1 },
  overlayCard: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxxl,
    backgroundColor: palette.surface,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadows.lg,
  },
  attribution: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.md,
    backgroundColor: palette.onInk,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.xs,
  },
});
