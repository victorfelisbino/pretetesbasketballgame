import { useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, TIER_COLORS } from '../theme';

const NODE_SIZE = 36;
const NODE_GAP = 12;
const NODE_STEP = NODE_SIZE + NODE_GAP;

/**
 * SeasonTimeline — Elifoot-style season progress component.
 *
 * Shows where the user is in the season, upcoming matches,
 * recent results, trade deadline, standings summary, and playoff bracket.
 *
 * @param {object}   season       – Season object from seasonManager.js
 * @param {string}   userTeamId   – The user's team ID
 * @param {object}   [tierConfig] – From leagueTierEngine (tier name, promotion info)
 * @param {function} onPlayMatch  – Called when "Play Now" is pressed
 * @param {object}   [league]     – League object for team name lookups
 */
export default function SeasonTimeline({ season, userTeamId, tierConfig, onPlayMatch, league }) {
  const scrollRef = useRef(null);

  // ── Derived data ──────────────────────────────────────────────────────────

  const schedule = season?.schedule || [];
  const standings = season?.standings || [];
  const status = season?.status || 'draft';

  const teamName = useMemo(() => {
    if (!league?.teams) return userTeamId;
    const team = league.teams.find(t => t.id === userTeamId || t.name === userTeamId);
    return team?.name || userTeamId;
  }, [league, userTeamId]);

  const teamNameMap = useMemo(() => {
    const map = {};
    if (league?.teams) {
      league.teams.forEach(t => { map[t.id || t.name] = t.name; });
    }
    return map;
  }, [league]);

  const getTeamDisplayName = (id) => teamNameMap[id] || id;

  // Find current round (first uncompleted matchup week)
  const currentWeekIdx = useMemo(() => {
    for (let i = 0; i < schedule.length; i++) {
      const hasScheduled = schedule[i].matchups?.some(m => m.status === 'scheduled');
      if (hasScheduled) return i;
    }
    return schedule.length; // all completed
  }, [schedule]);

  // User's match results per week
  const weekResults = useMemo(() => {
    return schedule.map((week) => {
      const userMatch = week.matchups?.find(
        m => m.homeTeamId === userTeamId || m.awayTeamId === userTeamId
      );
      if (!userMatch) return { type: 'bye' };
      if (userMatch.status !== 'completed') return { type: 'scheduled', match: userMatch };

      const isHome = userMatch.homeTeamId === userTeamId;
      const userScore = isHome ? userMatch.homeScore : userMatch.awayScore;
      const oppScore = isHome ? userMatch.awayScore : userMatch.homeScore;
      const oppId = isHome ? userMatch.awayTeamId : userMatch.homeTeamId;
      const won = userScore > oppScore;

      return {
        type: won ? 'win' : 'loss',
        userScore,
        oppScore,
        oppId,
        round: week.round,
        match: userMatch,
      };
    });
  }, [schedule, userTeamId]);

  // Next unplayed match
  const nextMatch = useMemo(() => {
    for (const week of schedule) {
      const m = week.matchups?.find(
        match => (match.homeTeamId === userTeamId || match.awayTeamId === userTeamId)
          && match.status === 'scheduled'
      );
      if (m) {
        return {
          ...m,
          round: week.round,
          week: week.week,
          oppId: m.homeTeamId === userTeamId ? m.awayTeamId : m.homeTeamId,
          isHome: m.homeTeamId === userTeamId,
        };
      }
    }
    return null;
  }, [schedule, userTeamId]);

  // Recent results (last 5 completed)
  const recentResults = useMemo(() => {
    return weekResults
      .filter(r => r.type === 'win' || r.type === 'loss')
      .slice(-5)
      .reverse();
  }, [weekResults]);

  // User's standing
  const userStanding = useMemo(() => {
    const sorted = [...standings].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    });
    const idx = sorted.findIndex(s => s.teamId === userTeamId);
    if (idx === -1) return { position: 0, total: sorted.length, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
    const record = sorted[idx];
    return { position: idx + 1, total: sorted.length, ...record };
  }, [standings, userTeamId]);

  // Trade deadline info
  const tradeDeadlineInfo = useMemo(() => {
    if (!season?.dates?.tradeDeadline) return null;
    const completedRounds = schedule.filter(w =>
      w.matchups?.every(m => m.status === 'completed')
    ).length;
    const totalRounds = schedule.length;
    // Trade deadline is at ~round 10 out of the total
    const deadlineRound = Math.min(10, totalRounds);
    const roundsUntil = deadlineRound - completedRounds;
    return {
      passed: roundsUntil <= 0,
      roundsUntil: Math.max(0, roundsUntil),
    };
  }, [season, schedule]);

  // Auto-scroll timeline to current week
  useEffect(() => {
    if (scrollRef.current && currentWeekIdx > 0) {
      const x = Math.max(0, (currentWeekIdx - 1) * NODE_STEP);
      scrollRef.current.scrollTo({ x, animated: true });
    }
  }, [currentWeekIdx]);

  // ── Timeline node colors ──────────────────────────────────────────────────

  function nodeColor(weekIdx) {
    if (weekIdx === currentWeekIdx) return colors.primary;
    const result = weekResults[weekIdx];
    if (!result) return colors.bgInput;
    if (result.type === 'win') return colors.success;
    if (result.type === 'loss') return colors.error;
    if (result.type === 'bye') return colors.textMuted;
    return colors.bgInput; // scheduled / future
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.seasonLabel}>
            Season {season?.number || 1}
          </Text>
          {tierConfig && (
            <View style={[styles.tierBadge, { backgroundColor: tierBadgeColor(tierConfig.id) }]}>
              <Text style={styles.tierText}>{tierConfig.label || tierConfig.labelPt}</Text>
            </View>
          )}
        </View>
        <Text style={styles.weekLabel}>
          {status === 'draft' ? 'Draft Phase' :
           status === 'playoffs' ? 'Playoffs' :
           status === 'offseason' ? 'Off-Season' :
           `Week ${Math.min(currentWeekIdx + 1, schedule.length)} of ${schedule.length}`}
        </Text>
      </View>

      {/* Timeline Strip */}
      <View style={styles.timelineWrapper}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timelineContent}
        >
          {/* Draft node */}
          <TimelineNode
            label="D"
            color={status === 'draft' ? colors.primary : colors.success}
            isCurrent={status === 'draft'}
            isFirst
          />

          {/* Week nodes */}
          {schedule.map((week, idx) => (
            <TimelineNode
              key={idx}
              label={`${idx + 1}`}
              color={nodeColor(idx)}
              isCurrent={idx === currentWeekIdx && status === 'regular'}
            />
          ))}

          {/* Playoffs node */}
          <TimelineNode
            label="P"
            color={status === 'playoffs' ? colors.primary :
                   status === 'offseason' ? colors.success : colors.bgInput}
            isCurrent={status === 'playoffs'}
          />

          {/* Champion node */}
          <TimelineNode
            icon="trophy"
            color={season?.champion ? colors.warning : colors.bgInput}
            isCurrent={false}
            isLast
          />
        </ScrollView>
      </View>

      {/* "You Are Here" indicator */}
      {status === 'regular' && (
        <Text style={styles.youAreHere}>
          ▲ YOU ARE HERE
        </Text>
      )}

      {/* Next Match Card */}
      {nextMatch && status === 'regular' && (
        <TouchableOpacity
          style={styles.nextMatchCard}
          onPress={() => onPlayMatch?.(nextMatch)}
          activeOpacity={0.8}
        >
          <View style={styles.nextMatchHeader}>
            <Ionicons name="basketball" size={18} color={colors.secondary} />
            <Text style={styles.nextMatchTitle}>Next Match — Round {nextMatch.round}</Text>
          </View>
          <View style={styles.nextMatchTeams}>
            <Text style={[styles.nextMatchTeam, nextMatch.isHome && styles.nextMatchUserTeam]}>
              {nextMatch.isHome ? teamName : getTeamDisplayName(nextMatch.oppId)}
            </Text>
            <Text style={styles.nextMatchVs}>vs</Text>
            <Text style={[styles.nextMatchTeam, !nextMatch.isHome && styles.nextMatchUserTeam]}>
              {!nextMatch.isHome ? teamName : getTeamDisplayName(nextMatch.oppId)}
            </Text>
          </View>
          <View style={styles.playBtn}>
            <Text style={styles.playBtnText}>Play Now</Text>
            <Ionicons name="play" size={16} color={colors.bgDark} />
          </View>
        </TouchableOpacity>
      )}

      {/* Season Complete card */}
      {(status === 'offseason' || season?.champion) && (
        <View style={styles.completeCard}>
          <Ionicons name="trophy" size={36} color={colors.warning} />
          <Text style={styles.completeTitle}>Season Complete!</Text>
          {season?.champion && (
            <Text style={styles.completeChampion}>
              Champion: {getTeamDisplayName(season.champion)}
            </Text>
          )}
        </View>
      )}

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Results</Text>
          {recentResults.map((r, idx) => (
            <View key={idx} style={styles.resultRow}>
              <View style={[
                styles.resultBadge,
                { backgroundColor: r.type === 'win' ? colors.success : colors.error }
              ]}>
                <Text style={styles.resultBadgeText}>{r.type === 'win' ? 'W' : 'L'}</Text>
              </View>
              <Text style={styles.resultText}>
                Round {r.round}
              </Text>
              <Text style={styles.resultScore}>
                {r.userScore} - {r.oppScore}
              </Text>
              <Text style={styles.resultOpp} numberOfLines={1}>
                {getTeamDisplayName(r.oppId)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Trade Deadline */}
      {tradeDeadlineInfo && status === 'regular' && (
        <View style={styles.deadlineBanner}>
          <Ionicons
            name={tradeDeadlineInfo.passed ? 'lock-closed' : 'time'}
            size={16}
            color={tradeDeadlineInfo.passed ? colors.textMuted : colors.warning}
          />
          <Text style={[
            styles.deadlineText,
            tradeDeadlineInfo.passed && styles.deadlinePassed
          ]}>
            {tradeDeadlineInfo.passed
              ? 'Trade deadline has passed'
              : `Trade deadline in ${tradeDeadlineInfo.roundsUntil} round${tradeDeadlineInfo.roundsUntil !== 1 ? 's' : ''}`}
          </Text>
        </View>
      )}

      {/* Standings Summary */}
      {userStanding.wins !== undefined && (
        <View style={styles.standingSummary}>
          <View style={styles.standingRow}>
            <Text style={styles.standingLabel}>Your Record</Text>
            <Text style={styles.standingValue}>
              {userStanding.wins}W - {userStanding.losses}L
            </Text>
          </View>
          <View style={styles.standingRow}>
            <Text style={styles.standingLabel}>Position</Text>
            <Text style={[
              styles.standingValue,
              userStanding.position <= (tierConfig?.promotionSlots || 2)
                ? styles.promotionZone
                : userStanding.position > userStanding.total - (tierConfig?.relegationSlots || 0)
                  ? styles.relegationZone
                  : null
            ]}>
              {ordinal(userStanding.position)} of {userStanding.total}
            </Text>
          </View>
          {tierConfig?.promotionSlots > 0 && (
            <View style={styles.standingRow}>
              <Text style={styles.standingLabel}>Promotion Zone</Text>
              <Text style={styles.promotionHint}>
                Top {tierConfig.promotionSlots}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Timeline Node sub-component ───────────────────────────────────────────

function TimelineNode({ label, icon, color, isCurrent, isFirst, isLast }) {
  return (
    <View style={styles.nodeContainer}>
      {/* Connecting line (left) */}
      {!isFirst && <View style={[styles.nodeLine, { backgroundColor: color }]} />}

      {/* Circle */}
      <View style={[
        styles.node,
        { backgroundColor: color },
        isCurrent && styles.nodeCurrent,
      ]}>
        {icon ? (
          <Ionicons name={icon} size={16} color={isCurrent ? colors.bgDark : colors.textLight} />
        ) : (
          <Text style={[styles.nodeLabel, isCurrent && styles.nodeLabelCurrent]}>
            {label}
          </Text>
        )}
      </View>

      {/* Connecting line (right) */}
      {!isLast && <View style={[styles.nodeLine, styles.nodeLineRight, { backgroundColor: colors.bgInput }]} />}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function tierBadgeColor(tierId) {
  return TIER_COLORS[tierId] || colors.bgInput;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seasonLabel: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.textLight,
  },
  tierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  tierText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textLight,
  },
  weekLabel: {
    fontSize: font.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // Timeline strip
  timelineWrapper: {
    marginBottom: spacing.xs,
  },
  timelineContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  nodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCurrent: {
    borderWidth: 3,
    borderColor: colors.textLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  nodeLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textLight,
  },
  nodeLabelCurrent: {
    fontSize: font.sm,
    fontWeight: '800',
  },
  nodeLine: {
    width: NODE_GAP,
    height: 3,
  },
  nodeLineRight: {},

  youAreHere: {
    textAlign: 'center',
    fontSize: font.xs,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },

  // Next match card
  nextMatchCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
  },
  nextMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  nextMatchTitle: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.secondary,
  },
  nextMatchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  nextMatchTeam: {
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  nextMatchUserTeam: {
    color: colors.textLight,
    fontWeight: '800',
  },
  nextMatchVs: {
    fontSize: font.md,
    color: colors.primary,
    fontWeight: '700',
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  playBtnText: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.bgDark,
  },

  // Season complete
  completeCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  completeTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.success,
  },
  completeChampion: {
    fontSize: font.md,
    color: colors.textLight,
    marginTop: spacing.sm,
  },

  // Recent results
  section: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  resultBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBadgeText: {
    fontSize: font.xs,
    fontWeight: '800',
    color: colors.textLight,
  },
  resultText: {
    fontSize: font.sm,
    color: colors.textMuted,
    width: 65,
  },
  resultScore: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.textLight,
    width: 60,
    textAlign: 'center',
  },
  resultOpp: {
    flex: 1,
    fontSize: font.sm,
    color: colors.textMuted,
    textAlign: 'right',
  },

  // Trade deadline
  deadlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  deadlineText: {
    fontSize: font.sm,
    color: colors.warning,
    fontWeight: '600',
  },
  deadlinePassed: {
    color: colors.textMuted,
  },

  // Standings summary
  standingSummary: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  standingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  standingLabel: {
    fontSize: font.sm,
    color: colors.textMuted,
  },
  standingValue: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.textLight,
  },
  promotionZone: {
    color: colors.success,
  },
  relegationZone: {
    color: colors.error,
  },
  promotionHint: {
    fontSize: font.sm,
    color: colors.success,
    fontWeight: '600',
  },
});
