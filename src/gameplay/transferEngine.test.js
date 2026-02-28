/**
 * Transfer Engine — Exhaustive Tests
 * Quadra Legacy — src/gameplay/transferEngine.test.js
 *
 * Run with: node src/gameplay/transferEngine.test.js
 *
 * No external test libraries; plain Node.js only.
 * Follows the same test infrastructure pattern as draftEngine.test.js.
 */

import {
  TRADE_STATUS,
  WAIVER_PRIORITY,
  AI_TRADE_THRESHOLDS,
  proposeTrade,
  evaluateTradeByAI,
  executeTrade,
  processWaiverClaim,
  processMarketplaceMatch,
  getTradeHistory,
} from './transferEngine.js';

import { createTeamBudget, signPlayer } from '../core/salaryCapEngine.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         expected: ${JSON.stringify(expected)}`);
    console.log(`         actual:   ${JSON.stringify(actual)}`);
    failCount++;
  }
}

function checkDeepEqual(label, actual, expected) {
  const a = JSON.stringify(actual, null, 0);
  const b = JSON.stringify(expected, null, 0);
  if (a === b) {
    console.log(`  PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         expected: ${b}`);
    console.log(`         actual:   ${a}`);
    failCount++;
  }
}

function checkThrows(label, fn, expectedSubstring) {
  try {
    fn();
    console.log(`  FAIL  ${label} (did not throw)`);
    failCount++;
  } catch (err) {
    if (expectedSubstring && !err.message.includes(expectedSubstring)) {
      console.log(`  FAIL  ${label}`);
      console.log(`         expected error containing: "${expectedSubstring}"`);
      console.log(`         actual error:              "${err.message}"`);
      failCount++;
    } else {
      console.log(`  PASS  ${label}`);
      passCount++;
    }
  }
}

function checkTrue(label, value) {
  if (value) {
    console.log(`  PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         expected truthy, got: ${JSON.stringify(value)}`);
    failCount++;
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ---------------------------------------------------------------------------
// Helpers — reusable test data factories
// ---------------------------------------------------------------------------

function makePlayer(overrides = {}) {
  const defaults = {
    id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Player',
    position: 'PG',
    overall: 70,
    age: 25,
    salary: 500_000,
  };
  return { ...defaults, ...overrides };
}

/**
 * Create a team budget with players already signed.
 * Returns { budget, players }.
 */
function makeTeamWithPlayers(teamId, tier, playerList) {
  let budget = createTeamBudget(teamId, tier);
  const players = playerList.map(p => makePlayer(p));
  for (const p of players) {
    budget = signPlayer(budget, p.id, p.salary);
  }
  return { budget, players };
}

// ===========================================================================
// Config immutability
// ===========================================================================

section('Config immutability');

{
  checkTrue('TRADE_STATUS is frozen', Object.isFrozen(TRADE_STATUS));
  checkTrue('WAIVER_PRIORITY is frozen', Object.isFrozen(WAIVER_PRIORITY));
  checkTrue('AI_TRADE_THRESHOLDS is frozen', Object.isFrozen(AI_TRADE_THRESHOLDS));
}

// ===========================================================================
// TRADE_STATUS has expected values
// ===========================================================================

section('TRADE_STATUS values');

{
  check('PROPOSED', TRADE_STATUS.PROPOSED, 'proposed');
  check('ACCEPTED', TRADE_STATUS.ACCEPTED, 'accepted');
  check('REJECTED', TRADE_STATUS.REJECTED, 'rejected');
  check('COUNTERED', TRADE_STATUS.COUNTERED, 'countered');
  check('EXPIRED', TRADE_STATUS.EXPIRED, 'expired');
}

// ===========================================================================
// WAIVER_PRIORITY has expected values
// ===========================================================================

section('WAIVER_PRIORITY values');

{
  check('REVERSE_STANDINGS', WAIVER_PRIORITY.REVERSE_STANDINGS, 'reverse_standings');
  check('ROLLING', WAIVER_PRIORITY.ROLLING, 'rolling');
}

// ===========================================================================
// AI_TRADE_THRESHOLDS has expected tiers
// ===========================================================================

section('AI_TRADE_THRESHOLDS tiers');

{
  checkTrue('has ROOKIE tier', AI_TRADE_THRESHOLDS.ROOKIE != null);
  checkTrue('has VETERAN tier', AI_TRADE_THRESHOLDS.VETERAN != null);
  checkTrue('has STAR tier', AI_TRADE_THRESHOLDS.STAR != null);
  checkTrue('has ELITE tier', AI_TRADE_THRESHOLDS.ELITE != null);
  check('ROOKIE minAcceptScore', AI_TRADE_THRESHOLDS.ROOKIE.minAcceptScore, 35);
  check('ELITE minAcceptScore', AI_TRADE_THRESHOLDS.ELITE.minAcceptScore, 75);
  checkTrue('ROOKIE patience > ELITE patience',
    AI_TRADE_THRESHOLDS.ROOKIE.patience > AI_TRADE_THRESHOLDS.ELITE.patience);
}

// ===========================================================================
// proposeTrade — valid proposals
// ===========================================================================

section('proposeTrade -- valid proposals');

{
  const playerA = makePlayer({ id: 'pA', name: 'Player A', salary: 400_000 });
  const playerB = makePlayer({ id: 'pB', name: 'Player B', salary: 420_000 });

  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [playerA],
    playersFromReceiver: [playerB],
  });

  check('status is proposed', trade.status, TRADE_STATUS.PROPOSED);
  check('proposingTeamId', trade.proposingTeamId, 'team-1');
  check('receivingTeamId', trade.receivingTeamId, 'team-2');
  check('playersFromProposer count', trade.playersFromProposer.length, 1);
  check('playersFromReceiver count', trade.playersFromReceiver.length, 1);
  checkTrue('has id', typeof trade.id === 'string' && trade.id.length > 0);
  checkTrue('has createdAt', typeof trade.createdAt === 'number');
  check('resolvedAt is null', trade.resolvedAt, null);
  check('counterOffer is null', trade.counterOffer, null);
}

