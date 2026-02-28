/**
 * localLeague.test.js
 * Quadra Legacy — comprehensive tests for the Local League System
 *
 * Run with: node src/league/localLeague.test.js
 *
 * Framework: plain Node.js — no jest, no mocha, no external libraries.
 * Style: PASS/FAIL per assertion, passCount/failCount summary, process.exit(1) on failure.
 */

// ---------------------------------------------------------------------------
// Mock localStorage for Node.js environment (MUST be before any imports)
// ---------------------------------------------------------------------------
const storage = {};
globalThis.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, value) => { storage[key] = String(value); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { for (const key in storage) delete storage[key]; },
};

// ---------------------------------------------------------------------------
// Now import from localLeague.js AFTER the mock is in place
// ---------------------------------------------------------------------------
import {
  createLocalLeague,
  getLocalLeagues,
  getLocalLeague,
  addTeamToLocalLeague,
  generateLocalSchedule,
  recordLocalMatchResult,
  getLocalStandings,
  getLocalUpcomingMatches,
  getNextUserMatch,
  deleteLocalLeague,
  startLocalNewSeason,
  generateAITeams,
} from './localLeague.js';

// ---------------------------------------------------------------------------
// Test harness
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

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ---------------------------------------------------------------------------
// Helper: make a simple team object for addTeamToLocalLeague
// ---------------------------------------------------------------------------
function makeTeam(name, isUserTeam = false) {
  return {
    name,
    isUserTeam,
    players: [
      { name: `${name} PG`, position: 'PG', shooting: 7, defense: 6, speed: 8, passing: 7 },
      { name: `${name} SG`, position: 'SG', shooting: 8, defense: 5, speed: 7, passing: 6 },
      { name: `${name} SF`, position: 'SF', shooting: 6, defense: 7, speed: 6, passing: 5 },
      { name: `${name} PF`, position: 'PF', shooting: 5, defense: 8, speed: 5, passing: 5 },
      { name: `${name} C`,  position: 'C',  shooting: 5, defense: 9, speed: 4, passing: 4 },
    ],
  };
}

// ===========================================================================
// SECTION 1: createLocalLeague
// ===========================================================================
section('createLocalLeague');
localStorage.clear();

const league1 = createLocalLeague({ name: 'Test League' });

assert('returns an object', typeof league1, 'object');
assert('has an id string', typeof league1.id, 'string');
assert('id is non-empty', league1.id.length > 0, true);
assert('name matches input', league1.name, 'Test League');
assert('season defaults to 1', league1.season, 1);
assert('status defaults to setup', league1.status, 'setup');
assert('teams is an array', Array.isArray(league1.teams), true);
assert('teams is empty', league1.teams.length, 0);
assert('schedule is an array', Array.isArray(league1.schedule), true);
assert('schedule is empty', league1.schedule.length, 0);
assert('maxTeams defaults to 8', league1.maxTeams, 8);
assert('currentRound defaults to 0', league1.currentRound, 0);
assert('has createdAt', typeof league1.createdAt, 'string');

// Custom maxTeams
const league1b = createLocalLeague({ name: 'Small League', maxTeams: 4 });
assert('maxTeams respects input', league1b.maxTeams, 4);

// ===========================================================================
// SECTION 2: getLocalLeagues
// ===========================================================================
section('getLocalLeagues');
localStorage.clear();

const emptyLeagues = getLocalLeagues();
assert('returns array when no leagues', Array.isArray(emptyLeagues), true);
assert('empty array when no leagues', emptyLeagues.length, 0);

createLocalLeague({ name: 'League A' });
createLocalLeague({ name: 'League B' });
createLocalLeague({ name: 'League C' });

const allLeagues = getLocalLeagues();
assert('returns array', Array.isArray(allLeagues), true);
assert('returns all 3 leagues', allLeagues.length, 3);
assert('first league name', allLeagues[0].name, 'League A');
assert('second league name', allLeagues[1].name, 'League B');
assert('third league name', allLeagues[2].name, 'League C');

// ===========================================================================
// SECTION 3: getLocalLeague
// ===========================================================================
section('getLocalLeague');
localStorage.clear();

const leagueForGet = createLocalLeague({ name: 'Find Me' });
const found = getLocalLeague(leagueForGet.id);

assert('found league is not null', found !== null, true);
assert('found league has correct id', found.id, leagueForGet.id);
assert('found league has correct name', found.name, 'Find Me');

const notFound = getLocalLeague('non_existent_id_12345');
assert('returns null for non-existent ID', notFound, null);

// ===========================================================================
// SECTION 4: addTeamToLocalLeague
// ===========================================================================
section('addTeamToLocalLeague');
localStorage.clear();

