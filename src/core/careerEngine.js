/**
 * Career Engine — Quadra Legacy
 *
 * Dual-track career progression system for Coach and Player identities.
 * Pure functions — no side effects.
 */

export const CAREER_TRACKS = Object.freeze({
  COACH: 'coach',
  PLAYER: 'player',
});

export const COACH_XP_CONFIG = Object.freeze({
  PER_WIN: 30,
  PER_LOSS: 10,
  PER_DRAW: 15,
  PER_PLAYOFF_WIN: 60,
  PER_CHAMPIONSHIP: 200,
  PER_PRACTICE_SESSION: 5,
  PER_DRAFT_PICK_HIT: 15,
});

export const PLAYER_XP_CONFIG = Object.freeze({
  PER_POINT: 2,
  PER_REBOUND: 3,
  PER_ASSIST: 4,
  PER_STEAL: 5,
  PER_BLOCK: 5,
  PER_WIN_BONUS: 15,
  UNDERDOG_BONUS: 20,
  MIN_XP: 5,
  MAX_XP: 150,
});

export const CAREER_LEVEL_TIERS = Object.freeze([
  { minLevel: 1, maxLevel: 5, xpPerLevel: 150, tier: 'amateur', tierLabel: 'Amateur', tierLabelPt: 'Amador' },
  { minLevel: 6, maxLevel: 10, xpPerLevel: 300, tier: 'semi_pro', tierLabel: 'Semi-Pro', tierLabelPt: 'Semi-Profissional' },
  { minLevel: 11, maxLevel: 15, xpPerLevel: 500, tier: 'professional', tierLabel: 'Professional', tierLabelPt: 'Profissional' },
  { minLevel: 16, maxLevel: 20, xpPerLevel: 800, tier: 'premier', tierLabel: 'Premier', tierLabelPt: 'Premier' },
]);

export function createCareer(track, options = {}) {
  if (track !== CAREER_TRACKS.COACH && track !== CAREER_TRACKS.PLAYER) {
    throw new Error(`Invalid career track: "${track}". Must be "coach" or "player".`);
  }

  const base = {
    level: 1,
    totalXP: 0,
    tier: 'amateur',
    reputation: 50,
    currentTeamId: options.currentTeamId || null,
    currentLeagueId: options.currentLeagueId || null,
    currentLeagueTier: 'amateur',
    practiceLog: { lastDate: null, sessionsToday: 0, maxPerDay: 3 },
  };

  if (track === CAREER_TRACKS.COACH) {
    return {
      ...base,
      track: 'coach',
      specializations: [],
      seasonsCoached: 0,
      championships: 0,
      careerRecord: { wins: 0, losses: 0 },
    };
  }

  return {
    ...base,
    track: 'player',
    playerId: options.playerId || null,
    seasonsPlayed: 0,
    careerRecord: { wins: 0, losses: 0 },
    seasonHighlights: [],
    contractStatus: 'free_agent',
    salary: 0,
  };
}

export function calculateCoachMatchXP(matchResult) {
  const { won = false, isPlayoff = false, isChampionship = false } = matchResult;
  let xp = won ? COACH_XP_CONFIG.PER_WIN : COACH_XP_CONFIG.PER_LOSS;
  if (isPlayoff && won) xp += COACH_XP_CONFIG.PER_PLAYOFF_WIN;
  if (isChampionship && won) xp += COACH_XP_CONFIG.PER_CHAMPIONSHIP;
  return xp;
}

export function calculatePlayerCareerXP(playerStats, matchContext = {}) {
  const { points = 0, rebounds = 0, assists = 0, steals = 0, blocks = 0 } = playerStats;
  const { won = false, isUnderdog = false } = matchContext;

  let xp = points * PLAYER_XP_CONFIG.PER_POINT
    + rebounds * PLAYER_XP_CONFIG.PER_REBOUND
    + assists * PLAYER_XP_CONFIG.PER_ASSIST
    + steals * PLAYER_XP_CONFIG.PER_STEAL
    + blocks * PLAYER_XP_CONFIG.PER_BLOCK;

  if (won) xp += PLAYER_XP_CONFIG.PER_WIN_BONUS;
  if (isUnderdog && won) xp += PLAYER_XP_CONFIG.UNDERDOG_BONUS;

  return Math.max(PLAYER_XP_CONFIG.MIN_XP, Math.min(PLAYER_XP_CONFIG.MAX_XP, Math.round(xp)));
}

