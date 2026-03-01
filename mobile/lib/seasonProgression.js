/**
 * seasonProgression.js — Season advancement bridge for mobile UI.
 *
 * Connects existing pure engines (seasonManager, etc.) to the mobile
 * app's AsyncStorage-backed league model. Provides AI quick-sim,
 * round processing, standings recalculation, and playoff bracket
 * management.
 *
 * Exports:
 *   simulateAIMatch(homeTeam, awayTeam)
 *   processRound(league, roundNumber, userMatchResult?)
 *   recalculateStandings(league)
 *   checkSeasonPhase(league)
 *   processPlayoffMatch(league, matchupId, result)
 *   getNextUserAction(league, userTeamId)
 *   saveLeagueToStorage(league)
 */

import { storage } from './storage';

const STORAGE_KEY = 'quadra_legacy_leagues';

// ---------------------------------------------------------------------------
// Position archetype stat weights (how stats distribute per position)
// ---------------------------------------------------------------------------

const POSITION_WEIGHTS = {
  PG: { points: 0.20, rebounds: 0.06, assists: 0.30, steals: 0.18, blocks: 0.02, turnovers: 0.18 },
  SG: { points: 0.28, rebounds: 0.08, assists: 0.15, steals: 0.14, blocks: 0.03, turnovers: 0.14 },
  SF: { points: 0.22, rebounds: 0.16, assists: 0.12, steals: 0.12, blocks: 0.08, turnovers: 0.12 },
  PF: { points: 0.18, rebounds: 0.24, assists: 0.06, steals: 0.08, blocks: 0.16, turnovers: 0.10 },
  C:  { points: 0.15, rebounds: 0.30, assists: 0.04, steals: 0.05, blocks: 0.26, turnovers: 0.10 },
};

const DEFAULT_WEIGHTS = POSITION_WEIGHTS.SF;

// ---------------------------------------------------------------------------
// simulateAIMatch
// ---------------------------------------------------------------------------

/**
 * Quick-simulate a match between two AI teams without running the
 * full GameController. Uses team average overalls + randomness.
 *
 * @param {object} homeTeam - Team object with { players: [{ overall, position, name }] }
 * @param {object} awayTeam - Same shape
 * @returns {{ homeScore, awayScore, homeTeamStats, awayTeamStats }}
 */
export function simulateAIMatch(homeTeam, awayTeam) {
  const homeAvg = teamAverageOverall(homeTeam);
  const awayAvg = teamAverageOverall(awayTeam);

  // Base scores from team quality (range ~75-105)
  const homeBase = 65 + (homeAvg / 99) * 40 + 3; // +3 home court
  const awayBase = 65 + (awayAvg / 99) * 40;

  // Add randomness (±8 points)
  const homeScore = Math.round(homeBase + (Math.random() * 16 - 8));
  const awayScore = Math.round(awayBase + (Math.random() * 16 - 8));

  // Ensure no ties (add 1 to random team)
  const finalHome = homeScore === awayScore ? homeScore + (Math.random() > 0.5 ? 1 : 0) : homeScore;
  const finalAway = homeScore === awayScore ? awayScore + (finalHome === homeScore ? 1 : 0) : awayScore;

  const homeTeamStats = generatePlayerStats(homeTeam.players || [], finalHome);
  const awayTeamStats = generatePlayerStats(awayTeam.players || [], finalAway);

  return {
    homeScore: finalHome,
    awayScore: finalAway,
    homeTeamStats,
    awayTeamStats,
  };
}

function teamAverageOverall(team) {
  const players = team?.players || [];
  if (players.length === 0) return 50;
  return players.reduce((sum, p) => sum + (p.overall || 50), 0) / players.length;
}

/**
 * Generate stat lines for each player that add up to the team total.
 */
