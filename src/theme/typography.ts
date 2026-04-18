import { StyleSheet, TextStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Font size scale
// ---------------------------------------------------------------------------
export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 19,
  '2xl': 22,
  '3xl': 26,
  '4xl': 32,
} as const;

export type FontSizeKey = keyof typeof fontSizes;

// ---------------------------------------------------------------------------
// Font weights (RN uses string literals)
// ---------------------------------------------------------------------------
export const fontWeights = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],
} as const;

export type FontWeightKey = keyof typeof fontWeights;

// ---------------------------------------------------------------------------
// Line height scale (multiplier × font size approach — absolute values for RN)
// ---------------------------------------------------------------------------
export const lineHeights = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.65,
  loose: 2.0,
} as const;

export type LineHeightKey = keyof typeof lineHeights;

/**
 * Derive a pixel line height from a font size and a named multiplier.
 * React Native requires numeric line heights.
 */
export function lineHeight(
  size: number,
  multiplier: keyof typeof lineHeights = 'normal',
): number {
  return Math.round(size * lineHeights[multiplier]);
}

// ---------------------------------------------------------------------------
// Letter spacing
// ---------------------------------------------------------------------------
export const letterSpacings = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
  widest: 1.0,
} as const;

// ---------------------------------------------------------------------------
// Pre-built text style objects
// These are used throughout the app via StyleSheet.create or inline.
// ---------------------------------------------------------------------------

export const textStyles = StyleSheet.create({
  // ---- Headings -----------------------------------------------------------
  heading1: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeight(fontSizes['3xl'], 'tight'),
    letterSpacing: letterSpacings.tight,
  },
  heading2: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeight(fontSizes['2xl'], 'snug'),
    letterSpacing: letterSpacings.tight,
  },
  heading3: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeight(fontSizes.xl, 'snug'),
    letterSpacing: letterSpacings.normal,
  },
  heading4: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeight(fontSizes.lg, 'snug'),
    letterSpacing: letterSpacings.normal,
  },

  // ---- Body text ----------------------------------------------------------
  body: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeight(fontSizes.md, 'normal'),
    letterSpacing: letterSpacings.normal,
  },
  bodyMedium: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeight(fontSizes.md, 'normal'),
    letterSpacing: letterSpacings.normal,
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeight(fontSizes.sm, 'normal'),
    letterSpacing: letterSpacings.normal,
  },
  bodySmallMedium: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeight(fontSizes.sm, 'normal'),
    letterSpacing: letterSpacings.normal,
  },

  // ---- Caption / label ----------------------------------------------------
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeight(fontSizes.xs, 'normal'),
    letterSpacing: letterSpacings.wide,
  },
  captionMedium: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeight(fontSizes.xs, 'normal'),
    letterSpacing: letterSpacings.wide,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeight(fontSizes.sm, 'snug'),
    letterSpacing: letterSpacings.wide,
  },
  labelSmall: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeight(fontSizes.xs, 'snug'),
    letterSpacing: letterSpacings.wider,
  },

  // ---- Buttons ------------------------------------------------------------
  buttonLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeight(fontSizes.lg, 'tight'),
    letterSpacing: letterSpacings.wide,
  },
  button: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeight(fontSizes.md, 'tight'),
    letterSpacing: letterSpacings.wide,
  },
  buttonSmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeight(fontSizes.sm, 'tight'),
    letterSpacing: letterSpacings.wide,
  },

  // ---- Miscellaneous ------------------------------------------------------
  overline: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeight(fontSizes.xs, 'normal'),
    letterSpacing: letterSpacings.widest,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeight(fontSizes.sm, 'relaxed'),
    letterSpacing: letterSpacings.normal,
    fontFamily: 'monospace' as TextStyle['fontFamily'],
  },
});

export type TextStyleKey = keyof typeof textStyles;
