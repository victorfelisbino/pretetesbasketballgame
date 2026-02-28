/**
 * Fantasy Scoring Engine — Quadra Legacy
 *
 * Translates match statistics into fantasy points for the Coach × Fantasy
 * hybrid league model described in MOBILE_GAME_MASTER_PLAN.md Section 6.4.
 *
 * This module is intentionally pure: no UI, no Firebase, no React dependencies.
 * All exported functions are deterministic given the same inputs.
 *
 * STAT STRUCTURE NOTE (mismatch with current matchEngine.js):
 *   The canonical playerStats shape used by this module is documented below.
 *   The current player.js/matchEngine.js engine stores stats differently:
 *     - player.stats.pointsScored  → maps to playerStats.points
 *     - player.stats.shots2pt / shots3pt → used to derive fieldGoalsMade / fieldGoalsMissed
 *     - player.stats.freethrows    → single counter only; no made/missed split yet
 *     - turnovers                  → NOT tracked in player.stats at all (only in event log)
 *     - blocks                     → player.stats.blocks exists but addBlock() is never
 *                                    called by matchEngine.js in its current state
 *     - minutesPlayed              → not tracked anywhere in the current engine
 *   Use normalizePlayerStatsFromEngine() to bridge the gap until the engine is updated.
 */

// ---------------------------------------------------------------------------
// Scoring configuration
// ---------------------------------------------------------------------------

/**
 * Default fantasy scoring weights per statistical category.
 * All values express fantasy points earned (positive) or lost (negative)
 * per single occurrence of that statistic.
 *
 * @typedef {Object} ScoringConfig
 * @property {number} points        - Fantasy points per game point scored
 * @property {number} rebounds      - Fantasy points per rebound
 * @property {number} assists       - Fantasy points per assist
 * @property {number} steals        - Fantasy points per steal
 * @property {number} blocks        - Fantasy points per block
 * @property {number} turnovers     - Fantasy points per turnover (negative)
 * @property {number} fgMissed      - Fantasy points per missed field goal (negative)
 * @property {number} ftMade        - Fantasy points per made free throw
 * @property {number} ftMissed      - Fantasy points per missed free throw (negative)
 * @property {number} doubleDouble  - Bonus fantasy points for a double-double
 * @property {number} tripleDouble  - Bonus fantasy points for a triple-double
 */
export const DEFAULT_SCORING_CONFIG = Object.freeze({
  points: 1,
  rebounds: 1.2,
  assists: 1.5,
  steals: 2,
  blocks: 2,
  turnovers: -1,
  fgMissed: -0.5,
  ftMade: 1,
  ftMissed: -0.75,
  doubleDouble: 5,
  tripleDouble: 15
});

/**
 * Pre-built scoring presets for different league commissioner preferences.
 * Any preset can be passed directly as a ScoringConfig or used as a base
 * for further customization via createCustomScoringConfig().
 */
export const SCORING_PRESETS = Object.freeze({
  /**
   * Standard: mirrors the master plan's default table.
   */
  standard: Object.freeze({ ...DEFAULT_SCORING_CONFIG }),

  /**
   * Volume: rewards high-usage players. Heavier weight on points and shots.
   * Field goal misses are penalized less harshly to encourage shot attempts.
   */
  volume: Object.freeze({
    points: 1.5,
    rebounds: 1,
    assists: 1.2,
    steals: 1.5,
    blocks: 1.5,
    turnovers: -1,
    fgMissed: -0.25,
    ftMade: 1,
    ftMissed: -0.5,
    doubleDouble: 5,
    tripleDouble: 12
  }),

  /**
   * All-Around: rewards well-rounded stat lines.
   * Assists and rebounds earn significantly more; double/triple-double bonuses
   * are larger to incentivize complete games.
   */
  allAround: Object.freeze({
    points: 0.8,
    rebounds: 1.8,
    assists: 2,
    steals: 2,
    blocks: 2,
    turnovers: -1,
    fgMissed: -0.5,
    ftMade: 1,
    ftMissed: -0.75,
    doubleDouble: 8,
    tripleDouble: 18
  }),

  /**
   * Defense First: steals and blocks worth 3× the standard rate.
   * Turnovers are penalized more harshly; offensive output is discounted.
   */
  defenseFirst: Object.freeze({
    points: 0.8,
    rebounds: 1.2,
    assists: 1.2,
    steals: 6,
    blocks: 6,
    turnovers: -1.5,
    fgMissed: -0.5,
    ftMade: 0.8,
    ftMissed: -0.75,
    doubleDouble: 5,
    tripleDouble: 15
  })
});