function generatePlayerStats(players, teamScore) {
  if (players.length === 0) return [];

  // Distribute points proportionally to overall rating
  const totalOverall = players.reduce((s, p) => s + (p.overall || 50), 0);
  let remainingPoints = teamScore;

  return players.map((player, idx) => {
    const share = (player.overall || 50) / totalOverall;
    const isLast = idx === players.length - 1;
    const points = isLast ? remainingPoints : Math.round(teamScore * share);
    remainingPoints -= points;

    const w = POSITION_WEIGHTS[player.position] || DEFAULT_WEIGHTS;

    // Generate other stats based on position archetype
    const statBudget = (player.overall || 50) / 10;
    const rebounds = Math.round(statBudget * (w.rebounds / 0.16) * (0.7 + Math.random() * 0.6));
    const assists = Math.round(statBudget * (w.assists / 0.15) * (0.5 + Math.random() * 0.5));
    const steals = Math.round(statBudget * (w.steals / 0.14) * (0.2 + Math.random() * 0.4));
    const blocks = Math.round(statBudget * (w.blocks / 0.10) * (0.1 + Math.random() * 0.4));
    const turnovers = Math.round(1 + Math.random() * 3);

    // Field goals: roughly 40-55% shooting
    const fgAttempts = Math.max(1, Math.round(points / 2.1));
    const fgMade = Math.round(fgAttempts * (0.38 + Math.random() * 0.18));
    const ftMade = Math.max(0, points - fgMade * 2);

    return {
      name: player.name || 'Unknown',
      position: player.position || 'SF',
      points: Math.max(0, points),
      rebounds: Math.max(0, rebounds),
      assists: Math.max(0, assists),
      steals: Math.max(0, steals),
      blocks: Math.max(0, blocks),
      turnovers,
      fieldGoalsMade: Math.max(0, fgMade),
      fieldGoalsMissed: Math.max(0, fgAttempts - fgMade),
      freeThrowsMade: Math.max(0, ftMade),
      freeThrowsMissed: Math.round(Math.random() * 2),
    };
  });
}

// ---------------------------------------------------------------------------
// processRound
// ---------------------------------------------------------------------------

/**
 * Process a full round: record user result (if any) + quick-sim all
 * remaining AI matches. Updates schedule and team stats.
 *
 * @param {object} league - League object (will be shallow-cloned)
 * @param {number} roundNumber - Round to process
 * @param {object} [userMatchResult] - Optional user match result:
 *   { homeTeamId, awayTeamId, homeScore, awayScore, homeTeamStats, awayTeamStats }
 * @returns {object} Updated league
 */
export function processRound(league, roundNumber, userMatchResult) {
  const updated = { ...league, schedule: [...league.schedule], teams: league.teams.map(t => ({ ...t, stats: { ...t.stats } })) };
  const teamMap = buildTeamMap(updated.teams);

  // Process each match in this round
  for (let i = 0; i < updated.schedule.length; i++) {
    const match = updated.schedule[i];
    if (match.round !== roundNumber) continue;
    if (match.status === 'completed') continue;

    const homeId = match.homeTeam;
    const awayId = match.awayTeam;

    // Check if this is the user's match
    if (userMatchResult && isMatchBetween(match, userMatchResult.homeTeamId, userMatchResult.awayTeamId)) {
      updated.schedule[i] = {
        ...match,
        homeScore: userMatchResult.homeScore,
        awayScore: userMatchResult.awayScore,
        status: 'completed',
      };
    } else {
      // AI vs AI quick-sim
      const homeTeam = teamMap[homeId];
      const awayTeam = teamMap[awayId];
      if (!homeTeam || !awayTeam) continue;

      const result = simulateAIMatch(homeTeam, awayTeam);
      updated.schedule[i] = {
        ...match,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        status: 'completed',
      };
    }
  }

  // Recalculate standings
  return recalculateStandings(updated);
}

function isMatchBetween(match, teamA, teamB) {
  return (match.homeTeam === teamA && match.awayTeam === teamB) ||
         (match.homeTeam === teamB && match.awayTeam === teamA);
}

function buildTeamMap(teams) {
  const map = {};
  for (const team of teams) {
    map[team.id] = team;
  }
  return map;
}

// ---------------------------------------------------------------------------
// recalculateStandings
// ---------------------------------------------------------------------------

/**
 * Rebuild all team stats from completed schedule matches.
 *
 * @param {object} league - League object
 * @returns {object} Updated league with recalculated team stats
 */