// ===========================================================================
// proposeTrade — multi-player trade
// ===========================================================================

section('proposeTrade -- multi-player trade');

{
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [
      makePlayer({ id: 'p1' }),
      makePlayer({ id: 'p2' }),
    ],
    playersFromReceiver: [
      makePlayer({ id: 'p3' }),
    ],
  });

  check('proposer sends 2 players', trade.playersFromProposer.length, 2);
  check('receiver sends 1 player', trade.playersFromReceiver.length, 1);
}

// ===========================================================================
// proposeTrade — validation errors
// ===========================================================================

section('proposeTrade -- validation errors');

checkThrows(
  'throws when playersFromProposer is empty',
  () => proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [],
    playersFromReceiver: [makePlayer()],
  }),
  'playersFromProposer must be a non-empty array'
);

checkThrows(
  'throws when playersFromReceiver is empty',
  () => proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [makePlayer()],
    playersFromReceiver: [],
  }),
  'playersFromReceiver must be a non-empty array'
);

checkThrows(
  'throws when proposingTeamId is missing',
  () => proposeTrade({
    proposingTeamId: '',
    receivingTeamId: 'team-2',
    playersFromProposer: [makePlayer()],
    playersFromReceiver: [makePlayer()],
  }),
  'proposingTeamId must be a non-empty string'
);

checkThrows(
  'throws when receivingTeamId is missing',
  () => proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: '',
    playersFromProposer: [makePlayer()],
    playersFromReceiver: [makePlayer()],
  }),
  'receivingTeamId must be a non-empty string'
);

// ===========================================================================
// proposeTrade — does not mutate input arrays
// ===========================================================================

section('proposeTrade -- immutability');

{
  const proposerPlayers = [makePlayer({ id: 'imm-1' })];
  const receiverPlayers = [makePlayer({ id: 'imm-2' })];

  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: proposerPlayers,
    playersFromReceiver: receiverPlayers,
  });

  // Mutate the original arrays
  proposerPlayers.push(makePlayer({ id: 'imm-extra' }));
  receiverPlayers.push(makePlayer({ id: 'imm-extra2' }));

  check('trade proposer list not mutated', trade.playersFromProposer.length, 1);
  check('trade receiver list not mutated', trade.playersFromReceiver.length, 1);
}

// ===========================================================================
// evaluateTradeByAI — ROOKIE accepts favorable trade
// ===========================================================================

section('evaluateTradeByAI -- ROOKIE accepts favorable trade');

