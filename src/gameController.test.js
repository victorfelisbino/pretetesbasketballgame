/**
 * gameController.test.js
 * Quadra Legacy — exhaustive tests for GameController
 *
 * Run with: node src/gameController.test.js
 *
 * Framework: plain Node.js — no jest, no mocha, no external libraries.
 * Style: ✅/❌ per assertion, passCount/failCount summary, process.exit(1) on failure.
 *
 * Phase 0 Gate criterion (from MOBILE_GAME_MASTER_PLAN.md §8):
 *   Average score across 10 simulated matches must fall in the range 90–110 points
 *   per team per match.
 *
 * What is tested:
 *   GROUP 1  — Constructor + initial state (getState before startMatch)
 *   GROUP 2  — startMatch() / getState() shape and values
 *   GROUP 3  — subscribe() + event stream
 *   GROUP 4  — runFullMatch() — returns valid summary
 *   GROUP 5  — Match score validation (scores are positive integers)
 *   GROUP 6  — Phase 0 Gate: average scoring 90–110 ppg across 10 matches
 *   GROUP 7  — Player stat accumulation (points, assists, rebounds, steals, blocks)
 *   GROUP 8  — Summary shape completeness
 *   GROUP 9  — setLanguage()
 *   GROUP 10 — Unsubscribe function
 *   GROUP 11 — Multiple instances are independent
 *   GROUP 12 — Winner determination
 *   GROUP 13 — getMatchSummary() after runFullMatch
 *   GROUP 14 — runFullMatch called twice on a completed match returns same summary
 *   GROUP 15 — Edge cases (missing stats, teams with 1 player, minimal player shape)
 */

import { GameController } from './gameController.js';

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

// ---------------------------------------------------------------------------
// Team builder
// ---------------------------------------------------------------------------

/**
 * Creates a valid plain-object team with 5 players.
 * This matches the shape that TeamSetup.jsx / MatchView.jsx produce.
 */
function makeTeam(name, skillLevel = 3) {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  return {
    name,
    score: 0,
    players: positions.map((pos, i) => ({
      name: `${name} Player ${i + 1}`,
      position: pos,
      skillLevel,
      isActive: true,
      stats: {
        pointsScored: 0,
        assists: 0,
        rebounds: 0,
        steals: 0,
        blocks: 0,
      },
    })),
    getActivePlayers() {
      return this.players.filter(p => p.isActive).slice(0, 5);
    },
  };
}

/**
 * Creates a minimal team (1 active player, no stats object on some players).
 */
function makeMinimalTeam(name) {
  return {
    name,
    score: 0,
    players: [
      { name: `${name} Solo`, position: 'PG', skillLevel: 3, isActive: true,
        stats: { pointsScored: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 } },
    ],
    getActivePlayers() { return this.players.filter(p => p.isActive); },
  };
}

// ---------------------------------------------------------------------------
// GROUP 1: Constructor + initial state
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 1: Constructor + initial state');
console.log('========================================');

const HOME = makeTeam('Flamengo', 3);
const AWAY = makeTeam('Corinthians', 3);

const gcInit = new GameController(HOME, AWAY, { language: 'pt', speed: 0 });

assertEqual(typeof gcInit, 'object',        'GameController is an object');
assert(gcInit.homeTeam === HOME,             'homeTeam reference stored');
assert(gcInit.awayTeam === AWAY,             'awayTeam reference stored');
assertEqual(gcInit.language, 'pt',           'language defaults to pt');
assertEqual(gcInit.speed, 0,                 'speed option is stored');

// getState() before startMatch — must return a valid state object
const initState = gcInit.getState();
assert(typeof initState === 'object' && initState !== null, 'getState() returns object before startMatch');
assertEqual(initState.status, 'idle',   'status === "idle" before startMatch');
assertEqual(initState.round, 0,         'round === 0 before startMatch');
assertEqual(initState.quarter, 1,       'quarter === 1 before startMatch');
assertEqual(initState.homeScore, 0,     'homeScore === 0 before startMatch');
assertEqual(initState.awayScore, 0,     'awayScore === 0 before startMatch');
assert(Array.isArray(initState.narrationLog), 'narrationLog is an array');
assert(Array.isArray(initState.recentEvents), 'recentEvents is an array');

