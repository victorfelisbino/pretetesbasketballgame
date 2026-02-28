/**
 * Match Persistence Service — Exhaustive Tests
 * Quadra Legacy — src/services/matchPersistence.test.js
 *
 * Run with: node src/services/matchPersistence.test.js
 *
 * No external test libraries; plain Node.js only.
 */

// ---------------------------------------------------------------------------
// Mock localStorage BEFORE any imports (localLeague.js requires it)
// ---------------------------------------------------------------------------
const storage = {};
globalThis.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, value) => { storage[key] = String(value); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { for (const key in storage) delete storage[key]; },
};

// Now import the module under test (safe because localStorage is available)
import { parseScore, detectUserWin, persistMatchResult } from './matchPersistence.js';

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

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ===========================================================================
// parseScore — valid inputs
// ===========================================================================

section('parseScore -- valid inputs');

{
  const result = parseScore('102 - 98');
  assertDeepEqual('parses "102 - 98"', result, { home: 102, away: 98 });
}

{
  const result = parseScore('0 - 0');
  assertDeepEqual('parses "0 - 0"', result, { home: 0, away: 0 });
}

{
  const result = parseScore('55 - 110');
  assertDeepEqual('parses "55 - 110"', result, { home: 55, away: 110 });
}

{
  const result = parseScore('1 - 2');
  assertDeepEqual('parses "1 - 2"', result, { home: 1, away: 2 });
}

{
  const result = parseScore('999 - 1000');
  assertDeepEqual('parses large scores "999 - 1000"', result, { home: 999, away: 1000 });
}

// ===========================================================================
// parseScore — invalid inputs
// ===========================================================================

section('parseScore -- invalid inputs');

{
  assert('null returns null', parseScore(null), null);
}

{
  assert('undefined returns null', parseScore(undefined), null);
}

{
  assert('empty string returns null', parseScore(''), null);
}

{
  assert('non-string number returns null', parseScore(123), null);
}

{
  assert('"invalid" returns null', parseScore('invalid'), null);
}

{
  assert('"102-98" (no spaces) returns null', parseScore('102-98'), null);
}

{
  assert('"12 - abc" returns null', parseScore('12 - abc'), null);
}

{
  assert('"abc - 12" returns null', parseScore('abc - 12'), null);
}

{
  assert('"12 - 34 - 56" (too many parts) returns null', parseScore('12 - 34 - 56'), null);
}

{
  assert('boolean false returns null', parseScore(false), null);
}

{
  assert('object returns null', parseScore({}), null);
}

// ===========================================================================
// detectUserWin — user wins
// ===========================================================================

section('detectUserWin -- user wins');

{
  const result = detectUserWin({ winner: 'Lakers' }, 'Lakers');
  assert('user wins when winner matches userTeamName', result, true);
}

{
  const result = detectUserWin({ winner: 'Thunder Hawks' }, 'Thunder Hawks');
  assert('user wins with multi-word team name', result, true);
}

// ===========================================================================
// detectUserWin — user loses
// ===========================================================================

section('detectUserWin -- user loses');

{
  const result = detectUserWin({ winner: 'Celtics' }, 'Lakers');
  assert('user loses when winner differs from userTeamName', result, false);
}

{
  const result = detectUserWin({ winner: 'Golden Eagles' }, 'Thunder Hawks');
  assert('user loses with different multi-word names', result, false);
}

// ===========================================================================
// detectUserWin — tie
// ===========================================================================

section('detectUserWin -- tie');

{
  const result = detectUserWin({ winner: 'TIE' }, 'Lakers');
  assert('TIE returns null', result, null);
}

{
  const result = detectUserWin({ winner: 'TIE' }, 'Celtics');
  assert('TIE returns null for any team', result, null);
}

// ===========================================================================
// detectUserWin — null / missing inputs
// ===========================================================================

section('detectUserWin -- null inputs');

{
  assert('null result returns null', detectUserWin(null, 'Lakers'), null);
}

{
  assert('undefined result returns null', detectUserWin(undefined, 'Lakers'), null);
}

{
  assert('null userTeamName returns null', detectUserWin({ winner: 'Lakers' }, null), null);
}