export function getCareerLevelInfo(totalXP) {
  let remainingXP = totalXP;
  let currentLevel = 1;

  for (const tierDef of CAREER_LEVEL_TIERS) {
    const levelsInTier = tierDef.maxLevel - tierDef.minLevel + 1;
    const xpForFullTier = levelsInTier * tierDef.xpPerLevel;

    if (remainingXP < xpForFullTier) {
      // We're somewhere in this tier
      const levelInTier = Math.floor(remainingXP / tierDef.xpPerLevel);
      currentLevel = tierDef.minLevel + levelInTier;
      const xpInCurrentLevel = remainingXP - (levelInTier * tierDef.xpPerLevel);
      const xpRequired = tierDef.xpPerLevel;

      // Clamp to max level if at the end
      if (currentLevel > tierDef.maxLevel) currentLevel = tierDef.maxLevel;

      return {
        currentLevel,
        tier: tierDef.tier,
        tierLabel: tierDef.tierLabel,
        tierLabelPt: tierDef.tierLabelPt,
        xpInCurrentLevel: xpInCurrentLevel,
        xpRequiredForNextLevel: xpRequired,
        progressPercent: Math.round((xpInCurrentLevel / xpRequired) * 100),
        totalXP,
      };
    }

    remainingXP -= xpForFullTier;
  }

  // Past all tiers — max level
  const lastTier = CAREER_LEVEL_TIERS[CAREER_LEVEL_TIERS.length - 1];
  return {
    currentLevel: lastTier.maxLevel,
    tier: lastTier.tier,
    tierLabel: lastTier.tierLabel,
    tierLabelPt: lastTier.tierLabelPt,
    xpInCurrentLevel: remainingXP,
    xpRequiredForNextLevel: lastTier.xpPerLevel,
    progressPercent: 100,
    totalXP,
  };
}

export function calculateReputation(careerData, seasonResults = {}) {
  const { wins = 0, losses = 0, madePlayoffs = false, wonChampionship = false,
    leaguePosition = 4, totalTeams = 8 } = seasonResults;

  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? wins / totalGames : 0.5;

  let rep = 50;
  rep += winRate * 30;
  if (madePlayoffs) rep += 10;
  if (wonChampionship) rep += 10;
  rep -= (leaguePosition / totalTeams) * 10;

  return Math.max(1, Math.min(100, Math.round(rep)));
}

export function checkTierPromotion(careerData) {
  const levelInfo = getCareerLevelInfo(careerData.totalXP);
  const currentTier = careerData.currentLeagueTier || careerData.tier;

  // Find what tier the level qualifies for
  const qualifiedTier = levelInfo.tier;

  // Tier ordering for comparison
  const tierOrder = ['amateur', 'semi_pro', 'professional', 'premier'];
  const currentIdx = tierOrder.indexOf(currentTier);
  const qualifiedIdx = tierOrder.indexOf(qualifiedTier);

  if (qualifiedIdx > currentIdx) {
    const nextTier = tierOrder[currentIdx + 1];
    return {
      promoted: true,
      newTier: nextTier,
      reason: `Level ${levelInfo.currentLevel} qualifies for ${nextTier} tier`,
    };
  }

  return { promoted: false, newTier: null, reason: null };
}

export function checkTierRelegation(careerData, seasonResults) {
  const currentTier = careerData.currentLeagueTier || careerData.tier;
  const tierOrder = ['amateur', 'semi_pro', 'professional', 'premier'];
  const currentIdx = tierOrder.indexOf(currentTier);

  // Can't relegate from amateur
  if (currentIdx <= 0) {
    return { relegated: false, newTier: null, reason: null };
  }

  const { leaguePosition = 4, totalTeams = 8 } = seasonResults;

  // Bottom 2 positions trigger relegation
  if (leaguePosition > totalTeams - 2) {
    const prevTier = tierOrder[currentIdx - 1];
    return {
      relegated: true,
      newTier: prevTier,
      reason: `Finished ${leaguePosition}/${totalTeams}, relegated to ${prevTier}`,
    };
  }

  return { relegated: false, newTier: null, reason: null };
}

export function processPracticeSession(careerData, todayDate = null) {
  const today = todayDate || new Date().toISOString().split('T')[0];
  const log = careerData.practiceLog;

  // Reset if new day
  let sessionsToday = log.lastDate === today ? log.sessionsToday : 0;

  if (sessionsToday >= log.maxPerDay) {
    return {
      success: false,
      xpGained: 0,
      reason: 'daily_limit_reached',
      careerData: { ...careerData },
    };
  }

  sessionsToday += 1;
  const xpGained = COACH_XP_CONFIG.PER_PRACTICE_SESSION;
  const newTotalXP = careerData.totalXP + xpGained;
  const newLevelInfo = getCareerLevelInfo(newTotalXP);

  return {
    success: true,
    xpGained,
    reason: null,
    careerData: {
      ...careerData,
      totalXP: newTotalXP,
      level: newLevelInfo.currentLevel,
      tier: newLevelInfo.tier,
      practiceLog: {
        ...careerData.practiceLog,
        lastDate: today,
        sessionsToday,
      },
    },
  };
}

export function applyCareerXP(careerData, xpGained) {
  const newTotalXP = careerData.totalXP + xpGained;
  const newLevelInfo = getCareerLevelInfo(newTotalXP);
  return {
    ...careerData,
    totalXP: newTotalXP,
    level: newLevelInfo.currentLevel,
    tier: newLevelInfo.tier,
  };
}
