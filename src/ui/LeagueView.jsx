/**
 * League View Component
 * Shows standings, schedule, and league management
 * Supports both localStorage and Firestore backends via leagueService
 */

import { useState, useEffect } from 'react';
import {
  getLeague,
  getStandings,
  addAITeams,
  generateSchedule,
  getNextUserMatch as svcGetNextUserMatch,
  startNewSeason,
  BACKEND_LOCAL,
  BACKEND_FIRESTORE,
} from '../services/leagueService.js';

export default function LeagueView({
  leagueId,
  backend = BACKEND_LOCAL,
  language = 'pt',
  isAuthenticated = false,
  user = null,
  onPlayMatch,
  onBack,
}) {
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [nextUserMatch, setNextUserMatch] = useState(null);
  const [activeTab, setActiveTab] = useState('standings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const t = translations[language];
  const authCtx = { isAuthenticated, user };

  useEffect(() => {
    loadLeagueData();
  }, [leagueId, backend]);

  const loadLeagueData = async () => {
    setLoading(true);
    setError(null);

    try {
      const leagueData = await getLeague(leagueId, backend, authCtx);
      setLeague(leagueData);

      if (leagueData) {
        // Standings
        if (backend === BACKEND_LOCAL) {
          const st = await getStandings(leagueId, backend, authCtx);
          setStandings(st);
        } else {
          // For Firestore, standings are embedded in the normalized league
          setStandings(
            [...(leagueData.teams || [])].sort((a, b) => {
              if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
              const aDiff = a.stats.pointsFor - a.stats.pointsAgainst;
              const bDiff = b.stats.pointsFor - b.stats.pointsAgainst;
              if (bDiff !== aDiff) return bDiff - aDiff;
              return b.stats.pointsFor - a.stats.pointsFor;
            })
          );
        }

        // Next user match
        if (backend === BACKEND_LOCAL) {
          const nxt = await svcGetNextUserMatch(leagueId, backend);
          setNextUserMatch(nxt);
        } else {
          // For Firestore, compute from schedule
          const userTeam = leagueData.teams?.find(t => t.isUserTeam);
          if (userTeam) {
            const nxt = (leagueData.schedule || []).find(m =>
              m.status === 'scheduled' &&
              (m.homeTeamId === userTeam.id || m.awayTeamId === userTeam.id)
            );
            setNextUserMatch(nxt || null);
          } else {
            setNextUserMatch(null);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const handleStartSeason = async () => {
    setError(null);
    try {
      await generateSchedule(leagueId, backend, league);
      await loadLeagueData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddAITeams = async () => {
    const currentCount = league?.teams?.length || 0;
    const needed = (league?.maxTeams || 8) - currentCount;
    if (needed > 0) {
      setError(null);
      try {
        await addAITeams(leagueId, needed, backend);
        await loadLeagueData();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handlePlayNextMatch = () => {
    if (nextUserMatch && onPlayMatch && league) {
      const homeTeam = league.teams.find(t => t.id === nextUserMatch.homeTeamId);
      const awayTeam = league.teams.find(t => t.id === nextUserMatch.awayTeamId);

      onPlayMatch({
        leagueId,
        backend,
        matchId: nextUserMatch.id,
        homeTeam,
        awayTeam,
      });
    }
  };

  const handleNewSeason = async () => {
    setError(null);
    try {
      await startNewSeason(leagueId, backend);
      await loadLeagueData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="league-view">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>{t.loading}</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="league-view">
        <button className="back-btn" onClick={onBack}>← {t.back}</button>
        <p style={{ textAlign: 'center', marginTop: '40px' }}>
          {error || (language === 'pt' ? 'Liga não encontrada.' : 'League not found.')}
        </p>
      </div>
    );
  }

  const upcomingMatches = (league.schedule || []).filter(m => m.status === 'scheduled').slice(0, 10);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {backend === BACKEND_FIRESTORE && (
            <span style={{ fontSize: '0.7em', background: '#4CAF50', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
              Online
            </span>
          )}
          <span className={`status-badge status-${league.status}`}>
            {t.statuses[league.status] || league.status}
          </span>
        </div>
      </div>

      {/* Invite Code Banner (Firestore leagues) */}
      {backend === BACKEND_FIRESTORE && league.inviteCode && (
        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px', margin: '10px 0', fontSize: '0.9em' }}>
          {language === 'pt' ? 'Código de Convite: ' : 'Invite Code: '}
          <strong style={{ letterSpacing: '2px', fontSize: '1.1em' }}>{league.inviteCode}</strong>
        </div>
      )}

      {error && (
        <div style={{ color: '#ff4444', textAlign: 'center', padding: '10px', margin: '10px 0', background: 'rgba(255,68,68,0.1)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

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
                  <th>{t.losses}</th>
                  <th>{t.pct}</th>
                  <th>{t.pf}</th>
                  <th>{t.pa}</th>
                  <th>{t.diff}</th>
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
                    <td>{team.stats.losses}</td>
                    <td className="points">{team.stats.played > 0 ? (team.stats.wins / team.stats.played).toFixed(3) : '.000'}</td>
                    <td>{team.stats.pointsFor}</td>
                    <td>{team.stats.pointsAgainst}</td>
                    <td>{team.stats.pointsFor - team.stats.pointsAgainst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="schedule-list">
            {(league.schedule || []).length === 0 ? (
              <p className="empty-message">{t.noSchedule}</p>
            ) : (
              <>
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
                {team.players && (
                  <div className="team-roster">
                    {team.players.map(player => (
                      <div key={player.id} className="player-mini">
                        <span className="position">{player.position}</span>
                        <span className="name">{player.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!team.players && team.stats && (
                  <div className="team-roster" style={{ fontSize: '0.85em', color: '#aaa' }}>
                    {team.stats.wins}W - {team.stats.losses}L
                  </div>
                )}
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
    losses: 'D',
    pct: 'PCT',
    pf: 'PP',
    pa: 'PC',
    diff: 'SG',
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
    played: 'GP',
    wins: 'W',
    losses: 'L',
    pct: 'PCT',
    pf: 'PF',
    pa: 'PA',
    diff: 'Diff',
    noSchedule: 'No matches scheduled yet.'
  }
};
