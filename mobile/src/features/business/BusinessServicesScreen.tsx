import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/providers/AuthProvider';
import { Badge } from '@/design/components/Badge';
import { Button } from '@/design/components/Button';
import { Card } from '@/design/components/Card';
import { EmptyState } from '@/design/components/EmptyState';
import { Screen, screenGutter } from '@/design/components/Screen';
import { SectionHeader } from '@/design/components/SectionHeader';
import { Text } from '@/design/typography';
import { fontFamily, palette, radius, spacing, typeScale } from '@/design/tokens';
import { createBusinessService, deleteBusinessService, setServiceActive } from '@/lib/businesses';
import { useBusinessServices, useInvalidateBusiness, useOwnBusiness } from '@/hooks/useBusiness';
import type { ServiceType } from '@/types/business';

export function BusinessServicesScreen() {
  const { user } = useAuth();
  const { data: business, isLoading: loadingBusiness } = useOwnBusiness(user?.id);
  const { data: services, isLoading: loadingServices } = useBusinessServices(business?.id);
  const { invalidateServices } = useInvalidateBusiness();

  const [showForm, setShowForm] = useState(false);

  if (loadingBusiness || loadingServices) {
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
            icon="pricetags-outline"
            title="Create your listing first"
            message="Set up your business on the Dashboard tab before adding services."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader
          eyebrow="Bookable & orderable"
          title="Services"
          actionLabel={showForm ? undefined : 'Add service'}
          onAction={showForm ? undefined : () => setShowForm(true)}
        />

        {showForm ? (
          <AddServiceForm
            businessId={business.id}
            onDone={async () => {
              setShowForm(false);
              await invalidateServices(business.id);
            }}
            onCancel={() => setShowForm(false)}
          />
        ) : null}

        {(services ?? []).length === 0 && !showForm ? (
          <EmptyState
            icon="pricetags-outline"
            title="No services yet"
            message="Add an appointment-based service (like a haircut) or an order-based item (like a dessert) customers can request."
            actionLabel="Add service"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <View style={styles.list}>
            {(services ?? []).map((service) => (
              <Card key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceCopy}>
                    <Text variant="subheading" weight="semibold">
                      {service.name}
                    </Text>
                    {service.description ? (
                      <Text variant="caption" tone="muted">
                        {service.description}
                      </Text>
                    ) : null}
                  </View>
                  <Badge
                    label={service.service_type === 'appointment' ? 'Appointment' : 'Order'}
                    color={service.service_type === 'appointment' ? palette.secondary : palette.accent}
                  />
                </View>

                <View style={styles.serviceMeta}>
                  {service.price != null ? (
                    <Text variant="label" weight="semibold">
                      ${service.price.toFixed(2)}
                    </Text>
                  ) : null}
                  {service.duration_minutes ? (
                    <Text variant="label" tone="muted">
                      {service.duration_minutes} min
                    </Text>
                  ) : null}
                  <Text variant="label" tone={service.is_active ? 'accent' : 'faint'}>
                    {service.is_active ? 'Active' : 'Hidden'}
                  </Text>
                </View>

                <View style={styles.serviceActions}>
                  <Button
                    label={service.is_active ? 'Hide' : 'Show'}
                    variant="ghost"
                    size="sm"
                    onPress={async () => {
                      await setServiceActive(service.id, !service.is_active);
                      await invalidateServices(business.id);
                    }}
                  />
                  <Button
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    onPress={async () => {
                      await deleteBusinessService(service.id);
                      await invalidateServices(business.id);
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function AddServiceForm({
  businessId,
  onDone,
  onCancel,
}: {
  businessId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('appointment');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createBusinessService({ businessId, name, description, price, serviceType, durationMinutes });
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={styles.formCard}>
      <View style={styles.typeToggle}>
        <TypeOption label="Appointment" active={serviceType === 'appointment'} onPress={() => setServiceType('appointment')} />
        <TypeOption label="Order" active={serviceType === 'order'} onPress={() => setServiceType('order')} />
      </View>

      <LabeledInput label="Name" value={name} onChangeText={setName} placeholder={serviceType === 'appointment' ? 'Haircut' : 'Chocolate cake slice'} />
      <LabeledInput label="Description" value={description} onChangeText={setDescription} multiline />
      <LabeledInput label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="15.00" />
      {serviceType === 'appointment' ? (
        <LabeledInput label="Duration (minutes)" value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="number-pad" />
      ) : null}

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <View style={styles.formActions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
        <Button label="Add" onPress={submit} disabled={!canSubmit} loading={submitting} />
      </View>
    </Card>
  );
}

function TypeOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.typeOption, active && styles.typeOptionActive]}
    >
      <Text variant="label" weight="semibold" tone={active ? 'inverse' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}

function LabeledInput({
  label,
  multiline = false,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text variant="label" weight="semibold" tone="secondary">
        {label}
      </Text>
      <TextInput
        {...rest}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        placeholderTextColor={palette.inkFaint}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenGutter },
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },
  list: { gap: spacing.md },
  serviceCard: { gap: spacing.md },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  serviceCopy: { flex: 1, gap: spacing.xxs },
  serviceMeta: { flexDirection: 'row', gap: spacing.lg },
  serviceActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  formCard: { gap: spacing.lg },
  formActions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  typeToggle: { flexDirection: 'row', gap: spacing.sm },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.canvas,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
  },
  typeOptionActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  field: { gap: spacing.sm },
  input: {
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: palette.canvas,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.body.fontSize,
  },
  inputMultiline: { height: 76, paddingTop: spacing.md, textAlignVertical: 'top' },
});
