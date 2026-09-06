import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/typography';
import { palette, radius, spacing } from '@/design/tokens';
import type { LatLng } from '@/lib/geo';

interface LocationTagProps {
  coords: LatLng | null;
  resolving: boolean;
  onRetry: () => void;
}

/**
 * GPS is auto-captured the moment a photo is taken, so this is a status
 * readout rather than an input — but it stays retryable, because a failed fix
 * would otherwise silently block submission.
 */
export function LocationTag({ coords, resolving, onRetry }: LocationTagProps) {
  const state = resolving ? 'resolving' : coords ? 'ready' : 'missing';

  const config = {
    resolving: {
      icon: 'locate' as const,
      color: palette.inkMuted,
      background: palette.canvasSunken,
      title: 'Getting your location…',
      detail: 'Hold still for a moment.',
    },
    ready: {
      icon: 'checkmark-circle' as const,
      color: palette.success,
      background: palette.successSoft,
      title: 'Location tagged',
      detail: coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : '',
    },
    missing: {
      icon: 'alert-circle' as const,
      color: palette.warning,
      background: palette.warningSoft,
      title: 'Location needed',
      detail: 'Enable location access so the city knows where to look.',
    },
  }[state];

  return (
    <View style={[styles.container, { backgroundColor: config.background }]}>
      {resolving ? (
        <ActivityIndicator size="small" color={palette.inkMuted} />
      ) : (
        <Ionicons name={config.icon} size={18} color={config.color} />
      )}

      <View style={styles.copy}>
        <Text variant="label" weight="semibold">
          {config.title}
        </Text>
        {config.detail ? (
          <Text variant="caption" tone="muted">
            {config.detail}
          </Text>
        ) : null}
      </View>

      {state !== 'resolving' ? (
        <Pressable onPress={onRetry} hitSlop={10} style={styles.retry}>
          <Ionicons name="refresh" size={15} color={palette.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  copy: { flex: 1, gap: spacing.xxs },
  retry: { padding: spacing.xs },
});
