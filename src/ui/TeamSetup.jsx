import React, { useState } from 'react';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const defaultPlayers = {
  home: [
    { name: 'LeBron James', position: 'SF', skillLevel: 5 },
    { name: 'Anthony Davis', position: 'PF', skillLevel: 5 },
    { name: 'Austin Reaves', position: 'SG', skillLevel: 4 },
    { name: "D'Angelo Russell", position: 'PG', skillLevel: 4 },
    { name: 'Jaxson Hayes', position: 'C', skillLevel: 3 },
  ],
  away: [
    { name: 'Jayson Tatum', position: 'SF', skillLevel: 5 },
    { name: 'Jaylen Brown', position: 'SG', skillLevel: 4 },
    { name: 'Derrick White', position: 'PG', skillLevel: 4 },
    { name: 'Al Horford', position: 'C', skillLevel: 3 },
    { name: 'Kristaps Porziņģis', position: 'PF', skillLevel: 4 },
  ],
};

function TeamSetup({ onStartMatch, onBack, language }) {
  const [homeTeamName, setHomeTeamName] = useState('Lakers');
  const [awayTeamName, setAwayTeamName] = useState('Celtics');
  const [homePlayers, setHomePlayers] = useState(defaultPlayers.home);
  const [awayPlayers, setAwayPlayers] = useState(defaultPlayers.away);

  const texts = {
    pt: {
      title: '⚙️ Configurar Times',
      homeTeam: '🏠 Time da Casa',
      awayTeam: '✈️ Time Visitante',
      teamName: 'Nome do Time',
      skill: 'Hab.',
      startMatch: '🏀 Iniciar Partida!',
      position: 'Pos',
      back: '← Voltar',
    },
    en: {
      title: '⚙️ Team Setup',
      homeTeam: '🏠 Home Team',
      awayTeam: '✈️ Away Team',
      teamName: 'Team Name',
      skill: 'Skill',
      startMatch: '🏀 Start Match!',
      position: 'Pos',
      back: '← Back',
    },
  };

  const t = texts[language] || texts.pt;

  const updatePlayer = (team, index, field, value) => {
    const setter = team === 'home' ? setHomePlayers : setAwayPlayers;
    const players = team === 'home' ? homePlayers : awayPlayers;
    
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    setter(updated);
  };

  const handleStartMatch = () => {
    // Build team objects compatible with game engine
    const homeTeam = {
      name: homeTeamName,
      players: homePlayers.map(p => ({
        ...p,
        skillLevel: parseInt(p.skillLevel),
        stats: { pointsScored: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 },
        isActive: true,
        stamina: 100, // Full stamina at game start
        maxStamina: 100,
        x: 0,
        y: 0,
      })),
      score: 0,
      getActivePlayers() {
        return this.players.filter(p => p.isActive).slice(0, 5);
      },
      getActivePlayersOnCourt() {
        return this.getActivePlayers();
      },
    };

    const awayTeam = {
      name: awayTeamName,
      players: awayPlayers.map(p => ({
        ...p,
        skillLevel: parseInt(p.skillLevel),
        stats: { pointsScored: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 },
        isActive: true,
        stamina: 100, // Full stamina at game start
        maxStamina: 100,
        x: 0,
        y: 0,
      })),
      score: 0,
      getActivePlayers() {
        return this.players.filter(p => p.isActive).slice(0, 5);
      },
      getActivePlayersOnCourt() {
        return this.getActivePlayers();
      },
    };

    // Add addPoints method to players
    homeTeam.players.forEach(p => {
      p.addPoints = function(pts) { this.stats.pointsScored += pts; };
    });
    awayTeam.players.forEach(p => {
      p.addPoints = function(pts) { this.stats.pointsScored += pts; };
    });

    onStartMatch(homeTeam, awayTeam);
  };

  const renderPlayerRow = (player, index, team) => (
    <div className="player-row" key={index}>
      <span className="player-position">{player.position}</span>
      <input
        type="text"
        className="player-name-input"
        value={player.name}
        onChange={(e) => updatePlayer(team, index, 'name', e.target.value)}
        placeholder={`Player ${index + 1}`}
      />
      <select
        className="skill-select"
        value={player.skillLevel}
        onChange={(e) => updatePlayer(team, index, 'skillLevel', e.target.value)}
      >
        <option value={1}>⭐</option>
        <option value={2}>⭐⭐</option>
        <option value={3}>⭐⭐⭐</option>
        <option value={4}>⭐⭐⭐⭐</option>
        <option value={5}>⭐⭐⭐⭐⭐</option>
      </select>
    </div>
  );

  return (
    <div className="team-setup">
      {onBack && (
        <button className="back-btn" onClick={onBack} style={{
          marginBottom: '20px',
          padding: '10px 20px',
          background: 'transparent',
          border: '2px solid #ff6b35',
          color: '#ff6b35',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '1rem'
        }}>
          {t.back}
        </button>
      )}
      <h2>{t.title}</h2>

      <div className="teams-container">
        {/* Home Team */}
        <div className="team-card home">
          <h3>{t.homeTeam}</h3>
          <input
            type="text"
            className="team-name-input"
            value={homeTeamName}
            onChange={(e) => setHomeTeamName(e.target.value)}
            placeholder={t.teamName}
          />
          <div className="roster">
            {homePlayers.map((player, i) => renderPlayerRow(player, i, 'home'))}
          </div>
        </div>

        {/* Away Team */}
        <div className="team-card away">
          <h3>{t.awayTeam}</h3>
          <input
            type="text"
            className="team-name-input"
            value={awayTeamName}
            onChange={(e) => setAwayTeamName(e.target.value)}
            placeholder={t.teamName}
          />
          <div className="roster">
            {awayPlayers.map((player, i) => renderPlayerRow(player, i, 'away'))}
          </div>
        </div>
      </div>

      <button className="start-match-btn" onClick={handleStartMatch}>
        {t.startMatch}
      </button>
    </div>
  );
}

export default TeamSetup;
