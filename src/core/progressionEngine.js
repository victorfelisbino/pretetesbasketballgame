/**
 * Player Progression Engine — Quadra Legacy
 *
 * Handles XP gain, level-up, aging, and breakthrough events.
 * Spec reference: MOBILE_GAME_MASTER_PLAN.md Section 6.7
 *
 * This module is intentionally pure: no UI, no network calls, no React deps.
 * All exported functions are deterministic given the same inputs (except those
 * that use Math.random(), which can be seeded for testing via the `seed` param).
 *
 * Player format compatibility:
 *   Old player.js format  : flat object, player.skillLevel (1-5), no .attributes
 *   New playerCreator.js  : player.attributes.Attack/Defense/… (1-99),
 *                           player.attributes.Potential (1-99)
 *
 * IMPORTANT — processSeasonAging does NOT mutate its input array or any player
 * within it. It returns fresh copies.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const XP_CONFIG = Object.freeze({
  PER_POINT:      2,
  PER_REBOUND:    3,
  PER_ASSIST:     4,
  PER_STEAL:      5,
  PER_BLOCK:      5,
  PER_MINUTE:     1,
  MIN_PER_MATCH:  10,
  MAX_PER_MATCH:  200,
  /**
   * XP required to advance one level within each tier.
   * Interpretation: a player at level N (where N is in [minLevel, maxLevel])
   * must accumulate xpRequired total XP to level up once.
   *
   * To "be at level N" in this system means the player has accumulated enough
   * total XP to have completed exactly (N-1) level-up transitions from level 1.
   *
   * Cumulative XP thresholds for reaching level N from level 1:
   *   Level 1 :     0 XP  (starting level, no cost)
   *   Level 2 :   100 XP  (1 × 100)
   *   Level 3 :   200 XP  (2 × 100)
   *   Level 4 :   300 XP  (3 × 100)
   *   Level 5 :   400 XP  (4 × 100)
   *   Level 6 :   500 XP  (5 × 100, all tier-1 transitions done)
   *   Level 7 :   700 XP  (500 + 1 × 200)
   *   Level 10:  1300 XP  (500 + 4 × 200)
   *   Level 11:  1500 XP  (500 + 5 × 200, all tier-2 transitions done)
   *   Level 12:  1900 XP  (1500 + 1 × 400)
   */
  LEVEL_TIERS: [
    { minLevel: 1,  maxLevel: 5,  xpRequired: 100 },
    { minLevel: 6,  maxLevel: 10, xpRequired: 200 },
    { minLevel: 11, maxLevel: 99, xpRequired: 400 },
  ],
});

export const AGING_CONFIG = Object.freeze({
  PEAK_START:           23,
  PEAK_END:             28,
  DECLINE_START:        29,
  SEVERE_DECLINE_START: 34,
  RETIRE_CHECK_AGE:     35,
  BASE_RETIRE_CHANCE:   0.30, // 30% base at age 35
});

export const BREAKTHROUGH_EVENTS = Object.freeze({
  SUMMER_BREAKTHROUGH: 'summerBreakthrough', // +5 one attribute (permanently)
  INJURY:              'injury',             // miss 2-4 games, -5 temp on one attr
  SLUMP:               'slump',              // Morale -10
  CHEMISTRY_SPARK:     'chemistrySpark',     // Chemistry +2 (team can mirror)
});

