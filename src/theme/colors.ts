export const colors = {
  // Primary brand — deep navy conveys authority and trust for EMS contexts
  primary: '#1B3A6B',
  primaryLight: '#2C5282',
  primaryDark: '#0F2444',

  // Accent — EMS orange for calls-to-action and highlights
  accent: '#E8621A',
  accentLight: '#F97316',

  // Status colors
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  info: '#2563EB',
  infoLight: '#DBEAFE',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Eval score colors — may be overridden by Bubble score settings per form
  scoreDefault: '#94A3B8',

  // Surfaces
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E8F0',
  borderFocus: '#1B3A6B',

  // Workflow step status colors
  stepPending: '#94A3B8',
  stepActive: '#2563EB',
  stepComplete: '#16A34A',
  stepDisputed: '#DC2626',
} as const;

export type ColorKey = keyof typeof colors;