const leagueForTeams = createLocalLeague({ name: 'Team League', maxTeams: 3 });
const teamId1 = addTeamToLocalLeague(leagueForTeams.id, makeTeam('Hawks'));

assert('returns a team ID string', typeof teamId1, 'string');
assert('team ID is non-empty', teamId1.length > 0, true);

// Verify the team was added with correct stats shape
const leagueAfterAdd = getLocalLeague(leagueForTeams.id);
assert('league has 1 team', leagueAfterAdd.teams.length, 1);

const addedTeam = leagueAfterAdd.teams[0];
assert('team name matches', addedTeam.name, 'Hawks');
assert('team id matches returned id', addedTeam.id, teamId1);
assert('team has stats object', typeof addedTeam.stats, 'object');
assert('stats.played is 0', addedTeam.stats.played, 0);
assert('stats.wins is 0', addedTeam.stats.wins, 0);
assert('stats.losses is 0', addedTeam.stats.losses, 0);
assert('stats.pointsFor is 0', addedTeam.stats.pointsFor, 0);
assert('stats.pointsAgainst is 0', addedTeam.stats.pointsAgainst, 0);
assert('stats.fantasyPts is 0', addedTeam.stats.fantasyPts, 0);
assert('isUserTeam defaults to false', addedTeam.isUserTeam, false);

// Add a user team
const teamId2 = addTeamToLocalLeague(leagueForTeams.id, makeTeam('Eagles', true));
const leagueAfter2 = getLocalLeague(leagueForTeams.id);
assert('league now has 2 teams', leagueAfter2.teams.length, 2);
assert('second team isUserTeam is true', leagueAfter2.teams[1].isUserTeam, true);

// Add a third team (at the limit)
addTeamToLocalLeague(leagueForTeams.id, makeTeam('Wolves'));
const leagueAfter3 = getLocalLeague(leagueForTeams.id);
assert('league now has 3 teams (maxTeams)', leagueAfter3.teams.length, 3);

// Try adding a 4th team should throw (maxTeams = 3)
let maxTeamsError = null;
try {
  addTeamToLocalLeague(leagueForTeams.id, makeTeam('Overflow'));
} catch (e) {
  maxTeamsError = e;
}
assert('throws when league is full', maxTeamsError !== null, true);
assert('error message is League is full', maxTeamsError && maxTeamsError.message, 'League is full');

// Verify the league still has only 3 teams
const leagueStill3 = getLocalLeague(leagueForTeams.id);
assert('league still has 3 teams after overflow attempt', leagueStill3.teams.length, 3);

// ===========================================================================
// SECTION 5: generateLocalSchedule
// ===========================================================================
section('generateLocalSchedule');
localStorage.clear();

const leagueForSchedule = createLocalLeague({ name: 'Schedule League', maxTeams: 8 });

// Requires at least 2 teams
let scheduleErrorFew = null;
try {
  generateLocalSchedule(leagueForSchedule.id);
} catch (e) {
  scheduleErrorFew = e;
}
assert('throws with 0 teams', scheduleErrorFew !== null, true);
assert('error message needs 2 teams', scheduleErrorFew && scheduleErrorFew.message, 'Need at least 2 teams');

// Add 1 team and try again
addTeamToLocalLeague(leagueForSchedule.id, makeTeam('Solo Team'));
let scheduleErrorOne = null;
try {
  generateLocalSchedule(leagueForSchedule.id);
} catch (e) {
  scheduleErrorOne = e;
}
assert('throws with only 1 team', scheduleErrorOne !== null, true);

// Add 3 more teams (total 4) and generate schedule
addTeamToLocalLeague(leagueForSchedule.id, makeTeam('Team B'));
addTeamToLocalLeague(leagueForSchedule.id, makeTeam('Team C'));
addTeamToLocalLeague(leagueForSchedule.id, makeTeam('Team D'));

const schedule4 = generateLocalSchedule(leagueForSchedule.id);

assert('schedule is an array', Array.isArray(schedule4), true);
// 4 teams round-robin home+away: n*(n-1) = 4*3 = 12 total matches
assert('4 teams produce 12 matches (home+away round-robin)', schedule4.length, 12);

// All matches should be scheduled
const allScheduled = schedule4.every(m => m.status === 'scheduled');
assert('all matches have status scheduled', allScheduled, true);

// All matches should have null scores
const allNullScores = schedule4.every(m => m.homeScore === null && m.awayScore === null);
assert('all matches have null scores', allNullScores, true);

// Each match has required fields
const firstMatch = schedule4[0];
assert('match has id', typeof firstMatch.id, 'string');
assert('match has round', typeof firstMatch.round, 'number');
assert('match has homeTeamId', typeof firstMatch.homeTeamId, 'string');
assert('match has awayTeamId', typeof firstMatch.awayTeamId, 'string');
assert('match has homeTeamName', typeof firstMatch.homeTeamName, 'string');
assert('match has awayTeamName', typeof firstMatch.awayTeamName, 'string');
assert('match has status', firstMatch.status, 'scheduled');
assert('match playedAt is null', firstMatch.playedAt, null);

