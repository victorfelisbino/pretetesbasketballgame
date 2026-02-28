import React, { useState, useEffect, useRef } from 'react';
import BasketballCourt from './BasketballCourt.jsx';
import { GameController } from '../gameController.js';

function MatchView({ homeTeam, awayTeam, language, onMatchEnd }) {
  const [round, setRound] = useState(0);
  const [quarter, setQuarter] = useState(1);
  const [gameTime, setGameTime] = useState(720);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [narrationLog, setNarrationLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [playerStats, setPlayerStats] = useState({ home: [], away: [] });
  const [finalResult, setFinalResult] = useState(null);
  const [possession, setPossession] = useState('home');
  const [showCourt, setShowCourt] = useState(true);
  const [currentAction, setCurrentAction] = useState(null);
  const [homeFouls, setHomeFouls] = useState(0);
  const [awayFouls, setAwayFouls] = useState(0);
  const [homeQuarterFouls, setHomeQuarterFouls] = useState(0);
  const [awayQuarterFouls, setAwayQuarterFouls] = useState(0);
  const [homeTimeouts, setHomeTimeouts] = useState(7);
  const [awayTimeouts, setAwayTimeouts] = useState(7);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const gcRef = useRef(null);
  const narrationFeedRef = useRef(null);

  useEffect(() => {
    if (gcRef.current) {
      gcRef.current.setLanguage(language);
    }
  }, [language]);

  useEffect(() => {
    if (narrationFeedRef.current) {
      narrationFeedRef.current.scrollTop = narrationFeedRef.current.scrollHeight;
    }
  }, [narrationLog]);

  const simulateMatch = async () => {
    setIsSimulating(true);
    setNarrationLog([]);
    setHomeScore(0);
    setAwayScore(0);
    setHomeFouls(0);
    setAwayFouls(0);
    setHomeQuarterFouls(0);
    setAwayQuarterFouls(0);
    setCurrentAction(null);

    const gc = new GameController(homeTeam, awayTeam, { language, speed: 50 });
    gcRef.current = gc;

    gc.subscribe(({ event, state, data }) => {
      setRound(state.round);
      setQuarter(state.quarter);
      setGameTime(state.gameTime);
      setHomeScore(state.homeScore);
      setAwayScore(state.awayScore);
      setPossession(state.possession);
      setHomeFouls(state.homeFouls);
      setAwayFouls(state.awayFouls);
      setHomeQuarterFouls(state.homeQuarterFouls);
      setAwayQuarterFouls(state.awayQuarterFouls);
      setHomeTimeouts(state.homeTimeouts);
      setAwayTimeouts(state.awayTimeouts);

      if (event === 'narration') {
        setNarrationLog([...state.narrationLog]);
      }

      if (event === 'score') {
        setCurrentAction(`${data.scorer} - ${data.points} pts!`);
      }

      if (event === 'quarter_end') {
        setGameTime(0);
      }

      if (event === 'match_end') {
        const summary = data;
        setPlayerStats({
          home: summary.homeTeamStats.map(p => ({
            name: p.name, position: p.position, points: p.points,
          })),
          away: summary.awayTeamStats.map(p => ({
            name: p.name, position: p.position, points: p.points,
          })),
        });
        setFinalResult({
          homeTeam: summary.homeTeam,
          awayTeam: summary.awayTeam,
          score: summary.score,
          winner: summary.winner,
        });
        setIsSimulating(false);
        setIsComplete(true);
      }
    });

    await gc.runFullMatch();
  };

  const handleContinue = () => {
    if (finalResult) {
      onMatchEnd(finalResult);
    }
  };

  const texts = {
    pt: {
      quarter: 'Per\u00edodo',
      round: 'Rodada',
      simulate: '\u25b6\ufe0f Simular Partida',
      simulating: '\u231b Simulando...',
      narration: '\ud83d\udcdc Narra\u00e7\u00e3o',
      homeStats: `\ud83d\udcca ${homeTeam.name}`,
      awayStats: `\ud83d\udcca ${awayTeam.name}`,
      player: 'Jogador',
      pos: 'Pos',
      pts: 'Pts',
      continue: '\u27a1\ufe0f Ver Resultado Final',
      matchComplete: '\ud83c\udfc6 Partida Finalizada!',
      showCourt: 'Mostrar Quadra',
      hideCourt: 'Ocultar Quadra',
      fouls: 'Faltas',
      bonus: 'B\u00d4NUS',
      timeouts: 'Tempos',
    },
    en: {
      quarter: 'Quarter',
      round: 'Round',
      simulate: '\u25b6\ufe0f Simulate Match',
      simulating: '\u231b Simulating...',
      narration: '\ud83d\udcdc Play-by-Play',
      homeStats: `\ud83d\udcca ${homeTeam.name}`,
      awayStats: `\ud83d\udcca ${awayTeam.name}`,
      player: 'Player',
      pos: 'Pos',
      pts: 'Pts',
      continue: '\u27a1\ufe0f See Final Result',
      matchComplete: '\ud83c\udfc6 Match Complete!',
      showCourt: 'Show Court',
      hideCourt: 'Hide Court',
      fouls: 'Fouls',
      bonus: 'BONUS',
      timeouts: 'TOs',
    },
  };

  const t = texts[language] || texts.pt;

  return (
    <div className="match-view">
      <div className="scoreboard">
        <div className="game-clock">
          <span className="clock-time">{formatTime(gameTime)}</span>
          <span className="clock-quarter">Q{quarter}</span>
        </div>
        <div className="scoreboard-teams">
          <div className="scoreboard-team home">
            <div className="name">{homeTeam.name}</div>
            <div className="score">{homeScore}</div>
            <div className="team-info">
              <span className={`fouls ${homeQuarterFouls >= 4 ? 'bonus' : ''}`}>
                {t.fouls}: {homeQuarterFouls} {homeQuarterFouls >= 4 && <span className="bonus-tag">{t.bonus}</span>}
              </span>
              <span className="timeouts">{t.timeouts}: {homeTimeouts}</span>
            </div>
          </div>
          <div className="scoreboard-vs">VS</div>
          <div className="scoreboard-team away">
            <div className="name">{awayTeam.name}</div>
            <div className="score">{awayScore}</div>
            <div className="team-info">
              <span className={`fouls ${awayQuarterFouls >= 4 ? 'bonus' : ''}`}>
                {t.fouls}: {awayQuarterFouls} {awayQuarterFouls >= 4 && <span className="bonus-tag">{t.bonus}</span>}
              </span>
              <span className="timeouts">{t.timeouts}: {awayTimeouts}</span>
            </div>
          </div>
        </div>
        <div className="possession-indicator">
          {possession === 'home' ? '\ud83c\udfc0 \u2190' : '\u2192 \ud83c\udfc0'}
        </div>
      </div>
      <div className="court-toggle">
        <button className={showCourt ? 'active' : ''} onClick={() => setShowCourt(!showCourt)}>
          {'\ud83c\udfc0'} {showCourt ? t.hideCourt : t.showCourt}
        </button>
      </div>
      {showCourt && (
        <BasketballCourt homeTeam={homeTeam} awayTeam={awayTeam} possession={possession} action={currentAction} language={language} />
      )}
      <div className="match-controls">
        {!isComplete ? (
          <button className="simulate-btn" onClick={simulateMatch} disabled={isSimulating}>
            {isSimulating ? t.simulating : t.simulate}
          </button>
        ) : (
          <div className="match-complete-controls">
            <p className="match-complete-text">{t.matchComplete}</p>
            <button className="continue-btn" onClick={handleContinue}>{t.continue}</button>
          </div>
        )}
      </div>
      <div className="narration-feed" ref={narrationFeedRef}>
        <h3>{t.narration}</h3>
        {narrationLog.length === 0 && (
          <p style={{ color: '#666', textAlign: 'center' }}>
            {language === 'pt' ? 'Clique em Simular para come\u00e7ar...' : 'Click Simulate to start...'}
          </p>
        )}
        {narrationLog.map((item, i) => (
          <div key={i} className={`narration-item ${item.type}`}>{item.text}</div>
        ))}
      </div>
      {isComplete && (
        <div className="stats-section">
          <div className="team-stats">
            <h4>{t.homeStats}</h4>
            <table className="stats-table">
              <thead><tr><th>{t.player}</th><th>{t.pos}</th><th>{t.pts}</th></tr></thead>
              <tbody>
                {playerStats.home.map((p, i) => (
                  <tr key={i}><td className="player-name">{p.name}</td><td>{p.position}</td><td className="points">{p.points}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="team-stats">
            <h4>{t.awayStats}</h4>
            <table className="stats-table">
              <thead><tr><th>{t.player}</th><th>{t.pos}</th><th>{t.pts}</th></tr></thead>
              <tbody>
                {playerStats.away.map((p, i) => (
                  <tr key={i}><td className="player-name">{p.name}</td><td>{p.position}</td><td className="points">{p.points}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchView;
