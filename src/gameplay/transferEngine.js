/**
 * Transfer Engine — Quadra Legacy
 *
 * Handles all player movement between teams: trades, waiver claims,
 * and marketplace transfers.  Works alongside salaryCapEngine to
 * enforce financial constraints.
 *
 * Pure functions — no side effects, no network calls.
 *
 * Exports:
 *   TRADE_STATUS          – Frozen status enum
 *   WAIVER_PRIORITY       – Frozen priority type enum
 *   AI_TRADE_THRESHOLDS   – Frozen AI tier config
 *   proposeTrade(params)  – Create a trade proposal
 *   evaluateTradeByAI(trade, aiTeamRoster, aiTier, rng) – AI trade evaluation
 *   executeTrade(trade, budgetA, budgetB) – Execute an accepted trade
 *   processWaiverClaim(waiverOrder, player, teamBudgets) – Waiver wire
 *   processMarketplaceMatch(player, sellerBudget, buyerBudget, price) – Marketplace
 *   getTradeHistory(trades, teamId) – Filter & sort trade history
 */

import {
  validateTradeFinancials,
  releasePlayer,
  signPlayer,
  canAffordPlayer,
} from '../core/salaryCapEngine.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TRADE_STATUS = Object.freeze({
  PROPOSED:  'proposed',
  ACCEPTED:  'accepted',
  REJECTED:  'rejected',
  COUNTERED: 'countered',
  EXPIRED:   'expired',
});

export const WAIVER_PRIORITY = Object.freeze({
  REVERSE_STANDINGS: 'reverse_standings',
  ROLLING:           'rolling',
});

export const AI_TRADE_THRESHOLDS = Object.freeze({
  ROOKIE: Object.freeze({  minAcceptScore: 35, patience: 0.9 }),
  VETERAN: Object.freeze({ minAcceptScore: 50, patience: 0.7 }),
  STAR: Object.freeze({    minAcceptScore: 60, patience: 0.5 }),
  ELITE: Object.freeze({   minAcceptScore: 75, patience: 0.3 }),
});

// ---------------------------------------------------------------------------
// ID generator (matches project convention in draftEngine / seasonManager)
// ---------------------------------------------------------------------------

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// ---------------------------------------------------------------------------
// proposeTrade
// ---------------------------------------------------------------------------

/**
 * Create a trade proposal object.
 *
 * @param {object}   params
 * @param {string}   params.proposingTeamId  – Team initiating the trade.
 * @param {string}   params.receivingTeamId  – Team receiving the proposal.
 * @param {object[]} params.playersFromProposer – Players offered by proposer.
 *   Each must have at least { id, name, salary }.
 * @param {object[]} params.playersFromReceiver – Players requested from receiver.
 *   Each must have at least { id, name, salary }.
 * @returns {object} Trade proposal with status 'proposed'.
 * @throws {Error} If either player list is empty.
 */
export function proposeTrade({
  proposingTeamId,
  receivingTeamId,
  playersFromProposer,
  playersFromReceiver,
}) {
  if (!Array.isArray(playersFromProposer) || playersFromProposer.length === 0) {
    throw new Error('proposeTrade: playersFromProposer must be a non-empty array');
  }
  if (!Array.isArray(playersFromReceiver) || playersFromReceiver.length === 0) {
    throw new Error('proposeTrade: playersFromReceiver must be a non-empty array');
  }
  if (!proposingTeamId || typeof proposingTeamId !== 'string') {
    throw new Error('proposeTrade: proposingTeamId must be a non-empty string');
  }
  if (!receivingTeamId || typeof receivingTeamId !== 'string') {
    throw new Error('proposeTrade: receivingTeamId must be a non-empty string');
  }

  return {
    id: generateId(),
    status: TRADE_STATUS.PROPOSED,
    proposingTeamId,
    receivingTeamId,
    playersFromProposer: [...playersFromProposer],
    playersFromReceiver: [...playersFromReceiver],
    createdAt: Date.now(),
    resolvedAt: null,
    counterOffer: null,
  };
}

// ---------------------------------------------------------------------------
// evaluateTradeByAI
// ---------------------------------------------------------------------------

/**
 * Have an AI manager evaluate a trade proposal.
 *
 * Scores the trade 0–100 across four dimensions:
 *   1. Value difference (incoming vs outgoing overall ratings)
 *   2. Position need (does the AI team lack the incoming positions?)
 *   3. Salary balance (smaller salary gap is better)
 *   4. Age factor (younger incoming players score higher)
 *
 * The AI accepts if the final score meets the tier threshold, rejects
 * if the score is below half of the threshold, and may counter-offer
 * in between.
 *
 * @param {object}   trade        – Trade proposal object.
 * @param {object[]} aiTeamRoster – Current roster of the AI team (receiver).
 *   Each should have { position, overall?, age? }.
 * @param {string}   aiTier       – AI difficulty tier key in AI_TRADE_THRESHOLDS.
 * @param {function} [rng=Math.random] – Injectable RNG for deterministic tests.
 * @returns {object} { decision, score, trade }
 *   decision: 'accepted' | 'rejected' | 'countered'
 *   score:    numeric score 0–100
 *   trade:    updated trade with new status and optional counterOffer
 */