// League status should be in-progress
const leagueAfterSchedule = getLocalLeague(leagueForSchedule.id);
assert('league status is in-progress after generating schedule', leagueAfterSchedule.status, 'in-progress');
assert('league currentRound is 1', leagueAfterSchedule.currentRound, 1);

// No match has homeTeamId === awayTeamId (no self-matches)
const noSelfMatches = schedule4.every(m => m.homeTeamId !== m.awayTeamId);
assert('no team plays against itself', noSelfMatches, true);

// Each team appears in the correct total number of matches (each plays n-1 * 2 = 6 games)
const leagueTeams4 = leagueAfterSchedule.teams;
for (const team of leagueTeams4) {
  const teamMatchCount = schedule4.filter(
    m => m.homeTeamId === team.id || m.awayTeamId === team.id
  ).length;
  assert(`${team.name} appears in 6 matches`, teamMatchCount, 6);
}

// Test with 2 teams (simplest even case): exactly 2 matches, one home-away each
localStorage.clear();
const league2Teams = createLocalLeague({ name: 'Two Team League', maxTeams: 4 });
addTeamToLocalLeague(league2Teams.id, makeTeam('Duo-A'));
addTeamToLocalLeague(league2Teams.id, makeTeam('Duo-B'));
const schedule2 = generateLocalSchedule(league2Teams.id);
assert('2 teams produce 2 matches', schedule2.length, 2);

const l2 = getLocalLeague(league2Teams.id);
const duoA = l2.teams.find(t => t.name === 'Duo-A');
const duoB = l2.teams.find(t => t.name === 'Duo-B');
// One match has A home / B away, the other has B home / A away
const aHomeCount = schedule2.filter(
  m => m.homeTeamId === duoA.id && m.awayTeamId === duoB.id
).length;
const bHomeCount = schedule2.filter(
  m => m.homeTeamId === duoB.id && m.awayTeamId === duoA.id
).length;
assert('2-team: A is home once', aHomeCount, 1);
assert('2-team: B is home once', bHomeCount, 1);

// ===========================================================================
// SECTION 6: recordLocalMatchResult
// ===========================================================================
section('recordLocalMatchResult');
localStorage.clear();

const leagueForResults = createLocalLeague({ name: 'Results League', maxTeams: 4 });
addTeamToLocalLeague(leagueForResults.id, makeTeam('Alpha'));
addTeamToLocalLeague(leagueForResults.id, makeTeam('Beta'));
const resultsSchedule = generateLocalSchedule(leagueForResults.id);

// Record the first match
const match0 = resultsSchedule[0];
recordLocalMatchResult(leagueForResults.id, match0.id, 100, 85);

// Verify match was updated
const leagueAfterResult = getLocalLeague(leagueForResults.id);
const updatedMatch = leagueAfterResult.schedule.find(m => m.id === match0.id);
assert('match homeScore updated', updatedMatch.homeScore, 100);
assert('match awayScore updated', updatedMatch.awayScore, 85);
assert('match status is completed', updatedMatch.status, 'completed');
assert('match playedAt is set', typeof updatedMatch.playedAt, 'string');

// Verify team stats were updated
const homeTeam = leagueAfterResult.teams.find(t => t.id === match0.homeTeamId);
const awayTeam = leagueAfterResult.teams.find(t => t.id === match0.awayTeamId);

assert('home team played is 1', homeTeam.stats.played, 1);
assert('home team wins is 1 (100 > 85)', homeTeam.stats.wins, 1);
assert('home team losses is 0', homeTeam.stats.losses, 0);
assert('home team pointsFor is 100', homeTeam.stats.pointsFor, 100);
assert('home team pointsAgainst is 85', homeTeam.stats.pointsAgainst, 85);

assert('away team played is 1', awayTeam.stats.played, 1);
assert('away team wins is 0', awayTeam.stats.wins, 0);
assert('away team losses is 1 (85 < 100)', awayTeam.stats.losses, 1);
assert('away team pointsFor is 85', awayTeam.stats.pointsFor, 85);
assert('away team pointsAgainst is 100', awayTeam.stats.pointsAgainst, 100);

// Record the second match (reverse result)
const match1 = resultsSchedule[1];
recordLocalMatchResult(leagueForResults.id, match1.id, 90, 95);

const leagueAfterResult2 = getLocalLeague(leagueForResults.id);
const homeTeam2 = leagueAfterResult2.teams.find(t => t.id === match1.homeTeamId);
const awayTeam2 = leagueAfterResult2.teams.find(t => t.id === match1.awayTeamId);

