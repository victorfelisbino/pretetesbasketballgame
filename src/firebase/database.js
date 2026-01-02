/**
 * Database Service
 * Handles game saves, team data, and match history
 */

import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from './config.js';

// ============ TEAM OPERATIONS ============

/**
 * Save a team to user's collection
 * @param {string} userId 
 * @param {object} team 
 * @returns {Promise<string>} Team ID
 */
export async function saveTeam(userId, team) {
  const teamRef = doc(collection(db, 'users', userId, 'teams'));
  
  await setDoc(teamRef, {
    ...team,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return teamRef.id;
}

/**
 * Update an existing team
 * @param {string} userId 
 * @param {string} teamId 
 * @param {object} updates 
 */
export async function updateTeam(userId, teamId, updates) {
  const teamRef = doc(db, 'users', userId, 'teams', teamId);
  
  await updateDoc(teamRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

/**
 * Get all teams for a user
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
export async function getUserTeams(userId) {
  const teamsRef = collection(db, 'users', userId, 'teams');
  const q = query(teamsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Delete a team
 * @param {string} userId 
 * @param {string} teamId 
 */
export async function deleteTeam(userId, teamId) {
  const teamRef = doc(db, 'users', userId, 'teams', teamId);
  await deleteDoc(teamRef);
}

// ============ MATCH HISTORY ============

/**
 * Save a completed match
 * @param {string} userId 
 * @param {object} matchData 
 * @returns {Promise<string>} Match ID
 */
export async function saveMatch(userId, matchData) {
  const matchRef = doc(collection(db, 'users', userId, 'matches'));
  
  await setDoc(matchRef, {
    ...matchData,
    playedAt: serverTimestamp()
  });
  
  // Update user stats
  await updateUserStats(userId, matchData);
  
  return matchRef.id;
}

/**
 * Get match history for a user
 * @param {string} userId 
 * @param {number} limitCount 
 * @returns {Promise<Array>}
 */
export async function getMatchHistory(userId, limitCount = 20) {
  const matchesRef = collection(db, 'users', userId, 'matches');
  const q = query(matchesRef, orderBy('playedAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Update user stats after a match
 * @param {string} userId 
 * @param {object} matchData 
 */
async function updateUserStats(userId, matchData) {
  const userRef = doc(db, 'users', userId);
  
  const isWin = matchData.userScore > matchData.opponentScore;
  const isLoss = matchData.userScore < matchData.opponentScore;
  const isTie = matchData.userScore === matchData.opponentScore;
  
  await updateDoc(userRef, {
    'stats.matchesPlayed': increment(1),
    'stats.wins': increment(isWin ? 1 : 0),
    'stats.losses': increment(isLoss ? 1 : 0),
    'stats.ties': increment(isTie ? 1 : 0),
    'stats.totalPointsScored': increment(matchData.userScore || 0),
    'stats.totalPointsAllowed': increment(matchData.opponentScore || 0)
  });
}

// ============ GAME SAVES ============

/**
 * Save current game state
 * @param {string} userId 
 * @param {string} saveName 
 * @param {object} gameState 
 * @returns {Promise<string>} Save ID
 */
export async function saveGame(userId, saveName, gameState) {
  const saveRef = doc(collection(db, 'users', userId, 'saves'));
  
  await setDoc(saveRef, {
    name: saveName,
    gameState,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  return saveRef.id;
}

/**
 * Load a saved game
 * @param {string} userId 
 * @param {string} saveId 
 * @returns {Promise<object|null>}
 */
export async function loadGame(userId, saveId) {
  const saveRef = doc(db, 'users', userId, 'saves', saveId);
  const snapshot = await getDoc(saveRef);
  
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  
  return null;
}

/**
 * Get all saved games for a user
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
export async function getSavedGames(userId) {
  const savesRef = collection(db, 'users', userId, 'saves');
  const q = query(savesRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Update a saved game
 * @param {string} userId 
 * @param {string} saveId 
 * @param {object} gameState 
 */
export async function updateSave(userId, saveId, gameState) {
  const saveRef = doc(db, 'users', userId, 'saves', saveId);
  
  await updateDoc(saveRef, {
    gameState,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a saved game
 * @param {string} userId 
 * @param {string} saveId 
 */
export async function deleteSave(userId, saveId) {
  const saveRef = doc(db, 'users', userId, 'saves', saveId);
  await deleteDoc(saveRef);
}

// ============ PLAYER STATS ============

/**
 * Save player career stats
 * @param {string} userId 
 * @param {string} playerId
 * @param {object} stats 
 */
export async function savePlayerStats(userId, playerId, stats) {
  const playerRef = doc(db, 'users', userId, 'players', playerId);
  
  const snapshot = await getDoc(playerRef);
  
  if (snapshot.exists()) {
    // Update existing stats
    const existing = snapshot.data();
    await updateDoc(playerRef, {
      gamesPlayed: increment(1),
      totalPoints: increment(stats.points || 0),
      totalRebounds: increment(stats.rebounds || 0),
      totalAssists: increment(stats.assists || 0),
      totalSteals: increment(stats.steals || 0),
      totalBlocks: increment(stats.blocks || 0),
      twoPointAttempts: increment(stats.twoPointAttempts || 0),
      twoPointMade: increment(stats.twoPointMade || 0),
      threePointAttempts: increment(stats.threePointAttempts || 0),
      threePointMade: increment(stats.threePointMade || 0),
      updatedAt: serverTimestamp()
    });
  } else {
    // Create new player stats
    await setDoc(playerRef, {
      playerId,
      name: stats.name,
      position: stats.position,
      gamesPlayed: 1,
      totalPoints: stats.points || 0,
      totalRebounds: stats.rebounds || 0,
      totalAssists: stats.assists || 0,
      totalSteals: stats.steals || 0,
      totalBlocks: stats.blocks || 0,
      twoPointAttempts: stats.twoPointAttempts || 0,
      twoPointMade: stats.twoPointMade || 0,
      threePointAttempts: stats.threePointAttempts || 0,
      threePointMade: stats.threePointMade || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

/**
 * Get all player stats for a user
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
export async function getPlayerStats(userId) {
  const playersRef = collection(db, 'users', userId, 'players');
  const q = query(playersRef, orderBy('totalPoints', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