export function evaluateTradeByAI(trade, aiTeamRoster, aiTier, rng = Math.random) {
  const thresholds = AI_TRADE_THRESHOLDS[aiTier] || AI_TRADE_THRESHOLDS.VETERAN;

  // --- 1. Value difference (0–30 points) ---
  const incomingOverall = trade.playersFromProposer.reduce(
    (sum, p) => sum + (p.overall || 50), 0
  );
  const outgoingOverall = trade.playersFromReceiver.reduce(
    (sum, p) => sum + (p.overall || 50), 0
  );
  const valueDiff = incomingOverall - outgoingOverall;
  // Clamp to 0–30: +30 diff => 30 pts, 0 diff => 15 pts, –30 diff => 0 pts
  const valueScore = Math.max(0, Math.min(30, 15 + (valueDiff / 2)));

  // --- 2. Position need (0–25 points) ---
  const rosterPositions = new Set((aiTeamRoster || []).map(p => p.position));
  const allPositions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const missingPositions = new Set(allPositions.filter(pos => !rosterPositions.has(pos)));
  const incomingFillsNeed = trade.playersFromProposer.filter(
    p => missingPositions.has(p.position)
  ).length;
  const positionScore = Math.min(25, incomingFillsNeed * 12.5);

  // --- 3. Salary balance (0–25 points) ---
  const incomingSalary = trade.playersFromProposer.reduce(
    (sum, p) => sum + (p.salary || 0), 0
  );
  const outgoingSalary = trade.playersFromReceiver.reduce(
    (sum, p) => sum + (p.salary || 0), 0
  );
  const salaryRatio = outgoingSalary > 0
    ? Math.min(incomingSalary, outgoingSalary) / Math.max(incomingSalary, outgoingSalary)
    : (incomingSalary === 0 ? 1 : 0);
  const salaryScore = salaryRatio * 25;

  // --- 4. Age factor (0–20 points) ---
  const avgIncomingAge = trade.playersFromProposer.reduce(
    (sum, p) => sum + (p.age || 25), 0
  ) / trade.playersFromProposer.length;
  const avgOutgoingAge = trade.playersFromReceiver.reduce(
    (sum, p) => sum + (p.age || 25), 0
  ) / trade.playersFromReceiver.length;
  // Younger incoming is better. Range mapped: 5 years younger => 20, same => 10, 5 older => 0
  const ageDiff = avgOutgoingAge - avgIncomingAge;
  const ageScore = Math.max(0, Math.min(20, 10 + ageDiff * 2));

  // --- Total score ---
  const rawScore = valueScore + positionScore + salaryScore + ageScore;
  const score = Math.round(rawScore);

  // --- Decision ---
  let decision;
  const rejectThreshold = thresholds.minAcceptScore * 0.5;

  if (score >= thresholds.minAcceptScore) {
    decision = TRADE_STATUS.ACCEPTED;
  } else if (score < rejectThreshold) {
    decision = TRADE_STATUS.REJECTED;
  } else {
    // Between reject and accept: patience-based counter chance
    const counterRoll = rng();
    if (counterRoll < thresholds.patience) {
      decision = TRADE_STATUS.COUNTERED;
    } else {
      decision = TRADE_STATUS.REJECTED;
    }
  }

  const updatedTrade = {
    ...trade,
    status: decision,
    resolvedAt: Date.now(),
  };

  // If countered, attach a counter-offer hint (request better players)
  if (decision === TRADE_STATUS.COUNTERED) {
    updatedTrade.counterOffer = {
      requestedMinOverall: Math.round(
        (outgoingOverall / trade.playersFromReceiver.length) + 5
      ),
      message: 'Need better players to make this work.',
    };
  }

  return { decision, score, trade: updatedTrade };
}

// ---------------------------------------------------------------------------
// executeTrade
// ---------------------------------------------------------------------------

/**
 * Execute an accepted trade, updating both team budgets.
 *
 * Validates financial constraints via validateTradeFinancials, then
 * uses releasePlayer / signPlayer to move salaries between budgets.
 *
 * @param {object} trade   – Trade proposal (should be in 'accepted' status).
 * @param {object} budgetA – Budget of the proposing team.
 * @param {object} budgetB – Budget of the receiving team.
 * @returns {object} { budgetA, budgetB, trade }
 *   Updated budgets after the trade and the trade marked 'accepted'.
 * @throws {Error} If trade financial validation fails.
 */
