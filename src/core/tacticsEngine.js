/**
 * Tactics Engine — Quadra Legacy
 *
 * Implements the Coaching / Tactics Layer from MOBILE_GAME_MASTER_PLAN.md
 * Section 6.3. Provides play-style and defensive-scheme modifiers that can
 * be injected into actionResolver.js as multiplier maps.
 *
 * This module is intentionally pure: no UI, no Firebase, no React dependencies.
 * All exported functions are deterministic given the same inputs.
 *
 * ATTRIBUTE SCALE NOTE:
 *   The full attribute system spec'd in Section 6.1 (Attack, Defense,
 *   Chemistry, etc.) uses a 1–99 scale. The current player.js uses a 1–5
 *   skillLevel instead. All functions below read the 1–99 attributes when
 *   present and fall back to deriving approximate values from skillLevel so
 *   that the tactics engine works with both the existing and future engine.
 *
 *   Mapping used for fallback:  attr1to99 ≈ skillLevel * 18 + 10   (range 28–100, clamped to 99)
 *   Chemistry fallback:          skillLevel * 15 + 10               (range 25–85)
 */

// ---------------------------------------------------------------------------
// Play Styles
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PlayStyleConfig
 * @property {string}  id                 - Machine identifier
 * @property {string}  label              - Human-readable name
 * @property {string}  description        - Short description for UI
 * @property {number}  possessionSpeedMod - Multiplier offset on possession speed (+/-)
 * @property {number}  shootingMod        - Multiplier offset on base shooting % (+/-)
 * @property {number}  threePointVolume   - Multiplier offset on 3pt shot frequency (+/-)
 * @property {number}  paintScoring       - Multiplier offset on paint-scoring rate (+/-)
 * @property {number}  starUsageMod       - Multiplier offset on star player usage (+/-)
 * @property {number}  chemistryMod       - Multiplier offset on team chemistry bonus (+/-)
 * @property {number}  pgSgFantasyMod     - Fantasy point multiplier offset for PG/SG (+/-)
 * @property {number}  cfFantasyMod       - Fantasy point multiplier offset for C/PF (+/-)
 */

/**
 * All available play styles, keyed by canonical identifier.
 * Modifier values are additive offsets on a base multiplier of 1.0.
 * Example: shootingMod of +0.15 means shooting = base * (1 + 0.15)
 */