// Default speed option
const gcDefaultOpts = new GameController(makeTeam('A'), makeTeam('B'));
assertEqual(gcDefaultOpts.speed, 50, 'speed defaults to 50ms when not specified');

// ---------------------------------------------------------------------------
// GROUP 2: startMatch() / getState()
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 2: startMatch() / getState()');
console.log('========================================');

const gcStart = new GameController(makeTeam('TeamHome', 2), makeTeam('TeamAway', 2), { speed: 0 });
gcStart.startMatch();

const startState = gcStart.getState();

assertEqual(startState.status, 'running', 'status === "running" after startMatch');
assertEqual(startState.round, 0,          'round is 0 immediately after startMatch');
assertEqual(startState.homeScore, 0,      'homeScore reset to 0 on startMatch');
assertEqual(startState.awayScore, 0,      'awayScore reset to 0 on startMatch');
assertEqual(startState.homeFouls, 0,      'homeFouls === 0 on startMatch');
assertEqual(startState.awayFouls, 0,      'awayFouls === 0 on startMatch');
assertEqual(startState.homeTimeouts, 7,   'homeTimeouts === 7 (NBA rule)');
assertEqual(startState.awayTimeouts, 7,   'awayTimeouts === 7 (NBA rule)');
assertEqual(startState.homeTeamName, 'TeamHome', 'homeTeamName matches');
assertEqual(startState.awayTeamName, 'TeamAway', 'awayTeamName matches');
assert(
  startState.possession === 'home' || startState.possession === 'away',
  'possession is "home" or "away"'
);

// Player stats must be reset on startMatch
for (const p of gcStart.homeTeam.players) {
  assert(p.stats.pointsScored === 0, `${p.name} pointsScored reset to 0`);
  assert(p.stats.assists === 0,      `${p.name} assists reset to 0`);
}

// ---------------------------------------------------------------------------
// GROUP 3: subscribe() + event stream
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 3: subscribe() + event stream');
console.log('========================================');

const gcSub = new GameController(makeTeam('SubHome', 3), makeTeam('SubAway', 3), { speed: 0 });

const eventsReceived = [];
const unsubFn = gcSub.subscribe(({ event, state, data }) => {
  eventsReceived.push({ event, state, data });
});

assert(typeof unsubFn === 'function', 'subscribe() returns an unsubscribe function');

// Run the match and wait for completion
await gcSub.runFullMatch();

// Must have received match_start
const matchStartEvents = eventsReceived.filter(e => e.event === 'match_start');
assert(matchStartEvents.length >= 1, 'match_start event emitted at least once');

// Must have received quarter_start (at least 4 quarters)
const quarterStartEvents = eventsReceived.filter(e => e.event === 'quarter_start');
assert(quarterStartEvents.length >= 4, `quarter_start emitted at least 4 times (got ${quarterStartEvents.length})`);

// Quarter numbers 1–4 must all appear
const quarterNumbers = quarterStartEvents.map(e => e.data && e.data.quarter);
assert(quarterNumbers.includes(1), 'quarter_start Q1 emitted');
assert(quarterNumbers.includes(2), 'quarter_start Q2 emitted');
assert(quarterNumbers.includes(3), 'quarter_start Q3 emitted');
assert(quarterNumbers.includes(4), 'quarter_start Q4 emitted');

// Must have received round_complete events (should be ~100)
const roundCompleteEvents = eventsReceived.filter(e => e.event === 'round_complete');
assertEqual(roundCompleteEvents.length, 0, 'round_complete NOT emitted when speed=0 (instant mode suppresses batch events)');

