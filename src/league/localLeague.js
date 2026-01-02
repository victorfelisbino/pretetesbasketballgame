/**
 * Local League System
 * Works without Firebase for guest mode and offline play
 */

// Storage key
const STORAGE_KEY = 'pretetes_leagues';

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load leagues from localStorage
 */
function loadLeagues() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save leagues to localStorage
 */
function saveLeagues(leagues) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leagues));
}

/**
 * Create a new local league
 * @param {object} leagueData
 * @returns {object} Created league
 */
export function createLocalLeague(leagueData) {
  const leagues = loadLeagues();
  
  const newLeague = {
    id: generateId(),
    name: leagueData.name,
    season: 1,
    status: 'setup',
    teams: [],
    schedule: [],
    maxTeams: leagueData.maxTeams || 8,
    currentRound: 0,
    createdAt: new Date().toISOString()
  };
  
  leagues.push(newLeague);
  saveLeagues(leagues);
  
  return newLeague;
}

/**
 * Get all local leagues
 * @returns {Array}
 */
export function getLocalLeagues() {
  return loadLeagues();
}

/**
 * Get a local league by ID
 * @param {string} leagueId 
 * @returns {object|null}
 */
export function getLocalLeague(leagueId) {
  const leagues = loadLeagues();
  return leagues.find(l => l.id === leagueId) || null;
}

/**
 * Add team to local league
 * @param {string} leagueId 
 * @param {object} team 
 * @returns {string} Team ID
 */
export function addTeamToLocalLeague(leagueId, team) {
  const leagues = loadLeagues();
  const leagueIndex = leagues.findIndex(l => l.id === leagueId);
  
  if (leagueIndex === -1) throw new Error('League not found');
  
  const league = leagues[leagueIndex];
  if (league.teams.length >= league.maxTeams) throw new Error('League is full');
  
  const newTeam = {
    id: generateId(),
    name: team.name,
    players: team.players,
    isUserTeam: team.isUserTeam || false,
    stats: {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      points: 0
    }
  };
  
  leagues[leagueIndex].teams.push(newTeam);
  saveLeagues(leagues);
  
  return newTeam.id;
}

/**
 * Generate round-robin schedule
 * @param {string} leagueId 
 * @returns {Array}
 */
export function generateLocalSchedule(leagueId) {
  const leagues = loadLeagues();
  const leagueIndex = leagues.findIndex(l => l.id === leagueId);
  
  if (leagueIndex === -1) throw new Error('League not found');
  
  const league = leagues[leagueIndex];
  const teams = [...league.teams];
  
  if (teams.length < 2) throw new Error('Need at least 2 teams');
  
  // Add bye team if odd number
  if (teams.length % 2 !== 0) {
    teams.push({ id: 'bye', name: 'BYE', isBye: true });
  }
  
  const matches = [];
  const numRounds = (teams.length - 1) * 2; // Home and away
  
  for (let round = 0; round < numRounds; round++) {
    const isSecondHalf = round >= teams.length - 1;
    const adjustedRound = isSecondHalf ? round - (teams.length - 1) : round;
    
    for (let i = 0; i < teams.length / 2; i++) {
      const homeIdx = (i + adjustedRound) % teams.length;
      const awayIdx = (teams.length - 1 - i + adjustedRound) % teams.length;
      
      if (homeIdx !== awayIdx) {
        const homeTeam = isSecondHalf ? teams[awayIdx] : teams[homeIdx];
        const awayTeam = isSecondHalf ? teams[homeIdx] : teams[awayIdx];
        
        // Skip bye matches
        if (homeTeam.isBye || awayTeam.isBye) continue;
        
        matches.push({
          id: generateId(),
          round: round + 1,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          homeTeamName: homeTeam.name,
          awayTeamName: awayTeam.name,
          status: 'scheduled',
          homeScore: null,
          awayScore: null,
          playedAt: null
        });
      }
    }
  }
  
  leagues[leagueIndex].schedule = matches;
  leagues[leagueIndex].status = 'in-progress';
  leagues[leagueIndex].currentRound = 1;
  saveLeagues(leagues);
  
  return matches;
}

/**
 * Record match result
 * @param {string} leagueId 
 * @param {string} matchId 
 * @param {number} homeScore 
 * @param {number} awayScore 
 */
