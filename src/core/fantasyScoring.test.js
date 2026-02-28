/**
 * Fantasy Scoring Engine — Exhaustive Tests
 * Quadra Legacy — src/core/fantasyScoring.test.js
 *
 * Run with: node src/core/fantasyScoring.test.js
 *
 * All assertions derive their expected values directly from the source code
 * of fantasyScoring.js. No external test libraries; plain Node.js only.
 */

import {
  DEFAULT_SCORING_CONFIG,
  SCORING_PRESETS,
  validateScoringConfig,
  calculateDoubleDoubleBonus,
  calculateTripleDoubleBonus,
  calculatePlayerFantasyPoints,
  normalizePlayerStatsFromEngine,
  aggregatePlayerStats,
  calculateTeamFantasyPoints,
  calculateHeadToHeadResult,
  calculateRotoRankings,
  createCustomScoringConfig
} from './fantasyScoring.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

/**
 * Assert strict equality with a clear label.
 * For floating-point values use assertClose() instead.
 */
function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    console.log(`         expected: ${JSON.stringify(expected)}`);
    console.log(`         actual:   ${JSON.stringify(actual)}`);
    failCount++;
  }
}

/**
 * Assert two numbers are within tolerance (handles IEEE-754 rounding noise).
 * The scoring engine already applies round2(), so 0.001 tolerance is generous.
 */
function assertClose(label, actual, expected, tol = 0.001) {
  if (typeof actual === 'number' && typeof expected === 'number' &&
      Math.abs(actual - expected) <= tol) {
    console.log(`  ✅ PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL  ${label}`);
    console.log(`         expected: ${expected}`);
    console.log(`         actual:   ${actual}`);
    failCount++;
  }
}

/**
 * Assert that calling fn() throws any error.
 */
function assertThrows(label, fn) {
  try {
    fn();
    console.log(`  ❌ FAIL  ${label} — expected an error but none was thrown`);
    failCount++;
  } catch (e) {
    console.log(`  ✅ PASS  ${label} (threw: ${e.message})`);
    passCount++;
  }
}

/**
 * Assert that calling fn() does NOT throw.
 */
function assertNoThrow(label, fn) {
  try {
    fn();
    console.log(`  ✅ PASS  ${label}`);
    passCount++;
  } catch (e) {
    console.log(`  ❌ FAIL  ${label} — unexpected error: ${e.message}`);
    failCount++;
  }
}

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** The canonical player used in Group 6 core math. */
const CORE_PLAYER = Object.freeze({
  playerId:         'p1',
  playerName:       'Test Player',
  position:         'SF',
  points:           25,
  rebounds:         8,
  assists:          6,
  steals:           2,
  blocks:           1,
  turnovers:        3,
  fieldGoalsMade:   10,
  fieldGoalsMissed: 5,
  freeThrowsMade:   5,
  freeThrowsMissed: 1,
  minutesPlayed:    36
});

// ---------------------------------------------------------------------------
// Group 1 — DEFAULT_SCORING_CONFIG
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 1: DEFAULT_SCORING_CONFIG validation');
console.log('='.repeat(60));

assert('points === 1',           DEFAULT_SCORING_CONFIG.points,       1);
assert('rebounds === 1.2',       DEFAULT_SCORING_CONFIG.rebounds,     1.2);
assert('assists === 1.5',        DEFAULT_SCORING_CONFIG.assists,      1.5);
assert('steals === 2',           DEFAULT_SCORING_CONFIG.steals,       2);
assert('blocks === 2',           DEFAULT_SCORING_CONFIG.blocks,       2);
assert('turnovers === -1',       DEFAULT_SCORING_CONFIG.turnovers,   -1);
assert('fgMissed === -0.5',      DEFAULT_SCORING_CONFIG.fgMissed,    -0.5);
assert('ftMade === 1',           DEFAULT_SCORING_CONFIG.ftMade,       1);
assert('ftMissed === -0.75',     DEFAULT_SCORING_CONFIG.ftMissed,    -0.75);
assert('doubleDouble === 5',     DEFAULT_SCORING_CONFIG.doubleDouble, 5);
assert('tripleDouble === 15',    DEFAULT_SCORING_CONFIG.tripleDouble, 15);
assert('config is frozen',       Object.isFrozen(DEFAULT_SCORING_CONFIG), true);

// ---------------------------------------------------------------------------
// Group 2 — SCORING_PRESETS
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 2: SCORING_PRESETS');
console.log('='.repeat(60));

const REQUIRED_KEYS = [
  'points','rebounds','assists','steals','blocks',
  'turnovers','fgMissed','ftMade','ftMissed','doubleDouble','tripleDouble'
];

// All four presets exist
assert('standard preset exists',     typeof SCORING_PRESETS.standard    === 'object', true);
assert('volume preset exists',       typeof SCORING_PRESETS.volume      === 'object', true);
assert('allAround preset exists',    typeof SCORING_PRESETS.allAround   === 'object', true);
assert('defenseFirst preset exists', typeof SCORING_PRESETS.defenseFirst === 'object', true);

// Each preset has all required keys
for (const presetName of ['standard','volume','allAround','defenseFirst']) {
  const preset = SCORING_PRESETS[presetName];
  for (const key of REQUIRED_KEYS) {
    assert(`${presetName}.${key} exists and is a number`,
           typeof preset[key] === 'number', true);
  }
}

// Spot-check preset values that differ from default per spec
assert('volume.points === 1.5 (heavier weight on scoring)',
       SCORING_PRESETS.volume.points, 1.5);
