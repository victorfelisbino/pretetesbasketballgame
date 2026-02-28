import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEAGUE_TIERS,
  TIER_ORDER,
  getTierConfig,
  getNextTier,
  getPreviousTier,
  meetsEntryRequirement,
  processSeasonEndPromotion,
  processSeasonEndRelegation,
  generateScoutingTeamName,
  checkPlayerScoutingOffers,
  checkCoachRecruitmentOffer,
  getAllTiers,
} from './leagueTierEngine.js';

// Deterministic RNG helpers
const lowRng = () => 0.1;   // always triggers offers
const highRng = () => 0.99; // never triggers offers

// ---------------------------------------------------------------------------
// getTierConfig
// ---------------------------------------------------------------------------
describe('getTierConfig', () => {
  it('returns AMATEUR tier for id "amateur"', () => {
    const tier = getTierConfig('amateur');
    assert.equal(tier.id, 'amateur');
    assert.equal(tier.level, 1);
  });

  it('returns PREMIER tier for id "premier"', () => {
    const tier = getTierConfig('premier');
    assert.equal(tier.id, 'premier');
    assert.equal(tier.level, 4);
  });

  it('falls back to AMATEUR for unknown tier id', () => {
    const tier = getTierConfig('galactic');
    assert.equal(tier.id, 'amateur');
  });

  it('resolves uppercase key like "SEMI_PRO"', () => {
    const tier = getTierConfig('SEMI_PRO');
    assert.equal(tier.id, 'semi_pro');
    assert.equal(tier.salaryCap, 12_000_000);
  });

  it('returns AMATEUR when tierId is null/undefined', () => {
    assert.equal(getTierConfig(null).id, 'amateur');
    assert.equal(getTierConfig(undefined).id, 'amateur');
  });
});

// ---------------------------------------------------------------------------
// getNextTier
// ---------------------------------------------------------------------------
describe('getNextTier', () => {
  it('amateur -> semi_pro', () => {
    assert.equal(getNextTier('amateur'), 'semi_pro');
  });

  it('semi_pro -> professional', () => {
    assert.equal(getNextTier('semi_pro'), 'professional');
  });

  it('professional -> premier', () => {
    assert.equal(getNextTier('professional'), 'premier');
  });

  it('premier -> null (top tier)', () => {
    assert.equal(getNextTier('premier'), null);
  });

  it('unknown tier -> null', () => {
    assert.equal(getNextTier('mythical'), null);
  });
});

// ---------------------------------------------------------------------------
// getPreviousTier
// ---------------------------------------------------------------------------
describe('getPreviousTier', () => {
  it('amateur -> null (bottom tier)', () => {
    assert.equal(getPreviousTier('amateur'), null);
  });

  it('semi_pro -> amateur', () => {
    assert.equal(getPreviousTier('semi_pro'), 'amateur');
  });

  it('professional -> semi_pro', () => {
    assert.equal(getPreviousTier('professional'), 'semi_pro');
  });

  it('premier -> professional', () => {
    assert.equal(getPreviousTier('premier'), 'professional');
  });

  it('unknown tier -> null', () => {
    assert.equal(getPreviousTier('nonexistent'), null);
  });
});

// ---------------------------------------------------------------------------
// meetsEntryRequirement
// ---------------------------------------------------------------------------
describe('meetsEntryRequirement', () => {
  it('always true for AMATEUR (no entry requirement)', () => {
    assert.equal(meetsEntryRequirement(LEAGUE_TIERS.AMATEUR, { track: 'coach', level: 1 }), true);
  });

  it('coach meets SEMI_PRO requirement (level >= 6)', () => {
    assert.equal(meetsEntryRequirement(LEAGUE_TIERS.SEMI_PRO, { track: 'coach', level: 10 }), true);
  });

  it('coach does NOT meet SEMI_PRO requirement (level < 6)', () => {
    assert.equal(meetsEntryRequirement(LEAGUE_TIERS.SEMI_PRO, { track: 'coach', level: 3 }), false);
  });

  it('player meets SEMI_PRO requirement (reputation >= 60)', () => {
    assert.equal(meetsEntryRequirement(LEAGUE_TIERS.SEMI_PRO, { track: 'player', reputation: 75 }), true);
  });

  it('player does NOT meet SEMI_PRO requirement (reputation < 60)', () => {
    assert.equal(meetsEntryRequirement(LEAGUE_TIERS.SEMI_PRO, { track: 'player', reputation: 40 }), false);
  });

  it('returns false for unknown track with entry requirement', () => {
    assert.equal(meetsEntryRequirement(LEAGUE_TIERS.PROFESSIONAL, { track: 'fan', level: 99 }), false);
  });
});

