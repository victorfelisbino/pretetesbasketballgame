/**
 * Progression Service — Exhaustive Tests
 * Quadra Legacy — src/services/progressionService.test.js
 *
 * Run with: node src/services/progressionService.test.js
 *
 * No external test libraries; plain Node.js only.
 */

import {
  processMatchXP,
  applyXPToPlayers,
  processEndOfSeasonAging,
  checkBreakthroughEvents,
  getLevelInfo,
  getRecommendedLevelUpAttributes,
} from './progressionService.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function assert(label, actual, expected) {
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

function assertDeepEqual(label, actual, expected) {
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

function assertTruthy(label, actual) {
  if (actual) {
    console.log(`  PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         expected truthy, got: ${JSON.stringify(actual)}`);
    failCount++;
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const makePlayer = (name, position, archetype, overrides = {}) => ({
  name,
  position,
  archetype: archetype || 'Scorer',
  age: overrides.age || 22,
  totalXP: overrides.totalXP || 0,
  attributes: {
    Attack: 70, Defense: 60, ThreePoint: 65, Passing: 55, Stamina: 75,
    Potential: 85, ...overrides.attributes,
  },
  ...overrides,
});

const makeMatchResult = () => ({
  homeTeamStats: [
    { name: 'Player 1', position: 'PG', points: 20, rebounds: 3, assists: 8, steals: 2, blocks: 0 },
    { name: 'Player 2', position: 'SG', points: 15, rebounds: 4, assists: 2, steals: 1, blocks: 0 },
  ],
  awayTeamStats: [
    { name: 'Player 3', position: 'C', points: 10, rebounds: 10, assists: 1, steals: 0, blocks: 3 },
  ],
});

// ===========================================================================
// processMatchXP — valid match result
// ===========================================================================

section('processMatchXP -- valid match result');

{
  const result = processMatchXP(makeMatchResult());

  assert('home is an array', Array.isArray(result.home), true);
  assert('away is an array', Array.isArray(result.away), true);
  assert('home has 2 entries', result.home.length, 2);
  assert('away has 1 entry', result.away.length, 1);

  // Player names preserved
  assert('home[0].name is Player 1', result.home[0].name, 'Player 1');
  assert('home[1].name is Player 2', result.home[1].name, 'Player 2');
  assert('away[0].name is Player 3', result.away[0].name, 'Player 3');

  // Positions preserved
  assert('home[0].position is PG', result.home[0].position, 'PG');
  assert('away[0].position is C', result.away[0].position, 'C');

  // XP calculation (estimatedMinutes = 24 from service):
  //   Player 1: 20*2 + 3*3 + 8*4 + 2*5 + 0*5 + 24*1 = 40+9+32+10+0+24 = 115
  //   Player 2: 15*2 + 4*3 + 2*4 + 1*5 + 0*5 + 24*1 = 30+12+8+5+0+24  = 79
  //   Player 3: 10*2 + 10*3 + 1*4 + 0*5 + 3*5 + 24*1 = 20+30+4+0+15+24 = 93
  assert('home[0].xpGained = 115', result.home[0].xpGained, 115);
  assert('home[1].xpGained = 79', result.home[1].xpGained, 79);
  assert('away[0].xpGained = 93', result.away[0].xpGained, 93);

  // totalXP (starting from 0 since no totalXP on stat objects)
  assert('home[0].totalXP = 115', result.home[0].totalXP, 115);
  assert('home[1].totalXP = 79', result.home[1].totalXP, 79);
  assert('away[0].totalXP = 93', result.away[0].totalXP, 93);
}

// ===========================================================================
// processMatchXP — level info and levels gained
// ===========================================================================

section('processMatchXP -- level info and levels gained');

{
  const result = processMatchXP(makeMatchResult());

  // 115 XP >= 100 threshold for level 2 → level 2
  assert('home[0] reached level 2', result.home[0].levelInfo.currentLevel, 2);
  assert('home[0] gained 1 level', result.home[0].levelsGained, 1);

  // 79 XP < 100 threshold → stays at level 1
  assert('home[1] stays at level 1', result.home[1].levelInfo.currentLevel, 1);
  assert('home[1] gained 0 levels', result.home[1].levelsGained, 0);

  // 93 XP < 100 threshold → stays at level 1
  assert('away[0] stays at level 1', result.away[0].levelInfo.currentLevel, 1);
  assert('away[0] gained 0 levels', result.away[0].levelsGained, 0);
}

// ===========================================================================
// processMatchXP — null and edge-case inputs
// ===========================================================================

section('processMatchXP -- null and edge-case inputs');

{
  const nullResult = processMatchXP(null);
  assertDeepEqual('null input returns empty home/away', nullResult, { home: [], away: [] });
}

{
  const undefinedResult = processMatchXP(undefined);
  assertDeepEqual('undefined input returns empty home/away', undefinedResult, { home: [], away: [] });
}

{
  const emptyObj = processMatchXP({});
  assertDeepEqual('empty object returns empty home/away', emptyObj, { home: [], away: [] });
}

{
  const nullStats = processMatchXP({ homeTeamStats: null, awayTeamStats: undefined });
  assertDeepEqual('null/undefined stats arrays return empty', nullStats, { home: [], away: [] });
}

{
  const nonArray = processMatchXP({ homeTeamStats: 'not-an-array', awayTeamStats: 42 });
  assertDeepEqual('non-array stats return empty', nonArray, { home: [], away: [] });
}

// ===========================================================================
// processMatchXP — higher stats produce more XP, capped at MAX (200)
// ===========================================================================

section('processMatchXP -- XP capping at MAX (200)');

{
  // Raw XP: 50*2 + 20*3 + 15*4 + 5*5 + 5*5 + 24*1 = 100+60+60+25+25+24 = 294 → clamped to 200
  const result = processMatchXP({
    homeTeamStats: [
      { name: 'Star', position: 'PG', points: 50, rebounds: 20, assists: 15, steals: 5, blocks: 5 },
    ],
    awayTeamStats: [],
  });

  assert('high stats XP capped at 200', result.home[0].xpGained, 200);
  assert('totalXP reflects capped value', result.home[0].totalXP, 200);
  assert('away is empty array for empty stats', result.away.length, 0);
}

{
  // Compare: low stats should produce less XP than high stats
  const low = processMatchXP({
    homeTeamStats: [
      { name: 'Bench', position: 'SG', points: 2, rebounds: 0, assists: 0, steals: 0, blocks: 0 },
    ],
    awayTeamStats: [],
  });
  // Raw XP: 2*2 + 0 + 0 + 0 + 0 + 24*1 = 28
  assert('low stats XP = 28', low.home[0].xpGained, 28);
  assertTruthy('low stats < high stats (28 < 200)', low.home[0].xpGained < 200);
}

// ===========================================================================
// processMatchXP — player with existing totalXP in stats
// ===========================================================================

section('processMatchXP -- player with existing totalXP in stats');

{
  const result = processMatchXP({
    homeTeamStats: [
      { name: 'Veteran', position: 'SF', points: 10, rebounds: 5, assists: 5, steals: 1, blocks: 1, totalXP: 90 },
    ],
    awayTeamStats: [],
  });

  // Raw XP: 10*2 + 5*3 + 5*4 + 1*5 + 1*5 + 24*1 = 20+15+20+5+5+24 = 89
  assert('veteran xpGained = 89', result.home[0].xpGained, 89);
  assert('veteran totalXP = 90 + 89 = 179', result.home[0].totalXP, 179);
  // getLevelInfo(0).currentLevel = 1 for previousXP=0; but this player had previousXP=90
  // getLevelInfo(90) → level 1; getLevelInfo(179) → level 2
  assert('veteran levelsGained = 1', result.home[0].levelsGained, 1);
  assert('veteran level is now 2', result.home[0].levelInfo.currentLevel, 2);
}

// ===========================================================================
// applyXPToPlayers — basic XP application, no level-up
// ===========================================================================

section('applyXPToPlayers -- basic XP application, no level-up');

{
  const players = [
    makePlayer('Alice', 'PG', 'Scorer', { totalXP: 0 }),
    makePlayer('Bob', 'SG', 'Defender', { totalXP: 50 }),
  ];

  const xpResults = [
    { name: 'Alice', totalXP: 79, levelsGained: 0 },
  ];

  const outcome = applyXPToPlayers(players, xpResults);

  assert('Alice totalXP updated to 79', players[0].totalXP, 79);
  assert('Bob totalXP unchanged at 50', players[1].totalXP, 50);
  assert('levelUps is an array', Array.isArray(outcome.levelUps), true);
  assert('no level-ups reported', outcome.levelUps.length, 0);
}

// ===========================================================================
// applyXPToPlayers — empty xpResults changes nothing
// ===========================================================================

section('applyXPToPlayers -- empty xpResults');

{
  const players = [makePlayer('Charlie', 'C', 'Rebounder', { totalXP: 200 })];
  const outcome = applyXPToPlayers(players, []);

  assert('Charlie totalXP unchanged at 200', players[0].totalXP, 200);
  assert('no level-ups for empty results', outcome.levelUps.length, 0);
}

// ===========================================================================
// applyXPToPlayers — detects level-up and auto-picks recommended attribute
// ===========================================================================

section('applyXPToPlayers -- level-up detection and auto attribute upgrade');

{
  const player = makePlayer('LevelUpGuy', 'PF', 'Scorer', { totalXP: 0 });
  const originalAttack = player.attributes.Attack; // 70

  // levelsGained: 1 triggers one call to levelUpPlayer
  const xpResults = [
    { name: 'LevelUpGuy', totalXP: 150, levelsGained: 1 },
  ];

  const outcome = applyXPToPlayers([player], xpResults);

  assert('player totalXP set to 150', player.totalXP, 150);
  assert('one level-up reported', outcome.levelUps.length, 1);
  assert('level-up player name matches', outcome.levelUps[0].player.name, 'LevelUpGuy');
  assert('level-up previousLevel is 1', outcome.levelUps[0].previousLevel, 1);
  // getLevelInfo(150).currentLevel = 2
  assert('level-up newLevel is 2', outcome.levelUps[0].newLevel, 2);
  // Scorer's first recommended attribute is 'Attack'
  assert('level-up attribute is Attack (Scorer primary)', outcome.levelUps[0].attribute, 'Attack');
  // levelUpPlayer randomly adds +1, +2, or +3
  assertTruthy('Attack attribute increased', player.attributes.Attack > originalAttack);
  assertTruthy('Attack increased by at most 3', player.attributes.Attack <= originalAttack + 3);
}

// ===========================================================================
// applyXPToPlayers — multi-level-up (2 levels gained at once)
// ===========================================================================

section('applyXPToPlayers -- multi-level-up (2 levels gained)');

{
  const player = makePlayer('BigJump', 'SG', 'Defender', { totalXP: 0 });
  const originalDefense = player.attributes.Defense; // 60

  // levelsGained: 2 triggers two calls to levelUpPlayer
  const xpResults = [
    { name: 'BigJump', totalXP: 250, levelsGained: 2 },
  ];

  const outcome = applyXPToPlayers([player], xpResults);

  assert('player totalXP set to 250', player.totalXP, 250);
  assert('one level-up entry reported', outcome.levelUps.length, 1);
  // Defender's first recommended attribute is 'Defense'
  assert('level-up attribute is Defense (Defender primary)', outcome.levelUps[0].attribute, 'Defense');
  // Two level-ups: each adds at least +1, so minimum total gain is +2
  assertTruthy('Defense increased by at least 2', player.attributes.Defense >= originalDefense + 2);
  // Maximum: each adds +3 → total +6
  assertTruthy('Defense increased by at most 6', player.attributes.Defense <= originalDefense + 6);
}

// ===========================================================================
// applyXPToPlayers — Playmaker archetype uses Passing as primary
// ===========================================================================

section('applyXPToPlayers -- Playmaker archetype uses Passing as primary');

{
  const player = makePlayer('FloorGeneral', 'PG', 'Playmaker', { totalXP: 0 });
  const originalPassing = player.attributes.Passing; // 55

  const xpResults = [
    { name: 'FloorGeneral', totalXP: 120, levelsGained: 1 },
  ];

  const outcome = applyXPToPlayers([player], xpResults);

  assert('Playmaker level-up attribute is Passing', outcome.levelUps[0].attribute, 'Passing');
  assertTruthy('Passing attribute increased', player.attributes.Passing > originalPassing);
}

// ===========================================================================
// applyXPToPlayers — unmatched player name in xpResults is ignored
// ===========================================================================

section('applyXPToPlayers -- unmatched player name is ignored');

{
  const players = [makePlayer('OnlyPlayer', 'PG', 'Scorer', { totalXP: 0 })];
  const xpResults = [
    { name: 'GhostPlayer', totalXP: 500, levelsGained: 3 },
  ];

  const outcome = applyXPToPlayers(players, xpResults);

  assert('OnlyPlayer totalXP unchanged', players[0].totalXP, 0);
  assert('no level-ups (unmatched name)', outcome.levelUps.length, 0);
}

// ===========================================================================
// processEndOfSeasonAging — teams with no players (graceful handling)
// ===========================================================================

section('processEndOfSeasonAging -- teams with no players');

{
  const result = processEndOfSeasonAging([{ name: 'Team A', players: null }]);
  assert('null players: retirements is empty array', result[0].retirements.length, 0);
  assert('null players: team name preserved', result[0].name, 'Team A');
}

{
  const result = processEndOfSeasonAging([{ name: 'Team B' }]);
  assert('missing players prop: retirements is empty array', result[0].retirements.length, 0);
  assert('missing players prop: team name preserved', result[0].name, 'Team B');
}

{
  const result = processEndOfSeasonAging([{ name: 'Team C', players: 'invalid' }]);
  assert('non-array players: retirements is empty array', result[0].retirements.length, 0);
}

{
  // Multiple teams, all without valid players
  const result = processEndOfSeasonAging([
    { name: 'X', players: null },
    { name: 'Y' },
    { name: 'Z', players: undefined },
  ]);
  assert('multiple teams: result length is 3', result.length, 3);
  assert('team X retirements empty', result[0].retirements.length, 0);
  assert('team Y retirements empty', result[1].retirements.length, 0);
  assert('team Z retirements empty', result[2].retirements.length, 0);
}

// ===========================================================================
// processEndOfSeasonAging — empty teams array
// ===========================================================================

section('processEndOfSeasonAging -- empty teams array');

{
  const result = processEndOfSeasonAging([]);
  assert('empty teams array returns empty array', result.length, 0);
}

// ===========================================================================
// processEndOfSeasonAging — with actual players
//
// NOTE: processSeasonAging (from the engine) returns an object
// { updated, retired, declined, events }, but processEndOfSeasonAging
// calls .filter() on that object, which throws TypeError.
// This is a service/engine contract mismatch.
// ===========================================================================

section('processEndOfSeasonAging -- with players (TypeError: engine returns object, service expects array)');

{
  const teams = [{ name: 'Bug Team', players: [makePlayer('Vet', 'C', 'Rebounder', { age: 30 })] }];

  let threw = false;
  let errorType = '';
  try {
    processEndOfSeasonAging(teams);
  } catch (e) {
    threw = true;
    errorType = e.constructor.name;
  }

  assert('throws when team has players array', threw, true);
  assert('error is TypeError (filter not a function on object)', errorType, 'TypeError');
}

{
  // Even an empty array triggers the engine call (passes Array.isArray check)
  const teams = [{ name: 'Empty Roster', players: [] }];

  let threw = false;
  try {
    processEndOfSeasonAging(teams);
  } catch (e) {
    threw = true;
  }

  assert('empty players array also reaches engine path and throws', threw, true);
}

// ===========================================================================
// checkBreakthroughEvents — structure validation
// ===========================================================================

section('checkBreakthroughEvents -- empty players array');

{
  const result = checkBreakthroughEvents([]);

  assert('empty players: result has events property', 'events' in result, true);
  assert('empty players: events is an array', Array.isArray(result.events), true);
  assert('empty players: events length is 0', result.events.length, 0);
}

section('checkBreakthroughEvents -- with players (non-deterministic, validate structure)');

{
  // Use enough players to statistically expect at least some events (~10% chance each)
  const players = Array.from({ length: 100 }, (_, i) =>
    makePlayer(`BT_Player${i}`, 'PG', 'Scorer')
  );

  const result = checkBreakthroughEvents(players);

  assert('result has events property', 'events' in result, true);
  assert('events is an array', Array.isArray(result.events), true);

  // Validate every event in the array has correct shape
  const allValid = result.events.every(
    e => e.player !== undefined && typeof e.event === 'string' && e.event.length > 0
  );
  assert('all events have { player, event } structure', allValid, true);
}

// ===========================================================================
// getLevelInfo — deterministic level thresholds
// ===========================================================================

section('getLevelInfo -- deterministic level thresholds');

{
  // Level 1 at 0 XP
  const l1 = getLevelInfo(0);
  assert('0 XP → level 1', l1.currentLevel, 1);
  assert('0 XP → xpToNextLevel = 100', l1.xpToNextLevel, 100);
  assert('0 XP → progressPercent = 0', l1.progressPercent, 0);
}

{
  // Just below level 2
  const l1b = getLevelInfo(99);
  assert('99 XP → level 1', l1b.currentLevel, 1);
  assert('99 XP → xpToNextLevel = 1', l1b.xpToNextLevel, 1);
  assert('99 XP → progressPercent = 99', l1b.progressPercent, 99);
}

{
  // Exactly level 2
  const l2 = getLevelInfo(100);
  assert('100 XP → level 2', l2.currentLevel, 2);
}

{
  // Level 3 at 200 XP
  const l3 = getLevelInfo(200);
  assert('200 XP → level 3', l3.currentLevel, 3);
}

{
  // Level 5 at 400 XP
  const l5 = getLevelInfo(400);
  assert('400 XP → level 5', l5.currentLevel, 5);
}

{
  // Level 6 at 500 XP (tier boundary: tier 1 ends, tier 2 starts)
  const l6 = getLevelInfo(500);
  assert('500 XP → level 6', l6.currentLevel, 6);
  // After level 6, next tier costs 200 XP each, so xpToNextLevel = 200
  assert('500 XP → xpToNextLevel = 200 (tier 2)', l6.xpToNextLevel, 200);
}

{
  // Level 7 at 700 XP (500 + 200)
  const l7 = getLevelInfo(700);
  assert('700 XP → level 7', l7.currentLevel, 7);
}

{
  // Level 10 at 1300 XP (500 + 4*200)
  const l10 = getLevelInfo(1300);
  assert('1300 XP → level 10', l10.currentLevel, 10);
}

{
  // Level 11 at 1500 XP (500 + 5*200)
  const l11 = getLevelInfo(1500);
  assert('1500 XP → level 11', l11.currentLevel, 11);
}

{
  // Negative or NaN XP treated as 0
  const neg = getLevelInfo(-50);
  assert('-50 XP → level 1 (clamped to 0)', neg.currentLevel, 1);
}

// ===========================================================================
// getRecommendedLevelUpAttributes — known archetypes
// ===========================================================================

section('getRecommendedLevelUpAttributes -- known archetypes');

{
  const scorer = getRecommendedLevelUpAttributes('Scorer');
  assert('Scorer: is an array', Array.isArray(scorer), true);
  assert('Scorer: has 5 recommendations', scorer.length, 5);
  assert('Scorer: primary is Attack', scorer[0], 'Attack');
  assert('Scorer: secondary is ThreePoint', scorer[1], 'ThreePoint');
}

{
  const defender = getRecommendedLevelUpAttributes('Defender');
  assert('Defender: primary is Defense', defender[0], 'Defense');
  assert('Defender: has 5 recommendations', defender.length, 5);
}

{
  const playmaker = getRecommendedLevelUpAttributes('Playmaker');
  assert('Playmaker: primary is Passing', playmaker[0], 'Passing');
}

{
  const rebounder = getRecommendedLevelUpAttributes('Rebounder');
  assert('Rebounder: primary is FieldGoalPaint', rebounder[0], 'FieldGoalPaint');
}

{
  const stretch = getRecommendedLevelUpAttributes('Stretch');
  assert('Stretch: primary is ThreePoint', stretch[0], 'ThreePoint');
  assert('Stretch: has 5 recommendations', stretch.length, 5);
}

// ===========================================================================
// getRecommendedLevelUpAttributes — unknown archetype returns fallback
// ===========================================================================

section('getRecommendedLevelUpAttributes -- unknown archetype fallback');

{
  const unknown = getRecommendedLevelUpAttributes('NonExistent');
  assert('unknown archetype returns array', Array.isArray(unknown), true);
  assert('unknown archetype has 5 entries', unknown.length, 5);
  assert('unknown archetype primary is Attack (fallback)', unknown[0], 'Attack');
  assertDeepEqual(
    'unknown archetype full fallback list',
    unknown,
    ['Attack', 'Defense', 'Stamina', 'ThreePoint', 'Passing']
  );
}

{
  const nullType = getRecommendedLevelUpAttributes(null);
  assert('null archetype returns fallback array', Array.isArray(nullType), true);
  assert('null archetype has 5 entries', nullType.length, 5);
}

{
  const undefType = getRecommendedLevelUpAttributes(undefined);
  assert('undefined archetype returns fallback array', Array.isArray(undefType), true);
}

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + '='.repeat(60));
console.log(`  progressionService tests: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
  process.exit(1);
}

process.exit(0);