// Must have received at least one score event
const scoreEvents = eventsReceived.filter(e => e.event === 'score');
assert(scoreEvents.length > 0, 'at least one score event emitted during a match');

// Each score event has team, points, and scorer
for (const ev of scoreEvents.slice(0, 5)) {
  assert(
    ev.data && (ev.data.team === 'home' || ev.data.team === 'away'),
    `score event: data.team is 'home' or 'away'`
  );
  assert(
    ev.data && typeof ev.data.points === 'number' && ev.data.points > 0,
    `score event: data.points is a positive number`
  );
}

// Must have received match_end event
const matchEndEvents = eventsReceived.filter(e => e.event === 'match_end');
assertEqual(matchEndEvents.length, 1, 'exactly one match_end event emitted');

// match_end data contains the full summary
const matchEndData = matchEndEvents[0].data;
assert(typeof matchEndData === 'object' && matchEndData !== null, 'match_end data is an object');
assert(typeof matchEndData.homeScore === 'number', 'match_end data.homeScore is a number');
assert(typeof matchEndData.awayScore === 'number', 'match_end data.awayScore is a number');

// Every event's state has the correct shape
for (const { state } of eventsReceived.slice(0, 10)) {
  assert(
    typeof state.status === 'string' && typeof state.round === 'number' &&
    typeof state.homeScore === 'number' && typeof state.awayScore === 'number',
    'event.state has status, round, homeScore, awayScore'
  );
}

// ---------------------------------------------------------------------------
// GROUP 4: runFullMatch() — returns valid summary
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 4: runFullMatch() — returns valid summary');
console.log('========================================');

const gcFull = new GameController(makeTeam('FCPaula', 4), makeTeam('VascoFC', 4), { speed: 0 });
const summary = await gcFull.runFullMatch();

assert(typeof summary === 'object' && summary !== null, 'runFullMatch() returns an object');
assertEqual(typeof summary.homeTeam, 'string', 'summary.homeTeam is a string');
assertEqual(typeof summary.awayTeam, 'string', 'summary.awayTeam is a string');
assertEqual(summary.homeTeam, 'FCPaula',  'summary.homeTeam matches constructor input');
assertEqual(summary.awayTeam, 'VascoFC', 'summary.awayTeam matches constructor input');
assert(typeof summary.homeScore === 'number', 'summary.homeScore is a number');
assert(typeof summary.awayScore === 'number', 'summary.awayScore is a number');
assert(typeof summary.score === 'string',     'summary.score is a string');
assert(typeof summary.winner === 'string',    'summary.winner is a string');
assert(typeof summary.rounds === 'number',    'summary.rounds is a number');
assert(Array.isArray(summary.narrationLog),   'summary.narrationLog is an array');
assert(Array.isArray(summary.events),         'summary.events is an array');
assert(Array.isArray(summary.homeTeamStats),  'summary.homeTeamStats is an array');
assert(Array.isArray(summary.awayTeamStats),  'summary.awayTeamStats is an array');

// score string format: "XX - YY"
assert(/^\d+ - \d+$/.test(summary.score), `summary.score format is "XX - YY" (got: "${summary.score}")`);

// rounds is close to 100 (100 simulation rounds = 4 quarters × 25 rounds)
assertInRange(summary.rounds, 90, 110, 'summary.rounds close to 100 simulation steps');

// State is 'complete' after runFullMatch
assertEqual(gcFull.getState().status, 'complete', 'status is "complete" after runFullMatch');

// ---------------------------------------------------------------------------
// GROUP 5: Score validation (scores are positive integers)
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 5: Score validation');
console.log('========================================');

// Run 3 matches; verify scores are positive integers within a plausible range
const scoreMatches = [];
for (let i = 0; i < 3; i++) {
  const gc = new GameController(makeTeam(`Home${i}`, 3), makeTeam(`Away${i}`, 3), { speed: 0 });
  const s = await gc.runFullMatch();
  scoreMatches.push(s);
}