// ---------------------------------------------------------------------------
// processSeasonEndPromotion
// ---------------------------------------------------------------------------
describe('processSeasonEndPromotion', () => {
  const standings8 = Array.from({ length: 8 }, (_, i) => ({ teamId: `t${i + 1}` }));

  it('1st place in AMATEUR gets promoted to semi_pro', () => {
    const result = processSeasonEndPromotion(standings8, LEAGUE_TIERS.AMATEUR, 1);
    assert.equal(result.promoted, true);
    assert.equal(result.newTier, 'semi_pro');
    assert.equal(result.position, 1);
  });

  it('2nd place in AMATEUR also gets promoted (promotionSlots=2)', () => {
    const result = processSeasonEndPromotion(standings8, LEAGUE_TIERS.AMATEUR, 2);
    assert.equal(result.promoted, true);
    assert.equal(result.newTier, 'semi_pro');
  });

  it('3rd place in AMATEUR does NOT get promoted', () => {
    const result = processSeasonEndPromotion(standings8, LEAGUE_TIERS.AMATEUR, 3);
    assert.equal(result.promoted, false);
    assert.equal(result.newTier, null);
  });

  it('PREMIER tier cannot promote (promotionSlots=0)', () => {
    const result = processSeasonEndPromotion(standings8, LEAGUE_TIERS.PREMIER, 1);
    assert.equal(result.promoted, false);
    assert.equal(result.newTier, null);
  });
});

// ---------------------------------------------------------------------------
// processSeasonEndRelegation
// ---------------------------------------------------------------------------
describe('processSeasonEndRelegation', () => {
  const standings8 = Array.from({ length: 8 }, (_, i) => ({ teamId: `t${i + 1}` }));

  it('last place in SEMI_PRO gets relegated to amateur', () => {
    const result = processSeasonEndRelegation(standings8, LEAGUE_TIERS.SEMI_PRO, 8);
    assert.equal(result.relegated, true);
    assert.equal(result.newTier, 'amateur');
    assert.equal(result.position, 8);
  });

  it('7th place in SEMI_PRO also relegated (relegationSlots=2)', () => {
    const result = processSeasonEndRelegation(standings8, LEAGUE_TIERS.SEMI_PRO, 7);
    assert.equal(result.relegated, true);
    assert.equal(result.newTier, 'amateur');
  });

  it('mid-table (4th) in SEMI_PRO is NOT relegated', () => {
    const result = processSeasonEndRelegation(standings8, LEAGUE_TIERS.SEMI_PRO, 4);
    assert.equal(result.relegated, false);
    assert.equal(result.newTier, null);
  });

  it('AMATEUR tier cannot relegate (relegationSlots=0)', () => {
    const result = processSeasonEndRelegation(standings8, LEAGUE_TIERS.AMATEUR, 8);
    assert.equal(result.relegated, false);
    assert.equal(result.newTier, null);
  });
});

// ---------------------------------------------------------------------------
// generateScoutingTeamName
// ---------------------------------------------------------------------------
describe('generateScoutingTeamName', () => {
  it('returns a string with city and suffix separated by space', () => {
    const name = generateScoutingTeamName('semi_pro', lowRng);
    assert.equal(typeof name, 'string');
    const parts = name.split(' ');
    assert.ok(parts.length >= 2, 'name should have at least two parts');
  });

  it('is deterministic with seeded rng', () => {
    const name1 = generateScoutingTeamName('amateur', lowRng);
    const name2 = generateScoutingTeamName('amateur', lowRng);
    assert.equal(name1, name2);
  });
});

