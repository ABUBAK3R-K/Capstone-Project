import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/design/components/Badge';
import { Button } from '@/design/components/Button';
import { Text } from '@/design/typography';
import { PlaceImage } from '@/features/home/components/PlaceImage';
import { categoryMeta } from '@/constants/categories';
import { formatDistance } from '@/lib/geo';
import { palette, radius, shadows, spacing } from '@/design/tokens';
import type { Place } from '@/types/place';

interface PlacePeekSheetProps {
  place: Place;
  distance: number;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * Preview card that rises from the bottom when a marker is tapped. Tapping a
 * pin should not yank you off the map — you confirm what you found first, then
 * choose to open it.
 */
export function PlacePeekSheet({ place, distance, onOpen, onDismiss }: PlacePeekSheetProps) {
  const insets = useSafeAreaInsets();
  const meta = categoryMeta(place.category);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(180)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.sheet, shadows.lg, { paddingBottom: insets.bottom + spacing.lg }]}
    >
      <View style={styles.grabber} />

      <View style={styles.row}>
        <PlaceImage
          uri={place.images?.[0]}
          category={place.category}
          height={76}
          borderRadius={radius.md}
          style={styles.thumb}
        />

        <View style={styles.body}>
          <Badge label={meta.label} color={meta.color} icon={meta.icon} />
          <Text variant="heading" weight="semibold" numberOfLines={1}>
            {place.name}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="navigate-outline" size={12} color={palette.inkFaint} />
            <Text variant="caption" tone="faint" weight="medium" numberOfLines={1}>
              {formatDistance(distance)} away
              {place.address ? ` · ${place.address}` : ''}
            </Text>
          </View>
        </View>

        <Pressable onPress={onDismiss} hitSlop={12} style={styles.close}>
          <Ionicons name="close" size={17} color={palette.inkMuted} />
        </Pressable>
      </View>

      <Button
        label="View details"
        onPress={onOpen}
        fullWidth
        icon="arrow-forward"
        iconPosition="trailing"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.borderStrong,
    marginTop: -spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 76 },
  body: { flex: 1, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  close: { alignSelf: 'flex-start', padding: spacing.xs },
});
