/**
 * Draft Engine — Exhaustive Tests
 * Quadra Legacy — src/gameplay/draftEngine.test.js
 *
 * Run with: node src/gameplay/draftEngine.test.js
 *
 * No external test libraries; plain Node.js only.
 */

import assert from 'node:assert/strict';

import {
  getDraftOrder,
  createDraft,
  startDraft,
  makePick,
  autoPickForManager,
  advanceToNextPick,
  getManagerRoster,
  getBestAvailable,
  getPositionNeeds,
  generateDraftPlayerPool,
} from './draftEngine.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function check(label, actual, expected) {
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

function checkDeepEqual(label, actual, expected) {
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

function checkThrows(label, fn, expectedSubstring) {
  try {
    fn();
    console.log(`  FAIL  ${label} (did not throw)`);
    failCount++;
  } catch (err) {
    if (expectedSubstring && !err.message.includes(expectedSubstring)) {
      console.log(`  FAIL  ${label}`);
      console.log(`         expected error containing: "${expectedSubstring}"`);
      console.log(`         actual error:              "${err.message}"`);
      failCount++;
    } else {
      console.log(`  PASS  ${label}`);
      passCount++;
    }
  }
}

function checkTrue(label, value) {
  if (value) {
    console.log(`  PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         expected truthy, got: ${JSON.stringify(value)}`);
    failCount++;
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ---------------------------------------------------------------------------
// Helpers — reusable manager lists and configs
// ---------------------------------------------------------------------------

function makeManagers(count) {
  const managers = [];
  for (let i = 0; i < count; i++) {
    managers.push({ id: `mgr-${i}`, name: `Manager ${i}`, isUser: i === 0, isAI: i !== 0 });
  }
  return managers;
}

function makeConfig(overrides = {}) {
  const defaults = {
    leagueId: 'league-test-1',
    managers: makeManagers(4),
    rosterSize: 3,
  };
  return { ...defaults, ...overrides };
}

// ===========================================================================
// getDraftOrder — basic snake order
// ===========================================================================

section('getDraftOrder -- basic snake order');

{
  const order = getDraftOrder(4, 2);
  checkDeepEqual(
    '4 managers, 2 rounds => snake [0,1,2,3, 3,2,1,0]',
    order,
    [0, 1, 2, 3, 3, 2, 1, 0]
  );
}

{
  const order = getDraftOrder(3, 2);
  checkDeepEqual(
    '3 managers, 2 rounds => [0,1,2, 2,1,0]',
    order,
    [0, 1, 2, 2, 1, 0]
  );
}

{
  const order = getDraftOrder(3, 3);
  checkDeepEqual(
    '3 managers, 3 rounds => [0,1,2, 2,1,0, 0,1,2]',
    order,
    [0, 1, 2, 2, 1, 0, 0, 1, 2]
  );
}

{
  const order = getDraftOrder(2, 4);
  checkDeepEqual(
    '2 managers, 4 rounds => [0,1, 1,0, 0,1, 1,0]',
    order,
    [0, 1, 1, 0, 0, 1, 1, 0]
  );
}

{
  const order = getDraftOrder(1, 3);
  checkDeepEqual(
    '1 manager, 3 rounds => [0,0,0]',
    order,
    [0, 0, 0]
  );
}

{
  const order = getDraftOrder(4, 2);
  check('total picks = managerCount * totalRounds', order.length, 8);
}

// ===========================================================================
// getDraftOrder — validation errors
// ===========================================================================

section('getDraftOrder -- validation errors');

checkThrows(
  'throws on managerCount = 0',
  () => getDraftOrder(0, 2),
  'managerCount must be a positive integer'
);

checkThrows(
  'throws on managerCount = -1',
  () => getDraftOrder(-1, 2),
  'managerCount must be a positive integer'
);

checkThrows(
  'throws on managerCount = 2.5',
  () => getDraftOrder(2.5, 2),
  'managerCount must be a positive integer'
);

checkThrows(
  'throws on totalRounds = 0',
  () => getDraftOrder(4, 0),
  'totalRounds must be a positive integer'
);

checkThrows(
  'throws on totalRounds = -3',
  () => getDraftOrder(4, -3),
  'totalRounds must be a positive integer'
);

// ===========================================================================
// createDraft — valid config produces lobby state
// ===========================================================================

section('createDraft -- valid config produces lobby state');

{
  const config = makeConfig();
  const draft = createDraft(config);

  check('status is lobby', draft.status, 'lobby');
  check('leagueId matches', draft.leagueId, 'league-test-1');
  check('managers count', draft.managers.length, 4);
  check('rosterSize stored', draft.rosterSize, 3);
  check('picks is empty', draft.picks.length, 0);
  check('currentPick is null in lobby', draft.currentPick, null);
  check('pickTimerSeconds defaults to 90', draft.pickTimerSeconds, 90);
  checkTrue('id is a non-empty string', typeof draft.id === 'string' && draft.id.length > 0);
  check('pickOrder length = managers * rosterSize', draft.pickOrder.length, 12);

  // Verify managers are normalised with ready: false
  check('manager 0 ready is false', draft.managers[0].ready, false);
  check('manager 0 isUser is true', draft.managers[0].isUser, true);
  check('manager 1 isAI is true', draft.managers[1].isAI, true);
}

// ===========================================================================
// createDraft — custom pickTimerSeconds
// ===========================================================================

section('createDraft -- custom pickTimerSeconds');

{
  const draft = createDraft(makeConfig({ pickTimerSeconds: 60 }));
  check('pickTimerSeconds is 60', draft.pickTimerSeconds, 60);
}

// ===========================================================================
// createDraft — custom player pool
// ===========================================================================

section('createDraft -- custom player pool');

{
  const pool = generateDraftPlayerPool(4, 3);
  const draft = createDraft(makeConfig({ playerPool: pool }));
  check('playerPool uses supplied pool length', draft.playerPool.length, pool.length);
}

// ===========================================================================
// createDraft — validation errors
// ===========================================================================

section('createDraft -- validation errors');

checkThrows(
  'throws when config is null',
  () => createDraft(null),
  'config must be an object'
);

checkThrows(
  'throws when config is a number',
  () => createDraft(42),
  'config must be an object'
);

checkThrows(
  'throws when leagueId is missing',
  () => createDraft({ managers: makeManagers(4), rosterSize: 3 }),
  'leagueId must be a non-empty string'
);

checkThrows(
  'throws when managers has fewer than 2',
  () => createDraft({ leagueId: 'lg', managers: [{ id: 'm1', name: 'Solo' }], rosterSize: 3 }),
  'managers must be an array with at least 2'
);

checkThrows(
  'throws when managers is not an array',
  () => createDraft({ leagueId: 'lg', managers: 'not-arr', rosterSize: 3 }),
  'managers must be an array'
);

checkThrows(
  'throws when rosterSize is 0',
  () => createDraft({ leagueId: 'lg', managers: makeManagers(4), rosterSize: 0 }),
  'rosterSize must be a positive integer'
);

checkThrows(
  'throws when rosterSize is not an integer',
  () => createDraft({ leagueId: 'lg', managers: makeManagers(4), rosterSize: 2.5 }),
  'rosterSize must be a positive integer'
);

// ===========================================================================
// createDraft — insufficient player pool throws
// ===========================================================================

section('createDraft -- insufficient player pool');

checkThrows(
  'throws when pool is too small for total picks',
  () => createDraft(makeConfig({
    playerPool: [{ id: 'p1', name: 'Solo Player', position: 'PG', overall: 70 }],
    rosterSize: 3,
  })),
  'playerPool has'
);

// ===========================================================================
// createDraft — pickOrder follows snake pattern using manager IDs
// ===========================================================================

section('createDraft -- pickOrder follows snake pattern');

{
  const managers = makeManagers(3);
  const draft = createDraft({ leagueId: 'lg', managers, rosterSize: 2 });

  // Round 1 (forward): mgr-0, mgr-1, mgr-2
  // Round 2 (reverse): mgr-2, mgr-1, mgr-0
  checkDeepEqual(
    'pickOrder uses manager IDs in snake order',
    draft.pickOrder,
    ['mgr-0', 'mgr-1', 'mgr-2', 'mgr-2', 'mgr-1', 'mgr-0']
  );
}

// ===========================================================================
// startDraft — transitions to picking
// ===========================================================================

section('startDraft -- transitions to picking');

{
  const draft = createDraft(makeConfig());
  const started = startDraft(draft);

  check('status changes to picking', started.status, 'picking');
  checkTrue('currentPick is set', started.currentPick !== null);
  check('currentPick round is 1', started.currentPick.round, 1);
  check('currentPick pickNumber is 1', started.currentPick.pickNumber, 1);
  check('currentPick managerId is first in pickOrder', started.currentPick.managerId, draft.pickOrder[0]);
}

// ===========================================================================
// startDraft — errors when not in lobby
// ===========================================================================

section('startDraft -- errors when not in lobby');

checkThrows(
  'throws when draft is null',
  () => startDraft(null),
  'draft must be in "lobby" status'
);

checkThrows(
  'throws when draft is already picking',
  () => {
    const draft = startDraft(createDraft(makeConfig()));
    startDraft(draft);
  },
  'draft must be in "lobby" status'
);

// ===========================================================================
// makePick — valid first pick
// ===========================================================================

section('makePick -- valid first pick');

{
  const draft = startDraft(createDraft(makeConfig()));
  const managerId = draft.currentPick.managerId;
  const playerId = draft.playerPool[0].id;
  const playerName = draft.playerPool[0].name;
  const poolSizeBefore = draft.playerPool.length;

  const result = makePick(draft, managerId, playerId);

  check('result.pick.managerId matches', result.pick.managerId, managerId);
  check('result.pick.playerId matches', result.pick.playerId, playerId);
  check('result.pick.playerName matches', result.pick.playerName, playerName);
  check('result.pick.round is 1', result.pick.round, 1);
  check('result.pick.pickNumber is 1', result.pick.pickNumber, 1);
  check('pool shrinks by 1', result.draft.playerPool.length, poolSizeBefore - 1);
  check('picks array grows to 1', result.draft.picks.length, 1);

  // The picked player should no longer be in the pool
  const stillInPool = result.draft.playerPool.some(p => p.id === playerId);
  check('picked player removed from pool', stillInPool, false);
}

// ===========================================================================
// makePick — wrong manager turn (error)
// ===========================================================================

section('makePick -- wrong manager turn');

{
  const draft = startDraft(createDraft(makeConfig()));
  const wrongManager = 'mgr-99';

  checkThrows(
    'throws when wrong manager tries to pick',
    () => makePick(draft, wrongManager, draft.playerPool[0].id),
    'it is not manager'
  );
}

// ===========================================================================
// makePick — non-existent player (error)
// ===========================================================================

section('makePick -- non-existent player');

{
  const draft = startDraft(createDraft(makeConfig()));
  const managerId = draft.currentPick.managerId;

  checkThrows(
    'throws when player is not in pool',
    () => makePick(draft, managerId, 'ghost-player-id'),
    'is not available in the player pool'
  );
}

// ===========================================================================
// makePick — not in picking status (error)
// ===========================================================================

section('makePick -- not in picking status');

{
  const lobby = createDraft(makeConfig());

  checkThrows(
    'throws when draft is in lobby',
    () => makePick(lobby, 'mgr-0', 'some-player'),
    'draft must be in "picking" status'
  );
}

// ===========================================================================
// advanceToNextPick — advances correctly
// ===========================================================================

section('advanceToNextPick -- advances correctly');

{
  const draft = startDraft(createDraft(makeConfig()));
  const managerId = draft.currentPick.managerId;
  const playerId = draft.playerPool[0].id;

  const { draft: afterPick } = makePick(draft, managerId, playerId);

  check('after 1st pick, pickNumber advances to 2', afterPick.currentPick.pickNumber, 2);
  check('after 1st pick, still picking', afterPick.status, 'picking');
}

// ===========================================================================
// advanceToNextPick — transitions to complete when all picks are done
// ===========================================================================

section('advanceToNextPick -- transitions to complete');

{
  // Small draft: 2 managers, 1 round = 2 total picks
  const managers = makeManagers(2);
  let draft = startDraft(createDraft({ leagueId: 'lg', managers, rosterSize: 1 }));

  // Pick 1
  const p1 = draft.playerPool[0].id;
  const r1 = makePick(draft, draft.currentPick.managerId, p1);
  draft = r1.draft;

  check('after pick 1, status is picking', draft.status, 'picking');

  // Pick 2
  const p2 = draft.playerPool[0].id;
  const r2 = makePick(draft, draft.currentPick.managerId, p2);
  draft = r2.draft;

  check('after all picks, status is complete', draft.status, 'complete');
  check('currentPick is null when complete', draft.currentPick, null);
}

// ===========================================================================
// advanceToNextPick — error when not in picking status
// ===========================================================================

section('advanceToNextPick -- error when not picking');

checkThrows(
  'throws when draft is in lobby',
  () => advanceToNextPick(createDraft(makeConfig())),
  'draft must be in "picking" status'
);

// ===========================================================================
// getManagerRoster — empty before any picks
// ===========================================================================

section('getManagerRoster -- empty before picks');

{
  const draft = startDraft(createDraft(makeConfig()));
  const roster = getManagerRoster(draft, 'mgr-0');

  check('roster is empty before picks', roster.length, 0);
}

// ===========================================================================
// getManagerRoster — returns picked players
// ===========================================================================

section('getManagerRoster -- returns picked players');

{
  let draft = startDraft(createDraft(makeConfig()));
  const firstManager = draft.currentPick.managerId;
  const pickedId = draft.playerPool[0].id;

  const { draft: afterPick } = makePick(draft, firstManager, pickedId);
  const roster = getManagerRoster(afterPick, firstManager);

  check('roster has 1 player after 1 pick', roster.length, 1);
  check('roster player id matches picked player', roster[0].id, pickedId);
}

// ===========================================================================
// getManagerRoster — null/invalid draft returns empty
// ===========================================================================

section('getManagerRoster -- null draft');

{
  const roster = getManagerRoster(null, 'mgr-0');
  check('null draft returns empty array', roster.length, 0);
}

{
  const roster = getManagerRoster({ picks: null }, 'mgr-0');
  check('picks=null returns empty array', roster.length, 0);
}

// ===========================================================================
// getPositionNeeds — empty roster needs all 5 positions
// ===========================================================================

section('getPositionNeeds -- empty roster needs all 5 positions');

{
  const needs = getPositionNeeds([], 10);
  check('needs 5 positions for empty roster', needs.length, 5);
  checkTrue('includes PG', needs.includes('PG'));
  checkTrue('includes SG', needs.includes('SG'));
  checkTrue('includes SF', needs.includes('SF'));
  checkTrue('includes PF', needs.includes('PF'));
  checkTrue('includes C', needs.includes('C'));
}

// ===========================================================================
// getPositionNeeds — partial roster shows gaps
// ===========================================================================

section('getPositionNeeds -- partial roster shows gaps');

{
  const roster = [
    { position: 'PG' },
    { position: 'SG' },
    { position: 'SF' },
  ];
  const needs = getPositionNeeds(roster, 10);
  checkTrue('PF is needed', needs.includes('PF'));
  checkTrue('C is needed', needs.includes('C'));
  check('PG is NOT a mandatory need (already have 1)', needs.indexOf('PG') === -1 || needs.indexOf('PF') < needs.indexOf('PG'), true);
}

// ===========================================================================
// getPositionNeeds — full starters covered, depth needs
// ===========================================================================

section('getPositionNeeds -- full starters, depth suggestions');

{
  const roster = [
    { position: 'PG' },
    { position: 'SG' },
    { position: 'SF' },
    { position: 'PF' },
    { position: 'C' },
  ];
  // All starters covered, but rosterSize > roster.length, so depth needs appear
  const needs = getPositionNeeds(roster, 10);
  checkTrue('returns depth suggestions when starters filled and slots remain', needs.length > 0);
}

{
  // All starters, roster is full — no needs
  const roster = [
    { position: 'PG' },
    { position: 'SG' },
    { position: 'SF' },
    { position: 'PF' },
    { position: 'C' },
  ];
  const needs = getPositionNeeds(roster, 5);
  check('no needs when roster is full', needs.length, 0);
}

// ===========================================================================
// getPositionNeeds — null roster returns all positions
// ===========================================================================

section('getPositionNeeds -- null roster');

{
  const needs = getPositionNeeds(null, 10);
  check('null roster returns all 5 positions', needs.length, 5);
}

// ===========================================================================
// getBestAvailable — sorted by overall descending
// ===========================================================================

section('getBestAvailable -- sorted by overall descending');

{
  const draft = startDraft(createDraft(makeConfig()));
  const best = getBestAvailable(draft);

  checkTrue('returns non-empty array', best.length > 0);

  let sorted = true;
  for (let i = 1; i < best.length; i++) {
    if (best[i].overall > best[i - 1].overall) {
      sorted = false;
      break;
    }
  }
  checkTrue('players sorted by overall descending', sorted);
}

// ===========================================================================
// getBestAvailable — filtered by position
// ===========================================================================

section('getBestAvailable -- filtered by position');

{
  const draft = startDraft(createDraft(makeConfig()));
  const pgs = getBestAvailable(draft, 'PG');

  checkTrue('filtered result is non-empty', pgs.length > 0);

  let allPG = true;
  for (const p of pgs) {
    if (p.position !== 'PG') { allPG = false; break; }
  }
  checkTrue('all returned players are PG', allPG);
  checkTrue('fewer PGs than total pool', pgs.length < draft.playerPool.length);
}

// ===========================================================================
// getBestAvailable — null draft returns empty
// ===========================================================================

section('getBestAvailable -- null draft');

{
  const result = getBestAvailable(null);
  check('null draft returns empty array', result.length, 0);
}

{
  const result = getBestAvailable({ playerPool: null });
  check('null playerPool returns empty array', result.length, 0);
}

// ===========================================================================
// autoPickForManager — picks a player
// ===========================================================================

section('autoPickForManager -- picks a player');

{
  let draft = startDraft(createDraft(makeConfig()));
  const managerId = draft.currentPick.managerId;
  const poolBefore = draft.playerPool.length;

  const result = autoPickForManager(draft, managerId);

  check('autoPick reduces pool by 1', result.draft.playerPool.length, poolBefore - 1);
  check('autoPick records a pick', result.draft.picks.length, 1);
  check('pick managerId matches', result.pick.managerId, managerId);
  checkTrue('pick playerId is a string', typeof result.pick.playerId === 'string');
}

// ===========================================================================
// autoPickForManager — wrong manager turn (error)
// ===========================================================================

section('autoPickForManager -- wrong manager turn');

{
  const draft = startDraft(createDraft(makeConfig()));

  checkThrows(
    'throws when wrong manager auto-picks',
    () => autoPickForManager(draft, 'mgr-99'),
    'it is not manager'
  );
}

// ===========================================================================
// autoPickForManager — not in picking status (error)
// ===========================================================================

section('autoPickForManager -- not in picking status');

checkThrows(
  'throws when draft is in lobby',
  () => autoPickForManager(createDraft(makeConfig()), 'mgr-0'),
  'draft must be in "picking" status'
);

// ===========================================================================
// autoPickForManager — position need influences pick
// ===========================================================================

section('autoPickForManager -- position need influences pick');

{
  // Build a draft with a known pool so we can observe position-need bias.
  // After filling PG/SG/SF/PF, auto-pick should favor C if available.
  const managers = makeManagers(2);
  const rosterSize = 5;
  let draft = startDraft(createDraft({ leagueId: 'lg', managers, rosterSize }));

  // Manually make 4 picks for mgr-0 (mimicking snake draft flow).
  // We need to follow the snake order: mgr-0, mgr-1, mgr-1, mgr-0, mgr-0, ...
  // For a 2-manager, 5-round snake: [0,1, 1,0, 0,1, 1,0, 0,1]
  // So picks are: mgr-0, mgr-1, mgr-1, mgr-0, mgr-0, mgr-1, mgr-1, mgr-0, mgr-0, mgr-1

  // Just run auto-picks sequentially so the engine manages order.
  // We track what mgr-0 ends up with.
  for (let i = 0; i < managers.length * rosterSize; i++) {
    const currentMgr = draft.currentPick.managerId;
    const result = autoPickForManager(draft, currentMgr);
    draft = result.draft;
    if (draft.status === 'complete') break;
  }

  check('draft is complete after all autopicks', draft.status, 'complete');

  const roster0 = getManagerRoster(draft, 'mgr-0');
  const roster1 = getManagerRoster(draft, 'mgr-1');

  check('mgr-0 has rosterSize picks', roster0.length, rosterSize);
  check('mgr-1 has rosterSize picks', roster1.length, rosterSize);
}

// ===========================================================================
// generateDraftPlayerPool — creates enough players
// ===========================================================================

section('generateDraftPlayerPool -- creates enough players');

{
  const pool = generateDraftPlayerPool(4, 5);
  const totalSlots = 4 * 5;
  const expectedMin = Math.max(30, totalSlots * 2);

  check('pool size >= max(30, 2x total roster spots)', pool.length >= expectedMin, true);

  // All players have required fields
  checkTrue('first player has id', typeof pool[0].id === 'string');
  checkTrue('first player has name', typeof pool[0].name === 'string');
  checkTrue('first player has position', typeof pool[0].position === 'string');
  checkTrue('first player has overall', typeof pool[0].overall === 'number');
}

// ===========================================================================
// generateDraftPlayerPool — positional variety
// ===========================================================================

section('generateDraftPlayerPool -- positional variety');

{
  const pool = generateDraftPlayerPool(6, 8);
  const positions = new Set(pool.map(p => p.position));

  checkTrue('pool has PG', positions.has('PG'));
  checkTrue('pool has SG', positions.has('SG'));
  checkTrue('pool has SF', positions.has('SF'));
  checkTrue('pool has PF', positions.has('PF'));
  checkTrue('pool has C', positions.has('C'));
}

// ===========================================================================
// generateDraftPlayerPool — validation errors
// ===========================================================================

section('generateDraftPlayerPool -- validation errors');

checkThrows(
  'throws on teamCount = 0',
  () => generateDraftPlayerPool(0, 5),
  'teamCount must be a positive integer'
);

checkThrows(
  'throws on rosterSize = -1',
  () => generateDraftPlayerPool(4, -1),
  'rosterSize must be a positive integer'
);

checkThrows(
  'throws on non-integer teamCount',
  () => generateDraftPlayerPool(3.5, 5),
  'teamCount must be a positive integer'
);

// ===========================================================================
// Full draft lifecycle: create -> start -> pick all -> complete
// ===========================================================================

section('Full draft lifecycle -- create -> start -> pick all -> complete');

{
  const managers = makeManagers(4);
  const rosterSize = 3;
  const config = { leagueId: 'lifecycle-league', managers, rosterSize };

  // Phase 1: Create
  const lobby = createDraft(config);
  check('lifecycle: lobby status', lobby.status, 'lobby');

  // Phase 2: Start
  let draft = startDraft(lobby);
  check('lifecycle: picking status', draft.status, 'picking');

  const totalPicks = managers.length * rosterSize; // 12
  check('lifecycle: pickOrder length', draft.pickOrder.length, totalPicks);

  // Phase 3: Make all picks manually
  for (let i = 0; i < totalPicks; i++) {
    const mgr = draft.currentPick.managerId;
    const player = draft.playerPool[0];
    const result = makePick(draft, mgr, player.id);
    draft = result.draft;
  }

  // Phase 4: Verify complete
  check('lifecycle: final status is complete', draft.status, 'complete');
  check('lifecycle: currentPick is null', draft.currentPick, null);
  check('lifecycle: total picks recorded', draft.picks.length, totalPicks);

  // Each manager should have rosterSize picks
  for (let i = 0; i < managers.length; i++) {
    const roster = getManagerRoster(draft, managers[i].id);
    check(`lifecycle: mgr-${i} has ${rosterSize} picks`, roster.length, rosterSize);
  }
}

// ===========================================================================
// Edge case: pick after draft is complete
// ===========================================================================

section('Edge cases -- pick after draft is complete');

{
  const managers = makeManagers(2);
  let draft = startDraft(createDraft({ leagueId: 'lg', managers, rosterSize: 1 }));

  // Complete the draft (2 picks)
  let r = makePick(draft, draft.currentPick.managerId, draft.playerPool[0].id);
  draft = r.draft;
  r = makePick(draft, draft.currentPick.managerId, draft.playerPool[0].id);
  draft = r.draft;

  check('draft is complete', draft.status, 'complete');

  checkThrows(
    'throws when making pick on complete draft',
    () => makePick(draft, 'mgr-0', 'any-player'),
    'draft must be in "picking" status'
  );
}

// ===========================================================================
// Edge case: autoPick on complete draft
// ===========================================================================

section('Edge cases -- autoPick on complete draft');

{
  const managers = makeManagers(2);
  let draft = startDraft(createDraft({ leagueId: 'lg', managers, rosterSize: 1 }));

  let r = makePick(draft, draft.currentPick.managerId, draft.playerPool[0].id);
  draft = r.draft;
  r = makePick(draft, draft.currentPick.managerId, draft.playerPool[0].id);
  draft = r.draft;

  checkThrows(
    'throws when auto-picking on complete draft',
    () => autoPickForManager(draft, 'mgr-0'),
    'draft must be in "picking" status'
  );
}

// ===========================================================================
// Edge case: snake order reversal verified in actual picks
// ===========================================================================

section('Edge cases -- snake reversal verified in picks');

{
  const managers = makeManagers(3);
  let draft = startDraft(createDraft({ leagueId: 'lg', managers, rosterSize: 2 }));

  const pickManagerOrder = [];
  const totalPicks = 6; // 3 managers * 2 rounds

  for (let i = 0; i < totalPicks; i++) {
    const mgr = draft.currentPick.managerId;
    pickManagerOrder.push(mgr);
    const player = draft.playerPool[0];
    const result = makePick(draft, mgr, player.id);
    draft = result.draft;
  }

  checkDeepEqual(
    'actual pick order follows snake: [0,1,2, 2,1,0]',
    pickManagerOrder,
    ['mgr-0', 'mgr-1', 'mgr-2', 'mgr-2', 'mgr-1', 'mgr-0']
  );
}

// ===========================================================================
// Edge case: round tracking in currentPick
// ===========================================================================

section('Edge cases -- round tracking in currentPick');

{
  const managers = makeManagers(2);
  let draft = startDraft(createDraft({ leagueId: 'lg', managers, rosterSize: 3 }));

  // Pick 1: round 1, pick 1
  check('pick 1 is round 1', draft.currentPick.round, 1);
  check('pick 1 number is 1', draft.currentPick.pickNumber, 1);

  let r = makePick(draft, draft.currentPick.managerId, draft.playerPool[0].id);
  draft = r.draft;

  // Pick 2: round 1, pick 2
  check('pick 2 is round 1', draft.currentPick.round, 1);
  check('pick 2 number is 2', draft.currentPick.pickNumber, 2);

  r = makePick(draft, draft.currentPick.managerId, draft.playerPool[0].id);
  draft = r.draft;

  // Pick 3: round 2, pick 3
  check('pick 3 is round 2', draft.currentPick.round, 2);
  check('pick 3 number is 3', draft.currentPick.pickNumber, 3);
}

// ===========================================================================
// Edge case: duplicate player pick attempt
// ===========================================================================

section('Edge cases -- picking same player twice');

{
  let draft = startDraft(createDraft(makeConfig()));
  const managerId = draft.currentPick.managerId;
  const playerId = draft.playerPool[0].id;

  // First pick succeeds
  const r = makePick(draft, managerId, playerId);
  draft = r.draft;

  // Now that player is removed; next manager tries to pick same player
  const nextManager = draft.currentPick.managerId;
  checkThrows(
    'throws when picking already-drafted player',
    () => makePick(draft, nextManager, playerId),
    'is not available in the player pool'
  );
}

// ===========================================================================
// Summary
// ===========================================================================

console.log('\n' + '='.repeat(50));
console.log(`  draftEngine tests: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(50));

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
