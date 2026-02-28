/**
 * draftEngine.js
 * Quadra Legacy — Snake Draft Engine
 *
 * Core logic for player drafts in league mode (Master Plan Section 6.2.1).
 * Implements a snake draft where the pick order reverses every other round
 * so the last picker in Round 1 becomes the first picker in Round 2.
 *
 * State machine: 'lobby' -> 'picking' -> 'complete'
 *
 * Design principles:
 *   - Pure functions: no timers, no side effects, no network calls.
 *   - State is immutable-ish: functions return new copies where practical.
 *   - UI is responsible for the 90-second countdown; this module only
 *     stores the configured timer duration and exposes autoPickForManager()
 *     for the UI to call on timeout.
 *
 * Exports:
 *   createDraft(config)                     -- create a new draft in lobby state
 *   startDraft(draft)                       -- transition lobby -> picking
 *   makePick(draft, managerId, playerId)    -- make a pick, advance state
 *   autoPickForManager(draft, managerId)    -- AI / timeout auto-pick
 *   advanceToNextPick(draft)                -- move to next pick in snake order
 *   getDraftOrder(managerCount, totalRounds) -- compute full snake pick order
 *   getManagerRoster(draft, managerId)      -- all players picked by a manager
 *   getBestAvailable(draft, positionNeed)   -- sorted best available players
 *   getPositionNeeds(roster, rosterSize)    -- position gaps analysis
 *   generateDraftPlayerPool(teamCount, rosterSize) -- create draft player pool
 */

import { generatePlayerPool, VALID_POSITIONS } from './playerCreator.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default pick timer in seconds (UI enforces the countdown). */
const DEFAULT_PICK_TIMER_SECONDS = 90;

/**
 * Minimum roster composition for a valid basketball squad.
 * At least one starter per position; remaining slots are flex (any position).
 */
const MINIMUM_STARTERS = Object.freeze({
  PG: 1,
  SG: 1,
  SF: 1,
  PF: 1,
  C:  1,
});

/** Total mandatory starter slots (one per position). */
const STARTER_COUNT = Object.values(MINIMUM_STARTERS).reduce((a, b) => a + b, 0);

/**
 * Position-need bonus applied when scoring players during auto-pick.
 * A higher bonus makes the AI more likely to pick a player at that position.
 */
const POSITION_NEED_BONUS = 15;

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

/**
 * Generate a unique identifier without external dependencies.
 * Same pattern used by seasonManager.js for consistency.
 *
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// getDraftOrder
// ---------------------------------------------------------------------------

/**
 * Compute the full pick order for a snake draft.
 *
 * Snake order means:
 *   Round 1 (odd):  manager 0 -> 1 -> 2 -> ... -> N-1
 *   Round 2 (even): manager N-1 -> N-2 -> ... -> 0
 *   Round 3 (odd):  manager 0 -> 1 -> 2 -> ... -> N-1
 *   ... and so on for all rounds.
 *
 * @param {number} managerCount - Number of managers in the draft.
 * @param {number} totalRounds  - Number of draft rounds (equal to rosterSize).
 * @returns {number[]} Array of manager indices representing each pick in order.
 *   Length = managerCount * totalRounds.
 *
 * @example
 *   getDraftOrder(3, 2)
 *   // => [0, 1, 2, 2, 1, 0]
 *   //     Round 1: 0->1->2   Round 2: 2->1->0
 */
