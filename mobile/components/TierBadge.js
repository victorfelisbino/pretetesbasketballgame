import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font, TIER_COLORS, TIER_LABELS } from '../theme';

export default function TierBadge({ tierId, size = 'md' }) {
  const bgColor = TIER_COLORS[tierId] || colors.bgInput;
  const label = TIER_LABELS[tierId] || tierId || 'Amateur';
  const isSmall = size === 'sm';

  return (
    <View
      style={[styles.badge, { backgroundColor: bgColor }, isSmall && styles.badgeSmall]}
      accessibilityLabel={`Tier: ${label}`}
    >
      <Text style={[styles.text, isSmall && styles.textSmall]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textLight,
  },
  textSmall: {
    fontSize: font.xs,
  },
});
