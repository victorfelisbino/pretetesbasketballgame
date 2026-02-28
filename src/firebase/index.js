/**
 * Firebase barrel export — Quadra Legacy
 *
 * Re-exports only the functions that actually exist in the backing modules.
 * This file is the single import entry point for all Firebase functionality.
 *
 * ARCHITECTURE NOTE (Issue 1 fix):
 *   The previous version re-exported 20+ functions that did not exist in
 *   auth.js, database.js, or league.js, causing silent runtime failures in
 *   AuthContext.jsx (getUserData) and any other callers. This version is
 *   synchronised with the actual exports as of 2026-02-27.
 */

// ── Config ──────────────────────────────────────────────────────────────────
export { auth, db } from './config.js';

// ── Auth ────────────────────────────────────────────────────────────────────
export {
  // Canonical API (new names)
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  getCurrentUser,
  onAuthStateChange,
  updateUserProfile,
  getUserData,

  // Legacy aliases kept for backwards compatibility with older call sites
  signUp,
  signIn,
  logOut,
  onAuthChange,
} from './auth.js';

// ── Database — Users ─────────────────────────────────────────────────────────
export {
  createUserDocument,
  getUserDocument,
  updateUserDocument,
  updateUserStats,
} from './database.js';

// ── Database — Teams & Players ───────────────────────────────────────────────
export {
  createTeam,
  getTeam,
  updateTeam,
  getUserTeams,
  addPlayerToTeam,
  removePlayerFromTeam,
  createPlayer,
  getPlayer,
  updatePlayer,
  getTeamPlayers,
  getFreeAgents,
} from './database.js';

// ── Database — Leagues ───────────────────────────────────────────────────────
export {
  createLeague,
  getLeague,
  getLeagueByInviteCode,
  joinLeague,
  getUserLeagues,
  updateLeague,
  generateInviteCode,
} from './database.js';

// ── Database — Matches ───────────────────────────────────────────────────────
export {
  createMatch,
  getMatch,
  updateMatchResult,
  getLeagueMatches,
  getTeamMatches,
  subscribeToMatch,
} from './database.js';

// ── Database — Seasons ───────────────────────────────────────────────────────
export {
  createSeason,
  getSeason,
  getLeagueSeason,
  updateSeasonStandings,
  updateSeasonStatus,
  appendSeasonWeek,
} from './database.js';

// ── League — Higher-level orchestration ──────────────────────────────────────
export {
  createLeagueWithTeam,
  joinLeagueWithTeam,
  scheduleSeasonMatches,
  processMatchResult,
  getLeagueDashboard,
} from './league.js';