export function recalculateStandings(league) {
  const updated = { ...league, teams: league.teams.map(t => ({ ...t, stats: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } })) };
  const teamIdx = {};
  updated.teams.forEach((t, i) => { teamIdx[t.id] = i; });

  for (const match of updated.schedule) {
    if (match.status !== 'completed') continue;
    if (match.homeScore == null || match.awayScore == null) continue;

    const homeI = teamIdx[match.homeTeam];
    const awayI = teamIdx[match.awayTeam];
    if (homeI == null || awayI == null) continue;

    const homeTeam = updated.teams[homeI];
    const awayTeam = updated.teams[awayI];

    homeTeam.stats.pointsFor += match.homeScore;
    homeTeam.stats.pointsAgainst += match.awayScore;
    awayTeam.stats.pointsFor += match.awayScore;
    awayTeam.stats.pointsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      homeTeam.stats.wins++;
      awayTeam.stats.losses++;
    } else if (match.awayScore > match.homeScore) {
      awayTeam.stats.wins++;
      homeTeam.stats.losses++;
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// checkSeasonPhase
// ---------------------------------------------------------------------------

/**
 * Check if the season should transition phases.
 * If all regular season matches are complete and no playoff bracket
 * exists, generates one.
 *
 * @param {object} league - League object
 * @returns {object} Updated league with potentially new status/playoffBracket
 */
export function checkSeasonPhase(league) {
  // Already completed
  if (league.status === 'completed') return league;

  // Check if all regular season matches are done
  const allComplete = league.schedule.every(m => m.status === 'completed');

  if (!allComplete) {
    // Still in progress
    if (league.status !== 'in-progress') {
      return { ...league, status: 'in-progress' };
    }
    return league;
  }

  // All regular matches done — transition to playoffs
  if (!league.playoffBracket) {
    const bracket = generateBracket(league);
    return { ...league, status: 'playoffs', playoffBracket: bracket };
  }

  // Check if champion is crowned
  if (league.playoffBracket.champion) {
    return { ...league, status: 'completed' };
  }

  // Playoffs in progress
  if (league.status !== 'playoffs') {
    return { ...league, status: 'playoffs' };
  }

  return league;
}

/**
 * Generate a playoff bracket from current standings.
 * Top 4 teams qualify (or 2 if fewer than 4 teams).
 */
function generateBracket(league) {
  // Sort teams by wins desc, then point differential
  const sorted = [...league.teams].sort((a, b) => {
    const aW = a.stats?.wins || 0;
    const bW = b.stats?.wins || 0;
    if (bW !== aW) return bW - aW;
    const aDiff = (a.stats?.pointsFor || 0) - (a.stats?.pointsAgainst || 0);
    const bDiff = (b.stats?.pointsFor || 0) - (b.stats?.pointsAgainst || 0);
    return bDiff - aDiff;
  });

  const teamsInPlayoffs = league.teams.length >= 4 ? 4 : 2;
  const qualifiers = sorted.slice(0, teamsInPlayoffs).map((t, i) => ({
    seed: i + 1,
    teamId: t.id,
    wins: t.stats?.wins || 0,
    losses: t.stats?.losses || 0,
  }));

  // Build bracket rounds
  const rounds = [];

  if (teamsInPlayoffs === 4) {
    // Semifinal: 1v4, 2v3
    rounds.push([
      createMatchup(1, qualifiers[0], qualifiers[3], 1),
      createMatchup(1, qualifiers[1], qualifiers[2], 2),
    ]);
    // Final: TBD
    rounds.push([
      {
        id: `playoff_final`,
        round: 2,
        highSeed: null,
        lowSeed: null,
        homeTeamId: null,
        awayTeamId: null,
        homeTeamSeed: null,
        awayTeamSeed: null,
        status: 'pending',
        winner: null,
        homeScore: null,
        awayScore: null,
      },
    ]);
  } else {
    // Just a final: 1v2
    rounds.push([
      createMatchup(1, qualifiers[0], qualifiers[1], 1),
    ]);
  }

  return {
    bracketSize: teamsInPlayoffs,
    totalRounds: teamsInPlayoffs === 4 ? 2 : 1,
    qualifiers,
    rounds,
    champion: null,
    createdAt: Date.now(),
  };
}

function createMatchup(round, highSeedQ, lowSeedQ, matchNum) {
  return {
    id: `playoff_r${round}_m${matchNum}`,
    round,
    highSeed: highSeedQ.seed,
    lowSeed: lowSeedQ.seed,
    homeTeamId: highSeedQ.teamId, // Higher seed plays at home
    awayTeamId: lowSeedQ.teamId,
    homeTeamSeed: highSeedQ.seed,
    awayTeamSeed: lowSeedQ.seed,
    status: 'scheduled',
    winner: null,
    homeScore: null,
    awayScore: null,
  };
}

// ---------------------------------------------------------------------------
// processPlayoffMatch
// ---------------------------------------------------------------------------

/**
 * Record a playoff match result and advance the bracket.
 *
 * @param {object} league - League object with playoffBracket
 * @param {string} matchupId - ID of the matchup to update
 * @param {{ homeScore: number, awayScore: number }} result
 * @returns {object} Updated league
 */
export function processPlayoffMatch(league, matchupId, result) {
  if (!league.playoffBracket) return league;

  const bracket = JSON.parse(JSON.stringify(league.playoffBracket));

  // Find and update the matchup
  let updatedMatchup = null;
  for (const round of bracket.rounds) {
    for (let i = 0; i < round.length; i++) {
      if (round[i].id === matchupId) {
        round[i] = {
          ...round[i],
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          status: 'completed',
          winner: result.homeScore > result.awayScore ? round[i].homeTeamId : round[i].awayTeamId,
        };
        updatedMatchup = round[i];
        break;
      }
    }
    if (updatedMatchup) break;
  }

  if (!updatedMatchup) return league;

  // Check if we need to advance to next round
  advanceBracket(bracket);

  // Check for champion
  const finalRound = bracket.rounds[bracket.rounds.length - 1];
  const finalMatch = finalRound[0];
  if (finalMatch.status === 'completed' && finalMatch.winner) {
    const championQ = bracket.qualifiers.find(q => q.teamId === finalMatch.winner);
    bracket.champion = {
      teamId: finalMatch.winner,
      seed: championQ?.seed || 0,
    };
  }

  const updated = { ...league, playoffBracket: bracket };

  // If champion crowned, mark season complete
  if (bracket.champion) {
    updated.status = 'completed';
    updated.champion = bracket.champion;
  }

  return updated;
}

/**
 * Populate next-round matchups from completed previous-round results.
 */
function advanceBracket(bracket) {
  for (let r = 0; r < bracket.rounds.length - 1; r++) {
    const currentRound = bracket.rounds[r];
    const nextRound = bracket.rounds[r + 1];

    // All matches in this round must be complete
    const allComplete = currentRound.every(m => m.status === 'completed' && m.winner);
    if (!allComplete) continue;

    // Populate next round matchups (pair winners: [0]vs[1], [2]vs[3], etc.)
    for (let i = 0; i < currentRound.length; i += 2) {
      const nextMatchIdx = Math.floor(i / 2);
      if (nextMatchIdx >= nextRound.length) break;

      const winner1 = currentRound[i];
      const winner2 = currentRound[i + 1];
      if (!winner2) {
        // Odd number of matches — winner1 gets a bye
        nextRound[nextMatchIdx] = {
          ...nextRound[nextMatchIdx],
          homeTeamId: winner1.winner,
          homeTeamSeed: getSeed(bracket, winner1.winner),
          awayTeamId: null,
          awayTeamSeed: null,
          status: 'pending',
          winner: winner1.winner, // Auto-advance
        };
        continue;
      }

      const w1Seed = getSeed(bracket, winner1.winner);
      const w2Seed = getSeed(bracket, winner2.winner);

      // Higher seed (lower number) plays at home
      const homeIsW1 = (w1Seed || 99) <= (w2Seed || 99);

      nextRound[nextMatchIdx] = {
        ...nextRound[nextMatchIdx],
        homeTeamId: homeIsW1 ? winner1.winner : winner2.winner,
        awayTeamId: homeIsW1 ? winner2.winner : winner1.winner,
        homeTeamSeed: homeIsW1 ? w1Seed : w2Seed,
        awayTeamSeed: homeIsW1 ? w2Seed : w1Seed,
        highSeed: Math.min(w1Seed || 99, w2Seed || 99),
        lowSeed: Math.max(w1Seed || 99, w2Seed || 99),
        status: 'scheduled',
      };
    }
  }
}

function getSeed(bracket, teamId) {
  const q = bracket.qualifiers.find(q => q.teamId === teamId);
  return q?.seed || null;
}

// ---------------------------------------------------------------------------
// getNextUserAction
// ---------------------------------------------------------------------------

/**
 * Determine what the user should do next in the league.
 *
 * @param {object} league
 * @param {string} userTeamId
 * @returns {{ type: string, ... }}
 */
export function getNextUserAction(league, userTeamId) {
  if (!league || !userTeamId) return { type: 'waiting' };

  // Season completed
  if (league.status === 'completed') {
    return { type: 'season_complete', champion: league.champion };
  }

  // Playoffs
  if (league.status === 'playoffs' && league.playoffBracket) {
    return getPlayoffAction(league, userTeamId);
  }

  // Regular season — find next unplayed round
  const rounds = getRoundNumbers(league.schedule);

  for (const roundNum of rounds) {
    const roundMatches = league.schedule.filter(m => m.round === roundNum);
    const allComplete = roundMatches.every(m => m.status === 'completed');
    if (allComplete) continue;

    // This round has unplayed matches
    const userMatch = roundMatches.find(
      m => (m.homeTeam === userTeamId || m.awayTeam === userTeamId) && m.status !== 'completed'
    );

    if (userMatch) {
      const oppId = userMatch.homeTeam === userTeamId ? userMatch.awayTeam : userMatch.homeTeam;
      return {
        type: 'play_match',
        round: roundNum,
        matchup: userMatch,
        oppId,
      };
    }

    // User has no match this round (bye or already played)
    const userMatchInRound = roundMatches.find(
      m => m.homeTeam === userTeamId || m.awayTeam === userTeamId
    );
    if (!userMatchInRound) {
      return { type: 'sim_round', round: roundNum };
    }

    // User already played but AI matches remain — auto-sim
    return { type: 'sim_round', round: roundNum };
  }

  // All rounds done — should transition to playoffs
  return { type: 'waiting' };
}

function getPlayoffAction(league, userTeamId) {
  const bracket = league.playoffBracket;

  // Check if user was eliminated
  const userQualified = bracket.qualifiers.some(q => q.teamId === userTeamId);
  if (!userQualified) {
    return { type: 'eliminated' };
  }

  // Find user's next scheduled playoff match
  for (const round of bracket.rounds) {
    for (const matchup of round) {
      if (matchup.status === 'completed') continue;
      if (matchup.status === 'pending') continue;

      // This match is scheduled
      if (matchup.homeTeamId === userTeamId || matchup.awayTeamId === userTeamId) {
        const oppId = matchup.homeTeamId === userTeamId ? matchup.awayTeamId : matchup.homeTeamId;
        return {
          type: 'play_playoff',
          matchup,
          oppId,
        };
      }
    }
  }

  // User might have been knocked out (check completed rounds)
  for (const round of bracket.rounds) {
    for (const matchup of round) {
      if (matchup.status !== 'completed') continue;
      if (matchup.homeTeamId === userTeamId || matchup.awayTeamId === userTeamId) {
        if (matchup.winner !== userTeamId) {
          return { type: 'eliminated' };
        }
      }
    }
  }

  // Pending matches with unresolved participants — need to sim AI playoff matches
  for (const round of bracket.rounds) {
    for (const matchup of round) {
      if (matchup.status === 'scheduled' && matchup.homeTeamId && matchup.awayTeamId) {
        // There's a scheduled match that doesn't involve the user — sim it
        if (matchup.homeTeamId !== userTeamId && matchup.awayTeamId !== userTeamId) {
          return { type: 'sim_playoff', matchup };
        }
      }
    }
  }

  return { type: 'waiting' };
}

function getRoundNumbers(schedule) {
  const rounds = new Set();
  for (const m of schedule) rounds.add(m.round);
  return [...rounds].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// saveLeagueToStorage
// ---------------------------------------------------------------------------

/**
 * Save a league back to AsyncStorage (replaces the existing entry).
 *
 * @param {object} league - League object to save
 */
export async function saveLeagueToStorage(league) {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    const leagues = raw ? JSON.parse(raw) : [];
    const idx = leagues.findIndex(l => l.id === league.id);
    if (idx !== -1) {
      leagues[idx] = league;
    } else {
      leagues.push(league);
    }
    await storage.setItem(STORAGE_KEY, JSON.stringify(leagues));
  } catch (e) {
    console.warn('Failed to save league:', e);
  }
}
