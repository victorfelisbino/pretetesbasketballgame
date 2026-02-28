/**
 * seasonManager.test.js
 * Quadra Legacy — exhaustive tests for seasonManager.js
 *
 * Run with: node src/gameplay/seasonManager.test.js
 *
 * Framework: plain Node.js — no jest, no mocha, no external libraries.
 * Style mirrors src/actionResolver.test.js: ✅/❌ per assertion, passCount/failCount summary.
 *
 * Spec references: MOBILE_GAME_MASTER_PLAN.md §6.9 (Season Structure)
 *   Phase durations: Pre-Season Draft = 3 days, Regular Season = 14 days,
 *   Trade Deadline = Day 10 of Regular Season, Playoffs = 5 days, Off-Season = 3 days.
 */

import {
  createSeason,
  generateSchedule,
  calculateStandings,
  advanceSeasonPhase,
  generatePlayoffBracket,
  isTradeDeadlinePassed,
  sortStandings,
  getPlayoffTeams,
  getLeagueChampion,
  getWeekNumber,
  getNextMatchDay,
  SEASON_PHASES,
} from './seasonManager.js';

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
    console.log(`  ✅ ${label} — got: ${JSON.stringify(actual)}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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

function assertThrows(fn, expectedFragment, label) {
  try {
    fn();
    console.log(`  ❌ FAIL: ${label} — expected throw, but no error thrown`);
    failCount++;
  } catch (e) {
    if (expectedFragment && !e.message.includes(expectedFragment)) {
      console.log(`  ❌ FAIL: ${label} — threw but wrong message: "${e.message}"`);
      failCount++;
    } else {
      console.log(`  ✅ ${label} — threw: "${e.message}"`);
      passCount++;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers used across multiple groups
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Extract all (teamA, teamB) pairs from a schedule as "SORTED|IDs" strings.
 * Allows checking pair coverage regardless of home/away assignment.
 */
function extractPairs(schedule) {
  const pairs = new Set();
  for (const block of schedule) {
    for (const m of block.matchups) {
      const key = [m.homeTeamId, m.awayTeamId].sort().join('|');
      pairs.add(key);
    }
  }
  return pairs;
}

/**
 * Build the complete set of expected round-robin pairs for n teams.
 * @param {string[]} teams
 * @returns {Set<string>} All n*(n-1)/2 normalised pairs.
 */
function expectedPairs(teams) {
  const result = new Set();
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      result.add([teams[i], teams[j]].sort().join('|'));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// SEASON_PHASES constants
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('CONSTANTS: SEASON_PHASES');
console.log('========================================');

assertEqual(SEASON_PHASES.DRAFT,     'draft',     'SEASON_PHASES.DRAFT === "draft"');
assertEqual(SEASON_PHASES.REGULAR,   'regular',   'SEASON_PHASES.REGULAR === "regular"');
assertEqual(SEASON_PHASES.PLAYOFFS,  'playoffs',  'SEASON_PHASES.PLAYOFFS === "playoffs"');
assertEqual(SEASON_PHASES.OFFSEASON, 'offseason', 'SEASON_PHASES.OFFSEASON === "offseason"');

// Frozen — mutations should silently fail (Object.freeze)
const originalDraft = SEASON_PHASES.DRAFT;
try { SEASON_PHASES.DRAFT = 'mutated'; } catch (_) {}
assertEqual(SEASON_PHASES.DRAFT, originalDraft, 'SEASON_PHASES is frozen (mutation has no effect)');

// ---------------------------------------------------------------------------
// GROUP 1: createSeason — structure, defaults, edge cases
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 1: createSeason');
console.log('========================================');

const TEAMS_4 = ['teamA', 'teamB', 'teamC', 'teamD'];
const TEAMS_8 = ['T1','T2','T3','T4','T5','T6','T7','T8'];

// Deterministic startDate so all date assertions are reproducible
const EPOCH_START = new Date(0); // 1970-01-01T00:00:00.000Z

const season4 = createSeason('league1', TEAMS_4, {
  startDate:    EPOCH_START,
  seasonNumber: 1,
});

// Required top-level fields
assert(typeof season4.id === 'string' && season4.id.length > 0, 'season.id is a non-empty string');
assertEqual(season4.leagueId, 'league1', 'season.leagueId matches input');
assertEqual(season4.number,   1,         'season.number === 1 (default seasonNumber)');
assertEqual(season4.status,   SEASON_PHASES.DRAFT, 'season.status starts as "draft"');
assert(season4.playoffBracket === null, 'playoffBracket is null at creation');
assert(season4.champion       === null, 'champion is null at creation');
assert(typeof season4.createdAt === 'string', 'createdAt is an ISO string');

// Config block
const cfg4 = season4.config;
assert(cfg4 !== null && typeof cfg4 === 'object', 'season.config is an object');
assertEqual(cfg4.draftType,     'snake',      'config.draftType defaults to "snake"');
assertEqual(cfg4.fantasyMode,   'headToHead', 'config.fantasyMode defaults to "headToHead"');
assertEqual(cfg4.matchesPerWeek, 3,           'config.matchesPerWeek defaults to 3');
// Regular season = 14 days → totalWeeks = ceil(14/7) = 2
assertEqual(cfg4.totalWeeks, 2, 'config.totalWeeks === 2 for 14-day regular season');
assert(Array.isArray(cfg4.teamIds), 'config.teamIds is an array');
assertEqual(cfg4.teamIds.length, 4, 'config.teamIds has 4 entries');
// teamIds in config are a copy, not the same reference
assert(cfg4.teamIds !== TEAMS_4, 'config.teamIds is a copy (not same reference as input)');
assert(cfg4.teamIds.every((id, i) => id === TEAMS_4[i]), 'config.teamIds values match input');

// Phase durations defaults
assertEqual(cfg4.phaseDurations.draft,     3,  'phaseDurations.draft === 3');
assertEqual(cfg4.phaseDurations.regular,   14, 'phaseDurations.regular === 14');
assertEqual(cfg4.phaseDurations.playoffs,  5,  'phaseDurations.playoffs === 5');
assertEqual(cfg4.phaseDurations.offseason, 3,  'phaseDurations.offseason === 3');

// Dates block — all computed from startDate=epoch
const dates4 = season4.dates;
assert(typeof dates4.seasonStart        === 'string', 'dates.seasonStart is an ISO string');
assert(typeof dates4.draftEnd           === 'string', 'dates.draftEnd is an ISO string');
assert(typeof dates4.regularSeasonStart === 'string', 'dates.regularSeasonStart is an ISO string');
assert(typeof dates4.tradeDeadline      === 'string', 'dates.tradeDeadline is an ISO string');
assert(typeof dates4.playoffsStart      === 'string', 'dates.playoffsStart is an ISO string');
assert(typeof dates4.offseasonStart     === 'string', 'dates.offseasonStart is an ISO string');
assert(typeof dates4.seasonEnd          === 'string', 'dates.seasonEnd is an ISO string');

// Verify date arithmetic (startDate = epoch = 0 ms)
const epochMs          = EPOCH_START.getTime(); // 0
const regularStartMs   = epochMs + 3 * ONE_DAY_MS;   // draft = 3 days
const tradeDeadlineMs  = regularStartMs + 10 * ONE_DAY_MS;
const playoffsStartMs  = regularStartMs + 14 * ONE_DAY_MS;
const offseasonStartMs = playoffsStartMs + 5 * ONE_DAY_MS;
const seasonEndMs      = offseasonStartMs + 3 * ONE_DAY_MS;

assertEqual(new Date(dates4.seasonStart).getTime(),        epochMs,          'dates.seasonStart === epoch');
assertEqual(new Date(dates4.regularSeasonStart).getTime(), regularStartMs,   'dates.regularSeasonStart === epoch + 3 days');
assertEqual(new Date(dates4.tradeDeadline).getTime(),      tradeDeadlineMs,  'dates.tradeDeadline === regularStart + 10 days');
assertEqual(new Date(dates4.playoffsStart).getTime(),      playoffsStartMs,  'dates.playoffsStart === regularStart + 14 days');
assertEqual(new Date(dates4.offseasonStart).getTime(),     offseasonStartMs, 'dates.offseasonStart === playoffStart + 5 days');
assertEqual(new Date(dates4.seasonEnd).getTime(),          seasonEndMs,      'dates.seasonEnd === offseasonStart + 3 days');

// Total season length = 3 + 14 + 5 + 3 = 25 days
assertEqual(
  new Date(dates4.seasonEnd).getTime() - epochMs,
  25 * ONE_DAY_MS,
  'Full season calendar spans exactly 25 days (3+14+5+3)'
);

// Schedule is a non-empty array
assert(Array.isArray(season4.schedule),      'season.schedule is an array');
assert(season4.schedule.length > 0,          'season.schedule is non-empty for 4 teams');

// Each schedule block has week, round, matchups with status='scheduled'
for (const block of season4.schedule) {
  assert(typeof block.week    === 'number' && block.week >= 1,  `schedule block week (${block.week}) >= 1`);
  assert(typeof block.round   === 'number' && block.round >= 1, `schedule block round (${block.round}) >= 1`);
  assert(Array.isArray(block.matchups) && block.matchups.length > 0, `schedule block has matchups`);
  for (const m of block.matchups) {
    assert(typeof m.homeTeamId === 'string', `matchup homeTeamId is a string`);
    assert(typeof m.awayTeamId === 'string', `matchup awayTeamId is a string`);
    assert(m.homeTeamId !== m.awayTeamId, `matchup: homeTeamId !== awayTeamId (no self-play)`);
    assertEqual(m.status, 'scheduled', 'matchup.status === "scheduled" after createSeason');
  }
}

// Standings has one entry per team
const standings4 = season4.standings;
assert(Array.isArray(standings4),             'season.standings is an array');
assertEqual(standings4.length, 4,            'season.standings has 4 entries for 4 teams');
for (const entry of standings4) {
  assert(TEAMS_4.includes(entry.teamId), `standings entry teamId "${entry.teamId}" is in team list`);
  assertEqual(entry.wins,          0,  `standings ${entry.teamId}: wins === 0`);
  assertEqual(entry.losses,        0,  `standings ${entry.teamId}: losses === 0`);
  assertEqual(entry.pointsFor,     0,  `standings ${entry.teamId}: pointsFor === 0`);
  assertEqual(entry.pointsAgainst, 0,  `standings ${entry.teamId}: pointsAgainst === 0`);
  assertEqual(entry.fantasyPts,    0,  `standings ${entry.teamId}: fantasyPts === 0`);
  assertEqual(entry.streak,       'W0', `standings ${entry.teamId}: streak === "W0"`);
}

// createSeason with 8 teams — schedule should be generated and non-empty
const season8 = createSeason('league2', TEAMS_8, { startDate: EPOCH_START });
assert(Array.isArray(season8.schedule) && season8.schedule.length > 0, 'createSeason with 8 teams generates schedule');
assertEqual(season8.standings.length, 8, 'createSeason with 8 teams generates 8 standing entries');

// createSeason with custom options
const customSeason = createSeason('leagueX', TEAMS_4, {
  startDate:    EPOCH_START,
  draftType:    'auction',
  fantasyMode:  'roto',
  matchesPerWeek: 1,
  seasonNumber: 3,
});
assertEqual(customSeason.number,               3,        'custom seasonNumber === 3');
assertEqual(customSeason.config.draftType,     'auction', 'custom draftType === "auction"');
assertEqual(customSeason.config.fantasyMode,   'roto',    'custom fantasyMode === "roto"');
assertEqual(customSeason.config.matchesPerWeek, 1,        'custom matchesPerWeek === 1 (clamped to min)');
// matchesPerWeek=1, totalWeeks=2 → totalRounds=2
assertEqual(customSeason.config.totalWeeks, 2, 'custom totalWeeks === 2 (14-day season = 2 weeks)');

// matchesPerWeek clamped to [1, 3]
const clampedSeason = createSeason('leagueY', TEAMS_4, { matchesPerWeek: 99 });
assertEqual(clampedSeason.config.matchesPerWeek, 3, 'matchesPerWeek=99 is clamped to 3');
const clampedSeason2 = createSeason('leagueZ', TEAMS_4, { matchesPerWeek: 0 });
assertEqual(clampedSeason2.config.matchesPerWeek, 1, 'matchesPerWeek=0 is clamped to 1');

// ERROR: invalid leagueId
assertThrows(
  () => createSeason('', TEAMS_4),
  'leagueId must be a non-empty string',
  'createSeason with empty leagueId throws TypeError'
);
assertThrows(
  () => createSeason(null, TEAMS_4),
  'leagueId must be a non-empty string',
  'createSeason with null leagueId throws TypeError'
);

// ERROR: too few teams (< 4)
assertThrows(
  () => createSeason('lg', ['A', 'B', 'C']),
  '4–12',
  'createSeason with 3 teams throws RangeError'
);
assertThrows(
  () => createSeason('lg', ['A']),
  '4–12',
  'createSeason with 1 team throws RangeError'
);
assertThrows(
  () => createSeason('lg', []),
  '4–12',
  'createSeason with empty array throws RangeError'
);

// ERROR: too many teams (> 12)
assertThrows(
  () => createSeason('lg', ['A','B','C','D','E','F','G','H','I','J','K','L','M']),
  '4–12',
  'createSeason with 13 teams throws RangeError'
);

// ERROR: teamIds not an array
assertThrows(
  () => createSeason('lg', 'ABCD'),
  '4–12',
  'createSeason with string teamIds throws RangeError'
);

// ---------------------------------------------------------------------------
// GROUP 2: generateSchedule — Round-Robin Correctness
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 2: generateSchedule — Round-Robin Correctness');
console.log('========================================');

// ── 4 teams ──────────────────────────────────────────────────────────────────
// 1 full cycle = 3 rounds for 4 teams. Use totalWeeks=1, matchesPerWeek=3 → 3 rounds.
const teams4  = ['A', 'B', 'C', 'D'];
const sched4  = generateSchedule(teams4, 1, 3);    // 3 rounds = 1 cycle
const pairs4  = extractPairs(sched4);
const expect4 = expectedPairs(teams4);             // 6 pairs

assertEqual(sched4.length, 3, '4-team schedule: 3 rounds in 1 cycle (totalWeeks=1, mpw=3)');

// All 6 pairs present
for (const pair of expect4) {
  assert(pairs4.has(pair), `4-team schedule: pair "${pair}" appears at least once`);
}
assertEqual(pairs4.size, 6, '4-team schedule: exactly 6 unique pairs in 1 cycle');

// No team plays itself
let selfPlayDetected4 = false;
for (const block of sched4) {
  for (const m of block.matchups) {
    if (m.homeTeamId === m.awayTeamId) selfPlayDetected4 = true;
  }
}
assert(!selfPlayDetected4, '4-team schedule: no team plays itself');

// All matchup teams are from the input list
let unknownTeam4 = false;
for (const block of sched4) {
  for (const m of block.matchups) {
    if (!teams4.includes(m.homeTeamId) || !teams4.includes(m.awayTeamId)) unknownTeam4 = true;
  }
}
assert(!unknownTeam4, '4-team schedule: all matchup participants are in the input team list');

// Each team appears exactly once per round
for (const block of sched4) {
  const seen = new Set();
  for (const m of block.matchups) {
    seen.add(m.homeTeamId);
    seen.add(m.awayTeamId);
  }
  assertEqual(seen.size, 4, `Round ${block.round}: all 4 teams appear exactly once`);
}

// Home/Away balance over 2 complete cycles (6 rounds)
const sched4_2cycle = generateSchedule(teams4, 2, 3);  // 6 rounds = 2 cycles
const homeCount4 = {};
const awayCount4 = {};
for (const t of teams4) { homeCount4[t] = 0; awayCount4[t] = 0; }
for (const block of sched4_2cycle) {
  for (const m of block.matchups) {
    homeCount4[m.homeTeamId]++;
    awayCount4[m.awayTeamId]++;
  }
}
for (const t of teams4) {
  assertEqual(
    homeCount4[t], awayCount4[t],
    `4-team 2-cycle: team ${t} home games (${homeCount4[t]}) === away games (${awayCount4[t]})`
  );
  assertEqual(
    homeCount4[t] + awayCount4[t],
    6,
    `4-team 2-cycle: team ${t} plays exactly 6 games total`
  );
}

// ── 6 teams ───────────────────────────────────────────────────────────────────
// 1 full cycle = 5 rounds for 6 teams. Use totalWeeks=2, matchesPerWeek=3 → 6 rounds.
// All 15 pairs must appear (they all fit in the first 5 rounds).
const teams6  = ['A','B','C','D','E','F'];
const sched6  = generateSchedule(teams6, 2, 3);    // 6 rounds
const pairs6  = extractPairs(sched6);
const expect6 = expectedPairs(teams6);             // 15 pairs

assert(sched6.length >= 5, '6-team schedule has at least 5 rounds (to complete 1 cycle)');
assertEqual(sched6.length, 6, '6-team schedule has exactly 6 rounds (totalWeeks=2, mpw=3)');

for (const pair of expect6) {
  assert(pairs6.has(pair), `6-team schedule: pair "${pair}" appears at least once`);
}
assertEqual(pairs6.size, 15, '6-team schedule: exactly 15 unique pairs in 6 rounds');

// No self-play
let selfPlay6 = false;
for (const block of sched6) {
  for (const m of block.matchups) {
    if (m.homeTeamId === m.awayTeamId) selfPlay6 = true;
  }
}
assert(!selfPlay6, '6-team schedule: no team plays itself');

// Each round for 6 teams: 3 matchups (all 6 teams each appear once)
for (const block of sched6) {
  assertEqual(block.matchups.length, 3, `6-team round ${block.round}: exactly 3 matchups`);
  const seen = new Set();
  for (const m of block.matchups) { seen.add(m.homeTeamId); seen.add(m.awayTeamId); }
  assertEqual(seen.size, 6, `6-team round ${block.round}: all 6 teams present exactly once`);
}

// ── Round and Week numbering ────────────────────────────────────────────────
// With matchesPerWeek=3, week = ceil(round / 3)
const schedWk = generateSchedule(['X','Y','Z','W'], 3, 3);  // 9 rounds, 3 weeks
for (const block of schedWk) {
  const expectedWeek = Math.ceil(block.round / 3);
  assertEqual(block.week, expectedWeek, `Round ${block.round}: week === ${expectedWeek}`);
}

// ── Odd-number of teams: BYE slot adds, self-play still absent ──────────────
const teams5 = ['A','B','C','D','E'];  // 5 teams → even up to 6 with BYE
const sched5 = generateSchedule(teams5, 2, 3);

let selfPlay5 = false;
for (const block of sched5) {
  for (const m of block.matchups) {
    if (m.homeTeamId === 'BYE' || m.awayTeamId === 'BYE') selfPlay5 = true;
    if (m.homeTeamId === m.awayTeamId) selfPlay5 = true;
  }
}
assert(!selfPlay5, '5-team schedule: BYE is excluded from all matchups, no self-play');

// All actual 5-team pairs appear at least once in 2 cycles
const pairs5Real = extractPairs(sched5);
for (const pair of expectedPairs(teams5)) {
  assert(pairs5Real.has(pair), `5-team schedule: real pair "${pair}" appears`);
}

// ── generateSchedule error: fewer than 2 teams ──────────────────────────────
assertThrows(
  () => generateSchedule(['A'], 1, 1),
  'at least 2 teams',
  'generateSchedule with 1 team throws RangeError'
);
assertThrows(
  () => generateSchedule([], 1, 1),
  'at least 2 teams',
  'generateSchedule with 0 teams throws RangeError'
);
assertThrows(
  () => generateSchedule('ABC', 1, 1),
  'at least 2 teams',
  'generateSchedule with non-array throws RangeError'
);

// ── matchesPerWeek clamping in generateSchedule ──────────────────────────────
const schedClampHi = generateSchedule(TEAMS_4, 1, 99);  // clamped to 3 round/week → 3 total rounds
assertEqual(schedClampHi.length, 3, 'generateSchedule mpw=99 clamped to 3 → 3 rounds for 1 week');

const schedClampLo = generateSchedule(TEAMS_4, 2, 0);   // clamped to 1 mpw → 2 total rounds
assertEqual(schedClampLo.length, 2, 'generateSchedule mpw=0 clamped to 1 → 2 rounds for 2 weeks');

// ---------------------------------------------------------------------------
// GROUP 3: calculateStandings — correctness from known match results
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 3: calculateStandings');
console.log('========================================');

// Known match results:
//   Match 1: A (home, 105) beats B (away, 98)
//   Match 2: C (home, 90) loses to A (away, 110)
//   Match 3: B (home, 88) loses to C (away, 95)
//
// Expected record:
//   A: 2W 0L, ptsFor=215, ptsAgainst=188
//   C: 1W 1L, ptsFor=185, ptsAgainst=198
//   B: 0W 2L, ptsFor=186, ptsAgainst=200
//
// playerStats=[] → empty array → _computeFantasyFromMatchStats returns 0/0
// → fantasyPts = 0 for all teams → tiebreaker is point differential

const matchResults = [
  { homeTeamId: 'A', awayTeamId: 'B', homeScore: 105, awayScore: 98,  playerStats: [] },
  { homeTeamId: 'C', awayTeamId: 'A', homeScore: 90,  awayScore: 110, playerStats: [] },
  { homeTeamId: 'B', awayTeamId: 'C', homeScore: 88,  awayScore: 95,  playerStats: [] },
];

const standings = calculateStandings('season1', matchResults);

// Basic shape
assert(Array.isArray(standings), 'calculateStandings returns an array');
assertEqual(standings.length, 3, 'standings has 3 entries (exactly the teams that played)');

// Locate each team's entry
const entryA = standings.find(e => e.teamId === 'A');
const entryB = standings.find(e => e.teamId === 'B');
const entryC = standings.find(e => e.teamId === 'C');

assert(entryA !== undefined, 'Team A appears in standings');
assert(entryB !== undefined, 'Team B appears in standings');
assert(entryC !== undefined, 'Team C appears in standings');

// Team A: 2 wins, 0 losses
assertEqual(entryA.wins,          2,   'Team A: wins === 2');
assertEqual(entryA.losses,        0,   'Team A: losses === 0');
assertEqual(entryA.pointsFor,     215, 'Team A: pointsFor === 215 (105 + 110)');
assertEqual(entryA.pointsAgainst, 188, 'Team A: pointsAgainst === 188 (98 + 90)');

// Team B: 0 wins, 2 losses
assertEqual(entryB.wins,          0,   'Team B: wins === 0');
assertEqual(entryB.losses,        2,   'Team B: losses === 2');
assertEqual(entryB.pointsFor,     186, 'Team B: pointsFor === 186 (98 + 88)');
assertEqual(entryB.pointsAgainst, 200, 'Team B: pointsAgainst === 200 (105 + 95)');

// Team C: 1 win, 1 loss
assertEqual(entryC.wins,          1,   'Team C: wins === 1');
assertEqual(entryC.losses,        1,   'Team C: losses === 1');
assertEqual(entryC.pointsFor,     185, 'Team C: pointsFor === 185 (90 + 95)');
assertEqual(entryC.pointsAgainst, 198, 'Team C: pointsAgainst === 198 (110 + 88)');

// Sort order: A (2W) > C (1W, ptDiff=-13) > B (0W, ptDiff=-14)
assertEqual(standings[0].teamId, 'A', 'Standings position 1: Team A (2W)');
assertEqual(standings[1].teamId, 'C', 'Standings position 2: Team C (1W, ptDiff=-13)');
assertEqual(standings[2].teamId, 'B', 'Standings position 3: Team B (0W, ptDiff=-14)');

// Streak after win/loss sequence
// A: won game1, won game2 → streak W2
assertEqual(entryA.streak, 'W2', 'Team A streak === "W2"');
// B: lost game1, lost game3 → streak L2
assertEqual(entryB.streak, 'L2', 'Team B streak === "L2"');
// C: lost game2, won game3 → streak W1
assertEqual(entryC.streak, 'W1', 'Team C streak === "W1"');

// fantasyPts: playerStats=[] → empty Object.entries → 0 points each
assertEqual(entryA.fantasyPts, 0, 'Team A fantasyPts === 0 (empty playerStats arrays)');
assertEqual(entryB.fantasyPts, 0, 'Team B fantasyPts === 0');
assertEqual(entryC.fantasyPts, 0, 'Team C fantasyPts === 0');

// Internal tracking fields (_streakType, _streakCount) are cleaned from output
assert(!('_streakType'  in entryA), 'entryA: _streakType is not exposed in output');
assert(!('_streakCount' in entryA), 'entryA: _streakCount is not exposed in output');

// Fantasy points with real playerStats (object, not array)
const matchWithStats = [
  {
    homeTeamId: 'H',
    awayTeamId: 'V',
    homeScore:  110,
    awayScore:  95,
    playerStats: {
      // home player: 20pts, 10reb, 5ast, 2stl, 1blk, 1to
      // FP = 20*1 + 10*1.2 + 5*1.5 + 2*2 + 1*2 + 1*(-1) = 20+12+7.5+4+2-1 = 44.5
      'p1': { teamId: 'H', pts: 20, reb: 10, ast: 5, stl: 2, blk: 1, to: 1 },
      // away player: 30pts, 8reb, 0ast, 0stl, 0blk, 3to
      // FP = 30 + 9.6 + 0 + 0 + 0 - 3 = 36.6
      'p2': { teamId: 'V', pts: 30, reb: 8,  ast: 0, stl: 0, blk: 0, to: 3 },
    },
  },
];
const statsStandings = calculateStandings('s2', matchWithStats);
const homeEntry = statsStandings.find(e => e.teamId === 'H');
const awayEntry = statsStandings.find(e => e.teamId === 'V');
// homeFP = 44.5, awayFP = 36.6
assertEqual(homeEntry.fantasyPts, 44.5, 'Home fantasyPts === 44.5 from playerStats');
assertEqual(awayEntry.fantasyPts, 36.6, 'Away fantasyPts === 36.6 from playerStats');

// calculateStandings with empty array returns empty array
const emptyStandings = calculateStandings('s_empty', []);
assert(Array.isArray(emptyStandings) && emptyStandings.length === 0, 'calculateStandings([]) returns []');

// calculateStandings throws on non-array input
assertThrows(
  () => calculateStandings('s', null),
  'matchResults must be an array',
  'calculateStandings(null) throws TypeError'
);

// Tie (equal scores): 0.5W each
const tieMatch = [
  { homeTeamId: 'TieHome', awayTeamId: 'TieAway', homeScore: 100, awayScore: 100, playerStats: [] },
];
const tieStandings = calculateStandings('s_tie', tieMatch);
const tieHome = tieStandings.find(e => e.teamId === 'TieHome');
const tieAway = tieStandings.find(e => e.teamId === 'TieAway');
assertEqual(tieHome.wins,   0.5, 'Tie match: TieHome wins === 0.5');
assertEqual(tieHome.losses, 0.5, 'Tie match: TieHome losses === 0.5');
assertEqual(tieAway.wins,   0.5, 'Tie match: TieAway wins === 0.5');

// ---------------------------------------------------------------------------
// GROUP 4: advanceSeasonPhase
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 4: advanceSeasonPhase');
console.log('========================================');

// Start with a real season so dates and standings are populated
const baseSeason = createSeason('lgAdv', TEAMS_4, { startDate: EPOCH_START });

// draft → regular
const regularSeason = advanceSeasonPhase(baseSeason);
assertEqual(regularSeason.status, SEASON_PHASES.REGULAR, 'draft → regular: status === "regular"');
assert(regularSeason !== baseSeason, 'advanceSeasonPhase returns a new object (not mutating original)');
assertEqual(baseSeason.status, SEASON_PHASES.DRAFT, 'original season status unchanged after advance');
assert(typeof regularSeason.lastPhaseChange === 'string', 'lastPhaseChange is set after transition');

// regular → playoffs (triggering auto-bracket generation)
// Populate standings with wins so it has entries to build the bracket from
const regularWithStandings = {
  ...regularSeason,
  standings: [
    { teamId: 'teamA', wins: 5, losses: 1, pointsFor: 540, pointsAgainst: 480, fantasyPts: 0, streak: 'W3' },
    { teamId: 'teamB', wins: 4, losses: 2, pointsFor: 510, pointsAgainst: 495, fantasyPts: 0, streak: 'W2' },
    { teamId: 'teamC', wins: 3, losses: 3, pointsFor: 490, pointsAgainst: 500, fantasyPts: 0, streak: 'L1' },
    { teamId: 'teamD', wins: 1, losses: 5, pointsFor: 455, pointsAgainst: 520, fantasyPts: 0, streak: 'L4' },
  ],
};
const playoffSeason = advanceSeasonPhase(regularWithStandings);
assertEqual(playoffSeason.status, SEASON_PHASES.PLAYOFFS, 'regular → playoffs: status === "playoffs"');
// Bracket should have been generated
assert(playoffSeason.playoffBracket !== null, 'playoffs status triggers auto-bracket generation');
assert(playoffSeason.playoffBracket !== undefined, 'playoffBracket is not undefined');

// playoffs → offseason
const offseason = advanceSeasonPhase(playoffSeason);
assertEqual(offseason.status, SEASON_PHASES.OFFSEASON, 'playoffs → offseason: status === "offseason"');

// offseason → completed (isCompleted flag, status stays offseason)
const completed = advanceSeasonPhase(offseason);
assert(completed.isCompleted === true, 'offseason advance sets isCompleted === true');
assert(typeof completed.completedAt === 'string', 'completedAt is an ISO string');
// Status stays offseason (caller must create new season)
assertEqual(completed.status, SEASON_PHASES.OFFSEASON, 'offseason → completed: status remains "offseason"');

// advanceSeasonPhase throws on unknown phase
assertThrows(
  () => advanceSeasonPhase({ status: 'limbo', standings: [] }),
  'unknown phase',
  'advanceSeasonPhase with unknown phase throws'
);

// advanceSeasonPhase throws on non-object
assertThrows(
  () => advanceSeasonPhase(null),
  'season must be an object',
  'advanceSeasonPhase(null) throws TypeError'
);

// Re-advancing a regular-phase season that already has a bracket does NOT overwrite it
const preBuiltBracket = { dummy: true };
const seasonWithBracket = { ...regularWithStandings, playoffBracket: preBuiltBracket };
const playoffSeasonB = advanceSeasonPhase(seasonWithBracket);
assert(
  playoffSeasonB.playoffBracket === preBuiltBracket,
  'Existing playoffBracket is NOT overwritten on regular→playoffs transition'
);

// ---------------------------------------------------------------------------
// GROUP 5: generatePlayoffBracket
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 5: generatePlayoffBracket');
console.log('========================================');

const standingsFor4 = [
  { teamId: 'Seed1', wins: 10, losses: 2, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 },
  { teamId: 'Seed2', wins:  8, losses: 4, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 },
  { teamId: 'Seed3', wins:  6, losses: 6, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 },
  { teamId: 'Seed4', wins:  4, losses: 8, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 },
  { teamId: 'Seed5', wins:  2, losses:10, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 },
];

const bracket4 = generatePlayoffBracket('seasonXY', standingsFor4, 4);

// Top-level structure
assert(typeof bracket4.seasonId === 'string',  'bracket.seasonId is a string');
assertEqual(bracket4.bracketSize,   4,         'bracket4.bracketSize === 4');
assertEqual(bracket4.totalRounds,   2,         'bracket4.totalRounds === log2(4) === 2');
assert(Array.isArray(bracket4.qualifiers),     'bracket.qualifiers is an array');
assertEqual(bracket4.qualifiers.length, 4,     'bracket.qualifiers has 4 entries');
assert(Array.isArray(bracket4.rounds),         'bracket.rounds is an array');
assertEqual(bracket4.rounds.length, 2,         'bracket.rounds has 2 elements (round1 + final)');
assert(bracket4.champion === null,             'bracket.champion === null at creation');

// Seed assignments
assertEqual(bracket4.qualifiers[0].seed,   1, 'qualifiers[0].seed === 1 (top seed)');
assertEqual(bracket4.qualifiers[0].teamId, 'Seed1', 'qualifiers[0].teamId === Seed1');
assertEqual(bracket4.qualifiers[3].seed,   4, 'qualifiers[3].seed === 4 (4th seed)');
assertEqual(bracket4.qualifiers[3].teamId, 'Seed4', 'qualifiers[3].teamId === Seed4');

// First round matchups: 1v4 and 2v3
const firstRound = bracket4.rounds[0];
assertEqual(firstRound.length, 2, 'First round has 2 matchups');

// Matchup 1: seed 1 (home) vs seed 4 (away)
assertEqual(firstRound[0].homeTeamId,   'Seed1', 'First round matchup 1: Seed1 is home (higher seed, home-court)');
assertEqual(firstRound[0].awayTeamId,   'Seed4', 'First round matchup 1: Seed4 is away');
assertEqual(firstRound[0].highSeed,     1,        'First round matchup 1: highSeed === 1');
assertEqual(firstRound[0].lowSeed,      4,        'First round matchup 1: lowSeed === 4');
assertEqual(firstRound[0].homeTeamSeed, 1,        'First round matchup 1: homeTeamSeed === 1');
assertEqual(firstRound[0].awayTeamSeed, 4,        'First round matchup 1: awayTeamSeed === 4');
assertEqual(firstRound[0].status,       'scheduled', 'First round matchup 1: status === "scheduled"');
assertEqual(firstRound[0].winner,       null,     'First round matchup 1: winner === null');

// Matchup 2: seed 2 (home) vs seed 3 (away)
assertEqual(firstRound[1].homeTeamId,   'Seed2', 'First round matchup 2: Seed2 is home');
assertEqual(firstRound[1].awayTeamId,   'Seed3', 'First round matchup 2: Seed3 is away');
assertEqual(firstRound[1].highSeed,     2,        'First round matchup 2: highSeed === 2');
assertEqual(firstRound[1].lowSeed,      3,        'First round matchup 2: lowSeed === 3');

// Final round (round 2): 1 TBD matchup
const finalRound = bracket4.rounds[1];
assertEqual(finalRound.length, 1, 'Final round has 1 matchup');
assertEqual(finalRound[0].round,      2,         'Final matchup round === 2');
assertEqual(finalRound[0].homeTeamId, null,      'Final matchup homeTeamId === null (TBD)');
assertEqual(finalRound[0].awayTeamId, null,      'Final matchup awayTeamId === null (TBD)');
assertEqual(finalRound[0].status,     'pending', 'Final matchup status === "pending"');

// All bracket matchup IDs are unique non-empty strings
const bracketIds = [];
for (const round of bracket4.rounds) {
  for (const m of round) {
    assert(typeof m.id === 'string' && m.id.length > 0, `Bracket matchup id "${m.id}" is non-empty string`);
    bracketIds.push(m.id);
  }
}
const uniqueBracketIds = new Set(bracketIds);
assertEqual(uniqueBracketIds.size, bracketIds.length, 'All bracket matchup IDs are unique');

// 8-team bracket
const standings8 = Array.from({ length: 8 }, (_, i) => ({
  teamId: `T${i+1}`, wins: 8-i, losses: i, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0,
}));
const bracket8 = generatePlayoffBracket('s8', standings8, 8);
assertEqual(bracket8.bracketSize,  8, 'bracket8.bracketSize === 8');
assertEqual(bracket8.totalRounds,  3, 'bracket8.totalRounds === log2(8) === 3');
assertEqual(bracket8.rounds[0].length, 4, 'bracket8: first round has 4 matchups');
assertEqual(bracket8.rounds[1].length, 2, 'bracket8: semi-final has 2 matchups');
assertEqual(bracket8.rounds[2].length, 1, 'bracket8: final has 1 matchup');

// 8-team first round matchups: (1v8), (2v7), (3v6), (4v5)
const fr8 = bracket8.rounds[0];
assertEqual(fr8[0].highSeed, 1, 'bracket8 matchup[0]: highSeed=1');
assertEqual(fr8[0].lowSeed,  8, 'bracket8 matchup[0]: lowSeed=8');
assertEqual(fr8[1].highSeed, 2, 'bracket8 matchup[1]: highSeed=2');
assertEqual(fr8[1].lowSeed,  7, 'bracket8 matchup[1]: lowSeed=7');
assertEqual(fr8[2].highSeed, 3, 'bracket8 matchup[2]: highSeed=3');
assertEqual(fr8[2].lowSeed,  6, 'bracket8 matchup[2]: lowSeed=6');
assertEqual(fr8[3].highSeed, 4, 'bracket8 matchup[3]: highSeed=4');
assertEqual(fr8[3].lowSeed,  5, 'bracket8 matchup[3]: lowSeed=5');

// generatePlayoffBracket throws for < 2 standings entries
assertThrows(
  () => generatePlayoffBracket('s', [{ teamId: 'only', wins: 0 }], 4),
  'at least 2 teams',
  'generatePlayoffBracket with 1 team throws RangeError'
);
assertThrows(
  () => generatePlayoffBracket('s', null, 4),
  'at least 2 teams',
  'generatePlayoffBracket with null throws RangeError'
);

// getLeagueChampion returns null when no winner set
assertEqual(getLeagueChampion(bracket4.rounds), null, 'getLeagueChampion with no winners === null');

// getLeagueChampion returns winner from final
const completedRounds = [
  [{ winner: 'Seed1', homeTeamId: 'Seed1', awayTeamId: 'Seed4', homeTeamSeed: 1, awayTeamSeed: 4 }],
  [{ winner: 'Seed1', homeTeamId: 'Seed1', awayTeamId: 'Seed2', homeTeamSeed: 1, awayTeamSeed: 2 }],
];
const champion = getLeagueChampion(completedRounds);
assertEqual(champion.teamId, 'Seed1', 'getLeagueChampion returns Seed1');
assertEqual(champion.seed,   1,       'getLeagueChampion seed === 1');

// ---------------------------------------------------------------------------
// GROUP 6: isTradeDeadlinePassed
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 6: isTradeDeadlinePassed');
console.log('========================================');

// Use startDate=epoch to get deterministic dates.
// regularSeasonStart = epoch + 3 days
// tradeDeadline      = regularSeasonStart + 10 days = epoch + 13 days
const deadlineSeason = createSeason('lgDL', TEAMS_4, { startDate: EPOCH_START });

const regularStartMs_dl  = epochMs + 3 * ONE_DAY_MS;    // 3 days from epoch
const tradeDeadlineMs_dl = regularStartMs_dl + 10 * ONE_DAY_MS;  // epoch + 13 days

// Verify the season's tradeDeadline date is epoch + 13 days
assertEqual(
  new Date(deadlineSeason.dates.tradeDeadline).getTime(),
  tradeDeadlineMs_dl,
  'Trade deadline is exactly regularSeasonStart + 10 days'
);

// Day 9 of regular season = regularSeasonStart + 9 days < tradeDeadline → false
const day9 = new Date(regularStartMs_dl + 9 * ONE_DAY_MS);
assertEqual(
  isTradeDeadlinePassed(deadlineSeason, day9),
  false,
  'Day 9 of regular season: trade deadline NOT yet passed'
);

// Day 10 of regular season = regularSeasonStart + 10 days = tradeDeadline → true (>=)
const day10 = new Date(regularStartMs_dl + 10 * ONE_DAY_MS);
assertEqual(
  isTradeDeadlinePassed(deadlineSeason, day10),
  true,
  'Day 10 of regular season: trade deadline HAS passed (exactly on deadline)'
);

// Day 11 of regular season = regularSeasonStart + 11 days > tradeDeadline → true
const day11 = new Date(regularStartMs_dl + 11 * ONE_DAY_MS);
assertEqual(
  isTradeDeadlinePassed(deadlineSeason, day11),
  true,
  'Day 11 of regular season: trade deadline HAS passed'
);

// The moment just before the deadline (1 ms before) → false
const justBefore = new Date(tradeDeadlineMs_dl - 1);
assertEqual(
  isTradeDeadlinePassed(deadlineSeason, justBefore),
  false,
  'One millisecond before deadline: NOT passed'
);

// Exactly at the deadline (==) → true
const exactDeadline = new Date(tradeDeadlineMs_dl);
assertEqual(
  isTradeDeadlinePassed(deadlineSeason, exactDeadline),
  true,
  'Exactly at the deadline timestamp: IS passed'
);

// Null/missing season returns false
assertEqual(isTradeDeadlinePassed(null,      new Date()), false, 'null season returns false');
assertEqual(isTradeDeadlinePassed(undefined, new Date()), false, 'undefined season returns false');
assertEqual(isTradeDeadlinePassed({},        new Date()), false, 'empty object season returns false');

// ---------------------------------------------------------------------------
// GROUP 7: sortStandings + getPlayoffTeams
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 7: sortStandings + getPlayoffTeams');
console.log('========================================');

// Build unsorted standings with various tie scenarios
const rawStandings = [
  { teamId: 'D', wins: 3, losses: 3, pointsFor: 310, pointsAgainst: 300, fantasyPts:  50, streak: 'W1' },
  { teamId: 'A', wins: 5, losses: 1, pointsFor: 580, pointsAgainst: 500, fantasyPts: 100, streak: 'W3' },
  { teamId: 'C', wins: 3, losses: 3, pointsFor: 295, pointsAgainst: 295, fantasyPts:  80, streak: 'L1' },
  { teamId: 'E', wins: 3, losses: 3, pointsFor: 295, pointsAgainst: 295, fantasyPts:  80, streak: 'W2' },
  { teamId: 'B', wins: 4, losses: 2, pointsFor: 550, pointsAgainst: 510, fantasyPts:  90, streak: 'W2' },
  { teamId: 'F', wins: 1, losses: 5, pointsFor: 420, pointsAgainst: 500, fantasyPts:  20, streak: 'L3' },
];

const sorted = sortStandings(rawStandings);
assert(Array.isArray(sorted), 'sortStandings returns an array');
assertEqual(sorted.length, 6, 'sortStandings preserves all 6 entries');

// Primary sort: wins descending
assertEqual(sorted[0].teamId, 'A', 'sortStandings: position 1 is A (5W)');
assertEqual(sorted[1].teamId, 'B', 'sortStandings: position 2 is B (4W)');

// 3-way tie at 3W: C and E tie on wins AND fantasyPts (both 80)
// C: ptDiff = 295-295 = 0;  E: ptDiff = 295-295 = 0 (tied on diff too)
// C and E have equal wins, fantasyPts, AND ptDiff → final tiebreaker = pointsFor (both 295, still tied)
// D: ptDiff = 310-300 = +10 → D beats both C and E in ptDiff
assert(sorted[2].teamId === 'D', 'sortStandings: position 3 is D (3W, ptDiff=+10)');

// C and E are tied on all criteria — they should both be at positions 4 and 5
const pos4and5 = new Set([sorted[3].teamId, sorted[4].teamId]);
assert(pos4and5.has('C') && pos4and5.has('E'), 'sortStandings: positions 4&5 are C and E (equal on all counts)');

// Last place: F (1W)
assertEqual(sorted[5].teamId, 'F', 'sortStandings: position 6 is F (1W)');

// sortStandings does NOT mutate the original array
assert(rawStandings[0].teamId === 'D', 'sortStandings does not mutate original array (rawStandings[0] still D)');

// sortStandings with empty array
const emptySort = sortStandings([]);
assert(Array.isArray(emptySort) && emptySort.length === 0, 'sortStandings([]) returns []');

// sortStandings with non-array returns []
const badSort = sortStandings(null);
assert(Array.isArray(badSort) && badSort.length === 0, 'sortStandings(null) returns []');

// Tiebreaker on fantasyPts: equal wins, different fantasyPts
const fpTie = [
  { teamId: 'LowFP',  wins: 4, losses: 2, pointsFor: 500, pointsAgainst: 500, fantasyPts: 30 },
  { teamId: 'HighFP', wins: 4, losses: 2, pointsFor: 500, pointsAgainst: 500, fantasyPts: 60 },
];
const fpSorted = sortStandings(fpTie);
assertEqual(fpSorted[0].teamId, 'HighFP', 'fantasyPts tiebreaker: HighFP (60) over LowFP (30)');
assertEqual(fpSorted[1].teamId, 'LowFP',  'fantasyPts tiebreaker: LowFP is second');

// Tiebreaker on point differential: equal wins and fantasyPts
const ptDiffTie = [
  { teamId: 'BadDiff',  wins: 3, losses: 3, pointsFor: 300, pointsAgainst: 320, fantasyPts: 50 },
  { teamId: 'GoodDiff', wins: 3, losses: 3, pointsFor: 320, pointsAgainst: 300, fantasyPts: 50 },
];
const ptDiffSorted = sortStandings(ptDiffTie);
assertEqual(ptDiffSorted[0].teamId, 'GoodDiff', 'ptDiff tiebreaker: GoodDiff (+20) over BadDiff (-20)');

// getPlayoffTeams: returns top 4
const playoffTeams = getPlayoffTeams(sorted, 4);
assert(Array.isArray(playoffTeams), 'getPlayoffTeams returns an array');
assertEqual(playoffTeams.length, 4, 'getPlayoffTeams returns 4 teams');
assertEqual(playoffTeams[0].teamId, 'A', 'getPlayoffTeams[0] is A (1st seed)');
assertEqual(playoffTeams[1].teamId, 'B', 'getPlayoffTeams[1] is B (2nd seed)');
assertEqual(playoffTeams[2].teamId, 'D', 'getPlayoffTeams[2] is D (3rd seed)');
// 4th seed is C or E (tied) — just verify it's one of them
assert(['C','E'].includes(playoffTeams[3].teamId), 'getPlayoffTeams[3] is C or E (4th seed)');

// getPlayoffTeams with count=2 (enforces minimum of 2 via Math.max(2, count))
const top2 = getPlayoffTeams(sorted, 2);
assertEqual(top2.length, 2, 'getPlayoffTeams(sorted, 2) returns exactly 2 teams');
assertEqual(top2[0].teamId, 'A', 'getPlayoffTeams top2[0] is A');

// getPlayoffTeams with count=1 returns 2 (minimum enforced by Math.max(2, count))
const top1enforced = getPlayoffTeams(sorted, 1);
assertEqual(top1enforced.length, 2, 'getPlayoffTeams(sorted, 1) returns 2 (minimum enforced)');

// getPlayoffTeams with non-array returns []
assertEqual(getPlayoffTeams(null, 4).length, 0, 'getPlayoffTeams(null, 4) returns []');

// ---------------------------------------------------------------------------
// GROUP 8: Fixture integrity — 8-team 14-day season
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 8: Fixture Integrity — 8-team 14-day season');
console.log('========================================');

//
// Default season config:
//   phaseDurations.regular = 14 days
//   totalWeeks = Math.ceil(14/7) = 2
//   matchesPerWeek = 3 (default)
//   totalRounds = 2 × 3 = 6
//
// For 8 teams (N=8, even), roundsPerCycle = 7, matchups_per_round = 4.
// With 6 rounds (< 1 full cycle), each team plays exactly 6 games.
// Point differential: 6 rounds × 4 matchups × 2 team appearances / 8 teams = 6 games each.
//
// NOTE: The spec (§6.9) targets ~18 games/team over 14 real-world days.
// The current implementation with matchesPerWeek=3 and 2-week regular season yields 6 rounds
// and thus 6 games per team — not 18. A full round-robin for 8 teams requires 7 rounds;
// covering 18 games per team would need approximately 18 rounds (3 × matchesPerWeek).
// The test validates the code's actual behaviour, not the aspirational target.
//

const season8Fix = createSeason('lgFix', TEAMS_8, {
  startDate: EPOCH_START,
  // Default matchesPerWeek=3, regular=14 days → 2 weeks → 6 rounds
});

assert(Array.isArray(season8Fix.schedule), 'season8Fix.schedule is an array');
assert(season8Fix.schedule.length > 0,     'season8Fix.schedule is non-empty');

// Count total rounds
const totalRounds8 = season8Fix.schedule.length;
// totalWeeks=2, matchesPerWeek=3 → 6 rounds
assertEqual(totalRounds8, 6, 'season8Fix: exactly 6 rounds (2 weeks × 3 mpw)');

// Count games per team
const gamesPerTeam = {};
for (const t of TEAMS_8) gamesPerTeam[t] = 0;

for (const block of season8Fix.schedule) {
  for (const m of block.matchups) {
    gamesPerTeam[m.homeTeamId]++;
    gamesPerTeam[m.awayTeamId]++;
  }
}

// Every team should play exactly 6 games (one per round, 6 rounds)
for (const t of TEAMS_8) {
  assertEqual(gamesPerTeam[t], 6, `${t} plays exactly 6 games (6 rounds × 1 game/round)`);
}

// No week has more than 3 games per team (matchesPerWeek=3 caps it)
const weekGamesPerTeam = {};
for (const block of season8Fix.schedule) {
  const week = block.week;
  if (!weekGamesPerTeam[week]) {
    weekGamesPerTeam[week] = {};
    for (const t of TEAMS_8) weekGamesPerTeam[week][t] = 0;
  }
  for (const m of block.matchups) {
    weekGamesPerTeam[week][m.homeTeamId]++;
    weekGamesPerTeam[week][m.awayTeamId]++;
  }
}

let weekCapViolation = false;
for (const [week, counts] of Object.entries(weekGamesPerTeam)) {
  for (const [team, count] of Object.entries(counts)) {
    if (count > 3) {
      weekCapViolation = true;
      console.log(`    ❌ Week ${week}: ${team} plays ${count} games (> 3)`);
    }
  }
}
assert(!weekCapViolation, 'No team plays more than 3 games in any single week');

// Verify exactly 2 weeks
const weeks8 = new Set(season8Fix.schedule.map(b => b.week));
assertEqual(weeks8.size, 2, 'season8Fix schedule spans exactly 2 weeks');
assert(weeks8.has(1) && weeks8.has(2), 'Weeks 1 and 2 are both present');

// Each round: exactly 4 matchups (8/2 = 4 pairs per round)
for (const block of season8Fix.schedule) {
  assertEqual(block.matchups.length, 4, `Round ${block.round}: exactly 4 matchups (8 teams / 2)`);
}

// No two matchups in the same round involve the same team (each team plays once per round)
for (const block of season8Fix.schedule) {
  const seenInRound = new Set();
  let doubleBooked = false;
  for (const m of block.matchups) {
    if (seenInRound.has(m.homeTeamId) || seenInRound.has(m.awayTeamId)) {
      doubleBooked = true;
    }
    seenInRound.add(m.homeTeamId);
    seenInRound.add(m.awayTeamId);
  }
  assert(!doubleBooked, `Round ${block.round}: no team is double-booked`);
}

// All matchup participants are from TEAMS_8
let unknownTeam8 = false;
for (const block of season8Fix.schedule) {
  for (const m of block.matchups) {
    if (!TEAMS_8.includes(m.homeTeamId) || !TEAMS_8.includes(m.awayTeamId)) {
      unknownTeam8 = true;
    }
  }
}
assert(!unknownTeam8, 'All matchup participants are valid team IDs from TEAMS_8');

// No self-play
let selfPlay8 = false;
for (const block of season8Fix.schedule) {
  for (const m of block.matchups) {
    if (m.homeTeamId === m.awayTeamId) selfPlay8 = true;
  }
}
assert(!selfPlay8, 'No team plays itself in the 8-team season');

// matchDate / weekStartDate is set on each block after createSeason
for (const block of season8Fix.schedule) {
  const dateStr = block.matchDate || block.weekStartDate;
  assert(typeof dateStr === 'string' && dateStr.length > 0, `Round ${block.round}: matchDate or weekStartDate is set`);
  // Date should be within the regular season window
  const ms = new Date(dateStr).getTime();
  assert(
    ms >= regularStartMs && ms < playoffsStartMs,
    `Round ${block.round}: matchDate (${dateStr}) is within the regular season window`
  );
}

// Additional: getWeekNumber returns correct week
const inWeek1 = new Date(regularStartMs + 3 * ONE_DAY_MS);   // 3 days into regular season → week 1
const inWeek2 = new Date(regularStartMs + 10 * ONE_DAY_MS);  // 10 days in → week 2
assertEqual(getWeekNumber(season8Fix, inWeek1), 1, 'getWeekNumber: 3 days into regular season → week 1');
assertEqual(getWeekNumber(season8Fix, inWeek2), 2, 'getWeekNumber: 10 days into regular season → week 2');

// Before regular season → week 0
const preRegular = new Date(regularStartMs - ONE_DAY_MS);
assertEqual(getWeekNumber(season8Fix, preRegular), 0, 'getWeekNumber: before regular season → 0');

// getNextMatchDay returns a Date for the first scheduled block
const nextDay = getNextMatchDay(season8Fix);
assert(nextDay instanceof Date, 'getNextMatchDay returns a Date object');

// After marking all matchups as completed, getNextMatchDay should return null
const completedSchedule = season8Fix.schedule.map(block => ({
  ...block,
  matchups: block.matchups.map(m => ({ ...m, status: 'completed' })),
}));
const completedSeason8 = { ...season8Fix, schedule: completedSchedule };
assertEqual(getNextMatchDay(completedSeason8), null, 'getNextMatchDay returns null when all matchups are completed');

// getNextMatchDay with null season returns null
assertEqual(getNextMatchDay(null), null, 'getNextMatchDay(null) returns null');

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log(`Result: ✅ ${passCount} passed, ❌ ${failCount} failed`);
console.log('========================================');

if (failCount > 0) process.exit(1);
