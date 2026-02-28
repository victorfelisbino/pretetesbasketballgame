import { Platform } from 'react-native';

export const colors = {
  // Brand
  primary: '#ff6b35',
  primaryDark: '#e85a24',
  secondary: '#4ec9b0',

  // Backgrounds
  bgDark: '#1a1a2e',
  bgCard: '#16213e',
  bgInput: '#0f3460',

  // Text
  textLight: '#ffffff',
  textMuted: '#8b9dc3',

  // Semantic
  success: '#4caf50',
  error: '#f44336',
  warning: '#ffc107',
  disabled: 'rgba(139, 157, 195, 0.4)',
  divider: 'rgba(15, 52, 96, 0.6)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// Centralised tier colors — used everywhere (Career, SeasonTimeline, TierBadge)
export const TIER_COLORS = {
  amateur: '#6c757d',
  semi_pro: '#0d6efd',
  professional: '#6f42c1',
  premier: '#ffc107',
};

export const TIER_LABELS = {
  amateur: 'Amateur',
  semi_pro: 'Semi-Pro',
  professional: 'Professional',
  premier: 'Premier',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 5,
  md: 10,
  lg: 15,
  xl: 20,
  pill: 25,
};

export const font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  title: 32,
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};

// Line-height multipliers for consistent vertical rhythm
export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};

// Minimum touch target per Apple HIG / Material guidelines
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
