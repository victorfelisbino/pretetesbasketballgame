import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { colors, spacing, font, radius, hitSlop } from '../../theme';
import { createPlayerAuto } from '../../src/gameplay/playerCreator';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

function generateTeam(name) {
  const players = [];
  for (const pos of POSITIONS) {
    players.push(createPlayerAuto({ position: pos }));
    players.push(createPlayerAuto({ position: pos }));
  }
  return { name, score: 0, players };
}

function PlayerCard({ player, selected, onToggle }) {
  return (
    <TouchableOpacity
      style={[styles.playerCard, selected && styles.playerCardSelected]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.playerCardLeft}>
        <Text style={[styles.positionBadge, selected && styles.positionBadgeSelected]}>
          {player.position}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          <Text style={styles.playerDetails}>
            OVR {player.overall} | {player.archetype}
          </Text>
        </View>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? colors.primary : colors.textMuted}
      />
    </TouchableOpacity>
  );
}

export default function MatchSetupScreen() {
  const router = useRouter();
  const [homeTeam, setHomeTeam] = useState(() => generateTeam('My Team'));
  const [awayTeam, setAwayTeam] = useState(() => generateTeam('Opponent'));
  const [selectedIds, setSelectedIds] = useState(() => {
    const ids = new Set();
    for (const pos of POSITIONS) {
      const best = homeTeam.players
        .filter(p => p.position === pos)
        .sort((a, b) => b.overall - a.overall)[0];
      if (best) ids.add(best.id);
    }
    return ids;
  });

  const togglePlayer = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 5) return prev;
        next.add(id);
      }
      return next;
    });
  }, []);

  const rerollTeams = useCallback(() => {
    const newHome = generateTeam('My Team');
    const newAway = generateTeam('Opponent');
    setHomeTeam(newHome);
    setAwayTeam(newAway);
    const ids = new Set();
    for (const pos of POSITIONS) {
      const best = newHome.players
        .filter(p => p.position === pos)
        .sort((a, b) => b.overall - a.overall)[0];
      if (best) ids.add(best.id);
    }
    setSelectedIds(ids);
  }, []);

  const canStart = selectedIds.size === 5;

  const handleStart = useCallback(() => {
    const home = {
      ...homeTeam,
      players: homeTeam.players.filter(p => selectedIds.has(p.id)),
    };
    const awayStarters = [];
    for (const pos of POSITIONS) {
      const best = awayTeam.players
        .filter(p => p.position === pos)
        .sort((a, b) => b.overall - a.overall)[0];
      if (best) awayStarters.push(best);
    }
    const away = { ...awayTeam, players: awayStarters };

    router.push({
      pathname: '/match/tactics',
      params: {
        homeTeam: JSON.stringify(home),
        awayTeam: JSON.stringify(away),
      },
    });
  }, [homeTeam, awayTeam, selectedIds, router]);

  const selectedCount = selectedIds.size;
  const byPosition = POSITIONS.map(pos => ({
    pos,
    players: homeTeam.players.filter(p => p.position === pos),
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={hitSlop}>
          <Ionicons name="arrow-back" size={22} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.title}>Quick Match</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.vsCard}>
          <View style={styles.vsTeam}>
            <Ionicons name="home" size={32} color={colors.primary} />
            <Text style={styles.vsTeamName}>{homeTeam.name}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.vsTeam}>
            <Ionicons name="shield" size={32} color={colors.error} />
            <Text style={styles.vsTeamName}>{awayTeam.name}</Text>
          </View>
        </View>

        <Button
          title="Reroll Teams"
          onPress={rerollTeams}
          variant="outline"
          style={styles.rerollBtn}
        />

        <Text style={styles.sectionTitle}>
          Select Starting 5 ({selectedCount}/5)
        </Text>

        {byPosition.map(({ pos, players }) => (
          <View key={pos} style={styles.posSection}>
            <Text style={styles.posLabel}>{pos}</Text>
            {players.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                selected={selectedIds.has(p.id)}
                onToggle={() => togglePlayer(p.id)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={canStart ? 'Choose Tactics →' : `Select ${5 - selectedCount} more`}
          onPress={handleStart}
          disabled={!canStart}
        />
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
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  vsCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  vsTeam: { alignItems: 'center', gap: spacing.xs },
  vsTeamName: { fontSize: font.md, fontWeight: '700', color: colors.textLight },
  vsText: { fontSize: font.xl, fontWeight: '800', color: colors.primary },
  rerollBtn: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: font.lg, fontWeight: '700', color: colors.textLight,
    marginBottom: spacing.md,
  },
  posSection: { marginBottom: spacing.md },
  posLabel: {
    fontSize: font.sm, fontWeight: '700', color: colors.primary,
    marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 1,
  },
  playerCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.xs,
    borderWidth: 2, borderColor: 'transparent',
  },
  playerCardSelected: {
    borderColor: colors.primary, backgroundColor: colors.bgInput,
  },
  playerCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  positionBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgInput, color: colors.textMuted,
    textAlign: 'center', lineHeight: 36, fontSize: font.sm, fontWeight: '700',
    overflow: 'hidden',
  },
  positionBadgeSelected: { backgroundColor: colors.primary, color: colors.textLight },
  playerName: { fontSize: font.md, fontWeight: '600', color: colors.textLight },
  playerDetails: { fontSize: font.xs, color: colors.textMuted },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.bgCard },
});
