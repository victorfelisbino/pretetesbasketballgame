/**
 * League Service — Exhaustive Tests
 * Quadra Legacy — src/services/leagueService.test.js
 *
 * Run with: node src/services/leagueService.test.js
 *
 * No external test libraries; plain Node.js only.
 * Firebase dependencies are intercepted by a custom ESM loader
 * (module.register) so we can run the leagueService module without
 * the actual Firebase SDK.
 */

// ===========================================================================
// 1. Mock localStorage BEFORE any module imports
// ===========================================================================
const store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
};

// ===========================================================================
// 2. Firebase mock control — mock modules read from this at runtime
// ===========================================================================
globalThis.__firebaseMock__ = {};

function resetMocks() {
  globalThis.__firebaseMock__ = {};
  localStorage.clear();
}

// ===========================================================================
// 3. Register a custom ESM loader to intercept Firebase module loads.
//    The loader replaces src/firebase/league.js and src/firebase/database.js
//    with lightweight stubs whose behaviour is controlled via
//    globalThis.__firebaseMock__.  This prevents the Firebase SDK (and
//    config.js which uses import.meta.env) from being loaded at all.
// ===========================================================================
import { register } from 'node:module';

if (typeof register !== 'function') {
  console.error('SKIP: module.register() not available (requires Node >= 20.6)');
  process.exit(0);
}

const loaderCode = `
export async function load(url, context, nextLoad) {
  const u = url.replace(/\\\\/g, '/');

  if (u.includes('/firebase/league.js') && !u.includes('.test.')) {
    const src = [
      'export async function createLeagueWithTeam(...a) {',
      '  const f = globalThis.__firebaseMock__?.createLeagueWithTeam;',
      '  return f ? f(...a) : { error: "mock not configured" };',
      '}',
      'export async function joinLeagueWithTeam(...a) {',
      '  const f = globalThis.__firebaseMock__?.joinLeagueWithTeam;',
      '  return f ? f(...a) : { error: "mock not configured" };',
      '}',
      'export async function scheduleSeasonMatches(...a) {',
      '  const f = globalThis.__firebaseMock__?.scheduleSeasonMatches;',
      '  return f ? f(...a) : { error: "mock not configured" };',
      '}',
      'export async function getLeagueDashboard(...a) {',
      '  const f = globalThis.__firebaseMock__?.getLeagueDashboard;',
      '  return f ? f(...a) : { error: "mock not configured" };',
      '}',
    ].join('\\n');
    return { format: 'module', source: src, shortCircuit: true };
  }

  if (u.includes('/firebase/database.js') && !u.includes('.test.')) {
    const src = [
      'export async function getUserLeagues(...a) {',
      '  const f = globalThis.__firebaseMock__?.getUserLeagues;',
      '  return f ? f(...a) : { data: [] };',
      '}',
      'export async function getLeague(...a) {',
      '  const f = globalThis.__firebaseMock__?.getLeague;',
      '  return f ? f(...a) : { data: null };',
      '}',
      'export async function updateLeague(...a) {',
      '  const f = globalThis.__firebaseMock__?.updateLeague;',
      '  return f ? f(...a) : { data: undefined };',
      '}',
    ].join('\\n');
    return { format: 'module', source: src, shortCircuit: true };
  }

  return nextLoad(url, context);
}
`;

register('data:text/javascript,' + encodeURIComponent(loaderCode));

// ===========================================================================
// 4. Dynamically import the module under test (hooks are now active)
// ===========================================================================
const {
  BACKEND_LOCAL,
  BACKEND_FIRESTORE,
  getLeagues,
  getLeague,
  createLeague,
  deleteLeague,
  joinLeagueByCode,
  addAITeams,
  generateSchedule,
  getStandings,
  getUpcomingMatches,
  getNextUserMatch,
  startNewSeason,
} = await import('./leagueService.js');

// ===========================================================================
// 5. Test infrastructure (matches matchPersistence.test.js convention)
// ===========================================================================
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

