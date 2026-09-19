import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { Badge } from '@/design/components/Badge';
import { Button } from '@/design/components/Button';
import { Card } from '@/design/components/Card';
import { EmptyState } from '@/design/components/EmptyState';
import { Screen, screenGutter } from '@/design/components/Screen';
import { SectionHeader } from '@/design/components/SectionHeader';
import { Text } from '@/design/typography';
import { palette, spacing } from '@/design/tokens';
import { updateBookingStatus } from '@/lib/bookings';
import { useBusinessBookings, useInvalidateBusiness, useOwnBusiness } from '@/hooks/useBusiness';
import type { Booking, BookingStatus } from '@/types/business';

const STATUS_META: Record<BookingStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: palette.warning },
  confirmed: { label: 'Confirmed', color: palette.success },
  declined: { label: 'Declined', color: palette.danger },
  completed: { label: 'Completed', color: palette.accent },
};

export function BusinessBookingsScreen() {
  const { user } = useAuth();
  const { data: business, isLoading: loadingBusiness } = useOwnBusiness(user?.id);
  const { data: bookings, isLoading: loadingBookings } = useBusinessBookings(business?.id);
  const { invalidateBusinessBookings } = useInvalidateBusiness();

  if (loadingBusiness || loadingBookings) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      </Screen>
    );
  }

  if (!business) {
    return (
      <Screen>
        <View style={styles.centered}>
          <EmptyState
            icon="calendar-outline"
            title="Create your listing first"
            message="Bookings will appear here once your business is set up and customers can find it."
          />
        </View>
      </Screen>
    );
  }

  const list = bookings ?? [];
  const pending = list.filter((b) => b.status === 'pending');
  const rest = list.filter((b) => b.status !== 'pending');

  const respond = async (booking: Booking, status: BookingStatus) => {
    await updateBookingStatus(booking.id, status);
    await invalidateBusinessBookings(business.id);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader eyebrow="Incoming" title="Bookings & orders" />

        {list.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Nothing yet"
            message="Bookings and orders from customers will show up here — refreshed automatically every 20 seconds."
          />
        ) : (
          <View style={styles.list}>
            {pending.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onRespond={respond} />
            ))}
            {rest.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onRespond={respond} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function BookingCard({
  booking,
  onRespond,
}: {
  booking: Booking;
  onRespond: (booking: Booking, status: BookingStatus) => Promise<void>;
}) {
  const meta = STATUS_META[booking.status];

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text variant="subheading" weight="semibold">
            {booking.service_name ?? 'Service'}
          </Text>
          <Text variant="caption" tone="muted">
            {booking.service_type === 'appointment'
              ? booking.requested_time
                ? new Date(booking.requested_time).toLocaleString()
                : 'Time not set'
              : `Qty ${booking.quantity}`}
          </Text>
        </View>
        <Badge label={meta.label} color={meta.color} />
      </View>

      {booking.notes ? (
        <Text variant="body" tone="muted">
          "{booking.notes}"
        </Text>
      ) : null}

      {booking.status === 'pending' ? (
        <View style={styles.actions}>
          <Button label="Decline" variant="secondary" size="sm" onPress={() => onRespond(booking, 'declined')} />
          <Button label="Accept" size="sm" onPress={() => onRespond(booking, 'confirmed')} />
        </View>
      ) : null}

      {booking.status === 'confirmed' ? (
        <View style={styles.actions}>
          <Button label="Mark completed" variant="secondary" size="sm" onPress={() => onRespond(booking, 'completed')} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter },
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },
  list: { gap: spacing.md },
  card: { gap: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  cardCopy: { flex: 1, gap: spacing.xxs },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
