import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { Badge } from '@/design/components/Badge';
import { Button } from '@/design/components/Button';
import { Card } from '@/design/components/Card';
import { EmptyState } from '@/design/components/EmptyState';
import { Screen, screenGutter } from '@/design/components/Screen';
import { Text } from '@/design/typography';
import { palette, spacing } from '@/design/tokens';
import { useCancelBooking, useCustomerBookings } from '@/hooks/useBusiness';
import { errorMessage } from '@/lib/errors';
import type { RootStackParamList } from '@/navigation/types';
import type { Booking, BookingStatus } from '@/types/business';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const STATUS_META: Record<BookingStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: palette.warning },
  confirmed: { label: 'Confirmed', color: palette.success },
  declined: { label: 'Declined', color: palette.danger },
  completed: { label: 'Completed', color: palette.accent },
  cancelled: { label: 'Cancelled', color: palette.inkMuted },
};

/** Mirrors the customer transitions allowed by migration 011. */
const CANCELLABLE: ReadonlySet<BookingStatus> = new Set<BookingStatus>(['pending', 'confirmed']);

/**
 * There is no push notification path in this app, so "did the business
 * respond?" is answered here by polling (useCustomerBookings refetches
 * every 20s) rather than a delivered notification — see useBusiness.ts.
 */
export function MyBookingsScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const { data: bookings, isLoading } = useCustomerBookings(user?.id);
  const cancel = useCancelBooking(user?.id);

  const confirmCancel = (booking: Booking) => {
    Alert.alert(
      'Cancel this booking?',
      `${booking.business_name ?? 'The business'} will see it as cancelled. This can't be undone.`,
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: () =>
            cancel.mutate(booking.id, {
              onError: (caught) => Alert.alert('Could not cancel', errorMessage(caught)),
            }),
        },
      ],
    );
  };

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
            <BookingRow
              key={booking.id}
              booking={booking}
              cancelling={cancel.isPending && cancel.variables === booking.id}
              onCancel={() => confirmCancel(booking)}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function BookingRow({
  booking,
  cancelling,
  onCancel,
}: {
  booking: Booking;
  cancelling: boolean;
  onCancel: () => void;
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
      {CANCELLABLE.has(booking.status) ? (
        <Button
          label="Cancel booking"
          variant="ghost"
          size="sm"
          icon="close-circle-outline"
          loading={cancelling}
          onPress={onCancel}
          style={styles.cancelButton}
        />
      ) : null}
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
  cancelButton: { alignSelf: 'flex-start' },
});
