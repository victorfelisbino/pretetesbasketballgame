/**
 * Firestore CRUD Layer — Quadra Legacy
 *
 * Implements the canonical six top-level collections defined in the
 * MOBILE_GAME_MASTER_PLAN.md Section 8.2 schema:
 *
 *   users/{userId}
 *   teams/{teamId}          (players/ sub-collection stores playerIds)
 *   players/{playerId}
 *   leagues/{leagueId}
 *   matches/{matchId}
 *   seasons/{seasonId}
 *
 * All async functions return:
 *   { data: <result> }   on success
 *   { error: string }    on failure
 *
 * This module is client-side only (no Admin SDK).
 * Firestore offline persistence is enabled in config.js.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './config.js';
import { DEFAULT_SCORING_CONFIG } from '../core/fantasyScoring.js';

// ===========================================================================
// Internal helpers
// ===========================================================================

/**
 * Generate a 6-character uppercase invite code.
 * Excludes visually ambiguous characters: 0, O, I, L.
 */
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Wrap a Firestore operation and return a consistent { data } / { error } envelope.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ data: T } | { error: string }>}
 */
async function guard(fn) {
  try {
    const result = await fn();
    return { data: result };
  } catch (err) {
    console.error('[db]', err);
    return { error: err.message || 'Erro ao acessar o banco de dados.' };
  }
}

// ===========================================================================
// USERS
// ===========================================================================

/**
 * Create (or overwrite) a user document.
 *
 * @param {string} userId
 * @param {{ displayName: string, email: string, photoURL?: string }} data
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function createUserDocument(userId, data) {
  return guard(async () => {
    await setDoc(doc(db, 'users', userId), {
      displayName:  data.displayName || 'Técnico',
      email:        data.email       || '',
      photoURL:     data.photoURL    || null,
      createdAt:    serverTimestamp(),
      stats: {
        totalWins:         0,
        totalLosses:       0,
        fantasyPtsAllTime: 0,
      },
    });
  });
}

/**
 * Read a user document.
 *
 * @param {string} userId
 * @returns {Promise<{ data: object } | { error: string }>}
 */