// ---------------------------------------------------------------------------
// Input normalisation
// ---------------------------------------------------------------------------

/**
 * Canonical playerStats shape expected by all scoring functions.
 *
 * @typedef {Object} PlayerStats
 * @property {string} playerId          - Unique player identifier
 * @property {string} playerName        - Display name
 * @property {string} position          - PG | SG | SF | PF | C
 * @property {number} points            - Total game points scored
 * @property {number} rebounds          - Total rebounds (offensive + defensive)
 * @property {number} assists           - Total assists
 * @property {number} steals            - Total steals
 * @property {number} blocks            - Total blocks
 * @property {number} turnovers         - Total turnovers
 * @property {number} fieldGoalsMade    - Total FG made (2pt + 3pt combined)
 * @property {number} fieldGoalsMissed  - Total FG missed (2pt + 3pt combined)
 * @property {number} freeThrowsMade    - Total FT made
 * @property {number} freeThrowsMissed  - Total FT missed
 * @property {number} minutesPlayed     - Minutes played (informational only)
 * @property {boolean} [isStarter]      - Whether player is in the starting lineup
 */

/**
 * Safely coerce a value to a finite number, defaulting to 0 for missing,
 * null, undefined, or non-numeric inputs.
 *
 * @param {*} value
 * @returns {number}
 */
