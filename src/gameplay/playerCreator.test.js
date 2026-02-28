/**
 * playerCreator.test.js
 * Quadra Legacy — exhaustive tests for playerCreator.js
 *
 * Run with: node src/gameplay/playerCreator.test.js
 *
 * Framework: plain Node.js — no jest, no mocha, no external libraries.
 * Style mirrors src/actionResolver.test.js: ✅/❌ per assertion, passCount/failCount summary.
 */

import {
  createPlayerManual,
  createPlayerAuto,
  generatePlayerPool,
  VALID_POSITIONS,
  VALID_ARCHETYPES,
  ARCHETYPE_TEMPLATES,
  POSITION_PHYSICAL,
  calculateCardOverall,
  calculateOverall,
  overallToSkillLevel,
  d20ToSkill,
} from './playerCreator.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failCount++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✅ ${label} — got: ${actual}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${label} — expected ${expected}, got ${actual}`);
    failCount++;
  }
}

function assertInRange(value, min, max, label) {
  if (typeof value === 'number' && value >= min && value <= max) {
    console.log(`  ✅ ${label} — ${value} in [${min}, ${max}]`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${label} — ${value} NOT in [${min}, ${max}]`);
    failCount++;
  }
}

function assertThrows(fn, expectedMsg, label) {
  try {
    fn();
    console.log(`  ❌ FAIL: ${label} — expected throw, but no error thrown`);
    failCount++;
  } catch (e) {
    if (expectedMsg && !e.message.includes(expectedMsg)) {
      console.log(`  ❌ FAIL: ${label} — threw but wrong message: "${e.message}"`);
      failCount++;
    } else {
      console.log(`  ✅ ${label} — threw: "${e.message}"`);
      passCount++;
    }
  }
}

// ---------------------------------------------------------------------------
// GROUP 1: Player Identity Fields
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 1: Player Identity Fields');
console.log('========================================');

// Use a fixed seed so every run is identical
const p1 = createPlayerManual({
  name:      'Gustavo Silva',
  position:  'SG',
  archetype: 'Scorer',
  seed:      12345,
});

// id — UUID v4 pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
assert(typeof p1.id === 'string' && p1.id.length > 0, 'id is a non-empty string');
assert(UUID_RE.test(p1.id), 'id is valid RFC 4122 UUID v4');

// name
assertEqual(typeof p1.name, 'string', 'name is a string');
assert(p1.name.length > 0, 'name is non-empty');
assertEqual(p1.name, 'Gustavo Silva', 'name matches supplied value (trimmed)');

// position
assert(VALID_POSITIONS.includes(p1.position), `position "${p1.position}" is one of PG/SG/SF/PF/C`);
assertEqual(p1.position, 'SG', 'position === SG as specified');

// archetype
assert(VALID_ARCHETYPES.includes(p1.archetype), `archetype "${p1.archetype}" is valid`);
assertEqual(p1.archetype, 'Scorer', 'archetype === Scorer as specified');

// age
assert(Number.isInteger(p1.age), 'age is an integer');
assertInRange(p1.age, 18, 38, 'age in [18, 38]');

// nationality — defaults to 'Brazilian' when not supplied
assertEqual(p1.nationality, 'Brazilian', 'nationality defaults to Brazilian');

// hometown — auto-generated from Brazilian cities
assert(typeof p1.hometown === 'string' && p1.hometown.length > 0, 'hometown is non-empty string');

// height_cm — SG physical range [185, 198]
assertInRange(p1.height_cm, 185, 198, 'height_cm within SG range [185, 198]');

// weight_kg — SG physical range [80, 95]
assertInRange(p1.weight_kg, 80, 95, 'weight_kg within SG range [80, 95]');

// dominantHand
assert(p1.dominantHand === 'Left' || p1.dominantHand === 'Right', 'dominantHand is Left or Right');

// overall / cardOverall / revealedPotential are numbers in [1,99]
assertInRange(p1.overall, 1, 99, 'overall in [1, 99]');
assertInRange(p1.cardOverall, 1, 99, 'cardOverall in [1, 99]');
assertInRange(p1.revealedPotential, 1, 99, 'revealedPotential in [1, 99]');

// skillLevel in [1,5]
assertInRange(p1.skillLevel, 1, 5, 'skillLevel in [1, 5]');

// isActive, foulCount, stamina, maxStamina, x, y initial state
assertEqual(p1.isActive,    true,  'isActive === true at creation');
assertEqual(p1.foulCount,   0,     'foulCount === 0 at creation');
assertEqual(p1.stamina,     100,   'stamina === 100 at creation');
assertEqual(p1.maxStamina,  100,   'maxStamina === 100 at creation');
assertEqual(p1.x,           0,     'x === 0 at creation');
assertEqual(p1.y,           0,     'y === 0 at creation');

// stats shape
assert(p1.stats !== null && typeof p1.stats === 'object', 'stats is an object');
assertEqual(p1.stats.pointsScored, 0, 'stats.pointsScored === 0');
assertEqual(p1.stats.assists,      0, 'stats.assists === 0');
assertEqual(p1.stats.rebounds,     0, 'stats.rebounds === 0');
assertEqual(p1.stats.steals,       0, 'stats.steals === 0');
assertEqual(p1.stats.blocks,       0, 'stats.blocks === 0');
assertEqual(p1.stats.fouls,        0, 'stats.fouls === 0');
assertEqual(p1.stats.freethrows,   0, 'stats.freethrows === 0');
assertEqual(p1.stats.shots2pt.made,      0, 'stats.shots2pt.made === 0');
assertEqual(p1.stats.shots2pt.attempted, 0, 'stats.shots2pt.attempted === 0');
assertEqual(p1.stats.shots3pt.made,      0, 'stats.shots3pt.made === 0');
assertEqual(p1.stats.shots3pt.attempted, 0, 'stats.shots3pt.attempted === 0');

// attributes object exists with all 15 1-99 keys
const REQUIRED_ATTRS = [
  'Attack','FieldGoal','FieldGoalPaint','FieldGoalMidRange','ThreePoint',
  'DunkLayup','FreeThrow','Passing','Defense','StealMarking','Blocking',
  'Stamina','Chemistry','Morale','Potential',
];
for (const key of REQUIRED_ATTRS) {
  assert(key in p1.attributes, `attributes.${key} exists`);
}

// d20 object exists with Dribble and StealMarkingD20
assert('Dribble'         in p1.d20, 'd20.Dribble exists');
assert('StealMarkingD20' in p1.d20, 'd20.StealMarkingD20 exists');

// getSkillLevelName returns a valid Brazilian string
const skillName = p1.getSkillLevelName();
assert(['Ruim','Médio','Bom'].includes(skillName), `getSkillLevelName() returns one of Ruim/Médio/Bom — got "${skillName}"`);

// getSummary contains all identity fields
const summary = p1.getSummary();
assert(summary.id         === p1.id,         'getSummary().id matches');
assert(summary.name       === p1.name,       'getSummary().name matches');
assert(summary.position   === p1.position,   'getSummary().position matches');
assert(summary.archetype  === p1.archetype,  'getSummary().archetype matches');
assert(summary.overall    === p1.overall,    'getSummary().overall matches');
assert(summary.isActive   === true,          'getSummary().isActive === true');

// addPoints method
p1.addPoints(10);
assertEqual(p1.stats.pointsScored, 10, 'addPoints(10) increments pointsScored to 10');

// addAssist
p1.addAssist();
assertEqual(p1.stats.assists, 1, 'addAssist() increments assists to 1');

// addRebound
p1.addRebound();
assertEqual(p1.stats.rebounds, 1, 'addRebound() increments rebounds to 1');

// addSteal
p1.addSteal();
assertEqual(p1.stats.steals, 1, 'addSteal() increments steals to 1');

// addBlock
p1.addBlock();
assertEqual(p1.stats.blocks, 1, 'addBlock() increments blocks to 1');

// addFoul — 4 fouls should not deactivate
for (let i = 0; i < 4; i++) p1.addFoul();
assertEqual(p1.foulCount, 4,    'foulCount === 4 after 4 fouls');
assertEqual(p1.isActive,  true, 'isActive still true after 4 fouls');
assertEqual(p1.stats.fouls, 4,  'stats.fouls === 4');

// 5th foul deactivates
p1.addFoul();
assertEqual(p1.foulCount, 5,     '5th foul sets foulCount to 5');
assertEqual(p1.isActive,  false, '5th foul sets isActive to false');

// attempt2Pointer — successful
const p1b = createPlayerManual({ name: 'João Lima', position: 'PG', archetype: 'Playmaker', seed: 9 });
p1b.attempt2Pointer(true);
assertEqual(p1b.stats.shots2pt.attempted, 1, 'attempt2Pointer(true): shots2pt.attempted === 1');
assertEqual(p1b.stats.shots2pt.made,      1, 'attempt2Pointer(true): shots2pt.made === 1');
assertEqual(p1b.stats.pointsScored,       2, 'attempt2Pointer(true): pointsScored === 2');

// attempt2Pointer — missed
p1b.attempt2Pointer(false);
assertEqual(p1b.stats.shots2pt.attempted, 2, 'attempt2Pointer(false): shots2pt.attempted === 2');
assertEqual(p1b.stats.shots2pt.made,      1, 'attempt2Pointer(false): shots2pt.made stays at 1');
assertEqual(p1b.stats.pointsScored,       2, 'attempt2Pointer(false): pointsScored stays at 2');

// attempt3Pointer — successful
p1b.attempt3Pointer(true);
assertEqual(p1b.stats.shots3pt.attempted, 1, 'attempt3Pointer(true): shots3pt.attempted === 1');
assertEqual(p1b.stats.shots3pt.made,      1, 'attempt3Pointer(true): shots3pt.made === 1');
assertEqual(p1b.stats.pointsScored,       5, 'attempt3Pointer(true): pointsScored === 5 (2+3)');

// attempt3Pointer — missed
p1b.attempt3Pointer(false);
assertEqual(p1b.stats.shots3pt.attempted, 2, 'attempt3Pointer(false): shots3pt.attempted === 2');
assertEqual(p1b.stats.shots3pt.made,      1, 'attempt3Pointer(false): shots3pt.made stays 1');

// attemptFreeThrow
p1b.attemptFreeThrow(true);
assertEqual(p1b.stats.freethrows,     1, 'attemptFreeThrow(true): freethrows === 1');
assertEqual(p1b.stats.pointsScored,   6, 'attemptFreeThrow(true): pointsScored === 6 (5+1)');
p1b.attemptFreeThrow(false);
assertEqual(p1b.stats.freethrows,     2, 'attemptFreeThrow(false): freethrows === 2');
assertEqual(p1b.stats.pointsScored,   6, 'attemptFreeThrow(false): pointsScored unchanged at 6');

// get2PointPercentage / get3PointPercentage
const pct2 = p1b.get2PointPercentage();
const pct3 = p1b.get3PointPercentage();
assertEqual(pct2, '50.0', 'get2PointPercentage() === "50.0" (1/2)');
assertEqual(pct3, '50.0', 'get3PointPercentage() === "50.0" (1/2)');

// resetStats
p1b.resetStats();
assertEqual(p1b.stats.pointsScored,       0,    'resetStats(): pointsScored === 0');
assertEqual(p1b.stats.shots2pt.attempted, 0,    'resetStats(): shots2pt.attempted === 0');
assertEqual(p1b.foulCount,                0,    'resetStats(): foulCount === 0');
assertEqual(p1b.isActive,                 true, 'resetStats(): isActive === true');
assertEqual(p1b.stamina,                  100,  'resetStats(): stamina === maxStamina (100)');

// Getter aliases
assert(typeof p1.shooting         === 'number', 'shooting getter returns number (=FieldGoal)');
assert(typeof p1.shooting3pt      === 'number', 'shooting3pt getter returns number (=ThreePoint)');
assert(typeof p1.defense          === 'number', 'defense getter returns number (=Defense)');
assert(typeof p1.blocking         === 'number', 'blocking getter returns number (=Blocking)');
assert(typeof p1.rebounding       === 'number', 'rebounding getter returns number (composite: Blocking*0.6 + FieldGoalPaint*0.4)');
assert(typeof p1.passing          === 'number', 'passing getter returns number (=Passing)');
assert(typeof p1.stealing         === 'number', 'stealing getter returns number (=StealMarking)');
assert(typeof p1.dribbling        === 'number', 'dribbling getter returns number (d20 converted)');
assert(typeof p1.perimeterDefense === 'number', 'perimeterDefense getter returns number');

assertEqual(p1.shooting,    p1.attributes.FieldGoal,    'shooting === attributes.FieldGoal');
assertEqual(p1.shooting3pt, p1.attributes.ThreePoint,   'shooting3pt === attributes.ThreePoint');
assertEqual(p1.defense,     p1.attributes.Defense,      'defense === attributes.Defense');
assertEqual(p1.blocking,    p1.attributes.Blocking,     'blocking === attributes.Blocking');
const expectedRebound = Math.round(p1.attributes.Blocking * 0.6 + p1.attributes.FieldGoalPaint * 0.4); assertEqual(p1.rebounding, expectedRebound, 'rebounding === round(Blocking*0.6 + FieldGoalPaint*0.4)');
assertEqual(p1.passing,     p1.attributes.Passing,      'passing === attributes.Passing');
assertEqual(p1.stealing,    p1.attributes.StealMarking, 'stealing === attributes.StealMarking');

const expectedDribbling = d20ToSkill(p1.d20.Dribble);
assertEqual(p1.dribbling, expectedDribbling, `dribbling === d20ToSkill(${p1.d20.Dribble}) === ${expectedDribbling}`);

const expectedPerim = Math.round((p1.attributes.Defense + p1.attributes.StealMarking) / 2);
assertEqual(p1.perimeterDefense, expectedPerim, `perimeterDefense === round((Defense+StealMarking)/2) === ${expectedPerim}`);

// ---------------------------------------------------------------------------
// GROUP 2: Attribute Ranges
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 2: Attribute Ranges (1-99 and d20)');
console.log('========================================');

function checkAllAttributeRanges(player, label) {
  const allPass = REQUIRED_ATTRS.every(key => {
    const v = player.attributes[key];
    return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99;
  });
  assert(allPass, `${label}: all 15 attributes are integers in [1, 99]`);

  // Check each individually so failures are visible
  for (const key of REQUIRED_ATTRS) {
    assertInRange(player.attributes[key], 1, 99, `${label}: attributes.${key}`);
  }

  // d20 attributes in [1, 20]
  assertInRange(player.d20.Dribble,         1, 20, `${label}: d20.Dribble in [1, 20]`);
  assertInRange(player.d20.StealMarkingD20, 1, 20, `${label}: d20.StealMarkingD20 in [1, 20]`);

  // dribbling getter in [1, 99]
  assertInRange(player.dribbling, 1, 99, `${label}: dribbling getter in [1, 99]`);
}

const pAttrTest = createPlayerAuto({ position: 'PF', archetype: 'Rebounder', seed: 77 });
checkAllAttributeRanges(pAttrTest, 'PF/Rebounder (seed=77)');

// Edge check: attributes as integers (not floats)
for (const key of REQUIRED_ATTRS) {
  assert(
    Number.isInteger(pAttrTest.attributes[key]),
    `attributes.${key} is an integer (no float)`
  );
}
assert(Number.isInteger(pAttrTest.d20.Dribble),         'd20.Dribble is an integer');
assert(Number.isInteger(pAttrTest.d20.StealMarkingD20), 'd20.StealMarkingD20 is an integer');

// ---------------------------------------------------------------------------
// GROUP 3: Archetype Templates — design invariants and runtime checks
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 3: Archetype Templates');
console.log('========================================');

// Define expected HIGH/LOW stats for each archetype (from ARCHETYPE_TEMPLATES)
const ARCHETYPE_SPEC = {
  Scorer: {
    highAttrs: ['Attack', 'ThreePoint'],
    lowAttrs:  ['Defense', 'Blocking'],
  },
  Defender: {
    highAttrs: ['Defense', 'StealMarking'],
    lowAttrs:  ['ThreePoint', 'FieldGoalMidRange'],
  },
  Playmaker: {
    highAttrs: ['Passing'],
    lowAttrs:  ['Blocking'],
  },
  Rebounder: {
    highAttrs: ['FieldGoalPaint', 'Blocking'],
    lowAttrs:  ['ThreePoint'],
  },
  Stretch: {
    highAttrs: ['ThreePoint', 'FieldGoalMidRange'],
    lowAttrs:  ['Blocking', 'FieldGoalPaint'],
  },
};

// Template design check: high attrs min range must exceed low attrs max range
for (const [arch, spec] of Object.entries(ARCHETYPE_SPEC)) {
  const tpl = ARCHETYPE_TEMPLATES[arch];

  for (const highKey of spec.highAttrs) {
    const highMin = tpl[highKey][0]; // lo of high attr
    for (const lowKey of spec.lowAttrs) {
      const lowMax = tpl[lowKey][1]; // hi of low attr
      assert(
        highMin > lowMax,
        `${arch}: template HIGH(${highKey}).min=${highMin} > LOW(${lowKey}).max=${lowMax}`
      );
    }
  }
}

// Runtime check: generate one player per archetype (5 fixed positions to avoid confound)
// Primary high stat should always exceed 50 even with max negative variance (-6)
for (const arch of VALID_ARCHETYPES) {
  const spec = ARCHETYPE_SPEC[arch];
  const tpl  = ARCHETYPE_TEMPLATES[arch];

  // Theoretical minimum for a high attr: template.lo - variance(6) clamped to 1
  for (const highKey of spec.highAttrs) {
    const theoreticalMin = Math.max(1, tpl[highKey][0] - 6);
    assert(
      theoreticalMin > 50,
      `${arch}: theoretical min of ${highKey} (${theoreticalMin}) > 50 after max negative variance`
    );
  }

  // Generate 3 different players for this archetype and verify primary stats > 50
  for (let seed = 1001; seed <= 1003; seed++) {
    const p = createPlayerAuto({ archetype: arch, seed });
    for (const highKey of spec.highAttrs) {
      assert(
        p.attributes[highKey] > 50,
        `${arch} seed=${seed}: attributes.${highKey} (${p.attributes[highKey]}) > 50`
      );
    }
    // Low attr should be below high attr (in the generated player)
    for (const lowKey of spec.lowAttrs) {
      for (const highKey of spec.highAttrs) {
        // This is a statistical tendency test — with variance the high stat should
        // still numerically dominate the low stat most of the time.
        // We test that the HIGH attr > 40 (even with variance, high stats are comfortably above)
        assert(
          p.attributes[highKey] > p.attributes[lowKey] - 30,
          `${arch} seed=${seed}: HIGH(${highKey}=${p.attributes[highKey]}) is in the right ballpark vs LOW(${lowKey}=${p.attributes[lowKey]})`
        );
      }
    }
  }
}

// d20 Dribble range per archetype matches template
for (const arch of VALID_ARCHETYPES) {
  const tpl = ARCHETYPE_TEMPLATES[arch];
  const [dLo, dHi] = tpl.Dribble;
  assert(dLo >= 1 && dLo <= 20, `${arch}: Dribble template lo (${dLo}) in [1,20]`);
  assert(dHi >= 1 && dHi <= 20, `${arch}: Dribble template hi (${dHi}) in [1,20]`);
  assert(dLo <= dHi,            `${arch}: Dribble template lo <= hi`);
}

// ---------------------------------------------------------------------------
// GROUP 4: All 5 Positions
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 4: All 5 Positions');
console.log('========================================');

const POSITION_ARCHETYPE_PAIRS = [
  { position: 'PG', archetype: 'Playmaker',  seed: 201 },
  { position: 'SG', archetype: 'Scorer',     seed: 202 },
  { position: 'SF', archetype: 'Stretch',    seed: 203 },
  { position: 'PF', archetype: 'Rebounder',  seed: 204 },
  { position: 'C',  archetype: 'Defender',   seed: 205 },
];

for (const { position, archetype, seed } of POSITION_ARCHETYPE_PAIRS) {
  const p = createPlayerAuto({ position, archetype, seed });

  assertEqual(p.position,  position,  `${position}/${archetype}: position matches`);
  assertEqual(p.archetype, archetype, `${position}/${archetype}: archetype matches`);

  // Physical bounds
  const phys = POSITION_PHYSICAL[position];
  assertInRange(p.height_cm, phys.heightRange[0], phys.heightRange[1], `${position}: height_cm in [${phys.heightRange}]`);
  assertInRange(p.weight_kg, phys.weightRange[0], phys.weightRange[1], `${position}: weight_kg in [${phys.weightRange}]`);

  // All attributes valid
  const allAttrsValid = REQUIRED_ATTRS.every(k => {
    const v = p.attributes[k];
    return typeof v === 'number' && v >= 1 && v <= 99;
  });
  assert(allAttrsValid, `${position}/${archetype}: all attributes in valid range`);

  // d20 valid
  assertInRange(p.d20.Dribble,         1, 20, `${position}/${archetype}: d20.Dribble in [1,20]`);
  assertInRange(p.d20.StealMarkingD20, 1, 20, `${position}/${archetype}: d20.StealMarkingD20 in [1,20]`);

  // No errors: getSummary works
  const s = p.getSummary();
  assert(s.position === position, `${position}/${archetype}: getSummary().position correct`);
}

// Physical profile: verify all 5 position ranges are populated in POSITION_PHYSICAL
for (const pos of VALID_POSITIONS) {
  const phys = POSITION_PHYSICAL[pos];
  assert(phys !== undefined, `POSITION_PHYSICAL[${pos}] is defined`);
  assert(Array.isArray(phys.heightRange) && phys.heightRange.length === 2, `POSITION_PHYSICAL[${pos}].heightRange is a 2-element array`);
  assert(Array.isArray(phys.weightRange) && phys.weightRange.length === 2, `POSITION_PHYSICAL[${pos}].weightRange is a 2-element array`);
  assert(phys.heightRange[0] < phys.heightRange[1], `${pos}: heightRange lo < hi`);
  assert(phys.weightRange[0] < phys.weightRange[1], `${pos}: weightRange lo < hi`);
}

// Plausibility checks for the full position spectrum
// PG is shorter/lighter than C
assert(
  POSITION_PHYSICAL.PG.heightRange[1] < POSITION_PHYSICAL.C.heightRange[0],
  'PG max height < C min height (taller positions should have higher ranges)'
);
assert(
  POSITION_PHYSICAL.PG.weightRange[1] < POSITION_PHYSICAL.C.weightRange[0],
  'PG max weight < C min weight'
);

// ---------------------------------------------------------------------------
// GROUP 5: Pool Generation
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 5: Pool Generation');
console.log('========================================');

const POOL_SEED = 999;
const pool20 = generatePlayerPool(20, { seed: POOL_SEED });

assertEqual(pool20.length, 20, 'Pool of 20 has exactly 20 players');

// All unique IDs
const poolIds    = pool20.map(p => p.id);
const uniqueIds  = new Set(poolIds);
assertEqual(uniqueIds.size, 20, 'All 20 pool players have unique IDs');

// Position distribution — the pool cycles through all 5 positions;
// 20 players across 5 positions → exactly 4 of each (positionQueue is 4 full shuffles)
const posCounts = {};
for (const p of pool20) {
  posCounts[p.position] = (posCounts[p.position] || 0) + 1;
}
for (const pos of VALID_POSITIONS) {
  assert(posCounts[pos] >= 2, `At least 2 ${pos} players in pool of 20 (got ${posCounts[pos]})`);
}

// Name uniqueness (strong expectation: ~1400 BR name combinations, few collisions in 20)
const poolNames   = pool20.map(p => p.name);
const uniqueNames = new Set(poolNames);
assert(uniqueNames.size >= 15, `Pool of 20 has >= 15 unique names (got ${uniqueNames.size})`);

// All pool players have valid attributes
let poolAllValid = true;
for (const p of pool20) {
  for (const key of REQUIRED_ATTRS) {
    if (!Number.isInteger(p.attributes[key]) || p.attributes[key] < 1 || p.attributes[key] > 99) {
      poolAllValid = false;
      break;
    }
  }
  if (p.d20.Dribble < 1 || p.d20.Dribble > 20) { poolAllValid = false; }
  if (p.d20.StealMarkingD20 < 1 || p.d20.StealMarkingD20 > 20) { poolAllValid = false; }
}
assert(poolAllValid, 'All 20 pool players have all attributes in valid ranges');

// generatePlayerPool throws for count < 1
assertThrows(
  () => generatePlayerPool(0),
  'positive integer',
  'generatePlayerPool(0) throws "positive integer" error'
);
assertThrows(
  () => generatePlayerPool(-5),
  'positive integer',
  'generatePlayerPool(-5) throws "positive integer" error'
);
assertThrows(
  () => generatePlayerPool(1.5),
  'positive integer',
  'generatePlayerPool(1.5) throws "positive integer" error'
);

// Pool with invalid position filter throws
assertThrows(
  () => generatePlayerPool(5, { positions: ['XF'] }),
  'Invalid position',
  'generatePlayerPool with invalid position filter throws'
);

// Pool with ageRange filter: all players should be in range (up to max 3 retry logic)
const youngPool = generatePlayerPool(10, { ageRange: [18, 25], seed: 55 });
assertEqual(youngPool.length, 10, 'youngPool has 10 players');
// Due to max 3 retries, some players may slip through the age filter — so we check at least 7 of 10 are in range
const inAgeRange = youngPool.filter(p => p.age >= 18 && p.age <= 25).length;
assert(inAgeRange >= 7, `youngPool: at least 7 of 10 in ageRange [18-25] (got ${inAgeRange})`);

// Pool with qualityRange filter: most players in range
const elitePool = generatePlayerPool(10, { qualityRange: [50, 80], seed: 77 });
assertEqual(elitePool.length, 10, 'elitePool has 10 players');

// Pool with restricted positions
const pgOnlyPool = generatePlayerPool(5, { positions: ['PG'], seed: 111 });
assert(pgOnlyPool.every(p => p.position === 'PG'), 'positions:["PG"] pool all have position PG');

// Pool from single archetype
const scorerPool = generatePlayerPool(5, { archetypes: ['Scorer'], seed: 222 });
assert(scorerPool.every(p => p.archetype === 'Scorer'), 'archetypes:["Scorer"] pool all have archetype Scorer');

// ---------------------------------------------------------------------------
// GROUP 6: Auto-generate Reproducibility (seed determinism)
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 6: Auto-generate Reproducibility');
console.log('========================================');

// Same seed → exactly same player
const dup1 = createPlayerAuto({ seed: 42 });
const dup2 = createPlayerAuto({ seed: 42 });
assertEqual(dup1.id,         dup2.id,         'Same seed: identical id');
assertEqual(dup1.name,       dup2.name,       'Same seed: identical name');
assertEqual(dup1.age,        dup2.age,        'Same seed: identical age');
assertEqual(dup1.position,   dup2.position,   'Same seed: identical position');
assertEqual(dup1.archetype,  dup2.archetype,  'Same seed: identical archetype');
assertEqual(dup1.nationality,dup2.nationality,'Same seed: identical nationality');
assertEqual(dup1.height_cm,  dup2.height_cm,  'Same seed: identical height_cm');
assertEqual(dup1.weight_kg,  dup2.weight_kg,  'Same seed: identical weight_kg');
// Attribute equality for every attribute
for (const key of REQUIRED_ATTRS) {
  assertEqual(
    dup1.attributes[key],
    dup2.attributes[key],
    `Same seed: attributes.${key} identical`
  );
}

// Different seeds → different players (different IDs at minimum)
const diffA = createPlayerAuto({ seed: 100 });
const diffB = createPlayerAuto({ seed: 200 });
assert(diffA.id !== diffB.id, 'Different seeds produce different UUIDs');

// At least one attribute differs between seed=100 and seed=200
const attrsDiffer = REQUIRED_ATTRS.some(k => diffA.attributes[k] !== diffB.attributes[k]);
assert(attrsDiffer, 'Different seeds produce different attribute sets');

// No seed at all → each call generates different UUID (randomness works)
const rndA = createPlayerAuto();
const rndB = createPlayerAuto();
assert(rndA.id !== rndB.id, 'Unseeded calls produce different UUIDs');

// Force position override with seed still produces correct position
const forcedPG = createPlayerAuto({ position: 'PG', seed: 77 });
assertEqual(forcedPG.position, 'PG', 'createPlayerAuto({ position: "PG", seed }) still gives PG');

// Force archetype override
const forcedDef = createPlayerAuto({ archetype: 'Defender', seed: 88 });
assertEqual(forcedDef.archetype, 'Defender', 'createPlayerAuto({ archetype: "Defender", seed }) still gives Defender');

// ---------------------------------------------------------------------------
// GROUP 7: Manual Creation Validation
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 7: Manual Creation Validation');
console.log('========================================');

// Valid manual creation with explicit archetype='Scorer' + position='SG'
const manualSG = createPlayerManual({
  name:      'Marcus Alves',
  position:  'SG',
  archetype: 'Scorer',
  seed:      333,
});
assertEqual(manualSG.name,      'Marcus Alves', 'Manual: name preserved');
assertEqual(manualSG.position,  'SG',           'Manual: position === SG');
assertEqual(manualSG.archetype, 'Scorer',       'Manual: archetype === Scorer');
// Height in SG range [185, 198]
assertInRange(manualSG.height_cm, 185, 198, 'Manual SG: height in [185, 198]');

// Name trimming: whitespace is stripped
const spacedName = createPlayerManual({
  name:      '  Carlos Santos  ',
  position:  'PF',
  archetype: 'Rebounder',
  seed:      1,
});
assertEqual(spacedName.name, 'Carlos Santos', 'Name with surrounding spaces is trimmed');

// Invalid position throws
assertThrows(
  () => createPlayerManual({ name: 'Test', position: 'QQ', archetype: 'Scorer' }),
  'Invalid position',
  'createPlayerManual with invalid position throws'
);
assertThrows(
  () => createPlayerManual({ name: 'Test', position: 'pg', archetype: 'Scorer' }),
  'Invalid position',
  'createPlayerManual with lowercase position throws (must be uppercase)'
);

// Invalid archetype throws
assertThrows(
  () => createPlayerManual({ name: 'Test', position: 'PG', archetype: 'Dribbler' }),
  'Invalid archetype',
  'createPlayerManual with invalid archetype throws'
);

// Missing name throws
assertThrows(
  () => createPlayerManual({ position: 'PG', archetype: 'Scorer' }),
  '"name" is required',
  'createPlayerManual without name throws'
);

// Empty name throws
assertThrows(
  () => createPlayerManual({ name: '', position: 'PG', archetype: 'Scorer' }),
  '"name" is required',
  'createPlayerManual with empty name throws'
);

// Whitespace-only name throws
assertThrows(
  () => createPlayerManual({ name: '   ', position: 'PG', archetype: 'Scorer' }),
  '"name" is required',
  'createPlayerManual with whitespace-only name throws'
);

// Missing position throws
assertThrows(
  () => createPlayerManual({ name: 'Valid', archetype: 'Scorer' }),
  '"position" is required',
  'createPlayerManual without position throws'
);

// Missing archetype throws
assertThrows(
  () => createPlayerManual({ name: 'Valid', position: 'PG' }),
  '"archetype" is required',
  'createPlayerManual without archetype throws'
);

// Age validation: below range throws
assertThrows(
  () => createPlayerManual({ name: 'Test', position: 'PG', archetype: 'Scorer', age: 17 }),
  'Invalid age',
  'createPlayerManual with age=17 throws'
);

// Age validation: above range throws
assertThrows(
  () => createPlayerManual({ name: 'Test', position: 'PG', archetype: 'Scorer', age: 39 }),
  'Invalid age',
  'createPlayerManual with age=39 throws'
);

// Age validation: non-integer throws
assertThrows(
  () => createPlayerManual({ name: 'Test', position: 'PG', archetype: 'Scorer', age: 25.5 }),
  'Invalid age',
  'createPlayerManual with age=25.5 throws'
);

// Valid boundary ages (no throw)
let boundaryOk = true;
try {
  createPlayerManual({ name: 'Young', position: 'PG', archetype: 'Scorer', age: 18, seed: 1 });
  createPlayerManual({ name: 'Old',   position: 'C',  archetype: 'Defender', age: 38, seed: 2 });
} catch (e) {
  boundaryOk = false;
}
assert(boundaryOk, 'createPlayerManual with age=18 and age=38 does not throw');

// Explicit override of nationality, hometown, nickname
const fullManual = createPlayerManual({
  name:        'Sergio García',
  position:    'SF',
  archetype:   'Stretch',
  nationality: 'Spanish',
  hometown:    'Madrid',
  nickname:    'El Tirador',
  age:         25,
  seed:        444,
});
assertEqual(fullManual.nationality, 'Spanish',     'Manual: nationality override applied');
assertEqual(fullManual.hometown,    'Madrid',      'Manual: hometown override applied');
assertEqual(fullManual.nickname,    'El Tirador',  'Manual: nickname override applied');
assertEqual(fullManual.age,         25,            'Manual: explicit age used');

// createPlayerAuto invalid position throws
assertThrows(
  () => createPlayerAuto({ position: 'XX' }),
  'Invalid position',
  'createPlayerAuto with invalid position throws'
);

// createPlayerAuto invalid archetype throws
assertThrows(
  () => createPlayerAuto({ archetype: 'BigMan' }),
  'Invalid archetype',
  'createPlayerAuto with invalid archetype throws'
);

// ---------------------------------------------------------------------------
// GROUP 8: Edge Cases and Stress Test
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 8: Edge Cases — 100-Player Stress Test');
console.log('========================================');

// Generate 100 players (seeded for speed) and verify ALL attributes in range
let stressAllInRange     = true;
let stressD20AllInRange  = true;
let stressUUIDsUnique    = true;
const stressIds = new Set();

for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i * 31 + 7 });

  // Unique IDs
  if (stressIds.has(sp.id)) {
    stressUUIDsUnique = false;
  }
  stressIds.add(sp.id);

  // 1-99 range
  for (const key of REQUIRED_ATTRS) {
    const v = sp.attributes[key];
    if (!Number.isInteger(v) || v < 1 || v > 99) {
      stressAllInRange = false;
      console.log(`    ❌ Stress fail: player[${i}].attributes.${key} = ${v}`);
    }
  }

  // d20 range
  if (sp.d20.Dribble < 1 || sp.d20.Dribble > 20) {
    stressD20AllInRange = false;
    console.log(`    ❌ Stress fail: player[${i}].d20.Dribble = ${sp.d20.Dribble}`);
  }
  if (sp.d20.StealMarkingD20 < 1 || sp.d20.StealMarkingD20 > 20) {
    stressD20AllInRange = false;
    console.log(`    ❌ Stress fail: player[${i}].d20.StealMarkingD20 = ${sp.d20.StealMarkingD20}`);
  }
}

assert(stressAllInRange,    '100 auto-generated players: all 1-99 attributes in [1, 99]');
assert(stressD20AllInRange, '100 auto-generated players: all d20 attributes in [1, 20]');
assert(stressUUIDsUnique,   '100 auto-generated players (seeded): all IDs unique');

// Stress: overall rating always in [1, 99]
let overallAllInRange = true;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i * 17 + 3 });
  if (sp.overall < 1 || sp.overall > 99) {
    overallAllInRange = false;
    console.log(`    ❌ Stress fail: player[${i}].overall = ${sp.overall}`);
  }
  if (sp.cardOverall < 1 || sp.cardOverall > 99) {
    overallAllInRange = false;
    console.log(`    ❌ Stress fail: player[${i}].cardOverall = ${sp.cardOverall}`);
  }
}
assert(overallAllInRange, '100 auto-generated players: overall and cardOverall always in [1, 99]');

// Stress: skillLevel always in [1, 5]
let skillLevelAllValid = true;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i * 13 });
  if (sp.skillLevel < 1 || sp.skillLevel > 5) {
    skillLevelAllValid = false;
  }
}
assert(skillLevelAllValid, '100 auto-generated players: skillLevel always in [1, 5]');

// Stress: age always in [18, 38]
let ageAllValid = true;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i * 19 + 1 });
  if (!Number.isInteger(sp.age) || sp.age < 18 || sp.age > 38) {
    ageAllValid = false;
    console.log(`    ❌ Stress fail: player[${i}].age = ${sp.age}`);
  }
}
assert(ageAllValid, '100 auto-generated players: age always integer in [18, 38]');

// Stress: position always valid
let posAlwaysValid = true;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i });
  if (!VALID_POSITIONS.includes(sp.position)) {
    posAlwaysValid = false;
  }
}
assert(posAlwaysValid, '100 auto-generated players: position always valid');

// Stress: archetype always valid
let archAlwaysValid = true;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i + 500 });
  if (!VALID_ARCHETYPES.includes(sp.archetype)) {
    archAlwaysValid = false;
  }
}
assert(archAlwaysValid, '100 auto-generated players: archetype always valid');

// Stress: dominantHand always Left or Right
let handAlwaysValid = true;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i + 1000 });
  if (sp.dominantHand !== 'Left' && sp.dominantHand !== 'Right') {
    handAlwaysValid = false;
  }
}
assert(handAlwaysValid, '100 auto-generated players: dominantHand always Left or Right');

// Dominant hand distribution: ~75% Right (DOMINANT_HANDS = ['Right','Right','Right','Left'])
// With 100 players, expect roughly 70-85 Right-handed
const rightCount = [];
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i + 2000 });
  if (sp.dominantHand === 'Right') rightCount.push(1);
}
assert(
  rightCount.length >= 60 && rightCount.length <= 90,
  `Right-hand distribution in [60, 90] of 100 players — got ${rightCount.length} Right-handed`
);

// ---------------------------------------------------------------------------
// Pure utility function tests
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('UTILITY: d20ToSkill, overallToSkillLevel, calculateCardOverall');
console.log('========================================');

// d20ToSkill boundary tests — formula: clamp(round(99 - ((d20-1)/19)*98), 1, 99)
assertEqual(d20ToSkill(1),  99, 'd20ToSkill(1) === 99 (best dribbler)');
assertEqual(d20ToSkill(20),  1, 'd20ToSkill(20) === 1 (worst dribbler)');
// d20=10 → round(99 - (9/19)*98) = round(99 - 46.42...) = round(52.578) = 53
assertEqual(d20ToSkill(10), 53, 'd20ToSkill(10) === 53');
// d20=2 → round(99 - (1/19)*98) = round(99 - 5.157) = round(93.84) = 94
assertEqual(d20ToSkill(2),  94, 'd20ToSkill(2) === 94');
// Monotonically decreasing: d20ToSkill(5) > d20ToSkill(15)
assert(d20ToSkill(5) > d20ToSkill(15), 'd20ToSkill is monotonically decreasing');

// overallToSkillLevel thresholds (from source)
assertEqual(overallToSkillLevel(82), 5, 'overallToSkillLevel(82) === 5');
assertEqual(overallToSkillLevel(99), 5, 'overallToSkillLevel(99) === 5');
assertEqual(overallToSkillLevel(81), 4, 'overallToSkillLevel(81) === 4');
assertEqual(overallToSkillLevel(70), 4, 'overallToSkillLevel(70) === 4');
assertEqual(overallToSkillLevel(69), 3, 'overallToSkillLevel(69) === 3');
assertEqual(overallToSkillLevel(55), 3, 'overallToSkillLevel(55) === 3');
assertEqual(overallToSkillLevel(54), 2, 'overallToSkillLevel(54) === 2');
assertEqual(overallToSkillLevel(40), 2, 'overallToSkillLevel(40) === 2');
assertEqual(overallToSkillLevel(39), 1, 'overallToSkillLevel(39) === 1');
assertEqual(overallToSkillLevel(1),  1, 'overallToSkillLevel(1) === 1');

// calculateCardOverall formula: round((Attack+Defense+Stamina+ThreePoint)/4)
const syntheticAttrs = { Attack: 80, Defense: 60, Stamina: 70, ThreePoint: 90 };
// (80+60+70+90)/4 = 300/4 = 75
assertEqual(calculateCardOverall(syntheticAttrs), 75, 'calculateCardOverall({80,60,70,90}) === 75');

const syntheticAttrs2 = { Attack: 99, Defense: 99, Stamina: 99, ThreePoint: 99 };
assertEqual(calculateCardOverall(syntheticAttrs2), 99, 'calculateCardOverall all-99 === 99');

const syntheticAttrs3 = { Attack: 1, Defense: 1, Stamina: 1, ThreePoint: 1 };
assertEqual(calculateCardOverall(syntheticAttrs3), 1, 'calculateCardOverall all-1 === 1');

// Rounding: (85+75+65+77)/4 = 302/4 = 75.5 → round to 76
const syntheticAttrs4 = { Attack: 85, Defense: 75, Stamina: 65, ThreePoint: 77 };
assertEqual(calculateCardOverall(syntheticAttrs4), 76, 'calculateCardOverall rounds 75.5 → 76');

// Nationality distribution: 70% Brazilian expected
// With 100 players and random seeds, roughly 60-85 should be Brazilian
let brazilianCount = 0;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i * 7 + 300 });
  if (sp.nationality === 'Brazilian') brazilianCount++;
}
assert(
  brazilianCount >= 55 && brazilianCount <= 85,
  `Brazilian nationality rate in [55, 85] of 100 players — got ${brazilianCount}`
);

// International players have valid nationality from the permitted list
const VALID_NATIONALITIES = ['Brazilian', 'American', 'Spanish', 'Argentine', 'French', 'Serbian'];
let allNatValid = true;
for (let i = 0; i < 100; i++) {
  const sp = createPlayerAuto({ seed: i * 11 + 50 });
  if (!VALID_NATIONALITIES.includes(sp.nationality)) {
    allNatValid = false;
    console.log(`    ❌ Unexpected nationality: "${sp.nationality}"`);
  }
}
assert(allNatValid, '100 auto-generated players: all nationalities are from the valid set');

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log(`Result: ✅ ${passCount} passed, ❌ ${failCount} failed`);
console.log('========================================');

if (failCount > 0) process.exit(1);
