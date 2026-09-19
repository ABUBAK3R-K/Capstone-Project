import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/design/components/Button';
import { Screen, screenGutter } from '@/design/components/Screen';
import { Eyebrow, Text } from '@/design/typography';
import { fontFamily, palette, radius, spacing, typeScale } from '@/design/tokens';
import { submitAppointment } from '@/lib/bookings';
import { useInvalidateBusiness } from '@/hooks/useBusiness';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type FlowRoute = RouteProp<RootStackParamList, 'BookingFlow'>;

/**
 * No date-picker dependency is installed, so the requested time is a plain
 * "YYYY-MM-DD HH:mm" text field rather than a native picker — a real
 * dependency addition would be a bigger decision than this MVP flow needs.
 */
export function BookingFlowScreen() {
  const navigation = useNavigation<Navigation>();
  const { params } = useRoute<FlowRoute>();
  const { user } = useAuth();
  const { invalidateCustomerBookings } = useInvalidateBusiness();

  const { business, service } = params;

  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const parsedTime = parseRequestedTime(dateText, timeText);
  const canSubmit = Boolean(parsedTime) && !submitting;

  const submit = async () => {
    if (!user || !parsedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitAppointment({
        businessId: business.id,
        customerId: user.id,
        service,
        requestedTime: parsedTime,
        notes,
      });
      await invalidateCustomerBookings(user.id);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your request.');
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
            Request sent
          </Text>
          <Text variant="body" tone="muted" align="center">
            {business.name} will confirm or decline your booking. Track it under My Bookings.
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Eyebrow>Book an appointment</Eyebrow>
            <Text variant="display" weight="bold">
              {service.name}
            </Text>
            <Text variant="body" tone="muted">
              at {business.name}
              {service.duration_minutes ? ` · ${service.duration_minutes} min` : ''}
            </Text>
          </View>

          <View style={styles.field}>
            <Text variant="label" weight="semibold" tone="secondary">
              Date (YYYY-MM-DD)
            </Text>
            <TextInput
              value={dateText}
              onChangeText={setDateText}
              placeholder="2026-09-25"
              placeholderTextColor={palette.inkFaint}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text variant="label" weight="semibold" tone="secondary">
              Time (HH:mm)
            </Text>
            <TextInput
              value={timeText}
              onChangeText={setTimeText}
              placeholder="14:30"
              placeholderTextColor={palette.inkFaint}
              style={styles.input}
            />
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
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          {error ? (
            <Animated.View entering={FadeIn}>
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            </Animated.View>
          ) : null}

          <Button label="Send request" onPress={submit} disabled={!canSubmit} loading={submitting} fullWidth size="lg" />
          {!parsedTime && (dateText || timeText) ? (
            <Text variant="caption" tone="faint" align="center">
              Use the exact formats shown above.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function parseRequestedTime(dateText: string, timeText: string): string | null {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateText.trim()) && /^\d{2}:\d{2}$/.test(timeText.trim());
  if (!match) return null;
  const iso = new Date(`${dateText.trim()}T${timeText.trim()}:00`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: screenGutter, paddingTop: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },
  header: { gap: spacing.sm },
  field: { gap: spacing.sm },
  input: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.body.fontSize,
  },
  inputMultiline: { height: 84, paddingTop: spacing.md, textAlignVertical: 'top' },
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