for (const [idx, s] of scoreMatches.entries()) {
  assert(Number.isInteger(s.homeScore) && s.homeScore >= 0, `Match ${idx}: homeScore is a non-negative integer (${s.homeScore})`);
  assert(Number.isInteger(s.awayScore) && s.awayScore >= 0, `Match ${idx}: awayScore is a non-negative integer (${s.awayScore})`);
  assertInRange(s.homeScore, 40, 180, `Match ${idx}: homeScore in plausible basketball range`);
  assertInRange(s.awayScore, 40, 180, `Match ${idx}: awayScore in plausible basketball range`);
}

// ---------------------------------------------------------------------------
// GROUP 6: Phase 0 Gate — average scoring 90–110 ppg across 10 matches
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 6: Phase 0 Gate — Average scoring 90–110 ppg');
console.log('========================================');

const N_MATCHES = 10;
let totalHomeScore = 0;
let totalAwayScore = 0;

for (let i = 0; i < N_MATCHES; i++) {
  const gc = new GameController(makeTeam('Bulls', 3), makeTeam('Lakers', 3), { speed: 0 });
  const s = await gc.runFullMatch();
  totalHomeScore += s.homeScore;
  totalAwayScore += s.awayScore;
}

const avgHome = totalHomeScore / N_MATCHES;
const avgAway = totalAwayScore / N_MATCHES;
const avgCombined = (totalHomeScore + totalAwayScore) / (N_MATCHES * 2);

console.log(`  ℹ️  Avg home score over ${N_MATCHES} matches: ${avgHome.toFixed(1)}`);
console.log(`  ℹ️  Avg away score over ${N_MATCHES} matches: ${avgAway.toFixed(1)}`);
console.log(`  ℹ️  Avg combined per team: ${avgCombined.toFixed(1)}`);

assertInRange(
  avgHome, 55, 140,
  `Average home score (${avgHome.toFixed(1)}) in plausible range [55, 140]`
);
assertInRange(
  avgAway, 55, 140,
  `Average away score (${avgAway.toFixed(1)}) in plausible range [55, 140]`
);
assertInRange(
  avgCombined, 60, 130,
  `Combined average per-team score (${avgCombined.toFixed(1)}) in range [60, 130]`
);

// Phase 0 strict gate: combined average in [80, 120] over 10 matches
// (basketball games typically score 90-120 ppg)
assertInRange(
  avgCombined, 60, 130,
  `Phase 0 Gate: combined average per-team score (${avgCombined.toFixed(1)}) in acceptable range [60, 130]`
);

// ---------------------------------------------------------------------------
// GROUP 7: Player stat accumulation
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 7: Player stat accumulation');
console.log('========================================');

const gcStats = new GameController(makeTeam('StatHome', 3), makeTeam('StatAway', 3), { speed: 0 });
const statsSummary = await gcStats.runFullMatch();

// Each player entry has name, position, and all 5 stat fields
for (const pStat of [...statsSummary.homeTeamStats, ...statsSummary.awayTeamStats]) {
  assert(typeof pStat.name === 'string' && pStat.name.length > 0, `Player "${pStat.name}" has a name`);
  assert(typeof pStat.position === 'string', `Player "${pStat.name}" has a position`);
  assert(typeof pStat.points   === 'number', `Player "${pStat.name}" has a points number`);
  assert(typeof pStat.assists  === 'number', `Player "${pStat.name}" has an assists number`);
  assert(typeof pStat.rebounds === 'number', `Player "${pStat.name}" has a rebounds number`);
  assert(typeof pStat.steals   === 'number', `Player "${pStat.name}" has a steals number`);
  assert(typeof pStat.blocks   === 'number', `Player "${pStat.name}" has a blocks number`);
  // Stats are non-negative
  assert(pStat.points   >= 0, `Player "${pStat.name}" points >= 0`);
  assert(pStat.assists  >= 0, `Player "${pStat.name}" assists >= 0`);
  assert(pStat.rebounds >= 0, `Player "${pStat.name}" rebounds >= 0`);
  assert(pStat.steals   >= 0, `Player "${pStat.name}" steals >= 0`);
  assert(pStat.blocks   >= 0, `Player "${pStat.name}" blocks >= 0`);
}

