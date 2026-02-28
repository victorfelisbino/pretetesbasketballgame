import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

const TIER_COLORS = {
  amateur: '#6c757d',
  semi_pro: '#0d6efd',
  professional: '#6f42c1',
  premier: '#ffc107',
};

const TIER_LABELS = {
  amateur: { en: 'Amateur', pt: 'Amador' },
  semi_pro: { en: 'Semi-Pro', pt: 'Semi-Pro' },
  professional: { en: 'Professional', pt: 'Profissional' },
  premier: { en: 'Premier', pt: 'Premier' },
};

export default function TierBadge({ tierId, size = 'md' }) {
  const bgColor = TIER_COLORS[tierId] || colors.bgInput;
  const label = TIER_LABELS[tierId]?.pt || tierId || 'Amateur';
  const isSmall = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: bgColor },
      isSmall && styles.badgeSmall,
    ]}>
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
    fontSize: 9,
  },
});
