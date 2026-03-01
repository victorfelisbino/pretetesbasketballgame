import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { colors, spacing, font, radius, hitSlop } from '../../theme';
import { storage } from '../../lib/storage';
import {
  createDraft, startDraft, makePick, autoPickForManager,
  getBestAvailable, getManagerRoster, generateDraftPlayerPool, getPositionNeeds,
} from '../../src/gameplay/draftEngine';

const STORAGE_KEY = 'quadra_legacy_leagues';
const PICK_TIMER_SECONDS = 30;
const AI_PICK_DELAY_MS = 1200;
const POSITIONS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];
const USER_TEAM_ID = 'team_user';

// ── Sub-components ───────────────────────────────────────────────────────

function PlayerPoolCard({ player, onPick, isNeeded }) {
  return (
    <View style={[styles.poolCard, isNeeded && styles.poolCardNeeded]}>
      <View style={styles.poolCardLeft}>
        <Text style={styles.poolPosBadge}>{player.position}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.poolName} numberOfLines={1}>{player.name}</Text>
          <Text style={styles.poolMeta}>{player.archetype || 'Balanced'}</Text>
        </View>
      </View>
      <Text style={styles.poolOvr}>{player.overall}</Text>
      <TouchableOpacity style={styles.pickBtn} onPress={() => onPick(player.id)}>
        <Text style={styles.pickBtnText}>Pick</Text>
      </TouchableOpacity>
    </View>
  );
}

function DraftLogEntry({ pick, managers, isUser }) {
  const manager = managers?.find(m => m.id === pick.managerId);
  return (
    <View style={[styles.logEntry, isUser && styles.logEntryUser]}>
      <Text style={styles.logPick}>R{pick.round} P{pick.pickNumber}</Text>
      <Text style={styles.logTeam} numberOfLines={1}>
        {manager?.name || pick.managerId}
      </Text>
      <Text style={styles.logPlayer} numberOfLines={1}>{pick.playerName}</Text>
    </View>
  );
}