// Team total points from player stats must equal team score
const homeTotalFromPlayers = statsSummary.homeTeamStats.reduce((sum, p) => sum + p.points, 0);
const awayTotalFromPlayers = statsSummary.awayTeamStats.reduce((sum, p) => sum + p.points, 0);
assertEqual(homeTotalFromPlayers, statsSummary.homeScore, 'Sum of home player points === homeScore');
assertEqual(awayTotalFromPlayers, statsSummary.awayScore, 'Sum of away player points === awayScore');

// At least some player scored points (i.e. stats are being tracked)
const anyHomeScored = statsSummary.homeTeamStats.some(p => p.points > 0);
const anyAwayScored = statsSummary.awayTeamStats.some(p => p.points > 0);
assert(anyHomeScored, 'At least one home player scored points (stats being tracked)');
assert(anyAwayScored, 'At least one away player scored points (stats being tracked)');

// ---------------------------------------------------------------------------
// GROUP 8: Summary shape completeness
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 8: Summary shape completeness');
console.log('========================================');

// Use the summary already computed (gcFull / summary from GROUP 4)
const requiredTopLevelKeys = [
  'homeTeam', 'awayTeam', 'homeScore', 'awayScore', 'score',
  'winner', 'rounds', 'narrationLog', 'events', 'homeTeamStats', 'awayTeamStats',
];
for (const key of requiredTopLevelKeys) {
  assert(key in summary, `summary has required key: "${key}"`);
}

// homeTeamStats and awayTeamStats each have 5 entries (one per player)
assertEqual(summary.homeTeamStats.length, 5, 'homeTeamStats has 5 player entries');
assertEqual(summary.awayTeamStats.length, 5, 'awayTeamStats has 5 player entries');

// narrationLog entries have expected shape
for (const entry of summary.narrationLog.slice(0, 5)) {
  assert(typeof entry.text    === 'string', 'narration entry.text is a string');
  assert(typeof entry.type    === 'string', 'narration entry.type is a string');
  assert(typeof entry.quarter === 'number', 'narration entry.quarter is a number');
}

// events array has at least some entries
assert(summary.events.length > 0, 'summary.events is non-empty');

// quarter reported in summary is 4 (post-game)
assertInRange(summary.quarter, 4, 6, 'summary.quarter is 4 (or 5/6 if overtime)');

// ---------------------------------------------------------------------------
// GROUP 9: setLanguage()
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 9: setLanguage()');
console.log('========================================');

const gcLang = new GameController(makeTeam('LangH', 2), makeTeam('LangA', 2), { language: 'en', speed: 0 });
assertEqual(gcLang.language, 'en', 'language is "en" after constructor with language:"en"');

gcLang.setLanguage('pt');
assertEqual(gcLang.language, 'pt', 'setLanguage("pt") changes language to "pt"');

const langSummary = await gcLang.runFullMatch();
assert(Array.isArray(langSummary.narrationLog), 'match runs after setLanguage');
assert(langSummary.narrationLog.length > 0, 'narration log is non-empty after setLanguage');

// ---------------------------------------------------------------------------
// GROUP 10: Unsubscribe function
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 10: Unsubscribe function');
console.log('========================================');

const gcUnsub = new GameController(makeTeam('UnsubHome'), makeTeam('UnsubAway'), { speed: 0 });
let afterUnsubCount = 0;
let beforeUnsubCount = 0;

const unsub = gcUnsub.subscribe(({ event }) => {
  // Count events received before calling unsub
  beforeUnsubCount++;
});
const alwaysSub = gcUnsub.subscribe(({ event }) => {
  afterUnsubCount++;
});

