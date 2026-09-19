import { Linking, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Badge } from '@/design/components/Badge';
import { Button } from '@/design/components/Button';
import { Card } from '@/design/components/Card';
import { Text } from '@/design/typography';
import { palette, spacing } from '@/design/tokens';
import { useActiveBusinessServices } from '@/hooks/useBusiness';
import { DAY_KEYS, DAY_LABELS, type Business } from '@/types/business';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * Renders inside PlaceDetailScreen when a place is business-backed (see
 * migration 008's places-mirroring trigger) — extends the place detail
 * page rather than replacing it, per the business-accounts spec.
 */
export function BusinessSection({ business }: { business: Business }) {
  const navigation = useNavigation<Navigation>();
  const { data: services } = useActiveBusinessServices(business.id);

  const appointmentServices = (services ?? []).filter((s) => s.service_type === 'appointment');
  const orderServices = (services ?? []).filter((s) => s.service_type === 'order');

  return (
    <View style={styles.block}>
      <Text variant="heading" weight="semibold">
        Services
      </Text>

      {business.offers && business.offers.length > 0 ? (
        <View style={styles.offersRow}>
          {business.offers.map((offer) => (
            <Badge key={offer} label={offer} color={palette.accent} />
          ))}
        </View>
      ) : null}

      {(business.contact_phone || business.contact_email) && (
        <View style={styles.contactCard}>
          {business.contact_phone ? (
            <ContactRow
              icon="call-outline"
              label={business.contact_phone}
              onPress={() => Linking.openURL(`tel:${business.contact_phone}`)}
            />
          ) : null}
          {business.contact_email ? (
            <ContactRow
              icon="mail-outline"
              label={business.contact_email}
              onPress={() => Linking.openURL(`mailto:${business.contact_email}`)}
            />
          ) : null}
        </View>
      )}

      <HoursCard hours={business.operating_hours} />

      {appointmentServices.length > 0 ? (
        <View style={styles.serviceGroup}>
          <Text variant="label" weight="semibold" tone="muted">
            Book an appointment
          </Text>
          {appointmentServices.map((service) => (
            <Card
              key={service.id}
              style={styles.serviceCard}
              onPress={() => navigation.navigate('BookingFlow', { business, service })}
            >
              <View style={styles.serviceCopy}>
                <Text variant="subheading" weight="semibold">
                  {service.name}
                </Text>
                <Text variant="caption" tone="muted">
                  {service.duration_minutes ? `${service.duration_minutes} min` : 'Appointment'}
                  {service.price != null ? ` · $${service.price.toFixed(2)}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} />
            </Card>
          ))}
        </View>
      ) : null}

      {orderServices.length > 0 ? (
        <View style={styles.serviceGroup}>
          <Text variant="label" weight="semibold" tone="muted">
            Order
          </Text>
          <Button
            label="Start an order"
            variant="secondary"
            icon="bag-handle-outline"
            fullWidth
            onPress={() => navigation.navigate('OrderFlow', { business, services: orderServices })}
          />
        </View>
      ) : null}

      {appointmentServices.length === 0 && orderServices.length === 0 ? (
        <Text variant="body" tone="muted">
          This business hasn't listed any services yet.
        </Text>
      ) : null}
    </View>
  );
}

function ContactRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} padded={false} style={styles.contactRow}>
      <View style={styles.contactInner}>
        <Ionicons name={icon} size={16} color={palette.inkMuted} />
        <Text variant="label" weight="medium">
          {label}
        </Text>
      </View>
    </Card>
  );
}

function HoursCard({ hours }: { hours: Business['operating_hours'] }) {
  const hasAnyHours = DAY_KEYS.some((day) => hours[day]);
  if (!hasAnyHours) return null;

  return (
    <Card style={styles.hoursCard}>
      {DAY_KEYS.map((day) => {
        const dayHours = hours[day];
        return (
          <View key={day} style={styles.hoursRow}>
            <Text variant="label" tone="muted">
              {DAY_LABELS[day]}
            </Text>
            <Text variant="label" weight="semibold">
              {dayHours ? `${dayHours.open} – ${dayHours.close}` : 'Closed'}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  offersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  contactCard: { gap: spacing.sm },
  contactRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  contactInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hoursCard: { gap: spacing.xs },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  serviceGroup: { gap: spacing.sm },
  serviceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  serviceCopy: { flex: 1, gap: spacing.xxs },
});