export async function getUserDocument(userId) {
  return guard(async () => {
    const snapshot = await getDoc(doc(db, 'users', userId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  });
}

/**
 * Partial update of a user document.
 *
 * @param {string} userId
 * @param {object} data
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updateUserDocument(userId, data) {
  return guard(async () => {
    await updateDoc(doc(db, 'users', userId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Atomically increment user stats (wins / losses / fantasyPtsAllTime).
 * Only fields supplied are incremented; others are untouched.
 *
 * @param {string} userId
 * @param {{ totalWins?: number, totalLosses?: number, fantasyPtsAllTime?: number }} statsUpdate
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updateUserStats(userId, statsUpdate) {
  return guard(async () => {
    const updates = {};
    if (statsUpdate.totalWins        !== undefined) updates['stats.totalWins']         = increment(statsUpdate.totalWins);
    if (statsUpdate.totalLosses      !== undefined) updates['stats.totalLosses']       = increment(statsUpdate.totalLosses);
    if (statsUpdate.fantasyPtsAllTime !== undefined) updates['stats.fantasyPtsAllTime'] = increment(statsUpdate.fantasyPtsAllTime);
    if (Object.keys(updates).length === 0) return;
    await updateDoc(doc(db, 'users', userId), updates);
  });
}

// ===========================================================================
// TEAMS
// ===========================================================================

/**
 * Create a new team document and return its auto-generated teamId.
 *
 * @param {{ ownerId: string, name: string, city?: string, colorPrimary?: string, colorSecondary?: string, leagueId?: string }} teamData
 * @returns {Promise<{ data: string } | { error: string }>}  teamId
 */
export async function createTeam(teamData) {
  return guard(async () => {
    const ref = await addDoc(collection(db, 'teams'), {
      ownerId:        teamData.ownerId,
      name:           teamData.name,
      city:           teamData.city           || '',
      colorPrimary:   teamData.colorPrimary   || '#FF6B35',
      colorSecondary: teamData.colorSecondary || '#1A1A2E',
      leagueId:       teamData.leagueId       || null,
      season:         teamData.season         || 1,
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
    });
    return ref.id;
  });
}

/**
 * Read a single team document.
 *
 * @param {string} teamId
 * @returns {Promise<{ data: object | null } | { error: string }>}
 */
export async function getTeam(teamId) {
  return guard(async () => {
    const snapshot = await getDoc(doc(db, 'teams', teamId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  });
}

/**
 * Partial update of a team document.
 *
 * @param {string} teamId
 * @param {object} data
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updateTeam(teamId, data) {
  return guard(async () => {
    await updateDoc(doc(db, 'teams', teamId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Fetch all teams owned by a user.
 *
 * @param {string} userId
 * @returns {Promise<{ data: object[] } | { error: string }>}
 */
export async function getUserTeams(userId) {
  return guard(async () => {
    const q = query(
      collection(db, 'teams'),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/**
 * Link a player to a team:
 *  1. Sets player.teamId to teamId in the top-level players collection.
 *  2. Creates a minimal reference document inside teams/{teamId}/players/{playerId}.
 *
 * @param {string} teamId
 * @param {string} playerId
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function addPlayerToTeam(teamId, playerId) {
  return guard(async () => {
    const batch = writeBatch(db);

    // Update the player's teamId in the top-level collection
    batch.update(doc(db, 'players', playerId), {
      teamId:    teamId,
      updatedAt: serverTimestamp(),
    });

    // Write a reference document inside the team's sub-collection
    batch.set(doc(db, 'teams', teamId, 'players', playerId), {
      playerId,
      addedAt: serverTimestamp(),
    });

    await batch.commit();
  });
}

/**
 * Unlink a player from a team.
 *
 * @param {string} teamId
 * @param {string} playerId
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function removePlayerFromTeam(teamId, playerId) {
  return guard(async () => {
    const batch = writeBatch(db);

    batch.update(doc(db, 'players', playerId), {
      teamId:    null,
      updatedAt: serverTimestamp(),
    });

    batch.delete(doc(db, 'teams', teamId, 'players', playerId));

    await batch.commit();
  });
}

// ===========================================================================
// PLAYERS
// ===========================================================================

/**
 * Create a new player document.
 *
 * Expected shape of playerData (all optional fields have defaults):
 * {
 *   teamId, name, age, position, archetype, nationality, hometown,
 *   height_cm, weight_kg, dominantHand,
 *   attributes: { Attack, Defense, ThreePoint, FieldGoal, FieldGoalPaint,
 *                 FieldGoalMidRange, DunkLayup, FreeThrow, Passing,
 *                 StealMarking, Blocking, Stamina, Chemistry, Morale },
 *   d20attrs: { Dribble, StealMarkingD20 },
 *   potential, salary, xp,
 *   career: { seasons, totalPoints, totalRebounds, totalAssists,
 *             totalSteals, totalBlocks }
 * }
 *
 * @param {object} playerData
 * @returns {Promise<{ data: string } | { error: string }>}  playerId
 */
export async function createPlayer(playerData) {
  return guard(async () => {
    const ref = await addDoc(collection(db, 'players'), {
      teamId:       playerData.teamId       || null,
      leagueId:     playerData.leagueId     || null,
      name:         playerData.name         || 'Jogador',
      age:          playerData.age          || 22,
      position:     playerData.position     || 'PG',
      archetype:    playerData.archetype    || 'Scorer',
      nationality:  playerData.nationality  || 'Brasileiro',
      hometown:     playerData.hometown     || '',
      height_cm:    playerData.height_cm    || 185,
      weight_kg:    playerData.weight_kg    || 85,
      dominantHand: playerData.dominantHand || 'Right',
      attributes: {
        Attack:             playerData.attributes?.Attack             ?? 50,
        Defense:            playerData.attributes?.Defense            ?? 50,
        ThreePoint:         playerData.attributes?.ThreePoint         ?? 50,
        FieldGoal:          playerData.attributes?.FieldGoal          ?? 50,
        FieldGoalPaint:     playerData.attributes?.FieldGoalPaint     ?? 50,
        FieldGoalMidRange:  playerData.attributes?.FieldGoalMidRange  ?? 50,
        DunkLayup:          playerData.attributes?.DunkLayup          ?? 50,
        FreeThrow:          playerData.attributes?.FreeThrow          ?? 70,
        Passing:            playerData.attributes?.Passing            ?? 50,
        StealMarking:       playerData.attributes?.StealMarking       ?? 50,
        Blocking:           playerData.attributes?.Blocking           ?? 50,
        Stamina:            playerData.attributes?.Stamina            ?? 70,
        Chemistry:          playerData.attributes?.Chemistry          ?? 60,
        Morale:             playerData.attributes?.Morale             ?? 60,
      },
      d20attrs: {
        Dribble:          playerData.d20attrs?.Dribble          ?? 10,
        StealMarkingD20:  playerData.d20attrs?.StealMarkingD20  ?? 10,
      },
      potential: playerData.potential ?? 70,
      salary:    playerData.salary    ?? 1000000,
      xp:        playerData.xp        ?? 0,
      career: {
        seasons:       playerData.career?.seasons       ?? 0,
        totalPoints:   playerData.career?.totalPoints   ?? 0,
        totalRebounds: playerData.career?.totalRebounds ?? 0,
        totalAssists:  playerData.career?.totalAssists  ?? 0,
        totalSteals:   playerData.career?.totalSteals   ?? 0,
        totalBlocks:   playerData.career?.totalBlocks   ?? 0,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  });
}

/**
 * Read a single player document.
 *
 * @param {string} playerId
 * @returns {Promise<{ data: object | null } | { error: string }>}
 */
export async function getPlayer(playerId) {
  return guard(async () => {
    const snapshot = await getDoc(doc(db, 'players', playerId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  });
}

/**
 * Partial update of a player document.
 *
 * @param {string} playerId
 * @param {object} data
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updatePlayer(playerId, data) {
  return guard(async () => {
    await updateDoc(doc(db, 'players', playerId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Fetch all players belonging to a team.
 *
 * @param {string} teamId
 * @returns {Promise<{ data: object[] } | { error: string }>}
 */
export async function getTeamPlayers(teamId) {
  return guard(async () => {
    const q = query(
      collection(db, 'players'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/**
 * Fetch free agents in a given league (players with no team).
 *
 * @param {string} leagueId
 * @returns {Promise<{ data: object[] } | { error: string }>}
 */
export async function getFreeAgents(leagueId) {
  return guard(async () => {
    const q = query(
      collection(db, 'players'),
      where('leagueId', '==', leagueId),
      where('teamId', '==', null),
      orderBy('attributes.Attack', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

// ===========================================================================
// LEAGUES
// ===========================================================================

/**
 * Create a new league. Returns { leagueId, inviteCode }.
 *
 * @param {object} leagueData  { name, draftType?, fantasyMode?, scoringConfig?, maxTeams? }
 * @param {string} commissionerId
 * @returns {Promise<{ data: { leagueId: string, inviteCode: string } } | { error: string }>}
 */
export async function createLeague(leagueData, commissionerId) {
  return guard(async () => {
    const inviteCode = generateInviteCode();
    const ref = await addDoc(collection(db, 'leagues'), {
      name:          leagueData.name,
      inviteCode,
      commissionerId,
      draftType:     leagueData.draftType   || 'snake',
      fantasyMode:   leagueData.fantasyMode  || 'headToHead',
      scoringConfig: leagueData.scoringConfig || DEFAULT_SCORING_CONFIG,
      teamIds:       [],
      memberIds:     [commissionerId],   // for fast membership queries
      maxTeams:      leagueData.maxTeams || 8,
      season:        1,
      status:        'setup',
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    });
    return { leagueId: ref.id, inviteCode };
  });
}

/**
 * Read a single league document.
 *
 * @param {string} leagueId
 * @returns {Promise<{ data: object | null } | { error: string }>}
 */
export async function getLeague(leagueId) {
  return guard(async () => {
    const snapshot = await getDoc(doc(db, 'leagues', leagueId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  });
}

/**
 * Find a league by its invite code (case-insensitive).
 *
 * @param {string} inviteCode
 * @returns {Promise<{ data: object | null } | { error: string }>}
 */
export async function getLeagueByInviteCode(inviteCode) {
  return guard(async () => {
    const normalized = inviteCode.toUpperCase().trim();
    const q = query(
      collection(db, 'leagues'),
      where('inviteCode', '==', normalized),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  });
}

/**
 * Add a team to a league (links teamId into teamIds array, adds userId to memberIds).
 *
 * @param {string} leagueId
 * @param {string} teamId
 * @param {string} [userId]  Owner of the joining team (for memberIds index)
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function joinLeague(leagueId, teamId, userId) {
  return guard(async () => {
    const updates = {
      teamIds:   arrayUnion(teamId),
      updatedAt: serverTimestamp(),
    };
    if (userId) updates.memberIds = arrayUnion(userId);

    await updateDoc(doc(db, 'leagues', leagueId), updates);

    // Back-link team → league
    await updateDoc(doc(db, 'teams', teamId), {
      leagueId:  leagueId,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Fetch all leagues where the user is commissioner OR a member.
 * We run two queries and merge the results (deduplicated by id).
 *
 * @param {string} userId
 * @returns {Promise<{ data: object[] } | { error: string }>}
 */
export async function getUserLeagues(userId) {
  return guard(async () => {
    const [commSnap, memberSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'leagues'),
        where('commissionerId', '==', userId),
        orderBy('createdAt', 'desc')
      )),
      getDocs(query(
        collection(db, 'leagues'),
        where('memberIds', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      )),
    ]);

    const seen = new Set();
    const leagues = [];

    for (const d of [...commSnap.docs, ...memberSnap.docs]) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        leagues.push({ id: d.id, ...d.data() });
      }
    }

    return leagues;
  });
}

/**
 * Partial update of a league document.
 *
 * @param {string} leagueId
 * @param {object} data
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updateLeague(leagueId, data) {
  return guard(async () => {
    await updateDoc(doc(db, 'leagues', leagueId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  });
}

// ===========================================================================
// MATCHES
// ===========================================================================

/**
 * Create a scheduled match document.
 *
 * @param {{ leagueId, homeTeamId, awayTeamId, season, week, scheduledAt? }} matchData
 * @returns {Promise<{ data: string } | { error: string }>}  matchId
 */
export async function createMatch(matchData) {
  return guard(async () => {
    const ref = await addDoc(collection(db, 'matches'), {
      leagueId:    matchData.leagueId,
      homeTeamId:  matchData.homeTeamId,
      awayTeamId:  matchData.awayTeamId,
      homeScore:   null,
      awayScore:   null,
      status:      'scheduled',
      season:      matchData.season   || 1,
      week:        matchData.week     || 1,
      events:      [],
      playerStats: {},
      scheduledAt: matchData.scheduledAt || serverTimestamp(),
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });
    return ref.id;
  });
}

/**
 * Read a single match document.
 *
 * @param {string} matchId
 * @returns {Promise<{ data: object | null } | { error: string }>}
 */
export async function getMatch(matchId) {
  return guard(async () => {
    const snapshot = await getDoc(doc(db, 'matches', matchId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  });
}

/**
 * Persist the result of a completed match.
 *
 * playerStats shape: { [playerId]: { pts, reb, ast, stl, blk, to, fgMade, fgAttempted, ftMade, ftAttempted } }
 * events shape:      [{ type, playerId, result, quarter, time, timestamp }]
 *
 * @param {string}  matchId
 * @param {number}  homeScore
 * @param {number}  awayScore
 * @param {object}  playerStats
 * @param {Array}   events
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updateMatchResult(matchId, homeScore, awayScore, playerStats, events) {
  return guard(async () => {
    await updateDoc(doc(db, 'matches', matchId), {
      homeScore,
      awayScore,
      status:      'completed',
      playerStats: playerStats || {},
      events:      events      || [],
      completedAt: serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });
  });
}

/**
 * Get all matches for a league, optionally filtered by season.
 *
 * @param {string}  leagueId
 * @param {number}  [season]
 * @returns {Promise<{ data: object[] } | { error: string }>}
 */
export async function getLeagueMatches(leagueId, season) {
  return guard(async () => {
    const constraints = [where('leagueId', '==', leagueId)];
    if (season !== undefined) constraints.push(where('season', '==', season));
    constraints.push(orderBy('week', 'asc'));

    const q = query(collection(db, 'matches'), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/**
 * Get all matches (home or away) for a team, optionally filtered by season.
 *
 * Firestore does not support OR queries on different fields in a single query,
 * so we run two queries and merge the results.
 *
 * @param {string}  teamId
 * @param {number}  [season]
 * @returns {Promise<{ data: object[] } | { error: string }>}
 */
export async function getTeamMatches(teamId, season) {
  return guard(async () => {
    const seasonConstraints = season !== undefined ? [where('season', '==', season)] : [];

    const [homeSnap, awaySnap] = await Promise.all([
      getDocs(query(
        collection(db, 'matches'),
        where('homeTeamId', '==', teamId),
        ...seasonConstraints,
        orderBy('week', 'asc')
      )),
      getDocs(query(
        collection(db, 'matches'),
        where('awayTeamId', '==', teamId),
        ...seasonConstraints,
        orderBy('week', 'asc')
      )),
    ]);

    const all = [...homeSnap.docs, ...awaySnap.docs]
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.week ?? 0) - (b.week ?? 0));

    return all;
  });
}

/**
 * Subscribe to real-time updates for a single match.
 * Returns an unsubscribe function.
 *
 * The callback receives:
 *   { data: matchObject }  when the match exists
 *   { error: string }      on Firestore error
 *
 * @param {string}   matchId
 * @param {Function} callback
 * @returns {() => void}  Unsubscribe function
 */
export function subscribeToMatch(matchId, callback) {
  const matchRef = doc(db, 'matches', matchId);
  return onSnapshot(
    matchRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ data: { id: snapshot.id, ...snapshot.data() } });
      } else {
        callback({ data: null });
      }
    },
    (err) => {
      console.error('[db] subscribeToMatch error:', err);
      callback({ error: err.message });
    }
  );
}

// ===========================================================================
// SEASONS
// ===========================================================================

/**
 * Create a new season document.
 *
 * @param {{ leagueId: string, number: number, status?: string }} seasonData
 * @returns {Promise<{ data: string } | { error: string }>}  seasonId
 */
export async function createSeason(seasonData) {
  return guard(async () => {
    const ref = await addDoc(collection(db, 'seasons'), {
      leagueId:  seasonData.leagueId,
      number:    seasonData.number    || 1,
      status:    seasonData.status    || 'draft',
      schedule:  [],
      standings: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  });
}

/**
 * Read a single season document by its Firestore ID.
 *
 * @param {string} seasonId
 * @returns {Promise<{ data: object | null } | { error: string }>}
 */
export async function getSeason(seasonId) {
  return guard(async () => {
    const snapshot = await getDoc(doc(db, 'seasons', seasonId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  });
}

/**
 * Find a season by leagueId + season number.
 *
 * @param {string} leagueId
 * @param {number} seasonNumber
 * @returns {Promise<{ data: object | null } | { error: string }>}
 */
export async function getLeagueSeason(leagueId, seasonNumber) {
  return guard(async () => {
    const q = query(
      collection(db, 'seasons'),
      where('leagueId', '==', leagueId),
      where('number',   '==', seasonNumber),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  });
}

/**
 * Replace the standings array in a season document.
 * standings: [{ teamId, wins, losses, fantasyPts, pointsFor, pointsAgainst }]
 *
 * @param {string} seasonId
 * @param {Array}  standings
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updateSeasonStandings(seasonId, standings) {
  return guard(async () => {
    await updateDoc(doc(db, 'seasons', seasonId), {
      standings,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Transition a season to a new status.
 * Valid values: 'draft' | 'regular' | 'playoffs' | 'offseason'
 *
 * @param {string} seasonId
 * @param {string} status
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function updateSeasonStatus(seasonId, status) {
  return guard(async () => {
    await updateDoc(doc(db, 'seasons', seasonId), {
      status,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Append a week entry to the season schedule field.
 * schedule entries: { week: number, matchIds: string[] }
 *
 * @param {string} seasonId
 * @param {{ week: number, matchIds: string[] }} weekEntry
 * @returns {Promise<{ data: void } | { error: string }>}
 */
export async function appendSeasonWeek(seasonId, weekEntry) {
  return guard(async () => {
    // We read, mutate, and write because Firestore arrayUnion doesn't merge objects by key.
    const snap = await getDoc(doc(db, 'seasons', seasonId));
    if (!snap.exists()) throw new Error('Season not found');

    const current = snap.data().schedule || [];
    const updated  = [...current, weekEntry];

    await updateDoc(doc(db, 'seasons', seasonId), {
      schedule:  updated,
      updatedAt: serverTimestamp(),
    });
  });
}
