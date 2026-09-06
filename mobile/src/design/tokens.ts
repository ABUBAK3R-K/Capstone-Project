import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * "Terracotta & Ink" — the single source of truth for the app's visual identity.
 *
 * Nothing in features/ should ever hardcode a hex value, a pixel margin or a
 * font size. If a value is missing here, add it here.
 */

export const palette = {
  // Canvas is warm paper rather than pure white — it stops the card surfaces
  // from disappearing into the background without needing heavy borders.
  canvas: '#FBF8F4',
  canvasSunken: '#F3EEE7',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  /** Surface that lets a photo read through it, e.g. a floating back button. */
  surfaceTranslucent: 'rgba(255, 255, 255, 0.90)',

  ink: '#16181D',
  inkSecondary: '#3D434F',
  inkMuted: '#6B7280',
  inkFaint: '#9CA3AF',
  inkInverse: '#FFFFFF',

  // Terracotta: primary actions, selected states, brand moments.
  primary: '#E0562F',
  primaryPressed: '#C4441F',
  primarySoft: '#FDEDE7',
  primaryBorder: '#F5C4B2',

  // Deep teal: secondary accent, map affordances, links.
  accent: '#0E6E62',
  accentPressed: '#0A574D',
  accentSoft: '#E2F1EE',

  success: '#1F9D55',
  successSoft: '#E4F5EB',
  warning: '#F2A61B',
  warningSoft: '#FEF3DF',
  danger: '#D14343',
  dangerSoft: '#FBEAEA',

  // Text and surfaces that sit on top of the ink gradients or a photo scrim.
  onInk: 'rgba(255, 255, 255, 0.85)',
  onInkMuted: 'rgba(255, 255, 255, 0.66)',
  onInkFaint: 'rgba(255, 255, 255, 0.50)',
  onInkSurface: 'rgba(255, 255, 255, 0.08)',
  onImageSurface: 'rgba(22, 24, 29, 0.60)',

  border: '#E8E1D8',
  borderStrong: '#D6CCBE',
  overlay: 'rgba(22, 24, 29, 0.55)',
  scrim: 'rgba(22, 24, 29, 0.08)',
} as const;

/**
 * Category ramp. Used identically for map markers, card tags and filter chips
 * so a colour always means the same category everywhere in the app.
 */
export const categoryPalette = {
  Shops: '#E0562F',
  Religious: '#7C5CD6',
  Tourism: '#1F86D6',
  'Public Parks': '#1F9D55',
  'Public Services': '#0E6E62',
  Other: '#6B7280',
} as const;

/**
 * Gradient ramps. Declared as tuples so LinearGradient's `colors` prop accepts
 * them directly, and so an ink header is the same ink everywhere.
 */
export const gradients = {
  /** Full-bleed brand hero (auth). Ink drifting into warm terracotta shadow. */
  inkHero: ['#16181D', '#221A18', '#3A211A'],
  /** Compact screen header (home, profile). */
  inkHeader: ['#16181D', '#221A18'],
  /** Bottom-up scrim so overlaid text stays legible on any photo. */
  photoScrim: ['transparent', 'rgba(22, 24, 29, 0.72)'],
  /** Top-and-bottom scrim for the report photo preview. */
  photoControls: ['rgba(22, 24, 29, 0.35)', 'transparent', 'rgba(22, 24, 29, 0.50)'],
} as const;

/** Strict 4pt scale. Every margin and padding in the app is one of these. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const fontFamily = {
  display: 'PlusJakartaSans_700Bold',
  displayMedium: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

/**
 * 7-step type scale. Display sizes get negative tracking (they read tighter and
 * more deliberate); small label sizes get positive tracking for legibility.
 */
export const typeScale = {
  display: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  subheading: { fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  caption: { fontSize: 11, lineHeight: 15, letterSpacing: 0.4 },
} satisfies Record<string, TextStyle>;

/**
 * Soft, low-opacity shadows instead of Material elevation — elevation on
 * Android alone renders far heavier than the iOS equivalent, so both are
 * specified together and kept deliberately subtle.
 */
const shadow = (
  opacity: number,
  radiusPx: number,
  offsetY: number,
  elevation: number,
): ViewStyle => ({
  shadowColor: '#2B1B10',
  shadowOpacity: Platform.OS === 'android' ? 0 : opacity,
  shadowRadius: radiusPx,
  shadowOffset: { width: 0, height: offsetY },
  elevation,
});

export const shadows = {
  none: shadow(0, 0, 0, 0),
  sm: shadow(0.06, 8, 2, 1),
  md: shadow(0.09, 16, 6, 3),
  lg: shadow(0.13, 28, 12, 6),
} as const;

/** Shared motion constants so transitions feel like one system. */
export const motion = {
  fast: 140,
  base: 220,
  slow: 360,
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
} as const;

/** Blends a 6-digit hex into an rgba string. Used for tinted wells and fills. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type CategoryName = keyof typeof categoryPalette;
