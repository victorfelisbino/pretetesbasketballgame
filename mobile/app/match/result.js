import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { colors, spacing, font, radius } from '../../theme';
import { storage } from '../../lib/storage';
import {
  normalizePlayerStatsFromEngine,
  calculatePlayerFantasyPoints,
} from '../../src/core/fantasyScoring';
import {
  processRound,
  processPlayoffMatch,
  checkSeasonPhase,
  saveLeagueToStorage,
} from '../../lib/seasonProgression';

const HISTORY_KEY = 'quadra_legacy_match_history';
const LEAGUE_STORAGE_KEY = 'quadra_legacy_leagues';

function StatRow({ label, home, away }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statValue}>{home}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{away}</Text>
    </View>
  );
}

function PlayerStatLine({ player, fantasyPts }) {
  return (
    <View style={styles.playerRow}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerPos}>{player.position}</Text>
        <Text style={styles.playerStatName} numberOfLines={1}>{player.name}</Text>
      </View>
      <Text style={styles.playerStatLine}>
        {player.points}pts {player.rebounds}reb {player.assists}ast
      </Text>
      <Text style={styles.fpBadge}>{fantasyPts} FP</Text>
    </View>
  );
}

export default function MatchResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState('box');
  const [roundAdvanced, setRoundAdvanced] = useState(null);

  const leagueId = params.leagueId;

  const handleBack = useCallback(() => {
    if (leagueId) {
      router.replace(`/league/${leagueId}`);
    } else {
      router.replace('/(tabs)');
    }
  }, [leagueId, router]);

  const summary = useMemo(() => {
    if (!params.summary) return null;
    try { return JSON.parse(params.summary); } catch { return null; }
  }, [params.summary]);

  const fantasyData = useMemo(() => {
    if (!summary?.homeTeamStats || !summary?.awayTeamStats) return null;
    const calc = (stats) => stats.map(p => {
      const norm = normalizePlayerStatsFromEngine(p);
      const fp = calculatePlayerFantasyPoints(norm);
      return { ...p, fp: fp.totalPoints };
    });
    return {
      home: calc(summary.homeTeamStats),
      away: calc(summary.awayTeamStats),
    };
  }, [summary]);

  // Save match to history + advance league round (once)
  const saved = useRef(false);
  useEffect(() => {
    if (!summary || saved.current) return;
    saved.current = true;
    (async () => {
      // 1. Save to match history
      try {
        const raw = await storage.getItem(HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        history.push({
          id: `mh_${Date.now().toString(36)}`,
          date: new Date().toISOString(),
          homeTeam: summary.homeTeam,
          awayTeam: summary.awayTeam,
          homeScore: summary.homeScore,
          awayScore: summary.awayScore,
          winner: summary.winner,
          homeTeamStats: summary.homeTeamStats,
          awayTeamStats: summary.awayTeamStats,
        });
        // Keep latest 50 matches
        if (history.length > 50) history.splice(0, history.length - 50);
        await storage.setItem(HISTORY_KEY, JSON.stringify(history));
      } catch (e) {
        console.warn('Failed to save match history:', e);
      }

      // 2. Advance league season if this was a league match
      if (leagueId) {
        try {
          const leagueRaw = await storage.getItem(LEAGUE_STORAGE_KEY);
          if (!leagueRaw) return;
          const leagues = JSON.parse(leagueRaw);
          const league = leagues.find(l => l.id === leagueId);
          if (!league) return;

          const playoffMatchId = params.playoffMatchId;
          let updated;

          if (playoffMatchId && league.playoffBracket) {
            // Playoff match — record result in bracket
            updated = processPlayoffMatch(league, playoffMatchId, {
              homeScore: summary.homeScore,
              awayScore: summary.awayScore,
            });
            updated = checkSeasonPhase(updated);
            await saveLeagueToStorage(updated);
            setRoundAdvanced('playoff');
          } else {
            // Regular season match — process round
            const userTeam = league.teams?.find(t => t.isUser);
            const userTeamId = userTeam?.id;
            const matchInSchedule = league.schedule?.find(m =>
              m.status !== 'completed' &&
              ((m.homeTeam === userTeamId || m.awayTeam === userTeamId))
            );
            const roundNumber = matchInSchedule?.round;
            if (roundNumber == null) return;

            // Build user match result
            const homeTeamId = matchInSchedule.homeTeam;
            const awayTeamId = matchInSchedule.awayTeam;
            const isHome = homeTeamId === userTeamId;
            const userMatchResult = {
              homeTeamId,
              awayTeamId,
              homeScore: isHome ? summary.homeScore : summary.awayScore,
              awayScore: isHome ? summary.awayScore : summary.homeScore,
              homeTeamStats: isHome ? summary.homeTeamStats : summary.awayTeamStats,
              awayTeamStats: isHome ? summary.awayTeamStats : summary.homeTeamStats,
            };

            // Process round (sims all other matches) + check phase
            updated = processRound(league, roundNumber, userMatchResult);
            updated = checkSeasonPhase(updated);
            await saveLeagueToStorage(updated);
            setRoundAdvanced(roundNumber);
          }
        } catch (e) {
          console.warn('Failed to advance league round:', e);
        }
      }
    })();
  }, [summary, leagueId, params.playoffMatchId]);

  if (!summary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.noData}>No match data available</Text>
          <Button title="Back to Menu" onPress={handleBack} />
        </View>
      </SafeAreaView>
    );
  }

  const homeStats = summary.homeTeamStats;
  const awayStats = summary.awayTeamStats;
  const sum = (arr, key) => arr.reduce((s, p) => s + (p[key] || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Score card */}
      <View style={styles.scoreCard}>
        <Text style={styles.finalLabel}>FINAL</Text>
        <View style={styles.scoreRow}>
          <View style={styles.teamCol}>
            <Text style={styles.teamName}>{summary.homeTeam}</Text>
            <Text style={[styles.teamScore, summary.homeScore > summary.awayScore && styles.winnerScore]}>
              {summary.homeScore}
            </Text>
          </View>
          <Text style={styles.dash}>-</Text>
          <View style={styles.teamCol}>
            <Text style={styles.teamName}>{summary.awayTeam}</Text>
            <Text style={[styles.teamScore, summary.awayScore > summary.homeScore && styles.winnerScore]}>
              {summary.awayScore}
            </Text>
          </View>
        </View>
        <Text style={styles.winnerText}>
          {summary.winner === 'TIE' ? 'Draw!' : `${summary.winner} wins!`}
        </Text>
      </View>

      {/* Round advancement banner */}
      {roundAdvanced && (
        <View style={styles.roundBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.roundBannerText}>
            {roundAdvanced === 'playoff'
              ? 'Playoff match recorded — bracket updated'
              : `Round ${roundAdvanced} completed — all matches simulated`}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {['box', 'fantasy'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'box' ? 'Box Score' : 'Fantasy'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'box' ? (
          <>
            {/* Team comparison */}
            <View style={styles.comparisonCard}>
              <StatRow label="Points" home={sum(homeStats, 'points')} away={sum(awayStats, 'points')} />
              <StatRow label="Rebounds" home={sum(homeStats, 'rebounds')} away={sum(awayStats, 'rebounds')} />
              <StatRow label="Assists" home={sum(homeStats, 'assists')} away={sum(awayStats, 'assists')} />
              <StatRow label="Steals" home={sum(homeStats, 'steals')} away={sum(awayStats, 'steals')} />
              <StatRow label="Blocks" home={sum(homeStats, 'blocks')} away={sum(awayStats, 'blocks')} />
              <StatRow label="Turnovers" home={sum(homeStats, 'turnovers')} away={sum(awayStats, 'turnovers')} />
              <StatRow label="FG Made" home={sum(homeStats, 'fieldGoalsMade')} away={sum(awayStats, 'fieldGoalsMade')} />
              <StatRow label="FT Made" home={sum(homeStats, 'freeThrowsMade')} away={sum(awayStats, 'freeThrowsMade')} />
            </View>

            {/* Individual stats */}
            <Text style={styles.sectionTitle}>{summary.homeTeam}</Text>
            {homeStats.map((p, i) => (
              <PlayerStatLine key={i} player={p} fantasyPts={fantasyData?.home[i]?.fp ?? 0} />
            ))}

            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{summary.awayTeam}</Text>
            {awayStats.map((p, i) => (
              <PlayerStatLine key={i} player={p} fantasyPts={fantasyData?.away[i]?.fp ?? 0} />
            ))}
          </>
        ) : (
          <>
            {/* Fantasy leaderboard */}
            <Text style={styles.sectionTitle}>Fantasy Points</Text>
            {fantasyData && [...fantasyData.home, ...fantasyData.away]
              .sort((a, b) => b.fp - a.fp)
              .map((p, i) => (
                <View key={i} style={styles.fantasyRow}>
                  <Text style={styles.fantasyRank}>#{i + 1}</Text>
                  <View style={styles.fantasyInfo}>
                    <Text style={styles.fantasyName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.fantasyStats}>
                      {p.points}pts / {p.rebounds}reb / {p.assists}ast
                    </Text>
                  </View>
                  <Text style={styles.fantasyPts}>{p.fp} FP</Text>
                </View>
              ))
            }
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={leagueId ? 'Back to League' : 'Back to Menu'} onPress={handleBack} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  noData: { color: colors.textMuted, fontSize: font.md },
  scoreCard: {
    backgroundColor: colors.bgCard, padding: spacing.lg,
    alignItems: 'center', borderBottomWidth: 2, borderBottomColor: colors.primary,
  },
  finalLabel: { fontSize: font.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  teamCol: { alignItems: 'center' },
  teamName: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.xs },
  teamScore: { fontSize: font.title, fontWeight: '800', color: colors.textLight },
  winnerScore: { color: colors.primary },
  dash: { fontSize: font.xxl, fontWeight: '800', color: colors.textMuted },
  winnerText: { fontSize: font.md, fontWeight: '600', color: colors.success, marginTop: spacing.sm },
  roundBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.sm,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
  },
  roundBannerText: { fontSize: font.sm, fontWeight: '600', color: colors.success },
  tabRow: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  comparisonCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  statRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  statLabel: { fontSize: font.sm, color: colors.textMuted, flex: 1, textAlign: 'center' },
  statValue: { fontSize: font.md, fontWeight: '700', color: colors.textLight, width: 50, textAlign: 'center' },
  sectionTitle: {
    fontSize: font.lg, fontWeight: '700', color: colors.textLight, marginBottom: spacing.sm,
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.sm,
    padding: spacing.sm, marginBottom: spacing.xs,
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, width: 110 },
  playerPos: { fontSize: font.xs, fontWeight: '700', color: colors.primary, width: 24 },
  playerStatName: { fontSize: font.sm, color: colors.textLight, flex: 1 },
  playerStatLine: { flex: 1, fontSize: font.xs, color: colors.textMuted },
  fpBadge: {
    fontSize: font.sm, fontWeight: '700', color: colors.secondary,
    backgroundColor: colors.bgInput, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2, overflow: 'hidden',
  },
  fantasyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.xs,
  },
  fantasyRank: { fontSize: font.md, fontWeight: '700', color: colors.primary, width: 32 },
  fantasyInfo: { flex: 1 },
  fantasyName: { fontSize: font.md, fontWeight: '600', color: colors.textLight },
  fantasyStats: { fontSize: font.xs, color: colors.textMuted },
  fantasyPts: { fontSize: font.lg, fontWeight: '800', color: colors.secondary },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.bgCard },
});