function RosterSlot({ player, index }) {
  if (!player) {
    return (
      <View style={styles.rosterSlot}>
        <Text style={styles.rosterEmpty}>Slot {index + 1} — Empty</Text>
      </View>
    );
  }
  return (
    <View style={[styles.rosterSlot, styles.rosterSlotFilled]}>
      <Text style={styles.rosterPos}>{player.position}</Text>
      <Text style={styles.rosterName} numberOfLines={1}>{player.name}</Text>
      <Text style={styles.rosterOvr}>{player.overall}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────

export default function DraftRoomScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const leagueId = params.leagueId;

  // Core data
  const [league, setLeague] = useState(null);
  const [draftState, setDraftState] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [posFilter, setPosFilter] = useState('All');
  const [timerSeconds, setTimerSeconds] = useState(PICK_TIMER_SECONDS);
  const [aiPicking, setAiPicking] = useState(false);
  const [bottomTab, setBottomTab] = useState('roster');

  // Refs
  const timerRef = useRef(null);
  const draftRef = useRef(null);
  const timerBarAnim = useRef(new Animated.Value(1)).current;
  const savingRef = useRef(false);
  const aiPickingRef = useRef(false);

  // Sync ref with state
  const updateDraft = useCallback((newState) => {
    draftRef.current = newState;
    setDraftState(newState);
  }, []);

  // ── Load league ─────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (raw) {
          const leagues = JSON.parse(raw);
          const found = leagues.find(l => l.id === leagueId);
          if (found) setLeague(found);
        }
      } catch (e) {
        console.warn('Failed to load league:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [leagueId]);

  // ── Derived values ──────────────────────────────────────────────────

  const isUserTurn = useMemo(() => {
    return draftState?.currentPick?.managerId === USER_TEAM_ID;
  }, [draftState?.currentPick?.managerId]);

  const currentManager = useMemo(() => {
    if (!draftState?.currentPick) return null;
    return draftState.managers.find(m => m.id === draftState.currentPick.managerId);
  }, [draftState?.currentPick?.managerId, draftState?.managers]);

  const availablePlayers = useMemo(() => {
    if (!draftState) return [];
    const pos = posFilter === 'All' ? undefined : posFilter;
    return getBestAvailable(draftState, pos);
  }, [draftState, posFilter]);

  const userRoster = useMemo(() => {
    if (!draftState) return [];
    return getManagerRoster(draftState, USER_TEAM_ID);
  }, [draftState?.picks?.length]);

  const userNeeds = useMemo(() => {
    if (!draftState) return [];
    return getPositionNeeds(userRoster, draftState.rosterSize);
  }, [userRoster, draftState?.rosterSize]);

  const needSet = useMemo(() => new Set(userNeeds), [userNeeds]);

  const draftLog = useMemo(() => {
    if (!draftState) return [];
    return [...draftState.picks].reverse();
  }, [draftState?.picks?.length]);

  const roundInfo = useMemo(() => {
    if (!draftState?.currentPick) return { round: 0, pick: 0, total: 0 };
    return {
      round: draftState.currentPick.round,
      pick: draftState.currentPick.pickNumber,
      total: draftState.pickOrder.length,
    };
  }, [draftState?.currentPick]);

  // ── Init draft ──────────────────────────────────────────────────────

  const initDraft = useCallback(() => {
    if (!league) return;

    const managers = league.teams.map(t => ({
      id: t.id,
      name: t.name,
      isUser: t.isUser || false,
      isAI: !t.isUser,
    }));

    const pool = generateDraftPlayerPool(managers.length, 5);

    const draft = createDraft({
      leagueId: league.id,
      managers,
      rosterSize: 5,
      playerPool: pool,
      pickTimerSeconds: PICK_TIMER_SECONDS,
    });

    // Attach _allPlayers cache so getManagerRoster returns full player objects
    draft._allPlayers = [...pool];

    const started = startDraft(draft);
    started._allPlayers = draft._allPlayers;
    updateDraft(started);
  }, [league, updateDraft]);

  // ── User pick ───────────────────────────────────────────────────────

  const handleUserPick = useCallback((playerId) => {
    const current = draftRef.current;
    if (!current || current.status !== 'picking') return;
    if (current.currentPick?.managerId !== USER_TEAM_ID) return;

    clearInterval(timerRef.current);
    Animated.timing(timerBarAnim).stop();

    try {
      const result = makePick(current, USER_TEAM_ID, playerId);
      result.draft._allPlayers = current._allPlayers;
      updateDraft(result.draft);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }, [updateDraft, timerBarAnim]);

  // ── AI turn processing ──────────────────────────────────────────────

  const processAiTurn = useCallback(() => {
    const current = draftRef.current;
    if (!current || current.status !== 'picking') return;
    if (current.currentPick?.managerId === USER_TEAM_ID) return;

    aiPickingRef.current = true;
    setAiPicking(true);

    setTimeout(() => {
      const latest = draftRef.current;
      if (!latest || latest.status !== 'picking') {
        aiPickingRef.current = false;
        setAiPicking(false);
        return;
      }
      if (latest.currentPick?.managerId === USER_TEAM_ID) {
        aiPickingRef.current = false;
        setAiPicking(false);
        return;
      }

      try {
        const result = autoPickForManager(latest, latest.currentPick.managerId);
        result.draft._allPlayers = latest._allPlayers;
        updateDraft(result.draft);
      } catch (e) {
        console.warn('AI pick failed:', e);
      }
      aiPickingRef.current = false;
      setAiPicking(false);
    }, AI_PICK_DELAY_MS);
  }, [updateDraft]);

  // ── Timer expiry ────────────────────────────────────────────────────

  const handleTimerExpiry = useCallback(() => {
    const current = draftRef.current;
    if (!current || current.status !== 'picking') return;
    if (current.currentPick?.managerId !== USER_TEAM_ID) return;

    try {
      const result = autoPickForManager(current, USER_TEAM_ID);
      result.draft._allPlayers = current._allPlayers;
      updateDraft(result.draft);
      Alert.alert("Time's Up!", `Auto-picked ${result.pick.playerName}`);
    } catch (e) {
      console.warn('Timer auto-pick failed:', e);
    }
  }, [updateDraft]);

  // ── Timer effect ────────────────────────────────────────────────────

  useEffect(() => {
    if (draftState?.status !== 'picking' || !isUserTurn) {
      clearInterval(timerRef.current);
      return;
    }

    setTimerSeconds(PICK_TIMER_SECONDS);
    timerBarAnim.setValue(1);
    Animated.timing(timerBarAnim, {
      toValue: 0,
      duration: PICK_TIMER_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimerExpiry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [draftState?.currentPick?.pickNumber, isUserTurn, handleTimerExpiry, timerBarAnim]);

  // ── AI chain effect ─────────────────────────────────────────────────

  useEffect(() => {
    if (draftState?.status !== 'picking') return;
    if (draftState.currentPick?.managerId !== USER_TEAM_ID && !aiPickingRef.current) {
      processAiTurn();
    }
  }, [draftState?.currentPick?.pickNumber, draftState?.status, processAiTurn]);

  // ── Save results on complete ────────────────────────────────────────

  useEffect(() => {
    if (draftState?.status !== 'complete') return;
    if (savingRef.current) return;
    savingRef.current = true;

    (async () => {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (!raw) return;
        const leagues = JSON.parse(raw);
        const idx = leagues.findIndex(l => l.id === leagueId);
        if (idx === -1) return;

        const updatedLeague = { ...leagues[idx] };
        const updatedTeams = updatedLeague.teams.map(team => {
          const roster = getManagerRoster(draftState, team.id);
          if (roster.length > 0) {
            return { ...team, players: roster };
          }
          return team;
        });
        updatedLeague.teams = updatedTeams;
        leagues[idx] = updatedLeague;
        await storage.setItem(STORAGE_KEY, JSON.stringify(leagues));
      } catch (e) {
        console.warn('Failed to save draft results:', e);
      }
    })();
  }, [draftState?.status]);

  // ── Cleanup ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Render: Loading ─────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!league) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>League not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Lobby ───────────────────────────────────────────────────

  if (!draftState || draftState.status === 'lobby') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={hitSlop}>
            <Ionicons name="arrow-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Draft Room</Text>
        </View>

        <FlatList
          data={league.teams}
          keyExtractor={item => item.id}
          style={styles.lobbyList}
          contentContainerStyle={styles.lobbyContent}
          ListHeaderComponent={
            <View style={styles.lobbyHeader}>
              <Ionicons name="list-outline" size={48} color={colors.primary} />
              <Text style={styles.lobbyTitle}>Snake Draft</Text>
              <Text style={styles.lobbySubtitle}>
                {league.teams.length} teams — 5 rounds — {league.teams.length * 5} picks
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={[styles.lobbyTeam, item.isUser && styles.lobbyTeamUser]}>
              <Text style={styles.lobbyOrder}>#{index + 1}</Text>
              <Text style={[styles.lobbyTeamName, item.isUser && styles.userHighlight]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.isUser && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>YOU</Text>
                </View>
              )}
            </View>
          )}
        />

        <View style={styles.footer}>
          <Button title="Start Draft" onPress={initDraft} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Complete ────────────────────────────────────────────────

  if (draftState.status === 'complete') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          <Text style={styles.headerTitle}>Draft Complete!</Text>
        </View>

        <FlatList
          data={userRoster}
          keyExtractor={(item, i) => item.id || `slot_${i}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg }}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>Your Roster</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.completeRow}>
              <Text style={styles.completePos}>{item.position}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.completeName}>{item.name}</Text>
                <Text style={styles.completeMeta}>{item.archetype || 'Balanced'}</Text>
              </View>
              <Text style={styles.completeOvr}>{item.overall}</Text>
            </View>
          )}
        />

        <View style={styles.footer}>
          <Button
            title="Return to League"
            onPress={() => router.replace(`/league/${leagueId}`)}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Picking ─────────────────────────────────────────────────

  const timerBarWidth = timerBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const timerBarColor = timerBarAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [colors.error, colors.warning, colors.secondary],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.pickHeader}>
        <View>
          <Text style={styles.pickRound}>Round {roundInfo.round}</Text>
          <Text style={styles.pickTeam} numberOfLines={1}>
            {currentManager?.name || '...'}
            {isUserTurn ? ' (YOU)' : ''}
          </Text>
        </View>
        <Text style={styles.pickCounter}>
          {roundInfo.pick}/{roundInfo.total}
        </Text>
      </View>

      {/* Timer bar */}
      {isUserTurn && (
        <View style={styles.timerContainer}>
          <Animated.View
            style={[
              styles.timerBar,
              { width: timerBarWidth, backgroundColor: timerBarColor },
            ]}
          />
          <Text style={styles.timerText}>{timerSeconds}s</Text>
        </View>
      )}

      {/* Main area */}
      {isUserTurn ? (
        <View style={{ flex: 1 }}>
          {/* Position filters */}
          <View style={styles.filterRow}>
            {POSITIONS.map(pos => {
              const active = posFilter === pos;
              const needed = pos !== 'All' && needSet.has(pos);
              return (
                <TouchableOpacity
                  key={pos}
                  style={[styles.filterBtn, active && styles.filterBtnActive]}
                  onPress={() => setPosFilter(pos)}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {pos}
                  </Text>
                  {needed && <View style={styles.needDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Player pool */}
          <FlatList
            data={availablePlayers}
            keyExtractor={item => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
            renderItem={({ item }) => (
              <PlayerPoolCard
                player={item}
                onPick={handleUserPick}
                isNeeded={needSet.has(item.position)}
              />
            )}
            getItemLayout={(_, index) => ({
              length: 56,
              offset: 56 * index,
              index,
            })}
          />
        </View>
      ) : (
        <View style={styles.aiPickBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.aiPickText}>
            {currentManager?.name || 'AI'} is picking...
          </Text>
        </View>
      )}

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.bottomTabs}>
          <TouchableOpacity
            style={[styles.bottomTab, bottomTab === 'roster' && styles.bottomTabActive]}
            onPress={() => setBottomTab('roster')}
          >
            <Text style={[styles.bottomTabText, bottomTab === 'roster' && styles.bottomTabTextActive]}>
              My Roster ({userRoster.length}/5)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomTab, bottomTab === 'log' && styles.bottomTabActive]}
            onPress={() => setBottomTab('log')}
          >
            <Text style={[styles.bottomTabText, bottomTab === 'log' && styles.bottomTabTextActive]}>
              Draft Log
            </Text>
          </TouchableOpacity>
        </View>

        {bottomTab === 'roster' ? (
          <View style={styles.bottomContent}>
            {[0, 1, 2, 3, 4].map(i => (
              <RosterSlot key={i} player={userRoster[i]} index={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={draftLog}
            keyExtractor={(item, i) => `log_${i}`}
            style={styles.bottomContent}
            renderItem={({ item }) => (
              <DraftLogEntry
                pick={item}
                managers={draftState.managers}
                isUser={item.managerId === USER_TEAM_ID}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  emptyText: { color: colors.textMuted, fontSize: font.md },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.primary },

  // Lobby
  lobbyList: { flex: 1 },
  lobbyContent: { padding: spacing.lg, gap: spacing.xs },
  lobbyHeader: {
    alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm,
  },
  lobbyTitle: { fontSize: font.xxl, fontWeight: '800', color: colors.textLight },
  lobbySubtitle: { fontSize: font.md, color: colors.textMuted, textAlign: 'center' },
  lobbyTeam: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.md,
  },
  lobbyTeamUser: { borderWidth: 2, borderColor: colors.primary },
  lobbyOrder: { fontSize: font.md, fontWeight: '700', color: colors.textMuted, width: 30 },
  lobbyTeamName: { fontSize: font.md, fontWeight: '600', color: colors.textLight, flex: 1 },
  userHighlight: { color: colors.primary },
  youBadge: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  youBadgeText: { fontSize: font.xs, fontWeight: '700', color: colors.bgDark },

  // Picking header
  pickHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.bgCard,
  },
  pickRound: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted },
  pickTeam: { fontSize: font.lg, fontWeight: '700', color: colors.textLight, maxWidth: 240 },
  pickCounter: { fontSize: font.lg, fontWeight: '800', color: colors.primary },

  // Timer
  timerContainer: {
    height: 24, backgroundColor: colors.bgInput, position: 'relative',
    justifyContent: 'center',
  },
  timerBar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  timerText: {
    fontSize: font.xs, fontWeight: '700', color: colors.textLight,
    textAlign: 'center', zIndex: 1,
  },

  // Position filters
  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, gap: spacing.xs,
  },
  filterBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, backgroundColor: colors.bgCard,
    position: 'relative',
  },
  filterBtnActive: { backgroundColor: colors.primary },
  filterText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.textLight },
  needDot: {
    position: 'absolute', top: 2, right: 2,
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success,
  },

  // Player pool card
  poolCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.sm,
    padding: spacing.sm, marginBottom: spacing.xs,
    height: 52,
  },
  poolCardNeeded: { borderLeftWidth: 3, borderLeftColor: colors.success },
  poolCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  poolPosBadge: {
    fontSize: font.xs, fontWeight: '700', color: colors.primary,
    width: 28, textAlign: 'center',
  },
  poolName: { fontSize: font.sm, fontWeight: '600', color: colors.textLight },
  poolMeta: { fontSize: font.xs, color: colors.textMuted },
  poolOvr: {
    fontSize: font.md, fontWeight: '800', color: colors.secondary,
    width: 32, textAlign: 'center',
  },
  pickBtn: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  pickBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.textLight },

  // AI picking
  aiPickBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
  },
  aiPickText: { fontSize: font.lg, color: colors.textMuted, fontWeight: '600' },

  // Bottom panel
  bottomPanel: {
    height: 200, borderTopWidth: 2, borderTopColor: colors.bgInput,
    backgroundColor: colors.bgCard,
  },
  bottomTabs: { flexDirection: 'row' },
  bottomTab: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  bottomTabActive: { borderBottomColor: colors.primary },
  bottomTabText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  bottomTabTextActive: { color: colors.primary },
  bottomContent: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.xs },

  // Roster slot
  rosterSlot: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm, marginBottom: 2,
  },
  rosterSlotFilled: { backgroundColor: colors.bgInput },
  rosterEmpty: { fontSize: font.xs, color: colors.textMuted, fontStyle: 'italic' },
  rosterPos: { fontSize: font.xs, fontWeight: '700', color: colors.primary, width: 28 },
  rosterName: { fontSize: font.sm, color: colors.textLight, flex: 1 },
  rosterOvr: { fontSize: font.sm, fontWeight: '700', color: colors.secondary },

  // Draft log
  logEntry: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm, marginBottom: 2,
  },
  logEntryUser: { backgroundColor: 'rgba(255, 107, 53, 0.1)' },
  logPick: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, width: 44 },
  logTeam: { fontSize: font.xs, color: colors.textMuted, width: 80 },
  logPlayer: { fontSize: font.sm, fontWeight: '600', color: colors.textLight, flex: 1 },

  // Complete
  sectionTitle: {
    fontSize: font.lg, fontWeight: '700', color: colors.textLight, marginBottom: spacing.md,
  },
  completeRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.xs, gap: spacing.md,
  },
  completePos: {
    fontSize: font.sm, fontWeight: '700', color: colors.primary,
    width: 30, textAlign: 'center',
  },
  completeName: { fontSize: font.md, fontWeight: '600', color: colors.textLight },
  completeMeta: { fontSize: font.xs, color: colors.textMuted },
  completeOvr: { fontSize: font.xl, fontWeight: '800', color: colors.secondary },

  // Footer
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.bgCard },
});