export function executeTrade(trade, budgetA, budgetB) {
  // Validate financials
  const validation = validateTradeFinancials(
    budgetA,
    budgetB,
    trade.playersFromProposer,
    trade.playersFromReceiver,
  );

  if (!validation.valid) {
    throw new Error(`executeTrade: trade rejected — ${validation.reason}`);
  }

  // Release players from their current teams, then sign them to their new teams
  let newBudgetA = { ...budgetA };
  let newBudgetB = { ...budgetB };

  // Team A releases its players (playersFromProposer)
  for (const player of trade.playersFromProposer) {
    newBudgetA = releasePlayer(newBudgetA, player.id);
  }
  // Team B releases its players (playersFromReceiver)
  for (const player of trade.playersFromReceiver) {
    newBudgetB = releasePlayer(newBudgetB, player.id);
  }

  // Team A signs players from Team B (playersFromReceiver)
  for (const player of trade.playersFromReceiver) {
    newBudgetA = signPlayer(newBudgetA, player.id, player.salary);
  }
  // Team B signs players from Team A (playersFromProposer)
  for (const player of trade.playersFromProposer) {
    newBudgetB = signPlayer(newBudgetB, player.id, player.salary);
  }

  const executedTrade = {
    ...trade,
    status: TRADE_STATUS.ACCEPTED,
    resolvedAt: Date.now(),
  };

  return {
    budgetA: newBudgetA,
    budgetB: newBudgetB,
    trade: executedTrade,
  };
}

// ---------------------------------------------------------------------------
// processWaiverClaim
// ---------------------------------------------------------------------------

/**
 * Process waiver claims for a player.  Teams are evaluated in waiver
 * priority order; the first team that can afford the player wins.
 *
 * @param {string[]} waiverOrder  – Team IDs in priority order (index 0 = highest).
 * @param {object}   player       – Player being claimed { id, name, salary }.
 * @param {object}   teamBudgets  – Map of teamId -> budget object.
 * @returns {object} { claimedBy, updatedBudget }
 *   claimedBy:     teamId that claimed the player, or null if nobody can afford.
 *   updatedBudget: the claiming team's updated budget, or null.
 */
export function processWaiverClaim(waiverOrder, player, teamBudgets) {
  if (!Array.isArray(waiverOrder) || waiverOrder.length === 0) {
    return { claimedBy: null, updatedBudget: null };
  }
  if (!player || typeof player.salary !== 'number') {
    throw new Error('processWaiverClaim: player must have a numeric salary');
  }

  for (const teamId of waiverOrder) {
    const budget = teamBudgets[teamId];
    if (!budget) continue;

    if (canAffordPlayer(budget, player.salary)) {
      const updatedBudget = signPlayer(budget, player.id, player.salary);
      return { claimedBy: teamId, updatedBudget };
    }
  }

  return { claimedBy: null, updatedBudget: null };
}

// ---------------------------------------------------------------------------
// processMarketplaceMatch
// ---------------------------------------------------------------------------

/**
 * Validate and process a marketplace transfer between two teams.
 *
 * The seller releases the player and the buyer signs at the given price.
 *
 * @param {object} player       – Player being transferred { id, name }.
 * @param {object} sellerBudget – Seller team's budget (must have the player).
 * @param {object} buyerBudget  – Buyer team's budget.
 * @param {number} price        – Transfer fee / salary to sign the player at.
 * @returns {object} { sellerBudget, buyerBudget }
 * @throws {Error} If the buyer cannot afford the player.
 */
export function processMarketplaceMatch(player, sellerBudget, buyerBudget, price) {
  if (!player || !player.id) {
    throw new Error('processMarketplaceMatch: player must have an id');
  }
  if (typeof price !== 'number' || price < 0) {
    throw new Error('processMarketplaceMatch: price must be a non-negative number');
  }
  if (!canAffordPlayer(buyerBudget, price)) {
    throw new Error(
      `processMarketplaceMatch: buyer cannot afford player at price $${price}`
    );
  }

  const newSellerBudget = releasePlayer(sellerBudget, player.id);
  const newBuyerBudget  = signPlayer(buyerBudget, player.id, price);

  return {
    sellerBudget: newSellerBudget,
    buyerBudget:  newBuyerBudget,
  };
}

// ---------------------------------------------------------------------------
// getTradeHistory
// ---------------------------------------------------------------------------

/**
 * Filter trades involving a specific team and sort by createdAt descending.
 *
 * @param {object[]} trades – Array of trade objects.
 * @param {string}   teamId – Team ID to filter by.
 * @returns {object[]} Trades where teamId is proposer or receiver,
 *   sorted most-recent first.
 */
export function getTradeHistory(trades, teamId) {
  if (!Array.isArray(trades)) return [];
  if (!teamId) return [];

  return trades
    .filter(t => t.proposingTeamId === teamId || t.receivingTeamId === teamId)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
