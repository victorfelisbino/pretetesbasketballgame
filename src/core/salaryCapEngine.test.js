/**
 * Salary Cap Engine Tests — Quadra Legacy
 *
 * Run with: node src/core/salaryCapEngine.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TIER_SALARY_CAPS,
  REVENUE_CONFIG,
  getTierSalaryCap,
  createTeamBudget,
  calculateAvailableCapSpace,
  canAffordPlayer,
  signPlayer,
  releasePlayer,
  calculatePlayerSalary,
  processSeasonRevenue,
  validateTradeFinancials,
} from './salaryCapEngine.js';

// ---------------------------------------------------------------------------
// Config immutability
// ---------------------------------------------------------------------------
describe('Config immutability', () => {
  it('TIER_SALARY_CAPS is frozen', () => {
    assert.ok(Object.isFrozen(TIER_SALARY_CAPS));
  });

  it('REVENUE_CONFIG is frozen', () => {
    assert.ok(Object.isFrozen(REVENUE_CONFIG));
  });

  it('TIER_BASE_SPONSORSHIP inside REVENUE_CONFIG is frozen', () => {
    assert.ok(Object.isFrozen(REVENUE_CONFIG.TIER_BASE_SPONSORSHIP));
  });

  it('cannot mutate TIER_SALARY_CAPS values', () => {
    assert.throws(() => { TIER_SALARY_CAPS.amateur = 999; }, TypeError);
    assert.equal(TIER_SALARY_CAPS.amateur, 5_000_000);
  });

  it('cannot add new keys to TIER_SALARY_CAPS', () => {
    assert.throws(() => { TIER_SALARY_CAPS.legendary = 100_000_000; }, TypeError);
    assert.equal(TIER_SALARY_CAPS.legendary, undefined);
  });
});

// ---------------------------------------------------------------------------
// getTierSalaryCap
// ---------------------------------------------------------------------------
describe('getTierSalaryCap', () => {
  it('returns amateur cap for "amateur"', () => {
    assert.equal(getTierSalaryCap('amateur'), 5_000_000);
  });

  it('returns semi_pro cap', () => {
    assert.equal(getTierSalaryCap('semi_pro'), 12_000_000);
  });

  it('returns professional cap', () => {
    assert.equal(getTierSalaryCap('professional'), 18_000_000);
  });

  it('returns premier cap', () => {
    assert.equal(getTierSalaryCap('premier'), 20_000_000);
  });

  it('falls back to amateur for unknown tier', () => {
    assert.equal(getTierSalaryCap('legendary'), 5_000_000);
  });
});

// ---------------------------------------------------------------------------
// createTeamBudget
// ---------------------------------------------------------------------------
describe('createTeamBudget', () => {
  it('creates a default amateur budget', () => {
    const b = createTeamBudget('team-1');
    assert.equal(b.teamId, 'team-1');
    assert.equal(b.salaryCap, 5_000_000);
    assert.equal(b.totalSalaryCommitted, 0);
    assert.equal(b.availableCapSpace, 5_000_000);
    assert.equal(b.season, 1);
  });

  it('creates a premier budget', () => {
    const b = createTeamBudget('team-2', 'premier', 3);
    assert.equal(b.salaryCap, 20_000_000);
    assert.equal(b.season, 3);
  });

  it('creates a semi_pro budget', () => {
    const b = createTeamBudget('team-3', 'semi_pro');
    assert.equal(b.salaryCap, 12_000_000);
    assert.equal(b.availableCapSpace, 12_000_000);
  });

  it('creates a professional budget', () => {
    const b = createTeamBudget('team-4', 'professional', 5);
    assert.equal(b.salaryCap, 18_000_000);
    assert.equal(b.season, 5);
  });

  it('initialises empty playerSalaries', () => {
    const b = createTeamBudget('team-5');
    assert.deepEqual(b.playerSalaries, {});
  });

  it('initialises revenue fields to zero', () => {
    const b = createTeamBudget('team-6');
    assert.equal(b.revenue.wins, 0);
    assert.equal(b.revenue.playoffBonus, 0);
    assert.equal(b.revenue.championship, 0);
    assert.equal(b.revenue.sponsorship, 0);
    assert.equal(b.revenue.awards, 0);
  });

  it('initialises expenses to zero', () => {
    const b = createTeamBudget('team-7');
    assert.equal(b.expenses.playerSalaries, 0);
    assert.equal(b.expenses.staffCosts, 0);
  });
});

// ---------------------------------------------------------------------------
// calculateAvailableCapSpace
// ---------------------------------------------------------------------------
describe('calculateAvailableCapSpace', () => {
  it('returns full cap for fresh budget', () => {
    const b = createTeamBudget('t1');
    assert.equal(calculateAvailableCapSpace(b), 5_000_000);
  });

  it('returns reduced cap after sign', () => {
    let b = createTeamBudget('t2', 'premier');
    b = signPlayer(b, 'p1', 3_000_000);
    assert.equal(calculateAvailableCapSpace(b), 17_000_000);
  });
});

// ---------------------------------------------------------------------------
// canAffordPlayer
// ---------------------------------------------------------------------------
describe('canAffordPlayer', () => {
  it('returns true when salary fits within cap', () => {
    const b = createTeamBudget('t1');
    assert.equal(canAffordPlayer(b, 1_000_000), true);
  });

  it('returns true when salary exactly equals cap', () => {
    const b = createTeamBudget('t1');
    assert.equal(canAffordPlayer(b, 5_000_000), true);
  });

  it('returns false when salary exceeds cap', () => {
    const b = createTeamBudget('t1');
    assert.equal(canAffordPlayer(b, 5_000_001), false);
  });

  it('returns false after signing players that exhaust cap', () => {
    let b = createTeamBudget('t1');
    b = signPlayer(b, 'p1', 4_000_000);
    assert.equal(canAffordPlayer(b, 1_000_001), false);
  });
});

// ---------------------------------------------------------------------------
// signPlayer
// ---------------------------------------------------------------------------
describe('signPlayer', () => {
  it('adds player salary to budget', () => {
    const b = createTeamBudget('t1', 'premier');
    const b2 = signPlayer(b, 'p1', 5_000_000);
    assert.equal(b2.playerSalaries['p1'], 5_000_000);
    assert.equal(b2.totalSalaryCommitted, 5_000_000);
    assert.equal(b2.availableCapSpace, 15_000_000);
  });

  it('signs multiple players cumulatively', () => {
    let b = createTeamBudget('t1', 'premier');
    b = signPlayer(b, 'p1', 5_000_000);
    b = signPlayer(b, 'p2', 3_000_000);
    assert.equal(Object.keys(b.playerSalaries).length, 2);
    assert.equal(b.totalSalaryCommitted, 8_000_000);
    assert.equal(b.availableCapSpace, 12_000_000);
  });

  it('updates expenses.playerSalaries', () => {
    const b = createTeamBudget('t1', 'premier');
    const b2 = signPlayer(b, 'p1', 2_000_000);
    assert.equal(b2.expenses.playerSalaries, 2_000_000);
  });

  it('throws when salary exceeds cap space', () => {
    const b = createTeamBudget('t1');
    assert.throws(() => signPlayer(b, 'p1', 6_000_000), /Cannot afford player/);
  });

  it('does not mutate original budget on sign', () => {
    const b = createTeamBudget('t1', 'premier');
    const original = { ...b, playerSalaries: { ...b.playerSalaries } };
    signPlayer(b, 'p1', 1_000_000);
    assert.equal(b.totalSalaryCommitted, original.totalSalaryCommitted);
    assert.deepEqual(b.playerSalaries, original.playerSalaries);
  });
});

// ---------------------------------------------------------------------------
// releasePlayer
// ---------------------------------------------------------------------------
describe('releasePlayer', () => {
  it('removes player and restores cap space', () => {
    let b = createTeamBudget('t1', 'premier');
    b = signPlayer(b, 'p1', 5_000_000);
    const b2 = releasePlayer(b, 'p1');
    assert.equal(b2.playerSalaries['p1'], undefined);
    assert.equal(b2.totalSalaryCommitted, 0);
    assert.equal(b2.availableCapSpace, 20_000_000);
  });

  it('returns a copy when player not found', () => {
    const b = createTeamBudget('t1');
    const b2 = releasePlayer(b, 'nonexistent');
    assert.deepEqual(b2.playerSalaries, {});
    assert.equal(b2.totalSalaryCommitted, 0);
  });

  it('does not mutate original budget on release', () => {
    let b = createTeamBudget('t1', 'premier');
    b = signPlayer(b, 'p1', 5_000_000);
    const salaryBefore = b.totalSalaryCommitted;
    releasePlayer(b, 'p1');
    assert.equal(b.totalSalaryCommitted, salaryBefore);
    assert.equal(b.playerSalaries['p1'], 5_000_000);
  });
});

// ---------------------------------------------------------------------------
// calculatePlayerSalary
// ---------------------------------------------------------------------------
describe('calculatePlayerSalary', () => {
  it('uses player.overall when provided', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 25, position: 'SG' }, 'amateur');
    // 80 * 5000 = 400000; age 25 => *1.2 = 480000; SG => *1.0; round to 10k => 480000
    assert.equal(salary, 480_000);
  });

  it('computes overall from Attack/Defense/Stamina/ThreePoint', () => {
    const player = { Attack: 80, Defense: 60, Stamina: 70, ThreePoint: 90, age: 25, position: 'SF' };
    // overall = round((80+60+70+90)/4) = 75; 75*5000=375000; age25 *1.2 = 450000; SF *1.0; round => 450000
    const salary = calculatePlayerSalary(player, 'amateur');
    assert.equal(salary, 450_000);
  });

  it('falls back to overall 50 when attributes missing', () => {
    const salary = calculatePlayerSalary({ age: 25, position: 'SG' }, 'amateur');
    // 50 * 5000 = 250000; age 25 => *1.2 = 300000; SG *1.0; => 300000
    assert.equal(salary, 300_000);
  });

  it('applies semi_pro tier multiplier', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 25, position: 'SG' }, 'semi_pro');
    // 80 * 12000 = 960000; *1.2 = 1152000; round => 1150000
    assert.equal(salary, 1_150_000);
  });

  it('applies professional tier multiplier', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 25, position: 'SG' }, 'professional');
    // 80 * 20000 = 1600000; *1.2 = 1920000; round => 1920000
    assert.equal(salary, 1_920_000);
  });

  it('applies premier tier multiplier', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 25, position: 'SG' }, 'premier');
    // 80 * 30000 = 2400000; *1.2 = 2880000; round => 2880000
    assert.equal(salary, 2_880_000);
  });

  it('applies young age modifier (18-22)', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 20, position: 'SG' }, 'amateur');
    // 80*5000=400000; age20 => *0.8 = 320000; SG *1.0; round => 320000
    assert.equal(salary, 320_000);
  });

  it('applies veteran age modifier (29-33)', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 30, position: 'SG' }, 'amateur');
    // 80*5000=400000; *0.9 = 360000; round => 360000
    assert.equal(salary, 360_000);
  });

  it('applies old age modifier (34+)', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 36, position: 'SG' }, 'amateur');
    // 80*5000=400000; *0.6 = 240000; round => 240000
    assert.equal(salary, 240_000);
  });

  it('applies Center position scarcity (1.1x)', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 25, position: 'C' }, 'amateur');
    // 80*5000=400000; *1.2 = 480000; C *1.1 = 528000; round => 530000
    assert.equal(salary, 530_000);
  });

  it('applies PG position scarcity (1.05x)', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 25, position: 'PG' }, 'amateur');
    // 80*5000=400000; *1.2 = 480000; PG *1.05 = 504000; round => 500000
    assert.equal(salary, 500_000);
  });

  it('defaults age to 25 when not provided', () => {
    const salary = calculatePlayerSalary({ overall: 80, position: 'SG' }, 'amateur');
    // age defaults to 25 => prime range => *1.2
    // 80*5000=400000; *1.2 = 480000; SG *1.0; => 480000
    assert.equal(salary, 480_000);
  });

  it('falls back to amateur multiplier for unknown tier', () => {
    const salary = calculatePlayerSalary({ overall: 80, age: 25, position: 'SG' }, 'legendary');
    // amateur mult 5000; 80*5000=400000; *1.2 = 480000; => 480000
    assert.equal(salary, 480_000);
  });
});

// ---------------------------------------------------------------------------
// processSeasonRevenue
// ---------------------------------------------------------------------------
describe('processSeasonRevenue', () => {
  it('adds win revenue', () => {
    const b = createTeamBudget('t1');
    const results = { wins: 10 };
    const b2 = processSeasonRevenue(b, results, 'amateur');
    assert.equal(b2.revenue.wins, 2_500_000);
  });

  it('adds playoff bonus', () => {
    const b = createTeamBudget('t1');
    const results = { playoffAppearance: true };
    const b2 = processSeasonRevenue(b, results, 'amateur');
    assert.equal(b2.revenue.playoffBonus, 500_000);
  });

  it('adds championship bonus', () => {
    const b = createTeamBudget('t1');
    const results = { championship: true };
    const b2 = processSeasonRevenue(b, results, 'amateur');
    assert.equal(b2.revenue.championship, 1_000_000);
  });

  it('adds player of week awards revenue', () => {
    const b = createTeamBudget('t1');
    const results = { playerOfWeekAwards: 3 };
    const b2 = processSeasonRevenue(b, results, 'amateur');
    assert.equal(b2.revenue.awards, 300_000);
  });

  it('applies tier sponsorship', () => {
    const b = createTeamBudget('t1', 'premier');
    const results = {};
    const b2 = processSeasonRevenue(b, results, 'premier');
    assert.equal(b2.revenue.sponsorship, 5_000_000);
  });

  it('increases salaryCap by total revenue', () => {
    const b = createTeamBudget('t1');
    // wins: 10 => 2,500,000; sponsorship amateur => 500,000; total = 3,000,000
    const results = { wins: 10 };
    const b2 = processSeasonRevenue(b, results, 'amateur');
    assert.equal(b2.salaryCap, 5_000_000 + 3_000_000);
  });

  it('does not mutate original budget', () => {
    const b = createTeamBudget('t1');
    const capBefore = b.salaryCap;
    processSeasonRevenue(b, { wins: 10 }, 'amateur');
    assert.equal(b.salaryCap, capBefore);
  });

  it('computes full season with all bonuses', () => {
    const b = createTeamBudget('t1', 'professional');
    const results = { wins: 20, playoffAppearance: true, championship: true, playerOfWeekAwards: 5 };
    const b2 = processSeasonRevenue(b, results, 'professional');
    // wins: 20*250000 = 5000000; playoff: 500000; champ: 1000000; awards: 500000; sponsor: 3000000
    // total = 10000000
    assert.equal(b2.salaryCap, 18_000_000 + 10_000_000);
    assert.equal(b2.availableCapSpace, 28_000_000);
  });
});

// ---------------------------------------------------------------------------
// validateTradeFinancials
// ---------------------------------------------------------------------------
describe('validateTradeFinancials', () => {
  it('approves a balanced trade within cap', () => {
    let bA = createTeamBudget('A', 'premier');
    let bB = createTeamBudget('B', 'premier');
    bA = signPlayer(bA, 'p1', 3_000_000);
    bB = signPlayer(bB, 'p2', 3_000_000);
    const result = validateTradeFinancials(
      bA, bB,
      [{ salary: 3_000_000 }],
      [{ salary: 3_000_000 }],
    );
    assert.equal(result.valid, true);
    assert.equal(result.reason, null);
  });

  it('rejects trade exceeding 15% salary tolerance', () => {
    let bA = createTeamBudget('A', 'premier');
    let bB = createTeamBudget('B', 'premier');
    bA = signPlayer(bA, 'p1', 5_000_000);
    bB = signPlayer(bB, 'p2', 1_000_000);
    const result = validateTradeFinancials(
      bA, bB,
      [{ salary: 5_000_000 }],
      [{ salary: 1_000_000 }],
    );
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('15% tolerance'));
  });

  it('rejects trade that would exceed team A cap', () => {
    let bA = createTeamBudget('A', 'amateur');
    let bB = createTeamBudget('B', 'premier');
    bA = signPlayer(bA, 'p1', 1_000_000);
    bA = signPlayer(bA, 'x1', 3_500_000);
    bB = signPlayer(bB, 'p2', 1_100_000);
    // A committed: 4,500,000; cap: 5,000,000; after trade: 4500000 - 1000000 + 1100000 = 4600000 ok...
    // Make it tighter: fill A's cap
    let bA2 = createTeamBudget('A2', 'amateur');
    bA2 = signPlayer(bA2, 'x1', 4_900_000);
    let bB2 = createTeamBudget('B2', 'premier');
    bB2 = signPlayer(bB2, 'p2', 200_000);
    // A2 committed: 4,900,000; Trade: A2 sends nothing valuable, receives 200000
    // But we need salary match. Use 0 from A and 0 from B => skip tolerance check
    // A2 new committed: 4900000 - 0 + 200000 = 5100000 > 5000000
    const result = validateTradeFinancials(
      bA2, bB2,
      [],
      [{ salary: 200_000 }],
    );
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('Team A would exceed salary cap'));
  });

  it('rejects trade that would exceed team B cap', () => {
    let bA = createTeamBudget('A', 'premier');
    let bB = createTeamBudget('B', 'amateur');
    bA = signPlayer(bA, 'p1', 200_000);
    bB = signPlayer(bB, 'x1', 4_900_000);
    const result = validateTradeFinancials(
      bA, bB,
      [{ salary: 200_000 }],
      [],
    );
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('Team B would exceed salary cap'));
  });

  it('returns correct new cap space values on valid trade', () => {
    let bA = createTeamBudget('A', 'premier');
    let bB = createTeamBudget('B', 'premier');
    bA = signPlayer(bA, 'p1', 4_000_000);
    bB = signPlayer(bB, 'p2', 4_200_000);
    const result = validateTradeFinancials(
      bA, bB,
      [{ salary: 4_000_000 }],
      [{ salary: 4_200_000 }],
    );
    assert.equal(result.valid, true);
    // A: committed was 4M, loses 4M, gains 4.2M => new committed = 4.2M; cap space = 20M - 4.2M = 15.8M
    assert.equal(result.teamANewCap, 15_800_000);
    // B: committed was 4.2M, loses 4.2M, gains 4M => new committed = 4M; cap space = 20M - 4M = 16M
    assert.equal(result.teamBNewCap, 16_000_000);
  });
});

// ---------------------------------------------------------------------------
// Additional immutability checks
// ---------------------------------------------------------------------------
describe('Immutability guarantees', () => {
  it('signPlayer returns a different object reference', () => {
    const b = createTeamBudget('t1', 'premier');
    const b2 = signPlayer(b, 'p1', 1_000_000);
    assert.notEqual(b, b2);
  });

  it('releasePlayer returns a different object reference', () => {
    let b = createTeamBudget('t1', 'premier');
    b = signPlayer(b, 'p1', 1_000_000);
    const b2 = releasePlayer(b, 'p1');
    assert.notEqual(b, b2);
  });

  it('processSeasonRevenue returns a different object reference', () => {
    const b = createTeamBudget('t1');
    const b2 = processSeasonRevenue(b, { wins: 5 }, 'amateur');
    assert.notEqual(b, b2);
  });

  it('releasePlayer for nonexistent player returns different reference', () => {
    const b = createTeamBudget('t1');
    const b2 = releasePlayer(b, 'ghost');
    assert.notEqual(b, b2);
  });
});
