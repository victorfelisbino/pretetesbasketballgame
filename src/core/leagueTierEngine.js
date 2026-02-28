/**
 * League Tier Engine — Quadra Legacy
 *
 * Defines the tiered league ladder system with promotion, relegation,
 * and scouting/recruitment mechanics.
 *
 * Pure functions — no side effects.
 */

export const LEAGUE_TIERS = Object.freeze({
  AMATEUR: Object.freeze({
    id: 'amateur', level: 1, label: 'Amateur League', labelPt: 'Liga Amadora',
    salaryCap: 5_000_000, playerPoolQuality: Object.freeze({ min: 30, max: 65 }),
    aiTier: 'ROOKIE', maxTeams: 8, seasonLength: 7,
    promotionSlots: 2, relegationSlots: 0, entryRequirement: null,
  }),
  SEMI_PRO: Object.freeze({
    id: 'semi_pro', level: 2, label: 'Semi-Pro League', labelPt: 'Liga Semi-Profissional',
    salaryCap: 12_000_000, playerPoolQuality: Object.freeze({ min: 45, max: 78 }),
    aiTier: 'AMATEUR', maxTeams: 8, seasonLength: 14,
    promotionSlots: 2, relegationSlots: 2,
    entryRequirement: Object.freeze({ coachLevel: 6, playerReputation: 60 }),
  }),
  PROFESSIONAL: Object.freeze({
    id: 'professional', level: 3, label: 'Professional League', labelPt: 'Liga Profissional',
    salaryCap: 18_000_000, playerPoolQuality: Object.freeze({ min: 55, max: 88 }),
    aiTier: 'PRO', maxTeams: 8, seasonLength: 18,
    promotionSlots: 1, relegationSlots: 2,
    entryRequirement: Object.freeze({ coachLevel: 11, playerReputation: 75 }),
  }),
  PREMIER: Object.freeze({
    id: 'premier', level: 4, label: 'Premier League', labelPt: 'Liga Premier',
    salaryCap: 20_000_000, playerPoolQuality: Object.freeze({ min: 65, max: 95 }),
    aiTier: 'ELITE', maxTeams: 8, seasonLength: 18,
    promotionSlots: 0, relegationSlots: 2,
    entryRequirement: Object.freeze({ coachLevel: 16, playerReputation: 88 }),
  }),
});

export const TIER_ORDER = Object.freeze(['amateur', 'semi_pro', 'professional', 'premier']);

const SCOUTING_CITIES = ['Santos', 'Campinas', 'Curitiba', 'Recife', 'Brasília', 'Fortaleza',
  'Porto Alegre', 'Belo Horizonte', 'Manaus', 'Florianópolis', 'Salvador', 'Goiânia'];
const SCOUTING_SUFFIXES = ['Basketball', 'Basquete', 'Hoops', 'Estrelas', 'Thunder',
  'Lions', 'Hawks', 'Dragões', 'Tubarões', 'Panteras'];

export function getTierConfig(tierId) {
  if (!tierId) return LEAGUE_TIERS.AMATEUR;
  // Try uppercase key first (e.g., 'AMATEUR')
  if (LEAGUE_TIERS[tierId.toUpperCase()]) return LEAGUE_TIERS[tierId.toUpperCase()];
  // Try by id (e.g., 'amateur', 'semi_pro')
  const found = Object.values(LEAGUE_TIERS).find(t => t.id === tierId.toLowerCase());
  return found || LEAGUE_TIERS.AMATEUR;
}

