/**
 * Local Player Stats System
 * Tracks career stats for players locally
 */

const STORAGE_KEY = 'quadra_legacy_player_stats';

/**
 * Generate unique ID
 */
function generateId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load all player stats from localStorage
 */
function loadPlayerStats() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * Save player stats to localStorage
 */
function savePlayerStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

/**
 * Record stats from a single game for a player
 * @param {object} player - Player object with id, name, position
 * @param {object} gameStats - Stats from this game
 */
export function recordGameStats(player, gameStats) {
  const allStats = loadPlayerStats();
  
  const playerId = player.id || generateId();
  
  if (!allStats[playerId]) {
    // Create new player record
    allStats[playerId] = {
      id: playerId,
      name: player.name,
      position: player.position,
      team: player.teamName || 'Unknown',
      gamesPlayed: 0,
      minutesPlayed: 0,
      // Scoring
      totalPoints: 0,
      twoPointAttempts: 0,
      twoPointMade: 0,
      threePointAttempts: 0,
      threePointMade: 0,
      freeThrowAttempts: 0,
      freeThrowMade: 0,
      // Other stats
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      // Records
      highestPoints: 0,
      gamesWithDoubleDigits: 0,
      // Timestamps
      createdAt: new Date().toISOString(),
      lastGameAt: null
    };
  }
  
  const record = allStats[playerId];
  
  // Update cumulative stats
  record.gamesPlayed++;
  record.minutesPlayed += gameStats.minutes || 0;
  record.totalPoints += gameStats.points || 0;
  record.twoPointAttempts += gameStats.twoPointAttempts || 0;
  record.twoPointMade += gameStats.twoPointMade || 0;
  record.threePointAttempts += gameStats.threePointAttempts || 0;
  record.threePointMade += gameStats.threePointMade || 0;
  record.freeThrowAttempts += gameStats.freeThrowAttempts || 0;
  record.freeThrowMade += gameStats.freeThrowMade || 0;
  record.rebounds += gameStats.rebounds || 0;
  record.assists += gameStats.assists || 0;
  record.steals += gameStats.steals || 0;
  record.blocks += gameStats.blocks || 0;
  record.turnovers += gameStats.turnovers || 0;
  record.fouls += gameStats.fouls || 0;
  
  // Update records
  if (gameStats.points > record.highestPoints) {
    record.highestPoints = gameStats.points;
  }
  if (gameStats.points >= 10) {
    record.gamesWithDoubleDigits++;
  }
  
  record.lastGameAt = new Date().toISOString();
  
  savePlayerStats(allStats);
  
  return record;
}

/**
 * Record stats for all players from a match
 * @param {Array} homePlayers - Array of home team player stats
 * @param {Array} awayPlayers - Array of away team player stats
 * @param {string} homeTeamName
 * @param {string} awayTeamName
 */
export function recordMatchStats(homePlayers, awayPlayers, homeTeamName, awayTeamName) {
  homePlayers.forEach(player => {
    recordGameStats({ ...player, teamName: homeTeamName }, player);
  });
  
  awayPlayers.forEach(player => {
    recordGameStats({ ...player, teamName: awayTeamName }, player);
  });
}

/**
 * Get career stats for a specific player
 * @param {string} playerId 
 * @returns {object|null}
 */
export function getPlayerCareerStats(playerId) {
  const allStats = loadPlayerStats();
  return allStats[playerId] || null;
}

/**
 * Get all players with career stats
 * @returns {Array}
 */
export function getAllPlayers() {
  const allStats = loadPlayerStats();
  return Object.values(allStats);
}

/**
 * Get top scorers
 * @param {number} limit 
 * @returns {Array}
 */
export function getTopScorers(limit = 10) {
  return getAllPlayers()
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, limit);
}

/**
 * Get top players by PPG (points per game)
 * @param {number} limit 
 * @param {number} minGames - Minimum games to qualify
 * @returns {Array}
 */
export function getTopPPG(limit = 10, minGames = 3) {
  return getAllPlayers()
    .filter(p => p.gamesPlayed >= minGames)
    .map(p => ({
      ...p,
      ppg: (p.totalPoints / p.gamesPlayed).toFixed(1),
      rpg: (p.rebounds / p.gamesPlayed).toFixed(1),
      apg: (p.assists / p.gamesPlayed).toFixed(1),
      spg: (p.steals / p.gamesPlayed).toFixed(1)
    }))
    .sort((a, b) => parseFloat(b.ppg) - parseFloat(a.ppg))
    .slice(0, limit);
}

/**
 * Get shooting percentages
 * @param {string} playerId 
 * @returns {object}
 */
export function getShootingPercentages(playerId) {
  const player = getPlayerCareerStats(playerId);
  
  if (!player) return null;
  
  const twoPct = player.twoPointAttempts > 0 
    ? ((player.twoPointMade / player.twoPointAttempts) * 100).toFixed(1)
    : '0.0';
    
  const threePct = player.threePointAttempts > 0 
    ? ((player.threePointMade / player.threePointAttempts) * 100).toFixed(1)
    : '0.0';
    
  const ftPct = player.freeThrowAttempts > 0 
    ? ((player.freeThrowMade / player.freeThrowAttempts) * 100).toFixed(1)
    : '0.0';
    
  const totalAttempts = player.twoPointAttempts + player.threePointAttempts;
  const totalMade = player.twoPointMade + player.threePointMade;
  const fgPct = totalAttempts > 0 
    ? ((totalMade / totalAttempts) * 100).toFixed(1)
    : '0.0';
  
  return {
    twoPoint: twoPct,
    threePoint: threePct,
    freeThrow: ftPct,
    fieldGoal: fgPct
  };
}

/**
 * Get leaderboard for a specific stat
 * @param {string} stat - Stat name (totalPoints, rebounds, assists, steals, blocks)
 * @param {number} limit 
 * @returns {Array}
 */
export function getLeaderboard(stat, limit = 10) {
  return getAllPlayers()
    .filter(p => p[stat] !== undefined)
    .sort((a, b) => b[stat] - a[stat])
    .slice(0, limit);
}

/**
 * Clear all player stats (for testing/reset)
 */
export function clearAllPlayerStats() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get recent games for a player (would need game history storage)
 * For now, returns summary stats
 * @param {string} playerId 
 * @returns {object}
 */
export function getPlayerSummary(playerId) {
  const player = getPlayerCareerStats(playerId);
  
  if (!player) return null;
  
  const percentages = getShootingPercentages(playerId);
  
  return {
    ...player,
    ppg: player.gamesPlayed > 0 ? (player.totalPoints / player.gamesPlayed).toFixed(1) : '0.0',
    rpg: player.gamesPlayed > 0 ? (player.rebounds / player.gamesPlayed).toFixed(1) : '0.0',
    apg: player.gamesPlayed > 0 ? (player.assists / player.gamesPlayed).toFixed(1) : '0.0',
    spg: player.gamesPlayed > 0 ? (player.steals / player.gamesPlayed).toFixed(1) : '0.0',
    bpg: player.gamesPlayed > 0 ? (player.blocks / player.gamesPlayed).toFixed(1) : '0.0',
    shooting: percentages
  };
}