assert('second match home team: losses incremented (90 < 95)', homeTeam2.stats.losses >= 1, true);
assert('second match away team: wins incremented (95 > 90)', awayTeam2.stats.wins >= 1, true);

// Season completion detection: all matches done
const leagueComplete = getLocalLeague(leagueForResults.id);
assert('league status is completed after all 2 matches done', leagueComplete.status, 'completed');

// Test season completion with more matches
localStorage.clear();
const leagueForCompletion = createLocalLeague({ name: 'Completion League', maxTeams: 4 });
addTeamToLocalLeague(leagueForCompletion.id, makeTeam('Comp-A'));
addTeamToLocalLeague(leagueForCompletion.id, makeTeam('Comp-B'));
addTeamToLocalLeague(leagueForCompletion.id, makeTeam('Comp-C'));
const compSchedule = generateLocalSchedule(leagueForCompletion.id);

// Complete all but one match
for (let i = 0; i < compSchedule.length - 1; i++) {
  recordLocalMatchResult(leagueForCompletion.id, compSchedule[i].id, 80, 70);
}
const leagueNotYetComplete = getLocalLeague(leagueForCompletion.id);
assert('league not completed while matches remain', leagueNotYetComplete.status, 'in-progress');

// Complete the last match
const lastMatch = compSchedule[compSchedule.length - 1];
recordLocalMatchResult(leagueForCompletion.id, lastMatch.id, 80, 70);
const leagueNowComplete = getLocalLeague(leagueForCompletion.id);
assert('league status completed after all matches done', leagueNowComplete.status, 'completed');

// Tied score: home team wins tie in basketball (homeScore >= awayScore)
localStorage.clear();
const leagueForTie = createLocalLeague({ name: 'Tie League', maxTeams: 4 });
addTeamToLocalLeague(leagueForTie.id, makeTeam('TieHome'));
addTeamToLocalLeague(leagueForTie.id, makeTeam('TieAway'));
const tieSchedule = generateLocalSchedule(leagueForTie.id);
recordLocalMatchResult(leagueForTie.id, tieSchedule[0].id, 80, 80);

const leagueAfterTie = getLocalLeague(leagueForTie.id);
const tieHome = leagueAfterTie.teams.find(t => t.id === tieSchedule[0].homeTeamId);
const tieAway = leagueAfterTie.teams.find(t => t.id === tieSchedule[0].awayTeamId);
assert('tied score: home team gets win (homeScore >= awayScore)', tieHome.stats.wins, 1);
assert('tied score: away team gets loss', tieAway.stats.losses, 1);

// ===========================================================================
// SECTION 7: getLocalStandings
// ===========================================================================
section('getLocalStandings');
localStorage.clear();

// Use 2-team leagues for controlled standings tests (algorithm is predictable for 2 teams)
// Test basic ordering by wins
const leagueForStandings = createLocalLeague({ name: 'Standings League', maxTeams: 8 });
addTeamToLocalLeague(leagueForStandings.id, makeTeam('Winner'));
addTeamToLocalLeague(leagueForStandings.id, makeTeam('Loser'));
const standingsSchedule = generateLocalSchedule(leagueForStandings.id);

// Winner wins both matches
for (const m of standingsSchedule) {
  const stLeague = getLocalLeague(leagueForStandings.id);
  const winnerTeam = stLeague.teams.find(t => t.name === 'Winner');
  if (m.homeTeamId === winnerTeam.id) {
    recordLocalMatchResult(leagueForStandings.id, m.id, 110, 80);
  } else {
    recordLocalMatchResult(leagueForStandings.id, m.id, 80, 110);
  }
}

const standings2 = getLocalStandings(leagueForStandings.id);
assert('standings returns an array', Array.isArray(standings2), true);
assert('standings has 2 teams', standings2.length, 2);
assert('1st place is Winner (2 wins)', standings2[0].name, 'Winner');
assert('2nd place is Loser (0 wins)', standings2[1].name, 'Loser');
assert('Winner has 2 wins', standings2[0].stats.wins, 2);
assert('Loser has 0 wins', standings2[1].stats.wins, 0);

// Test 3-team standings with schedule-aware approach: make A always win, B beat C
localStorage.clear();
const leagueFor3St = createLocalLeague({ name: 'Three Team Standings', maxTeams: 8 });
addTeamToLocalLeague(leagueFor3St.id, makeTeam('StTeam A'));
addTeamToLocalLeague(leagueFor3St.id, makeTeam('StTeam B'));
addTeamToLocalLeague(leagueFor3St.id, makeTeam('StTeam C'));
const st3Schedule = generateLocalSchedule(leagueFor3St.id);

