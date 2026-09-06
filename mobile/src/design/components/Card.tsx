import { Pressable, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion, palette, radius, shadows, spacing } from '../tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
  elevation?: 'sm' | 'md' | 'lg' | 'none';
  style?: ViewStyle | ViewStyle[];
}

/**
 * The app's one container surface. Pressable cards get a subtle spring scale on
 * touch so a tap always feels acknowledged before navigation begins.
 */
export function Card({
  onPress,
  padded = true,
  elevation = 'sm',
  style,
  children,
  ...rest
}: CardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const surface = [styles.card, shadows[elevation], padded && styles.padded, style];

  if (!onPress) {
    return (
      <View {...rest} style={surface}>
        {children}
      </View>
    );
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={() => {
        scale.value = withSpring(0.975, motion.spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      onPress={onPress}
      style={[surface, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg },
});
