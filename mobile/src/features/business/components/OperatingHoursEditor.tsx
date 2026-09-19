import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/design/typography';
import { fontFamily, palette, radius, spacing, typeScale } from '@/design/tokens';
import { Button } from '@/design/components/Button';
import { DAY_KEYS, DAY_LABELS, type OperatingHours } from '@/types/business';

interface Props {
  value: OperatingHours;
  onChange: (next: OperatingHours) => void;
  disabled?: boolean;
}

/**
 * Plain open/close text inputs (e.g. "09:00") rather than a time-picker
 * dependency — validated loosely, since this is a data-entry convenience for
 * the owner, not a scheduling engine that needs to parse arbitrary input.
 */
export function OperatingHoursEditor({ value, onChange, disabled = false }: Props) {
  const setDay = (day: (typeof DAY_KEYS)[number], patch: { open?: string; close?: string } | null) => {
    if (patch === null) {
      onChange({ ...value, [day]: null });
      return;
    }
    const current = value[day] ?? { open: '09:00', close: '17:00' };
    onChange({ ...value, [day]: { ...current, ...patch } });
  };

  return (
    <View style={styles.container}>
      {DAY_KEYS.map((day) => {
        const hours = value[day];
        const closed = hours === null || hours === undefined;

        return (
          <View key={day} style={styles.row}>
            <Text variant="label" weight="semibold" style={styles.dayLabel}>
              {DAY_LABELS[day].slice(0, 3)}
            </Text>

            {closed ? (
              <Button
                label="Closed — tap to set hours"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onPress={() => setDay(day, { open: '09:00', close: '17:00' })}
              />
            ) : (
              <View style={styles.timeRow}>
                <TextInput
                  value={hours.open}
                  onChangeText={(text) => setDay(day, { open: text })}
                  editable={!disabled}
                  placeholder="09:00"
                  placeholderTextColor={palette.inkFaint}
                  style={styles.timeInput}
                />
                <Text variant="body" tone="muted">
                  –
                </Text>
                <TextInput
                  value={hours.close}
                  onChangeText={(text) => setDay(day, { close: text })}
                  editable={!disabled}
                  placeholder="17:00"
                  placeholderTextColor={palette.inkFaint}
                  style={styles.timeInput}
                />
                <Button label="Close" variant="ghost" size="sm" disabled={disabled} onPress={() => setDay(day, null)} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dayLabel: { width: 40 },
  timeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeInput: {
    width: 72,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.label.fontSize,
  },
});
