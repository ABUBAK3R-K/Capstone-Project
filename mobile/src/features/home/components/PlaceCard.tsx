import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/design/components/Badge';
import { Card } from '@/design/components/Card';
import { Text } from '@/design/typography';
import { categoryMeta } from '@/constants/categories';
import { formatDistance } from '@/lib/geo';
import { palette, radius, spacing } from '@/design/tokens';
import type { Place } from '@/types/place';
import { PlaceImage } from './PlaceImage';

interface PlaceCardProps {
  place: Place;
  distance?: number | null;
  onPress: () => void;
  /** "rail" is the fixed-width horizontal variant; "full" spans the gutter. */
  layout?: 'rail' | 'full';
}

export const RAIL_CARD_WIDTH = 232;

export function PlaceCard({ place, distance, onPress, layout = 'full' }: PlaceCardProps) {
  const meta = categoryMeta(place.category);
  const isRail = layout === 'rail';

  return (
    <Card
      onPress={onPress}
      padded={false}
      elevation="sm"
      style={isRail ? styles.railCard : styles.fullCard}
    >
      <View style={styles.mediaWrap}>
        <PlaceImage
          uri={place.images?.[0]}
          category={place.category}
          height={isRail ? 130 : 156}
          borderRadius={0}
        />
        <Badge label={meta.label} color={meta.color} icon={meta.icon} style={styles.floatingBadge} />
      </View>

      <View style={styles.body}>
        <Text variant="subheading" weight="semibold" numberOfLines={1}>
          {place.name}
        </Text>

        {place.subcategory || place.address ? (
          <Text variant="label" tone="muted" numberOfLines={isRail ? 1 : 2}>
            {place.subcategory ?? place.address}
          </Text>
        ) : null}

        {typeof distance === 'number' ? (
          <View style={styles.metaRow}>
            <Ionicons name="navigate-outline" size={12} color={palette.inkFaint} />
            <Text variant="caption" tone="faint" weight="medium">
              {formatDistance(distance)} away
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  railCard: { width: RAIL_CARD_WIDTH },
  fullCard: { width: '100%' },
  mediaWrap: { position: 'relative' },
  floatingBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radius.xs,
  },
  body: { padding: spacing.lg, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
});