export const PLAY_STYLES = Object.freeze({
  /**
   * TRANSITION / FAST BREAK
   * Push the pace; sacrifice half-court efficiency for quick baskets.
   * Rewards stamina-heavy rosters; penalizes slow-footed big men.
   */
  TRANSITION: Object.freeze({
    id:                'TRANSITION',
    label:             'Transition / Fast Break',
    description:       'Push the pace. More possessions, less half-court efficiency.',
    possessionSpeedMod: +0.2,
    shootingMod:        -0.1,
    threePointVolume:   0,
    paintScoring:       0,
    starUsageMod:       0,
    chemistryMod:       0,
    pgSgFantasyMod:     +0.1,  // Guards benefit from fast-break opportunities
    cfFantasyMod:       -0.05  // Bigs less involved in transition
  }),

  /**
   * HALF-COURT OFFENSE
   * Patient, methodical attack. Higher shot quality; fewer rushed attempts.
   * Useful when outmatched athletically.
   */
  HALF_COURT: Object.freeze({
    id:                'HALF_COURT',
    label:             'Half-Court Offense',
    description:       'Set up plays deliberately. Higher shot quality, fewer transitions.',
    possessionSpeedMod: -0.1,
    shootingMod:        +0.15,
    threePointVolume:   0,
    paintScoring:       +0.1,
    starUsageMod:       0,
    chemistryMod:       +0.05, // Teamwork-friendly style
    pgSgFantasyMod:     0,
    cfFantasyMod:       +0.05
  }),

  /**
   * ISOLATION
   * Channel the ball to your best offensive player and clear space.
   * Star benefits; team chemistry suffers because teammates are sidelined.
   */
  ISOLATION: Object.freeze({
    id:                'ISOLATION',
    label:             'Isolation',
    description:       'Let your star player go one-on-one. High ceiling, low floor.',
    possessionSpeedMod: 0,
    shootingMod:        0,
    threePointVolume:   0,
    paintScoring:       0,
    starUsageMod:       +0.3,  // Star player gets 30% more offensive opportunities
    chemistryMod:       -0.1,  // Teammates disengaged
    pgSgFantasyMod:     0,
    cfFantasyMod:       0
  }),

  /**
   * SPREAD / 3-POINT HEAVY
   * Space the floor; attack the perimeter. Boom-or-bust scoring.
   * Vulnerable inside if 3s are not falling.
   */
  SPREAD_3PT: Object.freeze({
    id:                'SPREAD_3PT',
    label:             'Spread / 3-Point Heavy',
    description:       'Space the floor and attack from deep. High-variance offense.',
    possessionSpeedMod: 0,
    shootingMod:        +0.05, // Slightly better shots from open spacing
    threePointVolume:   +0.4,  // 40% more three-point attempts
    paintScoring:       -0.3,  // Less emphasis inside
    starUsageMod:       0,
    chemistryMod:       0,
    pgSgFantasyMod:     +0.15, // Guards / wings get more shot volume
    cfFantasyMod:       -0.2   // Traditional bigs see fewer scoring touches
  }),

  /**
   * POST UP
   * Feed the paint; grind out two-point opportunities via post play.
   * Centers and power forwards shine; perimeter players see reduced usage.
   */
  POST_UP: Object.freeze({
    id:                'POST_UP',
    label:             'Post Up',
    description:       'Play through your big men in the paint. Physicality wins.',
    possessionSpeedMod: -0.05,
    shootingMod:        +0.05,
    threePointVolume:   -0.2,
    paintScoring:       +0.3,  // Big men get significantly more touches
    starUsageMod:       0,
    chemistryMod:       0,
    pgSgFantasyMod:     -0.2,  // Guards see fewer touches
    cfFantasyMod:       +0.2   // Centers / power forwards thrive
  })
});

// ---------------------------------------------------------------------------
// Defensive Schemes
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DefensiveSchemeConfig
 * @property {string}  id                   - Machine identifier
 * @property {string}  label                - Human-readable name
 * @property {string}  description          - Short description for UI
 * @property {number}  stealRateMod         - Multiplier offset on steal probability (+/-)
 * @property {number}  threePointAllowedMod - Multiplier offset on opponent 3pt success (+/-)
 * @property {number}  reboundMod           - Multiplier offset on defensive rebound rate (+/-)
 * @property {number}  turnoverRateMod      - Multiplier offset on opponent turnover rate (+/-)
 * @property {number}  staminaCostMod       - Multiplier offset on per-possession stamina cost (+/-)
 * @property {number}  forceFTRate          - Probability of fouling opponent C intentionally (0–1)
 * @property {string}  riskLevel            - 'low' | 'medium' | 'high'
 */

/**
 * All available defensive schemes, keyed by canonical identifier.
 */
