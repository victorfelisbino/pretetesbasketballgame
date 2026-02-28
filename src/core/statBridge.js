/**
 * Stat Bridge — Quadra Legacy
 *
 * Pure utility module that converts player statistics between three formats:
 *
 *   1. Engine format  – long keys used by gameController.js / matchEngine.js
 *      e.g. { pointsScored, assists, rebounds, steals, blocks, turnovers, fouls, ... }
 *
 *   2. Firestore format – short keys used by the database layer (database.js updateMatchResult)
 *      e.g. { pts, ast, reb, stl, blk, to, fgMade, fgAttempted, ftMade, ftAttempted }
 *
 *   3. Fantasy format – keys expected by calculatePlayerFantasyPoints() in fantasyScoring.js
 *      e.g. { points, assists, rebounds, steals, blocks, turnovers, ... }
 *
 * No dependencies. All functions are deterministic.
 */

// ---------------------------------------------------------------------------
// Mapping tables
// ---------------------------------------------------------------------------

/** Engine long key → Firestore short key */
const ENGINE_TO_FIRESTORE_MAP = {
  pointsScored:      'pts',
  assists:           'ast',
  rebounds:          'reb',
  steals:            'stl',
  blocks:            'blk',
  turnovers:         'to',
  fouls:             'fouls',
  freeThrowsMade:    'ftMade',
  freeThrowsAttempted: 'ftAttempted',
  freethrowsMade:    'ftMade',
  freethrows:        'ftAttempted',
  twoPointMade:      'fgMade2pt',
  twoPointAttempts:  'fgAttempted2pt',
  threePointMade:    'fgMade3pt',
  threePointAttempts: 'fgAttempted3pt',
};

/** Firestore short key → Engine long key */
const FIRESTORE_TO_ENGINE_MAP = {
  pts:           'pointsScored',
  ast:           'assists',
  reb:           'rebounds',
  stl:           'steals',
  blk:           'blocks',
  to:            'turnovers',
  fouls:         'fouls',
  ftMade:        'freeThrowsMade',
  ftAttempted:   'freeThrowsAttempted',
  fgMade2pt:     'twoPointMade',
  fgAttempted2pt: 'twoPointAttempts',
  fgMade3pt:     'threePointMade',
  fgAttempted3pt: 'threePointAttempts',
};