// Attributes eligible for random selection in breakthrough events.
// Potential is excluded — it is a hard ceiling, not a trainable attribute.
const BREAKTHROUGH_ELIGIBLE_ATTRIBUTES = [
  'Attack', 'FieldGoal', 'FieldGoalPaint', 'FieldGoalMidRange',
  'ThreePoint', 'DunkLayup', 'FreeThrow', 'Passing',
  'Defense', 'StealMarking', 'Blocking', 'Stamina', 'Chemistry', 'Morale',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read a named attribute from a player, handling both player formats.
 * @param {Object} player
 * @param {string} attrName
 * @returns {number}
 */
function _readAttr(player, attrName) {
  if (player.attributes && player.attributes[attrName] !== undefined) {
    return Number(player.attributes[attrName]);
  }
  // Old format: direct property or 0
  if (player[attrName] !== undefined) {
    return Number(player[attrName]);
  }
  return 0;
}

/**
 * Write a named attribute to a player object.
 * Prefers player.attributes[attrName] if present; falls back to top-level.
 * @param {Object} player - mutable clone
 * @param {string} attrName
 * @param {number} value
 */
function _writeAttr(player, attrName, value) {
  if (player.attributes) {
    player.attributes[attrName] = value;
  } else {
    player[attrName] = value;
  }
}

/**
 * Read the player's Potential ceiling.
 * Handles both formats: player.attributes.Potential, player.potential, or ∞ (99).
 * @param {Object} player
 * @returns {number}
 */
function _readPotential(player) {
  if (player.attributes && player.attributes.Potential !== undefined) {
    return Number(player.attributes.Potential);
  }
  if (player.potential !== undefined) {
    return Number(player.potential);
  }
  return 99; // no ceiling defined — treat as no cap
}

/**
 * Deep-clone a single player object without mutating the original.
 * Handles nested .attributes and .stats objects.
 * NOTE: injected function properties (from playerCreator.js) are preserved by
 * reference — they are stateless helpers and safe to share across the clone.
 */
function _clonePlayer(player) {
  const clone = Object.assign({}, player);

  if (player.attributes) {
    clone.attributes = Object.assign({}, player.attributes);
  }

  if (player.stats) {
    clone.stats = Object.assign({}, player.stats);
    if (player.stats.shots2pt) {
      clone.stats.shots2pt = Object.assign({}, player.stats.shots2pt);
    }
    if (player.stats.shots3pt) {
      clone.stats.shots3pt = Object.assign({}, player.stats.shots3pt);
    }
  }

  return clone;
}

/**
 * Pick a random element from an array.
 * @param {any[]} arr
 * @returns {any}
 */
function _randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Clamp a number to [min, max].
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function _clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Calculate XP earned from a single match.
 *
 * Formula:
 *   raw = points × PER_POINT
 *       + rebounds × PER_REBOUND
 *       + assists × PER_ASSIST
 *       + steals × PER_STEAL
 *       + blocks × PER_BLOCK
 *       + minutes × PER_MINUTE
 *
 * Result is clamped to [MIN_PER_MATCH, MAX_PER_MATCH].
 *
 * @param {Object} playerStats - canonical PlayerStats shape (points, rebounds, assists, …)
 * @param {number} minutesPlayed - 0-48
 * @returns {number} XP earned
 */
export function calculateMatchXP(playerStats, minutesPlayed) {
  const stats  = playerStats  || {};
  const mins   = Math.max(0, Number(minutesPlayed) || 0);

  const raw =
    (Number(stats.points   || 0) * XP_CONFIG.PER_POINT)   +
    (Number(stats.rebounds || 0) * XP_CONFIG.PER_REBOUND)  +
    (Number(stats.assists  || 0) * XP_CONFIG.PER_ASSIST)   +
    (Number(stats.steals   || 0) * XP_CONFIG.PER_STEAL)    +
    (Number(stats.blocks   || 0) * XP_CONFIG.PER_BLOCK)    +
    (mins                        * XP_CONFIG.PER_MINUTE);

  return _clamp(Math.round(raw), XP_CONFIG.MIN_PER_MATCH, XP_CONFIG.MAX_PER_MATCH);
}

/**
 * Get level information from a lifetime XP total.
 *
 * A player begins at level 1 (0 XP).  Each time they accumulate `xpRequired`
 * XP for their current tier, they gain one level.  The cumulative XP needed
 * to reach level N (from level 1) is:
 *
 *   Levels 1→2, 2→3, …, 5→6  : 100 XP each  (5 transitions, 500 XP total)
 *   Levels 6→7, 7→8, …, 10→11: 200 XP each  (5 transitions, 1000 XP total)
 *   Level 11+                  : 400 XP each
 *
 * Example cumulative thresholds to REACH level N:
 *   Level 1:     0 XP   Level 6:   500 XP   Level 11:  1500 XP
 *   Level 2:   100 XP   Level 7:   700 XP   Level 12:  1900 XP
 *   Level 5:   400 XP   Level 10: 1300 XP
 *
 * @param {number} totalXP - lifetime XP accumulated
 * @returns {{ currentLevel: number, xpToNextLevel: number, progressPercent: number }}
 */
export function getLevelInfo(totalXP) {
  let xpRemaining  = Math.max(0, Math.round(totalXP));
  let currentLevel = 1;

  for (const tier of XP_CONFIG.LEVEL_TIERS) {
    const levelsInTier = tier.maxLevel - tier.minLevel + 1;

    for (let i = 0; i < levelsInTier; i++) {
      if (xpRemaining >= tier.xpRequired) {
        // Completed one level-up transition within this tier
        xpRemaining -= tier.xpRequired;
        currentLevel++;
      } else {
        // Currently accumulating XP toward the next level-up in this tier
        const xpToNextLevel  = tier.xpRequired - xpRemaining;
        const progressPercent = Math.floor((xpRemaining / tier.xpRequired) * 100);
        return { currentLevel, xpToNextLevel, progressPercent };
      }
    }
  }

  // Beyond all explicitly defined tiers (levels 99+): use the last tier cost
  const lastTier       = XP_CONFIG.LEVEL_TIERS[XP_CONFIG.LEVEL_TIERS.length - 1];
  const xpToNextLevel  = lastTier.xpRequired - xpRemaining % lastTier.xpRequired;
  const progressPercent = Math.floor(
    (xpRemaining % lastTier.xpRequired) / lastTier.xpRequired * 100
  );
  return { currentLevel, xpToNextLevel, progressPercent };
}

/**
 * Apply a single level-up to a player, increasing one chosen attribute.
 *
 * Rules:
 *   - Random gain: 70% chance of +1, 20% chance of +2, 10% chance of +3
 *   - Cannot increase the attribute above the player's Potential ceiling
 *   - If already at potential: returns success=false
 *   - If gain would exceed potential: clamps to potential value
 *
 * IMPORTANT: This function mutates the provided `player` object.
 * If you need immutability, clone the player before calling this function.
 *
 * @param {Object} player             - player object (mutated in place)
 * @param {string} chosenAttribute    - attribute name to increase (e.g. 'Attack')
 * @returns {{
 *   success: boolean,
 *   reason: string,
 *   attributeGained: number,
 *   newValue: number,
 *   cappedByPotential: boolean
 * }}
 */
export function levelUpPlayer(player, chosenAttribute) {
  if (!player || !chosenAttribute) {
    return {
      success:          false,
      reason:           'invalidArguments',
      attributeGained:  0,
      newValue:         0,
      cappedByPotential: false,
    };
  }

  const currentValue = _readAttr(player, chosenAttribute);
  const potential    = _readPotential(player);

  // Check if already at potential ceiling
  if (currentValue >= potential) {
    return {
      success:           false,
      reason:            'cappedAtPotential',
      attributeGained:   0,
      newValue:          currentValue,
      cappedByPotential: true,
    };
  }

  // Determine random gain: 70% +1, 20% +2, 10% +3
  const roll = Math.random();
  let gain;
  if (roll < 0.70)      gain = 1;
  else if (roll < 0.90) gain = 2;
  else                  gain = 3;

  // cappedByPotential = true when the potential ceiling constrains any possible gain
  // (i.e. max gain of 3 would hit or exceed the ceiling), regardless of the actual roll.
  // This tells callers "this attribute is near its ceiling — gains may be limited."
  let cappedByPotential = (currentValue + 3 > potential);
  let newValue          = currentValue + gain;

  if (newValue > potential) {
    newValue = potential;
    gain     = potential - currentValue;
  }

  // Write back to player
  _writeAttr(player, chosenAttribute, newValue);

  return {
    success:           true,
    reason:            'ok',
    attributeGained:   gain,
    newValue,
    cappedByPotential,
  };
}

/**
 * Apply end-of-season aging to an array of players.
 *
 * Aging rules applied (non-mutating — returns fresh copies):
 *   ALL players:     age += 1
 *   Age 29-33:       40% chance Stamina -1
 *   Age 34+:         70% chance Stamina -1
 *                    30% chance one random non-Potential attribute -1
 *   Age 35+ retire:  base 30%; +10% per year over 35 (35→30%, 36→40%, …)
 *                    Also retire if Stamina drops below 20
 *
 * @param {Object[]} players - array of player objects (not mutated)
 * @returns {{
 *   updated: Object[],
 *   retired: Object[],
 *   declined: Array<{player: Object, attribute: string, amount: number}>,
 *   events: string[]
 * }}
 */
export function processSeasonAging(players) {
  if (!Array.isArray(players)) {
    return { updated: [], retired: [], declined: [], events: [] };
  }

  const updated  = [];
  const retired  = [];
  const declined = [];
  const events   = [];

  for (const original of players) {
    // Always work on a deep clone — never mutate input
    const p = _clonePlayer(original);

    // Increment age
    const newAge = (Number(p.age) || 25) + 1;
    p.age = newAge;

    // ---- Decline phase ----
    if (newAge >= AGING_CONFIG.DECLINE_START) {
      // Age 29-33: 40% chance Stamina -1
      if (newAge < AGING_CONFIG.SEVERE_DECLINE_START) {
        if (Math.random() < 0.40) {
          const oldStamina = _readAttr(p, 'Stamina');
          if (oldStamina > 0) {
            const newStamina = Math.max(1, oldStamina - 1);
            _writeAttr(p, 'Stamina', newStamina);
            declined.push({ player: p, attribute: 'Stamina', amount: 1 });
            events.push(`${p.name || 'Player'} (age ${newAge}) lost 1 Stamina due to age`);
          }
        }
      }

      // Age 34+: 70% chance Stamina -1, 30% chance one random attr -1
      if (newAge >= AGING_CONFIG.SEVERE_DECLINE_START) {
        if (Math.random() < 0.70) {
          const oldStamina = _readAttr(p, 'Stamina');
          if (oldStamina > 0) {
            const newStamina = Math.max(1, oldStamina - 1);
            _writeAttr(p, 'Stamina', newStamina);
            declined.push({ player: p, attribute: 'Stamina', amount: 1 });
            events.push(`${p.name || 'Player'} (age ${newAge}) lost 1 Stamina (severe decline)`);
          }
        }

        if (Math.random() < 0.30) {
          // Pick a random attribute to decline (excluding Potential and Stamina for double-dip fairness)
          const eligibleDeclineAttrs = BREAKTHROUGH_ELIGIBLE_ATTRIBUTES.filter(
            a => a !== 'Stamina'
          );
          const attr     = _randomPick(eligibleDeclineAttrs);
          const oldValue = _readAttr(p, attr);
          if (oldValue > 0) {
            const newValue = Math.max(1, oldValue - 1);
            _writeAttr(p, attr, newValue);
            declined.push({ player: p, attribute: attr, amount: 1 });
            events.push(
              `${p.name || 'Player'} (age ${newAge}) declined 1 point in ${attr}`
            );
          }
        }
      }
    }

    // ---- Retirement check ----
    let shouldRetire = false;

    if (newAge >= AGING_CONFIG.RETIRE_CHECK_AGE) {
      const yearsOver      = newAge - AGING_CONFIG.RETIRE_CHECK_AGE;
      const retireChance   = AGING_CONFIG.BASE_RETIRE_CHANCE + yearsOver * 0.10;
      const clampedChance  = Math.min(1.0, retireChance);

      if (Math.random() < clampedChance) {
        shouldRetire = true;
        events.push(`${p.name || 'Player'} (age ${newAge}) chose to retire`);
      }
    }

    // Also retire if Stamina collapsed below 20
    const currentStamina = _readAttr(p, 'Stamina');
    if (currentStamina > 0 && currentStamina < 20) {
      shouldRetire = true;
      events.push(
        `${p.name || 'Player'} (age ${newAge}) forced to retire — Stamina too low (${currentStamina})`
      );
    }

    if (shouldRetire) {
      retired.push(p);
    } else {
      updated.push(p);
    }
  }

  return { updated, retired, declined, events };
}

/**
 * Maybe trigger a breakthrough event for a player (10% base chance).
 *
 * Breakdown of possible events and their probabilities:
 *   40% — summerBreakthrough: +5 to a random non-Potential attribute (capped at 99)
 *   30% — injury: player marked as injured, injuryGamesRemaining=3,
 *                 affected attribute −5 (capped at min 1)
 *   20% — slump: Morale attribute −10 (min 1)
 *   10% — chemistrySpark: Chemistry +2; effect.teamEffect=true so caller can
 *                          apply the same bonus to teammates
 *
 * Seeding for testability:
 *   seed='force_breakthrough'  → always trigger an event
 *   seed='no_breakthrough'     → never trigger (returns null)
 *   seed=undefined             → Math.random() < 0.10
 *
 * IMPORTANT: This function mutates the provided `player` object.
 * Clone before calling if immutability is required.
 *
 * @param {Object} player
 * @param {string} [seed] - optional seed string for test control
 * @returns {{ event: string, effect: Object, description: string } | null}
 */
export function applyBreakthroughEvent(player, seed) {
  // --- Trigger check ---
  if (seed === 'no_breakthrough') return null;

  if (seed !== 'force_breakthrough') {
    if (Math.random() >= 0.10) return null;
  }

  // --- Select event ---
  const roll = Math.random();
  let eventKey;
  if (roll < 0.40)      eventKey = BREAKTHROUGH_EVENTS.SUMMER_BREAKTHROUGH;
  else if (roll < 0.70) eventKey = BREAKTHROUGH_EVENTS.INJURY;
  else if (roll < 0.90) eventKey = BREAKTHROUGH_EVENTS.SLUMP;
  else                  eventKey = BREAKTHROUGH_EVENTS.CHEMISTRY_SPARK;

  const effect = {};

  switch (eventKey) {
    case BREAKTHROUGH_EVENTS.SUMMER_BREAKTHROUGH: {
      const attr     = _randomPick(BREAKTHROUGH_ELIGIBLE_ATTRIBUTES);
      const oldValue = _readAttr(player, attr);
      const newValue = _clamp(oldValue + 5, 1, 99);
      _writeAttr(player, attr, newValue);
      effect.attribute = attr;
      effect.change    = newValue - oldValue;
      effect.newValue  = newValue;
      return {
        event: eventKey,
        effect,
        description: `${player.name || 'Player'} had a summer training breakthrough! +${effect.change} ${attr}`,
      };
    }

    case BREAKTHROUGH_EVENTS.INJURY: {
      const attr     = _randomPick(BREAKTHROUGH_ELIGIBLE_ATTRIBUTES);
      const oldValue = _readAttr(player, attr);
      const newValue = Math.max(1, oldValue - 5);
      _writeAttr(player, attr, newValue);

      player.injured              = true;
      player.injuryGamesRemaining = 3;

      effect.attribute            = attr;
      effect.change               = newValue - oldValue; // negative
      effect.newValue             = newValue;
      effect.gamesOut             = 3;
      return {
        event: eventKey,
        effect,
        description: `${player.name || 'Player'} suffered an injury! −${Math.abs(effect.change)} ${attr}, out ~3 games`,
      };
    }

    case BREAKTHROUGH_EVENTS.SLUMP: {
      const oldMorale = _readAttr(player, 'Morale');
      const newMorale = Math.max(1, oldMorale - 10);
      _writeAttr(player, 'Morale', newMorale);
      effect.attribute = 'Morale';
      effect.change    = newMorale - oldMorale; // negative
      effect.newValue  = newMorale;
      return {
        event: eventKey,
        effect,
        description: `${player.name || 'Player'} has entered a slump. Morale dropped by ${Math.abs(effect.change)}`,
      };
    }

    case BREAKTHROUGH_EVENTS.CHEMISTRY_SPARK: {
      const oldChem = _readAttr(player, 'Chemistry');
      const newChem = _clamp(oldChem + 2, 1, 99);
      _writeAttr(player, 'Chemistry', newChem);
      effect.attribute  = 'Chemistry';
      effect.change     = newChem - oldChem;
      effect.newValue   = newChem;
      effect.teamEffect = true; // caller should apply Chemistry +2 to teammates
      return {
        event: eventKey,
        effect,
        description: `${player.name || 'Player'} sparked chemistry! +${effect.change} Chemistry for the whole team`,
      };
    }

    default:
      return null;
  }
}

/**
 * Get the recommended attribute upgrade order for a given archetype.
 * Provides guidance in the level-up UI so players know what to prioritise.
 *
 * @param {string} archetype - 'Scorer'|'Defender'|'Playmaker'|'Rebounder'|'Stretch'
 * @returns {string[]} ordered list of recommended attributes (highest priority first)
 */
export function getRecommendedLevelUpAttributes(archetype) {
  const recommendations = {
    Scorer:     ['Attack', 'ThreePoint', 'FieldGoal', 'FieldGoalMidRange', 'Stamina'],
    Defender:   ['Defense', 'StealMarking', 'Stamina', 'Blocking', 'FieldGoalPaint'],
    Playmaker:  ['Passing', 'ThreePoint', 'Stamina', 'Defense', 'Chemistry'],
    Rebounder:  ['FieldGoalPaint', 'Blocking', 'DunkLayup', 'Defense', 'Stamina'],
    Stretch:    ['ThreePoint', 'FieldGoalMidRange', 'FreeThrow', 'Attack', 'Stamina'],
  };

  return recommendations[archetype] || ['Attack', 'Defense', 'Stamina', 'ThreePoint', 'Passing'];
}

/**
 * Calculate the full career stat summary for a player across multiple seasons.
 *
 * @param {Object[]} seasonStats - array of per-season stat objects.
 *   Each entry should contain: points, rebounds, assists, steals, blocks (all optional).
 * @returns {{
 *   totalPoints: number,
 *   totalRebounds: number,
 *   totalAssists: number,
 *   totalSteals: number,
 *   totalBlocks: number,
 *   seasonsPlayed: number,
 *   averagePerSeason: {
 *     points: number, rebounds: number, assists: number,
 *     steals: number, blocks: number
 *   }
 * }}
 */
export function calculateCareerStats(seasonStats) {
  if (!Array.isArray(seasonStats) || seasonStats.length === 0) {
    return {
      totalPoints:   0,
      totalRebounds: 0,
      totalAssists:  0,
      totalSteals:   0,
      totalBlocks:   0,
      seasonsPlayed: 0,
      averagePerSeason: {
        points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
      },
    };
  }

  const totals = seasonStats.reduce(
    (acc, season) => {
      acc.points   += Number(season.points   || 0);
      acc.rebounds += Number(season.rebounds || 0);
      acc.assists  += Number(season.assists  || 0);
      acc.steals   += Number(season.steals   || 0);
      acc.blocks   += Number(season.blocks   || 0);
      return acc;
    },
    { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 }
  );

  const n = seasonStats.length;
  const round1 = v => Math.round(v * 10) / 10;

  return {
    totalPoints:   totals.points,
    totalRebounds: totals.rebounds,
    totalAssists:  totals.assists,
    totalSteals:   totals.steals,
    totalBlocks:   totals.blocks,
    seasonsPlayed: n,
    averagePerSeason: {
      points:   round1(totals.points   / n),
      rebounds: round1(totals.rebounds / n),
      assists:  round1(totals.assists  / n),
      steals:   round1(totals.steals   / n),
      blocks:   round1(totals.blocks   / n),
    },
  };
}
