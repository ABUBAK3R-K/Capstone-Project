import { useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn } from 'react-native-reanimated';

import { EmptyState } from '@/design/components/EmptyState';
import { SectionHeader } from '@/design/components/SectionHeader';
import { ChipRowSkeleton, PlaceCardSkeleton, RailSkeleton } from '@/design/components/Skeleton';
import { screenGutter } from '@/design/components/Screen';
import { palette, spacing } from '@/design/tokens';
import { useHomePlaces } from '@/hooks/usePlaces';
import { useLocation } from '@/providers/LocationProvider';
import { distanceMeters } from '@/lib/geo';
import type { RootStackParamList } from '@/navigation/types';
import type { Place } from '@/types/place';
import { CategoryRail } from './components/CategoryRail';
import { HomeHeader } from './components/HomeHeader';
import { PlaceCard, RAIL_CARD_WIDTH } from './components/PlaceCard';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const { center, isResolving, isFallback, retry } = useLocation();

  const placesEnabled = !isResolving;
  const {
    categories,
    recent,
    closest,
    isLoading: placesLoading,
    isError: placesError,
    refetch: refetchPlaces,
    isRefetching,
  } = useHomePlaces(center, placesEnabled);

  const openPlace = useCallback(
    (place: Place) => navigation.navigate('PlaceDetail', { place }),
    [navigation],
  );

  const openMapWithCategory = useCallback(
    (category: string) => navigation.navigate('Tabs', { screen: 'Map', params: { category } }),
    [navigation],
  );

  const onRefresh = useCallback(() => {
    void refetchPlaces();
  }, [refetchPlaces]);

  const greeting = useMemo(() => greetingFor(new Date()), []);
  const locationLabel = isResolving
    ? 'Finding you…'
    : isFallback
      ? 'Using city centre — tap to retry'
      : `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}`;

  const showSkeletons = isResolving || placesLoading;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
      >
        <HomeHeader
          greeting={greeting}
          locationLabel={locationLabel}
          isFallback={isFallback}
          onPressLocation={retry}
        />

        {/* ─── Nearby categories ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Browse"
            title="Nearby categories"
            actionLabel="Open map"
            onAction={() => navigation.navigate('Tabs', { screen: 'Map' })}
          />
          {showSkeletons ? (
            <ChipRowSkeleton />
          ) : categories.length > 0 ? (
            <CategoryRail
              categories={categories}
              onSelect={(category) => openMapWithCategory(category.name)}
            />
          ) : (
            <EmptyState
              compact
              icon="grid-outline"
              title="No categories yet"
              message="Nothing has been mapped within 10 km of here."
            />
          )}
        </View>

        {/* ─── Recently added ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader eyebrow="Fresh" title="Recently added" />
          {showSkeletons ? (
            <RailSkeleton cardWidth={RAIL_CARD_WIDTH} />
          ) : placesError ? (
            <EmptyState
              compact
              tone="danger"
              icon="cloud-offline-outline"
              title="Could not load places"
              message="Check your connection and your Supabase URL, then try again."
              actionLabel="Retry"
              onAction={() => void refetchPlaces()}
            />
          ) : recent.length > 0 ? (
            <Animated.ScrollView
              entering={FadeIn.duration(260)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              snapToInterval={RAIL_CARD_WIDTH + spacing.md}
              decelerationRate="fast"
            >
              {recent.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  layout="rail"
                  distance={distanceMeters(center, { lat: place.lat, lng: place.lng })}
                  onPress={() => openPlace(place)}
                />
              ))}
            </Animated.ScrollView>
          ) : (
            <EmptyState
              compact
              icon="map-outline"
              title="Nothing mapped nearby"
              message="Seed the places table or move the map to a denser area."
            />
          )}
        </View>

        {/* ─── Closest to you ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader eyebrow="Around the corner" title="Closest to you" />
          {showSkeletons ? (
            <View style={styles.stack}>
              <PlaceCardSkeleton />
              <PlaceCardSkeleton />
            </View>
          ) : closest.length > 0 ? (
            <View style={styles.stack}>
              {closest.slice(0, 4).map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  distance={distanceMeters(center, { lat: place.lat, lng: place.lng })}
                  onPress={() => openPlace(place)}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingBottom: spacing.huge },
  section: { marginTop: spacing.xxxl },
  rail: { paddingHorizontal: screenGutter, gap: spacing.md, paddingVertical: spacing.xs },
  stack: { paddingHorizontal: screenGutter, gap: spacing.md },
});
