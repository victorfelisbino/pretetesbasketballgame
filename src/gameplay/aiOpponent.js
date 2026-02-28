/**
 * AI Opponent System — Quadra Legacy
 *
 * A strategy module that selects ball carriers and shot types each possession.
 * Integrates with matchEngine.js as a drop-in strategy; the engine calls
 * makeDecision() to get decisions instead of performing random selection itself.
 *
 * Spec reference: MOBILE_GAME_MASTER_PLAN.md Section 6.10
 *
 * Player format compatibility:
 *   Old player.js format: player.skillLevel (1-5), no attributes object
 *   New playerCreator.js format: player.attributes.Attack etc (1-99)
 *
 * GameState shape:
 * {
 *   round: number,            // 0-100
 *   quarter: number,          // 1-4
 *   scoreDiff: number,        // possession team score - opponent score
 *   teamPlayers: Player[],    // active players on possession team
 *   opponentPlayers: Player[], // active opponent players
 *   possession: 'home'|'away',
 *   possessionCount: Object,  // { [playerId]: number }
 * }
 */

export const AI_TIERS = Object.freeze({
  ROOKIE:  0,
  AMATEUR: 1,
  PRO:     2,
  ELITE:   3,
  LEGEND:  4,
});

// Position weights used by the match engine for ball carrier selection.
// AMATEUR AI mirrors these as baselines then adds its own logic.
const BASE_POSITION_WEIGHTS = {
  PG: 40,
  SG: 25,
  SF: 15,
  PF: 12,
  C:  8,
};

// Positions that should never attempt 3-pointers (inside-only positions)
const INSIDE_ONLY_POSITIONS = new Set(['C', 'PF']);

