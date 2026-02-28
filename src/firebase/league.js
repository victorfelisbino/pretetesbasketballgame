/**
 * Higher-Level League Operations — Quadra Legacy
 *
 * These functions combine multiple Firestore writes (sometimes in a single
 * batch) to implement the major league lifecycle events:
 *
 *   createLeagueWithTeam   — atomic league + team creation
 *   joinLeagueWithTeam     — find league by code, create team, join
 *   scheduleSeasonMatches  — generate round-robin schedule and persist it
 *   processMatchResult     — save result + update standings + career stats
 *   getLeagueDashboard     — one-shot fetch of everything the UI needs
 *
 * All functions return { data } / { error } envelopes consistent with
 * the rest of the backend layer.
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { db } from './config.js';
import {
  createLeague,
  createTeam,
  joinLeague,
  createMatch,
  createSeason,
  getSeason,
  getLeagueSeason,
  updateMatchResult,
  updateSeasonStandings,
  getLeagueMatches,
  getLeague,
  appendSeasonWeek,
  updateLeague,
} from './database.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function guard(fn) {
  try {
    const result = await fn();
    return { data: result };
  } catch (err) {
    console.error('[league]', err);
    return { error: err.message || 'Erro na operação de liga.' };
  }
}

/**
 * Calculate fantasy points for a single player's game stats.
 * Uses the scoringConfig stored on the league.
 *
 * @param {{ pts, reb, ast, stl, blk, to, fgMade, fgAttempted, ftMade, ftAttempted }} stats
 * @param {object} cfg  League scoringConfig
 * @returns {number}
 */
