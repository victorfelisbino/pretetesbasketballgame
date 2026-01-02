/**
 * League Hub Component
 * Create leagues, select existing leagues, manage league overview
 */

import { useState, useEffect } from 'react';
import { 
  createLocalLeague, 
  getLocalLeagues, 
  addTeamToLocalLeague,
  deleteLocalLeague 
} from '../league/localLeague.js';

export default function LeagueHub({ 
  language = 'pt', 
  onSelectLeague, 
  onBack,
  userTeam 
}) {
  const [leagues, setLeagues] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [maxTeams, setMaxTeams] = useState(8);

  const t = translations[language];

  useEffect(() => {
    loadLeagues();
  }, []);

  const loadLeagues = () => {
    setLeagues(getLocalLeagues());
  };

  const handleCreateLeague = (e) => {
    e.preventDefault();
    
    if (!newLeagueName.trim()) return;

    // Create league
    const league = createLocalLeague({
      name: newLeagueName.trim(),
      maxTeams
    });

    // Add user's team to the new league
    if (userTeam) {
      addTeamToLocalLeague(league.id, {
        ...userTeam,
        isUserTeam: true
      });
    }

    setNewLeagueName('');
    setShowCreate(false);
    loadLeagues();
    
    // Go directly to the new league
    onSelectLeague(league.id);
  };

  const handleDeleteLeague = (leagueId, e) => {
    e.stopPropagation();
    
    if (window.confirm(t.confirmDelete)) {
      deleteLocalLeague(leagueId);
      loadLeagues();
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

      {/* Create League Button / Form */}
      {!showCreate ? (
        <button 
          className="create-league-btn"
          onClick={() => setShowCreate(true)}
        >
          ➕ {t.createLeague}
        </button>
      ) : (
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
            <button type="submit" className="action-btn primary">
              ✓ {t.create}
            </button>
            <button 
              type="button" 
              className="action-btn secondary"
              onClick={() => setShowCreate(false)}
            >
              ✕ {t.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Existing Leagues */}
      <div className="leagues-list">
        <h3>{t.yourLeagues}</h3>
        
        {leagues.length === 0 ? (
          <div className="empty-state">
            <p>{t.noLeagues}</p>
            <p className="hint">{t.createHint}</p>
          </div>
        ) : (
          <div className="leagues-grid">
            {leagues.map(league => (
              <div 
                key={league.id}
                className="league-card"
                onClick={() => onSelectLeague(league.id)}
              >
                <div className="league-card-header">
                  <h4>🏆 {league.name}</h4>
                  <button 
                    className="delete-btn"
                    onClick={(e) => handleDeleteLeague(league.id, e)}
                    title={t.delete}
                  >
                    🗑️
                  </button>
                </div>
                
                <div className="league-card-info">
                  <span className="info-item">
                    📅 {t.season} {league.season}
                  </span>
                  <span className="info-item">
                    👥 {league.teams?.length || 0}/{league.maxTeams}
                  </span>
                  <span className={`status-badge status-${league.status}`}>
                    {t.statuses[league.status]}
                  </span>
                </div>

                {league.teams?.length > 0 && (
                  <div className="league-card-leader">
                    {t.leader}: <strong>
                      {league.teams.sort((a, b) => 
                        (b.stats?.points || 0) - (a.stats?.points || 0)
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
    newLeague: 'Nova Liga',
    leagueName: 'Nome da Liga',
    leagueNamePlaceholder: 'Ex: Campeonato Brasileiro',
    maxTeams: 'Número de Times',
    teamsOption: 'times',
    create: 'Criar',
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
    delete: 'Excluir',
    confirmDelete: 'Tem certeza que deseja excluir esta liga?'
  },
  en: {
    title: 'League Hub',
    back: 'Back',
    createLeague: 'Create New League',
    newLeague: 'New League',
    leagueName: 'League Name',
    leagueNamePlaceholder: 'E.g., National Championship',
    maxTeams: 'Number of Teams',
    teamsOption: 'teams',
    create: 'Create',
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
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this league?'
  }
};