assert('volume.fgMissed === -0.25 (penalized less harshly)',
       SCORING_PRESETS.volume.fgMissed, -0.25);
assert('volume.tripleDouble === 12 (lower than default 15)',
       SCORING_PRESETS.volume.tripleDouble, 12);
assert('allAround.assists === 2 (significantly more)',
       SCORING_PRESETS.allAround.assists, 2);
assert('allAround.rebounds === 1.8 (higher than default)',
       SCORING_PRESETS.allAround.rebounds, 1.8);
assert('allAround.doubleDouble === 8 (larger bonus)',
       SCORING_PRESETS.allAround.doubleDouble, 8);
assert('allAround.tripleDouble === 18 (larger bonus)',
       SCORING_PRESETS.allAround.tripleDouble, 18);
assert('defenseFirst.steals === 6 (3x standard rate)',
       SCORING_PRESETS.defenseFirst.steals, 6);
assert('defenseFirst.blocks === 6 (3x standard rate)',
       SCORING_PRESETS.defenseFirst.blocks, 6);
assert('defenseFirst.turnovers === -1.5 (harsher penalty)',
       SCORING_PRESETS.defenseFirst.turnovers, -1.5);
assert('defenseFirst.points === 0.8 (discounted)',
       SCORING_PRESETS.defenseFirst.points, 0.8);

// standard mirrors DEFAULT_SCORING_CONFIG exactly
for (const key of REQUIRED_KEYS) {
  assert(`standard.${key} mirrors DEFAULT`, SCORING_PRESETS.standard[key], DEFAULT_SCORING_CONFIG[key]);
}

// ---------------------------------------------------------------------------
// Group 3 — validateScoringConfig
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 3: validateScoringConfig');
console.log('='.repeat(60));

// Valid config returns true
assertNoThrow('valid DEFAULT_SCORING_CONFIG passes without error', () => {
  const result = validateScoringConfig({ ...DEFAULT_SCORING_CONFIG });
  assert('returns true on valid config', result, true);
});

// Missing key throws
assertThrows('missing key "blocks" throws Error', () => {
  const cfg = { ...DEFAULT_SCORING_CONFIG };
  delete cfg.blocks;
  validateScoringConfig(cfg);
});

assertThrows('missing key "tripleDouble" throws Error', () => {
  const cfg = { ...DEFAULT_SCORING_CONFIG };
  delete cfg.tripleDouble;
  validateScoringConfig(cfg);
});

// Non-numeric value throws
assertThrows('non-numeric "points" throws Error', () => {
  validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, points: 'hello' });
});

assertThrows('NaN "rebounds" throws Error', () => {
  validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, rebounds: NaN });
});

assertThrows('Infinity "assists" throws Error', () => {
  validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, assists: Infinity });
});

// Positive turnovers throws (should be negative penalty)
assertThrows('positive turnovers throws Error', () => {
  validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, turnovers: 1 });
});

// tripleDouble < doubleDouble throws
assertThrows('tripleDouble < doubleDouble throws Error', () => {
  validateScoringConfig({ ...DEFAULT_SCORING_CONFIG, tripleDouble: 3, doubleDouble: 5 });
});

// Valid custom config with all fields passes
assertNoThrow('valid custom config (all fields provided) passes', () => {
  validateScoringConfig({
    points: 2, rebounds: 1.5, assists: 2, steals: 3, blocks: 3,
    turnovers: -1.5, fgMissed: -0.25, ftMade: 1.2, ftMissed: -0.5,
    doubleDouble: 6, tripleDouble: 20
  });
});

// ---------------------------------------------------------------------------
// Group 4 — calculateDoubleDoubleBonus
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 4: calculateDoubleDoubleBonus');
console.log('='.repeat(60));

