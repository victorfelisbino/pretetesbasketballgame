import React, { useState } from 'react';
import TeamSetup from './ui/TeamSetup.jsx';
import MatchView from './ui/MatchView.jsx';

function App() {
  const [gameState, setGameState] = useState('setup'); // 'setup', 'playing', 'finished'
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [language, setLanguage] = useState('pt');

  const handleStartMatch = (home, away) => {
    setHomeTeam(home);
    setAwayTeam(away);
    setGameState('playing');
  };

  const handleMatchEnd = (result) => {
    setMatchResult(result);
    setGameState('finished');
  };

  const handlePlayAgain = () => {
    setHomeTeam(null);
    setAwayTeam(null);
    setMatchResult(null);
    setGameState('setup');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏀 Pretetê's Basketball</h1>
        <div className="language-toggle">
          <button 
            className={language === 'pt' ? 'active' : ''} 
            onClick={() => setLanguage('pt')}
          >
            🇧🇷 PT
          </button>
          <button 
            className={language === 'en' ? 'active' : ''} 
            onClick={() => setLanguage('en')}
          >
            🇺🇸 EN
          </button>
        </div>
      </header>

      <main className="app-main">
        {gameState === 'setup' && (
          <TeamSetup onStartMatch={handleStartMatch} language={language} />
        )}

        {gameState === 'playing' && (
          <MatchView 
            homeTeam={homeTeam} 
            awayTeam={awayTeam} 
            language={language}
            onMatchEnd={handleMatchEnd}
          />
        )}

        {gameState === 'finished' && matchResult && (
          <div className="match-result">
            <h2>
              {language === 'pt' ? '🏆 Fim de Jogo!' : '🏆 Game Over!'}
            </h2>
            <div className="final-score">
              <span className="team-name">{matchResult.homeTeam}</span>
              <span className="score">{matchResult.score}</span>
              <span className="team-name">{matchResult.awayTeam}</span>
            </div>
            <p className="winner">
              {language === 'pt' ? 'Vencedor: ' : 'Winner: '}
              <strong>{matchResult.winner}</strong>
            </p>
            <button className="play-again-btn" onClick={handlePlayAgain}>
              {language === 'pt' ? '🔄 Jogar Novamente' : '🔄 Play Again'}
            </button>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Pretetê's Basketball © 2026 | The Elifoot of Basketball</p>
      </footer>
    </div>
  );
}

export default App;
