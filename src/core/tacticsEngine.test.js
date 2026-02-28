/**
 * Tactics Engine — Exhaustive Tests
 * Quadra Legacy — src/core/tacticsEngine.test.js
 *
 * Run with: node src/core/tacticsEngine.test.js
 *
 * All expected values are derived directly from the tacticsEngine.js source.
 * applyMod(base, mod) = Math.max(0, base * (1 + mod))
 * No external test libraries; plain Node.js only.
 */

import {
  PLAY_STYLES,
  DEFENSIVE_SCHEMES,
  applyPlayStyleModifiers,
  applyDefensiveSchemeModifiers,
  calculateChemistryBonus,
  createGamePlan,
  findStarPlayer
} from './tacticsEngine.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

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

function assertClose(label, actual, expected, tol = 0.0001) {
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

/**
 * applyMod formula replicated from tacticsEngine.js for computing expected values.
 * Result = Math.max(0, base * (1 + mod))
 */
function applyMod(base, mod) {
  if (!isFinite(base) || !isFinite(mod)) return base;
  return Math.max(0, base * (1 + mod));
}

// ---------------------------------------------------------------------------
// Group 1 — PLAY_STYLES constants
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 1: PLAY_STYLES constants');
console.log('='.repeat(60));

const EXPECTED_PLAY_STYLE_KEYS = [
  'id','label','description',
  'possessionSpeedMod','shootingMod','threePointVolume',
  'paintScoring','starUsageMod','chemistryMod',
  'pgSgFantasyMod','cfFantasyMod'
];

const EXPECTED_PLAY_STYLES = ['TRANSITION','HALF_COURT','ISOLATION','SPREAD_3PT','POST_UP'];

// All five play styles exist
for (const name of EXPECTED_PLAY_STYLES) {
  assert(`PLAY_STYLES.${name} exists`, typeof PLAY_STYLES[name] === 'object', true);
}

// Each style is frozen and has all required keys
for (const name of EXPECTED_PLAY_STYLES) {
  const style = PLAY_STYLES[name];
  assert(`PLAY_STYLES.${name} is frozen`, Object.isFrozen(style), true);
  assert(`PLAY_STYLES.${name}.id === '${name}'`, style.id, name);
  for (const key of EXPECTED_PLAY_STYLE_KEYS) {
    assert(`PLAY_STYLES.${name}.${key} exists`, key in style, true);
  }
}

// Spot-check specific values sourced directly from the file
assert('TRANSITION.possessionSpeedMod === +0.2',  PLAY_STYLES.TRANSITION.possessionSpeedMod,  0.2);
assert('TRANSITION.shootingMod === -0.1',          PLAY_STYLES.TRANSITION.shootingMod,        -0.1);
assert('TRANSITION.pgSgFantasyMod === +0.1',       PLAY_STYLES.TRANSITION.pgSgFantasyMod,      0.1);
assert('TRANSITION.cfFantasyMod === -0.05',        PLAY_STYLES.TRANSITION.cfFantasyMod,       -0.05);

assert('HALF_COURT.possessionSpeedMod === -0.1',   PLAY_STYLES.HALF_COURT.possessionSpeedMod, -0.1);
assert('HALF_COURT.shootingMod === +0.15',         PLAY_STYLES.HALF_COURT.shootingMod,         0.15);
assert('HALF_COURT.paintScoring === +0.1',         PLAY_STYLES.HALF_COURT.paintScoring,        0.1);
assert('HALF_COURT.chemistryMod === +0.05',        PLAY_STYLES.HALF_COURT.chemistryMod,        0.05);
assert('HALF_COURT.cfFantasyMod === +0.05',        PLAY_STYLES.HALF_COURT.cfFantasyMod,        0.05);

assert('ISOLATION.starUsageMod === +0.3',          PLAY_STYLES.ISOLATION.starUsageMod,         0.3);
assert('ISOLATION.chemistryMod === -0.1',          PLAY_STYLES.ISOLATION.chemistryMod,        -0.1);
assert('ISOLATION.possessionSpeedMod === 0',       PLAY_STYLES.ISOLATION.possessionSpeedMod,   0);

assert('SPREAD_3PT.threePointVolume === +0.4',     PLAY_STYLES.SPREAD_3PT.threePointVolume,    0.4);
assert('SPREAD_3PT.paintScoring === -0.3',         PLAY_STYLES.SPREAD_3PT.paintScoring,       -0.3);
assert('SPREAD_3PT.pgSgFantasyMod === +0.15',      PLAY_STYLES.SPREAD_3PT.pgSgFantasyMod,      0.15);
assert('SPREAD_3PT.cfFantasyMod === -0.2',         PLAY_STYLES.SPREAD_3PT.cfFantasyMod,       -0.2);

assert('POST_UP.paintScoring === +0.3',            PLAY_STYLES.POST_UP.paintScoring,           0.3);
assert('POST_UP.threePointVolume === -0.2',        PLAY_STYLES.POST_UP.threePointVolume,      -0.2);
assert('POST_UP.pgSgFantasyMod === -0.2',          PLAY_STYLES.POST_UP.pgSgFantasyMod,        -0.2);
assert('POST_UP.cfFantasyMod === +0.2',            PLAY_STYLES.POST_UP.cfFantasyMod,           0.2);

// ---------------------------------------------------------------------------
// Group 2 — DEFENSIVE_SCHEMES constants
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 2: DEFENSIVE_SCHEMES constants');
console.log('='.repeat(60));

const EXPECTED_DEF_SCHEME_KEYS = [
  'id','label','description',
  'stealRateMod','threePointAllowedMod','reboundMod',
  'turnoverRateMod','staminaCostMod','forceFTRate','riskLevel'
];

const EXPECTED_SCHEMES = ['MAN_TO_MAN','ZONE','PRESS','HACK_A_CENTER'];

// All four schemes exist
for (const name of EXPECTED_SCHEMES) {
  assert(`DEFENSIVE_SCHEMES.${name} exists`, typeof DEFENSIVE_SCHEMES[name] === 'object', true);
}

// Each scheme is frozen and has all required keys
for (const name of EXPECTED_SCHEMES) {
  const scheme = DEFENSIVE_SCHEMES[name];
  assert(`DEFENSIVE_SCHEMES.${name} is frozen`, Object.isFrozen(scheme), true);
  assert(`DEFENSIVE_SCHEMES.${name}.id === '${name}'`, scheme.id, name);
  for (const key of EXPECTED_DEF_SCHEME_KEYS) {
    assert(`DEFENSIVE_SCHEMES.${name}.${key} exists`, key in scheme, true);
  }
}

// Spot-check specific values sourced directly from the file
assert('MAN_TO_MAN.stealRateMod === +0.15',          DEFENSIVE_SCHEMES.MAN_TO_MAN.stealRateMod,         0.15);
assert('MAN_TO_MAN.threePointAllowedMod === +0.05',  DEFENSIVE_SCHEMES.MAN_TO_MAN.threePointAllowedMod, 0.05);
assert('MAN_TO_MAN.reboundMod === -0.05',            DEFENSIVE_SCHEMES.MAN_TO_MAN.reboundMod,          -0.05);
assert('MAN_TO_MAN.riskLevel === "medium"',          DEFENSIVE_SCHEMES.MAN_TO_MAN.riskLevel,           'medium');
assert('MAN_TO_MAN.forceFTRate === 0',               DEFENSIVE_SCHEMES.MAN_TO_MAN.forceFTRate,          0);

assert('ZONE.stealRateMod === -0.1',                 DEFENSIVE_SCHEMES.ZONE.stealRateMod,              -0.1);
assert('ZONE.threePointAllowedMod === -0.1',         DEFENSIVE_SCHEMES.ZONE.threePointAllowedMod,      -0.1);
assert('ZONE.reboundMod === +0.15',                  DEFENSIVE_SCHEMES.ZONE.reboundMod,                 0.15);
assert('ZONE.staminaCostMod === -0.05',              DEFENSIVE_SCHEMES.ZONE.staminaCostMod,            -0.05);
assert('ZONE.riskLevel === "low"',                   DEFENSIVE_SCHEMES.ZONE.riskLevel,                 'low');

assert('PRESS.stealRateMod === +0.2',                DEFENSIVE_SCHEMES.PRESS.stealRateMod,              0.2);
assert('PRESS.turnoverRateMod === +0.2',             DEFENSIVE_SCHEMES.PRESS.turnoverRateMod,           0.2);
assert('PRESS.staminaCostMod === +0.3',              DEFENSIVE_SCHEMES.PRESS.staminaCostMod,            0.3);
assert('PRESS.riskLevel === "high"',                 DEFENSIVE_SCHEMES.PRESS.riskLevel,                'high');

assert('HACK_A_CENTER.forceFTRate === 0.8',          DEFENSIVE_SCHEMES.HACK_A_CENTER.forceFTRate,       0.8);
assert('HACK_A_CENTER.riskLevel === "high"',         DEFENSIVE_SCHEMES.HACK_A_CENTER.riskLevel,        'high');
assert('HACK_A_CENTER.stealRateMod === 0',           DEFENSIVE_SCHEMES.HACK_A_CENTER.stealRateMod,      0);
assert('HACK_A_CENTER.reboundMod === 0',             DEFENSIVE_SCHEMES.HACK_A_CENTER.reboundMod,        0);

// ---------------------------------------------------------------------------
// Group 3 — applyPlayStyleModifiers: TRANSITION style
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 3: applyPlayStyleModifiers — TRANSITION style');
console.log('='.repeat(60));

/*
 * TRANSITION: possessionSpeedMod=+0.2, shootingMod=−0.1, threePointVolume=0, paintScoring=0
 *   possessionSpeed=100  → applyMod(100, +0.2) = 120
 *   shooting=80          → applyMod(80, −0.1)  = 72
 *   shooting3pt=70       → applyMod(70, 0)     = 70 (no change)
 *   paintChance=0.3      → applyMod(0.3, 0)    = 0.3 (no change)
 *   threePointChance=0.25 → Math.max(0, Math.min(1, 0.25+0)) = 0.25
 *
 * PG position (isGuard=true):  fantasyPointMod = 1 + 0.1 = 1.1
 * C  position (isBig=true):    fantasyPointMod = 1 + (−0.05) = 0.95
 * SF position (neutral):       fantasyPointMod = 1
 */

const TRANSITION_BASE = {
  possessionSpeed:  100,
  shooting:          80,
  shooting3pt:       70,
  paintChance:        0.3,
  threePointChance:   0.25
};

const transPG = applyPlayStyleModifiers(TRANSITION_BASE, 'TRANSITION', { position: 'PG' });
assertClose('TRANSITION + PG: possessionSpeed = 100×1.2 = 120', transPG.possessionSpeed, 120);
assertClose('TRANSITION + PG: shooting = 80×0.9 = 72',          transPG.shooting,         72);
assertClose('TRANSITION + PG: shooting3pt unchanged = 70',       transPG.shooting3pt,      70);
assertClose('TRANSITION + PG: paintChance unchanged = 0.3',      transPG.paintChance,       0.3);
assertClose('TRANSITION + PG: fantasyPointMod = 1.1',            transPG.fantasyPointMod,   1.1);
assertClose('TRANSITION + PG: chemistryModOffset = 0',           transPG.chemistryModOffset, 0);

const transC = applyPlayStyleModifiers(TRANSITION_BASE, 'TRANSITION', { position: 'C' });
assertClose('TRANSITION + C: fantasyPointMod = 1+(−0.05) = 0.95', transC.fantasyPointMod, 0.95);

const transSF = applyPlayStyleModifiers(TRANSITION_BASE, 'TRANSITION', { position: 'SF' });
assertClose('TRANSITION + SF: fantasyPointMod = 1 (neutral)', transSF.fantasyPointMod, 1);

// String key resolves correctly
const transStr = applyPlayStyleModifiers(TRANSITION_BASE, 'TRANSITION', { position: 'SG' });
assertClose('TRANSITION via string key: shooting = 72', transStr.shooting, 72);

// ---------------------------------------------------------------------------
// Group 4 — applyPlayStyleModifiers: HALF_COURT style
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 4: applyPlayStyleModifiers — HALF_COURT style');
console.log('='.repeat(60));

/*
 * HALF_COURT: possessionSpeedMod=−0.1, shootingMod=+0.15, paintScoring=+0.1, chemistryMod=+0.05
 *   possessionSpeed=100   → applyMod(100, −0.1) = 90
 *   shooting=80           → applyMod(80, +0.15) = 92
 *   paintChance=0.3       → applyMod(0.3, +0.1) = 0.33
 *
 * C (isBig=true): fantasyPointMod = 1 + 0.05 = 1.05
 * PG (isGuard): fantasyPointMod = 1 + 0 = 1 (pgSgFantasyMod=0)
 */

const HALF_COURT_BASE = {
  possessionSpeed: 100,
  shooting:         80,
  paintChance:       0.3,
  shooting3pt:       60
};

const halfCourtC = applyPlayStyleModifiers(HALF_COURT_BASE, 'HALF_COURT', { position: 'C' });
assertClose('HALF_COURT + C: possessionSpeed = 100×0.9 = 90',  halfCourtC.possessionSpeed, 90);
assertClose('HALF_COURT + C: shooting = 80×1.15 = 92',         halfCourtC.shooting,         92);
assertClose('HALF_COURT + C: paintChance = 0.3×1.1 = 0.33',    halfCourtC.paintChance,       0.33);
assertClose('HALF_COURT + C: fantasyPointMod = 1.05',           halfCourtC.fantasyPointMod,   1.05);
assertClose('HALF_COURT + C: chemistryModOffset = 0.05',        halfCourtC.chemistryModOffset, 0.05);

const halfCourtPF = applyPlayStyleModifiers(HALF_COURT_BASE, 'HALF_COURT', { position: 'PF' });
assertClose('HALF_COURT + PF: fantasyPointMod = 1.05 (isBig=true)', halfCourtPF.fantasyPointMod, 1.05);

const halfCourtPG = applyPlayStyleModifiers(HALF_COURT_BASE, 'HALF_COURT', { position: 'PG' });
assertClose('HALF_COURT + PG: fantasyPointMod = 1 (pgSgFantasyMod=0)', halfCourtPG.fantasyPointMod, 1);

// ---------------------------------------------------------------------------
// Group 5 — applyPlayStyleModifiers: ISOLATION style
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 5: applyPlayStyleModifiers — ISOLATION style');
console.log('='.repeat(60));

/*
 * ISOLATION: shootingMod=0, starUsageMod=+0.3, chemistryMod=−0.1
 *
 * Non-star player:
 *   shooting=80 → applyMod(80, 0) = 80 (no change from shootingMod)
 *   NO isolationUsageBoost added
 *
 * Star player (isStar=true):
 *   After base shootingMod (0): shooting still 80
 *   Then ISOLATION+isStar block: shooting = applyMod(80, 0.3) = 80×1.3 = 104
 *   isolationUsageBoost = 0.3
 *
 * SF position → fantasyPointMod = 1 (neutral)
 * SG position → fantasyPointMod = 1 + 0 = 1 (pgSgFantasyMod=0 for ISOLATION)
 */

const ISO_BASE = {
  possessionSpeed: 100,
  shooting:         80,
  paintChance:       0.4
};

// Non-star player — shootingMod=0 so pure pass-through
const isoNonStar = applyPlayStyleModifiers(ISO_BASE, 'ISOLATION', { position: 'SF', isStar: false });
assertClose('ISOLATION + non-star: shooting unmoved = 80',         isoNonStar.shooting, 80);
assert('ISOLATION + non-star: no isolationUsageBoost key set',
       isoNonStar.isolationUsageBoost === undefined, true);
assertClose('ISOLATION + non-star SF: fantasyPointMod = 1',        isoNonStar.fantasyPointMod, 1);
assertClose('ISOLATION + non-star: chemistryModOffset = −0.1',    isoNonStar.chemistryModOffset, -0.1);

// Star player — gets the starUsageMod on top
const isoStar = applyPlayStyleModifiers(ISO_BASE, 'ISOLATION', { position: 'SF', isStar: true });
assertClose('ISOLATION + star SF: shooting = 80×1.3 = 104',       isoStar.shooting,            104);
assertClose('ISOLATION + star: isolationUsageBoost = 0.3',         isoStar.isolationUsageBoost,  0.3);
assertClose('ISOLATION + star: chemistryModOffset = −0.1',         isoStar.chemistryModOffset,  -0.1);

// Passing the PlayStyleConfig object directly instead of string key
const isoStarObj = applyPlayStyleModifiers(ISO_BASE, PLAY_STYLES.ISOLATION, { position: 'PG', isStar: true });
assertClose('ISOLATION via object: shooting = 80×1.3 = 104',       isoStarObj.shooting, 104);
assertClose('ISOLATION via object + PG: fantasyPointMod = 1 (pgSgFantasyMod=0)', isoStarObj.fantasyPointMod, 1);

// ---------------------------------------------------------------------------
// Group 6 — applyPlayStyleModifiers: SPREAD_3PT style
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 6: applyPlayStyleModifiers — SPREAD_3PT style');
console.log('='.repeat(60));

/*
 * SPREAD_3PT: shootingMod=+0.05, threePointVolume=+0.4, paintScoring=−0.3
 *   shooting=75       → applyMod(75, +0.05) = 75×1.05 = 78.75
 *   shooting3pt=70    → applyMod(70, +0.4)  = 70×1.4  = 98
 *   threePointChance=0.25 → Math.max(0, Math.min(1, 0.25+0.4)) = 0.65
 *   paintChance=0.4   → applyMod(0.4, −0.3) = 0.4×0.7 = 0.28
 *
 * SG (isGuard=true):  fantasyPointMod = 1 + 0.15 = 1.15
 * C  (isBig=true):    fantasyPointMod = 1 + (−0.2) = 0.80
 */

const SPREAD_BASE = {
  shooting:         75,
  shooting3pt:      70,
  threePointChance: 0.25,
  paintChance:       0.4
};

const spreadSG = applyPlayStyleModifiers(SPREAD_BASE, 'SPREAD_3PT', { position: 'SG' });
assertClose('SPREAD_3PT + SG: shooting = 75×1.05 = 78.75',           spreadSG.shooting,         78.75);
assertClose('SPREAD_3PT + SG: shooting3pt = 70×1.4 = 98',            spreadSG.shooting3pt,       98);
assertClose('SPREAD_3PT + SG: threePointChance = 0.25+0.4 = 0.65',   spreadSG.threePointChance,  0.65);
assertClose('SPREAD_3PT + SG: paintChance = 0.4×0.7 = 0.28',         spreadSG.paintChance,        0.28);
assertClose('SPREAD_3PT + SG: fantasyPointMod = 1.15',                spreadSG.fantasyPointMod,    1.15);
assertClose('SPREAD_3PT + SG: chemistryModOffset = 0',                spreadSG.chemistryModOffset,  0);

const spreadC = applyPlayStyleModifiers(SPREAD_BASE, 'SPREAD_3PT', { position: 'C' });
assertClose('SPREAD_3PT + C: fantasyPointMod = 1+(−0.2) = 0.80',     spreadC.fantasyPointMod, 0.80);

// threePointChance clamped to [0,1]: base=0.7+0.4 → would be 1.1, clamped to 1.0
const highChanceBase = { ...SPREAD_BASE, threePointChance: 0.7 };
const spreadHigh = applyPlayStyleModifiers(highChanceBase, 'SPREAD_3PT', { position: 'SF' });
assertClose('SPREAD_3PT: threePointChance clamped to 1.0',            spreadHigh.threePointChance, 1.0);

// threePointChance cannot go negative (clamp to 0)
const lowChanceBase = { ...SPREAD_BASE, threePointChance: 0 };
const postUpLow = applyPlayStyleModifiers(lowChanceBase, 'POST_UP', { position: 'C' });
// POST_UP threePointVolume=-0.2 → Math.max(0, Math.min(1, 0 + (−0.2))) = 0
assertClose('POST_UP: threePointChance = Math.max(0, 0−0.2) = 0',    postUpLow.threePointChance, 0);

// ---------------------------------------------------------------------------
// Group 7 — applyPlayStyleModifiers: POST_UP style
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 7: applyPlayStyleModifiers — POST_UP style');
console.log('='.repeat(60));

/*
 * POST_UP: possessionSpeedMod=−0.05, shootingMod=+0.05, threePointVolume=−0.2, paintScoring=+0.3
 *   possessionSpeed=100 → applyMod(100, −0.05) = 95
 *   shooting=70         → applyMod(70, +0.05)  = 73.5
 *   shooting3pt=50      → applyMod(50, −0.2)   = 40
 *   paintChance=0.3     → applyMod(0.3, +0.3)  = 0.39
 *
 * C (isBig=true):  fantasyPointMod = 1 + 0.2 = 1.2
 * PG (isGuard):    fantasyPointMod = 1 + (−0.2) = 0.8
 * SF (neutral):    fantasyPointMod = 1
 */

const POST_UP_BASE = {
  possessionSpeed: 100,
  shooting:         70,
  shooting3pt:      50,
  paintChance:       0.3
};

const postUpC = applyPlayStyleModifiers(POST_UP_BASE, 'POST_UP', { position: 'C' });
assertClose('POST_UP + C: possessionSpeed = 100×0.95 = 95',  postUpC.possessionSpeed, 95);
assertClose('POST_UP + C: shooting = 70×1.05 = 73.5',        postUpC.shooting,         73.5);
assertClose('POST_UP + C: shooting3pt = 50×0.8 = 40',        postUpC.shooting3pt,      40);
assertClose('POST_UP + C: paintChance = 0.3×1.3 = 0.39',     postUpC.paintChance,       0.39);
assertClose('POST_UP + C: fantasyPointMod = 1.2',             postUpC.fantasyPointMod,   1.2);
assertClose('POST_UP + C: chemistryModOffset = 0',            postUpC.chemistryModOffset, 0);

const postUpPG = applyPlayStyleModifiers(POST_UP_BASE, 'POST_UP', { position: 'PG' });
assertClose('POST_UP + PG: fantasyPointMod = 1+(−0.2) = 0.8', postUpPG.fantasyPointMod, 0.8);

const postUpSF = applyPlayStyleModifiers(POST_UP_BASE, 'POST_UP', { position: 'SF' });
assertClose('POST_UP + SF: fantasyPointMod = 1 (neutral)',     postUpSF.fantasyPointMod, 1);

// ---------------------------------------------------------------------------
// Group 8 — applyPlayStyleModifiers: error cases and object identity
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 8: applyPlayStyleModifiers — error cases');
console.log('='.repeat(60));

// null baseStats
assertThrows('null baseStats throws TypeError', () => {
  applyPlayStyleModifiers(null, 'TRANSITION');
});

// string baseStats
assertThrows('string baseStats throws TypeError', () => {
  applyPlayStyleModifiers('bad', 'TRANSITION');
});

// invalid play style string
assertThrows('unknown play style string throws Error', () => {
  applyPlayStyleModifiers({ shooting: 80 }, 'UNKNOWN_STYLE');
});

// original object is NOT mutated
const origBase = { shooting: 80, possessionSpeed: 100 };
const origCopy = { ...origBase };
applyPlayStyleModifiers(origBase, 'TRANSITION', { position: 'PG' });
assert('baseStats not mutated after TRANSITION', origBase.shooting, origCopy.shooting);
assert('baseStats possessionSpeed not mutated',  origBase.possessionSpeed, origCopy.possessionSpeed);

// Properties not present in baseStats are not added (e.g. missing possessionSpeed)
const noSpeedBase = { shooting: 80 };
const noSpeedResult = applyPlayStyleModifiers(noSpeedBase, 'TRANSITION', { position: 'PG' });
assert('missing possessionSpeed not invented in output',
       noSpeedResult.possessionSpeed === undefined, true);

// ---------------------------------------------------------------------------
// Group 9 — applyDefensiveSchemeModifiers: MAN_TO_MAN
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 9: applyDefensiveSchemeModifiers — MAN_TO_MAN');
console.log('='.repeat(60));

/*
 * MAN_TO_MAN: stealRateMod=+0.15, threePointAllowedMod=+0.05, reboundMod=−0.05
 *
 *   stealRate=0.1                → applyMod(0.1, +0.15)  = 0.1×1.15 = 0.115
 *   stealing=70                  → applyMod(70, +0.15)   = 70×1.15  = 80.5
 *   opponentThreePointRate=0.35  → applyMod(0.35, +0.05) = 0.35×1.05 = 0.3675
 *   perimeterDefense=80          → perimeterAdjust = −(+0.05) = −0.05
 *                                   applyMod(80, −0.05) = 80×0.95 = 76
 *   rebounding=0.7               → applyMod(0.7, −0.05) = 0.7×0.95 = 0.665
 *   staminaCostPerPossession=0.05 (staminaCostMod=0) → no change = 0.05
 *   forceFTRate = 0
 *   defenseRiskLevel = 'medium'
 */

const MTM_BASE = {
  stealRate:                0.1,
  stealing:                70,
  opponentThreePointRate:   0.35,
  perimeterDefense:        80,
  rebounding:               0.7,
  staminaCostPerPossession: 0.05,
  opponentTurnoverRate:     0.1
};

const mtmResult = applyDefensiveSchemeModifiers(MTM_BASE, 'MAN_TO_MAN');

assertClose('MAN_TO_MAN: stealRate = 0.1×1.15 = 0.115',             mtmResult.stealRate,                0.115);
assertClose('MAN_TO_MAN: stealing = 70×1.15 = 80.5',                 mtmResult.stealing,                80.5);
assertClose('MAN_TO_MAN: opponentThreePointRate = 0.35×1.05 = 0.3675', mtmResult.opponentThreePointRate, 0.3675);
assertClose('MAN_TO_MAN: perimeterDefense = 80×0.95 = 76',           mtmResult.perimeterDefense,        76);
assertClose('MAN_TO_MAN: rebounding = 0.7×0.95 = 0.665',             mtmResult.rebounding,              0.665);
assertClose('MAN_TO_MAN: staminaCostPerPossession unchanged = 0.05', mtmResult.staminaCostPerPossession, 0.05);
assertClose('MAN_TO_MAN: opponentTurnoverRate unchanged = 0.1',       mtmResult.opponentTurnoverRate,    0.1);
assertClose('MAN_TO_MAN: forceFTRate = 0',                            mtmResult.forceFTRate,              0);
assert('MAN_TO_MAN: defenseRiskLevel === "medium"',                   mtmResult.defenseRiskLevel,       'medium');

// ---------------------------------------------------------------------------
// Group 10 — applyDefensiveSchemeModifiers: ZONE
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 10: applyDefensiveSchemeModifiers — ZONE');
console.log('='.repeat(60));

/*
 * ZONE: stealRateMod=−0.1, threePointAllowedMod=−0.1, reboundMod=+0.15, staminaCostMod=−0.05
 *
 *   stealRate=0.1               → applyMod(0.1, −0.1)  = 0.09
 *   opponentThreePointRate=0.35 → applyMod(0.35, −0.1) = 0.315
 *   perimeterDefense=80         → perimeterAdjust = −(−0.1) = +0.1
 *                                  applyMod(80, +0.1) = 88
 *   rebounding=0.7              → applyMod(0.7, +0.15) = 0.7×1.15 = 0.805
 *   staminaCostPerPossession=0.05 → applyMod(0.05, −0.05) = 0.05×0.95 = 0.0475
 *   forceFTRate = 0
 *   defenseRiskLevel = 'low'
 */

const ZONE_BASE = { ...MTM_BASE };

const zoneResult = applyDefensiveSchemeModifiers(ZONE_BASE, 'ZONE');

assertClose('ZONE: stealRate = 0.1×0.9 = 0.09',                      zoneResult.stealRate,               0.09);
assertClose('ZONE: opponentThreePointRate = 0.35×0.9 = 0.315',       zoneResult.opponentThreePointRate,    0.315);
assertClose('ZONE: perimeterDefense = 80×1.1 = 88',                   zoneResult.perimeterDefense,         88);
assertClose('ZONE: rebounding = 0.7×1.15 = 0.805',                    zoneResult.rebounding,               0.805);
assertClose('ZONE: staminaCostPerPossession = 0.05×0.95 = 0.0475',   zoneResult.staminaCostPerPossession,  0.0475);
assertClose('ZONE: forceFTRate = 0',                                   zoneResult.forceFTRate,               0);
assert('ZONE: defenseRiskLevel === "low"',                             zoneResult.defenseRiskLevel,         'low');

// ZONE counter-tactic: SPREAD_3PT opponent partially negates 3pt suppression
/*
 * After ZONE processing: perimeterDefense = 88
 * Counter-tactic activated: result.perimeterDefense = applyMod(88, −0.07) = 88×0.93 = 81.84
 * opponentThreePointRate = 0.315 → applyMod(0.315, +0.07) = 0.315×1.07 = 0.33705
 */
const zoneVsSpread = applyDefensiveSchemeModifiers(ZONE_BASE, 'ZONE', 'SPREAD_3PT');
assertClose('ZONE vs SPREAD_3PT counter: perimeterDefense = 88×0.93 = 81.84',
            zoneVsSpread.perimeterDefense, 81.84, 0.001);
assertClose('ZONE vs SPREAD_3PT counter: opponentThreePointRate = 0.315×1.07 = 0.33705',
            zoneVsSpread.opponentThreePointRate, 0.33705, 0.001);

// ZONE vs non-SPREAD_3PT opponent — no counter-tactic
const zoneVsMTM = applyDefensiveSchemeModifiers(ZONE_BASE, 'ZONE', 'HALF_COURT');
assertClose('ZONE vs HALF_COURT: perimeterDefense NOT counter-adjusted (stays 88)',
            zoneVsMTM.perimeterDefense, 88);

// ---------------------------------------------------------------------------
// Group 11 — applyDefensiveSchemeModifiers: PRESS
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 11: applyDefensiveSchemeModifiers — PRESS');
console.log('='.repeat(60));

/*
 * PRESS: stealRateMod=+0.2, turnoverRateMod=+0.2, staminaCostMod=+0.3
 *   stealRate=0.1               → applyMod(0.1, +0.2)  = 0.12
 *   opponentTurnoverRate=0.15   → applyMod(0.15, +0.2) = 0.18
 *   staminaCostPerPossession=0.05 → applyMod(0.05, +0.3) = 0.065
 *   forceFTRate = 0
 *   defenseRiskLevel = 'high'
 */

const PRESS_BASE = {
  stealRate:                0.1,
  stealing:                60,
  opponentTurnoverRate:     0.15,
  staminaCostPerPossession: 0.05,
  opponentThreePointRate:   0.35,
  perimeterDefense:        75,
  rebounding:               0.6
};

const pressResult = applyDefensiveSchemeModifiers(PRESS_BASE, 'PRESS');

assertClose('PRESS: stealRate = 0.1×1.2 = 0.12',                       pressResult.stealRate,               0.12);
assertClose('PRESS: opponentTurnoverRate = 0.15×1.2 = 0.18',           pressResult.opponentTurnoverRate,    0.18);
assertClose('PRESS: staminaCostPerPossession = 0.05×1.3 = 0.065',      pressResult.staminaCostPerPossession, 0.065);
assertClose('PRESS: forceFTRate = 0',                                    pressResult.forceFTRate,              0);
assert('PRESS: defenseRiskLevel === "high"',                             pressResult.defenseRiskLevel,        'high');
// PRESS: threePointAllowedMod=0 → no change to opponentThreePointRate
assertClose('PRESS: opponentThreePointRate unchanged = 0.35',           pressResult.opponentThreePointRate,   0.35);
// PRESS: reboundMod=0 → no change
assertClose('PRESS: rebounding unchanged = 0.6',                        pressResult.rebounding,               0.6);

// ---------------------------------------------------------------------------
// Group 12 — applyDefensiveSchemeModifiers: HACK_A_CENTER
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 12: applyDefensiveSchemeModifiers — HACK_A_CENTER');
console.log('='.repeat(60));

/*
 * HACK_A_CENTER: all mods are 0 — only forceFTRate=0.8 and riskLevel='high'
 */

const HACK_BASE = {
  stealRate:                0.1,
  stealing:                60,
  opponentThreePointRate:   0.35,
  perimeterDefense:        75,
  rebounding:               0.65,
  staminaCostPerPossession: 0.04,
  opponentTurnoverRate:     0.12
};

const hackResult = applyDefensiveSchemeModifiers(HACK_BASE, 'HACK_A_CENTER');

assertClose('HACK_A_CENTER: stealRate unchanged (mod=0)',          hackResult.stealRate,                0.1);
assertClose('HACK_A_CENTER: opponentThreePointRate unchanged',     hackResult.opponentThreePointRate,   0.35);
assertClose('HACK_A_CENTER: perimeterDefense unchanged',           hackResult.perimeterDefense,        75);
assertClose('HACK_A_CENTER: rebounding unchanged',                  hackResult.rebounding,              0.65);
assertClose('HACK_A_CENTER: staminaCost unchanged',                hackResult.staminaCostPerPossession, 0.04);
assertClose('HACK_A_CENTER: forceFTRate = 0.8',                    hackResult.forceFTRate,              0.8);
assert('HACK_A_CENTER: defenseRiskLevel === "high"',               hackResult.defenseRiskLevel,        'high');

// ---------------------------------------------------------------------------
// Group 13 — applyDefensiveSchemeModifiers: error cases
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 13: applyDefensiveSchemeModifiers — error cases');
console.log('='.repeat(60));

assertThrows('null baseStats throws TypeError', () => {
  applyDefensiveSchemeModifiers(null, 'MAN_TO_MAN');
});
assertThrows('unknown scheme string throws Error', () => {
  applyDefensiveSchemeModifiers({ stealRate: 0.1 }, 'UNKNOWN_SCHEME');
});

// Original baseStats not mutated
const origDefBase = { stealRate: 0.1, rebounding: 0.7 };
const origDefCopy = { ...origDefBase };
applyDefensiveSchemeModifiers(origDefBase, 'PRESS');
assert('defense baseStats not mutated', origDefBase.stealRate, origDefCopy.stealRate);

// ---------------------------------------------------------------------------
// Group 14 — calculateChemistryBonus
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 14: calculateChemistryBonus');
console.log('='.repeat(60));

/*
 * Formula (from source):
 *   chemistryAvg = round4(avg of up to 5 starters' Chemistry)
 *   teamBonus    = round4((chemistryAvg / 99) * 0.10)   → max 0.10
 *   cohesionBonus = chemistryAvg > 80 ? 0.05 : 0        ← strictly greater than 80
 *
 * Fallback for direct chemistry property on player: direct value used.
 */

// Max chemistry (5 players, chemistry=99 each)
// chemistryAvg = 99, teamBonus = round4(0.10) = 0.1, cohesionBonus = 0.05
const maxChemPlayers = Array.from({length:5}, (_, i) => ({
  name: `Player ${i+1}`, chemistry: 99
}));
const maxChem = calculateChemistryBonus(maxChemPlayers);
assertClose('max chemistry (99): chemistryAvg === 99',  maxChem.chemistryAvg,   99);
assertClose('max chemistry: teamBonus === 0.1',          maxChem.teamBonus,       0.1);
assertClose('max chemistry: cohesionBonus === 0.05',     maxChem.cohesionBonus,   0.05);
assert('max chemistry: details.length === 5',            maxChem.details.length,  5);

// Low chemistry (all 5 players with chemistry=20)
// chemistryAvg = 20, teamBonus = round4((20/99)*0.1) = round4(0.020202...) = 0.0202, cohesionBonus = 0
const lowChemPlayers = Array.from({length:5}, (_, i) => ({
  name: `Player ${i+1}`, chemistry: 20
}));
const lowChem = calculateChemistryBonus(lowChemPlayers);
assertClose('low chemistry (20): chemistryAvg === 20',  lowChem.chemistryAvg,  20);
assertClose('low chemistry: teamBonus ≈ 0.0202',         lowChem.teamBonus,     0.0202);
assertClose('low chemistry: cohesionBonus === 0',        lowChem.cohesionBonus, 0);

// Chemistry = 81 (strictly > 80, cohesion bonus triggered)
// chemistryAvg = 81, teamBonus = round4((81/99)*0.1), cohesionBonus = 0.05
const highChemPlayers = Array.from({length:5}, (_, i) => ({
  name: `Player ${i+1}`, chemistry: 81
}));
const highChem = calculateChemistryBonus(highChemPlayers);
assertClose('chemistry 81 (>80): cohesionBonus === 0.05', highChem.cohesionBonus, 0.05);
// teamBonus = round4((81/99)*0.1) = round4(0.081818...) = 0.0818
assertClose('chemistry 81: teamBonus ≈ 0.0818',           highChem.teamBonus, 0.0818);

// Chemistry = 80 (NOT > 80 — no cohesion bonus)
const exactChem80Players = Array.from({length:5}, (_, i) => ({
  name: `Player ${i+1}`, chemistry: 80
}));
const exactChem80 = calculateChemistryBonus(exactChem80Players);
assertClose('chemistry exactly 80: cohesionBonus === 0 (strictly > 80 required)',
            exactChem80.cohesionBonus, 0);

// Mixed chemistry — verify average
// Players: 60, 70, 80, 90, 99 → avg = 399/5 = 79.8
const mixedChemPlayers = [
  { name:'P1', chemistry:60 }, { name:'P2', chemistry:70 },
  { name:'P3', chemistry:80 }, { name:'P4', chemistry:90 },
  { name:'P5', chemistry:99 }
];
const mixedChem = calculateChemistryBonus(mixedChemPlayers);
assertClose('mixed chemistry: avg = (60+70+80+90+99)/5 = 79.8',  mixedChem.chemistryAvg,  79.8);
assertClose('mixed chemistry 79.8: cohesionBonus === 0 (not > 80)', mixedChem.cohesionBonus, 0);
// teamBonus = round4((79.8/99)*0.1) = round4(0.080606...) = 0.0806
assertClose('mixed chemistry: teamBonus ≈ 0.0806', mixedChem.teamBonus, 0.0806);

// Team with skillLevel fallback (no direct chemistry attribute)
// skillLevel=5: chemistry fallback = 5×15+10 = 85 → chemistryAvg=85, cohesionBonus=0.05
const skillLevelPlayers = Array.from({length:5}, (_, i) => ({
  name: `Skill Player ${i+1}`, skillLevel: 5
}));
const skillChem = calculateChemistryBonus(skillLevelPlayers);
assertClose('skillLevel=5 fallback: chemistryAvg = 5×15+10 = 85', skillChem.chemistryAvg, 85);
assertClose('skillLevel=5 fallback: cohesionBonus = 0.05', skillChem.cohesionBonus, 0.05);

// Empty array returns zero bonus struct
const emptyChem = calculateChemistryBonus([]);
assertClose('empty team: teamBonus === 0',     emptyChem.teamBonus,    0);
assertClose('empty team: cohesionBonus === 0', emptyChem.cohesionBonus, 0);
assertClose('empty team: chemistryAvg === 0',  emptyChem.chemistryAvg,  0);

// { starters: [...] } shape
const startersChem = calculateChemistryBonus({ starters: maxChemPlayers });
assertClose('{ starters: [...] } shape: teamBonus === 0.1', startersChem.teamBonus, 0.1);

// { players: [...] } shape (only non-active filtered out)
const playersChem = calculateChemistryBonus({ players: maxChemPlayers });
assertClose('{ players: [...] } shape: teamBonus === 0.1', playersChem.teamBonus, 0.1);

// throws on truly invalid input
assertThrows('non-object/non-array team throws TypeError', () => {
  calculateChemistryBonus('not a team');
});

// ---------------------------------------------------------------------------
// Group 15 — createGamePlan
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 15: createGamePlan');
console.log('='.repeat(60));

/*
 * createGamePlan returns an Object.frozen GamePlan with:
 *   { playStyle, defenseScheme, rotations, combinedMods }
 *
 * combinedMods.offensive mirrors the play style modifiers.
 * combinedMods.defensive mirrors the defensive scheme modifiers.
 */

// Basic creation (string keys, no rotations)
const gp1 = createGamePlan('TRANSITION', 'MAN_TO_MAN');

assert('createGamePlan returns frozen object', Object.isFrozen(gp1), true);
assert('gp1.playStyle.id === "TRANSITION"',      gp1.playStyle.id,      'TRANSITION');
assert('gp1.defenseScheme.id === "MAN_TO_MAN"',  gp1.defenseScheme.id,  'MAN_TO_MAN');
assert('gp1.rotations is an empty array',        Array.isArray(gp1.rotations) && gp1.rotations.length === 0, true);
assert('gp1.combinedMods.offensive exists',       typeof gp1.combinedMods.offensive === 'object', true);
assert('gp1.combinedMods.defensive exists',       typeof gp1.combinedMods.defensive === 'object', true);

// combinedMods.offensive values should mirror TRANSITION style
assertClose('combinedMods.offensive.possessionSpeed === TRANSITION.possessionSpeedMod (+0.2)',
            gp1.combinedMods.offensive.possessionSpeed, 0.2);
assertClose('combinedMods.offensive.shooting === TRANSITION.shootingMod (−0.1)',
            gp1.combinedMods.offensive.shooting, -0.1);
assertClose('combinedMods.offensive.threePointVolume === TRANSITION.threePointVolume (0)',
            gp1.combinedMods.offensive.threePointVolume, 0);
assertClose('combinedMods.offensive.starUsage === TRANSITION.starUsageMod (0)',
            gp1.combinedMods.offensive.starUsage, 0);
assertClose('combinedMods.offensive.chemistry === TRANSITION.chemistryMod (0)',
            gp1.combinedMods.offensive.chemistry, 0);

// combinedMods.defensive values mirror MAN_TO_MAN scheme
assertClose('combinedMods.defensive.stealRate === MAN_TO_MAN.stealRateMod (+0.15)',
            gp1.combinedMods.defensive.stealRate, 0.15);
assertClose('combinedMods.defensive.rebounding === MAN_TO_MAN.reboundMod (−0.05)',
            gp1.combinedMods.defensive.rebounding, -0.05);
assertClose('combinedMods.defensive.forceFTRate === 0', gp1.combinedMods.defensive.forceFTRate, 0);
assert('combinedMods.defensive.riskLevel === "medium"', gp1.combinedMods.defensive.riskLevel, 'medium');

// With play style and defense scheme objects
const gp2 = createGamePlan(PLAY_STYLES.SPREAD_3PT, DEFENSIVE_SCHEMES.PRESS);
assert('gp2.playStyle.id === "SPREAD_3PT"',     gp2.playStyle.id,     'SPREAD_3PT');
assert('gp2.defenseScheme.id === "PRESS"',       gp2.defenseScheme.id, 'PRESS');
assertClose('gp2 offensive.threePointVolume === SPREAD_3PT.threePointVolume (+0.4)',
            gp2.combinedMods.offensive.threePointVolume, 0.4);
assertClose('gp2 defensive.stealRate === PRESS.stealRateMod (+0.2)',
            gp2.combinedMods.defensive.stealRate, 0.2);
assert('gp2 defensive.riskLevel === "high"',    gp2.combinedMods.defensive.riskLevel, 'high');

// With rotation templates
const rotations = [
  { playerId: 'p1', targetMinutes: 32, foulTroubleBenchFouls: 4, fatigueThreshold: 0.3 },
  { playerId: 'p2', targetMinutes: 28, foulTroubleBenchFouls: 3, fatigueThreshold: 0.25 }
];
const gp3 = createGamePlan('HALF_COURT', 'ZONE', rotations);
assert('gp3.rotations.length === 2',           gp3.rotations.length,               2);
assert('gp3.rotations[0].playerId === "p1"',   gp3.rotations[0].playerId,         'p1');
assert('gp3.rotations[0].targetMinutes === 32', gp3.rotations[0].targetMinutes,   32);
assert('gp3.rotations[0].foulTroubleBenchFouls === 4', gp3.rotations[0].foulTroubleBenchFouls, 4);
assertClose('gp3.rotations[0].fatigueThreshold === 0.3', gp3.rotations[0].fatigueThreshold, 0.3);

// Rotation validation: targetMinutes > 48 throws
assertThrows('targetMinutes=50 (>48) throws RangeError', () => {
  createGamePlan('TRANSITION', 'ZONE', [{ playerId:'x', targetMinutes: 50 }]);
});

// Rotation validation: foulTroubleBenchFouls = 0 throws
assertThrows('foulTroubleBenchFouls=0 (<1) throws RangeError', () => {
  createGamePlan('TRANSITION', 'ZONE', [{ playerId:'x', targetMinutes: 32, foulTroubleBenchFouls: 0 }]);
});

// Rotation validation: fatigueThreshold = 1.5 throws
assertThrows('fatigueThreshold=1.5 (>1) throws RangeError', () => {
  createGamePlan('TRANSITION', 'ZONE', [{ playerId:'x', targetMinutes: 32, fatigueThreshold: 1.5 }]);
});

// Unknown play style throws
assertThrows('unknown play style in createGamePlan throws Error', () => {
  createGamePlan('UNKNOWN', 'ZONE');
});

// Unknown defense scheme throws
assertThrows('unknown defense scheme in createGamePlan throws Error', () => {
  createGamePlan('TRANSITION', 'UNKNOWN');
});

// ---------------------------------------------------------------------------
// Group 16 — findStarPlayer
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 16: findStarPlayer');
console.log('='.repeat(60));

// Empty array → null
assert('empty array → null', findStarPlayer([]), null);
assert('null input → null',  findStarPlayer(null), null);

// Single player → that player
const singlePlayer = { name: 'Solo', attack: 80 };
assert('single player returned', findStarPlayer([singlePlayer]), singlePlayer);

// Explicit isStar flag takes priority over higher attack value
const playerA = { name: 'Player A', attack: 99, isStar: false };
const playerB = { name: 'Player B', attack: 60, isStar: true };
const playerC = { name: 'Player C', attack: 85 };
const explicitStar = findStarPlayer([playerA, playerB, playerC]);
assert('explicit isStar=true wins over higher attack', explicitStar, playerB);

// Without explicit flag → highest attack wins
const noFlagA = { name: 'Mid', attack: 70 };
const noFlagB = { name: 'Elite', attack: 99 };
const noFlagC = { name: 'Good', attack: 85 };
const attackStar = findStarPlayer([noFlagA, noFlagB, noFlagC]);
assert('no flag: highest attack (99) wins', attackStar, noFlagB);

// Verify by name for clarity
assert('attack winner name is "Elite"', attackStar.name, 'Elite');

// skillLevel fallback: no attack attribute → skillLevel*18+10
// Player X: skillLevel=5 → 5*18+10=100 → clamped to 99
// Player Y: skillLevel=3 → 3*18+10=64
const skillA = { name: 'Elite Skill', skillLevel: 5 };
const skillB = { name: 'Mid Skill',   skillLevel: 3 };
const skillStar = findStarPlayer([skillB, skillA]); // reversed order to test reduction
assert('skillLevel fallback: skillLevel=5 player wins', skillStar, skillA);
assert('skillLevel fallback: winner name is "Elite Skill"', skillStar.name, 'Elite Skill');

// Attack via PascalCase attribute key
const pascalA = { name: 'Pascal High', Attack: 95 };
const pascalB = { name: 'Pascal Low',  Attack: 40 };
const pascalStar = findStarPlayer([pascalB, pascalA]);
assert('PascalCase Attack attribute recognized', pascalStar, pascalA);

// Attack via attributes sub-object
const attrA = { name: 'Attr High', attributes: { attack: 90 } };
const attrB = { name: 'Attr Low',  attributes: { attack: 55 } };
const attrStar = findStarPlayer([attrB, attrA]);
assert('attack in attributes sub-object recognized', attrStar, attrA);

// ---------------------------------------------------------------------------
// Group 17 — Effective stats: combined play style + defense scheme modifiers
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 17: Combined play style + defensive modifiers (effective stats)');
console.log('='.repeat(60));

/*
 * Simulate applying BOTH an offensive play style AND defensive scheme
 * to the same base stats to verify modifiers compose correctly.
 *
 * Step 1: applyPlayStyleModifiers(base, 'POST_UP', { position:'C' })
 *   shooting = 70×1.05 = 73.5
 *
 * Step 2: applyDefensiveSchemeModifiers(result, 'ZONE')
 *   rebounding (not in base, added in step 1 if present)
 *
 * Use a stats object that has both offensive and defensive fields.
 */

const COMBINED_BASE = {
  shooting:                 70,
  possessionSpeed:         100,
  paintChance:               0.3,
  stealRate:                 0.1,
  rebounding:                0.65,
  staminaCostPerPossession:  0.05,
  perimeterDefense:         75,
  opponentThreePointRate:    0.35
};

// Step 1: apply offensive style
const afterOffense = applyPlayStyleModifiers(COMBINED_BASE, 'POST_UP', { position: 'C' });
// POST_UP: possessionSpeedMod=−0.05, shootingMod=+0.05
//   possessionSpeed: 100×0.95 = 95
//   shooting: 70×1.05 = 73.5
//   paintChance: 0.3×1.3 = 0.39
//   stealRate: NOT touched by play style → stays 0.1
assertClose('combined step 1: possessionSpeed = 95', afterOffense.possessionSpeed, 95);
assertClose('combined step 1: shooting = 73.5',       afterOffense.shooting,        73.5);
assertClose('combined step 1: stealRate untouched = 0.1', afterOffense.stealRate,   0.1);

// Step 2: apply defensive scheme on the already-modified stats
const afterDefense = applyDefensiveSchemeModifiers(afterOffense, 'ZONE');
// ZONE: stealRateMod=−0.1 → stealRate was 0.1 → 0.1×0.9 = 0.09
// reboundMod=+0.15 → rebounding was 0.65 → 0.65×1.15 = 0.7475
// perimeterDefense: 75 → perimeterAdjust=+0.1 → 75×1.1 = 82.5
// staminaCostPerPossession: 0.05×0.95 = 0.0475
assertClose('combined step 2: stealRate = 0.1×0.9 = 0.09',         afterDefense.stealRate,                0.09);
assertClose('combined step 2: rebounding = 0.65×1.15 = 0.7475',    afterDefense.rebounding,               0.7475);
assertClose('combined step 2: perimeterDefense = 75×1.1 = 82.5',   afterDefense.perimeterDefense,         82.5);
assertClose('combined step 2: staminaCost = 0.05×0.95 = 0.0475',   afterDefense.staminaCostPerPossession,  0.0475);
// The offensive shooting change should still be present
assertClose('combined step 2: shooting still 73.5 from POST_UP',    afterDefense.shooting, 73.5);

// ---------------------------------------------------------------------------
// Group 18 — Edge cases and input validation
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log('📊 Test Group 18: Edge cases');
console.log('='.repeat(60));

// applyMod clamps to 0 — a large negative mod cannot yield negative value
const clampBase = { shooting: 50, paintChance: 0.3 };
// SPREAD_3PT paintScoring = −0.3 → 0.3×(1−0.3)=0.21 (positive, no clamp needed)
// But if we use an extreme base modifier via object directly
const extremeStyle = { ...PLAY_STYLES.SPREAD_3PT, paintScoring: -1.1 }; // would produce 0.3×(1-1.1)=−0.033
const extremeResult = applyPlayStyleModifiers(clampBase, extremeStyle, { position:'SF' });
// applyMod clamps to 0: Math.max(0, 0.3×(1-1.1)) = Math.max(0, -0.033) = 0
assertClose('applyMod clamps to 0 when result would be negative', extremeResult.paintChance, 0);

// Chemistry with only 3 players (not a full 5) — still works
const threePlayers = [
  { name:'P1', chemistry:90 }, { name:'P2', chemistry:80 }, { name:'P3', chemistry:70 }
];
const threeChem = calculateChemistryBonus(threePlayers);
// avg = (90+80+70)/3 = 80 — NOT strictly > 80, cohesion=0
assertClose('3-player team: chemistryAvg = 80', threeChem.chemistryAvg, 80);
assertClose('3-player team: cohesionBonus === 0 (avg=80 not >80)', threeChem.cohesionBonus, 0);

// createGamePlan with PostUp + HackACenter
const hackerPlan = createGamePlan('POST_UP', 'HACK_A_CENTER');
assertClose('HACK_A_CENTER in gamePlan: forceFTRate = 0.8',
            hackerPlan.combinedMods.defensive.forceFTRate, 0.8);
assert('HACK_A_CENTER in gamePlan: riskLevel = "high"',
       hackerPlan.combinedMods.defensive.riskLevel, 'high');

// PLAY_STYLES object is itself frozen
assert('PLAY_STYLES is frozen',    Object.isFrozen(PLAY_STYLES), true);
assert('DEFENSIVE_SCHEMES is frozen', Object.isFrozen(DEFENSIVE_SCHEMES), true);

// All 5 play styles accessible and frozen
for (const name of EXPECTED_PLAY_STYLES) {
  assert(`PLAY_STYLES.${name} accessible`, typeof PLAY_STYLES[name].id === 'string', true);
}

// All 4 defensive schemes accessible
for (const name of EXPECTED_SCHEMES) {
  assert(`DEFENSIVE_SCHEMES.${name} accessible`, typeof DEFENSIVE_SCHEMES[name].id === 'string', true);
}

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log(`Final results: ✅ ${passCount} passed, ❌ ${failCount} failed`);
console.log('='.repeat(60));

if (failCount > 0) {
  process.exit(1);
}