export function recordLocalMatchResult(leagueId, matchId, homeScore, awayScore) {
  const leagues = loadLeagues();
  const leagueIndex = leagues.findIndex(l => l.id === leagueId);
  
  if (leagueIndex === -1) throw new Error('League not found');
  
  const league = leagues[leagueIndex];
  const matchIndex = league.schedule.findIndex(m => m.id === matchId);
  
  if (matchIndex === -1) throw new Error('Match not found');
  
  const match = league.schedule[matchIndex];
  
  // Update match
  league.schedule[matchIndex] = {
    ...match,
    homeScore,
    awayScore,
    status: 'completed',
    playedAt: new Date().toISOString()
  };
  
  // Update home team stats
  const homeTeamIndex = league.teams.findIndex(t => t.id === match.homeTeamId);
  if (homeTeamIndex !== -1) {
    const homeTeam = league.teams[homeTeamIndex];
    homeTeam.stats.played++;
    homeTeam.stats.pointsFor += homeScore;
    homeTeam.stats.pointsAgainst += awayScore;
    
    if (homeScore > awayScore) {
      homeTeam.stats.wins++;
      homeTeam.stats.points += 3;
    } else if (homeScore === awayScore) {
      homeTeam.stats.draws++;
      homeTeam.stats.points += 1;
    } else {
      homeTeam.stats.losses++;
    }
  }
  
  // Update away team stats
  const awayTeamIndex = league.teams.findIndex(t => t.id === match.awayTeamId);
  if (awayTeamIndex !== -1) {
    const awayTeam = league.teams[awayTeamIndex];
    awayTeam.stats.played++;
    awayTeam.stats.pointsFor += awayScore;
    awayTeam.stats.pointsAgainst += homeScore;
    
    if (awayScore > homeScore) {
      awayTeam.stats.wins++;
      awayTeam.stats.points += 3;
    } else if (homeScore === awayScore) {
      awayTeam.stats.draws++;
      awayTeam.stats.points += 1;
    } else {
      awayTeam.stats.losses++;
    }
  }
  
  // Check if season complete
  const allComplete = league.schedule.every(m => m.status === 'completed');
  if (allComplete) {
    league.status = 'completed';
  }
  
  saveLeagues(leagues);
}

/**
 * Get standings sorted by points
 * @param {string} leagueId 
 * @returns {Array}
 */
export function getLocalStandings(leagueId) {
  const league = getLocalLeague(leagueId);
  
  if (!league) return [];
  
  return [...league.teams].sort((a, b) => {
    if (b.stats.points !== a.stats.points) {
      return b.stats.points - a.stats.points;
    }
    
    const aDiff = a.stats.pointsFor - a.stats.pointsAgainst;
    const bDiff = b.stats.pointsFor - b.stats.pointsAgainst;
    if (bDiff !== aDiff) {
      return bDiff - aDiff;
    }
    
    return b.stats.pointsFor - a.stats.pointsFor;
  });
}

/**
 * Get upcoming matches
 * @param {string} leagueId 
 * @param {number} count 
 * @returns {Array}
 */
export function getLocalUpcomingMatches(leagueId, count = 5) {
  const league = getLocalLeague(leagueId);
  
  if (!league || !league.schedule) return [];
  
  return league.schedule
    .filter(m => m.status === 'scheduled')
    .slice(0, count);
}

/**
 * Get next match for user's team
 * @param {string} leagueId 
 * @returns {object|null}
 */
export function getNextUserMatch(leagueId) {
  const league = getLocalLeague(leagueId);
  
  if (!league || !league.schedule) return null;
  
  const userTeam = league.teams.find(t => t.isUserTeam);
  if (!userTeam) return null;
  
  return league.schedule.find(m => 
    m.status === 'scheduled' && 
    (m.homeTeamId === userTeam.id || m.awayTeamId === userTeam.id)
  );
}

/**
 * Delete a local league
 * @param {string} leagueId 
 */
export function deleteLocalLeague(leagueId) {
  const leagues = loadLeagues();
  const filtered = leagues.filter(l => l.id !== leagueId);
  saveLeagues(filtered);
}

/**
 * Start new season
 * @param {string} leagueId 
 */
export function startLocalNewSeason(leagueId) {
  const leagues = loadLeagues();
  const leagueIndex = leagues.findIndex(l => l.id === leagueId);
  
  if (leagueIndex === -1) throw new Error('League not found');
  
  const league = leagues[leagueIndex];
  
  // Reset stats
  league.teams.forEach(team => {
    team.stats = {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      points: 0
    };
  });
  
  league.schedule = [];
  league.status = 'setup';
  league.season++;
  league.currentRound = 0;
  
  saveLeagues(leagues);
  
  // Generate new schedule
  generateLocalSchedule(leagueId);
}

/**
 * Generate AI teams to fill the league
 * @param {string} leagueId 
 * @param {number} count 
 */
export function generateAITeams(leagueId, count) {
  const aiTeamNames = [
    'Thunder Hawks', 'Golden Eagles', 'Red Dragons', 'Blue Sharks',
    'Silver Wolves', 'Iron Giants', 'Storm Riders', 'Fire Phoenixes',
    'Night Owls', 'Steel Warriors', 'Cosmic Stars', 'Wild Tigers'
  ];
  
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const firstNames = ['James', 'Marcus', 'David', 'Michael', 'Chris', 'Kevin', 'Andre', 'Tony'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Wilson', 'Taylor'];
  
  const leagues = loadLeagues();
  const leagueIndex = leagues.findIndex(l => l.id === leagueId);
  
  if (leagueIndex === -1) throw new Error('League not found');
  
  const existingNames = leagues[leagueIndex].teams.map(t => t.name);
  const availableNames = aiTeamNames.filter(n => !existingNames.includes(n));
  
  for (let i = 0; i < count && availableNames.length > 0; i++) {
    const teamName = availableNames.splice(Math.floor(Math.random() * availableNames.length), 1)[0];
    
    // Generate players
    const players = positions.map(pos => ({
      id: generateId(),
      name: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
      position: pos,
      shooting: Math.floor(Math.random() * 6) + 5, // 5-10
      defense: Math.floor(Math.random() * 6) + 5,
      speed: Math.floor(Math.random() * 6) + 5,
      passing: Math.floor(Math.random() * 6) + 5
    }));
    
    addTeamToLocalLeague(leagueId, {
      name: teamName,
      players,
      isUserTeam: false
    });
  }
}
