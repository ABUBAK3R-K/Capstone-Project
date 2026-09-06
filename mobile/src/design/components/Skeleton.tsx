import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette, radius, spacing } from '../tokens';

interface SkeletonProps {
  width?: ViewStyle['width'];
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Pulsing placeholder block. Preferred over spinners anywhere the final layout
 * is predictable, so the screen never collapses to blank while data loads.
 */
export function Skeleton({ width = '100%', height = 16, radius: r = radius.sm, style }: SkeletonProps) {
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: palette.canvasSunken }, animatedStyle, style]}
    />
  );
}

/** Skeleton shaped like a PlaceCard, used by the Home feed. */
export function PlaceCardSkeleton() {
  return (
    <View style={styles.placeCard}>
      <Skeleton height={132} radius={radius.lg} />
      <View style={styles.placeCardBody}>
        <Skeleton width="45%" height={10} />
        <Skeleton width="80%" height={17} />
        <Skeleton width="60%" height={12} />
      </View>
    </View>
  );
}

/** Skeleton shaped like a horizontal card rail. */
export function RailSkeleton({ count = 3, cardWidth = 220 }: { count?: number; cardWidth?: number }) {
  return (
    <View style={styles.rail}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ width: cardWidth, gap: spacing.sm }}>
          <Skeleton height={132} radius={radius.lg} />
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={11} />
        </View>
      ))}
    </View>
  );
}

export function ChipRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.chipRow}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} width={96 + index * 14} height={38} radius={radius.pill} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  placeCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  placeCardBody: { gap: spacing.sm },
  rail: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl },
});
