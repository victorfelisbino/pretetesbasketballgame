import React, { useState } from 'react';
import TeamSetup from './ui/TeamSetup.jsx';
import MatchView from './ui/MatchView.jsx';
import AuthScreen from './ui/AuthScreen.jsx';
import LeagueHub from './ui/LeagueHub.jsx';
import LeagueView from './ui/LeagueView.jsx';
import PlayerStatsView from './ui/PlayerStatsView.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { recordLocalMatchResult, getLocalLeague } from './league/localLeague.js';

function GameApp() {
  // Game states: 'menu', 'setup', 'playing', 'finished', 'league-hub', 'league-view', 'stats'
  const [gameState, setGameState] = useState('menu');
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [language, setLanguage] = useState('pt');
  const [guestMode, setGuestMode] = useState(false);
  const [userTeam, setUserTeam] = useState(null);
  const [currentLeagueId, setCurrentLeagueId] = useState(null);
  const [currentMatchInfo, setCurrentMatchInfo] = useState(null);

  const { user, userData, loading, logOut, isAuthenticated } = useAuth();

  const t = translations[language];

  const handleStartMatch = (home, away) => {
    setHomeTeam(home);
    setAwayTeam(away);
    setGameState('playing');
  };

  const handleMatchEnd = (result) => {
    setMatchResult(result);
    
    // If playing a league match, record the result
    if (currentMatchInfo) {
      const [homeScore, awayScore] = result.score.split(' - ').map(Number);
      recordLocalMatchResult(currentMatchInfo.leagueId, currentMatchInfo.matchId, homeScore, awayScore);
    }
    
    setGameState('finished');
  };

  const handlePlayAgain = () => {
    setHomeTeam(null);
    setAwayTeam(null);
    setMatchResult(null);
    
    // Return to league view if coming from league match
    if (currentMatchInfo) {
      setCurrentMatchInfo(null);
      setGameState('league-view');
    } else {
      setGameState('menu');
    }
  };

  const handleLogout = async () => {
    if (isAuthenticated) {
      await logOut();
    }
    setGuestMode(false);
    setGameState('menu');
    setUserTeam(null);
  };

  const enterGuestMode = () => {
    setGuestMode(true);
  };

  const handleTeamCreated = (team) => {
    setUserTeam(team);
  };

  const handleSelectLeague = (leagueId) => {
    setCurrentLeagueId(leagueId);
    setGameState('league-view');
  };

  const handlePlayLeagueMatch = (matchInfo) => {
    setCurrentMatchInfo(matchInfo);
    setHomeTeam(matchInfo.homeTeam);
    setAwayTeam(matchInfo.awayTeam);
    setGameState('playing');
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screen if not logged in and not in guest mode
  if (!isAuthenticated && !guestMode) {
    return (
      <div className="app">
        <AuthScreen language={language} />
        <div style={{ textAlign: 'center', marginTop: '-20px', paddingBottom: '20px' }}>
          <button className="guest-mode-btn" onClick={enterGuestMode} style={{ maxWidth: '420px', margin: '0 auto' }}>
            {language === 'pt' ? '🎮 Jogar como Convidado' : '🎮 Play as Guest'}
          </button>
          <div className="language-toggle" style={{ justifyContent: 'center', marginTop: '15px' }}>
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
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏀 Pretetê's Basketball</h1>
        <div className="user-info">
          {isAuthenticated && userData && (
            <span className="user-name">
              {language === 'pt' ? 'Técnico: ' : 'Coach: '}
              <strong>{userData.displayName || user.displayName || 'Coach'}</strong>
            </span>
          )}
          {guestMode && (
            <span className="user-name">
              {language === 'pt' ? '🎮 Modo Convidado' : '🎮 Guest Mode'}
            </span>
          )}
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
          {(isAuthenticated || guestMode) && (
            <button className="logout-btn" onClick={handleLogout}>
              {language === 'pt' ? 'Sair' : 'Logout'}
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {/* Main Menu */}
        {gameState === 'menu' && (
          <div className="main-menu">
            <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#ff6b35' }}>
              {t.welcomeTitle}
            </h2>
            <button className="menu-btn primary" onClick={() => setGameState('setup')}>
              🏀 {t.quickMatch}
            </button>
            <button className="menu-btn secondary" onClick={() => setGameState('league-hub')}>
              🏆 {t.leagueMode}
            </button>
            <button className="menu-btn secondary" onClick={() => setGameState('stats')}>
              📊 {t.playerStats}
            </button>
          </div>
        )}

        {/* Player Stats View */}
        {gameState === 'stats' && (
          <PlayerStatsView 
            language={language}
            onBack={() => setGameState('menu')}
          />
        )}

        {/* Team Setup for Quick Match */}
        {gameState === 'setup' && (
          <TeamSetup 
            onStartMatch={handleStartMatch} 
            onTeamCreated={handleTeamCreated}
            language={language} 
          />
        )}

        {/* League Hub */}
        {gameState === 'league-hub' && (
          <LeagueHub 
            language={language}
            userTeam={userTeam}
            onSelectLeague={handleSelectLeague}
            onBack={() => setGameState('menu')}
          />
        )}

        {/* League View */}
        {gameState === 'league-view' && currentLeagueId && (
          <LeagueView
            leagueId={currentLeagueId}
            language={language}
            onPlayMatch={handlePlayLeagueMatch}
            onBack={() => setGameState('league-hub')}
          />
        )}

        {/* Match Playing */}
        {gameState === 'playing' && (
          <MatchView 
            homeTeam={homeTeam} 
            awayTeam={awayTeam} 
            language={language}
            onMatchEnd={handleMatchEnd}
          />
        )}

        {/* Match Finished */}
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
              {currentMatchInfo 
                ? (language === 'pt' ? '📊 Ver Classificação' : '📊 View Standings')
                : (language === 'pt' ? '🔄 Jogar Novamente' : '🔄 Play Again')
              }
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

const translations = {
  pt: {
    welcomeTitle: 'Escolha o Modo de Jogo',
    quickMatch: 'Partida Rápida',
    leagueMode: 'Modo Liga',
    playerStats: 'Estatísticas'
  },
  en: {
    welcomeTitle: 'Choose Game Mode',
    quickMatch: 'Quick Match',
    leagueMode: 'League Mode',
    playerStats: 'Statistics'
  }
};

function App() {
  return (
    <AuthProvider>
      <GameApp />
    </AuthProvider>
  );

}

export default App;