const st3L = getLocalLeague(leagueFor3St.id);
const stA = st3L.teams.find(t => t.name === 'StTeam A');
const stB = st3L.teams.find(t => t.name === 'StTeam B');
const stC = st3L.teams.find(t => t.name === 'StTeam C');

// Record all matches: A always wins their games; in B-vs-C games, B wins
for (const m of st3Schedule) {
  const homeIsA = m.homeTeamId === stA.id;
  const awayIsA = m.awayTeamId === stA.id;
  const homeIsB = m.homeTeamId === stB.id;
  const awayIsB = m.awayTeamId === stB.id;

  if (homeIsA) {
    recordLocalMatchResult(leagueFor3St.id, m.id, 110, 80);   // A wins as home
  } else if (awayIsA) {
    recordLocalMatchResult(leagueFor3St.id, m.id, 80, 110);   // A wins as away
  } else if (homeIsB) {
    recordLocalMatchResult(leagueFor3St.id, m.id, 95, 75);    // B wins as home
  } else if (awayIsB) {
    recordLocalMatchResult(leagueFor3St.id, m.id, 75, 95);    // B wins as away
  } else {
    recordLocalMatchResult(leagueFor3St.id, m.id, 70, 60);    // fallback
  }
}

const standings3 = getLocalStandings(leagueFor3St.id);
assert('3-team standings has 3 entries', standings3.length, 3);

// A should have the most wins, then B, then C
// Verify that the order matches wins descending
assert('standings[0] has most wins', standings3[0].stats.wins >= standings3[1].stats.wins, true);
assert('standings[1] has more wins than standings[2]', standings3[1].stats.wins >= standings3[2].stats.wins, true);

// A wins all their matches, so A should be first or tied for first
const stAResult = standings3.find(t => t.name === 'StTeam A');
const stCResult = standings3.find(t => t.name === 'StTeam C');
assert('Team A has more wins than Team C', stAResult.stats.wins > stCResult.stats.wins, true);

// Test tiebreaker: point differential (use 2-team league for predictability)
localStorage.clear();
const leagueForTiebreak = createLocalLeague({ name: 'Tiebreak League', maxTeams: 8 });
addTeamToLocalLeague(leagueForTiebreak.id, makeTeam('TB-X'));
addTeamToLocalLeague(leagueForTiebreak.id, makeTeam('TB-Y'));
const tbSchedule = generateLocalSchedule(leagueForTiebreak.id);
const tbLeague = getLocalLeague(leagueForTiebreak.id);
const tbX = tbLeague.teams.find(t => t.name === 'TB-X');
const tbY = tbLeague.teams.find(t => t.name === 'TB-Y');

// Each team wins one match; X wins by 40 points, Y wins by 1 point
// X has better point differential
for (const m of tbSchedule) {
  if (m.homeTeamId === tbX.id) {
    recordLocalMatchResult(leagueForTiebreak.id, m.id, 120, 80); // X wins by 40
  } else {
    recordLocalMatchResult(leagueForTiebreak.id, m.id, 91, 90);  // Y wins by 1
  }
}

const tbStandings = getLocalStandings(leagueForTiebreak.id);
assert('tiebreak: both have 1 win', tbStandings[0].stats.wins, 1);
assert('tiebreak: same wins, better point diff is first', tbStandings[0].name, 'TB-X');
assert('tiebreak: worse point diff is second', tbStandings[1].name, 'TB-Y');

// Verify point differential calculation
const tbXStanding = tbStandings.find(t => t.name === 'TB-X');
const tbXDiff = tbXStanding.stats.pointsFor - tbXStanding.stats.pointsAgainst;
const tbYStanding = tbStandings.find(t => t.name === 'TB-Y');
const tbYDiff = tbYStanding.stats.pointsFor - tbYStanding.stats.pointsAgainst;
assert('TB-X has positive point differential', tbXDiff > 0, true);
assert('TB-Y has negative point differential', tbYDiff < 0, true);
assert('TB-X diff > TB-Y diff', tbXDiff > tbYDiff, true);

// Verify the third tiebreaker (pointsFor) is used by checking sort consistency:
// With 2 teams, we cannot create different PF with same wins+diff, so we verify
// the sort function returns consistent ordering by checking standings are sorted
// by wins desc, then diff desc, then PF desc
for (let i = 0; i < tbStandings.length - 1; i++) {
  const curr = tbStandings[i];
  const next = tbStandings[i + 1];
  const currDiff = curr.stats.pointsFor - curr.stats.pointsAgainst;
  const nextDiff = next.stats.pointsFor - next.stats.pointsAgainst;
  const winsOk = curr.stats.wins >= next.stats.wins;
  const diffOk = curr.stats.wins > next.stats.wins || currDiff >= nextDiff;
  const pfOk = curr.stats.wins > next.stats.wins || currDiff > nextDiff ||
               curr.stats.pointsFor >= next.stats.pointsFor;
  assert(`standings sort consistent (position ${i} vs ${i + 1})`, winsOk && diffOk && pfOk, true);
}

