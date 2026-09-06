import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { categoryMeta } from '@/constants/categories';
import { palette, radius, shadows } from '@/design/tokens';

interface CategoryMarkerProps {
  category: string;
  selected?: boolean;
}

/**
 * Teardrop pin drawn in JSX rather than a bitmap sprite — this is the reason
 * react-native-maps was chosen over MapLibre. The pin is a rotated rounded
 * square with a category-coloured fill and a white icon glyph on top.
 *
 * Memoised because a map with 100+ markers re-renders these on every pan.
 */
export const CategoryMarker = memo(function CategoryMarker({
  category,
  selected = false,
}: CategoryMarkerProps) {
  const meta = categoryMeta(category);
  const size = selected ? 44 : 36;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.pin,
          shadows.md,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: meta.color,
            borderWidth: selected ? 3 : 2,
          },
        ]}
      >
        <Ionicons name={meta.icon} size={selected ? 20 : 16} color={palette.inkInverse} />
      </View>

      {/* The tail: a small rotated square tucked under the circle. */}
      <View style={[styles.tail, { backgroundColor: meta.color }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: palette.surface,
  },
  tail: {
    width: 10,
    height: 10,
    marginTop: -5,
    borderRadius: radius.xs / 2,
    transform: [{ rotate: '45deg' }],
  },
});
