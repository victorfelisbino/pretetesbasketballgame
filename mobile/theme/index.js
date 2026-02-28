import { Platform } from 'react-native';

export const colors = {
  primary: '#ff6b35',
  primaryDark: '#e85a24',
  secondary: '#4ec9b0',
  bgDark: '#1a1a2e',
  bgCard: '#16213e',
  bgInput: '#0f3460',
  textLight: '#ffffff',
  textMuted: '#8b9dc3',
  success: '#4caf50',
  error: '#f44336',
  warning: '#ffc107',
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
  body: Platform.select({ ios: 'System', default: 'Roboto' }),
};
