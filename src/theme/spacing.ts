import { Platform, ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Spacing scale
// ---------------------------------------------------------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export type SpacingKey = keyof typeof spacing;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------
export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export type BorderRadiusKey = keyof typeof borderRadius;

// ---------------------------------------------------------------------------
// Border widths
// ---------------------------------------------------------------------------
export const borderWidth = {
  hairline: StyleSheet_hairlineWidth(),
  thin: 1,
  medium: 2,
  thick: 3,
} as const;

/** Returns the native hairline width for the current platform. */
function StyleSheet_hairlineWidth(): number {
  // Matches React Native's StyleSheet.hairlineWidth
  return Platform.OS === 'android' ? 1 : 0.5;
}

// ---------------------------------------------------------------------------
// Shadows  (platform-aware)
// Elevation 1–4 scale, matching Material Design / iOS depth cues.
// ---------------------------------------------------------------------------
export interface ShadowStyle {
  // iOS
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  // Android
  elevation?: number;
}

export const shadows: Record<1 | 2 | 3 | 4, ShadowStyle> = {
  1: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  }) as ShadowStyle,

  2: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
    default: {},
  }) as ShadowStyle,

  3: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
    },
    android: { elevation: 6 },
    default: {},
  }) as ShadowStyle,

  4: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
    default: {},
  }) as ShadowStyle,
};

// ---------------------------------------------------------------------------
// Icon sizes
// ---------------------------------------------------------------------------
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export type IconSizeKey = keyof typeof iconSizes;

// ---------------------------------------------------------------------------
// Hit slop — minimum touchable area helpers (Apple HIG: 44×44 pt)
// ---------------------------------------------------------------------------
export const hitSlop = {
  small: { top: 8, right: 8, bottom: 8, left: 8 },
  medium: { top: 12, right: 12, bottom: 12, left: 12 },
  large: { top: 16, right: 16, bottom: 16, left: 16 },
} as const;

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
export const layout = {
  /** Full-width content padding */
  screenPaddingH: spacing.md,
  /** Consistent vertical padding between sections */
  screenPaddingV: spacing.lg,
  /** Card internal padding */
  cardPadding: spacing.md,
  /** Bottom tab bar safe area reserve */
  tabBarHeight: 56,
  /** Header height (excluding status bar) */
  headerHeight: 56,
  /** Max content width for tablet-safe layouts */
  maxContentWidth: 600,
} as const;

// Re-export ViewStyle so consumers have one import
export type { ViewStyle };
