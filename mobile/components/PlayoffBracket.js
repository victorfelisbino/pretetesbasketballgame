import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';

/**
 * PlayoffBracket — Visual single-elimination bracket.
 *
 * @param {object}   bracket     – from season.playoffBracket
 * @param {string}   userTeamId  – highlight user's team
 * @param {object}   [league]    – for team name lookups
 */
export default function PlayoffBracket({ bracket, userTeamId, league }) {
  if (!bracket || !bracket.rounds) return null;

  const getTeamName = (id) => {
    if (!id) return 'TBD';
    if (!league?.teams) return id;
    const team = league.teams.find(t => t.id === id || t.name === id);
    return team?.name || id;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PLAYOFFS</Text>

      {/* Qualifiers seeds */}
      {bracket.qualifiers && bracket.qualifiers.length > 0 && (
        <View style={styles.seedsRow}>
          {bracket.qualifiers.map((q, i) => (
            <View key={i} style={styles.seedBadge}>
              <Text style={styles.seedNum}>#{q.seed}</Text>
              <Text
                style={[
                  styles.seedName,
                  q.teamId === userTeamId && styles.userTeam,
                ]}
                numberOfLines={1}
              >
                {getTeamName(q.teamId)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Bracket rounds */}
      {bracket.rounds.map((round, roundIdx) => (
        <View key={roundIdx} style={styles.round}>
          <Text style={styles.roundLabel}>
            {roundIdx === bracket.rounds.length - 1 ? 'FINAL' :
             roundIdx === bracket.rounds.length - 2 ? 'SEMIFINAL' :
             `Round ${roundIdx + 1}`}
          </Text>
          {round.map((matchup, mIdx) => (
            <MatchupCard
              key={mIdx}
              matchup={matchup}
              userTeamId={userTeamId}
              getTeamName={getTeamName}
            />
          ))}
        </View>
      ))}

      {/* Champion */}
      {bracket.champion && (
        <View style={styles.championCard}>
          <Text style={styles.championEmoji}>🏆</Text>
          <Text style={styles.championLabel}>Champion</Text>
          <Text style={[
            styles.championName,
            bracket.champion.teamId === userTeamId && styles.userTeam,
          ]}>
            {getTeamName(bracket.champion.teamId)}
          </Text>
        </View>
      )}
    </View>
  );
}

function MatchupCard({ matchup, userTeamId, getTeamName }) {
  const isComplete = matchup.status === 'completed';
  const homeIsUser = matchup.homeTeamId === userTeamId;
  const awayIsUser = matchup.awayTeamId === userTeamId;

  return (
    <View style={styles.matchup}>
      {/* Home team */}
      <View style={styles.matchupTeamRow}>
        <Text style={styles.matchupSeed}>
          {matchup.homeTeamSeed ? `#${matchup.homeTeamSeed}` : ''}
        </Text>
        <Text
          style={[
            styles.matchupTeam,
            homeIsUser && styles.userTeam,
            isComplete && matchup.winner === matchup.homeTeamId && styles.winnerTeam,
          ]}
          numberOfLines={1}
        >
          {getTeamName(matchup.homeTeamId)}
        </Text>
        {isComplete && matchup.homeScore != null && (
          <Text style={styles.matchupScore}>{matchup.homeScore}</Text>
        )}
      </View>

      <View style={styles.matchupDivider} />

      {/* Away team */}
      <View style={styles.matchupTeamRow}>
        <Text style={styles.matchupSeed}>
          {matchup.awayTeamSeed ? `#${matchup.awayTeamSeed}` : ''}
        </Text>
        <Text
          style={[
            styles.matchupTeam,
            awayIsUser && styles.userTeam,
            isComplete && matchup.winner === matchup.awayTeamId && styles.winnerTeam,
          ]}
          numberOfLines={1}
        >
          {matchup.awayTeamId ? getTeamName(matchup.awayTeamId) : 'TBD'}
        </Text>
        {isComplete && matchup.awayScore != null && (
          <Text style={styles.matchupScore}>{matchup.awayScore}</Text>
        )}
      </View>

      {/* Pending indicator */}
      {!isComplete && matchup.status !== 'pending' && (
        <View style={styles.matchupPending}>
          <Text style={styles.matchupPendingText}>
            {matchup.homeTeamId && matchup.awayTeamId ? 'vs' : 'TBD'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: font.md,
    fontWeight: '800',
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: spacing.md,
  },

  // Seeds
  seedsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  seedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  seedNum: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  seedName: {
    fontSize: font.xs,
    color: colors.textLight,
    maxWidth: 80,
  },

  // Round
  round: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  roundLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  // Matchup
  matchup: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  matchupTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  matchupSeed: {
    fontSize: font.xs,
    color: colors.textMuted,
    width: 24,
    fontWeight: '600',
  },
  matchupTeam: {
    flex: 1,
    fontSize: font.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  matchupScore: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.textLight,
    minWidth: 28,
    textAlign: 'right',
  },
  matchupDivider: {
    height: 1,
    backgroundColor: colors.bgInput,
    marginHorizontal: spacing.md,
  },
  matchupPending: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  matchupPendingText: {
    fontSize: font.xs,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // Winner / user
  userTeam: {
    color: colors.primary,
    fontWeight: '700',
  },
  winnerTeam: {
    color: colors.success,
    fontWeight: '800',
  },

  // Champion
  championCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  championEmoji: {
    fontSize: 36,
    marginBottom: spacing.xs,
  },
  championLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  championName: {
    fontSize: font.xl,
    fontWeight: '800',
    color: colors.warning,
    marginTop: spacing.xs,
  },
});
