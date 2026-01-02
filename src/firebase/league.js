/**
 * League Service
 * Handles league creation, standings, schedules, and season management
 */

import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from './config.js';

// ============ LEAGUE OPERATIONS ============

/**
 * Create a new league
 * @param {string} userId - Owner of the league
 * @param {object} leagueData
 * @returns {Promise<string>} League ID
 */
export async function createLeague(userId, leagueData) {
  const leagueRef = doc(collection(db, 'leagues'));
  
  await setDoc(leagueRef, {
    name: leagueData.name,
    ownerId: userId,
    season: 1,
    status: 'setup', // 'setup', 'in-progress', 'completed'
    teams: [],
    maxTeams: leagueData.maxTeams || 8,
    matchesPerTeam: leagueData.matchesPerTeam || 2, // Home and away
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return leagueRef.id;
}

/**
 * Get a league by ID
 * @param {string} leagueId 
 * @returns {Promise<object|null>}
 */
export async function getLeague(leagueId) {
  const leagueRef = doc(db, 'leagues', leagueId);
  const snapshot = await getDoc(leagueRef);
  
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  
  return null;
}

/**
 * Get leagues owned by a user
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
export async function getUserLeagues(userId) {
  const leaguesRef = collection(db, 'leagues');
  const q = query(leaguesRef, where('ownerId', '==', userId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Add a team to a league
 * @param {string} leagueId 
 * @param {object} team 
 */
export async function addTeamToLeague(leagueId, team) {
  const leagueRef = doc(db, 'leagues', leagueId);
  const league = await getLeague(leagueId);
  
  if (!league) throw new Error('League not found');
  if (league.teams.length >= league.maxTeams) throw new Error('League is full');
  
  const newTeam = {
    id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      points: 0 // League points
    }
  };
  
  await updateDoc(leagueRef, {
    teams: [...league.teams, newTeam],
    updatedAt: serverTimestamp()
  });
  
  return newTeam.id;
}

/**
 * Generate round-robin schedule for the league
 * @param {string} leagueId 
 * @returns {Promise<Array>} Generated matches
 */
export async function generateSchedule(leagueId) {
  const league = await getLeague(leagueId);
  
  if (!league) throw new Error('League not found');
  if (league.teams.length < 2) throw new Error('Need at least 2 teams');
  
  const teams = [...league.teams];
  const matches = [];
  
  // Round-robin scheduling algorithm
  // Each team plays every other team twice (home and away)
  for (let round = 0; round < (teams.length - 1) * 2; round++) {
    const roundMatches = [];
    const isSecondHalf = round >= teams.length - 1;
    const adjustedRound = isSecondHalf ? round - (teams.length - 1) : round;
    
    for (let i = 0; i < teams.length / 2; i++) {
      const home = (i + adjustedRound) % teams.length;
      const away = (teams.length - 1 - i + adjustedRound) % teams.length;
      
      if (home !== away) {
        const match = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          round: round + 1,
          homeTeamId: isSecondHalf ? teams[away].id : teams[home].id,
          awayTeamId: isSecondHalf ? teams[home].id : teams[away].id,
          homeTeamName: isSecondHalf ? teams[away].name : teams[home].name,
          awayTeamName: isSecondHalf ? teams[home].name : teams[away].name,
          status: 'scheduled', // 'scheduled', 'completed'
          homeScore: null,
          awayScore: null,
          playedAt: null
        };
        roundMatches.push(match);
      }
    }
    
    matches.push(...roundMatches);
  }
  
  // Save matches to league
  const leagueRef = doc(db, 'leagues', leagueId);
  await updateDoc(leagueRef, {
    schedule: matches,
    status: 'in-progress',
    currentRound: 1,
    updatedAt: serverTimestamp()
  });
  
  return matches;
}

/**
 * Record a match result
 * @param {string} leagueId 
 * @param {string} matchId 
 * @param {number} homeScore 
 * @param {number} awayScore 
 */
