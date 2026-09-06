import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { Text } from '@/design/typography';
import { palette, radius, shadows, spacing, withAlpha } from '@/design/tokens';
import { screenGutter } from '@/design/components/Screen';
import type { CategoryMeta } from '@/constants/categories';

interface CategoryRailProps {
  categories: (CategoryMeta & { count: number })[];
  onSelect: (category: CategoryMeta) => void;
}

/**
 * Category tiles rather than plain chips — the count gives the section a reason
 * to exist beyond being a filter, and the tinted icon well carries the ramp.
 */
export function CategoryRail({ categories, onSelect }: CategoryRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {categories.map((category, index) => (
        <Animated.View key={category.name} entering={FadeInRight.delay(index * 45).duration(280)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${category.label}, ${category.count} nearby`}
            onPress={() => onSelect(category)}
            style={({ pressed }) => [styles.tile, shadows.sm, pressed && styles.tilePressed]}
          >
            <View style={[styles.iconWell, { backgroundColor: withAlpha(category.color, 0.13) }]}>
              <Ionicons name={category.icon} size={19} color={category.color} />
            </View>
            <View style={styles.tileCopy}>
              <Text variant="label" weight="semibold" numberOfLines={1}>
                {category.label}
              </Text>
              <Text variant="caption" tone="faint" weight="medium">
                {category.count} nearby
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, gap: spacing.md },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  tilePressed: { opacity: 0.75 },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCopy: { gap: spacing.xxs },
});