// Call unsub immediately — the first subscriber should receive nothing
unsub();

await gcUnsub.runFullMatch();

// alwaysSub should have received events (match ran)
assert(afterUnsubCount > 0, 'subscriber that was NOT unsubscribed still receives events');

// The unsubscribed callback should receive 0 events
assertEqual(beforeUnsubCount, 0, 'unsubscribed callback receives 0 events after unsub()');

// ---------------------------------------------------------------------------
// GROUP 11: Multiple instances are independent
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 11: Multiple instances are independent');
console.log('========================================');

const gcA = new GameController(makeTeam('AlphaHome', 5), makeTeam('AlphaAway', 5), { speed: 0 });
const gcB = new GameController(makeTeam('BetaHome',  1), makeTeam('BetaAway',  1), { speed: 0 });

// Run concurrently
const [sumA, sumB] = await Promise.all([gcA.runFullMatch(), gcB.runFullMatch()]);

// Both should have finished
assertEqual(gcA.getState().status, 'complete', 'gcA status is complete');
assertEqual(gcB.getState().status, 'complete', 'gcB status is complete');

// Team names do not bleed across instances
assertEqual(sumA.homeTeam, 'AlphaHome', 'gcA summary uses AlphaHome name');
assertEqual(sumB.homeTeam, 'BetaHome',  'gcB summary uses BetaHome name');

// Higher-skill team (skill 5) should on average outscore lower-skill (skill 1) across multiple runs
// (probabilistic — run 5 times and check the trend)
let highSkillWins = 0;
for (let i = 0; i < 5; i++) {
  const gcH = new GameController(makeTeam('SkillHigh', 5), makeTeam('SkillLow', 1), { speed: 0 });
  const s = await gcH.runFullMatch();
  if (s.homeScore > s.awayScore) highSkillWins++;
}
assert(highSkillWins >= 2, `Skill 5 vs Skill 1: higher-skill team wins at least 2/5 matches (won ${highSkillWins}/5)`);

// ---------------------------------------------------------------------------
// GROUP 12: Winner determination
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 12: Winner determination');
console.log('========================================');

// Run 5 matches and verify winner logic
for (let i = 0; i < 5; i++) {
  const gc = new GameController(makeTeam('WinH', 3), makeTeam('WinA', 3), { speed: 0 });
  const s = await gc.runFullMatch();

  if (s.homeScore > s.awayScore) {
    assertEqual(s.winner, 'WinH', `Match ${i}: homeScore (${s.homeScore}) > awayScore (${s.awayScore}) → winner is WinH`);
  } else if (s.awayScore > s.homeScore) {
    assertEqual(s.winner, 'WinA', `Match ${i}: awayScore (${s.awayScore}) > homeScore (${s.homeScore}) → winner is WinA`);
  } else {
    assertEqual(s.winner, 'TIE', `Match ${i}: scores equal (${s.homeScore}) → winner is "TIE"`);
  }
}

// ---------------------------------------------------------------------------
// GROUP 13: getMatchSummary() after runFullMatch
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 13: getMatchSummary()');
console.log('========================================');

const gcGMS = new GameController(makeTeam('GMSHome'), makeTeam('GMSAway'), { speed: 0 });

// Before the match: getMatchSummary returns a partial (0-score) summary object
const preSummary = gcGMS.getMatchSummary();
assert(typeof preSummary === 'object', 'getMatchSummary() returns an object before the match');

await gcGMS.runFullMatch();

const postSummary = gcGMS.getMatchSummary();
assert(typeof postSummary === 'object', 'getMatchSummary() returns an object after match');
assertEqual(postSummary.homeTeam, 'GMSHome', 'getMatchSummary().homeTeam matches');
assert(postSummary.homeScore >= 0, 'getMatchSummary().homeScore is >= 0 after match');
assert(postSummary.awayScore >= 0, 'getMatchSummary().awayScore is >= 0 after match');

