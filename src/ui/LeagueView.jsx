/**
 * League View Component
 * Shows standings, schedule, and league management
 */

import { useState, useEffect } from 'react';
import { 
  getLocalLeague, 
  getLocalStandings, 
  getLocalUpcomingMatches,
  getNextUserMatch,
  generateLocalSchedule,
  generateAITeams,
  addTeamToLocalLeague,
  startLocalNewSeason
} from '../league/localLeague.js';

export default function LeagueView({ 
  leagueId, 
  language = 'pt', 
  onPlayMatch, 
  onBack 
}) {
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [nextUserMatch, setNextUserMatch] = useState(null);
  const [activeTab, setActiveTab] = useState('standings');

  const t = translations[language];

  useEffect(() => {
    loadLeagueData();
  }, [leagueId]);

  const loadLeagueData = () => {
    const leagueData = getLocalLeague(leagueId);
    setLeague(leagueData);
    
    if (leagueData) {
      setStandings(getLocalStandings(leagueId));
      setUpcomingMatches(getLocalUpcomingMatches(leagueId, 10));
      setNextUserMatch(getNextUserMatch(leagueId));
    }
  };

  const handleStartSeason = () => {
    generateLocalSchedule(leagueId);
    loadLeagueData();
  };

  const handleAddAITeams = () => {
    const currentCount = league?.teams?.length || 0;
    const needed = (league?.maxTeams || 8) - currentCount;
    if (needed > 0) {
      generateAITeams(leagueId, needed);
      loadLeagueData();
    }
  };

  const handlePlayNextMatch = () => {
    if (nextUserMatch && onPlayMatch) {
      const homeTeam = league.teams.find(t => t.id === nextUserMatch.homeTeamId);
      const awayTeam = league.teams.find(t => t.id === nextUserMatch.awayTeamId);
      
      onPlayMatch({
        leagueId,
        matchId: nextUserMatch.id,
        homeTeam,
        awayTeam
      });
    }
  };

  const handleNewSeason = () => {
    startLocalNewSeason(leagueId);
    loadLeagueData();
  };

  if (!league) {
    return (
      <div className="league-view">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="league-view">
      <div className="league-header">
        <button className="back-btn" onClick={onBack}>
          ← {t.back}
        </button>
        <div className="league-title">
          <h2>🏆 {league.name}</h2>
          <span className="season-badge">
            {t.season} {league.season}
          </span>
        </div>
        <span className={`status-badge status-${league.status}`}>
          {t.statuses[league.status]}
        </span>
      </div>

      {/* Setup Phase */}
      {league.status === 'setup' && (
        <div className="league-setup-panel">
          <h3>{t.setupTitle}</h3>
          <p>{t.teamsCount}: {league.teams.length} / {league.maxTeams}</p>
          
          {league.teams.length < league.maxTeams && (
            <button className="action-btn" onClick={handleAddAITeams}>
              🤖 {t.addAITeams}
            </button>
          )}
          
          {league.teams.length >= 2 && (
            <button className="action-btn primary" onClick={handleStartSeason}>
              🚀 {t.startSeason}
            </button>
          )}
        </div>
      )}

      {/* Next Match CTA */}
      {league.status === 'in-progress' && nextUserMatch && (
        <div className="next-match-card">
          <h3>🎮 {t.nextMatch}</h3>
          <div className="match-preview">
            <span className="team-name">{nextUserMatch.homeTeamName}</span>
            <span className="vs">VS</span>
            <span className="team-name">{nextUserMatch.awayTeamName}</span>
          </div>
          <p className="round-info">{t.round} {nextUserMatch.round}</p>
          <button className="play-btn" onClick={handlePlayNextMatch}>
            🏀 {t.playNow}
          </button>
        </div>
      )}

      {/* Season Complete */}
      {league.status === 'completed' && (
        <div className="season-complete-card">
          <h3>🏆 {t.seasonComplete}</h3>
          <p className="champion">
            {t.champion}: <strong>{standings[0]?.name}</strong>
          </p>
          <button className="action-btn primary" onClick={handleNewSeason}>
            🔄 {t.newSeason}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="league-tabs">
        <button 
          className={`tab ${activeTab === 'standings' ? 'active' : ''}`}
          onClick={() => setActiveTab('standings')}
        >
          📊 {t.standings}
        </button>
        <button 
          className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          📅 {t.schedule}
        </button>
        <button 
          className={`tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          👥 {t.teams}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'standings' && (
          <div className="standings-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.team}</th>
                  <th>{t.played}</th>
                  <th>{t.wins}</th>
                  <th>{t.draws}</th>
                  <th>{t.losses}</th>
                  <th>{t.pf}</th>
                  <th>{t.pa}</th>
                  <th>{t.diff}</th>
                  <th>{t.pts}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, index) => (
                  <tr key={team.id} className={team.isUserTeam ? 'user-team' : ''}>
                    <td>{index + 1}</td>
                    <td className="team-name-cell">
                      {team.isUserTeam && '⭐ '}
                      {team.name}
                    </td>
                    <td>{team.stats.played}</td>
                    <td>{team.stats.wins}</td>
                    <td>{team.stats.draws}</td>
                    <td>{team.stats.losses}</td>
                    <td>{team.stats.pointsFor}</td>
                    <td>{team.stats.pointsAgainst}</td>
                    <td>{team.stats.pointsFor - team.stats.pointsAgainst}</td>
                    <td className="points">{team.stats.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="schedule-list">
            {league.schedule?.length === 0 ? (
              <p className="empty-message">{t.noSchedule}</p>
            ) : (
              <>
                {/* Group by round */}
                {Array.from(new Set(league.schedule?.map(m => m.round) || [])).map(round => (
                  <div key={round} className="round-group">
                    <h4>{t.round} {round}</h4>
                    <div className="matches-grid">
                      {league.schedule
                        .filter(m => m.round === round)
                        .map(match => (
                          <div 
                            key={match.id} 
                            className={`match-card ${match.status}`}
                          >
                            <div className="match-teams">
                              <span className={match.homeScore > match.awayScore ? 'winner' : ''}>
                                {match.homeTeamName}
                              </span>
                              <span className="score">
                                {match.status === 'completed' 
                                  ? `${match.homeScore} - ${match.awayScore}`
                                  : 'vs'
                                }
                              </span>
                              <span className={match.awayScore > match.homeScore ? 'winner' : ''}>
                                {match.awayTeamName}
                              </span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="teams-grid">
            {league.teams.map(team => (
              <div key={team.id} className={`team-card ${team.isUserTeam ? 'user-team' : ''}`}>
                <h4>
                  {team.isUserTeam && '⭐ '}
                  {team.name}
                </h4>
                <div className="team-roster">
                  {team.players?.map(player => (
                    <div key={player.id} className="player-mini">
                      <span className="position">{player.position}</span>
                      <span className="name">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const translations = {
  pt: {
    loading: 'Carregando...',
    back: 'Voltar',
    season: 'Temporada',
    statuses: {
      setup: 'Configuração',
      'in-progress': 'Em Andamento',
      completed: 'Finalizada'
    },
    setupTitle: 'Configure sua Liga',
    teamsCount: 'Times',
    addAITeams: 'Adicionar Times IA',
    startSeason: 'Iniciar Temporada',
    nextMatch: 'Próxima Partida',
    round: 'Rodada',
    playNow: 'Jogar Agora',
    seasonComplete: 'Temporada Concluída!',
    champion: 'Campeão',
    newSeason: 'Nova Temporada',
    standings: 'Classificação',
    schedule: 'Calendário',
    teams: 'Times',
    team: 'Time',
    played: 'J',
    wins: 'V',
    draws: 'E',
    losses: 'D',
    pf: 'PP',
    pa: 'PC',
    diff: 'SG',
    pts: 'Pts',
    noSchedule: 'Nenhuma partida agendada ainda.'
  },
  en: {
    loading: 'Loading...',
    back: 'Back',
    season: 'Season',
    statuses: {
      setup: 'Setup',
      'in-progress': 'In Progress',
      completed: 'Completed'
    },
    setupTitle: 'Set Up Your League',
    teamsCount: 'Teams',
    addAITeams: 'Add AI Teams',
    startSeason: 'Start Season',
    nextMatch: 'Next Match',
    round: 'Round',
    playNow: 'Play Now',
    seasonComplete: 'Season Complete!',
    champion: 'Champion',
    newSeason: 'New Season',
    standings: 'Standings',
    schedule: 'Schedule',
    teams: 'Teams',
    team: 'Team',
    played: 'P',
    wins: 'W',
    draws: 'D',
    losses: 'L',
    pf: 'PF',
    pa: 'PA',
    diff: 'Diff',
    pts: 'Pts',
    noSchedule: 'No matches scheduled yet.'
  }
};