function calcFantasyPts(stats, cfg) {
  let pts = 0;

  pts += (stats.pts  || 0) * cfg.points;
  pts += (stats.reb  || 0) * cfg.rebounds;
  pts += (stats.ast  || 0) * cfg.assists;
  pts += (stats.stl  || 0) * cfg.steals;
  pts += (stats.blk  || 0) * cfg.blocks;
  pts += (stats.to   || 0) * cfg.turnovers;    // negative

  const fgMissed = (stats.fgAttempted || 0) - (stats.fgMade || 0);
  pts += fgMissed * cfg.fgMissed;              // negative

  pts += (stats.ftMade    || 0) * cfg.ftMade;
  const ftMissed = (stats.ftAttempted || 0) - (stats.ftMade || 0);
  pts += ftMissed * cfg.ftMissed;              // negative

  // Double-double / triple-double bonus
  const doubleCategories = [
    stats.pts  >= 10 ? 1 : 0,
    stats.reb  >= 10 ? 1 : 0,
    stats.ast  >= 10 ? 1 : 0,
    stats.stl  >= 10 ? 1 : 0,
    stats.blk  >= 10 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  if (doubleCategories >= 3) pts += cfg.tripleDouble;
  else if (doubleCategories >= 2) pts += cfg.doubleDouble;

  return Math.round(pts * 100) / 100;
}

/**
 * Build a fresh standings entry for a team.
 * @param {string} teamId
 */
function emptyStandingsEntry(teamId) {
  return { teamId, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 };
}

// ---------------------------------------------------------------------------
// createLeagueWithTeam
// ---------------------------------------------------------------------------

/**
 * Atomically create a league and a team, then link them together.
 *
 * @param {string} userId      The user becoming commissioner + team owner
 * @param {{ name: string, draftType?: string, fantasyMode?: string, maxTeams?: number }} leagueConfig
 * @param {{ name: string, city?: string, colorPrimary?: string, colorSecondary?: string }} teamConfig
 *
 * @returns {Promise<{ data: { leagueId, inviteCode, teamId, seasonId } } | { error: string }>}
 */
export async function createLeagueWithTeam(userId, leagueConfig, teamConfig) {
  return guard(async () => {
    // 1. Create the league document
    const leagueResult = await createLeague(leagueConfig, userId);
    if (leagueResult.error) throw new Error(leagueResult.error);
    const { leagueId, inviteCode } = leagueResult.data;

    // 2. Create the team document (pre-linked to the league)
    const teamResult = await createTeam({
      ...teamConfig,
      ownerId:  userId,
      leagueId: leagueId,
    });
    if (teamResult.error) throw new Error(teamResult.error);
    const teamId = teamResult.data;

    // 3. A single batch to tie everything together
    const batch = writeBatch(db);

    // Add teamId to league.teamIds and the owner to memberIds
    batch.update(doc(db, 'leagues', leagueId), {
      teamIds:   [teamId],
      memberIds: [userId],
      updatedAt: serverTimestamp(),
    });

    // Back-link team → league (already set in createTeam, but confirm via batch)
    batch.update(doc(db, 'teams', teamId), {
      leagueId:  leagueId,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    // 4. Create Season 1 for the league
    const seasonResult = await createSeason({
      leagueId,
      number: 1,
      status: 'draft',
    });
    if (seasonResult.error) throw new Error(seasonResult.error);
    const seasonId = seasonResult.data;

    // 5. Store the current seasonId reference in the league document
    await updateDoc(doc(db, 'leagues', leagueId), {
      currentSeasonId: seasonId,
      updatedAt:       serverTimestamp(),
    });

    return { leagueId, inviteCode, teamId, seasonId };
  });
}

// ---------------------------------------------------------------------------
// joinLeagueWithTeam
// ---------------------------------------------------------------------------

/**
 * Find a league by invite code, create a team for the user, and join.
 * Returns an error if the league does not exist or is already full.
 *
 * @param {string} userId
 * @param {string} inviteCode  6-character invite code (case-insensitive)
 * @param {{ name: string, city?: string, colorPrimary?: string, colorSecondary?: string }} teamConfig
 *
 * @returns {Promise<{ data: { leagueId, teamId, leagueName, inviteCode } } | { error: string }>}
 */
export async function joinLeagueWithTeam(userId, inviteCode, teamConfig) {
  return guard(async () => {
    // 1. Find the league
    const normalized = inviteCode.toUpperCase().trim();
    const leaguesQ   = query(
      collection(db, 'leagues'),
      where('inviteCode', '==', normalized),
    );
    const snap = await getDocs(leaguesQ);
    if (snap.empty) throw new Error('Liga não encontrada. Verifique o código de convite.');

    const leagueDoc  = snap.docs[0];
    const leagueId   = leagueDoc.id;
    const league     = leagueDoc.data();

    // 2. Guard: league must not be full
    if (league.teamIds && league.teamIds.length >= (league.maxTeams || 8)) {
      throw new Error('Esta liga já está cheia.');
    }

    // 3. Guard: user must not already be a member
    if (league.memberIds && league.memberIds.includes(userId)) {
      throw new Error('Você já é membro desta liga.');
    }

    // 4. Create the team
    const teamResult = await createTeam({
      ...teamConfig,
      ownerId:  userId,
      leagueId: leagueId,
    });
    if (teamResult.error) throw new Error(teamResult.error);
    const teamId = teamResult.data;

    // 5. Join the league (updates teamIds, memberIds, and back-links team)
    const joinResult = await joinLeague(leagueId, teamId, userId);
    if (joinResult.error) throw new Error(joinResult.error);

    return {
      leagueId,
      teamId,
      leagueName:  league.name,
      inviteCode:  league.inviteCode,
      season:      league.season,
    };
  });
}

// ---------------------------------------------------------------------------
// scheduleSeasonMatches
// ---------------------------------------------------------------------------

/**
 * Generate a full round-robin schedule (each team plays every other team
 * twice — once at home, once away) and persist match documents.
 *
 * The season's `schedule` array is populated with:
 *   [{ week: number, matchIds: string[] }, ...]
 *
 * Works with 2 to 12 teams.  Adds a bye slot when teamIds.length is odd.
 *
 * @param {string}   leagueId
 * @param {string}   seasonId
 * @param {string[]} teamIds   Array of teamId strings to schedule
 *
 * @returns {Promise<{ data: { totalMatches: number, totalWeeks: number } } | { error: string }>}
 */
export async function scheduleSeasonMatches(leagueId, seasonId, teamIds) {
  return guard(async () => {
    if (!teamIds || teamIds.length < 2) {
      throw new Error('São necessários pelo menos 2 times para gerar a tabela.');
    }

    // Fetch the league to get season number for match documents
    const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
    if (!leagueSnap.exists()) throw new Error('Liga não encontrada.');
    const { season: seasonNumber } = leagueSnap.data();

    // Pad to even number with a bye slot
    const slots = [...teamIds];
    if (slots.length % 2 !== 0) slots.push(null); // bye

    const n         = slots.length;
    const numRounds = (n - 1) * 2;                // home + away legs
    const halfLeg   = n - 1;

    const weekMap = new Map(); // week (1-based) => matchId[]

    // Round-robin algorithm (circle method)
    for (let round = 0; round < numRounds; round++) {
      const week         = round + 1;
      const isSecondLeg  = round >= halfLeg;
      const adjustedRnd  = isSecondLeg ? round - halfLeg : round;

      const matchIds = [];

      for (let i = 0; i < n / 2; i++) {
        const idxA = (i + adjustedRnd) % (n - 1);
        const idxB = (n - 1 - i + adjustedRnd) % (n - 1);

        // Pin last slot
        let homeSlot = i === 0 ? n - 1 : idxA;
        let awaySlot = i === 0 ? idxA  : idxB;

        // Flip home/away in second leg
        if (isSecondLeg) [homeSlot, awaySlot] = [awaySlot, homeSlot];

        const homeTeamId = slots[homeSlot];
        const awayTeamId = slots[awaySlot];

        // Skip bye matches
        if (!homeTeamId || !awayTeamId) continue;

        const matchResult = await createMatch({
          leagueId,
          homeTeamId,
          awayTeamId,
          season: seasonNumber,
          week,
        });
        if (matchResult.error) throw new Error(matchResult.error);
        matchIds.push(matchResult.data);
      }

      if (matchIds.length > 0) {
        weekMap.set(week, matchIds);
      }
    }

    // Persist the schedule inside the season document
    const scheduleEntries = [];
    for (const [week, matchIds] of weekMap.entries()) {
      scheduleEntries.push({ week, matchIds });
      await appendSeasonWeek(seasonId, { week, matchIds });
    }

    // Initialise standings with one entry per team (all zeros)
    const standings = teamIds.map(emptyStandingsEntry);
    await updateSeasonStandings(seasonId, standings);

    // Update season status to 'regular'
    await updateDoc(doc(db, 'seasons', seasonId), {
      status:    'regular',
      updatedAt: serverTimestamp(),
    });

    const totalMatches = scheduleEntries.reduce((sum, w) => sum + w.matchIds.length, 0);
    return { totalMatches, totalWeeks: weekMap.size };
  });
}

// ---------------------------------------------------------------------------
// processMatchResult
// ---------------------------------------------------------------------------

/**
 * Persist a completed match result and propagate the consequences:
 *   1. Write scores, playerStats, events to the match document.
 *   2. Update the season standings (wins / losses / pointsFor / pointsAgainst).
 *   3. Increment each player's career stats.
 *   4. Increment the winning/losing user's all-time stats.
 *
 * playerStats: { [playerId]: { pts, reb, ast, stl, blk, to, fgMade, fgAttempted, ftMade, ftAttempted } }
 * events:      [{ type, playerId, result, quarter, time }]
 *
 * @param {string} matchId
 * @param {number} homeScore
 * @param {number} awayScore
 * @param {object} playerStats
 * @param {Array}  [events]
 *
 * @returns {Promise<{ data: { fantasyPts: object } } | { error: string }>}
 */
export async function processMatchResult(matchId, homeScore, awayScore, playerStats, events = []) {
  return guard(async () => {
    // ---- 1. Read match to get league/season context -------------------
    const matchSnap = await getDoc(doc(db, 'matches', matchId));
    if (!matchSnap.exists()) throw new Error('Partida não encontrada.');
    const match = matchSnap.data();

    const { leagueId, homeTeamId, awayTeamId, season: seasonNumber } = match;

    // ---- 2. Read league for scoringConfig and commissioner info ------
    const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
    if (!leagueSnap.exists()) throw new Error('Liga não encontrada.');
    const league = leagueSnap.data();
    const cfg    = league.scoringConfig;

    // ---- 3. Calculate fantasy points per player ----------------------
    const fantasyPts = {};
    if (playerStats && cfg) {
      for (const [pid, stats] of Object.entries(playerStats)) {
        fantasyPts[pid] = calcFantasyPts(stats, cfg);
      }
    }

    // ---- 4. Write the match result -----------------------------------
    const resultUpdate = await updateMatchResult(matchId, homeScore, awayScore, playerStats, events);
    if (resultUpdate.error) throw new Error(resultUpdate.error);

    // ---- 5. Find and update season standings -------------------------
    const seasonResult = await getLeagueSeason(leagueId, seasonNumber);
    if (!seasonResult.error && seasonResult.data) {
      const seasonId       = seasonResult.data.id;
      const standings      = seasonResult.data.standings || [];
      const homeWins       = homeScore > awayScore;
      const awayWins       = awayScore > homeScore;

      // Calculate total fantasy points for each side this match
      const homePlayers = Object.entries(playerStats || {})
        .filter(([pid]) => fantasyPts[pid] !== undefined);

      // We need to know which players belong to which team.
      // For now, fetch team player lists from the sub-collection snapshot.
      const [homePlayersSnap, awayPlayersSnap] = await Promise.all([
        getDocs(collection(db, 'teams', homeTeamId, 'players')),
        getDocs(collection(db, 'teams', awayTeamId, 'players')),
      ]);
      const homePlayerIds = new Set(homePlayersSnap.docs.map(d => d.id));
      const awayPlayerIds = new Set(awayPlayersSnap.docs.map(d => d.id));

      const homeFP = Object.entries(fantasyPts)
        .filter(([pid]) => homePlayerIds.has(pid))
        .reduce((s, [, v]) => s + v, 0);
      const awayFP = Object.entries(fantasyPts)
        .filter(([pid]) => awayPlayerIds.has(pid))
        .reduce((s, [, v]) => s + v, 0);

      const updated = standings.map(entry => {
        if (entry.teamId === homeTeamId) {
          return {
            ...entry,
            wins:          entry.wins          + (homeWins ? 1 : 0),
            losses:        entry.losses        + (awayWins ? 1 : 0),
            pointsFor:     entry.pointsFor     + homeScore,
            pointsAgainst: entry.pointsAgainst + awayScore,
            fantasyPts:    Math.round((entry.fantasyPts + homeFP) * 100) / 100,
          };
        }
        if (entry.teamId === awayTeamId) {
          return {
            ...entry,
            wins:          entry.wins          + (awayWins ? 1 : 0),
            losses:        entry.losses        + (homeWins ? 1 : 0),
            pointsFor:     entry.pointsFor     + awayScore,
            pointsAgainst: entry.pointsAgainst + homeScore,
            fantasyPts:    Math.round((entry.fantasyPts + awayFP) * 100) / 100,
          };
        }
        return entry;
      });

      await updateSeasonStandings(seasonId, updated);
    }

    // ---- 6. Update career stats for every player --------------------
    if (playerStats) {
      const batch = writeBatch(db);
      for (const [pid, stats] of Object.entries(playerStats)) {
        const playerRef = doc(db, 'players', pid);
        batch.update(playerRef, {
          'career.totalPoints':   increment(stats.pts  || 0),
          'career.totalRebounds': increment(stats.reb  || 0),
          'career.totalAssists':  increment(stats.ast  || 0),
          'career.totalSteals':   increment(stats.stl  || 0),
          'career.totalBlocks':   increment(stats.blk  || 0),
          xp:        increment(Math.floor((stats.pts || 0) + (stats.reb || 0) + (stats.ast || 0))),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // ---- 7. Update user (owner) win/loss stats -----------------------
    // Fetch both teams to get ownerId
    const [homeTeamSnap, awayTeamSnap] = await Promise.all([
      getDoc(doc(db, 'teams', homeTeamId)),
      getDoc(doc(db, 'teams', awayTeamId)),
    ]);

    const homeOwnerId = homeTeamSnap.exists() ? homeTeamSnap.data().ownerId : null;
    const awayOwnerId = awayTeamSnap.exists() ? awayTeamSnap.data().ownerId : null;

    const userBatch = writeBatch(db);

    if (homeOwnerId) {
      userBatch.update(doc(db, 'users', homeOwnerId), {
        'stats.totalWins':   increment(homeScore > awayScore ? 1 : 0),
        'stats.totalLosses': increment(homeScore < awayScore ? 1 : 0),
      });
    }
    if (awayOwnerId && awayOwnerId !== homeOwnerId) {
      userBatch.update(doc(db, 'users', awayOwnerId), {
        'stats.totalWins':   increment(awayScore > homeScore ? 1 : 0),
        'stats.totalLosses': increment(awayScore < homeScore ? 1 : 0),
      });
    }
    await userBatch.commit();

    return { fantasyPts };
  });
}

// ---------------------------------------------------------------------------
// getLeagueDashboard
// ---------------------------------------------------------------------------

/**
 * One-shot dashboard fetch.  Returns everything the League UI needs:
 *   league         — the league document
 *   season         — the current season document (or null)
 *   standings      — sorted standings array from the current season
 *   teams          — all team documents in the league
 *   thisWeekMatches — matches for the current week (scheduled or completed)
 *   recentResults  — last 5 completed matches
 *
 * @param {string} leagueId
 * @returns {Promise<{ data: object } | { error: string }>}
 */
export async function getLeagueDashboard(leagueId) {
  return guard(async () => {
    // 1. League document
    const leagueSnap = await getDoc(doc(db, 'leagues', leagueId));
    if (!leagueSnap.exists()) throw new Error('Liga não encontrada.');
    const league = { id: leagueSnap.id, ...leagueSnap.data() };

    // 2. Current season
    const seasonResult = await getLeagueSeason(leagueId, league.season || 1);
    const season       = seasonResult.data || null;

    // 3. Standings (already sorted by wins desc, then point differential desc)
    const standings    = season ? [...(season.standings || [])].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aDiff = (a.pointsFor || 0) - (a.pointsAgainst || 0);
      const bDiff = (b.pointsFor || 0) - (b.pointsAgainst || 0);
      if (bDiff !== aDiff) return bDiff - aDiff;
      return (b.fantasyPts || 0) - (a.fantasyPts || 0);
    }) : [];

    // 4. All team documents
    const teamIds  = league.teamIds || [];
    const teamsArr = await Promise.all(
      teamIds.map(tid => getDoc(doc(db, 'teams', tid)))
    );
    const teams = teamsArr
      .filter(s => s.exists())
      .map(s => ({ id: s.id, ...s.data() }));

    // 5. All matches for this league × current season
    let allMatches     = [];
    let thisWeekMatches = [];
    let recentResults  = [];

    const matchesResult = await getLeagueMatches(leagueId, league.season);
    if (!matchesResult.error) {
      allMatches = matchesResult.data;

      // Determine "current week" = lowest week number that still has scheduled matches
      const scheduledWeeks = allMatches
        .filter(m => m.status === 'scheduled')
        .map(m => m.week);
      const currentWeek    = scheduledWeeks.length > 0 ? Math.min(...scheduledWeeks) : null;

      thisWeekMatches = currentWeek !== null
        ? allMatches.filter(m => m.week === currentWeek)
        : [];

      recentResults = allMatches
        .filter(m => m.status === 'completed')
        .sort((a, b) => (b.week ?? 0) - (a.week ?? 0))
        .slice(0, 5);
    }

    return {
      league,
      season,
      standings,
      teams,
      thisWeekMatches,
      recentResults,
      allMatches,
    };
  });
}