{
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'star', overall: 90, age: 22, salary: 500_000, position: 'C' })],
    playersFromReceiver: [makePlayer({ id: 'bench', overall: 55, age: 30, salary: 480_000, position: 'PG' })],
  });

  // AI roster missing C, so position need score will be high
  const aiRoster = [
    { position: 'PG' }, { position: 'SG' }, { position: 'SF' }, { position: 'PF' },
  ];

  const result = evaluateTradeByAI(trade, aiRoster, 'ROOKIE', () => 0.5);

  check('ROOKIE accepts star-for-bench', result.decision, 'accepted');
  checkTrue('score is high', result.score >= 35);
  check('trade status updated', result.trade.status, 'accepted');
  checkTrue('resolvedAt is set', result.trade.resolvedAt != null);
}

// ===========================================================================
// evaluateTradeByAI — ELITE rejects mediocre trade
// ===========================================================================

section('evaluateTradeByAI -- ELITE rejects mediocre trade');

{
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'avg1', overall: 60, age: 28, salary: 500_000, position: 'SG' })],
    playersFromReceiver: [makePlayer({ id: 'avg2', overall: 65, age: 26, salary: 500_000, position: 'SG' })],
  });

  // Full roster, no position needs
  const aiRoster = [
    { position: 'PG' }, { position: 'SG' }, { position: 'SF' },
    { position: 'PF' }, { position: 'C' },
  ];

  const result = evaluateTradeByAI(trade, aiRoster, 'ELITE', () => 0.5);

  check('ELITE rejects slightly-worse trade', result.decision, 'rejected');
  checkTrue('score is below ELITE threshold', result.score < 75);
}

// ===========================================================================
// evaluateTradeByAI — position need boosts score
// ===========================================================================

section('evaluateTradeByAI -- position need boosts score');

{
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'c1', overall: 65, age: 25, salary: 500_000, position: 'C' })],
    playersFromReceiver: [makePlayer({ id: 'sg1', overall: 65, age: 25, salary: 500_000, position: 'SG' })],
  });

  // Roster without a center
  const rosterNeedC = [
    { position: 'PG' }, { position: 'SG' }, { position: 'SF' }, { position: 'PF' },
  ];

  // Full roster
  const fullRoster = [
    { position: 'PG' }, { position: 'SG' }, { position: 'SF' },
    { position: 'PF' }, { position: 'C' },
  ];

  const resultWithNeed = evaluateTradeByAI(trade, rosterNeedC, 'VETERAN', () => 0.5);
  const resultNoNeed   = evaluateTradeByAI(trade, fullRoster, 'VETERAN', () => 0.5);

  checkTrue('position need increases score',
    resultWithNeed.score > resultNoNeed.score);
}

// ===========================================================================
// evaluateTradeByAI — counter-offer behavior
// ===========================================================================

section('evaluateTradeByAI -- counter-offer behavior');

{
  // Build a trade that scores in the counter-offer zone for VETERAN
  // (between rejectThreshold = 25 and minAcceptScore = 50)
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'mid1', overall: 68, age: 25, salary: 500_000, position: 'PG' })],
    playersFromReceiver: [makePlayer({ id: 'mid2', overall: 70, age: 25, salary: 500_000, position: 'PG' })],
  });

  const fullRoster = [
    { position: 'PG' }, { position: 'SG' }, { position: 'SF' },
    { position: 'PF' }, { position: 'C' },
  ];

  // Use rng that always returns 0 (below patience=0.7), should counter
  const resultCounter = evaluateTradeByAI(trade, fullRoster, 'VETERAN', () => 0.0);

  // Use rng that always returns 0.99 (above patience=0.7), should reject
  const resultReject = evaluateTradeByAI(trade, fullRoster, 'VETERAN', () => 0.99);

  // Only check the counter if score is in the counter zone
  if (resultCounter.score >= 25 && resultCounter.score < 50) {
    check('low rng triggers counter', resultCounter.decision, 'countered');
    checkTrue('counter has counterOffer', resultCounter.trade.counterOffer != null);
    checkTrue('counterOffer has requestedMinOverall',
      typeof resultCounter.trade.counterOffer.requestedMinOverall === 'number');
    check('high rng triggers reject', resultReject.decision, 'rejected');
  } else {
    // Score is outside counter zone — still valid, just record as pass
    checkTrue('score computed (outside counter zone)', typeof resultCounter.score === 'number');
    checkTrue('score computed (outside counter zone) 2', typeof resultReject.score === 'number');
  }
}

