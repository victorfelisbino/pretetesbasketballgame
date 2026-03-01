import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import SeasonTimeline from '../../components/SeasonTimeline';
import PlayoffBracket from '../../components/PlayoffBracket';
import TierBadge from '../../components/TierBadge';
import { colors, spacing, font, radius, hitSlop } from '../../theme';
import { storage } from '../../lib/storage';

const TABS = ['Timeline', 'Standings', 'Schedule', 'Teams'];

export default function LeagueViewScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [league, setLeague] = useState(null);
  const [activeTab, setActiveTab] = useState('Timeline');
  const [loading, setLoading] = useState(true);

  // Load league data (refresh on focus)
  useFocusEffect(useCallback(() => { loadLeague(); }, [id]));

  const loadLeague = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await storage.getItem('quadra_legacy_leagues');
      if (raw) {
        const leagues = JSON.parse(raw);
        const found = leagues.find(l => l.id === id);
        if (found) setLeague(found);
      }
    } catch (e) {
      console.warn('Failed to load league:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Derive season data from league schedule
  const season = useMemo(() => {
    if (!league) return null;
    const schedule = (league.schedule || []).map((match, idx) => {
      // Group matches into rounds
      const round = match.round || Math.floor(idx / Math.max(1, Math.floor(league.teams?.length / 2))) + 1;
      return { ...match, round };
    });

    // Group by round
    const roundMap = {};
    schedule.forEach(m => {
      if (!roundMap[m.round]) {
        roundMap[m.round] = { week: m.round, round: m.round, matchups: [] };
      }
      roundMap[m.round].matchups.push({
        homeTeamId: m.homeTeam || m.homeTeamId,
        awayTeamId: m.awayTeam || m.awayTeamId,
        status: m.status || (m.homeScore != null ? 'completed' : 'scheduled'),
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      });
    });

    const roundSchedule = Object.values(roundMap).sort((a, b) => a.round - b.round);

    // Build standings from team stats
    const standings = (league.teams || []).map(t => ({
      teamId: t.id || t.name,
      wins: t.stats?.wins || 0,
      losses: t.stats?.losses || 0,
      pointsFor: t.stats?.pointsFor || 0,
      pointsAgainst: t.stats?.pointsAgainst || 0,
      fantasyPts: t.stats?.fantasyPts || 0,
    }));

    return {
      number: league.season || 1,
      status: league.status === 'completed' ? 'offseason' :
              league.status === 'in-progress' ? 'regular' : 'draft',
      schedule: roundSchedule,
      standings,
      dates: {},
      playoffBracket: league.playoffBracket || null,
      champion: league.champion || null,
    };
  }, [league]);

  const userTeamId = useMemo(() => {
    if (!league?.teams) return null;
    const userTeam = league.teams.find(t => t.isUser);
    return userTeam?.id || userTeam?.name || null;
  }, [league]);

  const sortedStandings = useMemo(() => {
    if (!season?.standings) return [];
    return [...season.standings].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    });
  }, [season]);

  const handlePlayMatch = useCallback((matchInfo) => {
    if (!league) return;
    const userTeam = league.teams?.find(t => t.isUser);
    const oppId = matchInfo?.oppId || (matchInfo?.homeTeamId === userTeamId ? matchInfo?.awayTeamId : matchInfo?.homeTeamId);
    const oppTeam = league.teams?.find(t => (t.id || t.name) === oppId);
    if (!userTeam || !oppTeam) return;

    const home = { name: userTeam.name, players: userTeam.players || [] };
    const away = { name: oppTeam.name, players: oppTeam.players || [] };

    router.push({
      pathname: '/match/tactics',
      params: {
        homeTeam: JSON.stringify(home),
        awayTeam: JSON.stringify(away),
        leagueId: league.id,
      },
    });
  }, [league, userTeamId, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!league) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.title}>League Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title} numberOfLines={1}>{league.name}</Text>
          <View style={styles.headerMeta}>
            <View style={styles.seasonBadge}>
              <Text style={styles.seasonBadgeText}>S{league.season || 1}</Text>
            </View>
            <View style={[styles.statusBadge, statusStyle(league.status)]}>
              <Text style={[styles.statusText, statusTextStyle(league.status)]}>
                {league.status}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push({ pathname: '/league/draft', params: { leagueId: league.id } })}
        >
          <Ionicons name="list-outline" size={18} color={colors.primary} />
          <Text style={styles.actionBtnText}>Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push({ pathname: '/league/marketplace', params: { leagueId: league.id } })}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
          <Text style={styles.actionBtnText}>Trades</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'Timeline' && season && (
          <SeasonTimeline
            season={season}
            userTeamId={userTeamId}
            onPlayMatch={handlePlayMatch}
            league={league}
          />
        )}

        {activeTab === 'Timeline' && season?.playoffBracket && (
          <PlayoffBracket
            bracket={season.playoffBracket}
            userTeamId={userTeamId}
            league={league}
          />
        )}

        {activeTab === 'Standings' && (
          <View style={styles.standingsContainer}>
            {/* Table header */}
            <View style={styles.standingsHeader}>
              <Text style={[styles.standingsCell, styles.rankCell]}>#</Text>
              <Text style={[styles.standingsCell, styles.teamCell]}>Team</Text>
              <Text style={[styles.standingsCell, styles.statCell]}>W</Text>
              <Text style={[styles.standingsCell, styles.statCell]}>L</Text>
              <Text style={[styles.standingsCell, styles.statCell]}>PF</Text>
              <Text style={[styles.standingsCell, styles.statCell]}>PA</Text>
              <Text style={[styles.standingsCell, styles.statCell]}>+/-</Text>
            </View>
            {sortedStandings.map((team, idx) => {
              const isUser = team.teamId === userTeamId;
              const teamObj = league.teams?.find(t => (t.id || t.name) === team.teamId);
              const name = teamObj?.name || team.teamId;
              return (
                <View key={idx} style={[styles.standingsRow, isUser && styles.standingsRowUser]}>
                  <Text style={[styles.standingsCell, styles.rankCell, styles.rankText]}>
                    {idx + 1}
                  </Text>
                  <Text
                    style={[styles.standingsCell, styles.teamCell, isUser && styles.userTeamText]}
                    numberOfLines={1}
                  >
                    {isUser ? '⭐ ' : ''}{name}
                  </Text>
                  <Text style={[styles.standingsCell, styles.statCell, styles.statValue]}>
                    {team.wins}
                  </Text>
                  <Text style={[styles.standingsCell, styles.statCell]}>
                    {team.losses}
                  </Text>
                  <Text style={[styles.standingsCell, styles.statCell]}>
                    {team.pointsFor}
                  </Text>
                  <Text style={[styles.standingsCell, styles.statCell]}>
                    {team.pointsAgainst}
                  </Text>
                  <Text style={[
                    styles.standingsCell, styles.statCell,
                    (team.pointsFor - team.pointsAgainst) > 0 ? styles.diffPositive : styles.diffNegative,
                  ]}>
                    {team.pointsFor - team.pointsAgainst > 0 ? '+' : ''}
                    {team.pointsFor - team.pointsAgainst}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'Schedule' && season?.schedule && (
          <View style={styles.scheduleContainer}>
            {season.schedule.map((round, rIdx) => (
              <View key={rIdx} style={styles.roundGroup}>
                <Text style={styles.roundTitle}>Round {round.round}</Text>
                {round.matchups.map((m, mIdx) => {
                  const homeTeam = league.teams?.find(t => (t.id || t.name) === m.homeTeamId);
                  const awayTeam = league.teams?.find(t => (t.id || t.name) === m.awayTeamId);
                  const isComplete = m.status === 'completed';
                  return (
                    <View key={mIdx} style={[styles.matchCard, isComplete && styles.matchCardComplete]}>
                      <Text style={[
                        styles.matchTeam,
                        isComplete && m.homeScore > m.awayScore && styles.matchWinner,
                        m.homeTeamId === userTeamId && styles.userTeamText,
                      ]} numberOfLines={1}>
                        {homeTeam?.name || m.homeTeamId}
                      </Text>
                      <Text style={styles.matchScore}>
                        {isComplete ? `${m.homeScore} - ${m.awayScore}` : 'vs'}
                      </Text>
                      <Text style={[
                        styles.matchTeam, styles.matchTeamRight,
                        isComplete && m.awayScore > m.homeScore && styles.matchWinner,
                        m.awayTeamId === userTeamId && styles.userTeamText,
                      ]} numberOfLines={1}>
                        {awayTeam?.name || m.awayTeamId}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Teams' && (
          <View style={styles.teamsContainer}>
            {(league.teams || []).map((team, tIdx) => {
              const isUser = team.isUser;
              return (
                <View key={tIdx} style={[styles.teamCard, isUser && styles.teamCardUser]}>
                  <Text style={[styles.teamCardName, isUser && styles.userTeamText]}>
                    {isUser ? '⭐ ' : ''}{team.name}
                  </Text>
                  <Text style={styles.teamCardRecord}>
                    {team.stats?.wins || 0}W - {team.stats?.losses || 0}L
                  </Text>
                  {team.players && team.players.length > 0 && (
                    <View style={styles.rosterList}>
                      {team.players.slice(0, 5).map((p, pIdx) => (
                        <View key={pIdx} style={styles.rosterRow}>
                          <Text style={styles.rosterPos}>{p.position}</Text>
                          <Text style={styles.rosterName} numberOfLines={1}>{p.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function statusStyle(status) {
  if (status === 'in-progress') return { backgroundColor: 'rgba(78, 201, 176, 0.2)' };
  if (status === 'completed') return { backgroundColor: 'rgba(76, 175, 80, 0.2)' };
  return { backgroundColor: 'rgba(255, 193, 7, 0.2)' };
}

function statusTextStyle(status) {
  if (status === 'in-progress') return { color: colors.secondary };
  if (status === 'completed') return { color: colors.success };
  return { color: colors.warning };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.textLight,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  seasonBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  seasonBadgeText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.bgDark,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: font.xs,
    fontWeight: '600',
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.bgInput,
  },
  actionBtnText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.primary,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textLight,
  },

  content: {
    flex: 1,
  },

  // Standings
  standingsContainer: {
    marginHorizontal: spacing.lg,
  },
  standingsHeader: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  standingsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: 2,
  },
  standingsRowUser: {
    backgroundColor: 'rgba(78, 201, 176, 0.1)',
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  standingsCell: {
    fontSize: font.xs,
    color: colors.textMuted,
  },
  rankCell: {
    width: 24,
    textAlign: 'center',
  },
  rankText: {
    fontWeight: '700',
    color: colors.textLight,
  },
  teamCell: {
    flex: 1,
    fontWeight: '500',
    color: colors.textLight,
  },
  statCell: {
    width: 36,
    textAlign: 'center',
  },
  statValue: {
    fontWeight: '700',
    color: colors.primary,
  },
  userTeamText: {
    color: colors.secondary,
    fontWeight: '700',
  },
  diffPositive: {
    color: colors.success,
    fontWeight: '600',
  },
  diffNegative: {
    color: colors.error,
    fontWeight: '600',
  },

  // Schedule
  scheduleContainer: {
    paddingHorizontal: spacing.lg,
  },
  roundGroup: {
    marginBottom: spacing.md,
  },
  roundTitle: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.bgInput,
  },
  matchCardComplete: {
    borderLeftColor: colors.success,
  },
  matchTeam: {
    flex: 1,
    fontSize: font.sm,
    color: colors.textMuted,
  },
  matchTeamRight: {
    textAlign: 'right',
  },
  matchScore: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.primary,
    minWidth: 60,
    textAlign: 'center',
  },
  matchWinner: {
    color: colors.success,
    fontWeight: '700',
  },

  // Teams
  teamsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  teamCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  teamCardUser: {
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  teamCardName: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  teamCardRecord: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  rosterList: {
    gap: spacing.xs,
  },
  rosterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rosterPos: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.primary,
    width: 28,
  },
  rosterName: {
    fontSize: font.xs,
    color: colors.textMuted,
    flex: 1,
  },
});
