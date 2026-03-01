import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { colors, spacing, font, radius } from '../../theme';
import { storage } from '../../lib/storage';

export default function HomeScreen() {
  const router = useRouter();
  const [quickStats, setQuickStats] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [leaguesRaw, careerRaw, historyRaw] = await Promise.all([
            storage.getItem('quadra_legacy_leagues'),
            storage.getItem('quadra_legacy_career'),
            storage.getItem('quadra_legacy_match_history'),
          ]);
          const leagues = leaguesRaw ? JSON.parse(leaguesRaw) : [];
          const career = careerRaw ? JSON.parse(careerRaw) : null;
          const history = historyRaw ? JSON.parse(historyRaw) : [];
          setQuickStats({
            leagueCount: leagues.length,
            activeLeague: leagues.find(l => l.status === 'in-progress'),
            careerLevel: career ? Math.floor((career.totalXP || 0) / 100) + 1 : 0,
            careerTrack: career?.track,
            matchesPlayed: history.length,
          });
        } catch { /* noop */ }
      })();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="basketball" size={56} color={colors.primary} />
        <Text style={styles.title}>Quadra Legacy</Text>
        <Text style={styles.subtitle}>Basketball Manager</Text>
      </View>

      {/* Quick resume card */}
      {quickStats?.activeLeague && (
        <TouchableOpacity
          style={styles.resumeCard}
          onPress={() => router.push(`/league/${quickStats.activeLeague.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.resumeLeft}>
            <Ionicons name="play-circle" size={24} color={colors.secondary} />
            <View>
              <Text style={styles.resumeTitle}>Continue League</Text>
              <Text style={styles.resumeSub}>{quickStats.activeLeague.name}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      <View style={styles.menu}>
        <Button
          title="Quick Match"
          onPress={() => router.push('/match/setup')}
          style={styles.menuBtn}
        />

        {/* Stats row */}
        {quickStats && (
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Ionicons name="trophy" size={14} color={colors.warning} />
              <Text style={styles.statPillText}>{quickStats.leagueCount} leagues</Text>
            </View>
            <View style={styles.statPill}>
              <Ionicons name="basketball" size={14} color={colors.primary} />
              <Text style={styles.statPillText}>{quickStats.matchesPlayed} matches</Text>
            </View>
            {quickStats.careerTrack && (
              <View style={styles.statPill}>
                <Ionicons name="person" size={14} color={colors.secondary} />
                <Text style={styles.statPillText}>Lv {quickStats.careerLevel}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: font.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  resumeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resumeTitle: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.textLight,
  },
  resumeSub: {
    fontSize: font.xs,
    color: colors.textMuted,
  },
  menu: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  menuBtn: {
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgCard,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  statPillText: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  version: {
    color: colors.textMuted,
    fontSize: font.xs,
  },
});