export const DEFENSIVE_SCHEMES = Object.freeze({
  /**
   * MAN-TO-MAN
   * Each defender is assigned to a specific offensive player.
   * Best steal opportunities; slightly porous on weak-side 3s;
   * can get out-rebounded when pulled out of position.
   */
  MAN_TO_MAN: Object.freeze({
    id:                   'MAN_TO_MAN',
    label:                'Man-to-Man',
    description:          'Every defender locks onto a specific opponent. Classic, high-effort.',
    stealRateMod:         +0.15,
    threePointAllowedMod: +0.05,  // Slight 3-point vulnerability
    reboundMod:           -0.05,  // Defenders can get pulled away
    turnoverRateMod:      0,
    staminaCostMod:       0,
    forceFTRate:          0,
    riskLevel:            'medium'
  }),

  /**
   * ZONE DEFENSE
   * Defenders protect areas rather than individual players.
   * Limits penetration and 3s; weaker on steals; strong rebounding
   * because defenders are already positioned for box-outs.
   */
  ZONE: Object.freeze({
    id:                   'ZONE',
    label:                'Zone Defense',
    description:          'Protect the paint and contest the arc. Stronger rebounding; fewer steals.',
    stealRateMod:         -0.1,
    threePointAllowedMod: -0.1,   // 3-point attempts are more contested
    reboundMod:           +0.15,  // Defenders are well-positioned
    turnoverRateMod:      0,
    staminaCostMod:       -0.05,  // Slightly less tiring (less individual pursuit)
    forceFTRate:          0,
    riskLevel:            'low'
  }),

  /**
   * FULL-COURT PRESS
   * Aggressive full-court pressure to force turnovers.
   * Dramatically increases both teams' turnover rate; very high stamina cost.
   */
  PRESS: Object.freeze({
    id:                   'PRESS',
    label:                'Full-Court Press',
    description:          'Suffocate ball-handlers from the moment they inbound. High-risk, high-reward.',
    stealRateMod:         +0.2,
    threePointAllowedMod: 0,
    reboundMod:           0,
    turnoverRateMod:      +0.2,   // Both teams turn the ball over more
    staminaCostMod:       +0.3,   // Exhausting for everyone on court
    forceFTRate:          0,
    riskLevel:            'high'
  }),

  /**
   * HACK-A-CENTER (intentional foul strategy)
   * Deliberately foul the opponent's worst free-throw shooter.
   * Forces free-throw attempts at potentially low conversion rate.
   * Very high risk: if the target shoots well from the line, this backfires badly.
   */
  HACK_A_CENTER: Object.freeze({
    id:                   'HACK_A_CENTER',
    label:                'Hack-a-Center',
    description:          'Intentionally foul the opponent\'s weakest FT shooter. High risk.',
    stealRateMod:         0,
    threePointAllowedMod: 0,
    reboundMod:           0,
    turnoverRateMod:      0,
    staminaCostMod:       0,
    forceFTRate:          0.8,    // 80% chance per possession of intentional foul
    riskLevel:            'high'
  })
});

// ---------------------------------------------------------------------------
// Stat modifier application
// ---------------------------------------------------------------------------

/**
 * Apply play-style modifiers to a base action-resolution stat object.
 *
 * Returns a new stats object with multiplied values; the original is not
 * mutated. All modifiers are additive offsets on a base of 1.0.
 *
 * In ISOLATION mode the star player (highest attack / Attack attribute,
 * falling back to skillLevel) receives starUsageMod on their own stats.
 * For non-star players the starUsageMod is not applied (or is negative to
 * represent reduced touches).
 *
 * @param {Object} baseStats - Base resolution stats for a player or team
 *   Expected keys (all optional, default 0): shooting, shooting3pt, defense,
 *   perimeterDefense, blocking, rebounding, passing, dribbling,
 *   possessionSpeed, paintChance, threePointChance
 * @param {PlayStyleConfig | string} playStyle
 *   Either a PlayStyleConfig object or a key from PLAY_STYLES
 * @param {Object}  [playerContext]         - Additional context for star detection
 * @param {boolean} [playerContext.isStar]  - Explicitly flag this player as the star
 * @param {string}  [playerContext.position] - Player position (PG | SG | SF | PF | C)
 * @returns {Object} New stats object with modifiers applied
 */
export function applyPlayStyleModifiers(baseStats, playStyle, playerContext) {
  const style = resolvePlayStyle(playStyle);

  if (!baseStats || typeof baseStats !== 'object') {
    throw new TypeError('applyPlayStyleModifiers: baseStats must be an object');
  }

  const ctx      = playerContext || {};
  const position = String(ctx.position || baseStats.position || 'SF').toUpperCase();
  const isStar   = ctx.isStar === true;
  const isBig    = position === 'C' || position === 'PF';
  const isGuard  = position === 'PG' || position === 'SG';

  const result = { ...baseStats };

  // Possession speed — affects how many offensive actions fit in a possession
  if (baseStats.possessionSpeed !== undefined) {
    result.possessionSpeed = applyMod(baseStats.possessionSpeed, style.possessionSpeedMod);
  }

  // Shooting percentages
  if (baseStats.shooting !== undefined) {
    result.shooting = applyMod(baseStats.shooting, style.shootingMod);
  }
  if (baseStats.shooting3pt !== undefined) {
    // Three-point volume modifier scales the likelihood of attempting a 3
    result.shooting3pt = applyMod(baseStats.shooting3pt, style.threePointVolume);
  }

  // Paint scoring (close-range / inside)
  if (baseStats.paintChance !== undefined) {
    result.paintChance = applyMod(baseStats.paintChance, style.paintScoring);
  }

  // Three-point volume flag (probability of choosing a 3)
  if (baseStats.threePointChance !== undefined) {
    result.threePointChance = Math.max(
      0,
      Math.min(1, (baseStats.threePointChance || 0) + style.threePointVolume)
    );
  }

  // Isolation / star usage — only affecting the star player
  if (style.id === 'ISOLATION' && isStar) {
    if (baseStats.shooting !== undefined) {
      result.shooting = applyMod(result.shooting, style.starUsageMod);
    }
    // Star player also gets more possessions — approximate via a usage flag
    result.isolationUsageBoost = style.starUsageMod;
  }

  // Position-based fantasy modifiers (stored for downstream fantasy engine use)
  if (isGuard) {
    result.fantasyPointMod = round4(1 + style.pgSgFantasyMod);
  } else if (isBig) {
    result.fantasyPointMod = round4(1 + style.cfFantasyMod);
  } else {
    result.fantasyPointMod = 1; // Small forward: neutral
  }

  // Chemistry adjustment flag (processed by calculateChemistryBonus)
  result.chemistryModOffset = style.chemistryMod;

  return result;
}