export async function recordMatchResult(leagueId, matchId, homeScore, awayScore) {
  const league = await getLeague(leagueId);
  
  if (!league) throw new Error('League not found');
  
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
  
  // Update team stats
  const homeTeamIndex = league.teams.findIndex(t => t.id === match.homeTeamId);
  const awayTeamIndex = league.teams.findIndex(t => t.id === match.awayTeamId);
  
  if (homeTeamIndex !== -1) {
    league.teams[homeTeamIndex].stats.played++;
    league.teams[homeTeamIndex].stats.pointsFor += homeScore;
    league.teams[homeTeamIndex].stats.pointsAgainst += awayScore;
    
    if (homeScore > awayScore) {
      league.teams[homeTeamIndex].stats.wins++;
      league.teams[homeTeamIndex].stats.points += 3;
    } else if (homeScore === awayScore) {
      league.teams[homeTeamIndex].stats.draws++;
      league.teams[homeTeamIndex].stats.points += 1;
    } else {
      league.teams[homeTeamIndex].stats.losses++;
    }
  }
  
  if (awayTeamIndex !== -1) {
    league.teams[awayTeamIndex].stats.played++;
    league.teams[awayTeamIndex].stats.pointsFor += awayScore;
    league.teams[awayTeamIndex].stats.pointsAgainst += homeScore;
    
    if (awayScore > homeScore) {
      league.teams[awayTeamIndex].stats.wins++;
      league.teams[awayTeamIndex].stats.points += 3;
    } else if (homeScore === awayScore) {
      league.teams[awayTeamIndex].stats.draws++;
      league.teams[awayTeamIndex].stats.points += 1;
    } else {
      league.teams[awayTeamIndex].stats.losses++;
    }
  }
  
  // Check if season is complete
  const allMatchesPlayed = league.schedule.every(m => m.status === 'completed');
  
  // Save updates
  const leagueRef = doc(db, 'leagues', leagueId);
  await updateDoc(leagueRef, {
    teams: league.teams,
    schedule: league.schedule,
    status: allMatchesPlayed ? 'completed' : 'in-progress',
    updatedAt: serverTimestamp()
  });
}

/**
 * Get league standings (sorted by points)
 * @param {string} leagueId 
 * @returns {Promise<Array>}
 */
export async function getStandings(leagueId) {
  const league = await getLeague(leagueId);
  
  if (!league) throw new Error('League not found');
  
  // Sort teams by points, then goal difference, then goals scored
  return [...league.teams].sort((a, b) => {
    // Primary: League points
    if (b.stats.points !== a.stats.points) {
      return b.stats.points - a.stats.points;
    }
    
    // Secondary: Point difference
    const aDiff = a.stats.pointsFor - a.stats.pointsAgainst;
    const bDiff = b.stats.pointsFor - b.stats.pointsAgainst;
    if (bDiff !== aDiff) {
      return bDiff - aDiff;
    }
    
    // Tertiary: Points scored
    return b.stats.pointsFor - a.stats.pointsFor;
  });
}

/**
 * Get next scheduled matches
 * @param {string} leagueId 
 * @param {number} count 
 * @returns {Promise<Array>}
 */
export async function getUpcomingMatches(leagueId, count = 5) {
  const league = await getLeague(leagueId);
  
  if (!league || !league.schedule) return [];
  
  return league.schedule
    .filter(m => m.status === 'scheduled')
    .slice(0, count);
}

/**
 * Get recent match results
 * @param {string} leagueId 
 * @param {number} count 
 * @returns {Promise<Array>}
 */
export async function getRecentResults(leagueId, count = 5) {
  const league = await getLeague(leagueId);
  
  if (!league || !league.schedule) return [];
  
  return league.schedule
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt))
    .slice(0, count);
}

/**
 * Start a new season (reset stats, generate new schedule)
 * @param {string} leagueId 
 */
export async function startNewSeason(leagueId) {
  const league = await getLeague(leagueId);
  
  if (!league) throw new Error('League not found');
  
  // Reset team stats
  const resetTeams = league.teams.map(team => ({
    ...team,
    stats: {
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      points: 0
    }
  }));
  
  // Save reset and increment season
  const leagueRef = doc(db, 'leagues', leagueId);
  await updateDoc(leagueRef, {
    teams: resetTeams,
    schedule: [],
    status: 'setup',
    season: increment(1),
    currentRound: 0,
    updatedAt: serverTimestamp()
  });
  
  // Generate new schedule
  await generateSchedule(leagueId);
}
