import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { colors, spacing, font, radius } from '../../theme';
import { PLAY_STYLES, DEFENSIVE_SCHEMES } from '../../src/core/tacticsEngine';

const playStyleKeys = Object.keys(PLAY_STYLES);
const defenseSchemeKeys = Object.keys(DEFENSIVE_SCHEMES);

function OptionCard({ item, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionHeader}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
          {item.label}
        </Text>
        {selected && <Text style={styles.selectedDot}>●</Text>}
      </View>
      <Text style={styles.optionDesc}>{item.description}</Text>
    </TouchableOpacity>
  );
}

export default function TacticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [playStyle, setPlayStyle] = useState('HALF_COURT');
  const [defScheme, setDefScheme] = useState('MAN_TO_MAN');

  const handleStart = useCallback(() => {
    router.push({
      pathname: '/match/play',
      params: {
        homeTeam: params.homeTeam,
        awayTeam: params.awayTeam,
        playStyle,
        defScheme,
      },
    });
  }, [params, playStyle, defScheme, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="← Back" onPress={() => router.back()} variant="outline" />
        <Text style={styles.title}>Tactics</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Offensive Play Style</Text>
        {playStyleKeys.map(key => (
          <OptionCard
            key={key}
            item={PLAY_STYLES[key]}
            selected={playStyle === key}
            onPress={() => setPlayStyle(key)}
          />
        ))}

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Defensive Scheme
        </Text>
        {defenseSchemeKeys.map(key => (
          <OptionCard
            key={key}
            item={DEFENSIVE_SCHEMES[key]}
            selected={defScheme === key}
            onPress={() => setDefScheme(key)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Start Match →" onPress={handleStart} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, padding: spacing.lg,
  },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: {
    fontSize: font.lg, fontWeight: '700', color: colors.textLight,
    marginBottom: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 2, borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.primary, backgroundColor: colors.bgInput,
  },
  optionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  optionLabel: { fontSize: font.md, fontWeight: '700', color: colors.textLight },
  optionLabelSelected: { color: colors.primary },
  selectedDot: { color: colors.primary, fontSize: font.md },
  optionDesc: { fontSize: font.sm, color: colors.textMuted, lineHeight: 18 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.bgCard },
});
