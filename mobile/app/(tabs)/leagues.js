import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { colors, spacing, font, radius } from '../../theme';
import { storage } from '../../lib/storage';
import { createPlayerAuto } from '../../src/gameplay/playerCreator';

const STORAGE_KEY = 'quadra_legacy_leagues';
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

function generateId() {
  return 'lg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function generateTeamName(index) {
  const cities = [
    'Santos', 'Curitiba', 'Recife', 'Fortaleza', 'Salvador',
    'Manaus', 'Goiania', 'Campinas', 'Vitoria', 'Natal',
    'Floripa', 'Brasilia',
  ];
  const mascots = [
    'Thunder', 'Sharks', 'Eagles', 'Wolves', 'Panthers',
    'Hawks', 'Lions', 'Bulls', 'Rockets', 'Flames',
    'Vipers', 'Titans',
  ];
  return `${cities[index % cities.length]} ${mascots[index % mascots.length]}`;
}

function generateTeamRoster() {
  return POSITIONS.map(pos => createPlayerAuto({ position: pos }));
}

function generateRoundRobinSchedule(teams) {
  const ids = teams.map(t => t.id);
  const list = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const half = list.length / 2;
  const schedule = [];
  let round = 1;

  for (let r = 0; r < list.length - 1; r++) {
    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[list.length - 1 - i];
      if (home && away) {
        schedule.push({
          id: `m_${round}_${i}`,
          round,
          homeTeam: home,
          awayTeam: away,
          homeScore: null,
          awayScore: null,
          status: 'scheduled',
        });
      }
    }
    round++;
    const last = list.pop();
    list.splice(1, 0, last);
  }
  return schedule;
}

function LeagueCard({ league, onPress, onDelete }) {
  const teamsCount = league.teams?.length || 0;
  const statusColor = {
    'setup': colors.warning,
    'in-progress': colors.success,
    'completed': colors.textMuted,
  }[league.status] || colors.textMuted;

  return (
    <TouchableOpacity
      style={styles.leagueCard}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      <View style={styles.leagueCardTop}>
        <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
      <View style={styles.leagueCardBottom}>
        <Text style={styles.leagueMeta}>
          S{league.season || 1} | {teamsCount} teams | {league.status}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function LeaguesScreen() {
  const router = useRouter();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadLeagues = useCallback(async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) setLeagues(JSON.parse(raw));
      else setLeagues([]);
    } catch (e) {
      console.warn('Failed to load leagues:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeagues(); }, [loadLeagues]);

  const saveLeagues = useCallback(async (updated) => {
    setLeagues(updated);
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save leagues:', e);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const leagueId = generateId();
      const numTeams = 6;
      const teams = [];

      teams.push({
        id: 'team_user',
        name: 'My Team',
        isUser: true,
        players: generateTeamRoster(),
        stats: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
      });

      for (let i = 1; i < numTeams; i++) {
        teams.push({
          id: `team_ai_${i}`,
          name: generateTeamName(i),
          isUser: false,
          players: generateTeamRoster(),
          stats: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 },
        });
      }

      const schedule = generateRoundRobinSchedule(teams);
      const seasonNum = leagues.length + 1;

      const newLeague = {
        id: leagueId,
        name: `Quadra League S${seasonNum}`,
        season: 1,
        status: 'in-progress',
        tier: 'amateur',
        maxTeams: numTeams,
        teams,
        schedule,
        createdAt: new Date().toISOString(),
      };

      const updated = [...leagues, newLeague];
      await saveLeagues(updated);
      router.push(`/league/${leagueId}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to create league');
      console.error(e);
    } finally {
      setCreating(false);
    }
  }, [leagues, saveLeagues, router]);

  const handleDelete = useCallback((league) => {
    Alert.alert(
      'Delete League',
      `Are you sure you want to delete "${league.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = leagues.filter(l => l.id !== league.id);
            await saveLeagues(updated);
          },
        },
      ],
    );
  }, [leagues, saveLeagues]);

  const hasLeagues = leagues.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leagues</Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !hasLeagues ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No leagues yet</Text>
          <Text style={styles.emptyHint}>
            Create a league to start a season with AI opponents
          </Text>
        </View>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={item => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <LeagueCard
              league={item}
              onPress={() => router.push(`/league/${item.id}`)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <View style={styles.footer}>
        <Button
          title="+ Create New League"
          onPress={handleCreate}
          loading={creating}
          style={styles.createBtn}
        />
      </View>
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
  list: { flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  leagueCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.bgInput,
  },
  leagueCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  leagueName: { fontSize: font.lg, fontWeight: '700', color: colors.textLight, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  leagueCardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  leagueMeta: { fontSize: font.sm, color: colors.textMuted },
  footer: {
    padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.bgCard,
  },
  createBtn: { width: '100%' },
});
