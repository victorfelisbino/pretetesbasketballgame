import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { colors, spacing, font, radius } from '../../theme';
import { GameController } from '../../src/gameController';

const NARRATION_COLORS = {
  score: colors.success,
  miss: colors.error,
  steal: colors.warning,
  fastbreak: colors.secondary,
  default: colors.textMuted,
};

export default function MatchPlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [state, setState] = useState(null);
  const [narration, setNarration] = useState([]);
  const [summary, setSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const gcRef = useRef(null);
  const narrationRef = useRef(null);

  // Parse teams from params
  const homeTeam = useRef(null);
  const awayTeam = useRef(null);
  if (!homeTeam.current && params.homeTeam) {
    try { homeTeam.current = JSON.parse(params.homeTeam); } catch (e) { /* noop */ }
  }
  if (!awayTeam.current && params.awayTeam) {
    try { awayTeam.current = JSON.parse(params.awayTeam); } catch (e) { /* noop */ }
  }

  const startMatch = useCallback(async () => {
    if (!homeTeam.current || !awayTeam.current) return;

    const gc = new GameController(homeTeam.current, awayTeam.current, {
      speed: 30,
      language: 'pt',
      homeTactics: {
        playStyle: params.playStyle || 'HALF_COURT',
        defensiveScheme: params.defScheme || 'MAN_TO_MAN',
      },
    });
    gcRef.current = gc;

    gc.subscribe(({ event, state: s, data }) => {
      setState({ ...s });

      if (event === 'narration' && data.entry) {
        setNarration(prev => [...prev, data.entry]);
      }
      if (event === 'match_end') {
        setSummary(data);
        setRunning(false);
      }
    });

    setRunning(true);
    setNarration([]);
    setSummary(null);

    await gc.runFullMatch();
  }, [params.playStyle, params.defScheme]);

  useEffect(() => {
    startMatch();
  }, [startMatch]);

  const handleFinish = useCallback(() => {
    router.push({
      pathname: '/match/result',
      params: { summary: JSON.stringify(summary) },
    });
  }, [summary, router]);

  const homeName = homeTeam.current?.name || 'Home';
  const awayName = awayTeam.current?.name || 'Away';

  return (
    <SafeAreaView style={styles.container}>
      {/* Scoreboard */}
      <View style={styles.scoreboard}>
        <View style={styles.teamCol}>
          <Text style={styles.teamLabel}>{homeName}</Text>
          <Text style={styles.teamScore}>{state?.homeScore ?? 0}</Text>
        </View>
        <View style={styles.midCol}>
          <Text style={styles.quarterText}>
            {summary ? 'FINAL' : state ? `Q${state.quarter}` : '—'}
          </Text>
          <Text style={styles.roundText}>
            {summary ? '' : state ? `R${state.round}/100` : ''}
          </Text>
        </View>
        <View style={styles.teamCol}>
          <Text style={styles.teamLabel}>{awayName}</Text>
          <Text style={styles.teamScore}>{state?.awayScore ?? 0}</Text>
        </View>
      </View>

      {/* Possession indicator */}
      {state && !summary && (
        <View style={styles.possessionBar}>
          <View style={[
            styles.possessionDot,
            state.possession === 'home' && styles.possessionActive,
          ]} />
          <Text style={styles.possessionText}>Posse de bola</Text>
          <View style={[
            styles.possessionDot,
            state.possession === 'away' && styles.possessionActive,
          ]} />
        </View>
      )}

      {/* Narration log */}
      <FlatList
        ref={narrationRef}
        data={narration}
        keyExtractor={(_, i) => String(i)}
        style={styles.narrationList}
        contentContainerStyle={styles.narrationContent}
        onContentSizeChange={() => {
          narrationRef.current?.scrollToEnd({ animated: true });
        }}
        renderItem={({ item }) => (
          <Text style={[styles.narrationLine, { color: NARRATION_COLORS[item.type] || colors.textMuted }]}>
            {item.text}
          </Text>
        )}
        ListEmptyComponent={
          <View style={styles.emptyNarration}>
            <Text style={styles.emptyText}>
              {running ? 'Starting match...' : 'Preparing...'}
            </Text>
          </View>
        }
      />

      {/* Footer */}
      {summary && (
        <View style={styles.footer}>
          <Button title="See Results →" onPress={handleFinish} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  scoreboard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgCard, padding: spacing.lg,
    borderBottomWidth: 2, borderBottomColor: colors.primary,
  },
  teamCol: { alignItems: 'center', flex: 1 },
  teamLabel: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  teamScore: { fontSize: font.title, fontWeight: '800', color: colors.textLight },
  midCol: { alignItems: 'center', paddingHorizontal: spacing.md },
  quarterText: { fontSize: font.lg, fontWeight: '700', color: colors.primary },
  roundText: { fontSize: font.xs, color: colors.textMuted },
  possessionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  possessionDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.bgInput,
  },
  possessionActive: { backgroundColor: colors.primary },
  possessionText: { fontSize: font.xs, color: colors.textMuted },
  narrationList: { flex: 1 },
  narrationContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  narrationLine: { fontSize: font.sm, marginBottom: spacing.xs, lineHeight: 20 },
  emptyNarration: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl },
  emptyText: { color: colors.textMuted, fontSize: font.md },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.bgCard },
});
