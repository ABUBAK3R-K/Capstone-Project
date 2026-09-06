import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '../typography';
import { fontFamily, motion, palette, radius, shadows, spacing, typeScale } from '../tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Colour used for the selected fill. Defaults to the brand terracotta. */
  accent?: string;
  count?: number;
}

/**
 * Filter chip with an animated fill. The colour is driven by a shared value and
 * interpolated rather than swapped, so selection reads as a transition instead
 * of a flash — this is the "tactile" requirement on the map screen.
 */
export function Chip({ label, selected = false, onPress, icon, accent = palette.primary, count }: ChipProps) {
  const progress = useSharedValue(selected ? 1 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: motion.base });
  }, [progress, selected]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [palette.surface, accent]),
    borderColor: interpolateColor(progress.value, [0, 1], [palette.border, accent]),
    transform: [{ scale: scale.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [palette.inkSecondary, palette.inkInverse]),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPressIn={() => {
        scale.value = withSpring(0.94, motion.spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={[styles.chip, shadows.sm, containerStyle]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? palette.inkInverse : palette.inkMuted}
        />
      ) : null}
      <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
      {typeof count === 'number' ? (
        <Text variant="caption" weight="semibold" tone={selected ? 'inverse' : 'faint'}>
          {count}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: typeScale.label.fontSize,
    letterSpacing: typeScale.label.letterSpacing,
  },
});
