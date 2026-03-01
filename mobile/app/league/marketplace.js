import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { colors, spacing, font, radius, hitSlop } from '../../theme';
import { storage } from '../../lib/storage';
import {
  proposeTrade, evaluateTradeByAI, getTradeHistory,
  TRADE_STATUS,
} from '../../src/gameplay/transferEngine';
import { calculatePlayerSalary } from '../../src/core/salaryCapEngine';

const STORAGE_KEY = 'quadra_legacy_leagues';
const TRADES_KEY = 'quadra_legacy_trades';
const AI_THINK_DELAY_MS = 1500;
const USER_TEAM_ID = 'team_user';
const MAX_TRADE_PLAYERS = 3;

// ── Sub-components ───────────────────────────────────────────────────────

function TeamCard({ team, onPress }) {
  const avgOvr = team.players?.length
    ? Math.round(team.players.reduce((s, p) => s + (p.overall || 0), 0) / team.players.length)
    : 0;

  return (
    <TouchableOpacity style={styles.teamCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.teamCardLeft}>
        <Ionicons name="shield" size={28} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.teamCardName} numberOfLines={1}>{team.name}</Text>
          <Text style={styles.teamCardMeta}>
            {team.stats?.wins || 0}W - {team.stats?.losses || 0}L | {team.players?.length || 0} players | Avg {avgOvr}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function TradePlayerRow({ player, selected, onToggle, salary }) {
  return (
    <TouchableOpacity
      style={[styles.tradeRow, selected && styles.tradeRowSelected]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? colors.primary : colors.textMuted}
      />
      <Text style={styles.tradePos}>{player.position}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.tradeName} numberOfLines={1}>{player.name}</Text>
        <Text style={styles.tradeMeta}>
          {player.archetype || 'Balanced'} | ${(salary / 1000).toFixed(0)}k
        </Text>
      </View>
      <Text style={styles.tradeOvr}>{player.overall}</Text>
    </TouchableOpacity>
  );
}

