import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { Badge } from '@/design/components/Badge';
import { Card } from '@/design/components/Card';
import { EmptyState } from '@/design/components/EmptyState';
import { Screen, screenGutter } from '@/design/components/Screen';
import { Text } from '@/design/typography';
import { palette, spacing } from '@/design/tokens';
import { useCustomerBookings } from '@/hooks/useBusiness';
import type { RootStackParamList } from '@/navigation/types';
import type { Booking, BookingStatus } from '@/types/business';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const STATUS_META: Record<BookingStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: palette.warning },
  confirmed: { label: 'Confirmed', color: palette.success },
  declined: { label: 'Declined', color: palette.danger },
  completed: { label: 'Completed', color: palette.accent },
};

/**
 * There is no push notification path in this app, so "did the business
 * respond?" is answered here by polling (useCustomerBookings refetches
 * every 20s) rather than a delivered notification — see useBusiness.ts.
 */
export function MyBookingsScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const { data: bookings, isLoading } = useCustomerBookings(user?.id);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={palette.ink} />
        </Pressable>
        <Text variant="title" weight="bold">
          My bookings
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (bookings ?? []).length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="calendar-outline"
            title="No bookings yet"
            message="Bookings and orders you place with local businesses will show up here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {(bookings ?? []).map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const meta = STATUS_META[booking.status];

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text variant="subheading" weight="semibold">
            {booking.service_name ?? 'Service'}
          </Text>
          <Text variant="caption" tone="muted">
            {booking.business_name ?? 'Business'}
          </Text>
        </View>
        <Badge label={meta.label} color={meta.color} />
      </View>
      <Text variant="caption" tone="muted">
        {booking.service_type === 'appointment'
          ? booking.requested_time
            ? new Date(booking.requested_time).toLocaleString()
            : 'Time not set'
          : `Qty ${booking.quantity}`}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: spacing.lg,
  },
  headerSpacer: { width: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter },
  content: { paddingHorizontal: screenGutter, paddingBottom: spacing.huge, gap: spacing.md },
  card: { gap: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  cardCopy: { flex: 1, gap: spacing.xxs },
});
