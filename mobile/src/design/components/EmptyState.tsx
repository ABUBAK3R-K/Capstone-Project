import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from './Button';
import { Text } from '../typography';
import { palette, radius, spacing } from '../tokens';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** One sentence explaining *why* it is empty and what to do next. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'danger';
  compact?: boolean;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  tone = 'neutral',
  compact = false,
  style,
}: EmptyStateProps) {
  const isDanger = tone === 'danger';

  return (
    <View style={[styles.container, compact && styles.compact, style]}>
      <View style={[styles.iconWell, isDanger && styles.iconWellDanger]}>
        <Ionicons
          name={icon}
          size={compact ? 20 : 26}
          color={isDanger ? palette.danger : palette.inkMuted}
        />
      </View>
      <View style={styles.copy}>
        <Text variant={compact ? 'subheading' : 'heading'} weight="semibold" align="center">
          {title}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {message}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  compact: { paddingVertical: spacing.xl, gap: spacing.md },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvasSunken,
  },
  iconWellDanger: { backgroundColor: palette.dangerSoft },
  copy: { gap: spacing.xs, maxWidth: 300 },
});
