import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font, radius } from '../../theme';
import { storage } from '../../lib/storage';

const HISTORY_KEY = 'quadra_legacy_match_history';

const STAT_CATEGORIES = [
  { key: 'points', label: 'Points', short: 'PTS' },
  { key: 'rebounds', label: 'Rebounds', short: 'REB' },
  { key: 'assists', label: 'Assists', short: 'AST' },
  { key: 'steals', label: 'Steals', short: 'STL' },
  { key: 'blocks', label: 'Blocks', short: 'BLK' },
];

function MatchHistoryCard({ match }) {
  const date = new Date(match.date);
  const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
  const isHomeWin = match.homeScore > match.awayScore;
  const isTie = match.homeScore === match.awayScore;

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchDate}>
        <Text style={styles.matchDateText}>{dateStr}</Text>
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.matchTeamRow}>
          <Text style={[
            styles.matchTeamName,
            isHomeWin && styles.matchWinnerName,
          ]} numberOfLines={1}>
            {match.homeTeam}
          </Text>
          <Text style={[
            styles.matchTeamScore,
            isHomeWin && styles.matchWinnerScore,
          ]}>
            {match.homeScore}
          </Text>
        </View>
        <View style={styles.matchTeamRow}>
          <Text style={[
            styles.matchTeamName,
            !isHomeWin && !isTie && styles.matchWinnerName,
          ]} numberOfLines={1}>
            {match.awayTeam}
          </Text>
          <Text style={[
            styles.matchTeamScore,
            !isHomeWin && !isTie && styles.matchWinnerScore,
          ]}>
            {match.awayScore}
          </Text>
        </View>
      </View>
    </View>
  );
}

function LeaderRow({ rank, player, statValue, statLabel }) {
  return (
    <View style={styles.leaderRow}>
      <Text style={styles.leaderRank}>#{rank}</Text>
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderName} numberOfLines={1}>{player.name}</Text>
        <Text style={styles.leaderPos}>{player.position}</Text>
      </View>
      <View style={styles.leaderStatCol}>
        <Text style={styles.leaderStatValue}>{statValue}</Text>
        <Text style={styles.leaderStatLabel}>{statLabel}</Text>
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const [statCategory, setStatCategory] = useState('points');

  const loadHistory = useCallback(async () => {
    try {
      const raw = await storage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
      else setHistory([]);
    } catch (e) {
      console.warn('Failed to load match history:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const leaders = useMemo(() => {
    if (history.length === 0) return {};
    const playerMap = {};

    for (const match of history) {
      const allPlayers = [
        ...(match.homeTeamStats || []),
        ...(match.awayTeamStats || []),
      ];
      for (const p of allPlayers) {
        if (!p.name) continue;
        const key = p.name;
        if (!playerMap[key]) {
          playerMap[key] = {
            name: p.name,
            position: p.position || '?',
            games: 0,
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
          };
        }
        playerMap[key].games += 1;
        playerMap[key].points += p.points || 0;
        playerMap[key].rebounds += p.rebounds || 0;
        playerMap[key].assists += p.assists || 0;
        playerMap[key].steals += p.steals || 0;
        playerMap[key].blocks += p.blocks || 0;
      }
    }

    const players = Object.values(playerMap);
    const result = {};
    for (const cat of STAT_CATEGORIES) {
      result[cat.key] = [...players]
        .sort((a, b) => b[cat.key] - a[cat.key])
        .slice(0, 10);
    }
    return result;
  }, [history]);

  const overallStats = useMemo(() => {
    if (history.length === 0) return null;
    let totalPoints = 0;
    let highScore = 0;
    for (const match of history) {
      const combined = match.homeScore + match.awayScore;
      totalPoints += combined;
      highScore = Math.max(highScore, match.homeScore, match.awayScore);
    }
    return {
      matches: history.length,
      avgPoints: Math.round(totalPoints / history.length),
      highScore,
    };
  }, [history]);

  const hasData = history.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !hasData ? (
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No match history yet</Text>
          <Text style={styles.emptyHint}>
            Play matches to start tracking stats
          </Text>
        </View>
      ) : (
        <>
          {/* Summary bar */}
          {overallStats && (
            <View style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{overallStats.matches}</Text>
                <Text style={styles.summaryLabel}>Matches</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{overallStats.avgPoints}</Text>
                <Text style={styles.summaryLabel}>Avg Total</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{overallStats.highScore}</Text>
                <Text style={styles.summaryLabel}>High Score</Text>
              </View>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabRow}>
            {['history', 'leaders'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'history' ? 'Match History' : 'Leaders'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'history' ? (
            <FlatList
              data={[...history].reverse()}
              keyExtractor={item => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              onRefresh={loadHistory}
              refreshing={loading}
              renderItem={({ item }) => <MatchHistoryCard match={item} />}
            />
          ) : (
            <>
              {/* Category picker */}
              <View style={styles.categoryRow}>
                {STAT_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.categoryChip, statCategory === cat.key && styles.categoryChipActive]}
                    onPress={() => setStatCategory(cat.key)}
                  >
                    <Text style={[styles.categoryText, statCategory === cat.key && styles.categoryTextActive]}>
                      {cat.short}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FlatList
                data={leaders[statCategory] || []}
                keyExtractor={(item, i) => `${item.name}_${i}`}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item, index }) => (
                  <LeaderRow
                    rank={index + 1}
                    player={item}
                    statValue={item[statCategory]}
                    statLabel={STAT_CATEGORIES.find(c => c.key === statCategory)?.short || ''}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.emptyLeaders}>
                    <Text style={styles.emptyHint}>No player data available</Text>
                  </View>
                }
              />
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  title: { fontSize: font.xxl, fontWeight: '800', color: colors.primary },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: font.lg, fontWeight: '600', color: colors.textLight, marginTop: spacing.md,
  },
  emptyHint: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center' },
  summaryBar: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.bgInput,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: font.xl, fontWeight: '800', color: colors.textLight },
  summaryLabel: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  tabRow: { flexDirection: 'row', backgroundColor: colors.bgCard },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  list: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  matchCard: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.md, overflow: 'hidden',
  },
  matchDate: {
    width: 48, backgroundColor: colors.bgInput,
    alignItems: 'center', justifyContent: 'center',
  },
  matchDateText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  matchTeams: { flex: 1, padding: spacing.sm },
  matchTeamRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 2,
  },
  matchTeamName: { fontSize: font.sm, color: colors.textMuted, flex: 1 },
  matchWinnerName: { color: colors.textLight, fontWeight: '600' },
  matchTeamScore: { fontSize: font.md, fontWeight: '700', color: colors.textMuted, width: 36, textAlign: 'right' },
  matchWinnerScore: { color: colors.textLight },
  categoryRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, gap: spacing.xs,
  },
  categoryChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.bgCard,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryChipActive: { backgroundColor: colors.primary },
  categoryText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  categoryTextActive: { color: colors.textLight },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md,
  },
  leaderRank: { fontSize: font.md, fontWeight: '700', color: colors.primary, width: 32 },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: font.md, fontWeight: '600', color: colors.textLight },
  leaderPos: { fontSize: font.xs, color: colors.textMuted },
  leaderStatCol: { alignItems: 'flex-end' },
  leaderStatValue: { fontSize: font.lg, fontWeight: '800', color: colors.secondary },
  leaderStatLabel: { fontSize: font.xs, color: colors.textMuted },
  emptyLeaders: { alignItems: 'center', paddingTop: spacing.xxl },
});