async function assertThrows(label, fn, expectedMsg) {
  try {
    await fn();
    console.log(`  FAIL  ${label}`);
    console.log(`         expected to throw but did not`);
    failCount++;
  } catch (err) {
    if (expectedMsg && !err.message.includes(expectedMsg)) {
      console.log(`  FAIL  ${label}`);
      console.log(`         expected message containing: "${expectedMsg}"`);
      console.log(`         actual message: "${err.message}"`);
      failCount++;
    } else {
      console.log(`  PASS  ${label}`);
      passCount++;
    }
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ===========================================================================
// Constants
// ===========================================================================

section('Constants');

assert('BACKEND_LOCAL is "local"', BACKEND_LOCAL, 'local');
assert('BACKEND_FIRESTORE is "firestore"', BACKEND_FIRESTORE, 'firestore');

// ===========================================================================
// getLeagues — guest mode (unauthenticated)
// ===========================================================================

section('getLeagues -- guest mode (no auth)');

{
  resetMocks();
  const leagues = await getLeagues();
  assert('no leagues returns empty array (default arg)', leagues.length, 0);
}

{
  resetMocks();
  const leagues = await getLeagues({});
  assert('empty authCtx returns empty array', leagues.length, 0);
}

{
  resetMocks();
  // Seed a local league via createLeague (guest)
  await createLeague({ name: 'Guest League A' });
  await createLeague({ name: 'Guest League B' });

  const leagues = await getLeagues({ isAuthenticated: false });
  assert('guest sees 2 local leagues', leagues.length, 2);
  assert('first league tagged backend local', leagues[0].backend, BACKEND_LOCAL);
  assert('second league tagged backend local', leagues[1].backend, BACKEND_LOCAL);
}

// ===========================================================================
// getLeagues — authenticated mode
// ===========================================================================

section('getLeagues -- authenticated mode');

{
  resetMocks();
  // Seed one local league
  await createLeague({ name: 'Local Only' });

  // Configure Firestore mock to return online leagues
  globalThis.__firebaseMock__.getUserLeagues = async () => ({
    data: [
      {
        id: 'fs-lg-1',
        name: 'Online League',
        season: 2,
        status: 'regular',
        teamIds: ['t1', 't2'],
        maxTeams: 8,
        inviteCode: 'ABC123',
        createdAt: '2025-06-01',
      },
      {
        id: 'fs-lg-2',
        name: 'Playoff League',
        season: 1,
        status: 'playoffs',
        teamIds: ['t3'],
        maxTeams: 4,
        inviteCode: 'XYZ999',
        createdAt: '2025-07-01',
      },
    ],
  });

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  const leagues = await getLeagues(authCtx);

  assert('authenticated sees 3 leagues (2 firestore + 1 local)', leagues.length, 3);
  assert('first league is firestore', leagues[0].backend, BACKEND_FIRESTORE);
  assert('second league is firestore', leagues[1].backend, BACKEND_FIRESTORE);
  assert('third league is local', leagues[2].backend, BACKEND_LOCAL);
  assert('firestore name preserved', leagues[0].name, 'Online League');

  // Status normalization
  assert('status "regular" normalized to "in-progress"', leagues[0].status, 'in-progress');
  assert('status "playoffs" normalized to "in-progress"', leagues[1].status, 'in-progress');
}

{
  resetMocks();
  await createLeague({ name: 'Offline Fallback' });

  // Firestore throws
  globalThis.__firebaseMock__.getUserLeagues = async () => {
    throw new Error('Network error');
  };

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  const leagues = await getLeagues(authCtx);

  assert('fallback to local leagues on Firestore error', leagues.length, 1);
  assert('fallback league is local', leagues[0].backend, BACKEND_LOCAL);
}

// ===========================================================================
// getLeague — LOCAL backend
// ===========================================================================

section('getLeague -- LOCAL backend');

{
  resetMocks();
  const result = await getLeague('nonexistent-id', BACKEND_LOCAL);
  assert('returns null for non-existent league', result, null);
}

{
  resetMocks();
  const created = await createLeague({ name: 'Detail League', maxTeams: 4 });
  const league = await getLeague(created.id, BACKEND_LOCAL);

  assertTruthy('returns league object', league);
  assert('name matches', league.name, 'Detail League');
  assert('backend tag is local', league.backend, BACKEND_LOCAL);
  assert('maxTeams matches', league.maxTeams, 4);
  assert('initial status is setup', league.status, 'setup');
}

// ===========================================================================
// getLeague — FIRESTORE backend
// ===========================================================================

section('getLeague -- FIRESTORE backend');

{
  resetMocks();
  globalThis.__firebaseMock__.getLeagueDashboard = async () => ({
    data: {
      league: {
        id: 'fs-league-1', name: 'Cloud League', season: 1,
        status: 'regular', maxTeams: 6, inviteCode: 'QWE890',
        teamIds: ['t1', 't2'],
      },
      season: { id: 'season-1', status: 'regular' },
      standings: [
        { teamId: 't1', wins: 5, losses: 1, pointsFor: 600, pointsAgainst: 500, fantasyPts: 180 },
        { teamId: 't2', wins: 2, losses: 4, pointsFor: 480, pointsAgainst: 550, fantasyPts: 110 },
      ],
      teams: [
        { id: 't1', name: 'Alpha', ownerId: 'user-1' },
        { id: 't2', name: 'Bravo', ownerId: 'user-2' },
      ],
      allMatches: [
        { id: 'm1', week: 1, homeTeamId: 't1', awayTeamId: 't2', status: 'completed', homeScore: 110, awayScore: 95, completedAt: '2025-06-10' },
        { id: 'm2', week: 2, homeTeamId: 't2', awayTeamId: 't1', status: 'scheduled' },
      ],
    },
  });

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  const league = await getLeague('fs-league-1', BACKEND_FIRESTORE, authCtx);

  assertTruthy('returns firestore league object', league);
  assert('league name', league.name, 'Cloud League');
  assert('league backend tag', league.backend, BACKEND_FIRESTORE);
  assert('league has 2 teams', league.teams.length, 2);
  assert('first team isUserTeam (owner matches uid)', league.teams[0].isUserTeam, true);
  assert('second team not isUserTeam', league.teams[1].isUserTeam, false);
  assert('first team stats.wins from standings', league.teams[0].stats.wins, 5);
  assert('schedule has 2 matches', league.schedule.length, 2);
  assert('status normalized (regular -> in-progress)', league.status, 'in-progress');
}

{
  resetMocks();
  globalThis.__firebaseMock__.getLeagueDashboard = async () => ({ error: 'Not found' });

  const result = await getLeague('missing', BACKEND_FIRESTORE);
  assert('returns null when dashboard returns error', result, null);
}

// ===========================================================================
// createLeague — guest (LOCAL backend)
// ===========================================================================

section('createLeague -- guest (LOCAL)');

{
  resetMocks();
  const result = await createLeague({ name: 'New Local League', maxTeams: 6 });

  assertTruthy('returns an id', result.id);
  assert('backend is local', result.backend, BACKEND_LOCAL);

  // Verify persistence
  const league = await getLeague(result.id, BACKEND_LOCAL);
  assertTruthy('league persisted in localStorage', league);
  assert('persisted name', league.name, 'New Local League');
  assert('persisted maxTeams', league.maxTeams, 6);
  assert('persisted season is 1', league.season, 1);
}

{
  resetMocks();
  const result = await createLeague(
    { name: 'Team League' },
    {}, // guest authCtx
    { name: 'My Squad', players: [] },
  );

  const league = await getLeague(result.id, BACKEND_LOCAL);
  assert('league has 1 team (user team added)', league.teams.length, 1);
  assert('user team name', league.teams[0].name, 'My Squad');
  assert('user team marked as isUserTeam', league.teams[0].isUserTeam, true);
}

// ===========================================================================
// createLeague — authenticated (FIRESTORE backend)
// ===========================================================================

section('createLeague -- authenticated (FIRESTORE)');

{
  resetMocks();
  globalThis.__firebaseMock__.createLeagueWithTeam = async (uid, config, teamCfg) => ({
    data: {
      leagueId: 'fs-new-1',
      inviteCode: 'NEW123',
      teamId: 'fs-team-1',
      seasonId: 'fs-season-1',
    },
  });

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  const result = await createLeague({ name: 'Online League' }, authCtx, { name: 'My Team' });

  assert('backend is firestore', result.backend, BACKEND_FIRESTORE);
  assert('returns leagueId', result.id, 'fs-new-1');
  assert('returns inviteCode', result.inviteCode, 'NEW123');
  assert('returns teamId', result.teamId, 'fs-team-1');
  assert('returns seasonId', result.seasonId, 'fs-season-1');
}

{
  resetMocks();
  globalThis.__firebaseMock__.createLeagueWithTeam = async () => ({
    error: 'Firestore write failed',
  });

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  await assertThrows(
    'throws on Firestore createLeague error',
    () => createLeague({ name: 'Fail' }, authCtx),
    'Firestore write failed',
  );
}

// ===========================================================================
// deleteLeague — LOCAL
// ===========================================================================

section('deleteLeague -- LOCAL');

{
  resetMocks();
  const keep = await createLeague({ name: 'Keep Me' });
  const del = await createLeague({ name: 'Delete Me' });

  await deleteLeague(del.id, BACKEND_LOCAL);

  const deleted = await getLeague(del.id, BACKEND_LOCAL);
  const kept = await getLeague(keep.id, BACKEND_LOCAL);

  assert('deleted league is gone', deleted, null);
  assertTruthy('other league still exists', kept);
}

// ===========================================================================
// deleteLeague — FIRESTORE
// ===========================================================================

section('deleteLeague -- FIRESTORE');

{
  resetMocks();
  let capturedId = null;
  let capturedData = null;
  globalThis.__firebaseMock__.updateLeague = async (id, data) => {
    capturedId = id;
    capturedData = data;
    return { data: undefined };
  };

  await deleteLeague('fs-league-99', BACKEND_FIRESTORE);

  assert('updateLeague called with correct id', capturedId, 'fs-league-99');
  assertDeepEqual('soft-delete sets status to deleted', capturedData, { status: 'deleted' });
}

// ===========================================================================
// joinLeagueByCode — authentication guards
// ===========================================================================

section('joinLeagueByCode -- auth guards');

{
  await assertThrows(
    'throws when isAuthenticated is false',
    () => joinLeagueByCode('CODE', { name: 'T' }, { isAuthenticated: false, user: { uid: 'u1' } }),
    'Must be authenticated',
  );
}

{
  await assertThrows(
    'throws when user is null',
    () => joinLeagueByCode('CODE', { name: 'T' }, { isAuthenticated: true, user: null }),
    'Must be authenticated',
  );
}

{
  await assertThrows(
    'throws when authCtx is empty object',
    () => joinLeagueByCode('CODE', { name: 'T' }, {}),
    'Must be authenticated',
  );
}

// ===========================================================================
// joinLeagueByCode — success path
// ===========================================================================

section('joinLeagueByCode -- success');

{
  resetMocks();
  let capturedArgs = null;
  globalThis.__firebaseMock__.joinLeagueWithTeam = async (uid, code, config) => {
    capturedArgs = { uid, code, config };
    return {
      data: { leagueId: 'joined-lg', teamId: 'joined-tm', leagueName: 'The League' },
    };
  };

  const authCtx = { isAuthenticated: true, user: { uid: 'user-join' } };
  const result = await joinLeagueByCode('INVITE', { name: 'My Team' }, authCtx);

  assert('returns leagueId', result.leagueId, 'joined-lg');
  assert('returns teamId', result.teamId, 'joined-tm');
  assert('called joinLeagueWithTeam with correct uid', capturedArgs.uid, 'user-join');
  assert('called joinLeagueWithTeam with correct code', capturedArgs.code, 'INVITE');
}

{
  resetMocks();
  globalThis.__firebaseMock__.joinLeagueWithTeam = async () => ({
    error: 'League is full',
  });

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  await assertThrows(
    'throws when joinLeagueWithTeam returns error',
    () => joinLeagueByCode('FULL', { name: 'T' }, authCtx),
    'League is full',
  );
}

// ===========================================================================
// addAITeams — LOCAL
// ===========================================================================

section('addAITeams -- LOCAL');

{
  resetMocks();
  const created = await createLeague({ name: 'AI League', maxTeams: 8 });
  await addAITeams(created.id, 3, BACKEND_LOCAL);

  const league = await getLeague(created.id, BACKEND_LOCAL);
  assert('3 AI teams added', league.teams.length, 3);
  assert('AI teams are not user teams', league.teams.every(t => !t.isUserTeam), true);
  assertTruthy('first AI team has a name', league.teams[0].name);
  assertTruthy('first AI team has players', league.teams[0].players.length > 0);
}

// ===========================================================================
// addAITeams — FIRESTORE (not implemented)
// ===========================================================================

section('addAITeams -- FIRESTORE (not implemented)');

{
  await assertThrows(
    'throws not-implemented for firestore backend',
    () => addAITeams('any-id', 3, BACKEND_FIRESTORE),
    'future update',
  );
}

// ===========================================================================
// generateSchedule — LOCAL
// ===========================================================================

section('generateSchedule -- LOCAL');

{
  resetMocks();
  const created = await createLeague(
    { name: 'Schedule League' },
    {},
    { name: 'User Team', players: [] },
  );
  await addAITeams(created.id, 1, BACKEND_LOCAL);

  await generateSchedule(created.id, BACKEND_LOCAL);

  const league = await getLeague(created.id, BACKEND_LOCAL);
  assertTruthy('schedule is populated', league.schedule.length > 0);
  assert('status changed to in-progress', league.status, 'in-progress');
  assert('currentRound is 1', league.currentRound, 1);
  assert('all matches have status scheduled', league.schedule.every(m => m.status === 'scheduled'), true);
}

{
  resetMocks();
  // League with only 1 team — should throw
  const created = await createLeague(
    { name: 'Tiny League' },
    {},
    { name: 'Solo Team', players: [] },
  );

  let threw = false;
  try {
    await generateSchedule(created.id, BACKEND_LOCAL);
  } catch {
    threw = true;
  }
  assert('throws with fewer than 2 teams', threw, true);
}

// ===========================================================================
// generateSchedule — FIRESTORE
// ===========================================================================

section('generateSchedule -- FIRESTORE');

{
  await assertThrows(
    'throws when seasonId is missing',
    () => generateSchedule('lg-1', BACKEND_FIRESTORE, {}),
    'Missing season or team data',
  );
}

{
  await assertThrows(
    'throws when teamIds is empty array',
    () => generateSchedule('lg-1', BACKEND_FIRESTORE, {
      _firestoreSeasonId: 'sid-1',
      _firestoreTeamIds: [],
    }),
    'Missing season or team data',
  );
}

{
  resetMocks();
  let capturedArgs = null;
  globalThis.__firebaseMock__.scheduleSeasonMatches = async (lid, sid, teamIds) => {
    capturedArgs = { lid, sid, teamIds };
    return { data: { totalMatches: 6, totalWeeks: 6 } };
  };

  await generateSchedule('lg-1', BACKEND_FIRESTORE, {
    _firestoreSeasonId: 'sid-1',
    _firestoreTeamIds: ['t1', 't2', 't3'],
  });

  assert('scheduleSeasonMatches called with correct leagueId', capturedArgs.lid, 'lg-1');
  assert('scheduleSeasonMatches called with correct seasonId', capturedArgs.sid, 'sid-1');
  assert('scheduleSeasonMatches passed 3 teamIds', capturedArgs.teamIds.length, 3);
}

{
  resetMocks();
  globalThis.__firebaseMock__.scheduleSeasonMatches = async () => ({
    error: 'Scheduling failed',
  });

  await assertThrows(
    'throws when scheduleSeasonMatches returns error',
    () => generateSchedule('lg-1', BACKEND_FIRESTORE, {
      _firestoreSeasonId: 'sid-1',
      _firestoreTeamIds: ['t1', 't2'],
    }),
    'Scheduling failed',
  );
}

// ===========================================================================
// getStandings — LOCAL
// ===========================================================================

section('getStandings -- LOCAL');

{
  resetMocks();
  const standings = await getStandings('nonexistent', BACKEND_LOCAL);
  assert('empty for non-existent league', standings.length, 0);
}

{
  resetMocks();
  // Seed a league with pre-built standings via raw localStorage
  const testLeague = {
    id: 'standings-lg',
    name: 'Standings Test',
    season: 1,
    status: 'in-progress',
    teams: [
      { id: 't1', name: 'First Place', isUserTeam: true, stats: { played: 4, wins: 4, losses: 0, pointsFor: 400, pointsAgainst: 300, fantasyPts: 0 } },
      { id: 't2', name: 'Third Place', isUserTeam: false, stats: { played: 4, wins: 1, losses: 3, pointsFor: 310, pointsAgainst: 370, fantasyPts: 0 } },
      { id: 't3', name: 'Second Place', isUserTeam: false, stats: { played: 4, wins: 3, losses: 1, pointsFor: 380, pointsAgainst: 340, fantasyPts: 0 } },
    ],
    schedule: [],
    maxTeams: 4,
    currentRound: 0,
    createdAt: '2025-01-01',
  };
  localStorage.setItem('quadra_legacy_leagues', JSON.stringify([testLeague]));

  const standings = await getStandings('standings-lg', BACKEND_LOCAL);

  assert('standings has 3 teams', standings.length, 3);
  assert('1st place by wins', standings[0].name, 'First Place');
  assert('2nd place by wins', standings[1].name, 'Second Place');
  assert('3rd place by wins', standings[2].name, 'Third Place');
}

{
  resetMocks();
  // Teams with same wins — break tie by point differential
  const testLeague = {
    id: 'tiebreak-lg',
    name: 'Tiebreak Test',
    season: 1,
    status: 'in-progress',
    teams: [
      { id: 't1', name: 'Bad Diff', isUserTeam: false, stats: { played: 4, wins: 2, losses: 2, pointsFor: 300, pointsAgainst: 350, fantasyPts: 0 } },
      { id: 't2', name: 'Good Diff', isUserTeam: false, stats: { played: 4, wins: 2, losses: 2, pointsFor: 400, pointsAgainst: 350, fantasyPts: 0 } },
    ],
    schedule: [],
    maxTeams: 4,
    currentRound: 0,
    createdAt: '2025-01-01',
  };
  localStorage.setItem('quadra_legacy_leagues', JSON.stringify([testLeague]));

  const standings = await getStandings('tiebreak-lg', BACKEND_LOCAL);

  assert('better point diff ranked first', standings[0].name, 'Good Diff');
  assert('worse point diff ranked second', standings[1].name, 'Bad Diff');
}

// ===========================================================================
// getUpcomingMatches — LOCAL
// ===========================================================================

section('getUpcomingMatches -- LOCAL');

{
  resetMocks();
  const testLeague = {
    id: 'upcoming-lg',
    name: 'Upcoming Test',
    season: 1,
    status: 'in-progress',
    teams: [
      { id: 't1', name: 'Hawks', isUserTeam: true, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
      { id: 't2', name: 'Eagles', isUserTeam: false, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
    ],
    schedule: [
      { id: 'm1', round: 1, homeTeamId: 't1', awayTeamId: 't2', status: 'completed', homeScore: 100, awayScore: 90, playedAt: '2025-01-01' },
      { id: 'm2', round: 2, homeTeamId: 't2', awayTeamId: 't1', status: 'scheduled', homeScore: null, awayScore: null, playedAt: null },
      { id: 'm3', round: 3, homeTeamId: 't1', awayTeamId: 't2', status: 'scheduled', homeScore: null, awayScore: null, playedAt: null },
      { id: 'm4', round: 4, homeTeamId: 't2', awayTeamId: 't1', status: 'scheduled', homeScore: null, awayScore: null, playedAt: null },
    ],
    maxTeams: 4,
    currentRound: 2,
    createdAt: '2025-01-01',
  };
  localStorage.setItem('quadra_legacy_leagues', JSON.stringify([testLeague]));

  const all = await getUpcomingMatches('upcoming-lg', 10, BACKEND_LOCAL);
  assert('returns all 3 scheduled matches', all.length, 3);

  const limited = await getUpcomingMatches('upcoming-lg', 2, BACKEND_LOCAL);
  assert('respects count limit of 2', limited.length, 2);

  const empty = await getUpcomingMatches('nonexistent', 5, BACKEND_LOCAL);
  assert('returns empty for non-existent league', empty.length, 0);
}

// ===========================================================================
// getUpcomingMatches — FIRESTORE (returns empty)
// ===========================================================================

section('getUpcomingMatches -- FIRESTORE');

{
  const result = await getUpcomingMatches('any-id', 5, BACKEND_FIRESTORE);
  assertDeepEqual('firestore returns empty array', result, []);
}

// ===========================================================================
// getNextUserMatch — LOCAL
// ===========================================================================

section('getNextUserMatch -- LOCAL');

{
  resetMocks();
  const testLeague = {
    id: 'next-match-lg',
    name: 'Next Match Test',
    season: 1,
    status: 'in-progress',
    teams: [
      { id: 't1', name: 'Hawks', isUserTeam: true, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
      { id: 't2', name: 'Eagles', isUserTeam: false, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
      { id: 't3', name: 'Wolves', isUserTeam: false, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
    ],
    schedule: [
      { id: 'm1', round: 1, homeTeamId: 't2', awayTeamId: 't3', status: 'scheduled', homeScore: null, awayScore: null, playedAt: null },
      { id: 'm2', round: 2, homeTeamId: 't1', awayTeamId: 't2', status: 'scheduled', homeScore: null, awayScore: null, playedAt: null },
      { id: 'm3', round: 3, homeTeamId: 't3', awayTeamId: 't1', status: 'scheduled', homeScore: null, awayScore: null, playedAt: null },
    ],
    maxTeams: 4,
    currentRound: 1,
    createdAt: '2025-01-01',
  };
  localStorage.setItem('quadra_legacy_leagues', JSON.stringify([testLeague]));

  const nextMatch = await getNextUserMatch('next-match-lg', BACKEND_LOCAL);
  assertTruthy('finds next user match', nextMatch);
  assert('next user match is m2 (first scheduled match with user team)', nextMatch.id, 'm2');
}

{
  resetMocks();
  // League with no user team
  const testLeague = {
    id: 'no-user-lg',
    name: 'No User Team',
    season: 1,
    status: 'in-progress',
    teams: [
      { id: 't1', name: 'A', isUserTeam: false, stats: { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, fantasyPts: 0 } },
    ],
    schedule: [
      { id: 'm1', round: 1, homeTeamId: 't1', awayTeamId: 't2', status: 'scheduled', homeScore: null, awayScore: null, playedAt: null },
    ],
    maxTeams: 4,
    currentRound: 1,
    createdAt: '2025-01-01',
  };
  localStorage.setItem('quadra_legacy_leagues', JSON.stringify([testLeague]));

  const result = await getNextUserMatch('no-user-lg', BACKEND_LOCAL);
  assert('returns null when no user team exists', result, null);
}

// ===========================================================================
// getNextUserMatch — FIRESTORE (not supported, returns null)
// ===========================================================================

section('getNextUserMatch -- FIRESTORE');

{
  const result = await getNextUserMatch('any-id', BACKEND_FIRESTORE);
  assert('firestore returns null', result, null);
}

// ===========================================================================
// startNewSeason — LOCAL
// ===========================================================================

section('startNewSeason -- LOCAL');

{
  resetMocks();
  // Create a league with 2 teams and a schedule (simulates completed season)
  const created = await createLeague(
    { name: 'Season League' },
    {},
    { name: 'My Team', players: [] },
  );
  await addAITeams(created.id, 1, BACKEND_LOCAL);
  await generateSchedule(created.id, BACKEND_LOCAL);

  // Verify initial state
  let league = await getLeague(created.id, BACKEND_LOCAL);
  assert('initial season is 1', league.season, 1);
  assert('initial status is in-progress', league.status, 'in-progress');
  const initialScheduleLength = league.schedule.length;
  assertTruthy('initial schedule has matches', initialScheduleLength > 0);

  // Start new season
  await startNewSeason(created.id, BACKEND_LOCAL);

  league = await getLeague(created.id, BACKEND_LOCAL);
  assert('season incremented to 2', league.season, 2);
  assert('status is in-progress (new schedule generated)', league.status, 'in-progress');
  assertTruthy('new schedule has matches', league.schedule.length > 0);
  assert('team stats wins reset to 0', league.teams[0].stats.wins, 0);
  assert('team stats played reset to 0', league.teams[0].stats.played, 0);
  assert('team stats pointsFor reset to 0', league.teams[0].stats.pointsFor, 0);
}

// ===========================================================================
// startNewSeason — FIRESTORE (not implemented)
// ===========================================================================

section('startNewSeason -- FIRESTORE (not implemented)');

{
  await assertThrows(
    'throws not-implemented for firestore backend',
    () => startNewSeason('any-id', BACKEND_FIRESTORE),
    'future update',
  );
}

// ===========================================================================
// Edge cases: createLeague team config delegation
// ===========================================================================

section('createLeague -- Firestore team config defaults');

{
  resetMocks();
  let capturedTeamConfig = null;
  globalThis.__firebaseMock__.createLeagueWithTeam = async (uid, config, teamConfig) => {
    capturedTeamConfig = teamConfig;
    return { data: { leagueId: 'x', inviteCode: 'Y', teamId: 'z', seasonId: 'w' } };
  };

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };

  // When userTeamData has no name, it should default to config.name + ' FC'
  await createLeague({ name: 'My League' }, authCtx, {});
  assert('default team name is league name + " FC"', capturedTeamConfig.name, 'My League FC');
}

{
  resetMocks();
  let capturedTeamConfig = null;
  globalThis.__firebaseMock__.createLeagueWithTeam = async (uid, config, teamConfig) => {
    capturedTeamConfig = teamConfig;
    return { data: { leagueId: 'x', inviteCode: 'Y', teamId: 'z', seasonId: 'w' } };
  };

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  await createLeague({ name: 'League' }, authCtx, { name: 'Custom Name', city: 'SP' });
  assert('explicit team name is used', capturedTeamConfig.name, 'Custom Name');
  assert('explicit city is passed through', capturedTeamConfig.city, 'SP');
}

// ===========================================================================
// Edge cases: getLeagues status normalization
// ===========================================================================

section('getLeagues -- Firestore status normalization');

{
  resetMocks();
  globalThis.__firebaseMock__.getUserLeagues = async () => ({
    data: [
      { id: 'lg-a', name: 'A', status: 'draft', teamIds: [], createdAt: '2025-01-01' },
      { id: 'lg-b', name: 'B', status: 'offseason', teamIds: [], createdAt: '2025-01-01' },
      { id: 'lg-c', name: 'C', status: 'completed', teamIds: [], createdAt: '2025-01-01' },
      { id: 'lg-d', name: 'D', status: 'setup', teamIds: [], createdAt: '2025-01-01' },
      { id: 'lg-e', name: 'E', status: null, teamIds: [], createdAt: '2025-01-01' },
    ],
  });

  const authCtx = { isAuthenticated: true, user: { uid: 'user-1' } };
  const leagues = await getLeagues(authCtx);

  assert('"draft" normalized to "setup"', leagues[0].status, 'setup');
  assert('"offseason" normalized to "completed"', leagues[1].status, 'completed');
  assert('"completed" stays "completed"', leagues[2].status, 'completed');
  assert('"setup" stays "setup"', leagues[3].status, 'setup');
  assert('null status defaults to "setup"', leagues[4].status, 'setup');
}

// ===========================================================================
// Edge cases: round-robin schedule correctness (4 teams)
// ===========================================================================

section('generateSchedule -- round-robin correctness');

{
  resetMocks();
  const created = await createLeague(
    { name: 'RR League', maxTeams: 4 },
    {},
    { name: 'Team A', players: [] },
  );
  await addAITeams(created.id, 3, BACKEND_LOCAL);
  await generateSchedule(created.id, BACKEND_LOCAL);

  const league = await getLeague(created.id, BACKEND_LOCAL);
  // 4 teams, round robin home+away = (4-1)*2 rounds = 6 rounds
  // Each round has 2 matches (4/2), so 12 total matches
  assert('4 teams produce 12 matches', league.schedule.length, 12);

  // Each team should appear in 6 matches (plays each opponent twice)
  const teamIds = league.teams.map(t => t.id);
  for (const tid of teamIds) {
    const appearances = league.schedule.filter(
      m => m.homeTeamId === tid || m.awayTeamId === tid
    ).length;
    assert(`team ${tid.substring(0, 8)}... appears in 6 matches`, appearances, 6);
  }
}

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + '='.repeat(50));
console.log(`  leagueService tests: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(50));

if (failCount > 0) {
  process.exit(1);
}
process.exit(0);