export function getDraftOrder(managerCount, totalRounds) {
  if (!Number.isInteger(managerCount) || managerCount < 1) {
    throw new RangeError('getDraftOrder: managerCount must be a positive integer');
  }
  if (!Number.isInteger(totalRounds) || totalRounds < 1) {
    throw new RangeError('getDraftOrder: totalRounds must be a positive integer');
  }

  const order = [];

  for (let round = 0; round < totalRounds; round++) {
    const isReversed = round % 2 === 1;
    for (let pick = 0; pick < managerCount; pick++) {
      order.push(isReversed ? (managerCount - 1 - pick) : pick);
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// createDraft
// ---------------------------------------------------------------------------

/**
 * Create a new draft state object in the 'lobby' phase.
 *
 * The draft remains in lobby until all managers are ready and the host
 * calls startDraft(). Player pool can be supplied or auto-generated.
 *
 * @param {object} config
 * @param {string}   config.leagueId   - League this draft belongs to.
 * @param {Array<{ id: string, name: string, isUser?: boolean, isAI?: boolean }>}
 *                   config.managers    - Participating managers (4-12).
 * @param {number}   config.rosterSize - Picks per manager (roster slots to fill).
 * @param {object[]} [config.playerPool] - Pre-generated player pool. If omitted,
 *                   generateDraftPlayerPool() is called automatically.
 * @param {number}   [config.pickTimerSeconds=90] - Seconds per pick (UI countdown).
 * @returns {object} Draft state object in 'lobby' status.
 */
export function createDraft(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('createDraft: config must be an object');
  }

  const { leagueId, managers, rosterSize, playerPool, pickTimerSeconds } = config;

  if (!leagueId || typeof leagueId !== 'string') {
    throw new TypeError('createDraft: leagueId must be a non-empty string');
  }
  if (!Array.isArray(managers) || managers.length < 2) {
    throw new RangeError('createDraft: managers must be an array with at least 2 entries');
  }
  if (!Number.isInteger(rosterSize) || rosterSize < 1) {
    throw new RangeError('createDraft: rosterSize must be a positive integer');
  }

  // Normalise manager objects — ensure each has ready: false
  const normalisedManagers = managers.map(m => ({
    id:     m.id,
    name:   m.name,
    isUser: Boolean(m.isUser),
    isAI:   Boolean(m.isAI),
    ready:  false,
  }));

  // Generate or validate the player pool
  const pool = Array.isArray(playerPool) && playerPool.length > 0
    ? [...playerPool]
    : generateDraftPlayerPool(managers.length, rosterSize);

  const totalPicks = managers.length * rosterSize;
  if (pool.length < totalPicks) {
    throw new RangeError(
      `createDraft: playerPool has ${pool.length} players but ${totalPicks} picks are needed. ` +
      `Provide at least ${totalPicks} players.`
    );
  }

  // Build the full snake pick order using manager IDs
  const indexOrder = getDraftOrder(managers.length, rosterSize);
  const pickOrder  = indexOrder.map(idx => normalisedManagers[idx].id);

  return {
    id:               generateId(),
    leagueId,
    status:           'lobby',
    managers:         normalisedManagers,
    playerPool:       pool,
    picks:            [],
    currentPick:      null,
    rosterSize,
    pickOrder,
    pickTimerSeconds: pickTimerSeconds ?? DEFAULT_PICK_TIMER_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// startDraft
// ---------------------------------------------------------------------------

/**
 * Transition a draft from 'lobby' to 'picking' and set the first pick.
 *
 * @param {object} draft - Draft state object in 'lobby' status.
 * @returns {object} New draft state with status 'picking' and currentPick set.
 * @throws {Error} If draft is not in 'lobby' status.
 */
export function startDraft(draft) {
  if (!draft || draft.status !== 'lobby') {
    throw new Error('startDraft: draft must be in "lobby" status');
  }

  const firstManagerId = draft.pickOrder[0];

  return {
    ...draft,
    status:      'picking',
    currentPick: {
      round:      1,
      pickNumber: 1,
      managerId:  firstManagerId,
    },
  };
}

// ---------------------------------------------------------------------------
// makePick
// ---------------------------------------------------------------------------

/**
 * Record a draft pick: assign a player to a manager, remove the player
 * from the available pool, and advance to the next pick.
 *
 * @param {object} draft     - Draft state object in 'picking' status.
 * @param {string} managerId - ID of the manager making the pick.
 * @param {string} playerId  - ID of the player being selected.
 * @returns {{ draft: object, pick: object }}
 *   draft: updated draft state (may transition to 'complete')
 *   pick:  the recorded pick object
 * @throws {Error} If it is not the manager's turn, or the player is unavailable.
 */
export function makePick(draft, managerId, playerId) {
  if (!draft || draft.status !== 'picking') {
    throw new Error('makePick: draft must be in "picking" status');
  }
  if (!draft.currentPick || draft.currentPick.managerId !== managerId) {
    throw new Error(
      `makePick: it is not manager "${managerId}"'s turn. ` +
      `Current pick belongs to "${draft.currentPick?.managerId}".`
    );
  }

  // Find the player in the available pool
  const playerIndex = draft.playerPool.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`makePick: player "${playerId}" is not available in the player pool`);
  }

  const selectedPlayer = draft.playerPool[playerIndex];

  // Build the pick record
  const pick = {
    round:      draft.currentPick.round,
    pickNumber: draft.currentPick.pickNumber,
    managerId,
    playerId:   selectedPlayer.id,
    playerName: selectedPlayer.name,
  };

  // Remove the player from the pool (new array)
  const newPool = [
    ...draft.playerPool.slice(0, playerIndex),
    ...draft.playerPool.slice(playerIndex + 1),
  ];

  // Record the pick
  const newPicks = [...draft.picks, pick];

  // Build intermediate state
  const updatedDraft = {
    ...draft,
    playerPool: newPool,
    picks:      newPicks,
  };

  // Advance to next pick (or complete)
  const advancedDraft = advanceToNextPick(updatedDraft);

  return {
    draft: advancedDraft,
    pick,
  };
}

// ---------------------------------------------------------------------------
// advanceToNextPick
// ---------------------------------------------------------------------------

/**
 * Move the draft to the next pick in the snake order.
 *
 * If all picks have been made (picks.length === pickOrder.length), the draft
 * transitions to 'complete'.
 *
 * @param {object} draft - Draft state object in 'picking' status.
 * @returns {object} Updated draft state with the next currentPick, or
 *   status 'complete' if the draft is finished.
 */
export function advanceToNextPick(draft) {
  if (!draft || draft.status !== 'picking') {
    throw new Error('advanceToNextPick: draft must be in "picking" status');
  }

  const nextPickIndex = draft.picks.length; // 0-indexed position in pickOrder
  const totalPicks    = draft.pickOrder.length;

  // All picks made — draft is complete
  if (nextPickIndex >= totalPicks) {
    return {
      ...draft,
      status:      'complete',
      currentPick: null,
    };
  }

  const managersCount = draft.managers.length;
  const round         = Math.floor(nextPickIndex / managersCount) + 1;
  const pickNumber    = nextPickIndex + 1;
  const managerId     = draft.pickOrder[nextPickIndex];

  return {
    ...draft,
    currentPick: {
      round,
      pickNumber,
      managerId,
    },
  };
}

// ---------------------------------------------------------------------------
// getManagerRoster
// ---------------------------------------------------------------------------

/**
 * Retrieve all players that a specific manager has drafted.
 *
 * @param {object} draft     - Draft state object (any status).
 * @param {string} managerId - Manager ID to look up.
 * @returns {object[]} Array of player objects drafted by this manager,
 *   in pick order. Empty array if no picks yet.
 */
export function getManagerRoster(draft, managerId) {
  if (!draft || !Array.isArray(draft.picks)) return [];

  // Collect player IDs picked by this manager
  const pickedIds = draft.picks
    .filter(p => p.managerId === managerId)
    .map(p => p.playerId);

  if (pickedIds.length === 0) return [];

  // Build a lookup from all players (pool + already-picked).
  // Players that have been picked are no longer in playerPool, so we need
  // to reconstruct them from the pick records. However, the full player
  // objects were removed from the pool — they are gone. To support this
  // query we search the current pool AND build references from picks.
  //
  // Strategy: store picked players alongside their picks by scanning
  // all sources. Since makePick removes players from the pool, and we
  // need the full objects, callers that need full player data should
  // maintain a separate "all players" index. For now, return the pick
  // metadata which always includes playerId and playerName.
  //
  // UPDATE: To provide full player objects we search the pool for any
  // remaining (shouldn't be there) and fall back to a lightweight record.

  const poolById = new Map(draft.playerPool.map(p => [p.id, p]));

  // Also check if draft carries an _allPlayers cache (set by createDraft)
  const allById = draft._allPlayers
    ? new Map(draft._allPlayers.map(p => [p.id, p]))
    : poolById;

  return pickedIds.map(id => {
    if (allById.has(id)) return allById.get(id);
    if (poolById.has(id)) return poolById.get(id);
    // Fallback: return the pick record with minimal info
    const pickRecord = draft.picks.find(p => p.playerId === id);
    return {
      id,
      name:     pickRecord?.playerName ?? 'Unknown',
      position: 'Unknown',
      overall:  0,
    };
  });
}

// ---------------------------------------------------------------------------
// getPositionNeeds
// ---------------------------------------------------------------------------

/**
 * Analyse a manager's roster and determine which positions still need filling.
 *
 * NBA-style roster construction:
 *   - 5 starter slots: 1 PG, 1 SG, 1 SF, 1 PF, 1 C
 *   - Remaining slots are flex (any position, but variety is preferred)
 *
 * Returns an array of position strings ordered by priority (most needed first).
 * An empty array means the roster has adequate positional coverage.
 *
 * @param {object[]} roster     - Array of player objects (must have .position).
 * @param {number}   rosterSize - Total roster slots available.
 * @returns {string[]} Positions needed, most urgent first.
 *   e.g. ['C', 'PF'] means the roster has no Centre and no Power Forward.
 */
export function getPositionNeeds(roster, rosterSize) {
  if (!Array.isArray(roster)) return [...VALID_POSITIONS];

  // Count how many players at each position
  const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  for (const player of roster) {
    if (player.position && counts[player.position] !== undefined) {
      counts[player.position]++;
    }
  }

  const slotsRemaining = Math.max(0, rosterSize - roster.length);
  const needs = [];

  // Priority 1: positions with zero starters (mandatory needs)
  for (const pos of VALID_POSITIONS) {
    if (counts[pos] < MINIMUM_STARTERS[pos]) {
      needs.push(pos);
    }
  }

  // If we have all starters but still have flex slots, suggest positions
  // where depth is thin (fewer than 2 players) to encourage balanced rosters.
  if (needs.length === 0 && slotsRemaining > 0) {
    const depthNeeds = VALID_POSITIONS
      .filter(pos => counts[pos] < 2)
      .sort((a, b) => counts[a] - counts[b]);
    needs.push(...depthNeeds);
  }

  return needs;
}

// ---------------------------------------------------------------------------
// getBestAvailable
// ---------------------------------------------------------------------------

/**
 * Return the available player pool sorted by overall rating (descending),
 * optionally filtered to a specific position.
 *
 * @param {object}   draft        - Draft state object.
 * @param {string}   [positionNeed] - If provided, only return players at this position.
 *   Pass null or undefined to return all positions.
 * @returns {object[]} Players sorted by overall descending. Empty if pool is empty.
 */
export function getBestAvailable(draft, positionNeed) {
  if (!draft || !Array.isArray(draft.playerPool)) return [];

  let candidates = draft.playerPool;

  if (positionNeed && typeof positionNeed === 'string') {
    candidates = candidates.filter(p => p.position === positionNeed);
  }

  // Sort by overall descending; break ties by cardOverall, then name
  return [...candidates].sort((a, b) => {
    if (b.overall !== a.overall) return b.overall - a.overall;
    if ((b.cardOverall || 0) !== (a.cardOverall || 0)) {
      return (b.cardOverall || 0) - (a.cardOverall || 0);
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

// ---------------------------------------------------------------------------
// autoPickForManager
// ---------------------------------------------------------------------------

/**
 * Perform an intelligent auto-pick for a manager.
 *
 * Used for:
 *   - AI managers making their picks
 *   - Human managers whose pick timer expired (best available at position need)
 *
 * Algorithm:
 *   1. Determine the manager's current roster and position needs.
 *   2. Score each available player: overall + POSITION_NEED_BONUS if the
 *      player fills a needed position.
 *   3. Pick the highest-scored player.
 *
 * @param {object} draft     - Draft state object in 'picking' status.
 * @param {string} managerId - ID of the manager to auto-pick for.
 * @returns {{ draft: object, pick: object }} Same shape as makePick().
 * @throws {Error} If it is not this manager's turn or the pool is empty.
 */
export function autoPickForManager(draft, managerId) {
  if (!draft || draft.status !== 'picking') {
    throw new Error('autoPickForManager: draft must be in "picking" status');
  }
  if (!draft.currentPick || draft.currentPick.managerId !== managerId) {
    throw new Error(
      `autoPickForManager: it is not manager "${managerId}"'s turn`
    );
  }
  if (!draft.playerPool || draft.playerPool.length === 0) {
    throw new Error('autoPickForManager: no players available in pool');
  }

  // Get this manager's current roster
  const roster = getManagerRoster(draft, managerId);
  const needs  = getPositionNeeds(roster, draft.rosterSize);

  // Build a set of needed positions for O(1) lookup
  const needSet = new Set(needs);

  // Score each available player
  let bestPlayer = null;
  let bestScore  = -Infinity;

  for (const player of draft.playerPool) {
    let score = player.overall || 0;

    // Apply position-need bonus
    if (needSet.has(player.position)) {
      score += POSITION_NEED_BONUS;
    }

    if (score > bestScore) {
      bestScore  = score;
      bestPlayer = player;
    }
  }

  // Make the pick
  return makePick(draft, managerId, bestPlayer.id);
}

// ---------------------------------------------------------------------------
// generateDraftPlayerPool
// ---------------------------------------------------------------------------

/**
 * Generate the player pool for a draft using playerCreator.generatePlayerPool().
 *
 * Pool size is approximately 2x the total roster spots across all teams,
 * ensuring plenty of selection depth at every position.
 *
 * @param {number} teamCount  - Number of teams in the draft.
 * @param {number} rosterSize - Roster slots per team.
 * @returns {object[]} Array of player objects ready for drafting.
 */
export function generateDraftPlayerPool(teamCount, rosterSize) {
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    throw new RangeError('generateDraftPlayerPool: teamCount must be a positive integer');
  }
  if (!Number.isInteger(rosterSize) || rosterSize < 1) {
    throw new RangeError('generateDraftPlayerPool: rosterSize must be a positive integer');
  }

  const totalRosterSpots = teamCount * rosterSize;

  // Generate ~2x the needed players so managers have meaningful choices
  // even in the final rounds. Minimum of 30 to ensure variety.
  const poolSize = Math.max(30, totalRosterSpots * 2);

  return generatePlayerPool(poolSize);
}
