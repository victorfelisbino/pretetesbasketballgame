/**
 * League Hub Component
 * Create leagues, select existing leagues, join via invite code
 */

import { useState, useEffect } from 'react';
import {
  getLeagues,
  createLeague,
  deleteLeague,
  joinLeagueByCode,
  BACKEND_LOCAL,
  BACKEND_FIRESTORE,
} from '../services/leagueService.js';

export default function LeagueHub({
  language = 'pt',
  onSelectLeague,
  onBack,
  userTeam,
  isAuthenticated = false,
  user = null,
}) {
  const [leagues, setLeagues] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [maxTeams, setMaxTeams] = useState(8);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const t = translations[language];
  const authCtx = { isAuthenticated, user };

  useEffect(() => {
    loadLeagues();
  }, [isAuthenticated]);

  const loadLeagues = async () => {
    setLoading(true);
    try {
      const result = await getLeagues(authCtx);
      setLeagues(result);
    } catch {
      setLeagues([]);
    }
    setLoading(false);
  };

  const handleCreateLeague = async (e) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const result = await createLeague(
        { name: newLeagueName.trim(), maxTeams },
        authCtx,
        userTeam || (teamName.trim() ? { name: teamName.trim(), isUserTeam: true } : null),
      );

      setNewLeagueName('');
      setTeamName('');
      setShowCreate(false);
      await loadLeagues();

      onSelectLeague(result.id, result.backend);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleJoinLeague = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim() || !joinTeamName.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const result = await joinLeagueByCode(
        inviteCode.trim(),
        { name: joinTeamName.trim() },
        authCtx,
      );

      setInviteCode('');
      setJoinTeamName('');
      setShowJoin(false);
      await loadLeagues();

      onSelectLeague(result.leagueId, BACKEND_FIRESTORE);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleDeleteLeague = async (leagueId, backend, e) => {
    e.stopPropagation();

    if (window.confirm(t.confirmDelete)) {
      await deleteLeague(leagueId, backend);
      await loadLeagues();
    }
  };

  return (
    <div className="league-hub">
      <div className="hub-header">
        <button className="back-btn" onClick={onBack}>
          ← {t.back}
        </button>
        <h2>🏆 {t.title}</h2>
      </div>

      {error && (
        <div className="error-message" style={{ color: '#ff4444', textAlign: 'center', padding: '10px', margin: '10px 0', background: 'rgba(255,68,68,0.1)', borderRadius: '8px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Action Buttons */}
      {!showCreate && !showJoin && (
        <div className="hub-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
          <button
            className="create-league-btn"
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(null); }}
          >
            ➕ {t.createLeague}
          </button>
          {isAuthenticated && (
            <button
              className="create-league-btn"
              onClick={() => { setShowJoin(true); setShowCreate(false); setError(null); }}
              style={{ background: '#4CAF50' }}
            >
              🔗 {t.joinLeague}
            </button>
          )}
        </div>
      )}

      {/* Create League Form */}
      {showCreate && (
        <form className="create-league-form" onSubmit={handleCreateLeague}>
          <h3>{t.newLeague}</h3>

          <div className="form-group">
            <label>{t.leagueName}</label>
            <input
              type="text"
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              placeholder={t.leagueNamePlaceholder}
              required
              autoFocus
            />
          </div>

          {/* Team name field for authenticated users who don't have a team yet */}
          {isAuthenticated && !userTeam && (
            <div className="form-group">
              <label>{t.yourTeamName}</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={t.teamNamePlaceholder}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>{t.maxTeams}</label>
            <select
              value={maxTeams}
              onChange={(e) => setMaxTeams(Number(e.target.value))}
            >
              <option value={4}>4 {t.teamsOption}</option>
              <option value={6}>6 {t.teamsOption}</option>
              <option value={8}>8 {t.teamsOption}</option>
              <option value={10}>10 {t.teamsOption}</option>
              <option value={12}>12 {t.teamsOption}</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="submit" className="action-btn primary" disabled={loading}>
              ✓ {loading ? t.creating : t.create}
            </button>
            <button
              type="button"
              className="action-btn secondary"
              onClick={() => { setShowCreate(false); setError(null); }}
            >
              ✕ {t.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Join League Form (authenticated only) */}
      {showJoin && (
        <form className="create-league-form" onSubmit={handleJoinLeague}>
          <h3>{t.joinLeagueTitle}</h3>

          <div className="form-group">
            <label>{t.inviteCodeLabel}</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              required
              autoFocus
              style={{ textTransform: 'uppercase', letterSpacing: '3px', fontSize: '1.2em', textAlign: 'center' }}
            />
          </div>

          <div className="form-group">
            <label>{t.yourTeamName}</label>
            <input
              type="text"
              value={joinTeamName}
              onChange={(e) => setJoinTeamName(e.target.value)}
              placeholder={t.teamNamePlaceholder}
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="action-btn primary" disabled={loading}>
              ✓ {loading ? t.joining : t.join}
            </button>
            <button
              type="button"
              className="action-btn secondary"
              onClick={() => { setShowJoin(false); setError(null); }}
            >
              ✕ {t.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Existing Leagues */}
      <div className="leagues-list">
        <h3>{t.yourLeagues}</h3>

        {loading && leagues.length === 0 ? (
          <div className="loading">
            <div className="loading-spinner"></div>
          </div>
        ) : leagues.length === 0 ? (
          <div className="empty-state">
            <p>{t.noLeagues}</p>
            <p className="hint">{t.createHint}</p>
          </div>
        ) : (
          <div className="leagues-grid">
            {leagues.map(league => (
              <div
                key={`${league.backend || 'local'}-${league.id}`}
                className="league-card"
                onClick={() => onSelectLeague(league.id, league.backend || BACKEND_LOCAL)}
              >
                <div className="league-card-header">
                  <h4>🏆 {league.name}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {league.backend === BACKEND_FIRESTORE && (
                      <span style={{ fontSize: '0.7em', background: '#4CAF50', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                        Online
                      </span>
                    )}
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDeleteLeague(league.id, league.backend || BACKEND_LOCAL, e)}
                      title={t.delete}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="league-card-info">
                  <span className="info-item">
                    📅 {t.season} {league.season}
                  </span>
                  <span className="info-item">
                    👥 {league.teams?.length || 0}/{league.maxTeams}
                  </span>
                  <span className={`status-badge status-${league.status}`}>
                    {t.statuses[league.status] || league.status}
                  </span>
                </div>

                {league.backend === BACKEND_FIRESTORE && league.inviteCode && (
                  <div className="league-card-leader" style={{ fontSize: '0.85em', color: '#888' }}>
                    {t.code}: <strong>{league.inviteCode}</strong>
                  </div>
                )}

                {league.backend === BACKEND_LOCAL && league.teams?.length > 0 && league.teams[0]?.stats && (
                  <div className="league-card-leader">
                    {t.leader}: <strong>
                      {[...league.teams].sort((a, b) =>
                        (b.stats?.wins || 0) - (a.stats?.wins || 0)
                      )[0]?.name || '-'}
                    </strong>
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
    title: 'Central de Ligas',
    back: 'Voltar',
    createLeague: 'Criar Nova Liga',
    joinLeague: 'Entrar com Código',
    newLeague: 'Nova Liga',
    joinLeagueTitle: 'Entrar numa Liga',
    inviteCodeLabel: 'Código de Convite',
    leagueName: 'Nome da Liga',
    leagueNamePlaceholder: 'Ex: Campeonato Brasileiro',
    yourTeamName: 'Nome do Seu Time',
    teamNamePlaceholder: 'Ex: Flamingos Basketball',
    maxTeams: 'Número de Times',
    teamsOption: 'times',
    create: 'Criar',
    creating: 'Criando...',
    join: 'Entrar',
    joining: 'Entrando...',
    cancel: 'Cancelar',
    yourLeagues: 'Suas Ligas',
    noLeagues: 'Você ainda não tem ligas.',
    createHint: 'Crie sua primeira liga para começar!',
    season: 'Temporada',
    statuses: {
      setup: 'Configuração',
      'in-progress': 'Em Andamento',
      completed: 'Finalizada'
    },
    leader: 'Líder',
    code: 'Código',
    delete: 'Excluir',
    confirmDelete: 'Tem certeza que deseja excluir esta liga?'
  },
  en: {
    title: 'League Hub',
    back: 'Back',
    createLeague: 'Create New League',
    joinLeague: 'Join with Code',
    newLeague: 'New League',
    joinLeagueTitle: 'Join a League',
    inviteCodeLabel: 'Invite Code',
    leagueName: 'League Name',
    leagueNamePlaceholder: 'E.g., National Championship',
    yourTeamName: 'Your Team Name',
    teamNamePlaceholder: 'E.g., Thunder Hawks',
    maxTeams: 'Number of Teams',
    teamsOption: 'teams',
    create: 'Create',
    creating: 'Creating...',
    join: 'Join',
    joining: 'Joining...',
    cancel: 'Cancel',
    yourLeagues: 'Your Leagues',
    noLeagues: "You don't have any leagues yet.",
    createHint: 'Create your first league to get started!',
    season: 'Season',
    statuses: {
      setup: 'Setup',
      'in-progress': 'In Progress',
      completed: 'Completed'
    },
    leader: 'Leader',
    code: 'Code',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this league?'
  }
};