{
  assert('undefined userTeamName returns null', detectUserWin({ winner: 'Lakers' }, undefined), null);
}

{
  assert('both null returns null', detectUserWin(null, null), null);
}

{
  assert('empty string userTeamName returns null', detectUserWin({ winner: 'Lakers' }, ''), null);
}

// ===========================================================================
// persistMatchResult — quick match (no matchInfo, no auth)
// ===========================================================================

section('persistMatchResult -- quick match (no matchInfo, no auth)');

{
  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
  });
  assert('localSaved is false', outcome.localSaved, false);
  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('error is null', outcome.error, null);
}

// ===========================================================================
// persistMatchResult — with matchInfo but missing leagueId
// ===========================================================================

section('persistMatchResult -- matchInfo missing leagueId');

{
  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    matchInfo: { matchId: 'match-1' },  // no leagueId
  });
  assert('localSaved is false when leagueId missing', outcome.localSaved, false);
  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('error is null', outcome.error, null);
}

// ===========================================================================
// persistMatchResult — with matchInfo but missing matchId
// ===========================================================================

section('persistMatchResult -- matchInfo missing matchId');

{
  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    matchInfo: { leagueId: 'league-1' },  // no matchId
  });
  assert('localSaved is false when matchId missing', outcome.localSaved, false);
  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('error is null', outcome.error, null);
}

// ===========================================================================
// persistMatchResult — with matchInfo but no score in result
// ===========================================================================

section('persistMatchResult -- matchInfo present but no score');

{
  const outcome = await persistMatchResult({
    result: { winner: 'Lakers' },  // no score
    matchInfo: { leagueId: 'league-1', matchId: 'match-1' },
  });
  assert('localSaved is false when score missing', outcome.localSaved, false);
  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('error is null', outcome.error, null);
}

// ===========================================================================
// persistMatchResult — with matchInfo but invalid score format
// ===========================================================================

section('persistMatchResult -- matchInfo with invalid score format');

{
  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: 'invalid-score' },
    matchInfo: { leagueId: 'league-1', matchId: 'match-1' },
  });
  // parseScore returns null for 'invalid-score', so localSaved stays false
  assert('localSaved is false for invalid score', outcome.localSaved, false);
  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('error is null (no exception, just invalid parse)', outcome.error, null);
}

// ===========================================================================
// persistMatchResult — Firestore path with user win
// ===========================================================================

section('persistMatchResult -- Firestore path with user win');

