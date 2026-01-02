/**
 * Firebase barrel export
 */

export { auth, db } from './config.js';

export { 
  signUp, 
  signIn, 
  signInWithGoogle, 
  logOut, 
  onAuthChange, 
  getCurrentUser,
  getUserData
} from './auth.js';

export {
  saveTeam,
  updateTeam,
  getUserTeams,
  deleteTeam,
  saveMatch,
  getMatchHistory,
  saveGame,
  loadGame,
  getSavedGames,
  updateSave,
  deleteSave,
  savePlayerStats,
  getPlayerStats
} from './database.js';

export {
  createLeague,
  getLeague,
  getUserLeagues,
  addTeamToLeague,
  generateSchedule,
  recordMatchResult,
  getStandings,
  getUpcomingMatches,
  getRecentResults,
  startNewSeason
} from './league.js';