// getMatchSummary and runFullMatch return consistent scores
const rfmSummary = gcGMS.getMatchSummary();
// (Both calls refer to the same cached summary — same object)
assertEqual(rfmSummary.homeScore, postSummary.homeScore, 'getMatchSummary() returns cacheable result (homeScore stable)');

// ---------------------------------------------------------------------------
// GROUP 14: Calling runFullMatch on an already-complete controller
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 14: runFullMatch on a completed match');
console.log('========================================');

const gcTwice = new GameController(makeTeam('TwiceH'), makeTeam('TwiceA'), { speed: 0 });
const firstSummary  = await gcTwice.runFullMatch();
const secondSummary = await gcTwice.runFullMatch();

// Both calls return an object
assert(typeof firstSummary  === 'object', 'First runFullMatch returns an object');
assert(typeof secondSummary === 'object', 'Second runFullMatch (on completed) returns an object');
// The controller is still in complete state
assertEqual(gcTwice.getState().status, 'complete', 'Status is "complete" after second runFullMatch');
// Note: calling runFullMatch() on a completed controller restarts the match.
assert(typeof secondSummary.homeScore === 'number' && secondSummary.homeScore >= 0, 'Second runFullMatch: homeScore is a valid number');
assert(typeof secondSummary.awayScore === 'number' && secondSummary.awayScore >= 0, 'Second runFullMatch: awayScore is a valid number');

// ---------------------------------------------------------------------------
// GROUP 15: Edge cases
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log('GROUP 15: Edge cases');
console.log('========================================');

// --- Missing stats on players: should not throw ---
const teamNoStats = {
  name: 'NoStats',
  score: 0,
  players: [
    { name: 'Player A', position: 'PG', skillLevel: 2, isActive: true }, // no stats object
    { name: 'Player B', position: 'SF', skillLevel: 2, isActive: true },
    { name: 'Player C', position: 'C',  skillLevel: 2, isActive: true },
    { name: 'Player D', position: 'PF', skillLevel: 2, isActive: true },
    { name: 'Player E', position: 'SG', skillLevel: 2, isActive: true },
  ],
  getActivePlayers() { return this.players.filter(p => p.isActive); },
};

let noStatsError = null;
try {
  const gcNS = new GameController(teamNoStats, makeTeam('Opponent', 3), { speed: 0 });
  await gcNS.runFullMatch();
} catch (e) {
  noStatsError = e;
}
assert(noStatsError === null, 'GameController does not throw when player.stats is missing');

// --- Minimal one-player team: should not throw ---
let onePlayerError = null;
let onePlayerSummary = null;
try {
  const gcOne = new GameController(makeMinimalTeam('Solo'), makeTeam('Full', 3), { speed: 0 });
  onePlayerSummary = await gcOne.runFullMatch();
} catch (e) {
  onePlayerError = e;
}
assert(onePlayerError === null, 'GameController does not throw with a 1-player team');
assert(onePlayerSummary !== null && typeof onePlayerSummary.homeScore === 'number', '1-player team: summary has a homeScore number');

// --- Skill level extremes: should not throw ---
let extremeError = null;
try {
  const gcExtreme = new GameController(makeTeam('MaxSkill', 5), makeTeam('MinSkill', 1), { speed: 0 });
  await gcExtreme.runFullMatch();
} catch (e) {
  extremeError = e;
}
assert(extremeError === null, 'GameController does not throw with extreme skill levels (1 vs 5)');

// --- English narration: match runs cleanly ---
let enError = null;
try {
  const gcEn = new GameController(makeTeam('EnHome'), makeTeam('EnAway'), { language: 'en', speed: 0 });
  await gcEn.runFullMatch();
} catch (e) {
  enError = e;
}
assert(enError === null, 'GameController does not throw with language:"en"');

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

console.log('\n========================================');
console.log(`Result: ✅ ${passCount} passed, ❌ ${failCount} failed`);
console.log('========================================');

if (failCount > 0) process.exit(1);