{
  let capturedUid = null;
  let capturedStats = null;
  const mockUpdateUserStats = async (uid, stats) => {
    capturedUid = uid;
    capturedStats = stats;
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    isAuthenticated: true,
    user: { uid: 'user-123' },
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('firestoreSaved is true', outcome.firestoreSaved, true);
  assert('error is null', outcome.error, null);
  assert('called with correct uid', capturedUid, 'user-123');
  assertDeepEqual('stats reflect win', capturedStats, { totalWins: 1, totalLosses: 0 });
}

// ===========================================================================
// persistMatchResult — Firestore path with user loss
// ===========================================================================

section('persistMatchResult -- Firestore path with user loss');

{
  let capturedUid = null;
  let capturedStats = null;
  const mockUpdateUserStats = async (uid, stats) => {
    capturedUid = uid;
    capturedStats = stats;
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Celtics', score: '95 - 110' },
    isAuthenticated: true,
    user: { uid: 'user-456' },
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('firestoreSaved is true', outcome.firestoreSaved, true);
  assert('error is null', outcome.error, null);
  assert('called with correct uid', capturedUid, 'user-456');
  assertDeepEqual('stats reflect loss', capturedStats, { totalWins: 0, totalLosses: 1 });
}

// ===========================================================================
// persistMatchResult — Firestore path with TIE
// ===========================================================================

section('persistMatchResult -- Firestore path with TIE');

{
  let capturedStats = null;
  const mockUpdateUserStats = async (uid, stats) => {
    capturedStats = stats;
  };

  const outcome = await persistMatchResult({
    result: { winner: 'TIE', score: '100 - 100' },
    isAuthenticated: true,
    user: { uid: 'user-789' },
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('firestoreSaved is true', outcome.firestoreSaved, true);
  assert('error is null', outcome.error, null);
  // detectUserWin returns null for TIE, so neither win nor loss incremented
  assertDeepEqual('stats reflect tie (0/0)', capturedStats, { totalWins: 0, totalLosses: 0 });
}

// ===========================================================================
// persistMatchResult — Firestore path NOT called when unauthenticated
// ===========================================================================

section('persistMatchResult -- Firestore not called when unauthenticated');

{
  let wasCalled = false;
  const mockUpdateUserStats = async () => {
    wasCalled = true;
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    isAuthenticated: false,
    user: { uid: 'user-123' },
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('mock was not called', wasCalled, false);
}

// ===========================================================================
// persistMatchResult — Firestore not called when user is null
// ===========================================================================

section('persistMatchResult -- Firestore not called when user is null');

{
  let wasCalled = false;
  const mockUpdateUserStats = async () => {
    wasCalled = true;
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    isAuthenticated: true,
    user: null,
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('mock was not called', wasCalled, false);
}

// ===========================================================================
// persistMatchResult — Firestore not called when user has no uid
// ===========================================================================

section('persistMatchResult -- Firestore not called when user has no uid');

{
  let wasCalled = false;
  const mockUpdateUserStats = async () => {
    wasCalled = true;
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    isAuthenticated: true,
    user: {},  // no uid
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('mock was not called', wasCalled, false);
}

// ===========================================================================
// persistMatchResult — Firestore not called when updateUserStatsFn is null
// ===========================================================================

section('persistMatchResult -- Firestore not called when updateUserStatsFn is null');

{
  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    isAuthenticated: true,
    user: { uid: 'user-123' },
    userTeamName: 'Lakers',
    updateUserStatsFn: null,
  });

  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('error is null', outcome.error, null);
}

// ===========================================================================
// persistMatchResult — Firestore error handling
// ===========================================================================

section('persistMatchResult -- Firestore error handling');

{
  const mockUpdateUserStats = async () => {
    throw new Error('Firestore network timeout');
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '102 - 98' },
    isAuthenticated: true,
    user: { uid: 'user-err' },
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('firestoreSaved is false on error', outcome.firestoreSaved, false);
  assert('error captures message', outcome.error, 'Firestore network timeout');
}

// ===========================================================================
// persistMatchResult — localStorage path with valid league match
// ===========================================================================

section('persistMatchResult -- localStorage path with league match');

{
  // Clear mock localStorage
  localStorage.clear();

  // Set up a test league in mock localStorage
  const testLeague = {
    id: 'test-league-1',
    name: 'Test League',
    teams: [
      { id: 'team-1', name: 'Home Team', isUserTeam: true, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
      { id: 'team-2', name: 'Away Team', isUserTeam: false, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
    ],
    schedule: [
      { id: 'match-1', round: 1, homeTeamId: 'team-1', awayTeamId: 'team-2', homeTeamName: 'Home Team', awayTeamName: 'Away Team', status: 'scheduled', homeScore: null, awayScore: null },
    ],
    maxTeams: 8,
    season: 1,
    status: 'in-progress',
    currentRound: 1,
  };
  localStorage.setItem('quadra_legacy_leagues', JSON.stringify([testLeague]));

  const outcome = await persistMatchResult({
    result: { winner: 'Home Team', score: '88 - 72' },
    matchInfo: { leagueId: 'test-league-1', matchId: 'match-1' },
  });

  assert('localSaved is true', outcome.localSaved, true);
  assert('firestoreSaved is false (no auth)', outcome.firestoreSaved, false);
  assert('error is null', outcome.error, null);

  // Verify localStorage was updated by reading back the league data
  const savedLeagues = JSON.parse(localStorage.getItem('quadra_legacy_leagues'));
  const savedLeague = savedLeagues.find(l => l.id === 'test-league-1');
  const savedMatch = savedLeague.schedule.find(m => m.id === 'match-1');
  assert('match status updated to completed', savedMatch.status, 'completed');
  assert('match homeScore saved', savedMatch.homeScore, 88);
  assert('match awayScore saved', savedMatch.awayScore, 72);

  // Verify team stats were updated
  const homeTeam = savedLeague.teams.find(t => t.id === 'team-1');
  assert('home team played incremented', homeTeam.stats.played, 1);
  assert('home team wins incremented', homeTeam.stats.wins, 1);
  assert('home team pointsFor updated', homeTeam.stats.pointsFor, 88);
  assert('home team pointsAgainst updated', homeTeam.stats.pointsAgainst, 72);

  const awayTeam = savedLeague.teams.find(t => t.id === 'team-2');
  assert('away team played incremented', awayTeam.stats.played, 1);
  assert('away team losses incremented', awayTeam.stats.losses, 1);
  assert('away team pointsFor updated', awayTeam.stats.pointsFor, 72);
  assert('away team pointsAgainst updated', awayTeam.stats.pointsAgainst, 88);

  // Clean up
  localStorage.clear();
}

// ===========================================================================
// persistMatchResult — localStorage error when league not found
// ===========================================================================

section('persistMatchResult -- localStorage error when league not found');

{
  localStorage.clear();
  // No leagues in storage, so recordLocalMatchResult will throw "League not found"

  const outcome = await persistMatchResult({
    result: { winner: 'Home Team', score: '80 - 70' },
    matchInfo: { leagueId: 'nonexistent-league', matchId: 'match-1' },
  });

  assert('localSaved is false on error', outcome.localSaved, false);
  assert('error contains message', outcome.error, 'League not found');

  localStorage.clear();
}

// ===========================================================================
// persistMatchResult — both localStorage and Firestore paths together
// ===========================================================================

section('persistMatchResult -- both localStorage and Firestore paths');

{
  localStorage.clear();

  // Set up league data
  const testLeague = {
    id: 'dual-league',
    name: 'Dual Test League',
    teams: [
      { id: 'team-a', name: 'Alpha', isUserTeam: true, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
      { id: 'team-b', name: 'Bravo', isUserTeam: false, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
    ],
    schedule: [
      { id: 'dual-match-1', round: 1, homeTeamId: 'team-a', awayTeamId: 'team-b', homeTeamName: 'Alpha', awayTeamName: 'Bravo', status: 'scheduled', homeScore: null, awayScore: null },
    ],
    maxTeams: 8,
    season: 1,
    status: 'in-progress',
    currentRound: 1,
  };
  localStorage.setItem('quadra_legacy_leagues', JSON.stringify([testLeague]));

  let capturedStats = null;
  const mockUpdateUserStats = async (uid, stats) => {
    capturedStats = stats;
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Alpha', score: '95 - 80' },
    matchInfo: { leagueId: 'dual-league', matchId: 'dual-match-1' },
    isAuthenticated: true,
    user: { uid: 'dual-user' },
    userTeamName: 'Alpha',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('localSaved is true', outcome.localSaved, true);
  assert('firestoreSaved is true', outcome.firestoreSaved, true);
  assert('error is null', outcome.error, null);
  assertDeepEqual('Firestore stats reflect win', capturedStats, { totalWins: 1, totalLosses: 0 });

  localStorage.clear();
}

// ===========================================================================
// persistMatchResult — both paths fail, errors concatenated
// ===========================================================================

section('persistMatchResult -- both paths error, errors concatenated');

{
  localStorage.clear();
  // No leagues in storage -> localStorage path throws "League not found"

  const mockUpdateUserStats = async () => {
    throw new Error('Firestore unavailable');
  };

  const outcome = await persistMatchResult({
    result: { winner: 'Lakers', score: '100 - 90' },
    matchInfo: { leagueId: 'missing-league', matchId: 'missing-match' },
    isAuthenticated: true,
    user: { uid: 'user-both-err' },
    userTeamName: 'Lakers',
    updateUserStatsFn: mockUpdateUserStats,
  });

  assert('localSaved is false', outcome.localSaved, false);
  assert('firestoreSaved is false', outcome.firestoreSaved, false);
  assert('error contains both messages', outcome.error, 'League not found; Firestore unavailable');

  localStorage.clear();
}

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + '='.repeat(50));
console.log(`  matchPersistence tests: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(50));

if (failCount > 0) {
  process.exit(1);
}