/** Engine long key → Fantasy scoring key */
const ENGINE_TO_FANTASY_MAP = {
  pointsScored: 'points',
  assists:      'assists',
  rebounds:     'rebounds',
  steals:       'steals',
  blocks:       'blocks',
  turnovers:    'turnovers',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely coerce a value to a finite number, defaulting to 0.
 * @param {*} value
 * @returns {number}
 */
function safe(value) {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transform engine long-key player stats to Firestore short-key format.
 *
 * Accepts either a raw engine player object (with nested `stats` property)
 * or a flat stats object with engine keys.
 *
 * @param {object} playerStats - Engine-format stats (flat or nested under .stats)
 * @returns {object} Firestore-format stats with short keys
 *
 * @example
 *   engineToFirestore({ pointsScored: 24, assists: 5, rebounds: 8, steals: 2, blocks: 1 })
 *   // => { pts: 24, ast: 5, reb: 8, stl: 2, blk: 1, to: 0, fouls: 0, ftMade: 0, ftAttempted: 0 }
 */
export function engineToFirestore(playerStats) {
  if (!playerStats || typeof playerStats !== 'object') {
    return {};
  }

  // Support nested engine player objects (player.stats.pointsScored)
  const raw = playerStats.stats && typeof playerStats.stats === 'object'
    ? playerStats.stats
    : playerStats;

  const result = {};

  for (const [engineKey, firestoreKey] of Object.entries(ENGINE_TO_FIRESTORE_MAP)) {
    if (raw[engineKey] !== undefined) {
      result[firestoreKey] = safe(raw[engineKey]);
    }
  }

  // Ensure core keys always exist
  result.pts          = result.pts          ?? safe(raw.pointsScored);
  result.ast          = result.ast          ?? safe(raw.assists);
  result.reb          = result.reb          ?? safe(raw.rebounds);
  result.stl          = result.stl          ?? safe(raw.steals);
  result.blk          = result.blk          ?? safe(raw.blocks);
  result.to           = result.to           ?? safe(raw.turnovers);
  result.fouls        = result.fouls        ?? safe(raw.fouls);
  result.ftMade       = result.ftMade       ?? safe(raw.freeThrowsMade ?? raw.freethrowsMade);
  result.ftAttempted  = result.ftAttempted  ?? safe(raw.freeThrowsAttempted ?? raw.freethrows);

  return result;
}

/**
 * Transform Firestore short-key stats back to engine long-key format.
 *
 * @param {object} firestoreStats - Firestore-format stats with short keys
 * @returns {object} Engine-format stats with long keys
 *
 * @example
 *   firestoreToEngine({ pts: 24, ast: 5, reb: 8, stl: 2, blk: 1 })
 *   // => { pointsScored: 24, assists: 5, rebounds: 8, steals: 2, blocks: 1, turnovers: 0, ... }
 */
export function firestoreToEngine(firestoreStats) {
  if (!firestoreStats || typeof firestoreStats !== 'object') {
    return {};
  }

  const result = {};

  for (const [firestoreKey, engineKey] of Object.entries(FIRESTORE_TO_ENGINE_MAP)) {
    if (firestoreStats[firestoreKey] !== undefined) {
      result[engineKey] = safe(firestoreStats[firestoreKey]);
    }
  }

  // Ensure core keys always exist
  result.pointsScored        = result.pointsScored        ?? safe(firestoreStats.pts);
  result.assists              = result.assists              ?? safe(firestoreStats.ast);
  result.rebounds             = result.rebounds             ?? safe(firestoreStats.reb);
  result.steals               = result.steals               ?? safe(firestoreStats.stl);
  result.blocks               = result.blocks               ?? safe(firestoreStats.blk);
  result.turnovers            = result.turnovers            ?? safe(firestoreStats.to);
  result.fouls                = result.fouls                ?? safe(firestoreStats.fouls);
  result.freeThrowsMade       = result.freeThrowsMade       ?? safe(firestoreStats.ftMade);
  result.freeThrowsAttempted  = result.freeThrowsAttempted  ?? safe(firestoreStats.ftAttempted);

  return result;
}

/**
 * Transform engine long-key stats to the format expected by
 * calculatePlayerFantasyPoints() in fantasyScoring.js.
 *
 * The fantasy system expects `points` (not `pointsScored`), while
 * assists, rebounds, steals, and blocks keep the same key names.
 *
 * Accepts either a raw engine player object (with nested `stats`) or
 * a flat stats object with engine keys.
 *
 * @param {object} playerStats - Engine-format stats
 * @returns {object} Fantasy-format stats
 *
 * @example
 *   engineToFantasy({ pointsScored: 24, assists: 5, rebounds: 8, steals: 2, blocks: 1 })
 *   // => { points: 24, assists: 5, rebounds: 8, steals: 2, blocks: 1, turnovers: 0 }
 */
export function engineToFantasy(playerStats) {
  if (!playerStats || typeof playerStats !== 'object') {
    return {};
  }

  // Support nested engine player objects
  const raw = playerStats.stats && typeof playerStats.stats === 'object'
    ? playerStats.stats
    : playerStats;

  const result = {};

  for (const [engineKey, fantasyKey] of Object.entries(ENGINE_TO_FANTASY_MAP)) {
    result[fantasyKey] = safe(raw[engineKey]);
  }

  // Carry over identity fields if present on the outer object
  if (playerStats.id   !== undefined) result.playerId   = String(playerStats.id);
  if (playerStats.name !== undefined) result.playerName = String(playerStats.name);
  if (playerStats.position !== undefined) result.position = String(playerStats.position);

  return result;
}

/**
 * Take a GameController match summary and return an object of player stat
 * entries in Firestore format, keyed by player name (suitable for passing
 * to updateMatchResult's playerStats parameter).
 *
 * The match summary shape (from GameController._buildSummary() and
 * MatchEngine.getMatchSummary()) contains:
 *   homeTeamStats: [{ name, position, points, assists, rebounds, steals, blocks }]
 *   awayTeamStats: [{ name, position, points, assists, rebounds, steals, blocks }]
 *
 * @param {object} summary - Match summary from GameController or MatchEngine
 * @returns {object} Keyed object { [playerName]: { pts, ast, reb, stl, blk, ... } }
 *
 * @example
 *   const summary = gc.getMatchSummary();
 *   const firestoreStats = normalizeMatchStats(summary);
 *   // firestoreStats => {
 *   //   "LeBron": { pts: 24, ast: 5, reb: 8, stl: 2, blk: 1, to: 0 },
 *   //   ...
 *   // }
 */
export function normalizeMatchStats(summary) {
  if (!summary || typeof summary !== 'object') {
    return {};
  }

  const result = {};
  const allPlayers = [
    ...(summary.homeTeamStats || []),
    ...(summary.awayTeamStats || []),
  ];

  for (const player of allPlayers) {
    if (!player || !player.name) continue;

    // The match summary already maps pointsScored → points,
    // but the player may also come from the engine directly with pointsScored.
    // Handle both cases.
    result[player.name] = {
      pts:   safe(player.points  ?? player.pointsScored),
      ast:   safe(player.assists),
      reb:   safe(player.rebounds),
      stl:   safe(player.steals),
      blk:   safe(player.blocks),
      to:    safe(player.turnovers),
      fouls: safe(player.fouls),
      ftMade:      safe(player.freeThrowsMade  ?? player.ftMade),
      ftAttempted: safe(player.freeThrowsAttempted ?? player.ftAttempted),
      name:     player.name,
      position: player.position || '',
    };
  }

  return result;
}
