import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '../typography';
import { palette, radius, spacing, withAlpha } from '../tokens';

interface BadgeProps {
  label: string;
  color?: string;
  /** Softens the given colour into a tinted pill instead of a solid fill. */
  soft?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

export function Badge({ label, color = palette.inkMuted, soft = true, icon, style }: BadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        soft ? { backgroundColor: withAlpha(color, 0.12) } : { backgroundColor: color },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={soft ? color : palette.inkInverse} /> : null}
      <Text
        variant="caption"
        weight="semibold"
        uppercase
        style={{ color: soft ? color : palette.inkInverse, letterSpacing: 0.7 }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xs,
  },
});
