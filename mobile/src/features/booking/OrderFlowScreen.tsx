import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/design/components/Button';
import { Card } from '@/design/components/Card';
import { Screen, screenGutter } from '@/design/components/Screen';
import { Eyebrow, Text } from '@/design/typography';
import { fontFamily, palette, radius, spacing, typeScale } from '@/design/tokens';
import { submitOrder, type OrderLine } from '@/lib/bookings';
import { useInvalidateBusiness } from '@/hooks/useBusiness';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type FlowRoute = RouteProp<RootStackParamList, 'OrderFlow'>;

export function OrderFlowScreen() {
  const navigation = useNavigation<Navigation>();
  const { params } = useRoute<FlowRoute>();
  const { user } = useAuth();
  const { invalidateCustomerBookings } = useInvalidateBusiness();

  const { business, services } = params;

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const lines: OrderLine[] = useMemo(
    () =>
      services
        .map((service) => ({ service, quantity: quantities[service.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [services, quantities],
  );

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (line.service.price ?? 0) * line.quantity, 0),
    [lines],
  );

  const canSubmit = lines.length > 0 && !submitting;

  const setQuantity = (serviceId: string, quantity: number) => {
    setQuantities((current) => ({ ...current, [serviceId]: Math.max(0, quantity) }));
  };

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitOrder({ businessId: business.id, customerId: user.id, lines, notes });
      await invalidateCustomerBookings(user.id);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <View style={styles.centered}>
          <View style={styles.successMark}>
            <Ionicons name="checkmark" size={34} color={palette.inkInverse} />
          </View>
          <Text variant="title" weight="bold" align="center">
            Order placed
          </Text>
          <Text variant="body" tone="muted" align="center">
            {business.name} will accept or decline your order. Track it under My Bookings.
          </Text>
          <View style={styles.successActions}>
            <Button label="My bookings" onPress={() => navigation.replace('MyBookings')} />
            <Button label="Done" variant="secondary" onPress={() => navigation.popToTop()} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Eyebrow>Place an order</Eyebrow>
          <Text variant="display" weight="bold">
            {business.name}
          </Text>
          <Text variant="body" tone="muted">
            Pick items and quantities — this places the order for pickup, it does not track delivery.
          </Text>
        </View>

        <View style={styles.list}>
          {services.map((service) => {
            const quantity = quantities[service.id] ?? 0;
            return (
              <Card key={service.id} style={styles.itemCard}>
                <View style={styles.itemCopy}>
                  <Text variant="subheading" weight="semibold">
                    {service.name}
                  </Text>
                  {service.price != null ? (
                    <Text variant="label" tone="muted">
                      ${service.price.toFixed(2)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove one ${service.name}`}
                    onPress={() => setQuantity(service.id, quantity - 1)}
                    style={styles.stepperButton}
                  >
                    <Ionicons name="remove" size={16} color={palette.ink} />
                  </Pressable>
                  <Text variant="label" weight="semibold" style={styles.stepperValue}>
                    {quantity}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add one ${service.name}`}
                    onPress={() => setQuantity(service.id, quantity + 1)}
                    style={styles.stepperButton}
                  >
                    <Ionicons name="add" size={16} color={palette.ink} />
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>

        <View style={styles.field}>
          <Text variant="label" weight="semibold" tone="secondary">
            Notes (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Anything the business should know"
            placeholderTextColor={palette.inkFaint}
            style={styles.input}
          />
        </View>

        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Text variant="subheading" weight="semibold">
            Total: ${total.toFixed(2)}
          </Text>
          <Button label="Place order" onPress={submit} disabled={!canSubmit} loading={submitting} size="lg" fullWidth />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },
  header: { gap: spacing.sm },
  list: { gap: spacing.md },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemCopy: { flex: 1, gap: spacing.xxs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { minWidth: 20, textAlign: 'center' },
  field: { gap: spacing.sm },
  input: {
    height: 84,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.body.fontSize,
    textAlignVertical: 'top',
  },
  footer: { gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter, gap: spacing.lg },
  successMark: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: palette.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