/**
 * Apply defensive scheme modifiers to a base action-resolution stat object.
 *
 * Operates from the defending team's perspective — modifiers affect:
 * - How likely defenders are to get steals
 * - How many opponent 3-pointers are allowed
 * - How well defenders rebound
 * - How much stamina is consumed
 *
 * @param {Object} baseStats - Base resolution stats (typically team-level)
 * @param {DefensiveSchemeConfig | string} defenseScheme
 *   Either a DefensiveSchemeConfig object or a key from DEFENSIVE_SCHEMES
 * @param {PlayStyleConfig | string | null} [opponentPlayStyle]
 *   Opponent's selected play style — used for counter-tactics.
 *   Zone defense is slightly less effective vs. SPREAD_3PT opponents.
 * @returns {Object} New stats object with defensive modifiers applied
 */
export function applyDefensiveSchemeModifiers(baseStats, defenseScheme, opponentPlayStyle) {
  const scheme = resolveDefensiveScheme(defenseScheme);

  if (!baseStats || typeof baseStats !== 'object') {
    throw new TypeError('applyDefensiveSchemeModifiers: baseStats must be an object');
  }

  const result = { ...baseStats };

  // Steal rate
  if (baseStats.stealRate !== undefined) {
    result.stealRate = applyMod(baseStats.stealRate, scheme.stealRateMod);
  }
  if (baseStats.stealing !== undefined) {
    result.stealing = applyMod(baseStats.stealing, scheme.stealRateMod);
  }

  // Opponent three-point success rate (negative value = harder for opponent)
  if (baseStats.opponentThreePointRate !== undefined) {
    result.opponentThreePointRate = applyMod(
      baseStats.opponentThreePointRate,
      scheme.threePointAllowedMod
    );
  }
  // Perimeter defense proxy
  if (baseStats.perimeterDefense !== undefined) {
    // Improved perimeter defense → opponent 3pt rate decreases
    const perimeterAdjust = -scheme.threePointAllowedMod; // invert sign
    result.perimeterDefense = applyMod(baseStats.perimeterDefense, perimeterAdjust);
  }

  // Rebounding
  if (baseStats.rebounding !== undefined) {
    result.rebounding = applyMod(baseStats.rebounding, scheme.reboundMod);
  }

  // Stamina cost per possession (affects fatigue curve)
  if (baseStats.staminaCostPerPossession !== undefined) {
    result.staminaCostPerPossession = applyMod(
      baseStats.staminaCostPerPossession,
      scheme.staminaCostMod
    );
  }

  // Turnover-forcing rate (PRESS scheme)
  if (baseStats.opponentTurnoverRate !== undefined) {
    result.opponentTurnoverRate = applyMod(
      baseStats.opponentTurnoverRate,
      scheme.turnoverRateMod
    );
  }

  // Hack-a-Center specific
  result.forceFTRate = scheme.forceFTRate || 0;
  result.defenseRiskLevel = scheme.riskLevel;

  // Counter-tactic: Zone is partially countered by SPREAD_3PT opponents —
  // the 3-point suppression benefit is halved against spread offenses.
  if (scheme.id === 'ZONE' && opponentPlayStyle) {
    const oppStyle = resolvePlayStyle(opponentPlayStyle, true);
    if (oppStyle && oppStyle.id === 'SPREAD_3PT') {
      // Spread offense partially negates the zone's 3pt coverage
      if (result.perimeterDefense !== undefined) {
        result.perimeterDefense = applyMod(result.perimeterDefense, -0.07);
      }
      if (result.opponentThreePointRate !== undefined) {
        result.opponentThreePointRate = applyMod(result.opponentThreePointRate, +0.07);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Chemistry bonus
// ---------------------------------------------------------------------------

/**
 * Calculate the team chemistry bonus based on starting five Chemistry attributes.
 *
 * Formula:
 *   chemistryAvg = average Chemistry (1–99) of the 5 starters
 *   teamBonus    = (chemistryAvg / 99) * 0.10        → max 10% boost across the board
 *   cohesionBonus = +0.05 on assist rate when chemistryAvg > 80
 *
 * Fallback when Chemistry attribute is missing:
 *   Approximation = player.skillLevel * 15 + 10   (gives range 25–85)
 *
 * @param {Object} team - Team object or plain object containing players
 *   Supported shapes:
 *     { players: Player[] }          — raw Team instance
 *     { starters: Player[] }         — explicit starter list
 *     Player[]                       — array of player objects directly
 * @returns {{
 *   teamBonus: number,          — multiplicative bonus to apply to all actions (0–0.10)
 *   cohesionBonus: number,      — additive bonus to assist rate (0 or 0.05)
 *   chemistryAvg: number,       — average chemistry of the starting five (1–99)
 *   details: { name, chemistry }[] — per-player breakdown
 * }}
 */
export function calculateChemistryBonus(team) {
  const players = extractStartingFive(team);

  if (players.length === 0) {
    return { teamBonus: 0, cohesionBonus: 0, chemistryAvg: 0, details: [] };
  }

  const details = players.map(p => {
    const name  = String(p.name || p.playerName || 'Player');
    const chem  = resolvePlayerAttribute(p, 'chemistry', 'Chemistry');
    return { name, chemistry: chem };
  });

  const chemistryAvg = round4(
    details.reduce((sum, d) => sum + d.chemistry, 0) / details.length
  );

  const teamBonus    = round4((chemistryAvg / 99) * 0.10);
  const cohesionBonus = chemistryAvg > 80 ? 0.05 : 0;

  return { teamBonus, cohesionBonus, chemistryAvg, details };
}

// ---------------------------------------------------------------------------
// Game plan
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RotationTemplate
 * @property {string}  playerId              - Player identifier
 * @property {number}  targetMinutes         - Target minutes per game (0–48)
 * @property {number}  foulTroubleBenchFouls - Auto-bench if this many fouls in first half
 * @property {number}  fatigueThreshold      - Sub out when Stamina % falls below this value
 */

/**
 * @typedef {Object} GamePlan
 * @property {PlayStyleConfig}      playStyle      - Selected offensive play style
 * @property {DefensiveSchemeConfig} defenseScheme - Selected defensive scheme
 * @property {RotationTemplate[]}   rotations      - Per-player rotation instructions
 * @property {Object}               combinedMods   - Pre-computed merged stat modifiers
 */

/**
 * Create a complete game plan combining an offensive play style, defensive
 * scheme, and rotation templates.
 *
 * The returned `combinedMods` object is a preview of the stat modifiers that
 * will be applied; the actual application occurs at match time via
 * applyPlayStyleModifiers() and applyDefensiveSchemeModifiers().
 *
 * @param {PlayStyleConfig | string} playStyle
 * @param {DefensiveSchemeConfig | string} defenseScheme
 * @param {RotationTemplate[]} [rotationTemplates]
 * @returns {GamePlan}
 */
export function createGamePlan(playStyle, defenseScheme, rotationTemplates) {
  const resolvedStyle   = resolvePlayStyle(playStyle);
  const resolvedScheme  = resolveDefensiveScheme(defenseScheme);
  const rotations       = Array.isArray(rotationTemplates)
    ? rotationTemplates.map(validateRotationTemplate)
    : [];

  // Build a summary of combined modifier directions for quick UI display
  const combinedMods = {
    offensive: {
      possessionSpeed:  resolvedStyle.possessionSpeedMod,
      shooting:         resolvedStyle.shootingMod,
      threePointVolume: resolvedStyle.threePointVolume,
      paintScoring:     resolvedStyle.paintScoring,
      starUsage:        resolvedStyle.starUsageMod,
      chemistry:        resolvedStyle.chemistryMod
    },
    defensive: {
      stealRate:           resolvedScheme.stealRateMod,
      threePointAllowed:   resolvedScheme.threePointAllowedMod,
      rebounding:          resolvedScheme.reboundMod,
      turnoverForcing:     resolvedScheme.turnoverRateMod,
      staminaCost:         resolvedScheme.staminaCostMod,
      forceFTRate:         resolvedScheme.forceFTRate,
      riskLevel:           resolvedScheme.riskLevel
    }
  };

  return Object.freeze({
    playStyle:    resolvedStyle,
    defenseScheme: resolvedScheme,
    rotations,
    combinedMods
  });
}

/**
 * Find the star player in a roster for Isolation play style calculations.
 *
 * Star detection priority:
 *   1. Player explicitly flagged with isStar: true
 *   2. Highest `attack` or `Attack` attribute (1–99 scale)
 *   3. Fallback: highest `skillLevel` (1–5 scale)
 *
 * @param {Object[]} players - Array of player objects
 * @returns {Object | null} The identified star player, or null if roster is empty
 */
export function findStarPlayer(players) {
  if (!Array.isArray(players) || players.length === 0) return null;

  // Explicit flag takes precedence
  const explicit = players.find(p => p.isStar === true);
  if (explicit) return explicit;

  // Highest attack attribute
  return players.reduce((best, current) => {
    const bestVal = resolvePlayerAttribute(best, 'attack', 'Attack');
    const currVal = resolvePlayerAttribute(current, 'attack', 'Attack');
    return currVal > bestVal ? current : best;
  });
}

// ---------------------------------------------------------------------------
// Utility / validation helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a play style from either a string key or a config object.
 *
 * @param {PlayStyleConfig | string} input
 * @param {boolean} [allowNull] - If true, return null for unrecognised input
 * @returns {PlayStyleConfig}
 */
function resolvePlayStyle(input, allowNull) {
  if (typeof input === 'string') {
    const style = PLAY_STYLES[input.toUpperCase()];
    if (!style) {
      if (allowNull) return null;
      throw new Error(
        `resolvePlayStyle: unknown play style "${input}". ` +
        `Valid options: ${Object.keys(PLAY_STYLES).join(', ')}`
      );
    }
    return style;
  }
  if (input && typeof input === 'object' && input.id) {
    return input;
  }
  if (allowNull) return null;
  throw new TypeError(
    'resolvePlayStyle: input must be a PLAY_STYLES key string or a PlayStyleConfig object'
  );
}

/**
 * Resolve a defensive scheme from either a string key or a config object.
 *
 * @param {DefensiveSchemeConfig | string} input
 * @returns {DefensiveSchemeConfig}
 */
function resolveDefensiveScheme(input) {
  if (typeof input === 'string') {
    const scheme = DEFENSIVE_SCHEMES[input.toUpperCase()];
    if (!scheme) {
      throw new Error(
        `resolveDefensiveScheme: unknown defensive scheme "${input}". ` +
        `Valid options: ${Object.keys(DEFENSIVE_SCHEMES).join(', ')}`
      );
    }
    return scheme;
  }
  if (input && typeof input === 'object' && input.id) {
    return input;
  }
  throw new TypeError(
    'resolveDefensiveScheme: input must be a DEFENSIVE_SCHEMES key string or a DefensiveSchemeConfig object'
  );
}

/**
 * Apply a modifier offset to a base value.
 * Result = base * (1 + mod). Clamped to [0, Infinity) — values cannot go negative.
 *
 * @param {number} base
 * @param {number} mod - Additive offset on a multiplier of 1.0
 * @returns {number}
 */
function applyMod(base, mod) {
  if (!isFinite(base) || !isFinite(mod)) return base;
  return Math.max(0, base * (1 + mod));
}

/**
 * Extract an array of the starting five (or as many starters as available)
 * from a team object or array.
 *
 * @param {Object | Object[]} team
 * @returns {Object[]}
 */
function extractStartingFive(team) {
  if (Array.isArray(team)) {
    return team.slice(0, 5);
  }
  if (!team || typeof team !== 'object') {
    throw new TypeError('calculateChemistryBonus: team must be a Team object or array');
  }

  // Support { starters: [...] }
  if (Array.isArray(team.starters)) {
    return team.starters.slice(0, 5);
  }

  // Support Team instance with getActivePlayersOnCourt() method
  if (typeof team.getActivePlayersOnCourt === 'function') {
    return team.getActivePlayersOnCourt().slice(0, 5);
  }

  // Support { players: [...] } — take first 5 active players
  if (Array.isArray(team.players)) {
    return team.players.filter(p => p.isActive !== false).slice(0, 5);
  }

  return [];
}

/**
 * Resolve a player attribute, supporting both camelCase and PascalCase keys,
 * with a deterministic fallback to skillLevel-based approximation.
 *
 * @param {Object} player
 * @param {string} attrCamel  - e.g. 'chemistry'
 * @param {string} attrPascal - e.g. 'Chemistry'
 * @returns {number} Attribute value on 1–99 scale
 */
function resolvePlayerAttribute(player, attrCamel, attrPascal) {
  // Direct 1-99 attribute (master plan full attribute system)
  const directCamel  = player[attrCamel];
  const directPascal = player[attrPascal];
  if (typeof directCamel  === 'number' && isFinite(directCamel))  return directCamel;
  if (typeof directPascal === 'number' && isFinite(directPascal)) return directPascal;

  // From attributes sub-object (common wrapper pattern)
  const attrs = player.attributes || player.skills || {};
  const fromAttrs = attrs[attrCamel] || attrs[attrPascal];
  if (typeof fromAttrs === 'number' && isFinite(fromAttrs)) return fromAttrs;

  // Fallback: derive approximate 1-99 value from skillLevel (1–5)
  const skillLevel = player.skillLevel;
  if (typeof skillLevel === 'number' && isFinite(skillLevel)) {
    // Generic approximation: skillLevel * 18 + 10 → range 28–100, clamped to 99
    // For Chemistry specifically: skillLevel * 15 + 10 → range 25–85
    if (attrCamel === 'chemistry' || attrPascal === 'Chemistry') {
      return Math.min(99, skillLevel * 15 + 10);
    }
    return Math.min(99, Math.max(1, skillLevel * 18 + 10));
  }

  return 50; // Default mid-range
}

/**
 * Validate and normalise a rotation template entry.
 *
 * @param {Object} template
 * @returns {RotationTemplate}
 */
function validateRotationTemplate(template) {
  if (!template || typeof template !== 'object') {
    throw new TypeError('createGamePlan: each rotation template must be an object');
  }

  const targetMinutes = Number(template.targetMinutes);
  const foulBench     = Number(template.foulTroubleBenchFouls ?? 3);
  const fatigue       = Number(template.fatigueThreshold ?? 0.3);

  if (isNaN(targetMinutes) || targetMinutes < 0 || targetMinutes > 48) {
    throw new RangeError(
      `validateRotationTemplate: targetMinutes must be 0–48, got ${template.targetMinutes}`
    );
  }
  if (isNaN(foulBench) || foulBench < 1 || foulBench > 5) {
    throw new RangeError(
      `validateRotationTemplate: foulTroubleBenchFouls must be 1–5, got ${template.foulTroubleBenchFouls}`
    );
  }
  if (isNaN(fatigue) || fatigue < 0 || fatigue > 1) {
    throw new RangeError(
      `validateRotationTemplate: fatigueThreshold must be 0–1, got ${template.fatigueThreshold}`
    );
  }

  return {
    playerId:              String(template.playerId || ''),
    targetMinutes,
    foulTroubleBenchFouls: foulBench,
    fatigueThreshold:      fatigue
  };
}

/**
 * Round to 4 decimal places.
 * @param {number} n
 * @returns {number}
 */
function round4(n) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
