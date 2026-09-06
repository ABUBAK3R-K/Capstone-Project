import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Text } from '../typography';
import { motion, palette, radius, shadows, spacing } from '../tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
}

const height: Record<Size, number> = { sm: 38, md: 48, lg: 54 };
const paddingX: Record<Size, number> = { sm: spacing.lg, md: spacing.xl, lg: spacing.xxl };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'leading',
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = true,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const isInert = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const surface = variantSurface[variant];
  const contentTone = variantTone[variant];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      disabled={isInert}
      onPressIn={() => {
        scale.value = withSpring(0.97, motion.spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      onPress={() => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={[
        styles.base,
        surface,
        { height: height[size], paddingHorizontal: paddingX[size] },
        fullWidth && styles.fullWidth,
        isInert && styles.inert,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={contentTone === 'inverse' ? palette.inkInverse : palette.primary}
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'leading' ? (
            <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={iconColor[variant]} />
          ) : null}
          <Text variant={size === 'sm' ? 'label' : 'subheading'} weight="semibold" tone={contentTone}>
            {label}
          </Text>
          {icon && iconPosition === 'trailing' ? (
            <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={iconColor[variant]} />
          ) : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const variantSurface: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: palette.primary, ...shadows.sm },
  secondary: {
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.borderStrong,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: palette.danger, ...shadows.sm },
};

const variantTone = {
  primary: 'inverse',
  secondary: 'default',
  ghost: 'primary',
  danger: 'inverse',
} as const;

const iconColor: Record<Variant, string> = {
  primary: palette.inkInverse,
  secondary: palette.ink,
  ghost: palette.primary,
  danger: palette.inkInverse,
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  inert: { opacity: 0.45 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
