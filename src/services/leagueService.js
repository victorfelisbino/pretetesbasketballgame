/**
 * League Service — Quadra Legacy
 *
 * Unified async API that routes league operations to either localStorage
 * (guest / offline) or Firestore (authenticated users).
 *
 * Every function accepts an `authCtx` parameter:
 *   { isAuthenticated: boolean, user: { uid: string } | null }
 *
 * The list functions return leagues tagged with `backend: 'local' | 'firestore'`
 * so that subsequent calls know which backend to use.
 *
 * All functions are async for consistency (even localStorage ops) so that
 * callers don't need to know which backend is active.
 */

import * as local from '../league/localLeague.js';
import {
  createLeagueWithTeam,
  joinLeagueWithTeam,
  scheduleSeasonMatches,
  getLeagueDashboard,
} from '../firebase/league.js';
import {
  getUserLeagues as firestoreGetUserLeagues,
  getLeague as firestoreGetLeague,
  updateLeague as firestoreUpdateLeague,
} from '../firebase/database.js';

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────
export const BACKEND_LOCAL = 'local';
export const BACKEND_FIRESTORE = 'firestore';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a Firestore league document into the list-view shape expected
 * by LeagueHub (matches the localStorage league shape for the list).
 */
function normalizeFirestoreLeagueForList(doc) {
  return {
    id: doc.id,
    name: doc.name,
    season: doc.season || 1,
    status: normalizeStatus(doc.status),
    teams: (doc.teamIds || []).map(tid => ({ id: tid })),
    maxTeams: doc.maxTeams || 8,
    inviteCode: doc.inviteCode || null,
    createdAt: doc.createdAt,
    backend: BACKEND_FIRESTORE,
  };
}

/**
 * Map Firestore status values to the values the UI understands.
 * Firestore uses: setup, draft, regular, playoffs, offseason, completed
 * UI expects:     setup, in-progress, completed
 */
function normalizeStatus(status) {
  if (!status) return 'setup';
  if (status === 'regular' || status === 'playoffs') return 'in-progress';
  if (status === 'draft') return 'setup';
  if (status === 'offseason' || status === 'completed') return 'completed';
  return status; // pass through setup, in-progress, completed as-is
}

/**
 * Build the full normalised league shape from a Firestore dashboard response.
 * The dashboard already contains: league, season, standings, teams,
 * thisWeekMatches, recentResults, allMatches.
 */
function normalizeFirestoreDashboard(dashboard, userId) {
  const { league, season, standings, teams, allMatches } = dashboard;

  // Build teams array with embedded stats from standings
  const standingsMap = new Map();
  for (const s of standings) {
    standingsMap.set(s.teamId, s);
  }

  const normalizedTeams = teams.map(team => {
    const st = standingsMap.get(team.id) || {
      wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0,
    };
    return {
      id: team.id,
      name: team.name,
      isUserTeam: team.ownerId === userId,
      stats: {
        played: (st.wins || 0) + (st.losses || 0),
        wins: st.wins || 0,
        losses: st.losses || 0,
        pointsFor: st.pointsFor || 0,
        pointsAgainst: st.pointsAgainst || 0,
        fantasyPts: st.fantasyPts || 0,
      },
    };
  });

  // Build a team name lookup for schedule normalisation
  const teamNameMap = new Map();
  for (const t of teams) teamNameMap.set(t.id, t.name);

  // Normalise schedule matches into the shape LeagueView expects
  const normalizedSchedule = (allMatches || []).map(m => ({
    id: m.id,
    round: m.week || 1,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeTeamName: teamNameMap.get(m.homeTeamId) || '?',
    awayTeamName: teamNameMap.get(m.awayTeamId) || '?',
    status: m.status || 'scheduled',
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    playedAt: m.completedAt || null,
  }));

  return {
    id: league.id,
    name: league.name,
    season: league.season || 1,
    status: normalizeStatus(season?.status || league.status),
    teams: normalizedTeams,
    schedule: normalizedSchedule,
    maxTeams: league.maxTeams || 8,
    currentRound: season ? getCurrentRound(normalizedSchedule) : 0,
    inviteCode: league.inviteCode || null,
    backend: BACKEND_FIRESTORE,
    // Keep raw Firestore references for advanced operations
    _firestoreSeasonId: season?.id || null,
    _firestoreTeamIds: league.teamIds || [],
  };
}

