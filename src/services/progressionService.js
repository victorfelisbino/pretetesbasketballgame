/**
 * Progression Service — Quadra Legacy
 *
 * Wires the progressionEngine functions into the game lifecycle:
 *   - Post-match XP gains for all players
 *   - Season-end aging
 *   - Level-up processing
 *
 * Pure functions — no side effects. Callers decide what to do with the results.
 */

import {
  calculateMatchXP,
  getLevelInfo,
  levelUpPlayer,
  processSeasonAging,
  applyBreakthroughEvent,
  getRecommendedLevelUpAttributes,
} from '../core/progressionEngine.js';

/**
 * Process post-match XP gains for all players in a match result.
 * Returns XP info for every player keyed by team.
 *
 * @param {object} matchResult - { homeTeamStats, awayTeamStats }
 * @returns {{ home: PlayerXP[], away: PlayerXP[] }}
 *
 * PlayerXP shape:
 *   { name, position, xpGained, totalXP, levelInfo, levelsGained }
 */
export function processMatchXP(matchResult) {
  if (!matchResult) return { home: [], away: [] };

  const processTeam = (playerStats) => {
    if (!playerStats || !Array.isArray(playerStats)) return [];

    return playerStats.map(p => {
      // Each player played roughly equal minutes (100 rounds / 5 active = ~24 min)
      const estimatedMinutes = 24;

      const xpGained = calculateMatchXP(
        {
          points: p.points || 0,
          rebounds: p.rebounds || 0,
          assists: p.assists || 0,
          steals: p.steals || 0,
          blocks: p.blocks || 0,
        },
        estimatedMinutes,
      );

      // Calculate level info (assuming player has a totalXP field, default 0)
      const previousXP = p.totalXP || 0;
      const newTotalXP = previousXP + xpGained;
      const previousLevel = getLevelInfo(previousXP);
      const newLevel = getLevelInfo(newTotalXP);

      return {
        name: p.name,
        position: p.position,
        xpGained,
        totalXP: newTotalXP,
        levelInfo: newLevel,
        levelsGained: newLevel.currentLevel - previousLevel.currentLevel,
      };
    });
  };

  return {
    home: processTeam(matchResult.homeTeamStats),
    away: processTeam(matchResult.awayTeamStats),
  };
}

/**
 * Apply XP to actual player objects in a team.
 * Mutates player objects (adds totalXP field).
 *
 * @param {Player[]} players - team players array
 * @param {PlayerXP[]} xpResults - from processMatchXP
 * @returns {{ levelUps: Array<{ player: Player, newLevel: number }> }}
 */
export function applyXPToPlayers(players, xpResults) {
  const levelUps = [];

  for (const xr of xpResults) {
    const player = players.find(p => p.name === xr.name);
    if (player) {
      const previousXP = player.totalXP || 0;
      const previousLevel = getLevelInfo(previousXP).currentLevel;
      player.totalXP = xr.totalXP;

      if (xr.levelsGained > 0) {
        // Auto level-up: pick the recommended attribute for the player's archetype
        const recommended = getRecommendedLevelUpAttributes(player.archetype);
        const chosenAttr = recommended.length > 0 ? recommended[0] : 'Attack';

        for (let i = 0; i < xr.levelsGained; i++) {
          levelUpPlayer(player, chosenAttr);
        }

        levelUps.push({
          player,
          previousLevel,
          newLevel: getLevelInfo(player.totalXP).currentLevel,
          attribute: chosenAttr,
        });
      }
    }
  }

  return { levelUps };
}

/**
 * Process end-of-season aging for all teams in a league.
 * Returns the updated players array (new copies, non-mutating).
 *
 * @param {Array<{ players: Player[] }>} teams
 * @returns {{ teams: Array<{ players: Player[], retirements: Player[] }> }}
 */
export function processEndOfSeasonAging(teams) {
  return teams.map(team => {
    if (!team.players || !Array.isArray(team.players)) {
      return { ...team, retirements: [] };
    }

    const agedPlayers = processSeasonAging(team.players);
    const retirements = agedPlayers.filter(p => p.retired);
    const activePlayers = agedPlayers.filter(p => !p.retired);

    return {
      ...team,
      players: activePlayers,
      retirements,
    };
  });
}

/**
 * Check for breakthrough events for all players on a team.
 * Applies ~10% chance per player.
 *
 * @param {Player[]} players
 * @returns {{ events: Array<{ player: Player, event: string }> }}
 */
export function checkBreakthroughEvents(players) {
  const events = [];

  for (const player of players) {
    const result = applyBreakthroughEvent(player);
    if (result && result.event) {
      events.push({ player, event: result.event });
    }
  }

  return { events };
}

// Re-export for convenience
export { getLevelInfo, getRecommendedLevelUpAttributes };