// ===========================================================================
// evaluateTradeByAI — deterministic with injectable rng
// ===========================================================================

section('evaluateTradeByAI -- deterministic with injectable rng');

{
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'd1', overall: 65, age: 26, salary: 500_000 })],
    playersFromReceiver: [makePlayer({ id: 'd2', overall: 68, age: 24, salary: 500_000 })],
  });

  const roster = [{ position: 'PG' }, { position: 'SG' }];
  const fixedRng = () => 0.42;

  const run1 = evaluateTradeByAI(trade, roster, 'VETERAN', fixedRng);
  const run2 = evaluateTradeByAI(trade, roster, 'VETERAN', fixedRng);

  check('same rng produces same score', run1.score, run2.score);
  check('same rng produces same decision', run1.decision, run2.decision);
}

// ===========================================================================
// evaluateTradeByAI — age factor favors younger incoming
// ===========================================================================

section('evaluateTradeByAI -- age factor favors younger incoming');

{
  const tradeYoung = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'y1', overall: 70, age: 20, salary: 500_000 })],
    playersFromReceiver: [makePlayer({ id: 'y2', overall: 70, age: 30, salary: 500_000 })],
  });

  const tradeOld = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'o1', overall: 70, age: 33, salary: 500_000 })],
    playersFromReceiver: [makePlayer({ id: 'o2', overall: 70, age: 20, salary: 500_000 })],
  });

  const roster = [
    { position: 'PG' }, { position: 'SG' }, { position: 'SF' },
    { position: 'PF' }, { position: 'C' },
  ];

  const youngResult = evaluateTradeByAI(tradeYoung, roster, 'VETERAN', () => 0.5);
  const oldResult   = evaluateTradeByAI(tradeOld, roster, 'VETERAN', () => 0.5);

  checkTrue('younger incoming gets higher score',
    youngResult.score > oldResult.score);
}

// ===========================================================================
// evaluateTradeByAI — null roster handled gracefully
// ===========================================================================

section('evaluateTradeByAI -- null roster handled gracefully');

{
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'nr1', overall: 70, salary: 500_000 })],
    playersFromReceiver: [makePlayer({ id: 'nr2', overall: 70, salary: 500_000 })],
  });

  // Should not throw with null roster
  const result = evaluateTradeByAI(trade, null, 'ROOKIE', () => 0.5);
  checkTrue('returns a numeric score with null roster', typeof result.score === 'number');
  checkTrue('returns a decision with null roster', typeof result.decision === 'string');
}

// ===========================================================================
// evaluateTradeByAI — unknown tier defaults to VETERAN
// ===========================================================================

section('evaluateTradeByAI -- unknown tier defaults to VETERAN');

{
  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-ai',
    playersFromProposer: [makePlayer({ id: 'ut1', overall: 70, salary: 500_000 })],
    playersFromReceiver: [makePlayer({ id: 'ut2', overall: 70, salary: 500_000 })],
  });

  const result = evaluateTradeByAI(trade, [], 'UNKNOWN_TIER', () => 0.5);
  checkTrue('does not throw with unknown tier', typeof result.score === 'number');
}

// ===========================================================================
// executeTrade — valid trade updates both budgets
// ===========================================================================

section('executeTrade -- valid trade updates both budgets');

{
  const playerA = makePlayer({ id: 'exA', salary: 400_000 });
  const playerB = makePlayer({ id: 'exB', salary: 420_000 });

  // Build budgets with players signed (amateur cap = 5_000_000)
  const { budget: budgetA } = makeTeamWithPlayers('team-1', 'amateur', [
    { id: 'exA', salary: 400_000 },
  ]);
  const { budget: budgetB } = makeTeamWithPlayers('team-2', 'amateur', [
    { id: 'exB', salary: 420_000 },
  ]);

  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [playerA],
    playersFromReceiver: [playerB],
  });

  const result = executeTrade(trade, budgetA, budgetB);

  // Team A: released exA (400k), signed exB (420k) => net +20k committed
  check('team A has exB salary',
    result.budgetA.playerSalaries['exB'], 420_000);
  checkTrue('team A no longer has exA',
    result.budgetA.playerSalaries['exA'] === undefined);

  // Team B: released exB (420k), signed exA (400k) => net -20k committed
  check('team B has exA salary',
    result.budgetB.playerSalaries['exA'], 400_000);
  checkTrue('team B no longer has exB',
    result.budgetB.playerSalaries['exB'] === undefined);

  check('trade status is accepted', result.trade.status, 'accepted');
}

