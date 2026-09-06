import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Eyebrow, Text } from '../typography';
import { palette, spacing } from '../tokens';
import { screenGutter } from './Screen';

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, eyebrow, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Text variant="title" weight="bold">
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action} hitSlop={8}>
          <Text variant="label" weight="semibold" tone="primary">
            {actionLabel}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={palette.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  titleBlock: { gap: spacing.xxs, flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingBottom: spacing.xxs },
});
