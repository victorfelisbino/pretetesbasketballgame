import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

export default function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isOutline && styles.outline,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.textLight : colors.primary} />
      ) : (
        <Text style={[
          styles.text,
          isPrimary && styles.primaryText,
          isSecondary && styles.secondaryText,
          isOutline && styles.outlineText,
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.bgInput,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: font.lg,
    fontWeight: '700',
  },
  primaryText: {
    color: colors.textLight,
  },
  secondaryText: {
    color: colors.textMuted,
  },
  outlineText: {
    color: colors.primary,
  },
});
