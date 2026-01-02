import React, { useState, useEffect, useRef } from 'react';
import BasketballCourt from './BasketballCourt.jsx';

// Import game engine modules (we'll bundle these for React)
// For now, we'll recreate the core logic inline

// Dice Roller
const DiceRoller = {
  rollDie(sides = 6) {
    return Math.floor(Math.random() * sides) + 1;
  },
  rollMultiple(quantity, sides) {
    const rolls = [];
    let total = 0;
    for (let i = 0; i < quantity; i++) {
      const roll = this.rollDie(sides);
      rolls.push(roll);
      total += roll;
    }
    return { rolls, total, notation: `${quantity}d${sides}` };
  },
};

// Narration templates
const templates = {
  pt: {
    matchStart: [
      "🏀 COMEÇA O JOGO! {homeTeam} contra {awayTeam}!",
      "🏀 BOLA AO AR! {homeTeam} enfrenta {awayTeam}!",
    ],
    matchEnd: [
      "🏆 FIM DE JOGO! {winnerTeam} vence por {winnerScore} a {loserScore}!",
    ],
    score2pt: [
      "🏀 CESTA! {player} anota 2 pontos!",
      "🏀 {player} converte! 2 pontos no placar!",
    ],
    score2ptFastBreak: [
      "⚡ CONTRA-ATAQUE! {player} não perdoa! 2 pontos!",
    ],
    score3pt: [
      "🎯 TRÊS PONTOS! {player} de longe! VALEU!",
      "🎯 TRIPLAÇO de {player}!",
    ],
    score3ptFastBreak: [
      "⚡🎯 FAST BREAK! {player} manda de três!",
    ],
    miss2pt: ["❌ {player} erra a bandeja!"],
    miss3pt: ["❌ {player} erra de três!"],
    steal: ["🔥 ROUBADA! {defender} toma de {attacker}!"],
    fastBreakStart: ["⚡ CONTRA-ATAQUE! {team} sai em velocidade!"],
    quarterEnd: ["📋 Fim do {quarter}º período! {homeTeam} {homeScore} x {awayScore} {awayTeam}"],
    closeGame: ["🔥 JOGO APERTADO! Apenas {diff} ponto(s)!"],
    blowout: ["😮 {team} abre {diff} pontos!"],
  },
  en: {
    matchStart: [
      "🏀 TIP OFF! {homeTeam} vs {awayTeam}!",
    ],
    matchEnd: [
      "🏆 FINAL! {winnerTeam} wins {winnerScore} to {loserScore}!",
    ],
    score2pt: [
      "🏀 BUCKET! {player} scores 2!",
    ],
    score2ptFastBreak: [
      "⚡ FAST BREAK! {player} finishes! 2 points!",
    ],
    score3pt: [
      "🎯 THREE POINTER! {player} from downtown!",
    ],
    score3ptFastBreak: [
      "⚡🎯 TRANSITION THREE! {player} drains it!",
    ],
    miss2pt: ["❌ {player} misses the layup!"],
    miss3pt: ["❌ {player} misses the three!"],
    steal: ["🔥 STEAL! {defender} takes it from {attacker}!"],
    fastBreakStart: ["⚡ FAST BREAK! {team} pushes the pace!"],
    quarterEnd: ["📋 End of Q{quarter}! {homeTeam} {homeScore} - {awayScore} {awayTeam}"],
    closeGame: ["🔥 CLOSE GAME! Only {diff} point(s)!"],
    blowout: ["😮 {team} up by {diff}!"],
  },
};

// Simple Narrator
class Narrator {
  constructor(lang = 'pt') {
    this.lang = lang;
  }
  
  setLanguage(lang) {
    this.lang = lang;
  }