function safe(value) {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

/**
 * Convert a Player instance (or raw player object) produced by the current
 * matchEngine.js / player.js into the canonical PlayerStats shape.
 *
 * Call this once per player after each match before passing stats to any
 * scoring function.
 *
 * Known limitations of the current engine that this adapter handles:
 *   - freethrows is a single counter with no made/missed split. All free
 *     throws are treated as made until the engine tracks the split.
 *   - turnovers are not tracked on the player object; defaults to 0.
 *   - blocks may be 0 even when the player recorded blocks because
 *     matchEngine.js does not call addBlock() in its current state.
 *   - minutesPlayed is not tracked; defaults to 0.
 *
 * @param {Object} enginePlayer - A Player instance or player summary object
 *   from matchEngine.getMatchSummary() or player.getSummary().
 * @returns {PlayerStats}
 */
export function normalizePlayerStatsFromEngine(enginePlayer) {
  if (!enginePlayer || typeof enginePlayer !== 'object') {
    throw new TypeError('normalizePlayerStatsFromEngine: enginePlayer must be an object');
  }

  // Support both raw Player instances (enginePlayer.stats.*) and summary
  // objects returned by matchEngine.getMatchSummary() (flat properties).
  const raw = enginePlayer.stats || enginePlayer;

  // Field goals: support both direct properties and shots2pt/shots3pt objects
  const shots2ptMade    = safe((raw.shots2pt && raw.shots2pt.made)      || 0);
  const shots2ptAtt     = safe((raw.shots2pt && raw.shots2pt.attempted) || 0);
  const shots3ptMade    = safe((raw.shots3pt && raw.shots3pt.made)      || 0);
  const shots3ptAtt     = safe((raw.shots3pt && raw.shots3pt.attempted) || 0);
  const fgMade          = safe(raw.fieldGoalsMade  ?? (shots2ptMade + shots3ptMade));
  const fgAttempted     = safe(raw.fieldGoalsAttempted ?? (shots2ptAtt + shots3ptAtt));
  const fgMissed        = fgAttempted - fgMade;

  // Free throws: engine currently stores only a total count (freethrows) with
  // no made/missed split. Treat total as made until engine is updated.
  const ftTotal         = safe(raw.freethrows ?? 0);
  const ftMade          = safe(raw.freeThrowsMade  ?? ftTotal);
  const ftMissed        = safe(raw.freeThrowsMissed ?? 0);

  return {
    playerId:         String(enginePlayer.id   ?? enginePlayer.playerId   ?? ''),
    playerName:       String(enginePlayer.name ?? enginePlayer.playerName ?? 'Unknown'),
    position:         String(enginePlayer.position ?? 'SF'),
    points:           safe(raw.pointsScored ?? raw.points ?? 0),
    rebounds:         safe(raw.rebounds     ?? 0),
    assists:          safe(raw.assists      ?? 0),
    steals:           safe(raw.steals       ?? 0),
    blocks:           safe(raw.blocks       ?? 0),
    turnovers:        safe(raw.turnovers    ?? 0), // Engine does not track this yet
    fieldGoalsMade:   fgMade,
    fieldGoalsMissed: Math.max(0, fgMissed),
    freeThrowsMade:   ftMade,
    freeThrowsMissed: ftMissed,
    minutesPlayed:    safe(raw.minutesPlayed ?? 0),
    isStarter:        enginePlayer.isStarter !== undefined
                        ? Boolean(enginePlayer.isStarter)
                        : true  // Default: assume starter if not specified
  };
}

/**
 * Aggregate multiple PlayerStats objects for the same player (e.g. across
 * several matches in a week) into a single combined stat line.
 *
 * @param {PlayerStats[]} statsList - Array of single-game stats for one player
 * @returns {PlayerStats} Cumulative stats across all provided games
 */
export function aggregatePlayerStats(statsList) {
  if (!Array.isArray(statsList) || statsList.length === 0) {
    throw new TypeError('aggregatePlayerStats: statsList must be a non-empty array');
  }

  const base = statsList[0];
  const total = {
    playerId:         base.playerId,
    playerName:       base.playerName,
    position:         base.position,
    points:           0,
    rebounds:         0,
    assists:          0,
    steals:           0,
    blocks:           0,
    turnovers:        0,
    fieldGoalsMade:   0,
    fieldGoalsMissed: 0,
    freeThrowsMade:   0,
    freeThrowsMissed: 0,
    minutesPlayed:    0,
    isStarter:        base.isStarter
  };

  for (const s of statsList) {
    total.points           += safe(s.points);
    total.rebounds         += safe(s.rebounds);
    total.assists          += safe(s.assists);
    total.steals           += safe(s.steals);
    total.blocks           += safe(s.blocks);
    total.turnovers        += safe(s.turnovers);
    total.fieldGoalsMade   += safe(s.fieldGoalsMade);
    total.fieldGoalsMissed += safe(s.fieldGoalsMissed);
    total.freeThrowsMade   += safe(s.freeThrowsMade);
    total.freeThrowsMissed += safe(s.freeThrowsMissed);
    total.minutesPlayed    += safe(s.minutesPlayed);
  }

  return total;
}

// ---------------------------------------------------------------------------
// Bonus detectors
// ---------------------------------------------------------------------------

/**
 * Count how many statistical categories have a value of 10 or more.
 * The five tracked categories are: points, rebounds, assists, steals, blocks.
 *
 * @param {PlayerStats} playerStats
 * @returns {number} Count (0–5) of categories with ≥ 10
 */
function countDoubleCategoryQualifiers(playerStats) {
  const categories = [
    safe(playerStats.points),
    safe(playerStats.rebounds),
    safe(playerStats.assists),
    safe(playerStats.steals),
    safe(playerStats.blocks)
  ];
  return categories.filter(v => v >= 10).length;
}

/**
 * Calculate the double-double bonus for a player's stat line.
 * A double-double requires ≥ 10 in exactly two of the five key categories.
 * Note: if a triple-double is also achieved, the double-double bonus does NOT
 * stack — only the triple-double bonus applies.
 *
 * @param {PlayerStats} playerStats
 * @param {ScoringConfig} scoringConfig
 * @returns {number} Bonus fantasy points (0 or config.doubleDouble value)
 */
export function calculateDoubleDoubleBonus(playerStats, scoringConfig) {
  const config  = { ...DEFAULT_SCORING_CONFIG, ...scoringConfig };
  const qualCount = countDoubleCategoryQualifiers(playerStats);
  // Double-double only (not triple or better) — TD replaces DD, it does not stack
  return qualCount === 2 ? safe(config.doubleDouble) : 0;
}

/**
 * Calculate the triple-double bonus for a player's stat line.
 * A triple-double requires ≥ 10 in three or more of the five key categories.
 * When a triple-double is achieved the double-double bonus is NOT also applied.
 *
 * @param {PlayerStats} playerStats
 * @param {ScoringConfig} scoringConfig
 * @returns {number} Bonus fantasy points (0 or config.tripleDouble value)
 */
export function calculateTripleDoubleBonus(playerStats, scoringConfig) {
  const config  = { ...DEFAULT_SCORING_CONFIG, ...scoringConfig };
  const qualCount = countDoubleCategoryQualifiers(playerStats);
  return qualCount >= 3 ? safe(config.tripleDouble) : 0;
}

// ---------------------------------------------------------------------------
// Core scoring
// ---------------------------------------------------------------------------

/**
 * Calculate the complete fantasy point total for a single player's stat line.
 *
 * Double-double and triple-double bonuses are mutually exclusive:
 * if a triple-double is achieved, only the triple-double bonus applies.
 *
 * @param {PlayerStats} playerStats
 * @param {ScoringConfig} [scoringConfig] - Defaults to DEFAULT_SCORING_CONFIG
 * @returns {{
 *   playerId: string,
 *   playerName: string,
 *   totalPoints: number,
 *   breakdown: {
 *     pointsScore: number,
 *     reboundScore: number,
 *     assistScore: number,
 *     stealScore: number,
 *     blockScore: number,
 *     turnoverPenalty: number,
 *     fgMissedPenalty: number,
 *     ftMadeScore: number,
 *     ftMissedPenalty: number,
 *     doubleDoubleBonus: number,
 *     tripleDoubleBonus: number
 *   },
 *   statLine: string
 * }}
 */
export function calculatePlayerFantasyPoints(playerStats, scoringConfig) {
  if (!playerStats || typeof playerStats !== 'object') {
    throw new TypeError('calculatePlayerFantasyPoints: playerStats must be an object');
  }

  const config = { ...DEFAULT_SCORING_CONFIG, ...(scoringConfig || {}) };

  const pts   = safe(playerStats.points);
  const reb   = safe(playerStats.rebounds);
  const ast   = safe(playerStats.assists);
  const stl   = safe(playerStats.steals);
  const blk   = safe(playerStats.blocks);
  const to    = safe(playerStats.turnovers);
  const fgMis = safe(playerStats.fieldGoalsMissed);
  const ftMde = safe(playerStats.freeThrowsMade);
  const ftMis = safe(playerStats.freeThrowsMissed);

  const pointsScore      = pts   * safe(config.points);
  const reboundScore     = reb   * safe(config.rebounds);
  const assistScore      = ast   * safe(config.assists);
  const stealScore       = stl   * safe(config.steals);
  const blockScore       = blk   * safe(config.blocks);
  const turnoverPenalty  = to    * safe(config.turnovers);   // config value is negative
  const fgMissedPenalty  = fgMis * safe(config.fgMissed);   // config value is negative
  const ftMadeScore      = ftMde * safe(config.ftMade);
  const ftMissedPenalty  = ftMis * safe(config.ftMissed);   // config value is negative

  // Double/triple-double bonuses are mutually exclusive (TD replaces DD)
  const qualCount        = countDoubleCategoryQualifiers(playerStats);
  const doubleDoubleBonus = qualCount === 2 ? safe(config.doubleDouble) : 0;
  const tripleDoubleBonus = qualCount >= 3  ? safe(config.tripleDouble) : 0;

  const totalPoints = round2(
    pointsScore    +
    reboundScore   +
    assistScore    +
    stealScore     +
    blockScore     +
    turnoverPenalty +
    fgMissedPenalty +
    ftMadeScore    +
    ftMissedPenalty +
    doubleDoubleBonus +
    tripleDoubleBonus
  );

  const statLine = buildStatLine(playerStats);

  return {
    playerId:    String(playerStats.playerId   || ''),
    playerName:  String(playerStats.playerName || 'Unknown'),
    totalPoints,
    breakdown: {
      pointsScore:      round2(pointsScore),
      reboundScore:     round2(reboundScore),
      assistScore:      round2(assistScore),
      stealScore:       round2(stealScore),
      blockScore:       round2(blockScore),
      turnoverPenalty:  round2(turnoverPenalty),
      fgMissedPenalty:  round2(fgMissedPenalty),
      ftMadeScore:      round2(ftMadeScore),
      ftMissedPenalty:  round2(ftMissedPenalty),
      doubleDoubleBonus,
      tripleDoubleBonus
    },
    statLine
  };
}

/**
 * Calculate fantasy points for an entire team roster (all players).
 *
 * Only players with `isStarter === true` contribute to the team's
 * competitive fantasy total (rosterTotal), but individual breakdowns are
 * produced for every player regardless.
 *
 * @param {PlayerStats[]} allPlayerStats - All players on the roster
 * @param {ScoringConfig} [scoringConfig]
 * @returns {{
 *   rosterTotal: number,
 *   benchTotal: number,
 *   grandTotal: number,
 *   playerBreakdowns: Array<ReturnType<calculatePlayerFantasyPoints>>
 * }}
 */
export function calculateTeamFantasyPoints(allPlayerStats, scoringConfig) {
  if (!Array.isArray(allPlayerStats)) {
    throw new TypeError('calculateTeamFantasyPoints: allPlayerStats must be an array');
  }

  const playerBreakdowns = allPlayerStats.map(ps =>
    calculatePlayerFantasyPoints(ps, scoringConfig)
  );

  let rosterTotal = 0;
  let benchTotal  = 0;

  allPlayerStats.forEach((ps, i) => {
    const fp = playerBreakdowns[i].totalPoints;
    // Default to starter if isStarter is not specified
    if (ps.isStarter !== false) {
      rosterTotal += fp;
    } else {
      benchTotal += fp;
    }
  });

  return {
    rosterTotal:      round2(rosterTotal),
    benchTotal:       round2(benchTotal),
    grandTotal:       round2(rosterTotal + benchTotal),
    playerBreakdowns
  };
}

// ---------------------------------------------------------------------------
// Config management
// ---------------------------------------------------------------------------

/**
 * Create a custom scoring configuration by merging overrides on top of the
 * default scoring config. Validates the merged result before returning.
 *
 * @param {Partial<ScoringConfig>} overrides - Fields to override
 * @returns {ScoringConfig} Fully specified, validated config
 * @throws {Error} if any numeric field is invalid
 */
export function createCustomScoringConfig(overrides) {
  if (overrides && typeof overrides !== 'object') {
    throw new TypeError('createCustomScoringConfig: overrides must be an object');
  }
  const merged = { ...DEFAULT_SCORING_CONFIG, ...(overrides || {}) };
  validateScoringConfig(merged);
  return Object.freeze(merged);
}

/**
 * Validate a scoring configuration object.
 * All required keys must be present and finite numbers.
 *
 * @param {ScoringConfig} config
 * @returns {true} Returns true if valid
 * @throws {Error} describing the first violation found
 */
export function validateScoringConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('validateScoringConfig: config must be a plain object');
  }

  const REQUIRED_KEYS = [
    'points', 'rebounds', 'assists', 'steals', 'blocks',
    'turnovers', 'fgMissed', 'ftMade', 'ftMissed',
    'doubleDouble', 'tripleDouble'
  ];

  for (const key of REQUIRED_KEYS) {
    if (!(key in config)) {
      throw new Error(`validateScoringConfig: missing required key "${key}"`);
    }
    const val = config[key];
    if (typeof val !== 'number' || !isFinite(val)) {
      throw new Error(
        `validateScoringConfig: "${key}" must be a finite number, got ${val}`
      );
    }
  }

  // Sanity guards — warn when likely accidental values are used
  if (config.turnovers > 0) {
    throw new Error('validateScoringConfig: "turnovers" should be negative (penalty)');
  }
  if (config.fgMissed > 0) {
    throw new Error('validateScoringConfig: "fgMissed" should be negative (penalty)');
  }
  if (config.ftMissed > 0) {
    throw new Error('validateScoringConfig: "ftMissed" should be negative (penalty)');
  }
  if (config.doubleDouble < 0) {
    throw new Error('validateScoringConfig: "doubleDouble" should be a non-negative bonus');
  }
  if (config.tripleDouble < 0) {
    throw new Error('validateScoringConfig: "tripleDouble" should be a non-negative bonus');
  }
  if (config.tripleDouble < config.doubleDouble) {
    throw new Error(
      'validateScoringConfig: "tripleDouble" bonus should be ≥ "doubleDouble" bonus'
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// League format calculators
// ---------------------------------------------------------------------------

/**
 * Calculate the result of a single head-to-head matchup between two managers.
 * Both rosters are scored; only players with isStarter !== false contribute.
 *
 * @param {PlayerStats[]} homeRosterStats - Active roster for the home manager
 * @param {PlayerStats[]} awayRosterStats - Active roster for the away manager
 * @param {ScoringConfig} [scoringConfig]
 * @returns {{
 *   homeTotal: number,
 *   awayTotal: number,
 *   winner: 'home' | 'away' | 'tie',
 *   margin: number,
 *   homePlayerBreakdowns: Array,
 *   awayPlayerBreakdowns: Array
 * }}
 */
export function calculateHeadToHeadResult(homeRosterStats, awayRosterStats, scoringConfig) {
  if (!Array.isArray(homeRosterStats) || !Array.isArray(awayRosterStats)) {
    throw new TypeError(
      'calculateHeadToHeadResult: homeRosterStats and awayRosterStats must be arrays'
    );
  }

  const homeResult = calculateTeamFantasyPoints(homeRosterStats, scoringConfig);
  const awayResult = calculateTeamFantasyPoints(awayRosterStats, scoringConfig);

  const homeTotal = homeResult.rosterTotal;
  const awayTotal = awayResult.rosterTotal;
  const margin    = round2(Math.abs(homeTotal - awayTotal));

  let winner;
  if (homeTotal > awayTotal) {
    winner = 'home';
  } else if (awayTotal > homeTotal) {
    winner = 'away';
  } else {
    winner = 'tie';
  }

  return {
    homeTotal,
    awayTotal,
    winner,
    margin,
    homePlayerBreakdowns: homeResult.playerBreakdowns,
    awayPlayerBreakdowns: awayResult.playerBreakdowns
  };
}

/**
 * Calculate Rotisserie (Roto) standings for a set of managers.
 * Each manager is ranked in every stat category; higher stats = better rank.
 * Managers accumulate rank points across all categories; higher total = better
 * standing.
 *
 * Roto categories tracked: points, rebounds, assists, steals, blocks
 * (turnovers rank inverted — fewest turnovers = best rank).
 *
 * @param {Array<{managerId: string, managerName: string, playerStats: PlayerStats[]}>} allManagerStats
 * @param {ScoringConfig} [scoringConfig] - Used to derive fantasy point totals
 * @returns {Array<{
 *   managerId: string,
 *   managerName: string,
 *   totalRankPoints: number,
 *   categoryRanks: Object,
 *   categoryTotals: Object,
 *   fantasyTotal: number,
 *   standing: number
 * }>} Sorted by totalRankPoints descending (rank 1 = best)
 */
export function calculateRotoRankings(allManagerStats, scoringConfig) {
  if (!Array.isArray(allManagerStats) || allManagerStats.length === 0) {
    throw new TypeError('calculateRotoRankings: allManagerStats must be a non-empty array');
  }

  // Aggregate each manager's roster into category totals
  const managerTotals = allManagerStats.map(manager => {
    const roster = Array.isArray(manager.playerStats) ? manager.playerStats : [];
    const totals  = sumRosterCategories(roster);
    const fantasyResult = calculateTeamFantasyPoints(roster, scoringConfig);

    return {
      managerId:    String(manager.managerId   || ''),
      managerName:  String(manager.managerName || 'Manager'),
      categoryTotals: totals,
      fantasyTotal: fantasyResult.rosterTotal
    };
  });

  // Categories and whether higher is better
  const ROTO_CATEGORIES = [
    { key: 'points',    higherIsBetter: true  },
    { key: 'rebounds',  higherIsBetter: true  },
    { key: 'assists',   higherIsBetter: true  },
    { key: 'steals',    higherIsBetter: true  },
    { key: 'blocks',    higherIsBetter: true  },
    { key: 'turnovers', higherIsBetter: false } // fewer turnovers = better rank
  ];

  // Rank each category and assign rank points (N managers → 1st gets N pts)
  const n = managerTotals.length;
  const categoryRanksMap = {};

  for (const cat of ROTO_CATEGORIES) {
    const sorted = [...managerTotals].sort((a, b) => {
      const diff = safe(b.categoryTotals[cat.key]) - safe(a.categoryTotals[cat.key]);
      return cat.higherIsBetter ? diff : -diff;
    });

    sorted.forEach((manager, index) => {
      const rank       = index + 1;
      const rankPoints = n - index; // 1st place = N points, last = 1 point

      if (!categoryRanksMap[manager.managerId]) {
        categoryRanksMap[manager.managerId] = {};
      }
      categoryRanksMap[manager.managerId][cat.key] = { rank, rankPoints };
    });
  }

  // Build final standings
  const standings = managerTotals.map(manager => {
    const ranks       = categoryRanksMap[manager.managerId] || {};
    const totalRankPts = Object.values(ranks)
      .reduce((sum, r) => sum + r.rankPoints, 0);

    return {
      managerId:       manager.managerId,
      managerName:     manager.managerName,
      totalRankPoints: totalRankPts,
      categoryRanks:   ranks,
      categoryTotals:  manager.categoryTotals,
      fantasyTotal:    manager.fantasyTotal,
      standing:        0 // assigned below
    };
  });

  standings.sort((a, b) => b.totalRankPoints - a.totalRankPoints);
  standings.forEach((s, i) => { s.standing = i + 1; });

  return standings;
}

/**
 * Calculate Points League season standings.
 * Each manager's total fantasy points across all weeks/matches are summed;
 * highest total wins.
 *
 * @param {Array<{
 *   managerId: string,
 *   managerName: string,
 *   weeklyStats: PlayerStats[][]  // One PlayerStats[] array per week
 * }>} allManagerSeasonStats
 * @param {ScoringConfig} [scoringConfig]
 * @returns {Array<{
 *   managerId: string,
 *   managerName: string,
 *   seasonTotal: number,
 *   weeklyTotals: number[],
 *   standing: number
 * }>} Sorted by seasonTotal descending
 */
export function calculatePointsLeagueStandings(allManagerSeasonStats, scoringConfig) {
  if (!Array.isArray(allManagerSeasonStats) || allManagerSeasonStats.length === 0) {
    throw new TypeError(
      'calculatePointsLeagueStandings: allManagerSeasonStats must be a non-empty array'
    );
  }

  const results = allManagerSeasonStats.map(manager => {
    const weeks       = Array.isArray(manager.weeklyStats) ? manager.weeklyStats : [];
    const weeklyTotals = weeks.map(weekRoster => {
      const result = calculateTeamFantasyPoints(
        Array.isArray(weekRoster) ? weekRoster : [],
        scoringConfig
      );
      return result.rosterTotal;
    });

    const seasonTotal = round2(weeklyTotals.reduce((sum, w) => sum + w, 0));

    return {
      managerId:    String(manager.managerId   || ''),
      managerName:  String(manager.managerName || 'Manager'),
      seasonTotal,
      weeklyTotals,
      standing:     0 // assigned below
    };
  });

  results.sort((a, b) => b.seasonTotal - a.seasonTotal);
  results.forEach((r, i) => { r.standing = i + 1; });

  return results;
}

// ---------------------------------------------------------------------------
// Weekly matchup
// ---------------------------------------------------------------------------

/**
 * Calculate the outcome of a head-to-head weekly matchup.
 *
 * Each input is an array of "weekly player entries" — objects that contain
 * either pre-aggregated weekly stats OR a `matchStats` array of per-game
 * stat objects to be summed automatically.
 *
 * Only players with `isStarter !== false` contribute to the competitive total.
 *
 * @param {Array<PlayerStats | {isStarter: boolean, matchStats: PlayerStats[]}>} homeRosterStats
 * @param {Array<PlayerStats | {isStarter: boolean, matchStats: PlayerStats[]}>} awayRosterStats
 * @param {ScoringConfig} [scoringConfig]
 * @returns {{
 *   homeTotal: number,
 *   awayTotal: number,
 *   winner: 'home' | 'away' | 'tie',
 *   margin: number,
 *   homePlayerBreakdowns: Array,
 *   awayPlayerBreakdowns: Array,
 *   week: {
 *     homeGamesPlayed: number,
 *     awayGamesPlayed: number
 *   }
 * }}
 */
export function calculateWeeklyMatchup(homeRosterStats, awayRosterStats, scoringConfig) {
  if (!Array.isArray(homeRosterStats) || !Array.isArray(awayRosterStats)) {
    throw new TypeError(
      'calculateWeeklyMatchup: homeRosterStats and awayRosterStats must be arrays'
    );
  }

  // Resolve each entry: if it has matchStats[], aggregate them; otherwise use as-is
  const resolveWeeklyEntry = entry => {
    if (entry && Array.isArray(entry.matchStats) && entry.matchStats.length > 0) {
      const aggregated = aggregatePlayerStats(entry.matchStats);
      // Carry over isStarter / playerId / playerName in case matchStats entries lack them
      aggregated.isStarter  = entry.isStarter !== undefined ? entry.isStarter : true;
      aggregated.playerId   = aggregated.playerId   || String(entry.playerId   || '');
      aggregated.playerName = aggregated.playerName || String(entry.playerName || 'Unknown');
      aggregated.position   = aggregated.position   || String(entry.position   || 'SF');
      return aggregated;
    }
    return entry; // Already in canonical PlayerStats shape
  };

  const homeResolved = homeRosterStats.map(resolveWeeklyEntry);
  const awayResolved = awayRosterStats.map(resolveWeeklyEntry);

  const base = calculateHeadToHeadResult(homeResolved, awayResolved, scoringConfig);

  // Count games played (a player who played at least 1 minute or has stats > 0)
  const gamesPlayed = entries =>
    entries.reduce((max, e) => {
      const games = safe(e.gamesPlayed) ||
        (Array.isArray(e.matchStats) ? e.matchStats.length : 1);
      return Math.max(max, games);
    }, 0);

  return {
    ...base,
    week: {
      homeGamesPlayed: gamesPlayed(homeRosterStats),
      awayGamesPlayed: gamesPlayed(awayRosterStats)
    }
  };
}

// ---------------------------------------------------------------------------
// Score summary / display helpers
// ---------------------------------------------------------------------------

/**
 * Generate a concise human-readable fantasy score summary for a single player.
 *
 * @param {PlayerStats} playerStats
 * @param {ScoringConfig} [scoringConfig]
 * @returns {{
 *   summary: string,     // e.g. "LeBron James: 47.3 FP | 24pts/8reb/5ast/2stl/1blk"
 *   totalPoints: number,
 *   breakdown: Object,
 *   statLine: string,
 *   bonuses: string[]    // e.g. ["Triple-Double (+15)"]
 * }}
 */
export function generateFantasyScoreSummary(playerStats, scoringConfig) {
  if (!playerStats || typeof playerStats !== 'object') {
    throw new TypeError('generateFantasyScoreSummary: playerStats must be an object');
  }

  const result   = calculatePlayerFantasyPoints(playerStats, scoringConfig);
  const bonuses  = [];

  if (result.breakdown.tripleDoubleBonus > 0) {
    bonuses.push(`Triple-Double (+${result.breakdown.tripleDoubleBonus})`);
  } else if (result.breakdown.doubleDoubleBonus > 0) {
    bonuses.push(`Double-Double (+${result.breakdown.doubleDoubleBonus})`);
  }

  const bonusStr  = bonuses.length > 0 ? ` [${bonuses.join(', ')}]` : '';
  const summary   = `${result.playerName}: ${result.totalPoints} FP | ${result.statLine}${bonusStr}`;

  return {
    summary,
    totalPoints: result.totalPoints,
    breakdown:   result.breakdown,
    statLine:    result.statLine,
    bonuses
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Round a number to 2 decimal places to avoid floating-point noise.
 * @param {number} n
 * @returns {number}
 */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Build a compact stat-line string such as "24pts/8reb/5ast/2stl/1blk".
 * Zero-value categories are omitted for readability.
 *
 * @param {PlayerStats} playerStats
 * @returns {string}
 */
function buildStatLine(playerStats) {
  const pts  = safe(playerStats.points);
  const reb  = safe(playerStats.rebounds);
  const ast  = safe(playerStats.assists);
  const stl  = safe(playerStats.steals);
  const blk  = safe(playerStats.blocks);
  const to   = safe(playerStats.turnovers);

  const parts = [];
  parts.push(`${pts}pts`);
  if (reb > 0)  parts.push(`${reb}reb`);
  if (ast > 0)  parts.push(`${ast}ast`);
  if (stl > 0)  parts.push(`${stl}stl`);
  if (blk > 0)  parts.push(`${blk}blk`);
  if (to  > 0)  parts.push(`${to}to`);

  return parts.join('/');
}

/**
 * Sum a roster's counting stats for Roto category ranking.
 *
 * @param {PlayerStats[]} rosterStats
 * @returns {{ points, rebounds, assists, steals, blocks, turnovers }}
 */
function sumRosterCategories(rosterStats) {
  const totals = {
    points: 0, rebounds: 0, assists: 0,
    steals: 0, blocks: 0, turnovers: 0
  };

  for (const ps of rosterStats) {
    if (ps.isStarter === false) continue; // bench players excluded
    totals.points    += safe(ps.points);
    totals.rebounds  += safe(ps.rebounds);
    totals.assists   += safe(ps.assists);
    totals.steals    += safe(ps.steals);
    totals.blocks    += safe(ps.blocks);
    totals.turnovers += safe(ps.turnovers);
  }

  return totals;
}
