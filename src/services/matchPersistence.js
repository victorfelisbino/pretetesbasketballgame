/**
 * Match Persistence Service — Quadra Legacy
 *
 * Handles post-match result persistence across storage backends:
 *   - localStorage (always, for guest/offline play via localLeague.js)
 *   - Firestore (when authenticated, for career stat tracking)
 *
 * This module is a thin orchestration layer that calls the existing
 * localLeague and firebase modules. It is the single entry point
 * that App.jsx uses for match result persistence.
 *
 * Dependencies:
 *   - localLeague.js — recordLocalMatchResult (localStorage)
 *   - firebase/database.js — updateUserStats (Firestore)
 *   - core/statBridge.js — normalizeMatchStats (format conversion)
 */

import { recordLocalMatchResult } from '../league/localLeague.js';
import { normalizeMatchStats } from '../core/statBridge.js';

/**
 * Persist a completed match result to all applicable backends.
 *
 * Always saves to localStorage for league tracking.
 * When the user is authenticated, also saves career stats to Firestore.
 *
 * @param {object} params
 * @param {object}       params.result        — Match result from GameController
 *                                               { homeTeam, awayTeam, score, winner,
 *                                                 homeTeamStats, awayTeamStats }
 * @param {object|null}  params.matchInfo     — League match info (null for quick matches)
 *                                               { leagueId, matchId, homeTeam, awayTeam }
 * @param {boolean}      params.isAuthenticated — Whether the user is logged in
 * @param {object|null}  params.user          — Firebase user object (has .uid)
 * @param {string|null}  params.userTeamName  — Name of the user's team (for win/loss detection)
 * @param {Function|null} params.updateUserStatsFn — Firestore updateUserStats function
 *                                                    (injected to keep this module testable
 *                                                     without importing Firebase directly)
 *
 * @returns {Promise<{ localSaved: boolean, firestoreSaved: boolean, error: string|null }>}
 */
export async function persistMatchResult({
  result,
  matchInfo = null,
  isAuthenticated = false,
  user = null,
  userTeamName = null,
  updateUserStatsFn = null,
}) {
  const outcome = {
    localSaved: false,
    firestoreSaved: false,
    error: null,
  };

  // --- 1. Save to localStorage (league matches only) ---
  if (matchInfo && matchInfo.leagueId && matchInfo.matchId && result.score) {
    try {
      const scores = parseScore(result.score);
      if (scores) {
        recordLocalMatchResult(matchInfo.leagueId, matchInfo.matchId, scores.home, scores.away);
        outcome.localSaved = true;
      }
    } catch (err) {
      console.error('[matchPersistence] localStorage save error:', err);
      outcome.error = err.message;
    }
  }

  // --- 2. Save career stats to Firestore (authenticated users only) ---
  if (isAuthenticated && user && user.uid && updateUserStatsFn) {
    try {
      const userWon = detectUserWin(result, userTeamName);
      const statsUpdate = {
        totalWins:   userWon === true  ? 1 : 0,
        totalLosses: userWon === false ? 1 : 0,
      };

      await updateUserStatsFn(user.uid, statsUpdate);
      outcome.firestoreSaved = true;
    } catch (err) {
      console.error('[matchPersistence] Firestore save error:', err);
      outcome.error = (outcome.error ? outcome.error + '; ' : '') + err.message;
    }
  }

  return outcome;
}

/**
 * Parse a "homeScore - awayScore" string into numbers.
 * Returns null if the format is invalid.
 *
 * @param {string} scoreString — e.g. "102 - 98"
 * @returns {{ home: number, away: number } | null}
 */
export function parseScore(scoreString) {
  if (!scoreString || typeof scoreString !== 'string') return null;
  const parts = scoreString.split(' - ');
  if (parts.length !== 2) return null;
  const home = parseInt(parts[0], 10);
  const away = parseInt(parts[1], 10);
  if (isNaN(home) || isNaN(away)) return null;
  return { home, away };
}

/**
 * Detect whether the user's team won the match.
 *
 * @param {object} result       — Match result with .winner and .homeTeam / .awayTeam
 * @param {string|null} userTeamName — Name of the user's team
 * @returns {boolean|null} true = win, false = loss, null = can't determine
 */
export function detectUserWin(result, userTeamName) {
  if (!result || !userTeamName) return null;
  if (result.winner === 'TIE') return null;
  return result.winner === userTeamName;
}

/**
 * Format match stats from a GameController summary into Firestore-ready format.
 * Thin wrapper around statBridge.normalizeMatchStats for convenience.
 *
 * @param {object} summary — GameController match summary
 * @returns {object} { [playerName]: { pts, ast, reb, stl, blk, ... } }
 */
export function formatMatchStatsForFirestore(summary) {
  return normalizeMatchStats(summary);
}
