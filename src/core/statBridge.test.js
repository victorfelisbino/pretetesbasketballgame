/**
 * Stat Bridge — Exhaustive Tests
 * Quadra Legacy — src/core/statBridge.test.js
 *
 * Run with: node src/core/statBridge.test.js
 *
 * No external test libraries; plain Node.js only.
 */

import {
  engineToFirestore,
  firestoreToEngine,
  engineToFantasy,
  normalizeMatchStats,
} from './statBridge.js';

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

function assertThrows(label, fn) {
  try {
    fn();
    console.log(`  FAIL  ${label} (no error thrown)`);
    failCount++;
  } catch {
    console.log(`  PASS  ${label}`);
    passCount++;
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ===========================================================================
// engineToFirestore
// ===========================================================================

section('engineToFirestore — flat engine stats');

{
  const input = {
    pointsScored: 24,
    assists: 5,
    rebounds: 8,
    steals: 2,
    blocks: 1,
    turnovers: 3,
    fouls: 2,
  };
  const result = engineToFirestore(input);
  assert('pts', result.pts, 24);
  assert('ast', result.ast, 5);
  assert('reb', result.reb, 8);
  assert('stl', result.stl, 2);
  assert('blk', result.blk, 1);
  assert('to', result.to, 3);
  assert('fouls', result.fouls, 2);
}

section('engineToFirestore — nested engine player object');

{
  const input = {
    name: 'LeBron',
    position: 'SF',
    stats: {
      pointsScored: 30,
      assists: 10,
      rebounds: 12,
      steals: 1,
      blocks: 3,
      turnovers: 0,
    },
  };
  const result = engineToFirestore(input);
  assert('pts from nested stats', result.pts, 30);
  assert('ast from nested stats', result.ast, 10);
  assert('reb from nested stats', result.reb, 12);
  assert('stl from nested stats', result.stl, 1);
  assert('blk from nested stats', result.blk, 3);
  assert('to from nested stats', result.to, 0);
}

section('engineToFirestore — defaults to 0 for missing keys');

{
  const result = engineToFirestore({});
  assert('pts defaults to 0', result.pts, 0);
  assert('ast defaults to 0', result.ast, 0);
  assert('reb defaults to 0', result.reb, 0);
  assert('stl defaults to 0', result.stl, 0);
  assert('blk defaults to 0', result.blk, 0);
  assert('to defaults to 0', result.to, 0);
}

section('engineToFirestore — null/undefined input returns empty object');

{
  const resultNull = engineToFirestore(null);
  assertDeepEqual('null returns {}', resultNull, {});
  const resultUndef = engineToFirestore(undefined);
  assertDeepEqual('undefined returns {}', resultUndef, {});
}

section('engineToFirestore — free throw fields');

{
  const input = {
    pointsScored: 10,
    assists: 0,
    rebounds: 0,
    steals: 0,
    blocks: 0,
    freeThrowsMade: 5,
    freeThrowsAttempted: 7,
  };
  const result = engineToFirestore(input);
  assert('ftMade', result.ftMade, 5);
  assert('ftAttempted', result.ftAttempted, 7);
}

section('engineToFirestore — legacy freethrows/freethrowsMade fields');

{
  const input = {
    pointsScored: 10,
    assists: 0,
    rebounds: 0,
    steals: 0,
    blocks: 0,
    freethrowsMade: 4,
    freethrows: 6,
  };
  const result = engineToFirestore(input);
  assert('ftMade from legacy field', result.ftMade, 4);
  assert('ftAttempted from legacy field', result.ftAttempted, 6);
}

// ===========================================================================
// firestoreToEngine
// ===========================================================================

section('firestoreToEngine — basic conversion');

{
  const input = { pts: 24, ast: 5, reb: 8, stl: 2, blk: 1, to: 3, fouls: 2 };
  const result = firestoreToEngine(input);
  assert('pointsScored', result.pointsScored, 24);
  assert('assists', result.assists, 5);
  assert('rebounds', result.rebounds, 8);
  assert('steals', result.steals, 2);
  assert('blocks', result.blocks, 1);
  assert('turnovers', result.turnovers, 3);
  assert('fouls', result.fouls, 2);
}

section('firestoreToEngine — defaults to 0 for missing keys');

{
  const result = firestoreToEngine({});
  assert('pointsScored defaults to 0', result.pointsScored, 0);
  assert('assists defaults to 0', result.assists, 0);
  assert('rebounds defaults to 0', result.rebounds, 0);
  assert('steals defaults to 0', result.steals, 0);
  assert('blocks defaults to 0', result.blocks, 0);
  assert('turnovers defaults to 0', result.turnovers, 0);
}

section('firestoreToEngine — null/undefined input returns empty object');

{
  const resultNull = firestoreToEngine(null);
  assertDeepEqual('null returns {}', resultNull, {});
  const resultUndef = firestoreToEngine(undefined);
  assertDeepEqual('undefined returns {}', resultUndef, {});
}

section('firestoreToEngine — free throw fields');

{
  const input = { pts: 10, ast: 0, reb: 0, stl: 0, blk: 0, ftMade: 5, ftAttempted: 7 };
  const result = firestoreToEngine(input);
  assert('freeThrowsMade', result.freeThrowsMade, 5);
  assert('freeThrowsAttempted', result.freeThrowsAttempted, 7);
}

// ===========================================================================
// Round-trip: engineToFirestore -> firestoreToEngine
// ===========================================================================

section('Round-trip: engine -> firestore -> engine');

{
  const original = {
    pointsScored: 18,
    assists: 7,
    rebounds: 4,
    steals: 3,
    blocks: 2,
    turnovers: 1,
    fouls: 3,
    freeThrowsMade: 4,
    freeThrowsAttempted: 5,
  };

  const firestore = engineToFirestore(original);
  const roundTrip = firestoreToEngine(firestore);

  assert('round-trip pointsScored', roundTrip.pointsScored, original.pointsScored);
  assert('round-trip assists', roundTrip.assists, original.assists);
  assert('round-trip rebounds', roundTrip.rebounds, original.rebounds);
  assert('round-trip steals', roundTrip.steals, original.steals);
  assert('round-trip blocks', roundTrip.blocks, original.blocks);
  assert('round-trip turnovers', roundTrip.turnovers, original.turnovers);
  assert('round-trip fouls', roundTrip.fouls, original.fouls);
  assert('round-trip freeThrowsMade', roundTrip.freeThrowsMade, original.freeThrowsMade);
  assert('round-trip freeThrowsAttempted', roundTrip.freeThrowsAttempted, original.freeThrowsAttempted);
}

// ===========================================================================
// engineToFantasy
// ===========================================================================

section('engineToFantasy — flat engine stats');

{
  const input = {
    pointsScored: 24,
    assists: 5,
    rebounds: 8,
    steals: 2,
    blocks: 1,
    turnovers: 3,
  };
  const result = engineToFantasy(input);
  assert('points (from pointsScored)', result.points, 24);
  assert('assists', result.assists, 5);
  assert('rebounds', result.rebounds, 8);
  assert('steals', result.steals, 2);
  assert('blocks', result.blocks, 1);
  assert('turnovers', result.turnovers, 3);
}

section('engineToFantasy — nested engine player object');

{
  const input = {
    id: 'player_1',
    name: 'Curry',
    position: 'PG',
    stats: {
      pointsScored: 35,
      assists: 8,
      rebounds: 4,
      steals: 1,
      blocks: 0,
      turnovers: 2,
    },
  };
  const result = engineToFantasy(input);
  assert('points from nested stats', result.points, 35);
  assert('assists from nested stats', result.assists, 8);
  assert('rebounds from nested stats', result.rebounds, 4);
  assert('steals from nested stats', result.steals, 1);
  assert('blocks from nested stats', result.blocks, 0);
  assert('turnovers from nested stats', result.turnovers, 2);
  assert('playerId carried over', result.playerId, 'player_1');
  assert('playerName carried over', result.playerName, 'Curry');
  assert('position carried over', result.position, 'PG');
}

section('engineToFantasy — defaults to 0 for missing keys');

{
  const result = engineToFantasy({});
  assert('points defaults to 0', result.points, 0);
  assert('assists defaults to 0', result.assists, 0);
  assert('rebounds defaults to 0', result.rebounds, 0);
  assert('steals defaults to 0', result.steals, 0);
  assert('blocks defaults to 0', result.blocks, 0);
  assert('turnovers defaults to 0', result.turnovers, 0);
}

section('engineToFantasy — null/undefined input returns empty object');

{
  const resultNull = engineToFantasy(null);
  assertDeepEqual('null returns {}', resultNull, {});
  const resultUndef = engineToFantasy(undefined);
  assertDeepEqual('undefined returns {}', resultUndef, {});
}

// ===========================================================================
// normalizeMatchStats
// ===========================================================================

section('normalizeMatchStats — standard match summary');

{
  const summary = {
    homeTeam: 'Lakers',
    awayTeam: 'Celtics',
    homeScore: 110,
    awayScore: 105,
    homeTeamStats: [
      { name: 'LeBron', position: 'SF', points: 30, assists: 10, rebounds: 8, steals: 2, blocks: 1 },
      { name: 'AD', position: 'PF', points: 22, assists: 3, rebounds: 12, steals: 1, blocks: 3 },
    ],
    awayTeamStats: [
      { name: 'Tatum', position: 'SF', points: 28, assists: 5, rebounds: 7, steals: 1, blocks: 0 },
    ],
  };

  const result = normalizeMatchStats(summary);

  assert('LeBron pts', result['LeBron'].pts, 30);
  assert('LeBron ast', result['LeBron'].ast, 10);
  assert('LeBron reb', result['LeBron'].reb, 8);
  assert('LeBron stl', result['LeBron'].stl, 2);
  assert('LeBron blk', result['LeBron'].blk, 1);
  assert('LeBron position', result['LeBron'].position, 'SF');

  assert('AD pts', result['AD'].pts, 22);
  assert('AD ast', result['AD'].ast, 3);
  assert('AD reb', result['AD'].reb, 12);
  assert('AD stl', result['AD'].stl, 1);
  assert('AD blk', result['AD'].blk, 3);

  assert('Tatum pts', result['Tatum'].pts, 28);
  assert('Tatum ast', result['Tatum'].ast, 5);
  assert('Tatum reb', result['Tatum'].reb, 7);

  // All players from both teams are present
  assert('total players', Object.keys(result).length, 3);
}

section('normalizeMatchStats — handles pointsScored key from raw engine');

{
  const summary = {
    homeTeamStats: [
      { name: 'Player1', position: 'PG', pointsScored: 15, assists: 4, rebounds: 2, steals: 1, blocks: 0 },
    ],
    awayTeamStats: [],
  };

  const result = normalizeMatchStats(summary);
  assert('pts from pointsScored', result['Player1'].pts, 15);
}

section('normalizeMatchStats — null/undefined input returns empty object');

{
  assertDeepEqual('null returns {}', normalizeMatchStats(null), {});
  assertDeepEqual('undefined returns {}', normalizeMatchStats(undefined), {});
}

section('normalizeMatchStats — empty team arrays');

{
  const summary = { homeTeamStats: [], awayTeamStats: [] };
  const result = normalizeMatchStats(summary);
  assert('no players', Object.keys(result).length, 0);
}

section('normalizeMatchStats — missing team arrays');

{
  const summary = { homeScore: 50, awayScore: 40 };
  const result = normalizeMatchStats(summary);
  assert('no players when arrays missing', Object.keys(result).length, 0);
}

section('normalizeMatchStats — defaults for missing stat fields');

{
  const summary = {
    homeTeamStats: [
      { name: 'Rookie', position: 'PG' },
    ],
    awayTeamStats: [],
  };
  const result = normalizeMatchStats(summary);
  assert('pts defaults to 0', result['Rookie'].pts, 0);
  assert('ast defaults to 0', result['Rookie'].ast, 0);
  assert('reb defaults to 0', result['Rookie'].reb, 0);
  assert('stl defaults to 0', result['Rookie'].stl, 0);
  assert('blk defaults to 0', result['Rookie'].blk, 0);
  assert('to defaults to 0', result['Rookie'].to, 0);
}

section('normalizeMatchStats — free throw fields preserved');

{
  const summary = {
    homeTeamStats: [
      { name: 'Shaq', position: 'C', points: 20, assists: 1, rebounds: 10, steals: 0, blocks: 2, freeThrowsMade: 6, freeThrowsAttempted: 14 },
    ],
    awayTeamStats: [],
  };
  const result = normalizeMatchStats(summary);
  assert('ftMade', result['Shaq'].ftMade, 6);
  assert('ftAttempted', result['Shaq'].ftAttempted, 14);
}

// ===========================================================================
// Edge cases: non-numeric values
// ===========================================================================

section('Edge cases — non-numeric values coerced to 0');

{
  const result = engineToFirestore({ pointsScored: 'abc', assists: NaN, rebounds: undefined });
  assert('non-numeric pointsScored coerced to 0', result.pts, 0);
  assert('NaN assists coerced to 0', result.ast, 0);
  assert('undefined rebounds coerced to 0', result.reb, 0);
}

{
  const result = firestoreToEngine({ pts: Infinity, ast: null, reb: '' });
  assert('Infinity pts coerced to 0', result.pointsScored, 0);
  assert('null ast coerced to 0', result.assists, 0);
  assert('empty string reb coerced to 0', result.rebounds, 0);
}

{
  const result = engineToFantasy({ pointsScored: {}, assists: [], rebounds: false });
  assert('object pointsScored coerced to 0', result.points, 0);
  assert('array assists coerced to 0', result.assists, 0);
  assert('false rebounds coerced to 0', result.rebounds, 0);
}

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + '='.repeat(50));
console.log(`  statBridge tests: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(50));

if (failCount > 0) {
  process.exit(1);
}