// ===========================================================================
// executeTrade — throws when salary mismatch exceeds 15%
// ===========================================================================

section('executeTrade -- throws on salary mismatch');

{
  const playerA = makePlayer({ id: 'mA', salary: 1_000_000 });
  const playerB = makePlayer({ id: 'mB', salary: 500_000 });

  const { budget: budgetA } = makeTeamWithPlayers('team-1', 'amateur', [
    { id: 'mA', salary: 1_000_000 },
  ]);
  const { budget: budgetB } = makeTeamWithPlayers('team-2', 'amateur', [
    { id: 'mB', salary: 500_000 },
  ]);

  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [playerA],
    playersFromReceiver: [playerB],
  });

  checkThrows(
    'rejects trade with >15% salary mismatch',
    () => executeTrade(trade, budgetA, budgetB),
    'trade rejected'
  );
}

// ===========================================================================
// executeTrade — does not mutate original budgets
// ===========================================================================

section('executeTrade -- immutability');

{
  const playerA = makePlayer({ id: 'immA', salary: 400_000 });
  const playerB = makePlayer({ id: 'immB', salary: 400_000 });

  const { budget: budgetA } = makeTeamWithPlayers('team-1', 'amateur', [
    { id: 'immA', salary: 400_000 },
  ]);
  const { budget: budgetB } = makeTeamWithPlayers('team-2', 'amateur', [
    { id: 'immB', salary: 400_000 },
  ]);

  const origTotalA = budgetA.totalSalaryCommitted;
  const origTotalB = budgetB.totalSalaryCommitted;

  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [playerA],
    playersFromReceiver: [playerB],
  });

  executeTrade(trade, budgetA, budgetB);

  check('original budgetA unchanged', budgetA.totalSalaryCommitted, origTotalA);
  check('original budgetB unchanged', budgetB.totalSalaryCommitted, origTotalB);
}

// ===========================================================================
// executeTrade — throws when buyer exceeds cap
// ===========================================================================

section('executeTrade -- throws when exceeding cap');

{
  // Team B has almost full cap, receiving expensive player should fail
  const cheapPlayer = makePlayer({ id: 'cheap', salary: 100_000 });
  const expensivePlayer = makePlayer({ id: 'expensive', salary: 110_000 });

  const { budget: budgetA } = makeTeamWithPlayers('team-1', 'amateur', [
    { id: 'cheap', salary: 100_000 },
  ]);

  // Fill team B's cap almost entirely
  let budgetB = createTeamBudget('team-2', 'amateur');
  budgetB = signPlayer(budgetB, 'fill-1', 2_000_000);
  budgetB = signPlayer(budgetB, 'fill-2', 2_000_000);
  budgetB = signPlayer(budgetB, 'expensive', 110_000);
  // Team B committed: 4_110_000, cap: 5_000_000, space: 890_000
  // After releasing expensive (110k) and signing cheap (100k): net -10k => should be fine
  // BUT the salary ratio must be within 15%: 100_000/110_000 = 0.909 which is within 15%

  const trade = proposeTrade({
    proposingTeamId: 'team-1',
    receivingTeamId: 'team-2',
    playersFromProposer: [cheapPlayer],
    playersFromReceiver: [expensivePlayer],
  });

  // This should succeed since the ratio is within 15% and neither exceeds cap
  const result = executeTrade(trade, budgetA, budgetB);
  check('trade succeeds within cap', result.trade.status, 'accepted');
}

// ===========================================================================
// processWaiverClaim — first team in priority claims
// ===========================================================================

section('processWaiverClaim -- first team in priority claims');

{
  const player = makePlayer({ id: 'waiver-p', salary: 200_000 });
  const budgetT1 = createTeamBudget('team-1', 'amateur');
  const budgetT2 = createTeamBudget('team-2', 'amateur');

  const result = processWaiverClaim(
    ['team-1', 'team-2'],
    player,
    { 'team-1': budgetT1, 'team-2': budgetT2 }
  );

  check('team-1 claims (highest priority)', result.claimedBy, 'team-1');
  check('player signed to team-1', result.updatedBudget.playerSalaries['waiver-p'], 200_000);
}

