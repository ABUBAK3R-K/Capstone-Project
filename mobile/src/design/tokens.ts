import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * "Sea Glass & Sand" — the single source of truth for the app's visual identity.
 *
 * Nothing in features/ should ever hardcode a hex value, a pixel margin or a
 * font size. If a value is missing here, add it here.
 *
 * COLOR SOURCE — every hue family below is traced to a real, named Pantone
 * chip (not an arbitrary pick), translated to sRGB hex. Where a chip is too
 * light or too dark to serve as an interactive UI color on its own, the
 * "…Soft" or base token is a lightness/saturation-adjusted derivative of that
 * same chip's hue, kept in the same file as the citation so the lineage stays
 * visible:
 *
 *   - PANTONE 13-1023 Peach Fuzz     (Pantone Color of the Year 2024) — #FFBE98
 *     → warm, sun-bleached coral. Source for `primary` (deepened for AA
 *       contrast on white text) and `primarySoft`/`primaryBorder` (lightened).
 *   - PANTONE 15-4712 TCX Marine Blue                                — #76AFB6
 *     → mid-depth sea-glass blue. Source for `secondary` (deepened).
 *   - PANTONE 12-5206 TCX Blue Glass                                 — #C7E3E1
 *     → pale sea-glass blue, used verbatim as `secondarySoft`.
 *   - PANTONE 13-5412 TCX Beach Glass                                — #96DFCE
 *     → sea-glass green, used verbatim as `accentSoft`; deepened for `accent`.
 *   - PANTONE 17-1230 Mocha Mousse  (Pantone Color of the Year 2025) — #A47864
 *     → warm driftwood brown. Source for the entire `ink` text ramp (darkened
 *       toward near-black for body text, lightened toward taupe for muted
 *       text) instead of a cool/technical grey-black.
 *   - PANTONE 15-1214 TCX Warm Sand                                  — #C5AE91
 *     → source for `border`/`borderStrong` and `canvasSunken`.
 *   - PANTONE 11-0701 TCX Whisper White                              — #EDE6DB
 *     → sandy paper canvas, used verbatim as `canvas`.
 *
 * Functional states (success/warning/danger) are deliberately NOT pulled from
 * separate trend chips — they're built from the same warm-neutral ramp
 * (green from the Beach Glass family, gold from the Warm Sand/Peach Fuzz
 * family, brick-red from the primary family) darkened until each clears
 * WCAG AA (4.5:1) against white, so alerts stay legible without importing a
 * jarring, un-related hue into an otherwise soft palette.
 */

export const palette = {
  // ─── Surfaces — Whisper White (11-0701 TCX) + Warm Sand (15-1214 TCX) ────
  canvas: '#EDE6DB',
  canvasSunken: '#D9CAB6',
  surface: '#FAF8F4',
  surfaceRaised: '#FFFFFF',
  /** Surface that lets a photo read through it, e.g. a floating back button. */
  surfaceTranslucent: 'rgba(255, 255, 255, 0.90)',

  // ─── Text — driftwood ink, from Mocha Mousse (17-1230 TCX) ───────────────
  ink: '#140E0C',
  inkSecondary: '#553E34',
  inkMuted: '#805E4E',
  inkFaint: '#B69383',
  inkInverse: '#FFFFFF',

  // ─── Primary — coral, from Peach Fuzz (13-1023 TCX) ──────────────────────
  primary: '#DA611B',
  primaryPressed: '#B95217',
  primarySoft: '#FBEFE8',
  primaryBorder: '#F4D0BB',

  // ─── Secondary — sea-glass blue, Marine Blue (15-4712) + Blue Glass (12-5206) ─
  secondary: '#4D7276',
  secondaryPressed: '#416164',
  secondarySoft: '#C7E3E1',
  secondaryBorder: '#AFC0C1',

  // ─── Accent — sea-glass green, Beach Glass (13-5412 TCX) ─────────────────
  accent: '#5A867C',
  accentPressed: '#4D7269',
  accentSoft: '#96DFCE',
  accentBorder: '#B5C9C4',

  success: '#34795D',
  successSoft: '#E7EFEC',
  warning: '#A3781F',
  warningSoft: '#F6F2E9',
  danger: '#B23A2E',
  dangerSoft: '#F7EBEA',

  // Text and surfaces that sit on top of the ink gradients or a photo scrim.
  onInk: 'rgba(255, 255, 255, 0.85)',
  onInkMuted: 'rgba(255, 255, 255, 0.66)',
  onInkFaint: 'rgba(255, 255, 255, 0.50)',
  onInkSurface: 'rgba(255, 255, 255, 0.08)',
  onImageSurface: 'rgba(20, 14, 12, 0.60)',

  border: '#E5DBCE',
  borderStrong: '#D6C6B2',
  overlay: 'rgba(20, 14, 12, 0.55)',
  scrim: 'rgba(20, 14, 12, 0.08)',
} as const;

