import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/design/components/Badge';
import { Card } from '@/design/components/Card';
import { Text } from '@/design/typography';
import { REPORT_STATUS_META, reportCategoryMeta } from '@/constants/categories';
import { formatDistance } from '@/lib/geo';
import { palette, radius, spacing, withAlpha } from '@/design/tokens';
import type { ProblemReport } from '@/types/place';

interface ProblemCardProps {
  report: ProblemReport & { distance?: number | null };
}

/** Relative age, kept coarse — an exact timestamp is noise in a feed. */
function relativeAge(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const hours = elapsed / 3_600_000;
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function ProblemCard({ report }: ProblemCardProps) {
  const category = reportCategoryMeta(report.category);
  const status = REPORT_STATUS_META[report.status] ?? REPORT_STATUS_META.reported;

  return (
    <Card padded={false} elevation="sm" style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconWell, { backgroundColor: withAlpha(category.color, 0.13) }]}>
          <Ionicons name={category.icon} size={19} color={category.color} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="subheading" weight="semibold" numberOfLines={1} style={styles.title}>
              {report.category ?? 'Issue'}
            </Text>
            <Badge label={status.label} color={status.color} icon={status.icon} />
          </View>

          {report.description ? (
            <Text variant="label" tone="muted" numberOfLines={2}>
              {report.description}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Text variant="caption" tone="faint" weight="medium">
              {relativeAge(report.created_at)}
            </Text>
            {typeof report.distance === 'number' ? (
              <>
                <View style={styles.dot} />
                <Text variant="caption" tone="faint" weight="medium">
                  {formatDistance(report.distance)} away
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxs },
  dot: { width: 3, height: 3, borderRadius: radius.pill, backgroundColor: palette.inkFaint },
});
