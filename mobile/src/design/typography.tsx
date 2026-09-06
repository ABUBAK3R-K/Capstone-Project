import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { fontFamily, palette, typeScale } from './tokens';

type Variant = keyof typeof typeScale;
type Tone = 'default' | 'secondary' | 'muted' | 'faint' | 'inverse' | 'primary' | 'accent' | 'danger';

const toneColor: Record<Tone, string> = {
  default: palette.ink,
  secondary: palette.inkSecondary,
  muted: palette.inkMuted,
  faint: palette.inkFaint,
  inverse: palette.inkInverse,
  primary: palette.primary,
  accent: palette.accent,
  danger: palette.danger,
};

/** Variants that use the display face; everything else uses the body face. */
const displayVariants = new Set<Variant>(['display', 'title', 'heading']);

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
}

function resolveFamily(variant: Variant, weight: AppTextProps['weight']) {
  if (weight === 'bold') return fontFamily.display;
  if (displayVariants.has(variant)) {
    return weight === 'regular' ? fontFamily.bodyMedium : fontFamily.displayMedium;
  }
  if (weight === 'semibold') return fontFamily.bodySemiBold;
  if (weight === 'medium') return fontFamily.bodyMedium;
  return fontFamily.body;
}

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  uppercase,
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        {
          fontFamily: resolveFamily(variant, weight),
          color: toneColor[tone],
          textAlign: align,
        },
        uppercase && styles.uppercase,
        style,
      ]}
    />
  );
}

/** Small all-caps label used for section eyebrows and category tags. */
export function Eyebrow({ style, ...rest }: AppTextProps) {
  return (
    <Text
      variant="caption"
      tone="muted"
      weight="semibold"
      uppercase
      {...rest}
      style={[styles.eyebrow, style]}
    />
  );
}

const styles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
  eyebrow: { letterSpacing: 1.1 },
});