// Test for non-existent league
const noStandings = getLocalStandings('no_such_league');
assertDeepEqual('returns empty array for non-existent league', noStandings, []);

// ===========================================================================
// SECTION 8: getLocalUpcomingMatches
// ===========================================================================
section('getLocalUpcomingMatches');
localStorage.clear();

const leagueForUpcoming = createLocalLeague({ name: 'Upcoming League', maxTeams: 8 });
addTeamToLocalLeague(leagueForUpcoming.id, makeTeam('Up-A'));
addTeamToLocalLeague(leagueForUpcoming.id, makeTeam('Up-B'));
addTeamToLocalLeague(leagueForUpcoming.id, makeTeam('Up-C'));
const upcomingSchedule = generateLocalSchedule(leagueForUpcoming.id);

// Default count parameter limits to 5
const defaultUpcoming = getLocalUpcomingMatches(leagueForUpcoming.id);
assert('default count limits to at most 5', defaultUpcoming.length <= 5, true);
assert('default count returns scheduled matches', defaultUpcoming.length > 0, true);
const allDefaultScheduled = defaultUpcoming.every(m => m.status === 'scheduled');
assert('all default returned matches are scheduled', allDefaultScheduled, true);

// With a large explicit count, returns all scheduled matches
const allUpcoming = getLocalUpcomingMatches(leagueForUpcoming.id, 100);
assert('large count returns all scheduled matches', allUpcoming.length, upcomingSchedule.length);
const allUpcomingScheduled = allUpcoming.every(m => m.status === 'scheduled');
assert('all returned matches are scheduled', allUpcomingScheduled, true);

// With explicit count = 2
const twoUpcoming = getLocalUpcomingMatches(leagueForUpcoming.id, 2);
assert('count=2 returns exactly 2', twoUpcoming.length, 2);

// After completing some matches, only scheduled ones remain in upcoming
recordLocalMatchResult(leagueForUpcoming.id, upcomingSchedule[0].id, 100, 80);
recordLocalMatchResult(leagueForUpcoming.id, upcomingSchedule[1].id, 95, 90);

const afterSomeComplete = getLocalUpcomingMatches(leagueForUpcoming.id, 100);
const completedCount = 2;
assert(
  'upcoming excludes completed matches',
  afterSomeComplete.length,
  upcomingSchedule.length - completedCount
);
const noneCompleted = afterSomeComplete.every(m => m.status === 'scheduled');
assert('none of the upcoming matches are completed', noneCompleted, true);

// Non-existent league returns empty array
const noUpcoming = getLocalUpcomingMatches('ghost_league');
assertDeepEqual('returns empty array for non-existent league', noUpcoming, []);

// ===========================================================================
// SECTION 9: getNextUserMatch
// ===========================================================================
section('getNextUserMatch');
localStorage.clear();

const leagueForUserMatch = createLocalLeague({ name: 'User Match League', maxTeams: 8 });
const userTeamId = addTeamToLocalLeague(leagueForUserMatch.id, makeTeam('My Team', true));
addTeamToLocalLeague(leagueForUserMatch.id, makeTeam('Rival'));
const userSchedule = generateLocalSchedule(leagueForUserMatch.id);

const nextUser = getNextUserMatch(leagueForUserMatch.id);
assert('returns an object (not null)', nextUser !== null, true);
assert('next user match is scheduled', nextUser.status, 'scheduled');

// Verify the match involves the user's team
const involvesUser = (nextUser.homeTeamId === userTeamId || nextUser.awayTeamId === userTeamId);
assert('match involves user team', involvesUser, true);

// Complete the first user match, then the next one should be different
recordLocalMatchResult(leagueForUserMatch.id, nextUser.id, 88, 77);
const nextUserAfter = getNextUserMatch(leagueForUserMatch.id);
assert('next user match after completing first is different', nextUserAfter.id !== nextUser.id, true);

// Complete all matches — no more user matches
const umLeague = getLocalLeague(leagueForUserMatch.id);
const umRemaining = umLeague.schedule.filter(m => m.status === 'scheduled');
for (const m of umRemaining) {
  recordLocalMatchResult(leagueForUserMatch.id, m.id, 80, 70);
}
const nextUserDone = getNextUserMatch(leagueForUserMatch.id);
assert('returns null when all matches completed', nextUserDone === null || nextUserDone === undefined, true);

