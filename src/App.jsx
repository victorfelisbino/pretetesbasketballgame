import React, { useState } from 'react';
import TeamSetup from './ui/TeamSetup.jsx';
import MatchView from './ui/MatchView.jsx';
import AuthScreen from './ui/AuthScreen.jsx';
import LeagueHub from './ui/LeagueHub.jsx';
import LeagueView from './ui/LeagueView.jsx';
import PlayerStatsView from './ui/PlayerStatsView.jsx';
import TacticsPicker from './ui/TacticsPicker.jsx';
import DraftRoom from './ui/DraftRoom.jsx';
import FantasyDashboard from './ui/FantasyDashboard.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { getLocalLeague } from './league/localLeague.js';
import { persistMatchResult } from './services/matchPersistence.js';
import { updateUserStats } from './firebase/database.js';
import { calculatePlayerFantasyPoints, DEFAULT_SCORING_CONFIG } from './core/fantasyScoring.js';
import { engineToFantasy } from './core/statBridge.js';
import { processMatchXP } from './services/progressionService.js';

const translations = {
  pt: {
    welcomeTitle: 'Escolha o Modo de Jogo',
    quickMatch: 'Partida Rápida',
    leagueMode: 'Modo Liga',
    playerStats: 'Estatísticas',
    fantasyPts: 'Pontos Fantasy',
    viewFantasy: 'Ver Fantasy',
    xpGained: 'XP Ganho',
  },
  en: {
    welcomeTitle: 'Choose Game Mode',
    quickMatch: 'Quick Match',
    leagueMode: 'League Mode',
    playerStats: 'Statistics',
    fantasyPts: 'Fantasy Points',
    viewFantasy: 'View Fantasy',
    xpGained: 'XP Gained',
  }
};