export class AIOpponent {
  /**
   * @param {number} tier - One of AI_TIERS values (default: ROOKIE)
   * @param {object|null} team - Optional team reference (not required for Phase 1)
   */
  constructor(tier = AI_TIERS.ROOKIE, team = null) {
    this.tier = tier;
    this.team = team;

    // Internal state for substitution tracking — reset on quarter change
    this._currentTrackedQuarter = 1;
    this._quarterCounts = {}; // { [playerId]: number } — ball carries this quarter
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Main decision method. Called once per possession.
   *
   * @param {Object} gameState
   * @returns {{
   *   ballCarrier: Object,
   *   shotType: '2pt'|'3pt'|'pass',
   *   preferredTarget: Object|null,
   *   reasoning: string
   * }}
   */
  makeDecision(gameState) {
    // Sync quarter tracking before deciding
    this._syncQuarter(gameState.quarter || 1);

    let decision;
    switch (this.tier) {
      case AI_TIERS.ROOKIE:
        decision = this._rookieDecision(gameState);
        break;
      case AI_TIERS.AMATEUR:
        decision = this._amateurDecision(gameState);
        break;
      case AI_TIERS.PRO:
        // TODO Phase 3: Full implementation
        decision = this._amateurDecision(gameState);
        break;
      case AI_TIERS.ELITE:
        // TODO Phase 3: Full implementation
        decision = this._amateurDecision(gameState);
        break;
      case AI_TIERS.LEGEND:
        // TODO Phase 4+: Full implementation
        decision = this._amateurDecision(gameState);
        break;
      default:
        decision = this._rookieDecision(gameState);
    }

    // Track this ball carrier for intra-quarter substitution analysis
    if (decision.ballCarrier) {
      const key = this._playerKey(decision.ballCarrier);
      this._quarterCounts[key] = (this._quarterCounts[key] || 0) + 1;
    }

    return decision;
  }

  /**
   * Alias for makeDecision (compatibility hook for match engine).
   */
  getPlayersForPossession(gameState) {
    return this.makeDecision(gameState);
  }

  /**
   * Pick the best shooter for a given shot type from a list of players.
   *
   * @param {Object[]} players
   * @param {'2pt'|'3pt'} shotType
   * @returns {Object} Best shooter
   */
  selectBestShooter(players, shotType) {
    if (!players || players.length === 0) return null;

    const attr = shotType === '3pt' ? 'ThreePoint' : 'Attack';
    return this._getPlayerByBestAttribute(players, attr);
  }

  /**
   * Decide whether to attempt a 3-pointer in AMATEUR mode.
   *
   * @param {Object} gameState
   * @param {Object} ballCarrier
   * @returns {boolean}
   */
  shouldAttempt3Pointer(gameState, ballCarrier) {
    if (!ballCarrier) return false;

    // Big men never shoot 3s
    if (INSIDE_ONLY_POSITIONS.has(ballCarrier.position)) return false;

    const round     = gameState.round    || 0;
    const quarter   = gameState.quarter  || 1;
    const scoreDiff = gameState.scoreDiff != null ? gameState.scoreDiff : 0;

    // Desperately behind in Q4: 80% 3pt
    if (quarter === 4 && scoreDiff < -6) {
      return Math.random() < 0.80;
    }

    // Protecting a big lead in Q4: keep it safe with 2s
    if (quarter === 4 && scoreDiff > 10) {
      return Math.random() < 0.25;
    }

    // Need buckets late in game: 70% 3pt
    if (scoreDiff < -3 && round > 85) {
      return Math.random() < 0.70;
    }

    // Default 3pt probability for perimeter players
    return Math.random() < 0.55;
  }

  /**
   * Advise whether a substitution should happen based on heavy player usage.
   * The match engine decides whether to execute the sub; AI only advises.
   *
   * @param {Object} gameState
   * @returns {boolean}
   */
  shouldSubstitute(gameState) {
    // ROOKIE never substitutes
    if (this.tier === AI_TIERS.ROOKIE) return false;

    const players = gameState.teamPlayers || [];

    // Need at least 5 active players to consider substituting
    if (players.length < 5) return false;

    // Sync quarter state
    this._syncQuarter(gameState.quarter || 1);

    // Check if any player has been the ball carrier 8+ times this quarter
    for (const [playerId, count] of Object.entries(this._quarterCounts)) {
      if (count >= 8) {
        // Need 4+ other players available to cover the sub
        const othersAvailable = players.filter(
          p => this._playerKey(p) !== playerId
        );
        if (othersAvailable.length >= 4) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Evaluate how fatigued a player is based on how often they have had the ball.
   *
   * @param {Object} player
   * @param {number} roundsPlayed - total rounds elapsed in the match
   * @returns {number} fatigue factor in [0.0, 1.0] (0 = fresh, 1 = exhausted)
   */
  evaluatePlayerFatigue(player, roundsPlayed) {
    if (!player) return 0;

    const key = this._playerKey(player);
    const quarterCarries = this._quarterCounts[key] || 0;

    // Simple fatigue model: 8 carries per quarter is maximum expected load
    const maxExpectedCarries = 8;
    const carryFatigue = Math.min(1.0, quarterCarries / maxExpectedCarries);

    // Stamina factor if available (new player format)
    let staminaFactor = 0;
    const stamina = this._getAttributeValue(player, 'Stamina');
    if (stamina > 0) {
      // Lower stamina = higher contribution to fatigue
      staminaFactor = Math.max(0, (60 - stamina) / 60) * 0.3;
    }

    return Math.min(1.0, carryFatigue * 0.7 + staminaFactor);
  }

  // ---------------------------------------------------------------------------
  // INTERNAL DECISION METHODS
  // ---------------------------------------------------------------------------

  /**
   * ROOKIE: fully random decisions, no tactical awareness.
   */
  _rookieDecision(gameState) {
    const players = gameState.teamPlayers || [];
    if (players.length === 0) {
      return {
        ballCarrier:      null,
        shotType:         '2pt',
        preferredTarget:  null,
        reasoning:        'No active players available',
      };
    }

    const ballCarrier = this._getRandomPlayer(players);
    // 50/50 for big men becomes automatically 2pt in engine; replicate here for realism
    const shotType = Math.random() < 0.5 ? '2pt' : '3pt';

    return {
      ballCarrier,
      shotType,
      preferredTarget: null,
      reasoning:       'Random selection',
    };
  }

  /**
   * AMATEUR: smart Phase 1 logic.
   * - Prefers high-Attack players 70% of the time
   * - Weights PG as primary ball handler
   * - Distributes ball when one player dominates
   * - Picks shot type based on scoreline and game situation
   */
  _amateurDecision(gameState) {
    const players = gameState.teamPlayers || [];
    if (players.length === 0) {
      return {
        ballCarrier:      null,
        shotType:         '2pt',
        preferredTarget:  null,
        reasoning:        'No active players available',
      };
    }

    const possessionCount = gameState.possessionCount || {};

    // --- Ball carrier selection ---
    const ballCarrier = this._selectAmateurBallCarrier(players, possessionCount);

    // --- Shot type selection ---
    let shotType;
    let reasoning;

    if (INSIDE_ONLY_POSITIONS.has(ballCarrier.position)) {
      shotType  = '2pt';
      reasoning = `${ballCarrier.position} position forces 2pt`;
    } else {
      const attempt3 = this.shouldAttempt3Pointer(gameState, ballCarrier);
      shotType       = attempt3 ? '3pt' : '2pt';
      reasoning      = this._buildReasoning(ballCarrier, shotType, gameState);
    }

    return {
      ballCarrier,
      shotType,
      preferredTarget: null, // Passes not yet modeled in Phase 1
      reasoning,
    };
  }

  // ---------------------------------------------------------------------------
  // AMATEUR HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Select a ball carrier using AMATEUR heuristics.
   */
  _selectAmateurBallCarrier(players, possessionCount) {
    if (players.length === 1) return players[0];

    // Distribution rule: if any player has the ball 5+ times more than others,
    // restrict selection to players who have had it fewer than 5 times.
    const counts = players.map(p => ({
      player: p,
      count:  possessionCount[this._playerKey(p)] || 0,
    }));
    const maxCount = Math.max(...counts.map(c => c.count));
    let eligiblePlayers = players;

    if (maxCount >= 5) {
      const lowUsagePlayers = counts
        .filter(c => c.count < maxCount)
        .map(c => c.player);
      if (lowUsagePlayers.length > 0) {
        eligiblePlayers = lowUsagePlayers;
      }
    }

    // 70% of the time: top-3 by Attack attribute
    let pool;
    if (Math.random() < 0.70) {
      const sorted = [...eligiblePlayers].sort(
        (a, b) => this._getAttributeValue(b, 'Attack') - this._getAttributeValue(a, 'Attack')
      );
      pool = sorted.slice(0, Math.min(3, sorted.length));
    } else {
      pool = eligiblePlayers;
    }

    // Apply position weights (PG gets +20% bonus)
    return this._weightedPickByPosition(pool);
  }

  /**
   * Weighted player selection with PG receiving a +20% boost to their base weight.
   */
  _weightedPickByPosition(players) {
    if (players.length === 0) return null;
    if (players.length === 1) return players[0];

    const weights = players.map(p => {
      const baseWeight = BASE_POSITION_WEIGHTS[p.position] || 10;
      const pgBonus    = p.position === 'PG' ? baseWeight * 0.20 : 0;
      return baseWeight + pgBonus;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < players.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return players[i];
    }

    return players[players.length - 1];
  }

  /**
   * Build a human-readable reasoning string for debug/display purposes.
   */
  _buildReasoning(ballCarrier, shotType, gameState) {
    const round     = gameState.round    || 0;
    const quarter   = gameState.quarter  || 1;
    const scoreDiff = gameState.scoreDiff != null ? gameState.scoreDiff : 0;

    if (quarter === 4 && scoreDiff < -6) {
      return `Down ${Math.abs(scoreDiff)} in Q4 — desperate 3pt attempt by ${ballCarrier.name}`;
    }
    if (quarter === 4 && scoreDiff > 10) {
      return `Up ${scoreDiff} in Q4 — protecting lead with ${shotType} by ${ballCarrier.name}`;
    }
    if (scoreDiff < -3 && round > 85) {
      return `Late game deficit — high-volume 3pt by ${ballCarrier.name}`;
    }
    return `Standard possession: ${ballCarrier.position} ${ballCarrier.name} takes ${shotType}`;
  }

  // ---------------------------------------------------------------------------
  // GENERAL HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Pick a uniformly random player from an array.
   */
  _getRandomPlayer(players) {
    if (!players || players.length === 0) return null;
    return players[Math.floor(Math.random() * players.length)];
  }

  /**
   * Sort players descending by an attribute and return the top player.
   */
  _getPlayerByBestAttribute(players, attributeName) {
    if (!players || players.length === 0) return null;
    return [...players].sort(
      (a, b) => this._getAttributeValue(b, attributeName) - this._getAttributeValue(a, attributeName)
    )[0];
  }

  /**
   * Safely read a named attribute from a player, handling both formats:
   *   - New (playerCreator.js): player.attributes.Attack etc. (1-99)
   *   - Old (player.js): player.skillLevel (1-5) used as a proxy
   *
   * When reading from the old format with the proxy, all attributes map to the
   * same scaled value (skillLevel × 18 + 10 ≈ 1-99 range), which is the same
   * approximation the match engine uses when reading skill-based attributes.
   *
   * @param {Object} player
   * @param {string} attributeName - e.g. 'Attack', 'ThreePoint', 'Stamina'
   * @returns {number} attribute value 1-99
   */
  _getAttributeValue(player, attributeName) {
    // New playerCreator.js format
    if (player && player.attributes && player.attributes[attributeName] !== undefined) {
      return player.attributes[attributeName];
    }

    // Old player.js format: use skillLevel as a uniform proxy for any attribute.
    // skillLevel 1-5 → approx 28, 46, 64, 82, 100, clamped to 99.
    if (player && player.skillLevel !== undefined) {
      return Math.min(99, player.skillLevel * 18 + 10);
    }

    // Fallback direct property lookup (e.g. if someone passes a raw object)
    if (player && player[attributeName] !== undefined) {
      return player[attributeName];
    }

    return 50; // neutral default
  }

  /**
   * Derive a stable identity key for a player (used in internal tracking maps).
   * Uses id (UUID from playerCreator) then falls back to name.
   */
  _playerKey(player) {
    if (!player) return 'unknown';
    return String(player.id || player.name || 'unknown');
  }

  /**
   * Sync the internal quarter tracker, resetting counts when the quarter changes.
   */
  _syncQuarter(quarter) {
    if (quarter !== this._currentTrackedQuarter) {
      this._quarterCounts           = {};
      this._currentTrackedQuarter   = quarter;
    }
  }
}
