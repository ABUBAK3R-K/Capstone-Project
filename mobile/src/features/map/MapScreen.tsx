import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile, type Region } from 'react-native-maps';
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
  const mapRef = useRef<MapView>(null);

  const { center, isResolving, isFallback, retry } = useLocation();
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

  const region = useMemo<Region>(() => regionForRadius(center, DEFAULT_RADIUS_M), [center]);

  // Re-centre when a real fix arrives after the map has already mounted.
  useEffect(() => {
    if (!isResolving) mapRef.current?.animateToRegion(region, 600);
  }, [isResolving, region]);

  const recenter = useCallback(() => {
    mapRef.current?.animateToRegion(regionForRadius(center, DEFAULT_RADIUS_M), 450);
  }, [center]);

  const selectCategory = useCallback((next: string | null) => {
    setSelected(null);
    setCategory(next);
  }, []);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation={!isFallback}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={() => setSelected(null)}
        // On Android the Google basemap must be switched off, otherwise it
        // renders underneath and fights with the OSM-style raster tiles.
        mapType={hasMapTiles && Platform.OS === 'android' ? 'none' : 'standard'}
      >
        {/*
          Hosted OSM-style raster tiles (Mapbox / MapTiler / Stadia).
          Never point this at tile.openstreetmap.org — react-native-maps blocks
          OSM's own tile servers on Android. See mobile/.env.example.
        */}
        {hasMapTiles ? (
          <UrlTile
            urlTemplate={env.mapTileUrl}
            maximumZ={19}
            flipY={false}
            shouldReplaceMapContent
            tileSize={env.mapTileSize}
          />
        ) : null}

        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            onPress={(event) => {
              // Stop the tap from also hitting MapView.onPress and clearing us.
              event.stopPropagation();
              setSelected(place);
            }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <CategoryMarker category={place.category} selected={selected?.id === place.id} />
          </Marker>
        ))}
      </MapView>

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
      {!hasMapTiles ? (
        <View style={[styles.notice, { top: insets.top + 110 }]} pointerEvents="none">
          <Ionicons name="layers-outline" size={14} color={palette.warning} />
          <Text variant="caption" weight="medium" tone="secondary" style={styles.noticeText}>
            No tile source configured — set EXPO_PUBLIC_MAP_TILE_URL in .env
          </Text>
        </View>
      ) : null}

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
