import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/design/components/Button';
import { Card } from '@/design/components/Card';
import { Text } from '@/design/typography';
import { screenGutter } from '@/design/components/Screen';
import { REPORT_STATUS_META } from '@/constants/categories';
import { useLocation } from '@/providers/LocationProvider';
import { useNearbyReports } from '@/hooks/usePlaces';
import { hasMapTiles, hasRecommendationService } from '@/lib/env';
import { gradients, palette, radius, spacing, withAlpha } from '@/design/tokens';

export function ProfileScreen() {
  const { user, isGuest, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { center } = useLocation();
  const { reports } = useNearbyReports(center, Boolean(user));

  const [signingOut, setSigningOut] = useState(false);

  const stats = useMemo(() => {
    const counts = { reported: 0, in_progress: 0, fixed: 0 };
    for (const report of reports) counts[report.status] += 1;
    return counts;
  }, [reports]);

  const email = user?.email ?? 'Guest session';
  const initial = (user?.email?.[0] ?? 'G').toUpperCase();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.inkHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + spacing.xxl }]}
        >
          <Animated.View entering={FadeInUp.duration(320)} style={styles.identity}>
            <View style={styles.avatar}>
              <Text variant="title" weight="bold" tone="inverse">
                {initial}
              </Text>
            </View>
            <View style={styles.identityCopy}>
              <Text variant="heading" weight="semibold" tone="inverse" numberOfLines={1}>
                {email}
              </Text>
              <Text variant="caption" style={styles.identityMeta}>
                {isGuest ? 'Browsing without an account' : 'Signed in with Supabase Auth'}
              </Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ─── Report stats ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="title" weight="bold">
            Your reports
          </Text>
          <View style={styles.statRow}>
            {(['reported', 'in_progress', 'fixed'] as const).map((status) => {
              const meta = REPORT_STATUS_META[status];
              return (
                <Card key={status} padded={false} style={styles.statCard}>
                  <View style={styles.statInner}>
                    <View style={[styles.statIcon, { backgroundColor: withAlpha(meta.color, 0.13) }]}>
                      <Ionicons name={meta.icon} size={15} color={meta.color} />
                    </View>
                    <Text variant="title" weight="bold">
                      {stats[status]}
                    </Text>
                    <Text variant="caption" tone="muted" weight="medium">
                      {meta.label}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        </View>

        {/* ─── Service status ────────────────────────────────────────────────
            Surfaced here rather than hidden in logs: an unconfigured service
            silently degrades a whole screen, and this says which one. */}
        <View style={styles.section}>
          <Text variant="title" weight="bold">
            Connected services
          </Text>
          <Card padded={false} style={styles.serviceCard}>
            <ServiceRow label="Supabase" detail="Auth, places and reports" connected />
            <ServiceRow
              label="Recommendations"
              detail={hasRecommendationService ? 'FastAPI service reachable' : 'EXPO_PUBLIC_RECOMMENDATIONS_URL not set'}
              connected={hasRecommendationService}
            />
            <ServiceRow
              label="Map tiles"
              detail={hasMapTiles ? 'Hosted OSM-style raster source' : 'EXPO_PUBLIC_MAP_TILE_URL not set'}
              connected={hasMapTiles}
              last
            />
          </Card>
        </View>

        {/* ─── Account ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text variant="title" weight="bold">
            Account
          </Text>
          <Button
            label={isGuest ? 'Go to sign in' : 'Sign out'}
            variant="secondary"
            icon="log-out-outline"
            fullWidth
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ServiceRow({
  label,
  detail,
  connected,
  last = false,
}: {
  label: string;
  detail: string;
  connected: boolean;
  last?: boolean;
}) {
  return (
    <Pressable disabled style={[styles.serviceRow, !last && styles.serviceRowBorder]}>
      <View
        style={[
          styles.serviceDot,
          { backgroundColor: connected ? palette.success : palette.warning },
        ]}
      />
      <View style={styles.serviceCopy}>
        <Text variant="label" weight="semibold">
          {label}
        </Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
      <Ionicons
        name={connected ? 'checkmark-circle' : 'alert-circle-outline'}
        size={17}
        color={connected ? palette.success : palette.warning}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  content: { paddingBottom: spacing.huge },
  header: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing.xxxl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: { flex: 1, gap: spacing.xxs },
  identityMeta: { color: palette.onInkFaint },
  section: { marginTop: spacing.xxxl, paddingHorizontal: screenGutter, gap: spacing.lg },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1 },
  statInner: { padding: spacing.lg, gap: spacing.xs, alignItems: 'flex-start' },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  serviceCard: { paddingHorizontal: spacing.lg },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  serviceRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  serviceDot: { width: 7, height: 7, borderRadius: radius.pill },
  serviceCopy: { flex: 1, gap: spacing.xxs },
});
