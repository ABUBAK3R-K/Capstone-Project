import { useEffect } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { Badge } from '@/design/components/Badge';
import { SectionHeader } from '@/design/components/SectionHeader';
import { Text } from '@/design/typography';
import { screenGutter } from '@/design/components/Screen';
import { palette, radius, shadows, spacing } from '@/design/tokens';
import { categoryMeta } from '@/constants/categories';
import { hasRecommendationService } from '@/lib/env';
import { logInteraction } from '@/lib/recommendations';
import { useSimilarPlaces } from '@/hooks/usePlaces';
import type { RootStackParamList } from '@/navigation/types';
import { ImageCarousel } from './components/ImageCarousel';
import { SimilarPlacesHeading, SimilarPlacesRow } from './components/SimilarPlacesRow';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'PlaceDetail'>;

const HERO_HEIGHT = 320;

export function PlaceDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const { params } = useRoute<DetailRoute>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const place = params.place;
  const meta = categoryMeta(place.category);

  const { data, isLoading, isError, refetch } = useSimilarPlaces(place.id);
  const similar = data ?? [];

  // Feeds the collaborative-filtering signal. Best-effort, never blocks render.
  useEffect(() => {
    logInteraction(user?.id, place.id, 'view');
  }, [place.id, user?.id]);

  // Hero parallax: the image drifts at half scroll speed and fades out, while
  // the floating back button gains a solid background once it leaves the image.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-HERO_HEIGHT, 0, HERO_HEIGHT], [-HERO_HEIGHT / 2, 0, HERO_HEIGHT / 2]) },
      { scale: scrollY.value < 0 ? 1 + -scrollY.value / HERO_HEIGHT : 1 },
    ],
    opacity: interpolate(scrollY.value, [0, HERO_HEIGHT * 0.8], [1, 0.25], 'clamp'),
  }));

  const backButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollY.value,
      [0, 120],
      [palette.surfaceTranslucent, palette.surface],
    ),
  }));

  const openDirections = () => {
    const label = encodeURIComponent(place.name);
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${place.lat},${place.lng}`,
      default: `geo:${place.lat},${place.lng}?q=${place.lat},${place.lng}(${label})`,
    });
    void Linking.openURL(url);
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Animated.View style={heroStyle}>
          <ImageCarousel images={place.images} category={place.category} height={HERO_HEIGHT} />
        </Animated.View>

        <View style={styles.sheet}>
          <Animated.View entering={FadeInUp.duration(320)} style={styles.headerBlock}>
            <View style={styles.badgeRow}>
              <Badge label={meta.label} color={meta.color} icon={meta.icon} />
              {place.subcategory ? (
                <Badge label={place.subcategory} color={palette.inkMuted} />
              ) : null}
            </View>

            <Text variant="display" weight="bold">
              {place.name}
            </Text>

            {place.address ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={15} color={palette.inkMuted} />
                <Text variant="body" tone="muted" style={styles.addressText}>
                  {place.address}
                </Text>
              </View>
            ) : null}
          </Animated.View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={openDirections}
              style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.pressed]}
            >
              <Ionicons name="navigate" size={17} color={palette.inkInverse} />
              <Text variant="label" weight="semibold" tone="inverse">
                Directions
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Tabs', { screen: 'Map' })}
              style={({ pressed }) => [styles.action, styles.actionSecondary, pressed && styles.pressed]}
            >
              <Ionicons name="map-outline" size={17} color={palette.ink} />
              <Text variant="label" weight="semibold">
                Show on map
              </Text>
            </Pressable>
          </View>

          {place.description ? (
            <View style={styles.block}>
              <Text variant="heading" weight="semibold">
                About
              </Text>
              <Text variant="body" tone="secondary">
                {place.description}
              </Text>
            </View>
          ) : null}

          <View style={styles.block}>
            <Text variant="heading" weight="semibold">
              Details
            </Text>
            <View style={styles.detailCard}>
              <DetailRow icon="pricetag-outline" label="Category" value={place.category} />
              {place.subcategory ? (
                <DetailRow icon="albums-outline" label="Type" value={place.subcategory} />
              ) : null}
              <DetailRow
                icon="compass-outline"
                label="Coordinates"
                value={`${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`}
              />
              {place.source ? (
                <DetailRow icon="git-branch-outline" label="Source" value={place.source} last />
              ) : null}
            </View>
          </View>
        </View>

        {/* ─── Similar places ────────────────────────────────────────────── */}
        <View style={styles.similarBlock}>
          <SectionHeader eyebrow="You might also like" title="Similar places" />
          {hasRecommendationService ? <SimilarPlacesHeading count={similar.length} /> : null}
          <SimilarPlacesRow
            items={similar}
            isLoading={isLoading}
            isError={isError}
            serviceConfigured={hasRecommendationService}
            onRetry={() => void refetch()}
            onSelect={(next) => navigation.push('PlaceDetail', { place: next })}
          />
        </View>
      </Animated.ScrollView>

      <Animated.View style={[styles.backWrap, { top: insets.top + spacing.sm }, backButtonStyle, shadows.md]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color={palette.ink} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Ionicons name={icon} size={16} color={palette.inkFaint} />
      <Text variant="label" tone="muted" style={styles.detailLabel}>
        {label}
      </Text>
      <Text variant="label" weight="semibold" style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingBottom: spacing.huge },
  sheet: {
    marginTop: -spacing.xxl,
    paddingTop: spacing.xxl,
    paddingHorizontal: screenGutter,
    backgroundColor: palette.canvas,
    borderTopLeftRadius: radius.xxl + 4,
    borderTopRightRadius: radius.xxl + 4,
    gap: spacing.xxl,
  },
  headerBlock: { gap: spacing.md },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  addressText: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.md,
  },
  actionPrimary: { backgroundColor: palette.primary, ...shadows.sm },
  actionSecondary: {
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.borderStrong,
  },
  pressed: { opacity: 0.8 },
  block: { gap: spacing.md },
  detailCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  detailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  detailLabel: { flex: 1 },
  detailValue: { maxWidth: '55%' },
  similarBlock: { marginTop: spacing.xxxl },
  backWrap: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