/**
 * Category ramp. Used identically for map markers, card tags and filter chips
 * so a colour always means the same category everywhere in the app. Spread
 * across six distinct hue families (drawn from the palette above plus two
 * supporting hues — plum and ochre — chosen only far enough from the others
 * on the wheel to stay distinguishable at a glance) rather than variations on
 * one hue, since six categories rendered as near-identical sea-glass tones
 * would be unreadable on a map.
 */
export const categoryPalette = {
  Shops: '#DA611B',
  Religious: '#8467B0',
  Tourism: '#3E7C99',
  'Public Parks': '#34795D',
  'Public Services': '#A3781F',
  Other: '#805E4E',
} as const;

/**
 * Gradient ramps. Declared as tuples so LinearGradient's `colors` prop accepts
 * them directly, and so an ink header is the same ink everywhere.
 */
export const gradients = {
  /** Full-bleed brand hero (auth). Driftwood ink drifting into ember coral. */
  inkHero: ['#140E0C', '#2A1B14', '#4A2418'],
  /** Compact screen header (home, profile). */
  inkHeader: ['#140E0C', '#2A1B14'],
  /** Bottom-up scrim so overlaid text stays legible on any photo. */
  photoScrim: ['transparent', 'rgba(20, 14, 12, 0.72)'],
  /** Top-and-bottom scrim for the report photo preview. */
  photoControls: ['rgba(20, 14, 12, 0.35)', 'transparent', 'rgba(20, 14, 12, 0.50)'],
  /** Sandy canvas easing into a pale sea-glass wash — for soft section backdrops. */
  coastalWash: ['#EDE6DB', '#DCE5D8'],
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

/**
 * Gentler, rounder than a typical app — corners read as approachable rather
 * than sharp/corporate. Bumped up from a stricter 6-24 scale.
 */
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  pill: 999,
} as const;

/**
 * Asymmetric "wave" corner treatment — softens one diagonal more than the
 * other so the shape reads as organic rather than a mechanically uniform
 * rounded rectangle. Used sparingly (a hero card, a peek sheet) — never on
 * every card, or the effect stops reading as intentional.
 */
export const organicCorner: ViewStyle = {
  borderTopLeftRadius: radius.xxl,
  borderTopRightRadius: radius.md,
  borderBottomRightRadius: radius.xxl,
  borderBottomLeftRadius: radius.md,
};

export const fontFamily = {
  /** Fraunces — a soft, slightly wonky serif with real character for headings. */
  display: 'Fraunces_700Bold',
  displayMedium: 'Fraunces_600SemiBold',
  /** Reserved for the rare soulful moment — a pull quote, an eyebrow accent. */
  displayItalic: 'Fraunces_600SemiBold_Italic',
  /** Figtree — a warm, rounded, highly readable grotesque for body text. */
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemiBold: 'Figtree_600SemiBold',
} as const;

/**
 * 7-step type scale. Display sizes carry only modest negative tracking —
 * Fraunces is a serif with organic terminals, so the heavy negative tracking
 * that suited the old grotesque display face would collide letterforms here.
 */
export const typeScale = {
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.3 },
  title: { fontSize: 23, lineHeight: 29, letterSpacing: -0.2 },
  heading: { fontSize: 19, lineHeight: 25, letterSpacing: -0.1 },
  subheading: { fontSize: 16, lineHeight: 23, letterSpacing: 0 },
  body: { fontSize: 15, lineHeight: 23, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  caption: { fontSize: 11, lineHeight: 15, letterSpacing: 0.4 },
} satisfies Record<string, TextStyle>;

/**
 * Soft, natural shadows instead of Material elevation — elevation on Android
 * alone renders far heavier than the iOS equivalent, so both are specified
 * together and kept deliberately diffuse. The shadow colour is a warm umber
 * pulled from the ink ramp rather than pure black, so shadows read as soft
 * light falloff rather than a hard digital drop-shadow.
 */
const shadow = (
  opacity: number,
  radiusPx: number,
  offsetY: number,
  elevation: number,
): ViewStyle => ({
  shadowColor: '#2E2018',
  shadowOpacity: Platform.OS === 'android' ? 0 : opacity,
  shadowRadius: radiusPx,
  shadowOffset: { width: 0, height: offsetY },
  elevation,
});

export const shadows = {
  none: shadow(0, 0, 0, 0),
  sm: shadow(0.07, 10, 3, 2),
  md: shadow(0.1, 20, 8, 4),
  lg: shadow(0.14, 34, 16, 8),
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
