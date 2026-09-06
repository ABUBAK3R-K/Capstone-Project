import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/design/components/Badge';
import { Card } from '@/design/components/Card';
import { EmptyState } from '@/design/components/EmptyState';
import { RailSkeleton } from '@/design/components/Skeleton';
import { Text } from '@/design/typography';
import { PlaceImage } from '@/features/home/components/PlaceImage';
import { categoryMeta } from '@/constants/categories';
import { palette, radius, spacing, withAlpha } from '@/design/tokens';
import { screenGutter } from '@/design/components/Screen';
import type { Place, SimilarPlace } from '@/types/place';

interface SimilarPlacesRowProps {
  items: SimilarPlace[];
  isLoading: boolean;
  isError: boolean;
  /** False when EXPO_PUBLIC_RECOMMENDATIONS_URL is unset. */
  serviceConfigured: boolean;
  onSelect: (place: Place) => void;
  onRetry: () => void;
}

const CARD_WIDTH = 190;

/** The service returns `place_id`; the rest of the app navigates on `Place`. */
function toPlace(item: SimilarPlace): Place {
  return {
    id: item.place_id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    description: item.description,
    lat: item.lat,
    lng: item.lng,
    address: item.address,
    images: item.images,
    source: null,
  };
}

export function SimilarPlacesRow({
  items,
  isLoading,
  isError,
  serviceConfigured,
  onSelect,
  onRetry,
}: SimilarPlacesRowProps) {
  if (!serviceConfigured) {
    return (
      <EmptyState
        compact
        icon="server-outline"
        title="Recommendations are offline"
        message="Set EXPO_PUBLIC_RECOMMENDATIONS_URL to the FastAPI service to see similar places."
      />
    );
  }

  if (isLoading) return <RailSkeleton count={3} cardWidth={CARD_WIDTH} />;

  if (isError) {
    return (
      <EmptyState
        compact
        tone="danger"
        icon="cloud-offline-outline"
        title="Could not reach the service"
        message="The recommendation API did not respond. It may not be running."
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon="sparkles-outline"
        title="No similar places yet"
        message="The model needs more places in this area before it can compare them."
      />
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      snapToInterval={CARD_WIDTH + spacing.md}
      decelerationRate="fast"
    >
      {items.map((item) => {
        const meta = categoryMeta(item.category);
        const match = Math.round(item.similarity_score * 100);

        return (
          <Card
            key={item.place_id}
            onPress={() => onSelect(toPlace(item))}
            padded={false}
            style={styles.card}
          >
            <PlaceImage uri={item.images?.[0]} category={item.category} height={106} borderRadius={0} />

            <View style={styles.body}>
              <Badge label={meta.label} color={meta.color} />
              <Text variant="label" weight="semibold" numberOfLines={2} style={styles.name}>
                {item.name}
              </Text>

              {/* Similarity is the whole point of this row, so show it. */}
              <View style={styles.matchRow}>
                <View style={styles.matchTrack}>
                  <View
                    style={[
                      styles.matchFill,
                      { width: `${Math.min(100, Math.max(4, match))}%`, backgroundColor: meta.color },
                    ]}
                  />
                </View>
                <Text variant="caption" weight="semibold" style={{ color: meta.color }}>
                  {match}%
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

/** Small inline header used above the row on the detail screen. */
export function SimilarPlacesHeading({ count }: { count: number }) {
  return (
    <View style={styles.heading}>
      <View style={[styles.headingIcon, { backgroundColor: withAlpha(palette.accent, 0.12) }]}>
        <Ionicons name="sparkles" size={13} color={palette.accent} />
      </View>
      <Text variant="caption" tone="muted" weight="medium">
        {count > 0 ? `${count} matches from the recommendation model` : 'Powered by the recommendation model'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: screenGutter, gap: spacing.md, paddingVertical: spacing.xs },
  card: { width: CARD_WIDTH },
  body: { padding: spacing.md, gap: spacing.sm },
  name: { minHeight: 36 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  matchTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.canvasSunken,
    overflow: 'hidden',
  },
  matchFill: { height: '100%', borderRadius: radius.pill },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: screenGutter,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  headingIcon: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
