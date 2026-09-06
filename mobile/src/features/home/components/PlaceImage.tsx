import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { categoryMeta } from '@/constants/categories';
import { gradients, palette, radius, withAlpha } from '@/design/tokens';

interface PlaceImageProps {
  uri?: string | null;
  category: string;
  height?: number;
  borderRadius?: number;
  /** Darkens the bottom so overlaid text stays readable. */
  scrim?: boolean;
  style?: ViewStyle;
}

/**
 * Image with a deterministic category-tinted fallback. Seeded OSM places rarely
 * carry photos, so the fallback is the common case and has to look intentional
 * rather than like a broken image.
 */
export function PlaceImage({
  uri,
  category,
  height = 132,
  borderRadius = radius.lg,
  scrim = false,
  style,
}: PlaceImageProps) {
  const meta = categoryMeta(category);

  return (
    <View style={[styles.container, { height, borderRadius }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient
          colors={[withAlpha(meta.color, 0.22), withAlpha(meta.color, 0.08)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fallback]}
        >
          <Ionicons name={meta.icon} size={height > 200 ? 56 : 30} color={withAlpha(meta.color, 0.55)} />
        </LinearGradient>
      )}

      {scrim ? (
        <LinearGradient
          colors={gradients.photoScrim}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: palette.canvasSunken },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