function GameApp() {
  // Game states: 'menu', 'setup', 'tactics', 'playing', 'finished',
  //              'league-hub', 'league-view', 'league-draft', 'fantasy-dashboard', 'stats'
  const [gameState, setGameState] = useState('menu');
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [language, setLanguage] = useState('pt');
  // Default to showing auth screen; guests can opt-in via button
  const [guestMode, setGuestMode] = useState(false);
  const [userTeam, setUserTeam] = useState(null);
  const [currentLeagueId, setCurrentLeagueId] = useState(null);
  const [currentLeagueBackend, setCurrentLeagueBackend] = useState(null);
  const [currentMatchInfo, setCurrentMatchInfo] = useState(null);
  // Phase 2: Tactics + Fantasy
  const [currentTactics, setCurrentTactics] = useState(null);
  const [matchFantasyScores, setMatchFantasyScores] = useState(null);
  const [draftConfig, setDraftConfig] = useState(null);

  const { user, userData, loading, logOut, isAuthenticated } = useAuth();

  const t = translations[language];

  // Quick match flow: setup → tactics → playing → finished
  const handleStartMatch = (home, away) => {
    setHomeTeam(home);
    setAwayTeam(away);
    setGameState('tactics');
  };

  const handleTacticsConfirm = (tactics) => {
    setCurrentTactics(tactics);
    setGameState('playing');
  };

  const handleTacticsSkip = () => {
    setCurrentTactics(null);
    setGameState('playing');
  };

  const handleMatchEnd = async (result) => {
    setMatchResult(result);

    // Calculate fantasy scores for all players
    const fantasyScores = computeFantasyScores(result);
    setMatchFantasyScores(fantasyScores);

    // Calculate XP gains for all players
    const xpResults = processMatchXP(result);
    // XP results are available in fantasyScores for display
    if (fantasyScores) {
      // Attach XP data to fantasy scores for the finished screen
      const attachXP = (fantasyTeam, xpTeam) => {
        for (const fp of fantasyTeam) {
          const xr = xpTeam.find(x => x.name === fp.name);
          if (xr) {
            fp.xpGained = xr.xpGained;
            fp.levelInfo = xr.levelInfo;
          }
        }
      };
      attachXP(fantasyScores.home, xpResults.home);
      attachXP(fantasyScores.away, xpResults.away);
    }

    // Determine user's team name for win/loss detection
    let userTeamName = null;
    if (currentMatchInfo && currentMatchInfo.leagueId) {
      const league = getLocalLeague(currentMatchInfo.leagueId);
      const ut = league?.teams?.find(t => t.isUserTeam);
      if (ut) userTeamName = ut.name;
    }

    // Persist match result to localStorage + Firestore (when authenticated)
    await persistMatchResult({
      result,
      matchInfo: currentMatchInfo,
      isAuthenticated,
      user,
      userTeamName,
      updateUserStatsFn: updateUserStats,
    });

    setGameState('finished');
  };

  const handlePlayAgain = () => {
    setHomeTeam(null);
    setAwayTeam(null);
    setMatchResult(null);
    setCurrentTactics(null);
    setMatchFantasyScores(null);

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

  const handleSelectLeague = (leagueId, backend) => {
    setCurrentLeagueId(leagueId);
    setCurrentLeagueBackend(backend || 'local');
    setGameState('league-view');
  };

  const handlePlayLeagueMatch = (matchInfo) => {
    setCurrentMatchInfo(matchInfo);
    setHomeTeam(matchInfo.homeTeam);
    setAwayTeam(matchInfo.awayTeam);
    setGameState('tactics');
  };

  const handleStartDraft = (config) => {
    setDraftConfig(config);
    setGameState('league-draft');
  };

  const handleDraftComplete = (draftResult) => {
    setDraftConfig(null);
    // Return to league view after draft
    setGameState('league-view');
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
        <h1>🏀 Quadra Legacy</h1>
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
            onBack={() => setGameState('menu')}
            language={language}
          />
        )}

        {/* Tactics Picker (pre-match) */}
        {gameState === 'tactics' && (
          <TacticsPicker
            language={language}
            onConfirm={handleTacticsConfirm}
            onBack={handleTacticsSkip}
          />
        )}

        {/* League Hub */}
        {gameState === 'league-hub' && (
          <LeagueHub
            language={language}
            userTeam={userTeam}
            isAuthenticated={isAuthenticated}
            user={user}
            onSelectLeague={handleSelectLeague}
            onBack={() => setGameState('menu')}
          />
        )}

        {/* League View */}
        {gameState === 'league-view' && currentLeagueId && (
          <LeagueView
            leagueId={currentLeagueId}
            backend={currentLeagueBackend}
            language={language}
            isAuthenticated={isAuthenticated}
            user={user}
            onPlayMatch={handlePlayLeagueMatch}
            onBack={() => setGameState('league-hub')}
          />
        )}

        {/* League Draft */}
        {gameState === 'league-draft' && draftConfig && (
          <DraftRoom
            language={language}
            draftConfig={draftConfig}
            onDraftComplete={handleDraftComplete}
            onBack={() => setGameState('league-view')}
          />
        )}

        {/* Fantasy Dashboard */}
        {gameState === 'fantasy-dashboard' && (
          <FantasyDashboard
            language={language}
            leagueId={currentLeagueId}
            lastMatchStats={matchResult}
            onBack={() => {
              if (currentMatchInfo) setGameState('league-view');
              else setGameState('menu');
            }}
          />
        )}

        {/* Match Playing — pass tactics to MatchView */}
        {gameState === 'playing' && (
          <MatchView
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            language={language}
            homeTactics={currentTactics}
            onMatchEnd={handleMatchEnd}
          />
        )}

        {/* Match Finished — with Fantasy Score Summary */}
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

            {/* Fantasy Score Summary */}
            {matchFantasyScores && (
              <div style={{ margin: '15px auto', maxWidth: '500px' }}>
                <h3 style={{ color: '#ff6b35', textAlign: 'center', marginBottom: '10px' }}>
                  ⭐ {t.fantasyPts}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Home team top scorer */}
                  <div style={{ background: 'rgba(255,107,53,0.1)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: '4px' }}>{matchResult.homeTeam}</div>
                    {matchFantasyScores.home.slice(0, 3).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', padding: '2px 0' }}>
                        <span>{p.name}</span>
                        <span>
                          <span style={{ color: '#ff6b35', fontWeight: 'bold' }}>{p.fantasyPoints.toFixed(1)}</span>
                          {p.xpGained > 0 && <span style={{ color: '#4CAF50', fontSize: '0.8em', marginLeft: '4px' }}>+{p.xpGained}xp</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Away team top scorer */}
                  <div style={{ background: 'rgba(255,107,53,0.1)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: '4px' }}>{matchResult.awayTeam}</div>
                    {matchFantasyScores.away.slice(0, 3).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', padding: '2px 0' }}>
                        <span>{p.name}</span>
                        <span>
                          <span style={{ color: '#ff6b35', fontWeight: 'bold' }}>{p.fantasyPoints.toFixed(1)}</span>
                          {p.xpGained > 0 && <span style={{ color: '#4CAF50', fontSize: '0.8em', marginLeft: '4px' }}>+{p.xpGained}xp</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="play-again-btn" onClick={handlePlayAgain}>
                {currentMatchInfo
                  ? (language === 'pt' ? '📊 Ver Classificação' : '📊 View Standings')
                  : (language === 'pt' ? '🔄 Jogar Novamente' : '🔄 Play Again')
                }
              </button>
              <button
                className="play-again-btn"
                onClick={() => setGameState('fantasy-dashboard')}
                style={{ background: 'linear-gradient(135deg, #ff6b35, #ff8f60)' }}
              >
                ⭐ {t.viewFantasy}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Quadra Legacy © 2026 | The Elifoot of Basketball</p>
      </footer>
    </div>
  );
}

/**
 * Compute fantasy points for all players from a match result.
 * Returns { home: [{ name, fantasyPoints }], away: [{ name, fantasyPoints }] }
 */
function computeFantasyScores(result) {
  if (!result) return null;

  const computeTeam = (playerStats) => {
    if (!playerStats || !Array.isArray(playerStats)) return [];
    return playerStats.map(p => {
      // Convert engine stat shape to fantasy scoring shape
      const fantasyStats = engineToFantasy({
        pointsScored: p.points || 0,
        assists: p.assists || 0,
        rebounds: p.rebounds || 0,
        steals: p.steals || 0,
        blocks: p.blocks || 0,
      });
      const result = calculatePlayerFantasyPoints(fantasyStats, DEFAULT_SCORING_CONFIG);
      return {
        name: p.name,
        position: p.position,
        fantasyPoints: result.total,
        breakdown: result.breakdown,
        stats: p,
      };
    }).sort((a, b) => b.fantasyPoints - a.fantasyPoints);
  };

  return {
    home: computeTeam(result.homeTeamStats),
    away: computeTeam(result.awayTeamStats),
  };
}

function App() {
  return (
    <AuthProvider>
      <GameApp />
    </AuthProvider>
  );

}

export default App;
