import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/design/typography';
import { fontFamily, palette, radius, spacing, typeScale } from '@/design/tokens';

interface FieldProps extends TextInputProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string | null;
  secure?: boolean;
}

export function Field({ label, icon, error, secure = false, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text variant="label" weight="semibold" tone="secondary">
        {label}
      </Text>
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          Boolean(error) && styles.fieldError,
        ]}
      >
        <Ionicons name={icon} size={17} color={focused ? palette.primary : palette.inkFaint} />
        <TextInput
          {...rest}
          style={[styles.input, style]}
          placeholderTextColor={palette.inkFaint}
          secureTextEntry={secure && !revealed}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
        />
        {secure ? (
          <Pressable onPress={() => setRevealed((value) => !value)} hitSlop={10}>
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={palette.inkFaint}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" weight="medium">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: palette.border,
  },
  fieldFocused: { borderColor: palette.primary, backgroundColor: palette.surface },
  fieldError: { borderColor: palette.danger },
  input: {
    flex: 1,
    color: palette.ink,
    fontFamily: fontFamily.body,
    fontSize: typeScale.body.fontSize,
    padding: 0,
  },
});