// ---------------------------------------------------------------------------
// checkPlayerScoutingOffers
// ---------------------------------------------------------------------------
describe('checkPlayerScoutingOffers', () => {
  it('high reputation player gets scouting offer (lowRng)', () => {
    const career = { tier: 'amateur', reputation: 90 };
    const stats = { pointsPerGame: 25, assistsPerGame: 6, reboundsPerGame: 8, gamesPlayed: 18 };
    const result = checkPlayerScoutingOffers(career, stats, lowRng);
    assert.equal(result.offered, true);
    assert.equal(result.fromTier, 'semi_pro');
    assert.equal(typeof result.teamName, 'string');
    assert.equal(typeof result.offeredSalary, 'number');
    assert.ok(result.offeredSalary > 0);
  });

  it('low reputation player does NOT get offer (highRng)', () => {
    const career = { tier: 'amateur', reputation: 20 };
    const stats = { pointsPerGame: 3, gamesPlayed: 2 };
    const result = checkPlayerScoutingOffers(career, stats, highRng);
    assert.equal(result.offered, false);
  });

  it('premier tier player gets no offer (no next tier)', () => {
    const career = { tier: 'premier', reputation: 99 };
    const stats = { pointsPerGame: 30, gamesPlayed: 18 };
    const result = checkPlayerScoutingOffers(career, stats, lowRng);
    assert.equal(result.offered, false);
  });
});

// ---------------------------------------------------------------------------
// checkCoachRecruitmentOffer
// ---------------------------------------------------------------------------
describe('checkCoachRecruitmentOffer', () => {
  it('winning coach gets recruitment offer (lowRng)', () => {
    const career = { tier: 'amateur', reputation: 85 };
    const results = { wins: 14, losses: 4, madePlayoffs: true, wonChampionship: true };
    const result = checkCoachRecruitmentOffer(career, results, lowRng);
    assert.equal(result.offered, true);
    assert.equal(result.fromTier, 'semi_pro');
    assert.equal(typeof result.teamName, 'string');
  });

  it('losing coach does NOT get offer (highRng)', () => {
    const career = { tier: 'amateur', reputation: 20 };
    const results = { wins: 2, losses: 16, madePlayoffs: false, wonChampionship: false };
    const result = checkCoachRecruitmentOffer(career, results, highRng);
    assert.equal(result.offered, false);
  });

  it('premier coach gets no offer (no next tier)', () => {
    const career = { tier: 'premier', reputation: 99 };
    const results = { wins: 18, losses: 0, madePlayoffs: true, wonChampionship: true };
    const result = checkCoachRecruitmentOffer(career, results, lowRng);
    assert.equal(result.offered, false);
  });
});

// ---------------------------------------------------------------------------
// getAllTiers
// ---------------------------------------------------------------------------
describe('getAllTiers', () => {
  it('returns exactly 4 tiers', () => {
    const tiers = getAllTiers();
    assert.equal(tiers.length, 4);
  });

  it('tiers are sorted by level ascending', () => {
    const tiers = getAllTiers();
    assert.equal(tiers[0].level, 1);
    assert.equal(tiers[1].level, 2);
    assert.equal(tiers[2].level, 3);
    assert.equal(tiers[3].level, 4);
  });

  it('first tier is amateur, last is premier', () => {
    const tiers = getAllTiers();
    assert.equal(tiers[0].id, 'amateur');
    assert.equal(tiers[3].id, 'premier');
  });
});

// ---------------------------------------------------------------------------
// TIER_ORDER constant
// ---------------------------------------------------------------------------
describe('TIER_ORDER', () => {
  it('has 4 entries in correct order', () => {
    assert.equal(TIER_ORDER.length, 4);
    assert.deepEqual([...TIER_ORDER], ['amateur', 'semi_pro', 'professional', 'premier']);
  });
});
