import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Text } from '@/design/typography';
import { REPORT_CATEGORIES } from '@/constants/categories';
import { palette, radius, spacing, withAlpha } from '@/design/tokens';

interface CategorySelectProps {
  value: string;
  onChange: (category: string) => void;
  disabled?: boolean;
}

/**
 * A wrapping grid of tappable tiles instead of a dropdown. Every option is
 * visible at once, which is faster on a phone than opening a picker, and the
 * icons make the list scannable while standing in front of the problem.
 */
export function CategorySelect({ value, onChange, disabled = false }: CategorySelectProps) {
  return (
    <View style={styles.grid}>
      {REPORT_CATEGORIES.map((category) => {
        const selected = category.name === value;

        return (
          <Pressable
            key={category.name}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(category.name);
            }}
            style={({ pressed }) => [
              styles.tile,
              selected && { borderColor: category.color, backgroundColor: withAlpha(category.color, 0.08) },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.iconWell,
                { backgroundColor: withAlpha(category.color, selected ? 0.18 : 0.1) },
              ]}
            >
              <Ionicons name={category.icon} size={17} color={category.color} />
            </View>
            <Text
              variant="label"
              weight={selected ? 'semibold' : 'medium'}
              tone={selected ? 'default' : 'secondary'}
              numberOfLines={1}
              style={styles.label}
            >
              {category.name}
            </Text>
            {selected ? (
              <Ionicons name="checkmark-circle" size={16} color={category.color} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
  },
  pressed: { opacity: 0.75 },
  iconWell: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { maxWidth: 130 },
});