// 0 categories >= 10 → 0
assertClose('0 categories >= 10 → bonus = 0',
  calculateDoubleDoubleBonus(
    { points:8, rebounds:7, assists:5, steals:3, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 0);

// 1 category >= 10 → 0
assertClose('1 category >= 10 (points=25, rest < 10) → bonus = 0',
  calculateDoubleDoubleBonus(
    { points:25, rebounds:7, assists:5, steals:3, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 0);

// Exactly 2 categories >= 10 → config.doubleDouble = 5
assertClose('exactly 2 categories >= 10 (points=20, rebounds=10) → bonus = 5',
  calculateDoubleDoubleBonus(
    { points:20, rebounds:10, assists:5, steals:3, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 5);

assertClose('exactly 2 categories >= 10 (assists=11, steals=10) → bonus = 5',
  calculateDoubleDoubleBonus(
    { points:8, rebounds:7, assists:11, steals:10, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 5);

// Exactly 3 categories >= 10 → 0 (TD replaces DD, no stacking)
assertClose('3 categories >= 10 (TD scenario) → DD bonus = 0 (no stacking)',
  calculateDoubleDoubleBonus(
    { points:12, rebounds:11, assists:10, steals:3, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 0);

// Custom config doubleDouble value
assertClose('respects custom config.doubleDouble = 8',
  calculateDoubleDoubleBonus(
    { points:15, rebounds:10, assists:5, steals:3, blocks:2 },
    { ...DEFAULT_SCORING_CONFIG, doubleDouble: 8 }
  ), 8);

// ---------------------------------------------------------------------------
// Group 5 — calculateTripleDoubleBonus
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 5: calculateTripleDoubleBonus');
console.log('='.repeat(60));

// 2 categories >= 10 → 0
assertClose('2 categories >= 10 → TD bonus = 0',
  calculateTripleDoubleBonus(
    { points:20, rebounds:10, assists:5, steals:3, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 0);

// Exactly 3 categories >= 10 → config.tripleDouble = 15
assertClose('exactly 3 categories >= 10 → bonus = 15',
  calculateTripleDoubleBonus(
    { points:12, rebounds:11, assists:10, steals:3, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 15);

// 4 categories >= 10 → 15 (qualCount >= 3 still triggers)
assertClose('4 categories >= 10 → bonus = 15 (qualCount >= 3)',
  calculateTripleDoubleBonus(
    { points:12, rebounds:11, assists:10, steals:10, blocks:2 },
    DEFAULT_SCORING_CONFIG
  ), 15);

// 5 categories >= 10 → 15
assertClose('5 categories all >= 10 → bonus = 15',
  calculateTripleDoubleBonus(
    { points:10, rebounds:10, assists:10, steals:10, blocks:10 },
    DEFAULT_SCORING_CONFIG
  ), 15);

// Custom config tripleDouble value
assertClose('respects custom config.tripleDouble = 20',
  calculateTripleDoubleBonus(
    { points:12, rebounds:11, assists:10, steals:3, blocks:2 },
    { ...DEFAULT_SCORING_CONFIG, tripleDouble: 20 }
  ), 20);

// ---------------------------------------------------------------------------
// Group 6 — calculatePlayerFantasyPoints core math
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 6: calculatePlayerFantasyPoints — core math');
console.log('='.repeat(60));

/*
 * CORE_PLAYER: points=25, rebounds=8, assists=6, steals=2, blocks=1,
 *              turnovers=3, fieldGoalsMissed=5, freeThrowsMade=5, freeThrowsMissed=1
 *
 * Expected breakdown with DEFAULT_SCORING_CONFIG:
 *   pointsScore      = 25 × 1.0    =  25.00
 *   reboundScore     =  8 × 1.2    =   9.60
 *   assistScore      =  6 × 1.5    =   9.00
 *   stealScore       =  2 × 2.0    =   4.00
 *   blockScore       =  1 × 2.0    =   2.00
 *   turnoverPenalty  =  3 × (−1)   =  −3.00
 *   fgMissedPenalty  =  5 × (−0.5) =  −2.50
 *   ftMadeScore      =  5 × 1.0    =   5.00
 *   ftMissedPenalty  =  1 × (−0.75)=  −0.75
 *   (qualCount = 1 — only points≥10; no double/triple bonus)
 *   totalPoints = 25+9.6+9+4+2−3−2.5+5−0.75 = 48.35
 */

const coreResult = calculatePlayerFantasyPoints(CORE_PLAYER, DEFAULT_SCORING_CONFIG);

assertClose('breakdown.pointsScore === 25',    coreResult.breakdown.pointsScore,     25);
assertClose('breakdown.reboundScore === 9.6',  coreResult.breakdown.reboundScore,    9.6);
assertClose('breakdown.assistScore === 9',     coreResult.breakdown.assistScore,     9);
assertClose('breakdown.stealScore === 4',      coreResult.breakdown.stealScore,      4);
assertClose('breakdown.blockScore === 2',      coreResult.breakdown.blockScore,      2);
assertClose('breakdown.turnoverPenalty === -3',coreResult.breakdown.turnoverPenalty,-3);
assertClose('breakdown.fgMissedPenalty === -2.5', coreResult.breakdown.fgMissedPenalty, -2.5);
assertClose('breakdown.ftMadeScore === 5',     coreResult.breakdown.ftMadeScore,     5);
assertClose('breakdown.ftMissedPenalty === -0.75', coreResult.breakdown.ftMissedPenalty, -0.75);
assertClose('breakdown.doubleDoubleBonus === 0 (only 1 qualifier)',
            coreResult.breakdown.doubleDoubleBonus, 0);
assertClose('breakdown.tripleDoubleBonus === 0',
            coreResult.breakdown.tripleDoubleBonus, 0);
assertClose('totalPoints === 48.35',           coreResult.totalPoints, 48.35);
assert('playerId carried through',  coreResult.playerId,   'p1');
assert('playerName carried through', coreResult.playerName, 'Test Player');
assert('statLine is a non-empty string', typeof coreResult.statLine === 'string' && coreResult.statLine.length > 0, true);

// throws on bad input
assertThrows('null playerStats throws TypeError', () => calculatePlayerFantasyPoints(null));
assertThrows('string playerStats throws TypeError', () => calculatePlayerFantasyPoints('bad'));

// ---------------------------------------------------------------------------
// Group 7 — Double-double detection in full scoring
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 7: Double-double detection in calculatePlayerFantasyPoints');
console.log('='.repeat(60));

/*
 * ddPlayer: points=20 (≥10), rebounds=10 (≥10), assists=3, steals=0, blocks=1
 * qualCount = 2  →  doubleDoubleBonus = 5, tripleDoubleBonus = 0
 *
 * Expected total:
 *   20×1=20, 10×1.2=12, 3×1.5=4.5, 0×2=0, 1×2=2,
 *   2×(−1)=−2, 4×(−0.5)=−2, 4×1=4, 1×(−0.75)=−0.75
 *   + doubleDoubleBonus = 5
 *   total = 20+12+4.5+0+2−2−2+4−0.75+5 = 42.75
 */

const DD_PLAYER = {
  playerId:'dd1', playerName:'DD Player', position:'PF',
  points:20, rebounds:10, assists:3, steals:0, blocks:1,
  turnovers:2, fieldGoalsMade:8, fieldGoalsMissed:4,
  freeThrowsMade:4, freeThrowsMissed:1, minutesPlayed:32, isStarter:true
};

const ddResult = calculatePlayerFantasyPoints(DD_PLAYER, DEFAULT_SCORING_CONFIG);

assert('doubleDoubleBonus === 5 in breakdown',
       ddResult.breakdown.doubleDoubleBonus, 5);
assert('tripleDoubleBonus === 0 (no stacking)',
       ddResult.breakdown.tripleDoubleBonus, 0);
assertClose('totalPoints includes the +5 DD bonus (42.75)',
            ddResult.totalPoints, 42.75);

// ---------------------------------------------------------------------------
// Group 8 — Triple-double detection (DD bonus must NOT stack)
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 8: Triple-double detection (no DD/TD stacking)');
console.log('='.repeat(60));

/*
 * tdPlayer: points=12 (≥10), rebounds=11 (≥10), assists=10 (≥10), steals=2, blocks=0
 * qualCount = 3  →  tripleDoubleBonus = 15, doubleDoubleBonus = 0 (must NOT stack)
 *
 * Expected total:
 *   12×1=12, 11×1.2=13.2, 10×1.5=15, 2×2=4, 0×2=0,
 *   3×(−1)=−3, 6×(−0.5)=−3, 2×1=2, 0×(−0.75)=0
 *   + tripleDoubleBonus = 15
 *   total = 12+13.2+15+4+0−3−3+2+0+15 = 55.2
 */

const TD_PLAYER = {
  playerId:'td1', playerName:'TD Player', position:'PG',
  points:12, rebounds:11, assists:10, steals:2, blocks:0,
  turnovers:3, fieldGoalsMade:5, fieldGoalsMissed:6,
  freeThrowsMade:2, freeThrowsMissed:0, minutesPlayed:38, isStarter:true
};

const tdResult = calculatePlayerFantasyPoints(TD_PLAYER, DEFAULT_SCORING_CONFIG);

assert('tripleDoubleBonus === 15 in breakdown',
       tdResult.breakdown.tripleDoubleBonus, 15);
assert('doubleDoubleBonus === 0 (DD does NOT stack with TD)',
       tdResult.breakdown.doubleDoubleBonus, 0);
assertClose('totalPoints includes +15 TD bonus (55.2)',
            tdResult.totalPoints, 55.2);

// ---------------------------------------------------------------------------
// Group 9 — normalizePlayerStatsFromEngine
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 9: normalizePlayerStatsFromEngine');
console.log('='.repeat(60));

const ENGINE_PLAYER = {
  id:       'e1',
  name:     'Engine Player',
  position: 'C',
  stats: {
    pointsScored: 18,
    shots2pt:     { made: 6, attempted: 12 },
    shots3pt:     { made: 2, attempted: 5 },
    rebounds:     7,
    assists:      4,
    steals:       1,
    blocks:       2
    // freethrows, turnovers, minutesPlayed intentionally absent (engine gaps)
  }
};

const normalized = normalizePlayerStatsFromEngine(ENGINE_PLAYER);

/*
 * fgMade      = shots2pt.made + shots3pt.made = 6 + 2 = 8
 * fgAttempted = shots2pt.attempted + shots3pt.attempted = 12 + 5 = 17
 * fgMissed    = 17 − 8 = 9
 */

assert('normalized.points === 18',           normalized.points,           18);
assert('normalized.fieldGoalsMade === 8',    normalized.fieldGoalsMade,   8);
assert('normalized.fieldGoalsMissed === 9',  normalized.fieldGoalsMissed, 9);
assert('normalized.rebounds === 7',          normalized.rebounds,         7);
assert('normalized.assists === 4',           normalized.assists,          4);
assert('normalized.steals === 1',            normalized.steals,           1);
assert('normalized.blocks === 2',            normalized.blocks,           2);
assert('normalized.turnovers === 0 (not tracked by engine)', normalized.turnovers, 0);
assert('normalized.minutesPlayed === 0 (not tracked)',       normalized.minutesPlayed, 0);
assert('normalized.playerId === "e1"',       normalized.playerId,   'e1');
assert('normalized.playerName === "Engine Player"', normalized.playerName, 'Engine Player');
assert('normalized.position === "C"',        normalized.position,   'C');
assert('normalized.isStarter === true (default)', normalized.isStarter, true);

// Player object with fieldGoalsAttempted directly provided
const DIRECT_FG_PLAYER = {
  id: 'fp1', name: 'Direct FG', position: 'PG',
  stats: { pointsScored: 10, fieldGoalsMade: 4, fieldGoalsAttempted: 10, rebounds: 2, assists: 3, steals: 1, blocks: 0 }
};
const normalizedDirect = normalizePlayerStatsFromEngine(DIRECT_FG_PLAYER);
assert('direct fieldGoalsMade=4 respected',   normalizedDirect.fieldGoalsMade,   4);
assert('direct fgMissed = 10−4 = 6',          normalizedDirect.fieldGoalsMissed, 6);

// isStarter=false carried through
const BENCH_ENGINE_PLAYER = {
  id:'b1', name:'Bench Guy', position:'SG', isStarter:false,
  stats:{ pointsScored:5, rebounds:2, assists:1, steals:0, blocks:0 }
};
const benchNorm = normalizePlayerStatsFromEngine(BENCH_ENGINE_PLAYER);
assert('isStarter:false preserved', benchNorm.isStarter, false);

// throws on invalid input
assertThrows('null enginePlayer throws TypeError', () => normalizePlayerStatsFromEngine(null));
assertThrows('string enginePlayer throws TypeError', () => normalizePlayerStatsFromEngine('bad'));

// ---------------------------------------------------------------------------
// Group 10 — aggregatePlayerStats
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 10: aggregatePlayerStats');
console.log('='.repeat(60));

const GAME1_STATS = {
  playerId:'agg1', playerName:'Agg Player', position:'SF',
  points:20, rebounds:8, assists:5, steals:1, blocks:0,
  turnovers:2, fieldGoalsMade:8, fieldGoalsMissed:4,
  freeThrowsMade:4, freeThrowsMissed:0, minutesPlayed:35, isStarter:true
};

const GAME2_STATS = {
  playerId:'agg1', playerName:'Agg Player', position:'SF',
  points:15, rebounds:5, assists:7, steals:3, blocks:1,
  turnovers:1, fieldGoalsMade:6, fieldGoalsMissed:3,
  freeThrowsMade:3, freeThrowsMissed:1, minutesPlayed:30, isStarter:true
};

const aggregated = aggregatePlayerStats([GAME1_STATS, GAME2_STATS]);

assert('aggregated.points === 35',            aggregated.points,           35);
assert('aggregated.rebounds === 13',          aggregated.rebounds,         13);
assert('aggregated.assists === 12',           aggregated.assists,          12);
assert('aggregated.steals === 4',             aggregated.steals,           4);
assert('aggregated.blocks === 1',             aggregated.blocks,           1);
assert('aggregated.turnovers === 3',          aggregated.turnovers,        3);
assert('aggregated.fieldGoalsMade === 14',    aggregated.fieldGoalsMade,   14);
assert('aggregated.fieldGoalsMissed === 7',   aggregated.fieldGoalsMissed, 7);
assert('aggregated.freeThrowsMade === 7',     aggregated.freeThrowsMade,   7);
assert('aggregated.freeThrowsMissed === 1',   aggregated.freeThrowsMissed, 1);
assert('aggregated.minutesPlayed === 65',     aggregated.minutesPlayed,    65);
assert('playerId preserved',                  aggregated.playerId,    'agg1');
assert('playerName preserved',                aggregated.playerName,  'Agg Player');
assert('position preserved',                  aggregated.position,    'SF');

// Single-entry list should equal itself
const singleAgg = aggregatePlayerStats([GAME1_STATS]);
assert('single entry: points === 20',   singleAgg.points,    20);
assert('single entry: rebounds === 8',  singleAgg.rebounds,  8);

// Throws on empty array
assertThrows('empty statsList throws TypeError', () => aggregatePlayerStats([]));
assertThrows('non-array statsList throws TypeError', () => aggregatePlayerStats(null));

// ---------------------------------------------------------------------------
// Group 11 — calculateTeamFantasyPoints
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 11: calculateTeamFantasyPoints');
console.log('='.repeat(60));

/*
 * One starter template:
 *   points=20, reb=5, ast=3, stl=1, blk=1, to=2, fgMissed=4, ftMade=4, ftMissed=1
 *
 *   pointsScore=20, reboundScore=6, assistScore=4.5, stealScore=2, blockScore=2,
 *   turnoverPenalty=−2, fgMissedPenalty=−2, ftMadeScore=4, ftMissedPenalty=−0.75
 *   qualCount: points=20 ≥10 (count=1) → no bonus
 *   total = 20+6+4.5+2+2−2−2+4−0.75 = 33.75
 *
 * 5 starters → rosterTotal = 5 × 33.75 = 168.75
 *
 * One bench template:
 *   points=10, reb=3, ast=2, stl=0, blk=0, to=1, fgMissed=3, ftMade=2, ftMissed=0
 *
 *   pointsScore=10, reboundScore=3.6, assistScore=3, stealScore=0, blockScore=0,
 *   turnoverPenalty=−1, fgMissedPenalty=−1.5, ftMadeScore=2, ftMissedPenalty=0
 *   qualCount: points=10 ≥10 (count=1) → no bonus
 *   total = 10+3.6+3+0+0−1−1.5+2+0 = 16.1
 *
 * 2 bench → benchTotal = 2 × 16.1 = 32.2
 * grandTotal = 168.75 + 32.2 = 200.95
 */

function makeStarter(id) {
  return {
    playerId: `s${id}`, playerName:`Starter ${id}`, position:'SF',
    points:20, rebounds:5, assists:3, steals:1, blocks:1,
    turnovers:2, fieldGoalsMade:8, fieldGoalsMissed:4,
    freeThrowsMade:4, freeThrowsMissed:1, minutesPlayed:32, isStarter:true
  };
}

function makeBenchPlayer(id) {
  return {
    playerId:`b${id}`, playerName:`Bench ${id}`, position:'PG',
    points:10, rebounds:3, assists:2, steals:0, blocks:0,
    turnovers:1, fieldGoalsMade:4, fieldGoalsMissed:3,
    freeThrowsMade:2, freeThrowsMissed:0, minutesPlayed:15, isStarter:false
  };
}

const teamRoster = [
  makeStarter(1), makeStarter(2), makeStarter(3), makeStarter(4), makeStarter(5),
  makeBenchPlayer(1), makeBenchPlayer(2)
];

const teamResult = calculateTeamFantasyPoints(teamRoster, DEFAULT_SCORING_CONFIG);

assertClose('rosterTotal = 5 × 33.75 = 168.75', teamResult.rosterTotal, 168.75);
assertClose('benchTotal  = 2 × 16.1  = 32.2',   teamResult.benchTotal,   32.2);
assertClose('grandTotal  = 168.75 + 32.2 = 200.95', teamResult.grandTotal, 200.95);
assert('playerBreakdowns has 7 entries', teamResult.playerBreakdowns.length, 7);

// Bench-only roster → rosterTotal = 0, benchTotal has the points
const benchOnlyRoster = [makeBenchPlayer(1), makeBenchPlayer(2)];
const benchOnlyResult = calculateTeamFantasyPoints(benchOnlyRoster, DEFAULT_SCORING_CONFIG);
assertClose('bench-only: rosterTotal === 0',       benchOnlyResult.rosterTotal, 0);
assertClose('bench-only: benchTotal === 2 × 16.1', benchOnlyResult.benchTotal, 32.2);

// throws on non-array
assertThrows('non-array allPlayerStats throws TypeError',
             () => calculateTeamFantasyPoints(null));

// Empty array: does NOT throw; returns all zeros
assertNoThrow('empty roster array does not throw', () => {
  const r = calculateTeamFantasyPoints([]);
  assertClose('empty roster rosterTotal === 0', r.rosterTotal, 0);
  assertClose('empty roster benchTotal === 0',  r.benchTotal,  0);
  assertClose('empty roster grandTotal === 0',  r.grandTotal,  0);
});

// ---------------------------------------------------------------------------
// Group 12 — calculateHeadToHeadResult
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 12: calculateHeadToHeadResult');
console.log('='.repeat(60));

/*
 * Home player: points=30, reb=10, ast=5, stl=2, blk=1, to=2, fgMissed=5, ftMade=6, ftMissed=1
 *   qualCount: points=30>=10, rebounds=10>=10 → count=2 → doubleDoubleBonus=5
 *   pointsScore=30, reboundScore=12, assistScore=7.5, stealScore=4, blockScore=2,
 *   turnoverPenalty=−2, fgMissedPenalty=−2.5, ftMadeScore=6, ftMissedPenalty=−0.75, doubleDoubleBonus=5
 *   total = 30+12+7.5+4+2−2−2.5+6−0.75+5 = 61.25
 *
 * Away player: points=20, reb=5, ast=3, stl=1, blk=0, to=3, fgMissed=6, ftMade=4, ftMissed=2
 *   qualCount: points=20>=10 → count=1 → no bonus
 *   total = 20+6+4.5+2+0−3−3+4−1.5 = 29
 *
 * margin = |61.25 − 29| = 32.25
 */

const HOME_PLAYER = {
  playerId:'h1', playerName:'Home Star', position:'SF',
  points:30, rebounds:10, assists:5, steals:2, blocks:1,
  turnovers:2, fieldGoalsMade:12, fieldGoalsMissed:5,
  freeThrowsMade:6, freeThrowsMissed:1, minutesPlayed:38, isStarter:true
};

const AWAY_PLAYER = {
  playerId:'a1', playerName:'Away Player', position:'PF',
  points:20, rebounds:5, assists:3, steals:1, blocks:0,
  turnovers:3, fieldGoalsMade:8, fieldGoalsMissed:6,
  freeThrowsMade:4, freeThrowsMissed:2, minutesPlayed:36, isStarter:true
};

const h2hResult = calculateHeadToHeadResult([HOME_PLAYER], [AWAY_PLAYER], DEFAULT_SCORING_CONFIG);

assertClose('homeTotal === 61.25', h2hResult.homeTotal, 61.25);
assertClose('awayTotal === 29',    h2hResult.awayTotal, 29);
assert('winner === "home"',        h2hResult.winner, 'home');
assertClose('margin === 32.25',    h2hResult.margin, 32.25);
assert('homePlayerBreakdowns is an array', Array.isArray(h2hResult.homePlayerBreakdowns), true);
assert('awayPlayerBreakdowns is an array', Array.isArray(h2hResult.awayPlayerBreakdowns), true);

// Exact tie
const TIE_PLAYER = {
  playerId:'t1', playerName:'Tie Player', position:'PG',
  points:20, rebounds:5, assists:3, steals:0, blocks:0,
  turnovers:2, fieldGoalsMade:8, fieldGoalsMissed:4,
  freeThrowsMade:4, freeThrowsMissed:1, minutesPlayed:36, isStarter:true
};

const tieResult = calculateHeadToHeadResult([TIE_PLAYER], [{ ...TIE_PLAYER, playerId:'t2' }], DEFAULT_SCORING_CONFIG);

assert('tie winner === "tie"',    tieResult.winner, 'tie');
assertClose('tie margin === 0',   tieResult.margin, 0);

// Away wins
const WEAK_HOME = {
  playerId:'wh', playerName:'Weak Home', position:'C',
  points:5, rebounds:2, assists:1, steals:0, blocks:0,
  turnovers:4, fieldGoalsMade:2, fieldGoalsMissed:8,
  freeThrowsMade:1, freeThrowsMissed:3, minutesPlayed:20, isStarter:true
};
const STRONG_AWAY = {
  playerId:'sa', playerName:'Strong Away', position:'SG',
  points:35, rebounds:3, assists:8, steals:3, blocks:0,
  turnovers:1, fieldGoalsMade:14, fieldGoalsMissed:3,
  freeThrowsMade:7, freeThrowsMissed:1, minutesPlayed:38, isStarter:true
};
const awayWinsResult = calculateHeadToHeadResult([WEAK_HOME], [STRONG_AWAY], DEFAULT_SCORING_CONFIG);
assert('away wins: winner === "away"', awayWinsResult.winner, 'away');

// throws on non-arrays
assertThrows('non-array homeRosterStats throws TypeError',
             () => calculateHeadToHeadResult(null, []));
assertThrows('non-array awayRosterStats throws TypeError',
             () => calculateHeadToHeadResult([], null));

// ---------------------------------------------------------------------------
// Group 13 — calculateRotoRankings
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 13: calculateRotoRankings');
console.log('='.repeat(60));

/*
 * 3 managers, 1 player each (all starters by default / isStarter not false).
 *
 * Rank points with n=3: 1st→3pts, 2nd→2pts, 3rd→1pt
 *
 *          Points Rebounds Assists Steals Blocks Turnovers(fewer=better)
 * Manager A:  100     10      30     10     5        20
 * Manager B:   30     80      20      8     3         2
 * Manager C:   65     45      25      9     4        10
 *
 * Category ranks:
 *   Points:    A(3), C(2), B(1)
 *   Rebounds:  B(3), C(2), A(1)
 *   Assists:   A(3), C(2), B(1)
 *   Steals:    A(3), C(2), B(1)
 *   Blocks:    A(3), C(2), B(1)
 *   Turnovers: B(3), C(2), A(1)  ← fewer = better
 *
 * Total rank points:
 *   A: 3+1+3+3+3+1 = 14   → standing 1
 *   C: 2+2+2+2+2+2 = 12   → standing 2
 *   B: 1+3+1+1+1+3 = 10   → standing 3
 */

function makeRotoPlayer(id, points, reb, ast, stl, blk, to) {
  return {
    playerId:`roto_${id}`, playerName:`Player ${id}`, position:'SF',
    points, rebounds:reb, assists:ast, steals:stl, blocks:blk,
    turnovers:to, fieldGoalsMade:Math.floor(points*0.4), fieldGoalsMissed:Math.floor(points*0.2),
    freeThrowsMade:Math.floor(points*0.1), freeThrowsMissed:0, minutesPlayed:36
    // isStarter is absent → treated as true (isStarter !== false)
  };
}

const rotoManagers = [
  { managerId:'mA', managerName:'Manager A', playerStats:[makeRotoPlayer('A', 100, 10, 30, 10, 5, 20)] },
  { managerId:'mB', managerName:'Manager B', playerStats:[makeRotoPlayer('B', 30, 80, 20, 8, 3, 2)]  },
  { managerId:'mC', managerName:'Manager C', playerStats:[makeRotoPlayer('C', 65, 45, 25, 9, 4, 10)] }
];

const rotoStandings = calculateRotoRankings(rotoManagers, DEFAULT_SCORING_CONFIG);

const findManager = (id) => rotoStandings.find(s => s.managerId === id);

assert('3 standings returned',                           rotoStandings.length, 3);
assert('Manager A standing === 1 (most rank points)',    findManager('mA').standing, 1);
assert('Manager C standing === 2 (middle)',              findManager('mC').standing, 2);
assert('Manager B standing === 3 (lowest)',              findManager('mB').standing, 3);

// Verify rank points are as computed
assert('Manager A totalRankPoints === 14', findManager('mA').totalRankPoints, 14);
assert('Manager C totalRankPoints === 12', findManager('mC').totalRankPoints, 12);
assert('Manager B totalRankPoints === 10', findManager('mB').totalRankPoints, 10);

// Turnovers ranked inverted — Manager B (fewest=2) gets best turnovers rank
const mBRanks = findManager('mB').categoryRanks;
assert('Manager B turnovers rank === 1 (fewest turnovers)', mBRanks.turnovers.rank, 1);
const mARanks = findManager('mA').categoryRanks;
assert('Manager A turnovers rank === 3 (most turnovers)',   mARanks.turnovers.rank, 3);

// Manager A dominates points
assert('Manager A points rank === 1',   findManager('mA').categoryRanks.points.rank, 1);
assert('Manager B rebounds rank === 1', findManager('mB').categoryRanks.rebounds.rank, 1);

// throws on empty array
assertThrows('empty allManagerStats throws TypeError', () => calculateRotoRankings([]));
assertThrows('non-array throws TypeError', () => calculateRotoRankings(null));

// ---------------------------------------------------------------------------
// Group 14 — Custom scoring config (defenseFirst vs standard)
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 14: Custom scoring config — defenseFirst vs standard');
console.log('='.repeat(60));

/*
 * High steals/blocks player:
 *   points=18, reb=5, ast=3, stl=5, blk=4, to=2, fgMissed=8, ftMade=4, ftMissed=1
 *
 * Standard total:
 *   18 + 6 + 4.5 + 10 + 8 − 2 − 4 + 4 − 0.75 = 43.75
 *
 * DefenseFirst total:
 *   points:18×0.8=14.4, reb:5×1.2=6, ast:3×1.2=3.6,
 *   stl:5×6=30, blk:4×6=24, to:2×(−1.5)=−3,
 *   fgMissed:8×(−0.5)=−4, ftMade:4×0.8=3.2, ftMissed:1×(−0.75)=−0.75
 *   total = 14.4+6+3.6+30+24−3−4+3.2−0.75 = 73.45
 */

const HIGH_DEF_PLAYER = {
  playerId:'def1', playerName:'Defensive Player', position:'C',
  points:18, rebounds:5, assists:3, steals:5, blocks:4,
  turnovers:2, fieldGoalsMade:7, fieldGoalsMissed:8,
  freeThrowsMade:4, freeThrowsMissed:1, minutesPlayed:30
};

const standardResult = calculatePlayerFantasyPoints(HIGH_DEF_PLAYER, SCORING_PRESETS.standard);
const defenseFirstResult = calculatePlayerFantasyPoints(HIGH_DEF_PLAYER, SCORING_PRESETS.defenseFirst);

assertClose('standard total === 43.75',      standardResult.totalPoints,     43.75);
assertClose('defenseFirst total === 73.45',  defenseFirstResult.totalPoints,  73.45);
assert('defenseFirst > standard for high steals/blocks player',
       defenseFirstResult.totalPoints > standardResult.totalPoints, true);

// Also test createCustomScoringConfig works correctly
const customCfg = createCustomScoringConfig({ steals: 4, blocks: 4 });
const customResult = calculatePlayerFantasyPoints(HIGH_DEF_PLAYER, customCfg);
assertClose('custom: stl=5×4=20, blk=4×4=16 instead of 10+8',
            // difference: steals went 5*4−5*2=10 more, blocks went 4*4−4*2=8 more = 18 more than standard
            customResult.totalPoints, standardResult.totalPoints + 18);

// createCustomScoringConfig throws on invalid overrides
assertThrows('createCustomScoringConfig with turnovers=5 throws',
             () => createCustomScoringConfig({ turnovers: 5 }));

// ---------------------------------------------------------------------------
// Group 15 — Edge cases
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 15: Edge cases');
console.log('='.repeat(60));

// Player with all zeros → total = 0
const ZERO_PLAYER = {
  playerId:'z1', playerName:'Zero Player', position:'PG',
  points:0, rebounds:0, assists:0, steals:0, blocks:0,
  turnovers:0, fieldGoalsMade:0, fieldGoalsMissed:0,
  freeThrowsMade:0, freeThrowsMissed:0, minutesPlayed:0
};
const zeroResult = calculatePlayerFantasyPoints(ZERO_PLAYER, DEFAULT_SCORING_CONFIG);
assertClose('all-zeros player → totalPoints === 0', zeroResult.totalPoints, 0);
assert('all-zeros breakdown has no bonuses', zeroResult.breakdown.doubleDoubleBonus, 0);

// Very high stats player — 60pts, 20reb, 15ast — triggers triple-double
/*
 *   points=60, reb=20, ast=15, stl=3, blk=2, to=5, fgMissed=8, ftMade=16, ftMissed=4
 *   qualCount: points(60)>=10, rebounds(20)>=10, assists(15)>=10 → count=3 → TD!
 *
 *   60 + 24 + 22.5 + 6 + 4 − 5 − 4 + 16 − 3 + TD(15) = 135.5
 */
const SUPERSTAR_PLAYER = {
  playerId:'ss1', playerName:'Superstar', position:'SF',
  points:60, rebounds:20, assists:15, steals:3, blocks:2,
  turnovers:5, fieldGoalsMade:22, fieldGoalsMissed:8,
  freeThrowsMade:16, freeThrowsMissed:4, minutesPlayed:48
};
const superResult = calculatePlayerFantasyPoints(SUPERSTAR_PLAYER, DEFAULT_SCORING_CONFIG);
assert('superstar triggers triple-double', superResult.breakdown.tripleDoubleBonus, 15);
assertClose('superstar total === 135.5', superResult.totalPoints, 135.5);

// Negative raw stats — function must not throw (graceful — no crash)
// safe() returns the negative value as-is (isFinite(-5) === true)
const NEG_PLAYER = {
  playerId:'neg1', playerName:'Negative Player', position:'SF',
  points:-5, rebounds:-2, assists:-1, steals:-1, blocks:-1,
  turnovers:-1, fieldGoalsMade:-2, fieldGoalsMissed:-3,
  freeThrowsMade:-1, freeThrowsMissed:-1, minutesPlayed:-5
};
assertNoThrow('negative stats do not throw — handled gracefully', () => {
  const negResult = calculatePlayerFantasyPoints(NEG_PLAYER, DEFAULT_SCORING_CONFIG);
  assert('negative stats → returns a number (no NaN)', typeof negResult.totalPoints === 'number' && isFinite(negResult.totalPoints), true);
});

// aggregatePlayerStats: three game lines
const game3 = { ...GAME1_STATS, points:10, rebounds:3, assists:2, steals:0, blocks:0, turnovers:1, fieldGoalsMade:4, fieldGoalsMissed:2, freeThrowsMade:2, freeThrowsMissed:0, minutesPlayed:20 };
const threeGameAgg = aggregatePlayerStats([GAME1_STATS, GAME2_STATS, game3]);
assert('three-game aggregate: points=45', threeGameAgg.points, 45);
assert('three-game aggregate: rebounds=16', threeGameAgg.rebounds, 16);

// calculateTeamFantasyPoints with empty array — does NOT throw
const emptyTeam = calculateTeamFantasyPoints([]);
assertClose('empty team: grandTotal === 0', emptyTeam.grandTotal, 0);

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log(`Final results: ✅ ${passCount} passed, ❌ ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
  process.exit(1);
}