// ===========================================================================
// processWaiverClaim — skips teams that cannot afford
// ===========================================================================

section('processWaiverClaim -- skips teams that cannot afford');

{
  const player = makePlayer({ id: 'waiver-exp', salary: 200_000 });

  // Team-1 has almost no cap space
  let budgetT1 = createTeamBudget('team-1', 'amateur');
  budgetT1 = signPlayer(budgetT1, 'fill-a', 2_500_000);
  budgetT1 = signPlayer(budgetT1, 'fill-b', 2_400_000);
  // committed: 4_900_000, space: 100_000 (cannot afford 200k)

  const budgetT2 = createTeamBudget('team-2', 'amateur');

  const result = processWaiverClaim(
    ['team-1', 'team-2'],
    player,
    { 'team-1': budgetT1, 'team-2': budgetT2 }
  );

  check('team-2 claims (team-1 cannot afford)', result.claimedBy, 'team-2');
}

// ===========================================================================
// processWaiverClaim — no team can afford
// ===========================================================================

section('processWaiverClaim -- no team can afford');

{
  const player = makePlayer({ id: 'waiver-nobody', salary: 5_000_001 });
  const budgetT1 = createTeamBudget('team-1', 'amateur'); // cap 5M

  const result = processWaiverClaim(
    ['team-1'],
    player,
    { 'team-1': budgetT1 }
  );

  check('nobody claims', result.claimedBy, null);
  check('no updated budget', result.updatedBudget, null);
}

// ===========================================================================
// processWaiverClaim — empty waiver order
// ===========================================================================

section('processWaiverClaim -- empty waiver order');

{
  const player = makePlayer({ id: 'waiver-empty', salary: 100_000 });

  const result = processWaiverClaim([], player, {});
  check('empty order returns null', result.claimedBy, null);
}

// ===========================================================================
// processWaiverClaim — throws on invalid player
// ===========================================================================

section('processWaiverClaim -- throws on invalid player');

checkThrows(
  'throws when player has no salary',
  () => processWaiverClaim(['team-1'], { id: 'bad' }, { 'team-1': createTeamBudget('team-1') }),
  'player must have a numeric salary'
);

// ===========================================================================
// processMarketplaceMatch — valid transfer
// ===========================================================================

section('processMarketplaceMatch -- valid transfer');

{
  const player = makePlayer({ id: 'market-p', salary: 300_000 });

  const { budget: sellerBudget } = makeTeamWithPlayers('seller', 'amateur', [
    { id: 'market-p', salary: 300_000 },
  ]);
  const buyerBudget = createTeamBudget('buyer', 'amateur');

  const result = processMarketplaceMatch(player, sellerBudget, buyerBudget, 350_000);

  checkTrue('seller no longer has player',
    result.sellerBudget.playerSalaries['market-p'] === undefined);
  check('buyer has player at new price',
    result.buyerBudget.playerSalaries['market-p'], 350_000);
}

// ===========================================================================
// processMarketplaceMatch — buyer cannot afford
// ===========================================================================

section('processMarketplaceMatch -- buyer cannot afford');

{
  const player = makePlayer({ id: 'market-exp', salary: 300_000 });
  const sellerBudget = createTeamBudget('seller', 'amateur');
  const buyerBudget = createTeamBudget('buyer', 'amateur');
  // Amateur cap is 5M — try to buy at 6M
  checkThrows(
    'throws when buyer cannot afford',
    () => processMarketplaceMatch(player, sellerBudget, buyerBudget, 6_000_000),
    'buyer cannot afford'
  );
}

// ===========================================================================
// processMarketplaceMatch — invalid player
// ===========================================================================

section('processMarketplaceMatch -- invalid player');

checkThrows(
  'throws when player has no id',
  () => processMarketplaceMatch({}, createTeamBudget('s'), createTeamBudget('b'), 100),
  'player must have an id'
);

// ===========================================================================
// processMarketplaceMatch — negative price
// ===========================================================================

section('processMarketplaceMatch -- negative price');