function TradeBalanceBar({ offeredTotal, requestedTotal }) {
  const max = Math.max(offeredTotal, requestedTotal, 1);
  const offeredPct = (offeredTotal / max) * 100;
  const requestedPct = (requestedTotal / max) * 100;
  const diff = offeredTotal - requestedTotal;
  const isGood = diff >= 0;

  return (
    <View style={styles.balanceContainer}>
      <Text style={styles.balanceLabel}>Trade Value</Text>
      <View style={styles.balanceBarBg}>
        <View
          style={[
            styles.balanceBarFill,
            { width: `${offeredPct}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>
      <View style={styles.balanceBarBg}>
        <View
          style={[
            styles.balanceBarFill,
            { width: `${requestedPct}%`, backgroundColor: colors.secondary },
          ]}
        />
      </View>
      <View style={styles.balanceLegend}>
        <Text style={styles.balanceLegendText}>You offer: {offeredTotal} OVR</Text>
        <Text style={styles.balanceLegendText}>You get: {requestedTotal} OVR</Text>
      </View>
      <Text style={[styles.balanceDiff, { color: isGood ? colors.success : colors.error }]}>
        {diff > 0 ? '+' : ''}{diff} OVR difference
      </Text>
    </View>
  );
}

function TradeResultCard({ result }) {
  if (!result) return null;

  const config = {
    accepted: { icon: 'checkmark-circle', color: colors.success, label: 'Trade Accepted!' },
    rejected: { icon: 'close-circle', color: colors.error, label: 'Trade Rejected' },
    countered: { icon: 'swap-horizontal', color: colors.warning, label: 'Counter Offer' },
  };

  const c = config[result.decision] || config.rejected;

  return (
    <View style={[styles.resultCard, { borderColor: c.color }]}>
      <Ionicons name={c.icon} size={36} color={c.color} />
      <Text style={[styles.resultLabel, { color: c.color }]}>{c.label}</Text>
      <Text style={styles.resultScore}>Trade score: {result.score}/100</Text>
      {result.decision === 'countered' && result.trade?.counterOffer && (
        <Text style={styles.resultHint}>
          {result.trade.counterOffer.message}{'\n'}
          Wants players rated {result.trade.counterOffer.requestedMinOverall}+ OVR
        </Text>
      )}
    </View>
  );
}

function TradeHistoryCard({ trade, league }) {
  const isProposer = trade.proposingTeamId === USER_TEAM_ID;
  const partnerId = isProposer ? trade.receivingTeamId : trade.proposingTeamId;
  const partner = league?.teams?.find(t => t.id === partnerId);
  const statusColor = {
    accepted: colors.success,
    rejected: colors.error,
    countered: colors.warning,
  }[trade.status] || colors.textMuted;

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <Text style={styles.historyPartner} numberOfLines={1}>
          {partner?.name || partnerId}
        </Text>
        <View style={[styles.historyStatus, { backgroundColor: statusColor + '30' }]}>
          <Text style={[styles.historyStatusText, { color: statusColor }]}>
            {trade.status}
          </Text>
        </View>
      </View>
      <Text style={styles.historyDetail}>
        Offered: {trade.playersFromProposer.map(p => p.name).join(', ')}
      </Text>
      <Text style={styles.historyDetail}>
        Wanted: {trade.playersFromReceiver.map(p => p.name).join(', ')}
      </Text>
      <Text style={styles.historyDate}>
        {new Date(trade.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const leagueId = params.leagueId;

  // Core data
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tradeHistory, setTradeHistory] = useState([]);

  // Navigation
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // Trade proposal
  const [offeredIds, setOfferedIds] = useState(new Set());
  const [requestedIds, setRequestedIds] = useState(new Set());

  // Trade result
  const [tradeResult, setTradeResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  // ── Load data ───────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [leagueRaw, tradesRaw] = await Promise.all([
          storage.getItem(STORAGE_KEY),
          storage.getItem(TRADES_KEY),
        ]);
        if (leagueRaw) {
          const leagues = JSON.parse(leagueRaw);
          const found = leagues.find(l => l.id === leagueId);
          if (found) setLeague(found);
        }
        if (tradesRaw) {
          setTradeHistory(JSON.parse(tradesRaw));
        }
      } catch (e) {
        console.warn('Failed to load marketplace data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [leagueId]);

  // ── Derived values ──────────────────────────────────────────────────

  const userTeam = useMemo(() => {
    return league?.teams?.find(t => t.isUser) || null;
  }, [league]);

  const aiTeams = useMemo(() => {
    return (league?.teams || []).filter(t => !t.isUser);
  }, [league]);

  const selectedTeam = useMemo(() => {
    if (!selectedTeamId) return null;
    return league?.teams?.find(t => t.id === selectedTeamId) || null;
  }, [league, selectedTeamId]);

  const tier = league?.tier || 'amateur';

  const userPlayersWithSalary = useMemo(() => {
    if (!userTeam?.players) return [];
    return userTeam.players.map(p => ({
      ...p,
      salary: calculatePlayerSalary(p, tier),
    }));
  }, [userTeam, tier]);

  const selectedPlayersWithSalary = useMemo(() => {
    if (!selectedTeam?.players) return [];
    return selectedTeam.players.map(p => ({
      ...p,
      salary: calculatePlayerSalary(p, tier),
    }));
  }, [selectedTeam, tier]);

  const offeredPlayers = useMemo(() => {
    return userPlayersWithSalary.filter(p => offeredIds.has(p.id));
  }, [userPlayersWithSalary, offeredIds]);

  const requestedPlayers = useMemo(() => {
    return selectedPlayersWithSalary.filter(p => requestedIds.has(p.id));
  }, [selectedPlayersWithSalary, requestedIds]);

  const tradeValue = useMemo(() => {
    const offeredTotal = offeredPlayers.reduce((s, p) => s + (p.overall || 0), 0);
    const requestedTotal = requestedPlayers.reduce((s, p) => s + (p.overall || 0), 0);
    return { offeredTotal, requestedTotal };
  }, [offeredPlayers, requestedPlayers]);

  const canPropose = offeredPlayers.length > 0 && requestedPlayers.length > 0;

  const userTradeHistory = useMemo(() => {
    return getTradeHistory(tradeHistory, USER_TEAM_ID);
  }, [tradeHistory]);

  // ── Actions ─────────────────────────────────────────────────────────

  const handleSelectTeam = useCallback((teamId) => {
    setSelectedTeamId(teamId);
    setOfferedIds(new Set());
    setRequestedIds(new Set());
    setTradeResult(null);
    setActiveTab('propose');
  }, []);

  const toggleOffered = useCallback((playerId) => {
    setOfferedIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        if (next.size >= MAX_TRADE_PLAYERS) return prev;
        next.add(playerId);
      }
      return next;
    });
  }, []);

  const toggleRequested = useCallback((playerId) => {
    setRequestedIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        if (next.size >= MAX_TRADE_PLAYERS) return prev;
        next.add(playerId);
      }
      return next;
    });
  }, []);

  const handleBackToBrowse = useCallback(() => {
    setSelectedTeamId(null);
    setOfferedIds(new Set());
    setRequestedIds(new Set());
    setTradeResult(null);
    setActiveTab('browse');
  }, []);

  const handleProposeTrade = useCallback(async () => {
    if (!canPropose || !selectedTeam) return;

    Alert.alert(
      'Propose Trade',
      `Send this trade offer to ${selectedTeam.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setProcessing(true);
            try {
              // Build trade proposal with salary data
              const playersFromProposer = offeredPlayers.map(p => ({
                id: p.id, name: p.name, position: p.position,
                overall: p.overall, salary: p.salary, age: p.age || 25,
              }));
              const playersFromReceiver = requestedPlayers.map(p => ({
                id: p.id, name: p.name, position: p.position,
                overall: p.overall, salary: p.salary, age: p.age || 25,
              }));

              const trade = proposeTrade({
                proposingTeamId: USER_TEAM_ID,
                receivingTeamId: selectedTeamId,
                playersFromProposer,
                playersFromReceiver,
              });

              // Simulate AI thinking delay
              await new Promise(resolve => setTimeout(resolve, AI_THINK_DELAY_MS));

              // AI evaluates
              const result = evaluateTradeByAI(
                trade,
                selectedTeam.players || [],
                'VETERAN',
              );

              setTradeResult(result);

              // If accepted, execute the roster swap
              if (result.decision === 'accepted') {
                await executeRosterSwap(playersFromProposer, playersFromReceiver);
              }

              // Save trade to history
              const updatedHistory = [...tradeHistory, result.trade];
              setTradeHistory(updatedHistory);
              await storage.setItem(TRADES_KEY, JSON.stringify(updatedHistory));
            } catch (e) {
              Alert.alert('Error', e.message || 'Trade failed');
              console.error(e);
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  }, [canPropose, selectedTeam, offeredPlayers, requestedPlayers, tradeHistory, executeRosterSwap]);

  const executeRosterSwap = useCallback(async (fromUser, fromAI) => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (!raw) return;

      const leagues = JSON.parse(raw);
      const idx = leagues.findIndex(l => l.id === leagueId);
      if (idx === -1) return;

      const updatedLeague = { ...leagues[idx] };
      const fromUserIds = new Set(fromUser.map(p => p.id));
      const fromAIIds = new Set(fromAI.map(p => p.id));

      updatedLeague.teams = updatedLeague.teams.map(team => {
        if (team.id === USER_TEAM_ID) {
          // Remove offered players, add received players
          const remaining = (team.players || []).filter(p => !fromUserIds.has(p.id));
          const received = (selectedTeam?.players || []).filter(p => fromAIIds.has(p.id));
          return { ...team, players: [...remaining, ...received] };
        }
        if (team.id === selectedTeamId) {
          // Remove received players, add offered players
          const remaining = (team.players || []).filter(p => !fromAIIds.has(p.id));
          const received = (userTeam?.players || []).filter(p => fromUserIds.has(p.id));
          return { ...team, players: [...remaining, ...received] };
        }
        return team;
      });

      leagues[idx] = updatedLeague;
      await storage.setItem(STORAGE_KEY, JSON.stringify(leagues));
      setLeague(updatedLeague);
    } catch (e) {
      console.warn('Failed to save roster swap:', e);
    }
  }, [leagueId, selectedTeamId, selectedTeam, userTeam]);

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

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={hitSlop}>
          <Ionicons name="arrow-back" size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplace</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: 'browse', label: 'Teams' },
          ...(selectedTeamId ? [{ key: 'propose', label: 'Trade' }] : []),
          { key: 'history', label: 'History' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Browse tab */}
      {activeTab === 'browse' && (
        <FlatList
          data={aiTeams}
          keyExtractor={item => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          ListHeaderComponent={
            <Text style={styles.sectionHint}>
              Select a team to propose a trade
            </Text>
          }
          renderItem={({ item }) => (
            <TeamCard team={item} onPress={() => handleSelectTeam(item.id)} />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No teams available</Text>
          }
        />
      )}

      {/* Propose tab */}
      {activeTab === 'propose' && selectedTeam && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
          {/* Trade partner header */}
          <View style={styles.proposeSectionHeader}>
            <TouchableOpacity onPress={handleBackToBrowse} hitSlop={hitSlop}>
              <Ionicons name="arrow-back-circle-outline" size={24} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.proposeTitle}>Trade with {selectedTeam.name}</Text>
          </View>

          {/* You Offer section */}
          <Text style={styles.sectionLabel}>
            You Offer ({offeredIds.size}/{MAX_TRADE_PLAYERS})
          </Text>
          {userPlayersWithSalary.map(p => (
            <TradePlayerRow
              key={p.id}
              player={p}
              salary={p.salary}
              selected={offeredIds.has(p.id)}
              onToggle={() => toggleOffered(p.id)}
            />
          ))}

          {/* You Receive section */}
          <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
            You Receive ({requestedIds.size}/{MAX_TRADE_PLAYERS})
          </Text>
          {selectedPlayersWithSalary.map(p => (
            <TradePlayerRow
              key={p.id}
              player={p}
              salary={p.salary}
              selected={requestedIds.has(p.id)}
              onToggle={() => toggleRequested(p.id)}
            />
          ))}

          {/* Trade balance */}
          {canPropose && (
            <TradeBalanceBar
              offeredTotal={tradeValue.offeredTotal}
              requestedTotal={tradeValue.requestedTotal}
            />
          )}

          {/* Trade result */}
          {tradeResult && <TradeResultCard result={tradeResult} />}

          {/* Action buttons */}
          {!tradeResult && (
            <Button
              title={processing ? 'Evaluating...' : 'Propose Trade'}
              onPress={handleProposeTrade}
              disabled={!canPropose}
              loading={processing}
              style={{ marginTop: spacing.lg }}
            />
          )}
          {tradeResult && (
            <Button
              title="New Trade"
              variant="outline"
              onPress={handleBackToBrowse}
              style={{ marginTop: spacing.md }}
            />
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <FlatList
          data={userTradeHistory}
          keyExtractor={(item, i) => item.id || `trade_${i}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => (
            <TradeHistoryCard trade={item} league={league} />
          )}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Ionicons name="swap-horizontal-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No trades yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  centerBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.lg, padding: spacing.lg,
  },
  emptyText: { color: colors.textMuted, fontSize: font.md, textAlign: 'center' },

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

  // Tabs
  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.xs,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.textLight },

  // Section
  sectionHint: {
    fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center',
  },
  sectionLabel: {
    fontSize: font.md, fontWeight: '700', color: colors.textLight,
    marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  // Team card
  teamCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md,
  },
  teamCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  teamCardName: { fontSize: font.md, fontWeight: '600', color: colors.textLight },
  teamCardMeta: { fontSize: font.xs, color: colors.textMuted },

  // Trade player row
  tradeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgCard, borderRadius: radius.sm,
    padding: spacing.sm, marginBottom: spacing.xs,
    borderWidth: 2, borderColor: 'transparent',
  },
  tradeRowSelected: { borderColor: colors.primary, backgroundColor: colors.bgInput },
  tradePos: { fontSize: font.xs, fontWeight: '700', color: colors.primary, width: 28 },
  tradeName: { fontSize: font.sm, fontWeight: '600', color: colors.textLight },
  tradeMeta: { fontSize: font.xs, color: colors.textMuted },
  tradeOvr: { fontSize: font.md, fontWeight: '800', color: colors.secondary },

  // Propose section
  proposeSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
  },
  proposeTitle: { fontSize: font.lg, fontWeight: '700', color: colors.textLight },

  // Balance bar
  balanceContainer: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.lg,
  },
  balanceLabel: {
    fontSize: font.sm, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.sm,
  },
  balanceBarBg: {
    height: 8, backgroundColor: colors.bgInput, borderRadius: 4,
    marginBottom: spacing.xs, overflow: 'hidden',
  },
  balanceBarFill: { height: '100%', borderRadius: 4 },
  balanceLegend: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs,
  },
  balanceLegendText: { fontSize: font.xs, color: colors.textMuted },
  balanceDiff: { fontSize: font.sm, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },

  // Trade result card
  resultCard: {
    alignItems: 'center', backgroundColor: colors.bgCard,
    borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.lg, borderWidth: 2, gap: spacing.sm,
  },
  resultLabel: { fontSize: font.xl, fontWeight: '800' },
  resultScore: { fontSize: font.sm, color: colors.textMuted },
  resultHint: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center' },

  // Trade history
  historyCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
  },
  historyTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyPartner: { fontSize: font.md, fontWeight: '600', color: colors.textLight, flex: 1 },
  historyStatus: {
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill,
  },
  historyStatusText: { fontSize: font.xs, fontWeight: '700' },
  historyDetail: { fontSize: font.xs, color: colors.textMuted },
  historyDate: { fontSize: font.xs, color: colors.textMuted, marginTop: spacing.xs },
});