// League with no user team
localStorage.clear();
const leagueNoUser = createLocalLeague({ name: 'No User League', maxTeams: 8 });
addTeamToLocalLeague(leagueNoUser.id, makeTeam('AI-1'));
addTeamToLocalLeague(leagueNoUser.id, makeTeam('AI-2'));
generateLocalSchedule(leagueNoUser.id);

const noUserMatch = getNextUserMatch(leagueNoUser.id);
assert('returns null when no user team in league', noUserMatch, null);

// Non-existent league
const ghostUserMatch = getNextUserMatch('phantom_league');
assert('returns null for non-existent league', ghostUserMatch, null);

// ===========================================================================
// SECTION 10: deleteLocalLeague
// ===========================================================================
section('deleteLocalLeague');
localStorage.clear();

const leagueDel1 = createLocalLeague({ name: 'ToDelete' });
const leagueDel2 = createLocalLeague({ name: 'ToKeep' });

assert('2 leagues before delete', getLocalLeagues().length, 2);

deleteLocalLeague(leagueDel1.id);

assert('1 league after delete', getLocalLeagues().length, 1);
assert('deleted league is gone', getLocalLeague(leagueDel1.id), null);
assert('kept league still exists', getLocalLeague(leagueDel2.id) !== null, true);
assert('kept league has correct name', getLocalLeague(leagueDel2.id).name, 'ToKeep');

// Deleting a non-existent league does not throw
let deleteNonExistError = null;
try {
  deleteLocalLeague('does_not_exist_999');
} catch (e) {
  deleteNonExistError = e;
}
assert('deleting non-existent league does not throw', deleteNonExistError, null);
assert('still 1 league after deleting non-existent', getLocalLeagues().length, 1);

// ===========================================================================
// SECTION 11: startLocalNewSeason
// ===========================================================================
section('startLocalNewSeason');
localStorage.clear();

const leagueForNewSeason = createLocalLeague({ name: 'Season League', maxTeams: 8 });
addTeamToLocalLeague(leagueForNewSeason.id, makeTeam('NS-A'));
addTeamToLocalLeague(leagueForNewSeason.id, makeTeam('NS-B'));
addTeamToLocalLeague(leagueForNewSeason.id, makeTeam('NS-C'));
const nsSchedule = generateLocalSchedule(leagueForNewSeason.id);

// Complete all matches in season 1
for (const m of nsSchedule) {
  recordLocalMatchResult(leagueForNewSeason.id, m.id, 100, 90);
}

const beforeNewSeason = getLocalLeague(leagueForNewSeason.id);
assert('season 1 completed', beforeNewSeason.status, 'completed');
assert('season is 1 before new season', beforeNewSeason.season, 1);

// Verify teams have non-zero stats before reset
const teamBeforeReset = beforeNewSeason.teams[0];
assert('team has games played before reset', teamBeforeReset.stats.played > 0, true);

// Start new season
startLocalNewSeason(leagueForNewSeason.id);

const afterNewSeason = getLocalLeague(leagueForNewSeason.id);
assert('season incremented to 2', afterNewSeason.season, 2);
assert('status is in-progress (schedule generated)', afterNewSeason.status, 'in-progress');
assert('new schedule generated', afterNewSeason.schedule.length > 0, true);
assert('all teams still present', afterNewSeason.teams.length, 3);

// All team stats should be reset
for (const team of afterNewSeason.teams) {
  assert(`${team.name} played reset to 0`, team.stats.played, 0);
  assert(`${team.name} wins reset to 0`, team.stats.wins, 0);
  assert(`${team.name} losses reset to 0`, team.stats.losses, 0);
  assert(`${team.name} pointsFor reset to 0`, team.stats.pointsFor, 0);
  assert(`${team.name} pointsAgainst reset to 0`, team.stats.pointsAgainst, 0);
  assert(`${team.name} fantasyPts reset to 0`, team.stats.fantasyPts, 0);
}

// New schedule should have the same number of matches as the original (same teams)
assert(
  'new schedule has same match count as season 1',
  afterNewSeason.schedule.length,
  nsSchedule.length
);

// All new matches should be scheduled
const allNewScheduled = afterNewSeason.schedule.every(m => m.status === 'scheduled');
assert('all new season matches are scheduled', allNewScheduled, true);

// Start another new season to verify incrementing works repeatedly
for (const m of afterNewSeason.schedule) {
  recordLocalMatchResult(leagueForNewSeason.id, m.id, 85, 80);
}
startLocalNewSeason(leagueForNewSeason.id);
const afterSeason3 = getLocalLeague(leagueForNewSeason.id);
assert('season incremented to 3', afterSeason3.season, 3);

// ===========================================================================
// SECTION 12: generateAITeams
// ===========================================================================
section('generateAITeams');
localStorage.clear();

const leagueForAI = createLocalLeague({ name: 'AI League', maxTeams: 8 });
// Add one user team first
addTeamToLocalLeague(leagueForAI.id, makeTeam('User Team', true));