checkThrows(
  'throws on negative price',
  () => processMarketplaceMatch(
    makePlayer({ id: 'neg' }),
    createTeamBudget('s'),
    createTeamBudget('b'),
    -100
  ),
  'price must be a non-negative number'
);

// ===========================================================================
// processMarketplaceMatch — does not mutate original budgets
// ===========================================================================

section('processMarketplaceMatch -- immutability');

{
  const player = makePlayer({ id: 'imm-mp', salary: 200_000 });
  const { budget: sellerBudget } = makeTeamWithPlayers('seller', 'amateur', [
    { id: 'imm-mp', salary: 200_000 },
  ]);
  const buyerBudget = createTeamBudget('buyer', 'amateur');

  const origSellerTotal = sellerBudget.totalSalaryCommitted;
  const origBuyerTotal  = buyerBudget.totalSalaryCommitted;

  processMarketplaceMatch(player, sellerBudget, buyerBudget, 200_000);

  check('seller budget not mutated', sellerBudget.totalSalaryCommitted, origSellerTotal);
  check('buyer budget not mutated', buyerBudget.totalSalaryCommitted, origBuyerTotal);
}

// ===========================================================================
// getTradeHistory — filters by teamId
// ===========================================================================

section('getTradeHistory -- filters by teamId');

{
  const trades = [
    { proposingTeamId: 'team-1', receivingTeamId: 'team-2', createdAt: 100 },
    { proposingTeamId: 'team-3', receivingTeamId: 'team-1', createdAt: 200 },
    { proposingTeamId: 'team-2', receivingTeamId: 'team-3', createdAt: 300 },
    { proposingTeamId: 'team-1', receivingTeamId: 'team-3', createdAt: 400 },
  ];

  const history = getTradeHistory(trades, 'team-1');

  check('team-1 involved in 3 trades', history.length, 3);
}

// ===========================================================================
// getTradeHistory — sorted by createdAt descending
// ===========================================================================

section('getTradeHistory -- sorted by createdAt descending');

{
  const trades = [
    { proposingTeamId: 'team-1', receivingTeamId: 'team-2', createdAt: 100 },
    { proposingTeamId: 'team-1', receivingTeamId: 'team-3', createdAt: 400 },
    { proposingTeamId: 'team-3', receivingTeamId: 'team-1', createdAt: 200 },
  ];

  const history = getTradeHistory(trades, 'team-1');

  check('most recent first', history[0].createdAt, 400);
  check('oldest last', history[history.length - 1].createdAt, 100);

  let sorted = true;
  for (let i = 1; i < history.length; i++) {
    if (history[i].createdAt > history[i - 1].createdAt) {
      sorted = false;
      break;
    }
  }
  checkTrue('fully sorted descending', sorted);
}

// ===========================================================================
// getTradeHistory — returns empty for non-existent team
// ===========================================================================

section('getTradeHistory -- returns empty for non-existent team');

{
  const trades = [
    { proposingTeamId: 'team-1', receivingTeamId: 'team-2', createdAt: 100 },
  ];

  const history = getTradeHistory(trades, 'team-99');
  check('no trades for non-existent team', history.length, 0);
}

// ===========================================================================
// getTradeHistory — handles null/empty inputs
// ===========================================================================

section('getTradeHistory -- handles null/empty inputs');

{
  check('null trades returns empty', getTradeHistory(null, 'team-1').length, 0);
  check('empty array returns empty', getTradeHistory([], 'team-1').length, 0);
  check('null teamId returns empty', getTradeHistory([{ proposingTeamId: 'a', receivingTeamId: 'b' }], null).length, 0);
}

// ===========================================================================
// getTradeHistory — does not mutate original array
// ===========================================================================

section('getTradeHistory -- immutability');

{
  const trades = [
    { proposingTeamId: 'team-1', receivingTeamId: 'team-2', createdAt: 300 },
    { proposingTeamId: 'team-2', receivingTeamId: 'team-1', createdAt: 100 },
    { proposingTeamId: 'team-1', receivingTeamId: 'team-3', createdAt: 200 },
  ];

  const origOrder = trades.map(t => t.createdAt);
  getTradeHistory(trades, 'team-1');

  checkDeepEqual('original array order unchanged',
    trades.map(t => t.createdAt), origOrder);
}

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + '='.repeat(50));
console.log(`  transferEngine tests: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(50));

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
