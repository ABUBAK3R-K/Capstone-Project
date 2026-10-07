import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { useLocation } from '@/providers/LocationProvider';
import { Button } from '@/design/components/Button';
import { EmptyState } from '@/design/components/EmptyState';
import { PlaceCardSkeleton } from '@/design/components/Skeleton';
import { Screen, screenGutter } from '@/design/components/Screen';
import { Text } from '@/design/typography';
import { fontFamily, palette, radius, shadows, spacing, typeScale } from '@/design/tokens';
import { MIN_SEARCH_LENGTH, useSearchPlaces } from '@/hooks/usePlaces';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { distanceMeters } from '@/lib/geo';
import { PlaceCard } from '@/features/home/components/PlaceCard';
import type { RootStackParamList } from '@/navigation/types';
import type { Place } from '@/types/place';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const DEBOUNCE_MS = 300;

/**
 * Text search over the whole catalogue via the `search_places` RPC — name,
 * description, category or type, nearest first. A dead end ("no matches")
 * offers to add the place instead, which is how the catalogue grows beyond
 * the OSM import.
 */
export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const { center } = useLocation();

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, DEBOUNCE_MS);
  const trimmed = debounced.trim();
  const isQueryReady = trimmed.length >= MIN_SEARCH_LENGTH;

  const { data, isLoading, isError, isFetching, refetch } = useSearchPlaces(debounced, center);
  const results = isQueryReady ? (data ?? []) : [];

  const openPlace = useCallback((place: Place) => navigation.navigate('PlaceDetail', { place }), [navigation]);
  const addPlace = useCallback(
    (name?: string) => navigation.navigate('AddPlace', name ? { name } : undefined),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Place }) => (
      <PlaceCard
        place={item}
        distance={distanceMeters(center, { lat: item.lat, lng: item.lng })}
        onPress={() => openPlace(item)}
      />
    ),
    [center, openPlace],
  );

  const renderBody = () => {
    if (!isQueryReady) {
      return (
        <EmptyState
          icon="search-outline"
          title="Search CityGuide"
          message="Find shops, parks, temples and services by name or type — nearest matches first."
        />
      );
    }
    if (isLoading) {
      return (
        <View style={styles.stack}>
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
        </View>
      );
    }
    if (isError) {
      return (
        <EmptyState
          tone="danger"
          icon="cloud-offline-outline"
          title="Search failed"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void refetch()}
        />
      );
    }
    if (results.length === 0) {
      return (
        <EmptyState
          icon="map-outline"
          title={`No matches for “${trimmed}”`}
          message={
            user
              ? 'If it exists, you can put it on the map for everyone.'
              : 'Try a different name, or a type like "bakery" or "park".'
          }
          actionLabel={user ? `Add “${trimmed}”` : undefined}
          onAction={user ? () => addPlace(trimmed) : undefined}
        />
      );
    }
    return null;
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color={palette.ink} />
        </Pressable>

        <View style={styles.inputWrap}>
          <Ionicons name="search" size={17} color={palette.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            placeholder="Search places"
            placeholderTextColor={palette.inkFaint}
            accessibilityLabel="Search places"
            style={styles.input}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={18} color={palette.inkFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {results.length > 0 ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.flex}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={
              <Text variant="caption" tone="faint" weight="medium">
                {isFetching ? 'Updating…' : `${results.length} ${results.length === 1 ? 'place' : 'places'}, nearest first`}
              </Text>
            }
            ListFooterComponent={
              user ? (
                <View style={styles.footer}>
                  <Text variant="label" tone="muted" align="center">
                    Not what you were looking for?
                  </Text>
                  <Button label="Add a place" variant="secondary" size="sm" icon="add" onPress={() => addPlace(trimmed)} />
                </View>
              ) : null
            }
          />
        </Animated.View>
      ) : (
        <View style={styles.body}>{renderBody()}</View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: screenGutter,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    ...shadows.sm,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
  },
  input: {
    flex: 1,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.body.fontSize,
    padding: 0,
  },
  body: { flex: 1, paddingHorizontal: screenGutter },
  stack: { gap: spacing.md, paddingTop: spacing.md },
  list: { paddingHorizontal: screenGutter, paddingBottom: spacing.huge, gap: spacing.md },
  footer: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
});
