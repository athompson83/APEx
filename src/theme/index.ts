/**
 * APEx360 Design System — Theme barrel
 *
 * Import everything from here:
 *   import { theme, colors, spacing, textStyles } from '@/theme';
 */

export { colors } from './colors';
export type { ColorKey } from './colors';

export {
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  textStyles,
  lineHeight,
} from './typography';
export type { FontSizeKey, FontWeightKey, LineHeightKey, TextStyleKey } from './typography';

export {
  spacing,
  borderRadius,
  borderWidth,
  shadows,
  iconSizes,
  hitSlop,
  layout,
} from './spacing';
export type { SpacingKey, BorderRadiusKey, IconSizeKey } from './spacing';

// ---------------------------------------------------------------------------
// Unified theme object — convenience for consumers that prefer dot-access
// ---------------------------------------------------------------------------
import { colors } from './colors';
import {
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  textStyles,
} from './typography';
import {
  spacing,
  borderRadius,
  borderWidth,
  shadows,
  iconSizes,
  hitSlop,
  layout,
} from './spacing';

export const theme = {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacings,
  textStyles,
  spacing,
  borderRadius,
  borderWidth,
  shadows,
  iconSizes,
  hitSlop,
  layout,
} as const;

export type Theme = typeof theme;
