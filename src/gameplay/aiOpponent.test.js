/**
 * AIOpponent Tests — Quadra Legacy
 *
 * Run with: node src/gameplay/aiOpponent.test.js
 *
 * Tests cover all AI tiers, edge cases, and the Amateur behaviour rules
 * specified in MOBILE_GAME_MASTER_PLAN.md Section 6.10.
 */

import { AIOpponent, AI_TIERS } from './aiOpponent.js';

// ---------------------------------------------------------------------------
// Simple assertion helpers (no test framework dependency)
// ---------------------------------------------------------------------------

let passed  = 0;
let failed  = 0;
let section = '';

function describe(name) {
  section = name;
  console.log(`\n${name}`);
  console.log('-'.repeat(60));
}

function assert(condition, message) {
  const label = `  [${section}] ${message}`;
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

function assertApprox(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message} (actual=${actual}, expected~${expected})`);
}

// ---------------------------------------------------------------------------
// Player factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal old-format player (player.js style: skillLevel 1-5).
 */
function makeOldPlayer(name, position, skillLevel = 3) {
  return {
    name,
    position,
    skillLevel,
    isActive: true,
    id: name,  // use name as id for old-format players
    stats: { pointsScored: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, fouls: 0 },
  };
}

/**
 * Create a new-format player (playerCreator.js style: .attributes map).
 */
function makeNewPlayer(name, position, attrs = {}) {
  const defaults = {
    Attack: 60, Defense: 60, ThreePoint: 60, Stamina: 70,
    Chemistry: 60, Morale: 60, Potential: 90, FieldGoal: 60,
    FieldGoalPaint: 60, FieldGoalMidRange: 60, DunkLayup: 60,
    FreeThrow: 70, Passing: 60, StealMarking: 60, Blocking: 50,
  };
  return {
    id:         name,
    name,
    position,
    isActive:   true,
    attributes: Object.assign({}, defaults, attrs),
    skillLevel: 3,
    stats:      { pointsScored: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, fouls: 0 },
  };
}

/**
 * Build a standard 5-player roster with one of each position.
 */
function makeStandardRoster() {
  return [
    makeNewPlayer('PG-Player', 'PG', { Attack: 75 }),
    makeNewPlayer('SG-Player', 'SG', { Attack: 70 }),
    makeNewPlayer('SF-Player', 'SF', { Attack: 65 }),
    makeNewPlayer('PF-Player', 'PF', { Attack: 60 }),
    makeNewPlayer('C-Player',  'C',  { Attack: 55 }),
  ];
}

/**
 * Build a minimal gameState for tests.
 */
function makeGameState(overrides = {}) {
  return Object.assign({
    round:            50,
    quarter:          2,
    scoreDiff:        0,
    teamPlayers:      makeStandardRoster(),
    opponentPlayers:  makeStandardRoster(),
    possession:       'home',
    possessionCount:  {},
  }, overrides);
}

// ---------------------------------------------------------------------------
// SECTION: ROOKIE AI
// ---------------------------------------------------------------------------

describe('ROOKIE AI — basic contract');

{
  const ai  = new AIOpponent(AI_TIERS.ROOKIE);
  const gs  = makeGameState();
  const dec = ai.makeDecision(gs);

  assert(dec !== null && typeof dec === 'object',
    'makeDecision returns a non-null object');

  assert(gs.teamPlayers.includes(dec.ballCarrier),
    'ROOKIE: ballCarrier is one of the active teamPlayers');

  assert(dec.shotType === '2pt' || dec.shotType === '3pt',
    'ROOKIE: shotType is either 2pt or 3pt');

  assert(dec.preferredTarget === null,
    'ROOKIE: preferredTarget is null (no pass logic)');

  assert(typeof dec.reasoning === 'string' && dec.reasoning.length > 0,
    'ROOKIE: reasoning is a non-empty string');

  assert(dec.reasoning === 'Random selection',
    'ROOKIE: reasoning is exactly "Random selection"');
}

// ---------------------------------------------------------------------------
// SECTION: ROOKIE AI — runs over multiple possessions
// ---------------------------------------------------------------------------

describe('ROOKIE AI — multiple possessions');

{
  const ai     = new AIOpponent(AI_TIERS.ROOKIE);
  const gs     = makeGameState();
  let   has2pt = false;
  let   has3pt = false;

  for (let i = 0; i < 30; i++) {
    const dec = ai.makeDecision(gs);
    if (dec.shotType === '2pt') has2pt = true;
    if (dec.shotType === '3pt') has3pt = true;
  }

  assert(has2pt, 'ROOKIE: 2pt shot type appears across 30 trials');
  assert(has3pt, 'ROOKIE: 3pt shot type appears across 30 trials');
}

// ---------------------------------------------------------------------------
// SECTION: ROOKIE AI — edge case: single active player
// ---------------------------------------------------------------------------

describe('ROOKIE AI — edge case: single active player');

{
  const ai          = new AIOpponent(AI_TIERS.ROOKIE);
  const onlyPlayer  = makeNewPlayer('Solo', 'PG');
  const gs          = makeGameState({ teamPlayers: [onlyPlayer] });
  const dec         = ai.makeDecision(gs);

  assert(dec !== null, 'Single player: decision is returned');
  assert(dec.ballCarrier === onlyPlayer,
    'Single player: the only available player is always selected');
  assert(dec.shotType === '2pt' || dec.shotType === '3pt',
    'Single player: valid shotType returned');
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — basic contract (all required fields)
// ---------------------------------------------------------------------------

describe('AMATEUR AI — decision shape');

{
  const ai  = new AIOpponent(AI_TIERS.AMATEUR);
  const gs  = makeGameState();
  const dec = ai.makeDecision(gs);

  assert(dec !== null && typeof dec === 'object', 'makeDecision returns object');
  assert('ballCarrier'     in dec, 'ballCarrier field present');
  assert('shotType'        in dec, 'shotType field present');
  assert('preferredTarget' in dec, 'preferredTarget field present');
  assert('reasoning'       in dec, 'reasoning field present');

  assert(gs.teamPlayers.includes(dec.ballCarrier),
    'AMATEUR: ballCarrier is from teamPlayers');
  assert(dec.shotType === '2pt' || dec.shotType === '3pt',
    'AMATEUR: shotType is valid');
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — C and PF never shoot 3pt
// ---------------------------------------------------------------------------

describe('AMATEUR AI — inside positions never shoot 3pt');

{
  const ai           = new AIOpponent(AI_TIERS.AMATEUR);
  const insidePlayers = [
    makeNewPlayer('BigMan-C',  'C',  { Attack: 99 }),
    makeNewPlayer('BigMan-PF', 'PF', { Attack: 99 }),
  ];

  // Force possession players to be only inside players
  let centerAttempted3pt = false;
  let pfAttempted3pt     = false;

  for (let i = 0; i < 50; i++) {
    // Test C
    const gsC = makeGameState({
      teamPlayers: [insidePlayers[0]],
    });
    const decC = ai.makeDecision(gsC);
    if (decC.shotType === '3pt') centerAttempted3pt = true;

    // Test PF
    const gsPF = makeGameState({
      teamPlayers: [insidePlayers[1]],
    });
    const decPF = ai.makeDecision(gsPF);
    if (decPF.shotType === '3pt') pfAttempted3pt = true;
  }

  assert(!centerAttempted3pt,
    'AMATEUR: C never receives shotType="3pt" (50 trials)');
  assert(!pfAttempted3pt,
    'AMATEUR: PF never receives shotType="3pt" (50 trials)');
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — desperate 3pt rate when down 7 in Q4
// ---------------------------------------------------------------------------

describe('AMATEUR AI — down 7 in Q4 triggers high 3pt rate');

{
  const ai       = new AIOpponent(AI_TIERS.AMATEUR);
  const pgOnly   = [makeNewPlayer('PG-Gunner', 'PG')];
  const gsDown7  = makeGameState({
    quarter:     4,
    scoreDiff:   -7, // losing by 7
    teamPlayers: pgOnly,
  });

  const TRIALS     = 40; // large enough for 80% rate to reliably show > 60%
  let   threeCount = 0;

  for (let i = 0; i < TRIALS; i++) {
    const dec = ai.makeDecision(gsDown7);
    if (dec.shotType === '3pt') threeCount++;
  }

  const rate = threeCount / TRIALS;
  assert(rate > 0.60,
    `AMATEUR: down 7 in Q4 produces 3pt rate > 60% (actual: ${(rate * 100).toFixed(1)}%)`);
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — protecting big lead in Q4 produces fewer 3s
// ---------------------------------------------------------------------------

describe('AMATEUR AI — up 11 in Q4 triggers conservative shot selection');

{
  const ai       = new AIOpponent(AI_TIERS.AMATEUR);
  const pgOnly   = [makeNewPlayer('PG-Careful', 'PG')];
  const gsUp11   = makeGameState({
    quarter:     4,
    scoreDiff:   11,
    teamPlayers: pgOnly,
  });

  const TRIALS     = 40;
  let   threeCount = 0;

  for (let i = 0; i < TRIALS; i++) {
    const dec = ai.makeDecision(gsUp11);
    if (dec.shotType === '3pt') threeCount++;
  }

  const rate = threeCount / TRIALS;
  assert(rate < 0.50,
    `AMATEUR: up 11 in Q4 produces 3pt rate < 50% (actual: ${(rate * 100).toFixed(1)}%)`);
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — PG is selected more often than C
// ---------------------------------------------------------------------------

describe('AMATEUR AI — PG weighted higher than C');

{
  const ai = new AIOpponent(AI_TIERS.AMATEUR);

  // Give PG and C identical Attack so the only differential is position weight
  const pg = makeNewPlayer('PG-Test', 'PG', { Attack: 70 });
  const c  = makeNewPlayer('C-Test',  'C',  { Attack: 70 });

  const twoPlayerRoster = [pg, c];
  const TRIALS          = 100;
  let   pgCount         = 0;
  let   cCount          = 0;

  for (let i = 0; i < TRIALS; i++) {
    const gs  = makeGameState({ teamPlayers: twoPlayerRoster, possessionCount: {} });
    const dec = ai.makeDecision(gs);
    if (dec.ballCarrier === pg) pgCount++;
    if (dec.ballCarrier === c)  cCount++;
  }

  assert(pgCount > cCount,
    `AMATEUR: PG selected more than C over ${TRIALS} trials (PG=${pgCount}, C=${cCount})`);
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — distribution rule kicks in after heavy usage
// ---------------------------------------------------------------------------

describe('AMATEUR AI — distribution prevents one player dominating');

{
  const ai     = new AIOpponent(AI_TIERS.AMATEUR);
  const roster = makeStandardRoster();
  const pg     = roster[0]; // PG has highest attack

  // Pre-load possessionCount to show PG has had the ball 6 times, others 0
  const possessionCount = {};
  possessionCount[pg.id] = 6;

  const TRIALS      = 30;
  let   pgSelected  = 0;

  for (let i = 0; i < TRIALS; i++) {
    const gs  = makeGameState({ teamPlayers: roster, possessionCount });
    const dec = ai.makeDecision(gs);
    if (dec.ballCarrier === pg) pgSelected++;
  }

  // The distribution rule should shift some selections away from the heavy-use player
  const pgSelectionRate = pgSelected / TRIALS;
  assert(pgSelectionRate < 0.90,
    `AMATEUR: heavy-use PG (6 possessions) is not given 100% selection (rate=${(pgSelectionRate * 100).toFixed(1)}%)`);
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — shouldSubstitute flags over-used player
// ---------------------------------------------------------------------------

describe('AMATEUR AI — shouldSubstitute flags heavy ball carrier');

{
  const ai     = new AIOpponent(AI_TIERS.AMATEUR);
  const roster = makeStandardRoster();
  const gs     = makeGameState({ quarter: 1, teamPlayers: roster });

  // Simulate 8 consecutive possessions for the first player
  for (let i = 0; i < 8; i++) {
    ai.makeDecision({
      ...gs,
      teamPlayers:     [roster[0]],  // force selection of player 0
      possessionCount: {},
    });
    // Manually pump the quarter count (since we're forcing single-player selection)
    // Actually, we rely on makeDecision to update _quarterCounts naturally.
    // Re-run with full roster so the tracker counts them
  }

  // Now run again with full roster so the AI can pick player 0 and accumulate counts
  const ai2     = new AIOpponent(AI_TIERS.AMATEUR);
  const player0 = roster[0];

  for (let i = 0; i < 8; i++) {
    // The only player available is player0, AI MUST pick them
    ai2.makeDecision({
      ...gs,
      teamPlayers: [player0],
    });
  }

  // Now check substitution with full roster available
  const subGs = makeGameState({ quarter: 1, teamPlayers: roster });
  const wantsSub = ai2.shouldSubstitute(subGs);

  assert(wantsSub === true,
    'AMATEUR: shouldSubstitute returns true after one player carries the ball 8+ times in a quarter');
}

// ---------------------------------------------------------------------------
// SECTION: AMATEUR AI — shouldSubstitute returns false for ROOKIE tier
// ---------------------------------------------------------------------------

describe('ROOKIE AI — shouldSubstitute always false');

{
  const ai     = new AIOpponent(AI_TIERS.ROOKIE);
  const roster = makeStandardRoster();

  // Simulate heavy use of player 0
  for (let i = 0; i < 10; i++) {
    ai.makeDecision(makeGameState({ teamPlayers: [roster[0]] }));
  }

  const wantsSub = ai.shouldSubstitute(makeGameState({ teamPlayers: roster }));
  assert(wantsSub === false,
    'ROOKIE: shouldSubstitute always returns false regardless of usage');
}

// ---------------------------------------------------------------------------
// SECTION: PRO / ELITE / LEGEND tiers — basic contract (stubs calling AMATEUR)
// ---------------------------------------------------------------------------

describe('PRO / ELITE / LEGEND tiers — stub returns valid decision');

{
  for (const [tierName, tierVal] of [
    ['PRO',    AI_TIERS.PRO],
    ['ELITE',  AI_TIERS.ELITE],
    ['LEGEND', AI_TIERS.LEGEND],
  ]) {
    const ai  = new AIOpponent(tierVal);
    const dec = ai.makeDecision(makeGameState());

    assert(dec !== null && typeof dec === 'object',
      `${tierName}: makeDecision returns object`);
    assert('ballCarrier' in dec && 'shotType' in dec,
      `${tierName}: decision has required ballCarrier and shotType fields`);
    assert(dec.shotType === '2pt' || dec.shotType === '3pt',
      `${tierName}: shotType is valid`);
  }
}

// ---------------------------------------------------------------------------
// SECTION: evaluatePlayerFatigue
// ---------------------------------------------------------------------------

describe('evaluatePlayerFatigue — returns 0.0–1.0');

{
  const ai     = new AIOpponent(AI_TIERS.AMATEUR);
  const player = makeNewPlayer('Tired', 'PG', { Stamina: 40 });

  const fresh = ai.evaluatePlayerFatigue(player, 0);
  assert(fresh >= 0 && fresh <= 1.0,
    `evaluatePlayerFatigue for fresh player is in [0,1] (value=${fresh})`);

  // Simulate heavy carry usage (pump up internal quarter count)
  for (let i = 0; i < 8; i++) {
    ai.makeDecision(makeGameState({ teamPlayers: [player] }));
  }

  const tired = ai.evaluatePlayerFatigue(player, 40);
  assert(tired > fresh,
    `evaluatePlayerFatigue after heavy usage is higher than fresh (tired=${tired.toFixed(2)}, fresh=${fresh.toFixed(2)})`);
  assert(tired <= 1.0,
    'evaluatePlayerFatigue never exceeds 1.0');
}

// ---------------------------------------------------------------------------
// SECTION: selectBestShooter
// ---------------------------------------------------------------------------

describe('selectBestShooter — picks highest-rated player for shot type');

{
  const ai      = new AIOpponent(AI_TIERS.AMATEUR);
  const players = [
    makeNewPlayer('Avg',  'SG', { Attack: 60, ThreePoint: 55 }),
    makeNewPlayer('Best', 'PG', { Attack: 90, ThreePoint: 88 }),
    makeNewPlayer('Weak', 'SF', { Attack: 40, ThreePoint: 35 }),
  ];

  const best2pt = ai.selectBestShooter(players, '2pt');
  assert(best2pt.name === 'Best',
    'selectBestShooter(2pt): returns player with highest Attack');

  const best3pt = ai.selectBestShooter(players, '3pt');
  assert(best3pt.name === 'Best',
    'selectBestShooter(3pt): returns player with highest ThreePoint');
}

// ---------------------------------------------------------------------------
// SECTION: getPlayersForPossession alias
// ---------------------------------------------------------------------------

describe('getPlayersForPossession — alias for makeDecision');

{
  const ai  = new AIOpponent(AI_TIERS.ROOKIE);
  const gs  = makeGameState();
  const dec = ai.getPlayersForPossession(gs);

  assert(dec !== null && 'ballCarrier' in dec,
    'getPlayersForPossession returns valid decision object');
}

// ---------------------------------------------------------------------------
// SECTION: Old format player compatibility
// ---------------------------------------------------------------------------

describe('Old player.js format compatibility');

{
  const ai      = new AIOpponent(AI_TIERS.AMATEUR);
  const old     = [
    makeOldPlayer('OldPG', 'PG', 5),
    makeOldPlayer('OldC',  'C',  3),
  ];
  const gs  = makeGameState({ teamPlayers: old });
  const dec = ai.makeDecision(gs);

  assert(old.includes(dec.ballCarrier),
    'Old-format players: ballCarrier comes from the roster');
  assert(dec.shotType === '2pt' || dec.shotType === '3pt',
    'Old-format players: shotType is valid');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('All AIOpponent tests passed.');
} else {
  console.log(`${failed} test(s) FAILED.`);
  process.exit(1);
}