  narrate(eventType, data = {}) {
    const langTemplates = templates[this.lang] || templates.pt;
    if (!langTemplates[eventType]) return `[${eventType}]`;
    const options = langTemplates[eventType];
    let text = options[Math.floor(Math.random() * options.length)];
    for (const [key, value] of Object.entries(data)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return text;
  }
}

function MatchView({ homeTeam, awayTeam, language, onMatchEnd }) {
  const [round, setRound] = useState(0);
  const [quarter, setQuarter] = useState(1);
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
  
  const narratorRef = useRef(new Narrator(language));
  const narrationFeedRef = useRef(null);

  useEffect(() => {
    narratorRef.current.setLanguage(language);
  }, [language]);

  // Auto-scroll narration feed
  useEffect(() => {
    if (narrationFeedRef.current) {
      narrationFeedRef.current.scrollTop = narrationFeedRef.current.scrollHeight;
    }
  }, [narrationLog]);

  const addNarration = (eventType, data = {}) => {
    const text = narratorRef.current.narrate(eventType, data);
    const type = eventType.includes('score') ? 'score' 
               : eventType.includes('miss') ? 'miss'
               : eventType.includes('steal') ? 'steal'
               : eventType.includes('FastBreak') ? 'fastbreak'
               : 'default';
    setNarrationLog(prev => [...prev, { text, type, quarter, round }]);
    return text;
  };

  const simulateRound = (home, away, possession) => {
    const isHome = possession === 'home';
    const offenseTeam = isHome ? home : away;
    const defenseTeam = isHome ? away : home;
    
    // Get ball carrier (weighted by position)
    const weights = { 'PG': 40, 'SG': 25, 'SF': 15, 'PF': 12, 'C': 8 };
    const activePlayers = offenseTeam.players.filter(p => p.isActive).slice(0, 5);
    let totalWeight = activePlayers.reduce((sum, p) => sum + (weights[p.position] || 10), 0);
    let roll = Math.random() * totalWeight;
    let ballCarrier = activePlayers[0];
    for (const p of activePlayers) {
      roll -= weights[p.position] || 10;
      if (roll <= 0) {
        ballCarrier = p;
        break;
      }
    }

    // Steal attempt (25% chance)
    let stolen = false;
    let fastBreakPlayer = null;
    const defenders = defenseTeam.players.filter(p => p.isActive).slice(0, 5);
    const defender = defenders[Math.floor(Math.random() * defenders.length)];
    
    if (Math.random() < 0.25) {
      const dribbleSkill = ballCarrier.skillLevel * 2 + DiceRoller.rollDie(4);
      const stealSkill = defender.skillLevel * 2 + DiceRoller.rollDie(4);
      const rollD20 = DiceRoller.rollDie(20);
      const threshold = 20 - (dribbleSkill - stealSkill);
      
      if (rollD20 < threshold) {
        stolen = true;
        fastBreakPlayer = defender;
        addNarration('steal', { defender: defender.name, attacker: ballCarrier.name });
        addNarration('fastBreakStart', { team: defenseTeam.name, player: defender.name });
      }
    }

    // Shooting
    const shooter = stolen ? fastBreakPlayer : ballCarrier;
    const shooterTeam = stolen ? defenseTeam : offenseTeam;
    const shooterIsHome = stolen ? !isHome : isHome;
    
    // Determine shot type
    const threeChance = { 'PG': 0.4, 'SG': 0.4, 'SF': 0.2, 'PF': 0.05, 'C': 0 };
    const shotType = Math.random() < (threeChance[shooter.position] || 0) ? '3pt' : '2pt';
    
    // Calculate shot
    const positionMod = {
      '2pt': { 'PG': 0, 'SG': 1, 'SF': 1, 'PF': 2, 'C': 3 },
      '3pt': { 'PG': 2, 'SG': 3, 'SF': 2, 'PF': 0, 'C': -2 },
    };
    const skillBonus = shooter.skillLevel + (stolen ? 3 : 0);
    const posMod = positionMod[shotType][shooter.position] || 0;
    const rollShot = DiceRoller.rollDie(20);
    const totalRoll = rollShot + skillBonus + posMod;
    const difficulty = shotType === '2pt' ? 12 : 15;
    const made = totalRoll >= difficulty;
    
    if (made) {
      const points = shotType === '2pt' ? 2 : 3;
      shooter.stats.pointsScored += points;
      
      const eventType = stolen 
        ? (shotType === '2pt' ? 'score2ptFastBreak' : 'score3ptFastBreak')
        : (shotType === '2pt' ? 'score2pt' : 'score3pt');
      addNarration(eventType, { player: shooter.name, team: shooterTeam.name });
      setCurrentAction(`${shooter.name} - ${points} pts!`);
      
      return { scored: true, points, scoringTeam: shooterIsHome ? 'home' : 'away', newPossession: shooterIsHome ? 'away' : 'home' };
    } else {
      addNarration(shotType === '2pt' ? 'miss2pt' : 'miss3pt', { player: shooter.name });
      setCurrentAction(null);
      // Simplified rebound - 60% goes to defense
      const newPoss = Math.random() < 0.6 
        ? (shooterIsHome ? 'away' : 'home')
        : (shooterIsHome ? 'home' : 'away');
      return { scored: false, points: 0, scoringTeam: null, newPossession: newPoss };
    }
  };

  const simulateMatch = async () => {
    setIsSimulating(true);
    setNarrationLog([]);
    
    // Reset scores
    let hScore = 0;
    let aScore = 0;
    homeTeam.players.forEach(p => p.stats.pointsScored = 0);
    awayTeam.players.forEach(p => p.stats.pointsScored = 0);
    
    addNarration('matchStart', { homeTeam: homeTeam.name, awayTeam: awayTeam.name });
    
    let possession = 'home';
    
    for (let q = 1; q <= 4; q++) {
      setQuarter(q);
      
      for (let r = 0; r < 25; r++) {
        const currentRound = (q - 1) * 25 + r + 1;
        setRound(currentRound);
        
        const result = simulateRound(homeTeam, awayTeam, possession);
        
        if (result.scored) {
          if (result.scoringTeam === 'home') {
            hScore += result.points;
            setHomeScore(hScore);
          } else {
            aScore += result.points;
            setAwayScore(aScore);
          }
        }
        
        possession = result.newPossession;
        setPossession(possession);
        
        // Small delay for visual effect (batch updates)
        if (r % 5 === 4) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Quarter end narration
      addNarration('quarterEnd', {
        quarter: q,
        homeTeam: homeTeam.name,
        homeScore: hScore,
        awayTeam: awayTeam.name,
        awayScore: aScore,
      });
      
      const diff = Math.abs(hScore - aScore);
      if (diff <= 5) {
        addNarration('closeGame', { diff });
      } else if (diff >= 15) {
        const leadTeam = hScore > aScore ? homeTeam.name : awayTeam.name;
        addNarration('blowout', { team: leadTeam, diff });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Match end
    const winner = hScore > aScore ? homeTeam : (aScore > hScore ? awayTeam : null);
    if (winner) {
      const loser = winner === homeTeam ? awayTeam : homeTeam;
      addNarration('matchEnd', {
        winnerTeam: winner.name,
        loserTeam: loser.name,
        winnerScore: Math.max(hScore, aScore),
        loserScore: Math.min(hScore, aScore),
      });
    }
    
    // Update player stats display
    setPlayerStats({
      home: homeTeam.players.map(p => ({ name: p.name, position: p.position, points: p.stats.pointsScored })),
      away: awayTeam.players.map(p => ({ name: p.name, position: p.position, points: p.stats.pointsScored })),
    });
    
    // Store final result for "Continue" button
    setFinalResult({
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      score: `${hScore} - ${aScore}`,
      winner: winner ? winner.name : 'TIE',
    });
    
    setIsSimulating(false);
    setIsComplete(true);
    
    // User will click "Continue" button to proceed - no auto-transition
  };
  
  const handleContinue = () => {
    if (finalResult) {
      onMatchEnd(finalResult);
    }
  };

  const texts = {
    pt: {
      quarter: 'Período',
      round: 'Rodada',
      simulate: '▶️ Simular Partida',
      simulating: '⏳ Simulando...',
      narration: '📜 Narração',
      homeStats: `📊 ${homeTeam.name}`,
      awayStats: `📊 ${awayTeam.name}`,
      player: 'Jogador',
      pos: 'Pos',
      pts: 'Pts',
      continue: '➡️ Ver Resultado Final',
      matchComplete: '🏆 Partida Finalizada!',
      showCourt: 'Mostrar Quadra',
      hideCourt: 'Ocultar Quadra',
    },
    en: {
      quarter: 'Quarter',
      round: 'Round',
      simulate: '▶️ Simulate Match',
      simulating: '⏳ Simulating...',
      narration: '📜 Play-by-Play',
      homeStats: `📊 ${homeTeam.name}`,
      awayStats: `📊 ${awayTeam.name}`,
      player: 'Player',
      pos: 'Pos',
      pts: 'Pts',
      continue: '➡️ See Final Result',
      matchComplete: '🏆 Match Complete!',
      showCourt: 'Show Court',
      hideCourt: 'Hide Court',
    },
  };

  const t = texts[language] || texts.pt;

  return (
    <div className="match-view">
      {/* Scoreboard */}
      <div className="scoreboard">
        <div className="scoreboard-teams">
          <div className="scoreboard-team home">
            <div className="name">{homeTeam.name}</div>
            <div className="score">{homeScore}</div>
          </div>
          <div className="scoreboard-vs">VS</div>
          <div className="scoreboard-team away">
            <div className="name">{awayTeam.name}</div>
            <div className="score">{awayScore}</div>
          </div>
        </div>
        <div className="quarter-indicator">
          {t.quarter}: <span>Q{quarter}</span> | {t.round}: <span>{round}/100</span>
        </div>
      </div>

      {/* Court Toggle */}
      <div className="court-toggle">
        <button 
          className={showCourt ? 'active' : ''}
          onClick={() => setShowCourt(!showCourt)}
        >
          🏀 {showCourt ? t.hideCourt : t.showCourt}
        </button>
      </div>

      {/* Basketball Court Visualization */}
      {showCourt && (
        <BasketballCourt
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          possession={possession}
          action={currentAction}
          language={language}
        />
      )}

      {/* Controls */}
      <div className="match-controls">
        {!isComplete ? (
          <button 
            className="simulate-btn" 
            onClick={simulateMatch}
            disabled={isSimulating}
          >
            {isSimulating ? t.simulating : t.simulate}
          </button>
        ) : (
          <div className="match-complete-controls">
            <p className="match-complete-text">{t.matchComplete}</p>
            <button 
              className="continue-btn" 
              onClick={handleContinue}
            >
              {t.continue}
            </button>
          </div>
        )}
      </div>

      {/* Narration Feed */}
      <div className="narration-feed" ref={narrationFeedRef}>
        <h3>{t.narration}</h3>
        {narrationLog.length === 0 && (
          <p style={{ color: '#666', textAlign: 'center' }}>
            {language === 'pt' ? 'Clique em Simular para começar...' : 'Click Simulate to start...'}
          </p>
        )}
        {narrationLog.map((item, i) => (
          <div key={i} className={`narration-item ${item.type}`}>
            {item.text}
          </div>
        ))}
      </div>

      {/* Player Stats */}
      {isComplete && (
        <div className="stats-section">
          <div className="team-stats">
            <h4>{t.homeStats}</h4>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>{t.player}</th>
                  <th>{t.pos}</th>
                  <th>{t.pts}</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.home.map((p, i) => (
                  <tr key={i}>
                    <td className="player-name">{p.name}</td>
                    <td>{p.position}</td>
                    <td className="points">{p.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="team-stats">
            <h4>{t.awayStats}</h4>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>{t.player}</th>
                  <th>{t.pos}</th>
                  <th>{t.pts}</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.away.map((p, i) => (
                  <tr key={i}>
                    <td className="player-name">{p.name}</td>
                    <td>{p.position}</td>
                    <td className="points">{p.points}</td>
                  </tr>
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
