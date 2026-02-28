/**
 * Career Engine Tests — Quadra Legacy
 *
 * Comprehensive tests for dual-track career progression system.
 * Run with: node src/core/careerEngine.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAREER_TRACKS,
  COACH_XP_CONFIG,
  PLAYER_XP_CONFIG,
  CAREER_LEVEL_TIERS,
  createCareer,
  calculateCoachMatchXP,
  calculatePlayerCareerXP,
  getCareerLevelInfo,
  calculateReputation,
  checkTierPromotion,
  checkTierRelegation,
  processPracticeSession,
  applyCareerXP,
} from './careerEngine.js';

// ---------------------------------------------------------------------------
// createCareer
// ---------------------------------------------------------------------------
describe('createCareer', () => {
  it('creates a coach career with correct defaults', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    assert.equal(career.track, 'coach');
    assert.equal(career.level, 1);
    assert.equal(career.totalXP, 0);
    assert.equal(career.tier, 'amateur');
    assert.equal(career.reputation, 50);
    assert.equal(career.seasonsCoached, 0);
    assert.equal(career.championships, 0);
    assert.deepStrictEqual(career.careerRecord, { wins: 0, losses: 0 });
    assert.deepStrictEqual(career.specializations, []);
  });

  it('creates a player career with correct defaults', () => {
    const career = createCareer(CAREER_TRACKS.PLAYER);
    assert.equal(career.track, 'player');
    assert.equal(career.level, 1);
    assert.equal(career.totalXP, 0);
    assert.equal(career.contractStatus, 'free_agent');
    assert.equal(career.salary, 0);
    assert.equal(career.seasonsPlayed, 0);
    assert.deepStrictEqual(career.seasonHighlights, []);
    assert.equal(career.playerId, null);
  });

  it('throws on invalid track', () => {
    assert.throws(() => createCareer('invalid'), {
      message: 'Invalid career track: "invalid". Must be "coach" or "player".',
    });
  });

  it('passes options through for coach (currentTeamId)', () => {
    const career = createCareer(CAREER_TRACKS.COACH, { currentTeamId: 'team-42' });
    assert.equal(career.currentTeamId, 'team-42');
  });

  it('passes options through for player (playerId, currentLeagueId)', () => {
    const career = createCareer(CAREER_TRACKS.PLAYER, {
      playerId: 'p-99',
      currentLeagueId: 'league-7',
    });
    assert.equal(career.playerId, 'p-99');
    assert.equal(career.currentLeagueId, 'league-7');
  });
});

// ---------------------------------------------------------------------------
// calculateCoachMatchXP
// ---------------------------------------------------------------------------
describe('calculateCoachMatchXP', () => {
  it('returns PER_WIN XP for a regular season win', () => {
    const xp = calculateCoachMatchXP({ won: true });
    assert.equal(xp, COACH_XP_CONFIG.PER_WIN);
  });

  it('returns PER_LOSS XP for a loss', () => {
    const xp = calculateCoachMatchXP({ won: false });
    assert.equal(xp, COACH_XP_CONFIG.PER_LOSS);
  });

  it('adds PER_PLAYOFF_WIN bonus for playoff win', () => {
    const xp = calculateCoachMatchXP({ won: true, isPlayoff: true });
    assert.equal(xp, COACH_XP_CONFIG.PER_WIN + COACH_XP_CONFIG.PER_PLAYOFF_WIN);
  });

  it('adds PER_CHAMPIONSHIP bonus for championship win', () => {
    const xp = calculateCoachMatchXP({ won: true, isChampionship: true });
    assert.equal(xp, COACH_XP_CONFIG.PER_WIN + COACH_XP_CONFIG.PER_CHAMPIONSHIP);
  });

  it('stacks playoff and championship bonuses together', () => {
    const xp = calculateCoachMatchXP({ won: true, isPlayoff: true, isChampionship: true });
    assert.equal(xp, COACH_XP_CONFIG.PER_WIN + COACH_XP_CONFIG.PER_PLAYOFF_WIN + COACH_XP_CONFIG.PER_CHAMPIONSHIP);
  });

  it('does not give playoff bonus on a loss', () => {
    const xp = calculateCoachMatchXP({ won: false, isPlayoff: true });
    assert.equal(xp, COACH_XP_CONFIG.PER_LOSS);
  });
});

// ---------------------------------------------------------------------------
// calculatePlayerCareerXP
// ---------------------------------------------------------------------------
describe('calculatePlayerCareerXP', () => {
  it('calculates basic stat XP correctly', () => {
    const xp = calculatePlayerCareerXP({ points: 10, rebounds: 5, assists: 3, steals: 2, blocks: 1 });
    const expected = 10 * 2 + 5 * 3 + 3 * 4 + 2 * 5 + 1 * 5;
    assert.equal(xp, expected);
  });

  it('adds win bonus when won', () => {
    const xp = calculatePlayerCareerXP({ points: 10 }, { won: true });
    assert.equal(xp, 10 * 2 + PLAYER_XP_CONFIG.PER_WIN_BONUS);
  });

  it('adds underdog bonus when underdog and won', () => {
    const xp = calculatePlayerCareerXP({ points: 10 }, { won: true, isUnderdog: true });
    assert.equal(xp, 10 * 2 + PLAYER_XP_CONFIG.PER_WIN_BONUS + PLAYER_XP_CONFIG.UNDERDOG_BONUS);
  });

  it('clamps to MIN_XP for zero stats and loss', () => {
    const xp = calculatePlayerCareerXP({}, { won: false });
    assert.equal(xp, PLAYER_XP_CONFIG.MIN_XP);
  });

  it('clamps to MAX_XP for extremely high stats', () => {
    const xp = calculatePlayerCareerXP(
      { points: 50, rebounds: 20, assists: 20, steals: 10, blocks: 10 },
      { won: true, isUnderdog: true },
    );
    assert.equal(xp, PLAYER_XP_CONFIG.MAX_XP);
  });
});

// ---------------------------------------------------------------------------
// getCareerLevelInfo
// ---------------------------------------------------------------------------
describe('getCareerLevelInfo', () => {
  it('returns level 1 amateur at 0 XP', () => {
    const info = getCareerLevelInfo(0);
    assert.equal(info.currentLevel, 1);
    assert.equal(info.tier, 'amateur');
    assert.equal(info.tierLabel, 'Amateur');
    assert.equal(info.xpInCurrentLevel, 0);
    assert.equal(info.progressPercent, 0);
  });

  it('returns level 2 at 150 XP (amateur boundary)', () => {
    const info = getCareerLevelInfo(150);
    assert.equal(info.currentLevel, 2);
    assert.equal(info.tier, 'amateur');
    assert.equal(info.xpInCurrentLevel, 0);
  });

  it('returns level 5 just before semi_pro boundary', () => {
    // Amateur tier: 5 levels * 150 xp = 750 total for full tier
    const info = getCareerLevelInfo(749);
    assert.equal(info.currentLevel, 5);
    assert.equal(info.tier, 'amateur');
  });

  it('enters semi_pro at 750 XP', () => {
    const info = getCareerLevelInfo(750);
    assert.equal(info.currentLevel, 6);
    assert.equal(info.tier, 'semi_pro');
    assert.equal(info.tierLabel, 'Semi-Pro');
    assert.equal(info.tierLabelPt, 'Semi-Profissional');
  });

  it('enters professional tier at correct XP', () => {
    // Amateur: 5 * 150 = 750, Semi-pro: 5 * 300 = 1500, total = 2250
    const info = getCareerLevelInfo(2250);
    assert.equal(info.currentLevel, 11);
    assert.equal(info.tier, 'professional');
    assert.equal(info.tierLabel, 'Professional');
  });

  it('enters premier tier at correct XP', () => {
    // Amateur: 750, Semi-pro: 1500, Professional: 5 * 500 = 2500, total = 4750
    const info = getCareerLevelInfo(4750);
    assert.equal(info.currentLevel, 16);
    assert.equal(info.tier, 'premier');
    assert.equal(info.tierLabel, 'Premier');
  });

  it('caps at max level 20 for XP beyond all tiers', () => {
    // Total all tiers: 750 + 1500 + 2500 + 5*800=4000 = 8750, go beyond
    const info = getCareerLevelInfo(20000);
    assert.equal(info.currentLevel, 20);
    assert.equal(info.tier, 'premier');
    assert.equal(info.progressPercent, 100);
  });
});

// ---------------------------------------------------------------------------
// calculateReputation
// ---------------------------------------------------------------------------
describe('calculateReputation', () => {
  it('calculates high reputation for a great season', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const rep = calculateReputation(career, {
      wins: 20, losses: 2, madePlayoffs: true, wonChampionship: true,
      leaguePosition: 1, totalTeams: 8,
    });
    assert.ok(rep >= 85, `Expected rep >= 85, got ${rep}`);
  });

  it('calculates low reputation for a terrible season', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const rep = calculateReputation(career, {
      wins: 1, losses: 21, madePlayoffs: false, wonChampionship: false,
      leaguePosition: 8, totalTeams: 8,
    });
    assert.ok(rep <= 55, `Expected rep <= 55, got ${rep}`);
  });

  it('clamps reputation to maximum of 100', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const rep = calculateReputation(career, {
      wins: 100, losses: 0, madePlayoffs: true, wonChampionship: true,
      leaguePosition: 1, totalTeams: 100,
    });
    assert.ok(rep <= 100, `Expected rep <= 100, got ${rep}`);
  });

  it('clamps reputation to minimum of 1', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    // Worst possible: 0 wins, many losses, last place
    const rep = calculateReputation(career, {
      wins: 0, losses: 50, madePlayoffs: false, wonChampionship: false,
      leaguePosition: 8, totalTeams: 8,
    });
    assert.ok(rep >= 1, `Expected rep >= 1, got ${rep}`);
  });
});

// ---------------------------------------------------------------------------
// checkTierPromotion
// ---------------------------------------------------------------------------
describe('checkTierPromotion', () => {
  it('promotes from amateur when XP qualifies for semi_pro', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    career.totalXP = 800; // enough for semi_pro tier
    career.currentLeagueTier = 'amateur';
    const result = checkTierPromotion(career);
    assert.equal(result.promoted, true);
    assert.equal(result.newTier, 'semi_pro');
    assert.ok(result.reason.includes('semi_pro'));
  });

  it('does not promote when still in same tier', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    career.totalXP = 100;
    career.currentLeagueTier = 'amateur';
    const result = checkTierPromotion(career);
    assert.equal(result.promoted, false);
    assert.equal(result.newTier, null);
  });

  it('does not promote when already at premier and XP is beyond all tiers', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    career.totalXP = 20000;
    career.currentLeagueTier = 'premier';
    const result = checkTierPromotion(career);
    assert.equal(result.promoted, false);
  });
});

// ---------------------------------------------------------------------------
// checkTierRelegation
// ---------------------------------------------------------------------------
describe('checkTierRelegation', () => {
  it('relegates when finishing in bottom 2', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    career.currentLeagueTier = 'semi_pro';
    const result = checkTierRelegation(career, { leaguePosition: 7, totalTeams: 8 });
    assert.equal(result.relegated, true);
    assert.equal(result.newTier, 'amateur');
    assert.ok(result.reason.includes('relegated'));
  });

  it('cannot relegate from amateur', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    career.currentLeagueTier = 'amateur';
    const result = checkTierRelegation(career, { leaguePosition: 8, totalTeams: 8 });
    assert.equal(result.relegated, false);
    assert.equal(result.newTier, null);
  });

  it('does not relegate when finishing mid-table', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    career.currentLeagueTier = 'professional';
    const result = checkTierRelegation(career, { leaguePosition: 4, totalTeams: 8 });
    assert.equal(result.relegated, false);
    assert.equal(result.newTier, null);
  });
});

// ---------------------------------------------------------------------------
// processPracticeSession
// ---------------------------------------------------------------------------
describe('processPracticeSession', () => {
  it('succeeds on the first session of the day', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const result = processPracticeSession(career, '2026-03-01');
    assert.equal(result.success, true);
    assert.equal(result.xpGained, COACH_XP_CONFIG.PER_PRACTICE_SESSION);
    assert.equal(result.careerData.practiceLog.sessionsToday, 1);
    assert.equal(result.careerData.practiceLog.lastDate, '2026-03-01');
  });

  it('blocks after reaching daily limit', () => {
    let career = createCareer(CAREER_TRACKS.COACH);
    // Simulate 3 sessions on the same day
    for (let i = 0; i < 3; i++) {
      const result = processPracticeSession(career, '2026-03-01');
      career = result.careerData;
    }
    const blocked = processPracticeSession(career, '2026-03-01');
    assert.equal(blocked.success, false);
    assert.equal(blocked.xpGained, 0);
    assert.equal(blocked.reason, 'daily_limit_reached');
  });

  it('resets sessions count on a new day', () => {
    let career = createCareer(CAREER_TRACKS.COACH);
    // Max out day 1
    for (let i = 0; i < 3; i++) {
      const result = processPracticeSession(career, '2026-03-01');
      career = result.careerData;
    }
    // New day should allow practice again
    const result = processPracticeSession(career, '2026-03-02');
    assert.equal(result.success, true);
    assert.equal(result.careerData.practiceLog.sessionsToday, 1);
    assert.equal(result.careerData.practiceLog.lastDate, '2026-03-02');
  });

  it('accumulates XP correctly across sessions', () => {
    let career = createCareer(CAREER_TRACKS.COACH);
    const r1 = processPracticeSession(career, '2026-03-01');
    career = r1.careerData;
    const r2 = processPracticeSession(career, '2026-03-01');
    assert.equal(r2.careerData.totalXP, COACH_XP_CONFIG.PER_PRACTICE_SESSION * 2);
  });
});

// ---------------------------------------------------------------------------
// applyCareerXP
// ---------------------------------------------------------------------------
describe('applyCareerXP', () => {
  it('increases totalXP by the given amount', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const updated = applyCareerXP(career, 200);
    assert.equal(updated.totalXP, 200);
  });

  it('updates level based on new totalXP', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const updated = applyCareerXP(career, 300); // 300 XP -> level 3 in amateur
    assert.equal(updated.level, 3);
  });

  it('updates tier when crossing tier boundary', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const updated = applyCareerXP(career, 800); // crosses into semi_pro
    assert.equal(updated.tier, 'semi_pro');
    assert.ok(updated.level >= 6, `Expected level >= 6, got ${updated.level}`);
  });
});

// ---------------------------------------------------------------------------
// Immutability checks
// ---------------------------------------------------------------------------
describe('immutability', () => {
  it('createCareer does not share references between calls', () => {
    const c1 = createCareer(CAREER_TRACKS.COACH);
    const c2 = createCareer(CAREER_TRACKS.COACH);
    c1.careerRecord.wins = 99;
    assert.equal(c2.careerRecord.wins, 0);
  });

  it('applyCareerXP does not mutate the original career', () => {
    const career = createCareer(CAREER_TRACKS.PLAYER);
    const original = { ...career };
    applyCareerXP(career, 500);
    assert.equal(career.totalXP, original.totalXP);
    assert.equal(career.level, original.level);
  });

  it('processPracticeSession does not mutate the original career', () => {
    const career = createCareer(CAREER_TRACKS.COACH);
    const originalXP = career.totalXP;
    processPracticeSession(career, '2026-03-01');
    assert.equal(career.totalXP, originalXP);
    assert.equal(career.practiceLog.sessionsToday, 0);
  });

  it('CAREER_TRACKS is frozen', () => {
    assert.throws(() => { CAREER_TRACKS.COACH = 'hacked'; }, TypeError);
  });

  it('COACH_XP_CONFIG is frozen', () => {
    assert.throws(() => { COACH_XP_CONFIG.PER_WIN = 9999; }, TypeError);
  });

  it('PLAYER_XP_CONFIG is frozen', () => {
    assert.throws(() => { PLAYER_XP_CONFIG.PER_POINT = 9999; }, TypeError);
  });
});