function getCurrentRound(schedule) {
  const scheduledRounds = schedule
    .filter(m => m.status === 'scheduled')
    .map(m => m.round);
  return scheduledRounds.length > 0 ? Math.min(...scheduledRounds) : 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get all leagues visible to the user.
 * Guest: localStorage only. Authenticated: Firestore + localStorage.
 *
 * @param {{ isAuthenticated: boolean, user?: { uid: string } }} authCtx
 * @returns {Promise<Array>}
 */
export async function getLeagues(authCtx = {}) {
  const localLeagues = local.getLocalLeagues().map(l => ({
    ...l,
    backend: BACKEND_LOCAL,
  }));

  if (!authCtx.isAuthenticated || !authCtx.user) {
    return localLeagues;
  }

  try {
    const result = await firestoreGetUserLeagues(authCtx.user.uid);
    const firestoreLeagues = (result.data || []).map(normalizeFirestoreLeagueForList);
    return [...firestoreLeagues, ...localLeagues];
  } catch {
    // Firestore unavailable; return local leagues only
    return localLeagues;
  }
}

/**
 * Get a single league with full details (teams, schedule, standings).
 *
 * @param {string} leagueId
 * @param {string} backend  'local' or 'firestore'
 * @param {{ isAuthenticated: boolean, user?: { uid: string } }} authCtx
 * @returns {Promise<object|null>}
 */
export async function getLeague(leagueId, backend, authCtx = {}) {
  if (backend === BACKEND_LOCAL) {
    const league = local.getLocalLeague(leagueId);
    return league ? { ...league, backend: BACKEND_LOCAL } : null;
  }

  // Firestore path
  const result = await getLeagueDashboard(leagueId);
  if (result.error || !result.data) return null;
  return normalizeFirestoreDashboard(result.data, authCtx.user?.uid);
}

/**
 * Create a new league.
 *
 * Guest: creates a localStorage league.
 * Authenticated: creates a Firestore league with a team.
 *
 * @param {{ name: string, maxTeams?: number }} config
 * @param {{ isAuthenticated: boolean, user?: { uid: string } }} authCtx
 * @param {{ name?: string, isUserTeam?: boolean, players?: Array }} userTeamData
 * @returns {Promise<{ id: string, backend: string, inviteCode?: string }>}
 */
export async function createLeague(config, authCtx = {}, userTeamData = null) {
  if (!authCtx.isAuthenticated || !authCtx.user) {
    // Guest: localStorage
    const league = local.createLocalLeague(config);

    if (userTeamData) {
      local.addTeamToLocalLeague(league.id, {
        ...userTeamData,
        isUserTeam: true,
      });
    }

    return { id: league.id, backend: BACKEND_LOCAL };
  }

  // Authenticated: Firestore
  const teamConfig = {
    name: userTeamData?.name || config.name + ' FC',
    city: userTeamData?.city || '',
  };

  const result = await createLeagueWithTeam(authCtx.user.uid, config, teamConfig);
  if (result.error) throw new Error(result.error);

  return {
    id: result.data.leagueId,
    backend: BACKEND_FIRESTORE,
    inviteCode: result.data.inviteCode,
    teamId: result.data.teamId,
    seasonId: result.data.seasonId,
  };
}

/**
 * Delete a league.
 *
 * @param {string} leagueId
 * @param {string} backend
 * @returns {Promise<void>}
 */
export async function deleteLeague(leagueId, backend) {
  if (backend === BACKEND_LOCAL) {
    local.deleteLocalLeague(leagueId);
    return;
  }

  // Firestore: soft-delete by marking status
  await firestoreUpdateLeague(leagueId, { status: 'deleted' });
}

/**
 * Join a Firestore league using an invite code.
 * Only available for authenticated users.
 *
 * @param {string} inviteCode
 * @param {{ name: string, city?: string }} teamConfig
 * @param {{ isAuthenticated: boolean, user: { uid: string } }} authCtx
 * @returns {Promise<{ leagueId: string, teamId: string, leagueName: string }>}
 */
export async function joinLeagueByCode(inviteCode, teamConfig, authCtx) {
  if (!authCtx.isAuthenticated || !authCtx.user) {
    throw new Error('Must be authenticated to join a league by invite code.');
  }

  const result = await joinLeagueWithTeam(authCtx.user.uid, inviteCode, teamConfig);
  if (result.error) throw new Error(result.error);
  return result.data;
}

/**
 * Fill remaining league slots with AI-generated teams.
 *
 * @param {string} leagueId
 * @param {number} count
 * @param {string} backend
 * @returns {Promise<void>}
 */
export async function addAITeams(leagueId, count, backend) {
  if (backend === BACKEND_LOCAL) {
    local.generateAITeams(leagueId, count);
    return;
  }

  // Firestore: AI team generation not yet implemented for online leagues.
  // For Phase 1, throw a clear message.
  throw new Error('AI teams for online leagues will be available in a future update.');
}

/**
 * Generate the round-robin schedule and start the season.
 *
 * @param {string} leagueId
 * @param {string} backend
 * @param {{ _firestoreSeasonId?: string, _firestoreTeamIds?: string[] }} leagueData
 * @returns {Promise<void>}
 */
export async function generateSchedule(leagueId, backend, leagueData = {}) {
  if (backend === BACKEND_LOCAL) {
    local.generateLocalSchedule(leagueId);
    return;
  }

  // Firestore
  const seasonId = leagueData._firestoreSeasonId;
  const teamIds = leagueData._firestoreTeamIds;
  if (!seasonId || !teamIds?.length) {
    throw new Error('Missing season or team data for schedule generation.');
  }

  const result = await scheduleSeasonMatches(leagueId, seasonId, teamIds);
  if (result.error) throw new Error(result.error);
}

/**
 * Get sorted standings for a league.
 *
 * @param {string} leagueId
 * @param {string} backend
 * @returns {Promise<Array>}
 */
export async function getStandings(leagueId, backend, authCtx = {}) {
  if (backend === BACKEND_LOCAL) {
    return local.getLocalStandings(leagueId);
  }

  // Firestore: fetch via dashboard and return standings
  const league = await getLeague(leagueId, backend, authCtx);
  if (!league) return [];

  return [...league.teams].sort((a, b) => {
    if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
    const aDiff = a.stats.pointsFor - a.stats.pointsAgainst;
    const bDiff = b.stats.pointsFor - b.stats.pointsAgainst;
    if (bDiff !== aDiff) return bDiff - aDiff;
    return b.stats.pointsFor - a.stats.pointsFor;
  });
}

/**
 * Get upcoming (scheduled) matches.
 *
 * @param {string} leagueId
 * @param {number} count
 * @param {string} backend
 * @returns {Promise<Array>}
 */
export async function getUpcomingMatches(leagueId, count, backend) {
  if (backend === BACKEND_LOCAL) {
    return local.getLocalUpcomingMatches(leagueId, count);
  }

  // For Firestore, this data comes via getLeague/dashboard; UI caches it.
  return [];
}

/**
 * Get the next match for the user's team.
 *
 * @param {string} leagueId
 * @param {string} backend
 * @returns {Promise<object|null>}
 */
export async function getNextUserMatch(leagueId, backend) {
  if (backend === BACKEND_LOCAL) {
    return local.getNextUserMatch(leagueId);
  }

  // For Firestore, the dashboard provides this -- UI should compute from cached league data.
  return null;
}

/**
 * Start a new season (reset stats, generate new schedule).
 *
 * @param {string} leagueId
 * @param {string} backend
 * @returns {Promise<void>}
 */
export async function startNewSeason(leagueId, backend) {
  if (backend === BACKEND_LOCAL) {
    local.startLocalNewSeason(leagueId);
    return;
  }

  // Firestore new season: not yet implemented for Phase 1.
  throw new Error('Online league new seasons will be available in a future update.');
}
