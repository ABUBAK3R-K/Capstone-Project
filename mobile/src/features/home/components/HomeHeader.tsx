import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design/typography';
import { gradients, palette, radius, spacing } from '@/design/tokens';
import { screenGutter } from '@/design/components/Screen';

interface HomeHeaderProps {
  greeting: string;
  /** Human-readable location line, or the reason we could not resolve one. */
  locationLabel: string;
  isFallback: boolean;
  onPressLocation: () => void;
}

/**
 * Ink header that the feed scrolls under. Gives the Home screen a top edge with
 * some weight, so the first card is not floating against bare canvas.
 */
export function HomeHeader({ greeting, locationLabel, isFallback, onPressLocation }: HomeHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={gradients.inkHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + spacing.xl }]}
    >
      <Animated.View entering={FadeInDown.duration(320)} style={styles.stack}>
        <Text variant="label" style={styles.greeting}>
          {greeting}
        </Text>
        <Text variant="display" weight="bold" tone="inverse">
          What is around you
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityHint="Refresh your location"
          onPress={onPressLocation}
          style={styles.locationPill}
          hitSlop={6}
        >
          <Ionicons
            name={isFallback ? 'location-outline' : 'location'}
            size={13}
            color={isFallback ? palette.warning : palette.primary}
          />
          <Text variant="caption" weight="semibold" style={styles.locationText} numberOfLines={1}>
            {locationLabel}
          </Text>
          <Ionicons name="refresh" size={12} color={palette.onInkFaint} />
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  stack: { gap: spacing.sm },
  greeting: { color: palette.onInkFaint },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.onInkSurface,
  },
  locationText: { color: palette.onInk, maxWidth: 240 },
});