export function getNextTier(currentTierId) {
  const normalized = currentTierId ? currentTierId.toLowerCase() : 'amateur';
  const idx = TIER_ORDER.indexOf(normalized);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export function getPreviousTier(currentTierId) {
  const normalized = currentTierId ? currentTierId.toLowerCase() : 'amateur';
  const idx = TIER_ORDER.indexOf(normalized);
  if (idx <= 0) return null;
  return TIER_ORDER[idx - 1];
}

export function meetsEntryRequirement(tierConfig, careerData) {
  if (!tierConfig.entryRequirement) return true;
  if (careerData.track === 'coach') {
    return (careerData.level || 0) >= tierConfig.entryRequirement.coachLevel;
  }
  if (careerData.track === 'player') {
    return (careerData.reputation || 0) >= tierConfig.entryRequirement.playerReputation;
  }
  return false;
}

export function processSeasonEndPromotion(standings, tierConfig, userTeamPosition) {
  const nextTier = getNextTier(tierConfig.id);
  if (!nextTier || tierConfig.promotionSlots === 0) {
    return { promoted: false, newTier: null, position: userTeamPosition };
  }
  if (userTeamPosition <= tierConfig.promotionSlots) {
    return { promoted: true, newTier: nextTier, position: userTeamPosition };
  }
  return { promoted: false, newTier: null, position: userTeamPosition };
}

export function processSeasonEndRelegation(standings, tierConfig, userTeamPosition) {
  if (tierConfig.relegationSlots === 0) {
    return { relegated: false, newTier: null, position: userTeamPosition };
  }
  const prevTier = getPreviousTier(tierConfig.id);
  if (!prevTier) {
    return { relegated: false, newTier: null, position: userTeamPosition };
  }
  const totalTeams = standings.length;
  if (userTeamPosition > totalTeams - tierConfig.relegationSlots) {
    return { relegated: true, newTier: prevTier, position: userTeamPosition };
  }
  return { relegated: false, newTier: null, position: userTeamPosition };
}

export function generateScoutingTeamName(tierId, rng = Math.random) {
  const cityIdx = Math.floor(rng() * SCOUTING_CITIES.length);
  const suffixIdx = Math.floor(rng() * SCOUTING_SUFFIXES.length);
  return `${SCOUTING_CITIES[cityIdx]} ${SCOUTING_SUFFIXES[suffixIdx]}`;
}

export function checkPlayerScoutingOffers(playerCareer, seasonStats, rng = Math.random) {
  const nextTier = getNextTier(playerCareer.currentLeagueTier || playerCareer.tier || 'amateur');
  if (!nextTier) return { offered: false };

  const { pointsPerGame = 0, assistsPerGame = 0, reboundsPerGame = 0, gamesPlayed = 0 } = seasonStats;
  const reputation = playerCareer.reputation || 50;

  let probability = (reputation / 100) * 0.4
    + (pointsPerGame / 30) * 0.3
    + (gamesPlayed / 18) * 0.3;
  probability = Math.max(0.05, Math.min(0.85, probability));

  if (rng() < probability) {
    const teamName = generateScoutingTeamName(nextTier, rng);
    const tierMultipliers = { semi_pro: 12_000, professional: 20_000, premier: 30_000 };
    const mult = tierMultipliers[nextTier] || 12_000;
    const overall = reputation * 0.8 + (pointsPerGame * 2);
    const offeredSalary = Math.round((overall * mult) / 10_000) * 10_000;

    return { offered: true, fromTier: nextTier, teamName, offeredSalary };
  }

  return { offered: false };
}

export function checkCoachRecruitmentOffer(coachCareer, seasonResults, rng = Math.random) {
  const nextTier = getNextTier(coachCareer.currentLeagueTier || coachCareer.tier || 'amateur');
  if (!nextTier) return { offered: false };

  const { wins = 0, losses = 0, madePlayoffs = false, wonChampionship = false } = seasonResults;
  const reputation = coachCareer.reputation || 50;
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? wins / totalGames : 0;

  let probability = (reputation / 100) * 0.5
    + winRate * 0.3
    + (madePlayoffs ? 0.1 : 0)
    + (wonChampionship ? 0.1 : 0);
  probability = Math.max(0.05, Math.min(0.80, probability));

  if (rng() < probability) {
    const teamName = generateScoutingTeamName(nextTier, rng);
    return { offered: true, fromTier: nextTier, teamName };
  }

  return { offered: false };
}

export function getAllTiers() {
  return Object.values(LEAGUE_TIERS).sort((a, b) => a.level - b.level);
}