// Generate 5 AI teams
generateAITeams(leagueForAI.id, 5);

const aiLeague = getLocalLeague(leagueForAI.id);
assert('league has 6 teams total (1 user + 5 AI)', aiLeague.teams.length, 6);

// Verify AI teams have correct structure
const aiTeams = aiLeague.teams.filter(t => !t.isUserTeam);
assert('5 AI teams (not user)', aiTeams.length, 5);

for (const team of aiTeams) {
  assert(`AI team ${team.name} has name`, typeof team.name, 'string');
  assert(`AI team ${team.name} name is non-empty`, team.name.length > 0, true);
  assert(`AI team ${team.name} isUserTeam is false`, team.isUserTeam, false);
  assert(`AI team ${team.name} has players array`, Array.isArray(team.players), true);
  assert(`AI team ${team.name} has 5 players`, team.players.length, 5);

  // Check player positions
  const playerPositions = team.players.map(p => p.position).sort();
  assertDeepEqual(
    `AI team ${team.name} has all 5 positions`,
    playerPositions,
    ['C', 'PF', 'PG', 'SF', 'SG']
  );

  // Check each player has the right attributes and stat ranges
  for (const player of team.players) {
    assert(`player ${player.name} has name`, typeof player.name, 'string');
    assert(`player ${player.name} has position`, typeof player.position, 'string');
    assert(`player ${player.name} has shooting`, typeof player.shooting, 'number');
    assert(`player ${player.name} has defense`, typeof player.defense, 'number');
    assert(`player ${player.name} has speed`, typeof player.speed, 'number');
    assert(`player ${player.name} has passing`, typeof player.passing, 'number');
    // Stats should be in range 5-10
    assert(`player ${player.name} shooting in [5,10]`, player.shooting >= 5 && player.shooting <= 10, true);
    assert(`player ${player.name} defense in [5,10]`, player.defense >= 5 && player.defense <= 10, true);
    assert(`player ${player.name} speed in [5,10]`, player.speed >= 5 && player.speed <= 10, true);
    assert(`player ${player.name} passing in [5,10]`, player.passing >= 5 && player.passing <= 10, true);
  }

  // Check stats shape is initialized to zero
  assert(`AI team ${team.name} stats.played is 0`, team.stats.played, 0);
  assert(`AI team ${team.name} stats.wins is 0`, team.stats.wins, 0);
  assert(`AI team ${team.name} stats.losses is 0`, team.stats.losses, 0);
}

// All AI team names should be unique
const aiNames = aiTeams.map(t => t.name);
const uniqueAINames = new Set(aiNames);
assert('all AI team names are unique', uniqueAINames.size, aiNames.length);

// Try to generate more AI teams than available slots
// League has 6 teams, maxTeams=8, requesting 5 more.
// addTeamToLocalLeague will throw after filling to 8.
let overflowError = null;
try {
  generateAITeams(leagueForAI.id, 5);
} catch (e) {
  overflowError = e;
}
// Even though it threw partway, the first 2 should have been added (filling to 8)
const aiLeagueAfterOverflow = getLocalLeague(leagueForAI.id);
assert('AI generation fills up to maxTeams before throwing', aiLeagueAfterOverflow.teams.length, 8);

// All team names in the league should still be unique
const allTeamNames = aiLeagueAfterOverflow.teams.map(t => t.name);
const allUniqueNames = new Set(allTeamNames);
assert('all team names remain unique after overflow', allUniqueNames.size, allTeamNames.length);

// Generate AI teams for league that is already full
let aiFullError = null;
try {
  generateAITeams(leagueForAI.id, 3);
} catch (e) {
  aiFullError = e;
}
assert('generateAITeams throws when league is full', aiFullError !== null, true);

// Verify the league still has exactly 8 teams
const aiLeagueFinal = getLocalLeague(leagueForAI.id);
assert('league still has 8 teams after full overflow', aiLeagueFinal.teams.length, 8);

// Test generateAITeams with empty league (fills from scratch)
localStorage.clear();
const leagueForAIFresh = createLocalLeague({ name: 'Fresh AI League', maxTeams: 6 });
generateAITeams(leagueForAIFresh.id, 4);
const freshAILeague = getLocalLeague(leagueForAIFresh.id);
assert('fresh league gets 4 AI teams', freshAILeague.teams.length, 4);
for (const t of freshAILeague.teams) {
  assert(`fresh AI team ${t.name} is not user team`, t.isUserTeam, false);
}

// ===========================================================================
// Final summary
// ===========================================================================
console.log('\n========================================');
console.log(`Result: ${passCount} passed, ${failCount} failed`);
console.log('========================================');

if (failCount > 0) process.exit(1);
