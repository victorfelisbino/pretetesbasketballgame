import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/Button';
import { colors, spacing, font, radius, TIER_COLORS, TIER_LABELS, hitSlop } from '../../theme';
import { storage } from '../../lib/storage';
import {
  createCareer,
  getCareerLevelInfo,
  processPracticeSession,
  applyCareerXP,
} from '../../src/core/careerEngine';

const STORAGE_KEY = 'quadra_legacy_career';

function ProgressBar({ progress, color }) {
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${Math.min(100, progress)}%`, backgroundColor: color }]} />
    </View>
  );
}

function CareerDashboard({ career, onPractice, practicing }) {
  const levelInfo = getCareerLevelInfo(career.totalXP || 0);
  const tierColor = TIER_COLORS[levelInfo.tier] || colors.textMuted;

  return (
    <ScrollView style={styles.dashboard} contentContainerStyle={styles.dashboardContent}>
      {/* Career header */}
      <View style={styles.careerHeader}>
        <Ionicons
          name={career.track === 'coach' ? 'school-outline' : 'basketball-outline'}
          size={48}
          color={colors.primary}
        />
        <Text style={styles.careerTrack}>
          {career.track === 'coach' ? 'Coach' : 'Player'} Career
        </Text>
        <View style={[styles.tierBadgeLarge, { borderColor: tierColor }]}>
          <Text style={[styles.tierBadgeText, { color: tierColor }]}>
            {TIER_LABELS[levelInfo.tier] || levelInfo.tier}
          </Text>
        </View>
      </View>

      {/* Level card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Level {levelInfo.currentLevel}</Text>
        <ProgressBar progress={levelInfo.progressPercent} color={colors.primary} />
        <Text style={styles.xpText}>
          {levelInfo.xpInCurrentLevel} / {levelInfo.xpRequiredForNextLevel} XP
        </Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{career.totalXP || 0}</Text>
          <Text style={styles.statLabel}>Total XP</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{career.matchesPlayed || 0}</Text>
          <Text style={styles.statLabel}>Matches</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{career.wins || 0}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{career.championships || 0}</Text>
          <Text style={styles.statLabel}>Titles</Text>
        </View>
      </View>

      {/* Practice button */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Practice</Text>
        <Text style={styles.cardHint}>
          Train to earn XP ({career.practiceCount || 0}/3 today)
        </Text>
        <Button
          title="Practice Session"
          onPress={onPractice}
          disabled={(career.practiceCount || 0) >= 3 || practicing}
          loading={practicing}
          variant="secondary"
          style={{ marginTop: spacing.sm }}
        />
      </View>

      {/* Career history */}
      {career.history && career.history.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          {career.history.slice(-5).reverse().map((entry, i) => (
            <Text key={i} style={styles.historyLine}>
              +{entry.xp} XP — {entry.reason}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export default function CareerScreen() {
  const [career, setCareer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [practicing, setPracticing] = useState(false);

  const loadCareer = useCallback(async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) setCareer(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to load career:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCareer(); }, [loadCareer]);

  const saveCareer = useCallback(async (data) => {
    setCareer(data);
    await storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const handleCreateCareer = useCallback(async (track) => {
    const newCareer = createCareer(track);
    newCareer.matchesPlayed = 0;
    newCareer.wins = 0;
    newCareer.championships = 0;
    newCareer.history = [];
    newCareer.practiceCount = 0;
    newCareer.lastPracticeDate = null;
    await saveCareer(newCareer);
  }, [saveCareer]);

  const handlePractice = useCallback(async () => {
    if (!career) return;
    setPracticing(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = { ...career };

      // Reset daily count if new day
      if (updated.lastPracticeDate !== today) {
        updated.practiceCount = 0;
        updated.lastPracticeDate = today;
      }

      const result = processPracticeSession(updated, new Date());
      if (result.success) {
        const afterXP = applyCareerXP(result.careerData, result.xpGained);
        afterXP.practiceCount = (updated.practiceCount || 0) + 1;
        afterXP.lastPracticeDate = today;
        afterXP.history = [
          ...(updated.history || []),
          { xp: result.xpGained, reason: 'Practice session', date: today },
        ];
        await saveCareer(afterXP);
        Alert.alert('Practice Complete', `You earned +${result.xpGained} XP!`);
      }
    } catch (e) {
      console.warn('Practice error:', e);
    } finally {
      setPracticing(false);
    }
  }, [career, saveCareer]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // If career exists, show dashboard
  if (career) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Career</Text>
          <TouchableOpacity
            hitSlop={hitSlop}
            style={styles.resetBtn}
            onPress={() => {
              Alert.alert(
                'Reset Career',
                'This will permanently erase all career progress. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                      await storage.removeItem(STORAGE_KEY);
                      setCareer(null);
                    },
                  },
                ],
              );
            }}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <CareerDashboard
          career={career}
          onPractice={handlePractice}
          practicing={practicing}
        />
      </SafeAreaView>
    );
  }

  // Career creation
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Career</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="person-circle-outline" size={80} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Start Your Career</Text>
          <Text style={styles.emptyHint}>
            Choose your path — become a legendary coach{'\n'}or rise from the streets as a player
          </Text>
        </View>

        <Button
          title="Coach Career"
          onPress={() => handleCreateCareer('coach')}
          style={styles.careerBtn}
        />
        <Button
          title="Player Career"
          onPress={() => handleCreateCareer('player')}
          variant="secondary"
          style={styles.careerBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  title: { fontSize: font.xxl, fontWeight: '800', color: colors.primary },
  resetBtn: { padding: spacing.sm },
  resetText: { fontSize: font.sm, color: colors.error, fontWeight: '600' },
  content: {
    flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center', gap: spacing.md,
  },
  emptyState: {
    alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl,
  },
  emptyTitle: {
    fontSize: font.xl, fontWeight: '700', color: colors.textLight, marginTop: spacing.md,
  },
  emptyHint: {
    fontSize: font.sm, color: colors.textMuted, textAlign: 'center', lineHeight: 20,
  },
  careerBtn: { width: '100%' },
  dashboard: { flex: 1 },
  dashboardContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  careerHeader: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  careerTrack: { fontSize: font.xl, fontWeight: '700', color: colors.textLight },
  tierBadgeLarge: {
    borderWidth: 2, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  tierBadgeText: { fontSize: font.sm, fontWeight: '700' },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardTitle: { fontSize: font.lg, fontWeight: '700', color: colors.textLight, marginBottom: spacing.xs },
  cardHint: { fontSize: font.sm, color: colors.textMuted },
  progressBar: {
    height: 8, backgroundColor: colors.bgInput, borderRadius: 4,
    marginVertical: spacing.sm, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  xpText: { fontSize: font.xs, color: colors.textMuted, textAlign: 'right' },
  statsGrid: {
    flexDirection: 'row', gap: spacing.sm,
  },
  statBox: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.sm, alignItems: 'center',
  },
  statNumber: { fontSize: font.xl, fontWeight: '800', color: colors.textLight },
  statLabel: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  historyLine: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs },
});
