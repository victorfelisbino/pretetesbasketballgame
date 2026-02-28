import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

const SIZE_CONFIG = {
  sm: { minHeight: 36, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: font.sm },
  md: { minHeight: 48, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, fontSize: font.lg },
  lg: { minHeight: 56, paddingVertical: spacing.md + 4, paddingHorizontal: spacing.xl, fontSize: font.xl },
};

export default function Button({
  title, onPress, variant = 'primary', size = 'md',
  disabled, loading, style,
}) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const sz = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.base,
        { minHeight: sz.minHeight, paddingVertical: sz.paddingVertical, paddingHorizontal: sz.paddingHorizontal },
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
          { fontSize: sz.fontSize },
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
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
    opacity: 0.45,
  },
  text: {
    fontWeight: '700',
  },
  primaryText: {
    color: colors.textLight,
  },
  secondaryText: {
    color: colors.textLight,
  },
  outlineText: {
    color: colors.primary,
  },
});
