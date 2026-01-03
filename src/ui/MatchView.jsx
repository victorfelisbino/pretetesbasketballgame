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
    // New play types
    pickAndRoll: ["🔄 Pick and roll! {player} usa o bloqueio e anota!"],
    alleyOop: ["🔥 ALLEY-OOP! {passer} para {player}! Espetacular!"],
    postUp: ["💪 {player} no garrafão! Gira e converte!"],
    fadeaway: ["🎨 FADEAWAY! {player} com o arremesso de costas! Sensacional!"],
    dunk: ["💥 ENTERRADA! {player} vai com força!"],
    layup: ["🏀 {player} bandeja limpa!"],
    // Fouls and free throws
    foul: ["⚠️ FALTA! {defender} em {player}!"],
    foulBonus: ["⚠️ FALTA! {defender} em {player}! Equipe no bônus!"],
    freeThrowMake: ["✅ {player} converte o lance livre!"],
    freeThrowMiss: ["❌ {player} erra o lance livre!"],
    andOne: ["🔥 E A FALTA! {player} pode converter o and-one!"],
    technicalFoul: ["🟨 FALTA TÉCNICA! {player}!"],
    timeout: ["⏸️ TEMPO! {team} pede tempo!"],
    // Blocks and rebounds
    block: ["🚫 TOCO! {defender} bloqueia {player}!", "🚫 BLOQUEIO! {defender} rejeita {player}!"],
    reboundDefense: ["📥 REBOTE! {player} pega!", "📥 {player} domina o rebote defensivo!"],
    reboundOffense: ["📤 REBOTE OFENSIVO! {player} mantém a posse!", "📤 Segunda chance! {player} pega o rebote!"],
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
    // New play types
    pickAndRoll: ["🔄 Pick and roll! {player} uses the screen and scores!"],
    alleyOop: ["🔥 ALLEY-OOP! {passer} to {player}! Spectacular!"],
    postUp: ["💪 {player} in the post! Spins and scores!"],
    fadeaway: ["🎨 FADEAWAY! {player} with the turnaround jumper! Beautiful!"],
    dunk: ["💥 SLAM DUNK! {player} throws it down!"],
    layup: ["🏀 {player} with the easy layup!"],
    // Fouls and free throws
    foul: ["⚠️ FOUL! {defender} on {player}!"],
    foulBonus: ["⚠️ FOUL! {defender} on {player}! Team in the bonus!"],
    freeThrowMake: ["✅ {player} makes the free throw!"],
    freeThrowMiss: ["❌ {player} misses the free throw!"],
    andOne: ["🔥 AND ONE! {player} with a chance for the three-point play!"],
    technicalFoul: ["🟨 TECHNICAL FOUL! {player}!"],
    timeout: ["⏸️ TIMEOUT! {team} calls timeout!"],
    // Blocks and rebounds
    block: ["🚫 BLOCKED! {defender} swats {player}'s shot!", "🚫 REJECTION! {defender} denies {player}!"],
    reboundDefense: ["📥 REBOUND! {player} grabs it!", "📥 {player} secures the defensive board!"],
    reboundOffense: ["📤 OFFENSIVE REBOUND! {player} keeps it alive!", "📤 Second chance! {player} gets the board!"],
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
  const [gameTime, setGameTime] = useState(720); // 12:00 in seconds (12 min per quarter)
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
  // Foul tracking
  const [homeFouls, setHomeFouls] = useState(0);
  const [awayFouls, setAwayFouls] = useState(0);
  const [homeQuarterFouls, setHomeQuarterFouls] = useState(0);
  const [awayQuarterFouls, setAwayQuarterFouls] = useState(0);
  // Timeouts (each team gets 7 per game in NBA)
  const [homeTimeouts, setHomeTimeouts] = useState(7);
  const [awayTimeouts, setAwayTimeouts] = useState(7);
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
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

  const simulateRound = (home, away, possession, quarterFouls) => {
    const isHome = possession === 'home';
    const offenseTeam = isHome ? home : away;
    const defenseTeam = isHome ? away : home;
    const defenseQuarterFouls = isHome ? quarterFouls.away : quarterFouls.home;
    const inBonus = defenseQuarterFouls >= 4; // NBA bonus after 4 team fouls per quarter
    
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

    // Steal attempt (20% chance)
    let stolen = false;
    let fastBreakPlayer = null;
    const defenders = defenseTeam.players.filter(p => p.isActive).slice(0, 5);
    const defender = defenders[Math.floor(Math.random() * defenders.length)];
    
    if (Math.random() < 0.20) {
      const dribbleSkill = ballCarrier.skillLevel * 2 + DiceRoller.rollDie(4);
      const stealSkill = defender.skillLevel * 2 + DiceRoller.rollDie(4);
      const rollD20 = DiceRoller.rollDie(20);
      const threshold = 20 - (dribbleSkill - stealSkill);
      
      if (rollD20 < threshold) {
        stolen = true;
        fastBreakPlayer = defender;
        if (defender.stats) defender.stats.steals = (defender.stats.steals || 0) + 1;
        addNarration('steal', { defender: defender.name, attacker: ballCarrier.name });
        addNarration('fastBreakStart', { team: defenseTeam.name, player: defender.name });
      }
    }

    let shooter = stolen ? fastBreakPlayer : ballCarrier;
    const shooterTeam = stolen ? defenseTeam : offenseTeam;
    const shooterIsHome = stolen ? !isHome : isHome;
    const shooterDefender = defenders[Math.floor(Math.random() * defenders.length)];
    
    // Determine play type for more variety
    const playTypeRoll = Math.random();
    let playType = 'normal';
    let passer = null;
    
    if (!stolen) {
      if (shooter.position === 'C' || shooter.position === 'PF') {
        if (playTypeRoll < 0.25) playType = 'postUp';
        else if (playTypeRoll < 0.35) playType = 'pickAndRoll';
      } else if (shooter.position === 'PG' || shooter.position === 'SG') {
        if (playTypeRoll < 0.15) playType = 'pickAndRoll';
        else if (playTypeRoll < 0.20) {
          playType = 'alleyOop';
          // Find a big man for the alley-oop
          const bigMen = activePlayers.filter(p => p.position === 'C' || p.position === 'PF');
          if (bigMen.length > 0) {
            passer = shooter;
            shooter = bigMen[Math.floor(Math.random() * bigMen.length)];
          }
        }
      }
      if (shooter.skillLevel >= 4 && playTypeRoll > 0.85) {
        playType = 'fadeaway';
      }
    }
    
    // Check for foul (15% chance on shot attempts)
    const foulChance = stolen ? 0.08 : 0.15;
    const isFouled = Math.random() < foulChance;
    
    // Determine shot type
    const threeChance = { 'PG': 0.35, 'SG': 0.40, 'SF': 0.25, 'PF': 0.08, 'C': 0.02 };
    let shotType = Math.random() < (threeChance[shooter.position] || 0) ? '3pt' : '2pt';
    
    // Alley-oops and post-ups are always 2pt
    if (playType === 'alleyOop' || playType === 'postUp') shotType = '2pt';
    
    // Calculate shot
    const positionMod = {
      '2pt': { 'PG': 0, 'SG': 1, 'SF': 1, 'PF': 2, 'C': 3 },
      '3pt': { 'PG': 2, 'SG': 3, 'SF': 2, 'PF': 0, 'C': -2 },
    };
    const playTypeMod = {
      'normal': 0, 'postUp': 2, 'pickAndRoll': 1, 'alleyOop': 3, 'fadeaway': -1
    };
    const skillBonus = shooter.skillLevel + (stolen ? 3 : 0);
    const posMod = positionMod[shotType][shooter.position] || 0;
    const playMod = playTypeMod[playType] || 0;
    const rollShot = DiceRoller.rollDie(20);
    const totalRoll = rollShot + skillBonus + posMod + playMod;
    const difficulty = shotType === '2pt' ? 12 : 15;
    const made = totalRoll >= difficulty;
    
    let result = { scored: false, points: 0, scoringTeam: null, newPossession: possession, foulCommitted: false, foulTeam: null };
    
    if (isFouled) {
      // Foul occurred
      result.foulCommitted = true;
      result.foulTeam = shooterIsHome ? 'away' : 'home';
      
      const foulNarrationType = inBonus ? 'foulBonus' : 'foul';
      addNarration(foulNarrationType, { defender: shooterDefender.name, player: shooter.name });
      
      if (made) {
        // And-one situation!
        const points = shotType === '2pt' ? 2 : 3;
        shooter.stats.pointsScored += points;
        addNarration('andOne', { player: shooter.name });
        
        // Shoot 1 free throw
        const ftRoll = DiceRoller.rollDie(20) + shooter.skillLevel;
        if (ftRoll >= 10) {
          shooter.stats.pointsScored += 1;
          addNarration('freeThrowMake', { player: shooter.name });
          result.points = points + 1;
        } else {
          addNarration('freeThrowMiss', { player: shooter.name });
          result.points = points;
        }
        result.scored = true;
        result.scoringTeam = shooterIsHome ? 'home' : 'away';
        result.newPossession = shooterIsHome ? 'away' : 'home';
        setCurrentAction(`${shooter.name} - And One!`);
      } else {
        // Missed shot, shoot free throws
        const numFreeThrows = shotType === '3pt' ? 3 : 2;
        let ftMade = 0;
        for (let ft = 0; ft < numFreeThrows; ft++) {
          const ftRoll = DiceRoller.rollDie(20) + shooter.skillLevel;
          if (ftRoll >= 10) {
            ftMade++;
            addNarration('freeThrowMake', { player: shooter.name });
          } else {
            addNarration('freeThrowMiss', { player: shooter.name });
          }
        }
        if (ftMade > 0) {
          shooter.stats.pointsScored += ftMade;
          result.scored = true;
          result.points = ftMade;
          result.scoringTeam = shooterIsHome ? 'home' : 'away';
        }
        result.newPossession = shooterIsHome ? 'away' : 'home';
        setCurrentAction(ftMade > 0 ? `${shooter.name} - ${ftMade}/${numFreeThrows} FT` : null);
      }
    } else if (made) {
      const points = shotType === '2pt' ? 2 : 3;
      shooter.stats.pointsScored += points;
      
      // Choose narration based on play type
      let eventType;
      if (stolen) {
        eventType = shotType === '2pt' ? 'score2ptFastBreak' : 'score3ptFastBreak';
      } else if (playType === 'alleyOop') {
        eventType = 'alleyOop';
        addNarration(eventType, { player: shooter.name, passer: passer?.name || 'teammate' });
      } else if (playType === 'postUp') {
        eventType = 'postUp';
        addNarration(eventType, { player: shooter.name });
      } else if (playType === 'fadeaway') {
        eventType = 'fadeaway';
        addNarration(eventType, { player: shooter.name });
      } else if (playType === 'pickAndRoll') {
        eventType = 'pickAndRoll';
        addNarration(eventType, { player: shooter.name });
      } else {
        // Normal shot with variety
        if (shotType === '2pt') {
          eventType = Math.random() < 0.3 ? 'dunk' : (Math.random() < 0.5 ? 'layup' : 'score2pt');
        } else {
          eventType = 'score3pt';
        }
        addNarration(eventType, { player: shooter.name, team: shooterTeam.name });
      }
      
      setCurrentAction(`${shooter.name} - ${points} pts!`);
      result = { scored: true, points, scoringTeam: shooterIsHome ? 'home' : 'away', newPossession: shooterIsHome ? 'away' : 'home', foulCommitted: false, foulTeam: null };
    } else {
      // Check for block (15% chance for 2pt, 8% for 3pt)
      const blockChance = shotType === '2pt' ? 0.15 : 0.08;
      const wasBlocked = Math.random() < blockChance;
      
      if (wasBlocked) {
        addNarration('block', { defender: shooterDefender.name, player: shooter.name });
      } else {
        addNarration(shotType === '2pt' ? 'miss2pt' : 'miss3pt', { player: shooter.name });
      }
      
      setCurrentAction(null);
      
      // Rebound - 60% goes to defense, 40% offense
      const defenseGetsRebound = Math.random() < 0.6;
      const newPoss = defenseGetsRebound 
        ? (shooterIsHome ? 'away' : 'home')
        : (shooterIsHome ? 'home' : 'away');
      
      // Get rebounder (weighted by position)
      const reboundTeam = defenseGetsRebound ? defenseTeam : offenseTeam;
      const reboundWeights = { 'C': 40, 'PF': 30, 'SF': 15, 'SG': 10, 'PG': 5 };
      const reboundPlayers = reboundTeam.players.filter(p => p.isActive).slice(0, 5);
      let totalWeight = reboundPlayers.reduce((sum, p) => sum + (reboundWeights[p.position] || 10), 0);
      let rebRoll = Math.random() * totalWeight;
      let rebounder = reboundPlayers[0];
      for (const p of reboundPlayers) {
        rebRoll -= reboundWeights[p.position] || 10;
        if (rebRoll <= 0) { rebounder = p; break; }
      }
      
      // Add rebound narration
      if (defenseGetsRebound) {
        addNarration('reboundDefense', { player: rebounder.name });
      } else {
        addNarration('reboundOffense', { player: rebounder.name });
      }
      
      result = { scored: false, points: 0, scoringTeam: null, newPossession: newPoss, foulCommitted: false, foulTeam: null };
    }
    
    return result;
  };

  const simulateMatch = async () => {
    setIsSimulating(true);
    setNarrationLog([]);
    
    // Reset scores and fouls
    let hScore = 0;
    let aScore = 0;
    let hFouls = 0;
    let aFouls = 0;
    homeTeam.players.forEach(p => p.stats.pointsScored = 0);
    awayTeam.players.forEach(p => p.stats.pointsScored = 0);
    
    addNarration('matchStart', { homeTeam: homeTeam.name, awayTeam: awayTeam.name });
    
    // Home team gets first possession, alternates each quarter
    let possession = 'home';
    
    for (let q = 1; q <= 4; q++) {
      setQuarter(q);
      setGameTime(720); // Reset to 12:00 each quarter
      
      // Reset quarter fouls
      let homeQFouls = 0;
      let awayQFouls = 0;
      setHomeQuarterFouls(0);
      setAwayQuarterFouls(0);
      
      // Alternate starting possession each quarter
      possession = (q % 2 === 1) ? 'home' : 'away';
      
      // 25 rounds per quarter, each round ~29 seconds of game time
      for (let r = 0; r < 25; r++) {
        const currentRound = (q - 1) * 25 + r + 1;
        setRound(currentRound);
        
        // Update game clock (each possession ~14-15 seconds, 2 possessions per round)
        const timeUsed = Math.floor(Math.random() * 10) + 24; // 24-33 seconds per round
        const newTime = Math.max(0, 720 - Math.floor((r + 1) * 28.8)); // Countdown from 12:00
        setGameTime(newTime);
        
        const result = simulateRound(homeTeam, awayTeam, possession, { home: homeQFouls, away: awayQFouls });
        
        // Track fouls
        if (result.foulCommitted) {
          if (result.foulTeam === 'home') {
            hFouls++;
            homeQFouls++;
            setHomeFouls(hFouls);
            setHomeQuarterFouls(homeQFouls);
          } else {
            aFouls++;
            awayQFouls++;
            setAwayFouls(aFouls);
            setAwayQuarterFouls(awayQFouls);
          }
        }
        
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
      
      setGameTime(0); // End of quarter
      
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
      fouls: 'Faltas',
      bonus: 'BÔNUS',
      timeouts: 'Tempos',
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
      fouls: 'Fouls',
      bonus: 'BONUS',
      timeouts: 'TOs',
    },
  };

  const t = texts[language] || texts.pt;

  return (
    <div className="match-view">
      {/* Scoreboard */}
      <div className="scoreboard">
        {/* Game Clock */}
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
          {possession === 'home' ? '🏀 ←' : '→ 🏀'}
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
