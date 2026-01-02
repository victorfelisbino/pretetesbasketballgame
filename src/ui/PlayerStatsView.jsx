/**
 * Player Stats View Component
 * Displays career stats, leaderboards, and player profiles
 */

import { useState, useEffect } from 'react';
import { 
  getAllPlayers, 
  getTopPPG, 
  getLeaderboard,
  getPlayerSummary 
} from '../stats/playerStats.js';

export default function PlayerStatsView({ language = 'pt', onBack }) {
  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState('leaders');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [statCategory, setStatCategory] = useState('totalPoints');

  const t = translations[language];

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = () => {
    setPlayers(getAllPlayers());
  };

  const handleSelectPlayer = (playerId) => {
    const summary = getPlayerSummary(playerId);
    setSelectedPlayer(summary);
    setActiveTab('profile');
  };

  const getLeaderboardData = () => {
    switch (statCategory) {
      case 'ppg':
        return getTopPPG(10, 1);
      case 'totalPoints':
      case 'rebounds':
      case 'assists':
      case 'steals':
      case 'blocks':
        return getLeaderboard(statCategory, 10);
      default:
        return getLeaderboard('totalPoints', 10);
    }
  };

  return (
    <div className="stats-view">
      <div className="stats-header">
        <button className="back-btn" onClick={onBack}>
          ← {t.back}
        </button>
        <h2>📊 {t.title}</h2>
      </div>

      {/* Tabs */}
      <div className="league-tabs">
        <button 
          className={`tab ${activeTab === 'leaders' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaders')}
        >
          🏆 {t.leaderboards}
        </button>
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          👥 {t.allPlayers}
        </button>
        {selectedPlayer && (
          <button 
            className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 {t.profile}
          </button>
        )}
      </div>

      <div className="tab-content">
        {/* Leaderboards */}
        {activeTab === 'leaders' && (
          <div className="leaderboards">
            <div className="stat-selector">
              <label>{t.category}:</label>
              <select 
                value={statCategory} 
                onChange={(e) => setStatCategory(e.target.value)}
              >
                <option value="totalPoints">{t.totalPoints}</option>
                <option value="ppg">{t.ppg}</option>
                <option value="rebounds">{t.rebounds}</option>
                <option value="assists">{t.assists}</option>
                <option value="steals">{t.steals}</option>
                <option value="blocks">{t.blocks}</option>
              </select>
            </div>

            {players.length === 0 ? (
              <div className="empty-state">
                <p>{t.noStats}</p>
                <p className="hint">{t.playGames}</p>
              </div>
            ) : (
              <div className="leaderboard-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t.player}</th>
                      <th>{t.pos}</th>
                      <th>{t.games}</th>
                      <th>{t.statLabels[statCategory]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getLeaderboardData().map((player, index) => (
                      <tr 
                        key={player.id}
                        onClick={() => handleSelectPlayer(player.id)}
                        className="clickable"
                      >
                        <td className={index < 3 ? `rank-${index + 1}` : ''}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </td>
                        <td className="player-name">{player.name}</td>
                        <td>{player.position}</td>
                        <td>{player.gamesPlayed}</td>
                        <td className="stat-value">
                          {statCategory === 'ppg' ? player.ppg : player[statCategory]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* All Players */}
        {activeTab === 'all' && (
          <div className="all-players">
            {players.length === 0 ? (
              <div className="empty-state">
                <p>{t.noStats}</p>
              </div>
            ) : (
              <div className="players-grid">
                {players
                  .sort((a, b) => b.totalPoints - a.totalPoints)
                  .map(player => (
                    <div 
                      key={player.id} 
                      className="player-card"
                      onClick={() => handleSelectPlayer(player.id)}
                    >
                      <div className="player-card-header">
                        <span className="position-badge">{player.position}</span>
                        <span className="player-name">{player.name}</span>
                      </div>
                      <div className="player-card-stats">
                        <div className="stat-item">
                          <span className="stat-label">{t.games}</span>
                          <span className="stat-value">{player.gamesPlayed}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">{t.pts}</span>
                          <span className="stat-value">{player.totalPoints}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">{t.reb}</span>
                          <span className="stat-value">{player.rebounds}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">{t.ast}</span>
                          <span className="stat-value">{player.assists}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* Player Profile */}
        {activeTab === 'profile' && selectedPlayer && (
          <div className="player-profile">
            <div className="profile-header">
              <div className="profile-position">{selectedPlayer.position}</div>
              <h3>{selectedPlayer.name}</h3>
              <p className="profile-team">{selectedPlayer.team}</p>
            </div>

            <div className="profile-overview">
              <div className="big-stat">
                <span className="value">{selectedPlayer.ppg}</span>
                <span className="label">PPG</span>
              </div>
              <div className="big-stat">
                <span className="value">{selectedPlayer.rpg}</span>
                <span className="label">RPG</span>
              </div>
              <div className="big-stat">
                <span className="value">{selectedPlayer.apg}</span>
                <span className="label">APG</span>
              </div>
            </div>

            <div className="profile-section">
              <h4>{t.careerTotals}</h4>
              <div className="stats-grid">
                <div className="stat-box">
                  <span className="label">{t.gamesPlayed}</span>
                  <span className="value">{selectedPlayer.gamesPlayed}</span>
                </div>
                <div className="stat-box">
                  <span className="label">{t.totalPoints}</span>
                  <span className="value">{selectedPlayer.totalPoints}</span>
                </div>
                <div className="stat-box">
                  <span className="label">{t.rebounds}</span>
                  <span className="value">{selectedPlayer.rebounds}</span>
                </div>
                <div className="stat-box">
                  <span className="label">{t.assists}</span>
                  <span className="value">{selectedPlayer.assists}</span>
                </div>
                <div className="stat-box">
                  <span className="label">{t.steals}</span>
                  <span className="value">{selectedPlayer.steals}</span>
                </div>
                <div className="stat-box">
                  <span className="label">{t.blocks}</span>
                  <span className="value">{selectedPlayer.blocks}</span>
                </div>
              </div>
            </div>

            {selectedPlayer.shooting && (
              <div className="profile-section">
                <h4>{t.shooting}</h4>
                <div className="shooting-bars">
                  <div className="shooting-stat">
                    <span className="label">2PT</span>
                    <div className="bar-container">
                      <div 
                        className="bar" 
                        style={{ width: `${selectedPlayer.shooting.twoPoint}%` }}
                      ></div>
                    </div>
                    <span className="pct">{selectedPlayer.shooting.twoPoint}%</span>
                  </div>
                  <div className="shooting-stat">
                    <span className="label">3PT</span>
                    <div className="bar-container">
                      <div 
                        className="bar three-point" 
                        style={{ width: `${selectedPlayer.shooting.threePoint}%` }}
                      ></div>
                    </div>
                    <span className="pct">{selectedPlayer.shooting.threePoint}%</span>
                  </div>
                  <div className="shooting-stat">
                    <span className="label">FG</span>
                    <div className="bar-container">
                      <div 
                        className="bar fg" 
                        style={{ width: `${selectedPlayer.shooting.fieldGoal}%` }}
                      ></div>
                    </div>
                    <span className="pct">{selectedPlayer.shooting.fieldGoal}%</span>
                  </div>
                </div>
              </div>
            )}

            <div className="profile-section">
              <h4>{t.records}</h4>
              <div className="records-row">
                <div className="record-item">
                  <span className="label">{t.highScore}</span>
                  <span className="value">{selectedPlayer.highestPoints}</span>
                </div>
                <div className="record-item">
                  <span className="label">{t.doubleDigitGames}</span>
                  <span className="value">{selectedPlayer.gamesWithDoubleDigits}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const translations = {
  pt: {
    title: 'Estatísticas dos Jogadores',
    back: 'Voltar',
    leaderboards: 'Líderes',
    allPlayers: 'Todos',
    profile: 'Perfil',
    category: 'Categoria',
    totalPoints: 'Pontos Totais',
    ppg: 'Pontos/Jogo',
    rebounds: 'Rebotes',
    assists: 'Assistências',
    steals: 'Roubos',
    blocks: 'Tocos',
    noStats: 'Nenhuma estatística ainda.',
    playGames: 'Jogue algumas partidas para ver as estatísticas!',
    player: 'Jogador',
    pos: 'Pos',
    games: 'Jogos',
    pts: 'PTS',
    reb: 'REB',
    ast: 'AST',
    statLabels: {
      totalPoints: 'Pts',
      ppg: 'PPG',
      rebounds: 'Reb',
      assists: 'Ast',
      steals: 'Rou',
      blocks: 'Toc'
    },
    careerTotals: 'Totais da Carreira',
    gamesPlayed: 'Jogos',
    shooting: 'Arremessos',
    records: 'Recordes',
    highScore: 'Maior Pontuação',
    doubleDigitGames: 'Jogos 10+ Pts'
  },
  en: {
    title: 'Player Statistics',
    back: 'Back',
    leaderboards: 'Leaders',
    allPlayers: 'All',
    profile: 'Profile',
    category: 'Category',
    totalPoints: 'Total Points',
    ppg: 'Points/Game',
    rebounds: 'Rebounds',
    assists: 'Assists',
    steals: 'Steals',
    blocks: 'Blocks',
    noStats: 'No statistics yet.',
    playGames: 'Play some matches to see stats!',
    player: 'Player',
    pos: 'Pos',
    games: 'Games',
    pts: 'PTS',
    reb: 'REB',
    ast: 'AST',
    statLabels: {
      totalPoints: 'Pts',
      ppg: 'PPG',
      rebounds: 'Reb',
      assists: 'Ast',
      steals: 'Stl',
      blocks: 'Blk'
    },
    careerTotals: 'Career Totals',
    gamesPlayed: 'Games',
    shooting: 'Shooting',
    records: 'Records',
    highScore: 'High Score',
    doubleDigitGames: '10+ Point Games'
  }
};
