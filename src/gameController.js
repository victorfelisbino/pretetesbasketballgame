/**
 * GameController
 * Main simulation orchestrator that wires all Phase 0 systems together.
 *
 * Design notes:
 * - Pure JS — zero React dependencies, zero network calls.
 * - ActionResolver and DribbleSystem are imported as proper ES modules.
 * - DiceRoller and Narrator are inlined (their source files use CommonJS
 *   module.exports without ES export syntax, which is incompatible with
 *   Vite's strict ESM mode). The inline implementations are faithful copies
 *   of the originals, extended with the extra narration templates that
 *   MatchView.jsx adds.
 * - The simulation logic mirrors MatchView.jsx's simulateRound() function
 *   (which is the production-proven implementation) so the GameController
 *   produces identical results to what the live UI already renders.
 * - All React UI state updates are replaced with an event-subscriber pattern:
 *   UI code calls subscribe(fn) and receives live updates on every round.
 */

import { ActionResolver } from './actionResolver.js';
import { DribbleSystem } from './dribbleSystem.js';
import { PLAY_STYLES, DEFENSIVE_SCHEMES, calculateChemistryBonus } from './core/tacticsEngine.js';

// ---------------------------------------------------------------------------
// Inline DiceRoller
// (Mirrors src/dice.js — kept inline to avoid CommonJS/ESM boundary issues)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Narration templates
// (Combines templates from src/narration.js and the extended set in
//  MatchView.jsx. Brazilian Portuguese is the default language.)
// ---------------------------------------------------------------------------
const NARRATION_TEMPLATES = {
  pt: {
    matchStart: [
      '🏀 COMEÇA O JOGO! {homeTeam} contra {awayTeam}!',
      '🏀 BOLA AO AR! {homeTeam} enfrenta {awayTeam} nesta partida!',
      '🏀 É HORA DO SHOW! {homeTeam} x {awayTeam}!',
    ],
    matchEnd: [
      '🏆 FIM DE JOGO! {winnerTeam} vence por {winnerScore} a {loserScore}!',
      '🏆 ACABOU! Vitória do {winnerTeam}: {winnerScore} x {loserScore}!',
      '🏆 APITA O JUIZ! {winnerTeam} leva a melhor: {winnerScore} a {loserScore}!',
    ],
    score2pt: [
      '🏀 CESTA! {player} anota 2 pontos!',
      '🏀 {player} converte! 2 pontos no placar!',
      '🏀 BONITO! {player} faz a bandeja e marca 2!',
      '🏀 {player} no garrafão! AFUNDOU! 2 pontos!',
    ],
    score2ptFastBreak: [
      '⚡ CONTRA-ATAQUE! {player} corre sozinho e ENTERRA! 2 pontos!',
      '⚡ FAST BREAK! {player} não perdoa! Bandeja fácil!',
      '⚡ ROUBADA E CESTA! {player} não deixa passar! 2 pontos!',
    ],
    score3pt: [
      '🎯 TRÊS PONTOS! {player} de longe! VALEU!',
      '🎯 DO PERÍMETRO! {player} acerta a bomba! 3 pontos!',
      '🎯 TRIPLAÇO de {player}! A bola nem tocou no aro!',
    ],
    score3ptFastBreak: [
      '⚡🎯 CONTRA-ATAQUE COM BOMBA! {player} arrisca de três e ACERTA!',
      '⚡🎯 FAST BREAK! {player} para, mira e... TRIPLA! 3 pontos!',
    ],
    miss2pt: [
      '❌ {player} tenta a bandeja mas erra!',
      '❌ A bola bate no aro e sai! {player} não consegue converter.',
      '❌ Tentativa de {player}... não entrou!',
    ],
    miss3pt: [
      '❌ {player} arrisca de três... não vai!',
      '❌ A bomba de {player} bate no ferro!',
      '❌ Três pontos de {player}... ERROU!',
    ],
    steal: [
      '🔥 ROUBADA DE BOLA! {defender} toma a bola de {attacker}!',
      '🔥 INTERCEPTAÇÃO! {defender} lê a jogada e rouba!',
      '🔥 QUE DEFESA! {defender} arranca a bola de {attacker}!',
    ],
    fastBreakStart: [
      '⚡ CONTRA-ATAQUE! {team} sai em velocidade!',
      '⚡ {player} puxa o fast break para {team}!',
    ],
    block: [
      '🚫 TOCO! {defender} manda a bola de {player} pra arquibancada!',
      '🚫 BLOQUEIO ESPETACULAR! {defender} rejeita {player}!',
      '🚫 NÃO HOJE! {defender} bloqueia o arremesso de {player}!',
    ],
    reboundDefense: [
      '📥 REBOTE DEFENSIVO! {player} pega a bola!',
      '📥 {player} sobe e agarra o rebote!',
      '📥 {player} domina as tabelas! Rebote defensivo!',
    ],
    reboundOffense: [
      '📤 REBOTE OFENSIVO! {player} mantém a posse viva!',
      '📤 SEGUNDA CHANCE! {player} pega o rebote!',
    ],
    pickAndRoll: ['🔄 Pick and roll! {player} usa o bloqueio e anota!'],
    alleyOop: ['🔥 ALLEY-OOP! {passer} para {player}! Espetacular!'],
    postUp: ['💪 {player} no garrafão! Gira e converte!'],
    fadeaway: ['🎨 FADEAWAY! {player} com o arremesso de costas! Sensacional!'],
    dunk: ['💥 ENTERRADA! {player} vai com força!'],
    layup: ['🏀 {player} bandeja limpa!'],
    foul: ['⚠️ FALTA! {defender} em {player}!'],
    foulBonus: ['⚠️ FALTA! {defender} em {player}! Equipe no bônus!'],
    freeThrowMake: ['✅ {player} converte o lance livre!'],
    freeThrowMiss: ['❌ {player} erra o lance livre!'],
    andOne: ['🔥 E A FALTA! {player} pode converter o and-one!'],
    quarterEnd: [
      '📋 Final do {quarter}º período! {homeTeam} {homeScore} x {awayScore} {awayTeam}',
      '📋 Fim do {quarter}º quarto! Placar: {homeScore} a {awayScore}',
    ],
    closeGame: [
      '🔥 JOGO APERTADO! Apenas {diff} ponto(s) de diferença!',
      '🔥 QUE EMOÇÃO! Diferença de apenas {diff}!',
    ],
    blowout: [
      '😮 {team} abre {diff} pontos de vantagem!',
      '😮 Domínio total de {team}! {diff} pontos na frente!',
    ],
  },
  en: {
    matchStart: [
      '🏀 TIP OFF! {homeTeam} vs {awayTeam}!',
      '🏀 THE GAME BEGINS! {homeTeam} takes on {awayTeam}!',
    ],
    matchEnd: [
      '🏆 FINAL! {winnerTeam} wins {winnerScore} to {loserScore}!',
      '🏆 THAT\'S THE GAME! {winnerTeam} takes it {winnerScore}-{loserScore}!',
    ],
    score2pt: [
      '🏀 BUCKET! {player} scores 2!',
      '🏀 {player} converts! 2 points on the board!',
      '🏀 NICE! {player} with the layup for 2!',
    ],
    score2ptFastBreak: [
      '⚡ FAST BREAK! {player} goes coast to coast and SLAMS IT! 2 points!',
      '⚡ TRANSITION BUCKET! {player} finishes easy!',
    ],
    score3pt: [
      '🎯 THREE POINTER! {player} from downtown! GOOD!',
      '🎯 FROM THE PERIMETER! {player} drains it! 3 points!',
      '🎯 SPLASH by {player}! Nothing but net!',
    ],
    score3ptFastBreak: [
      '⚡🎯 FAST BREAK THREE! {player} pulls up and DRAINS IT!',
      '⚡🎯 TRANSITION THREE! {player} stops, pops, and... BANG! 3 points!',
    ],
    miss2pt: [
      '❌ {player} tries the layup but misses!',
      '❌ The ball rattles out! {player} can\'t convert.',
    ],
    miss3pt: [
      '❌ {player} shoots the three... won\'t go!',
      '❌ {player}\'s three-pointer hits the rim!',
    ],
    steal: [
      '🔥 STEAL! {defender} takes it from {attacker}!',
      '🔥 GREAT DEFENSE! {defender} rips it from {attacker}!',
    ],
    fastBreakStart: [
      '⚡ FAST BREAK! {team} pushes the pace!',
      '⚡ {player} leads the break for {team}!',
    ],
    block: [
      '🚫 BLOCKED! {defender} swats {player}\'s shot away!',
      '🚫 NOT IN MY HOUSE! {defender} blocks {player}!',
    ],
    reboundDefense: [
      '📥 DEFENSIVE REBOUND! {player} grabs the board!',
      '📥 {player} controls the glass! Defensive board!',
    ],
    reboundOffense: [
      '📤 OFFENSIVE REBOUND! {player} keeps the possession alive!',
      '📤 SECOND CHANCE! {player} grabs the board!',
    ],
    pickAndRoll: ['🔄 Pick and roll! {player} uses the screen and scores!'],
    alleyOop: ['🔥 ALLEY-OOP! {passer} to {player}! Spectacular!'],
    postUp: ['💪 {player} in the post! Spins and scores!'],
    fadeaway: ['🎨 FADEAWAY! {player} with the turnaround jumper! Beautiful!'],
    dunk: ['💥 SLAM DUNK! {player} throws it down!'],
    layup: ['🏀 {player} with the easy layup!'],
    foul: ['⚠️ FOUL! {defender} on {player}!'],
    foulBonus: ['⚠️ FOUL! {defender} on {player}! Team in the bonus!'],
    freeThrowMake: ['✅ {player} makes the free throw!'],
    freeThrowMiss: ['❌ {player} misses the free throw!'],
    andOne: ['🔥 AND ONE! {player} with a chance for the three-point play!'],
    quarterEnd: [
      '📋 End of Q{quarter}! {homeTeam} {homeScore} - {awayScore} {awayTeam}',
    ],
    closeGame: [
      '🔥 CLOSE GAME! Only {diff} point(s) separating them!',
    ],
    blowout: [
      '😮 {team} up by {diff} points!',
    ],
  },
};

// ---------------------------------------------------------------------------
// Inline Narrator
// (Mirrors src/narration.js Narration class — kept inline for the same
//  CommonJS/ESM reason as DiceRoller above)
// ---------------------------------------------------------------------------
class Narrator {
  constructor(language = 'pt') {
    this.language = language;
  }

  setLanguage(language) {
    if (language === 'pt' || language === 'en') {
      this.language = language;
    }
  }

  narrate(eventType, data = {}) {
    const lang = this.language;
    const langTemplates = NARRATION_TEMPLATES[lang] || NARRATION_TEMPLATES.pt;
    if (!langTemplates[eventType]) return `[${eventType}]`;
    const options = langTemplates[eventType];
    let text = options[Math.floor(Math.random() * options.length)];
    for (const [key, value] of Object.entries(data)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return text;
  }
}

// ---------------------------------------------------------------------------
// Position / play-type constants (mirrors MatchView.jsx defaults)
// ---------------------------------------------------------------------------
const BALL_CARRIER_WEIGHTS = { PG: 40, SG: 25, SF: 15, PF: 12, C: 8 };
const THREE_POINT_CHANCE = { PG: 0.35, SG: 0.40, SF: 0.25, PF: 0.08, C: 0.02 };
const POSITION_SHOT_MOD = {
  '2pt': { PG: 0, SG: 1, SF: 1, PF: 2, C: 3 },
  '3pt': { PG: 2, SG: 3, SF: 2, PF: 0, C: -2 },
};
const PLAY_TYPE_MOD = { normal: 0, postUp: 2, pickAndRoll: 1, alleyOop: 3, fadeaway: -1 };
const REBOUND_WEIGHTS = { C: 40, PF: 30, SF: 15, SG: 10, PG: 5 };

// ---------------------------------------------------------------------------
// GameController
// ---------------------------------------------------------------------------

/**
 * GameController
 *
 * Wires the four-quarter, 100-round simulation into a reusable JS class.
 * UI components subscribe via `subscribe(callback)` and receive live events.
 *
 * The simulation logic is derived from MatchView.jsx's simulateRound()
 * function (the production-verified implementation). This keeps parity
 * between headless simulation (for testing / batch results) and the live
 * UI-driven match experience.
 *
 * Integration points with Phase 0 engine files:
 *   - ActionResolver (actionResolver.js) — imported; used for success % math
 *   - DribbleSystem (dribbleSystem.js) — imported; used for d20 steal contests
 *   - DiceRoller (mirrors dice.js) — inlined for ESM compatibility
 *   - Narrator (mirrors narration.js) — inlined for ESM compatibility
 *   - Team / Player shapes — this controller works with the plain-object
 *     team format that TeamSetup.jsx produces (same shape as the Team/Player
 *     classes, but plain objects for React serialisation compatibility).
 *
 * @example
 *   const gc = new GameController(homeTeam, awayTeam, { language: 'pt' });
 *   gc.subscribe(({ event, state }) => console.log(event, state));
 *   const summary = await gc.runFullMatch();
 */
class GameController {
  /**
   * @param {object} homeTeam  - Team object (name, players array)
   * @param {object} awayTeam  - Team object (name, players array)
   * @param {object} [options]
   * @param {string} [options.language='pt']   - Narration language ('pt'|'en')
   * @param {number} [options.speed=50]        - Delay (ms) per round batch
   *                                             for live playback (0 = instant)
   */
  constructor(homeTeam, awayTeam, options = {}) {
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    this.language = options.language || 'pt';
    this.speed = options.speed !== undefined ? options.speed : 50;

    // Simulation state
    this._homeScore = 0;
    this._awayScore = 0;
    this._quarter = 1;
    this._round = 0;
    this._possession = 'home'; // 'home' | 'away'
    this._status = 'idle'; // 'idle' | 'running' | 'paused' | 'complete'
    this._paused = false;

    // Foul tracking (per-game and per-quarter)
    this._homeFouls = 0;
    this._awayFouls = 0;
    this._homeQuarterFouls = 0;
    this._awayQuarterFouls = 0;

    // Timeouts (7 per team per NBA rules)
    this._homeTimeouts = 7;
    this._awayTimeouts = 7;

    // Game time — counts down from 720 s (12:00) per quarter
    this._gameTime = 720;

    // Narration
    this._narrator = new Narrator(this.language);
    this._narrationLog = []; // { text, type, quarter, round }

    // Internal event log (all MatchEngine-style events)
    this._events = [];

    // Subscriber callbacks
    this._subscribers = [];

    // Final summary (set when match is complete)
    this._matchSummary = null;

    // Tactics (optional — Issue 5)
    this._homeTactics = options.homeTactics || null; // { playStyle, defensiveScheme }
    this._awayTactics = options.awayTactics || null;

    // Resolve tactics to config objects (null-safe)
    this._homeTacticsResolved = this._homeTactics
      ? this._resolveTacticsConfig(this._homeTactics) : null;
    this._awayTacticsResolved = this._awayTactics
      ? this._resolveTacticsConfig(this._awayTactics) : null;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Set narration language at any time.
   * @param {string} language - 'pt' | 'en'
   */
  setLanguage(language) {
    this.language = language;
    this._narrator.setLanguage(language);
  }

  /**
   * Initialise systems and set initial state.
   * Call once before runFullMatch() or runNextRound().
   */
  startMatch() {
    // Reset scores on both team objects so they reflect fresh state
    this.homeTeam.score = 0;
    this.awayTeam.score = 0;
    this.homeTeam.players.forEach(p => {
      if (p.stats) {
        p.stats.pointsScored = 0;
        p.stats.assists = 0;
        p.stats.rebounds = 0;
        p.stats.steals = 0;
        p.stats.blocks = 0;
      }
    });
    this.awayTeam.players.forEach(p => {
      if (p.stats) {
        p.stats.pointsScored = 0;
        p.stats.assists = 0;
        p.stats.rebounds = 0;
        p.stats.steals = 0;
        p.stats.blocks = 0;
      }
    });

    // Reset internal counters
    this._homeScore = 0;
    this._awayScore = 0;
    this._quarter = 1;
    this._round = 0;
    this._possession = 'home';
    this._status = 'running';
    this._paused = false;
    this._homeFouls = 0;
    this._awayFouls = 0;
    this._homeQuarterFouls = 0;
    this._awayQuarterFouls = 0;
    this._homeTimeouts = 7;
    this._awayTimeouts = 7;
    this._gameTime = 720;
    this._narrationLog = [];
    this._events = [];
    this._matchSummary = null;

    // Match start narration
    this._addNarration('matchStart', {
      homeTeam: this.homeTeam.name,
      awayTeam: this.awayTeam.name,
    });

    this._emit('match_start', {});
  }

  /**
   * Run the complete 100-round match asynchronously.
   * Emits events throughout. Resolves with the match summary.
   *
   * @returns {Promise<object>} Match summary
   */
  async runFullMatch() {
    this.startMatch();

    for (let q = 1; q <= 4; q++) {
      this._quarter = q;
      this._gameTime = 720;
      this._homeQuarterFouls = 0;
      this._awayQuarterFouls = 0;

      // Alternate starting possession each quarter (home Q1 & Q3, away Q2 & Q4)
      this._possession = q % 2 === 1 ? 'home' : 'away';

      this._emit('quarter_start', { quarter: q });

      for (let r = 0; r < 25; r++) {
        // Honour pause flag
        if (this._paused) {
          await this._waitForResume();
        }

        this._round++;
        this._gameTime = Math.max(0, 720 - Math.floor((r + 1) * 28.8));

        this._simulateRound();

        // Emit round-complete for UI to batch-update
        if (r % 5 === 4 && this.speed > 0) {
          this._emit('round_complete', {});
          await this._delay(this.speed);
        }
      }

      this._gameTime = 0;
      this._quarter = q; // keep readable before incrementing

      const qText = this._addNarration('quarterEnd', {
        quarter: q,
        homeTeam: this.homeTeam.name,
        homeScore: this._homeScore,
        awayTeam: this.awayTeam.name,
        awayScore: this._awayScore,
      });

      const diff = Math.abs(this._homeScore - this._awayScore);
      if (diff <= 5) {
        this._addNarration('closeGame', { diff });
      } else if (diff >= 15) {
        const leadTeam =
          this._homeScore > this._awayScore ? this.homeTeam.name : this.awayTeam.name;
        this._addNarration('blowout', { team: leadTeam, diff });
      }

      this._emit('quarter_end', {
        quarter: q,
        homeScore: this._homeScore,
        awayScore: this._awayScore,
      });

      if (this.speed > 0) {
        await this._delay(100);
      }
    }

    // Match end
    const winner = this._getWinner();
    if (winner) {
      const loser = winner === this.homeTeam ? this.awayTeam : this.homeTeam;
      this._addNarration('matchEnd', {
        winnerTeam: winner.name,
        loserTeam: loser.name,
        winnerScore: Math.max(this._homeScore, this._awayScore),
        loserScore: Math.min(this._homeScore, this._awayScore),
      });
    }

    this._status = 'complete';
    this._matchSummary = this._buildSummary();
    this._emit('match_end', this._matchSummary);

    return this._matchSummary;
  }

  /**
   * Advance exactly one round. Useful for a tick-by-tick live playback
   * where the UI controls the tempo (e.g. within a setInterval).
   *
   * @returns {object} Current state after this round
   */
  runNextRound() {
    if (this._status === 'complete') return this.getState();

    if (this._status === 'idle') {
      this.startMatch();
    }

    // Advance into next quarter if needed
    const roundsPerQuarter = 25;
    const quarterIndex = Math.floor(this._round / roundsPerQuarter); // 0-based
    const roundInQuarter = this._round % roundsPerQuarter;

    if (roundInQuarter === 0 && this._round > 0) {
      // Entering a new quarter
      this._quarter = quarterIndex + 1;
      this._gameTime = 720;
      this._homeQuarterFouls = 0;
      this._awayQuarterFouls = 0;
      this._possession = this._quarter % 2 === 1 ? 'home' : 'away';
      this._emit('quarter_start', { quarter: this._quarter });
    }

    // Check if match is over (100 rounds across 4 quarters)
    if (this._round >= 100) {
      if (this._status !== 'complete') {
        this._status = 'complete';
        this._matchSummary = this._buildSummary();
        this._emit('match_end', this._matchSummary);
      }
      return this.getState();
    }

    this._round++;
    this._gameTime = Math.max(
      0,
      720 - Math.floor((roundInQuarter + 1) * 28.8)
    );

    this._simulateRound();
    this._emit('round_complete', {});

    // Quarter boundary — emit quarter_end
    if ((this._round % roundsPerQuarter) === 0 && this._round <= 100) {
      const q = this._round / roundsPerQuarter;
      this._addNarration('quarterEnd', {
        quarter: q,
        homeTeam: this.homeTeam.name,
        homeScore: this._homeScore,
        awayTeam: this.awayTeam.name,
        awayScore: this._awayScore,
      });
      const diff = Math.abs(this._homeScore - this._awayScore);
      if (diff <= 5) this._addNarration('closeGame', { diff });
      else if (diff >= 15) {
        const lead =
          this._homeScore > this._awayScore ? this.homeTeam.name : this.awayTeam.name;
        this._addNarration('blowout', { team: lead, diff: diff });
      }
      this._emit('quarter_end', {
        quarter: q,
        homeScore: this._homeScore,
        awayScore: this._awayScore,
      });

      if (q === 4) {
        this._status = 'complete';
        this._matchSummary = this._buildSummary();
        this._emit('match_end', this._matchSummary);
      }
    }

    return this.getState();
  }

  /** Pause a running match (affects runFullMatch async loop). */
  pause() {
    if (this._status === 'running') {
      this._paused = true;
      this._status = 'paused';
      this._emit('paused', {});
    }
  }

  /** Resume a paused match. */
  resume() {
    if (this._status === 'paused') {
      this._paused = false;
      this._status = 'running';
      this._emit('resumed', {});
    }
  }

  /**
   * Return a snapshot of the current match state.
   * Safe to call at any point in the simulation lifecycle.
   *
   * @returns {object}
   */
  getState() {
    return {
      status: this._status,
      round: this._round,
      quarter: this._quarter,
      gameTime: this._gameTime,
      homeTeamName: this.homeTeam.name,
      awayTeamName: this.awayTeam.name,
      homeScore: this._homeScore,
      awayScore: this._awayScore,
      possession: this._possession,
      homeFouls: this._homeFouls,
      awayFouls: this._awayFouls,
      homeQuarterFouls: this._homeQuarterFouls,
      awayQuarterFouls: this._awayQuarterFouls,
      homeTimeouts: this._homeTimeouts,
      awayTimeouts: this._awayTimeouts,
      narrationLog: [...this._narrationLog],
      lastNarration:
        this._narrationLog.length > 0
          ? this._narrationLog[this._narrationLog.length - 1]
          : null,
      recentEvents: this._events.slice(-5),
    };
  }

  /**
   * Return the final match summary.
   * Only fully populated after the match is complete.
   *
   * @returns {object}
   */
  getMatchSummary() {
    if (this._matchSummary) return this._matchSummary;
    return this._buildSummary();
  }

  /**
   * Subscribe to match events.
   * The callback receives { event: string, state: object, data: object }.
   *
   * Events emitted:
   *   'match_start'    — match has begun
   *   'quarter_start'  — new quarter started (data.quarter)
   *   'round_complete' — one simulation round finished
   *   'score'          — points scored (data.team, data.points, data.scorer)
   *   'steal'          — turnover via steal
   *   'narration'      — new narration entry (data.entry)
   *   'quarter_end'    — quarter finished (data.quarter, homeScore, awayScore)
   *   'match_end'      — match complete (data = full summary)
   *   'paused'         — match paused
   *   'resumed'        — match resumed
   *
   * @param {Function} callback - fn({ event, state, data }) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this._subscribers.push(callback);
    // Return an unsubscribe function
    return () => {
      this._subscribers = this._subscribers.filter(cb => cb !== callback);
    };
  }

  // -------------------------------------------------------------------------
  // Internal simulation — mirrors MatchView.jsx simulateRound()
  // -------------------------------------------------------------------------

  /**
   * Simulate a single round of play.
   * Updates internal score/foul/narration state directly.
   * Emits 'score' or 'steal' events as appropriate.
   */
  _simulateRound() {
    const isHome = this._possession === 'home';
    const offenseTeam = isHome ? this.homeTeam : this.awayTeam;
    const defenseTeam = isHome ? this.awayTeam : this.homeTeam;

    const defenseQuarterFouls = isHome
      ? this._awayQuarterFouls
      : this._homeQuarterFouls;
    const inBonus = defenseQuarterFouls >= 4;

    // --- Tactics modifiers for the current possession ---
    const offTacticsResolved = isHome ? this._homeTacticsResolved : this._awayTacticsResolved;
    const defTacticsResolved = isHome ? this._awayTacticsResolved : this._homeTacticsResolved;

    // --- Select ball carrier (position-weighted) ---
    const activePlayers = offenseTeam.players.filter(p => p.isActive !== false).slice(0, 5);
    const defenders = defenseTeam.players.filter(p => p.isActive !== false).slice(0, 5);

    if (activePlayers.length === 0) return;

    let ballCarrier = this._selectWeighted(activePlayers, BALL_CARRIER_WEIGHTS);
    const defender = defenders[Math.floor(Math.random() * defenders.length)];

    // --- Steal attempt (base 20%, modified by defensive scheme) ---
    let stolen = false;
    let fastBreakPlayer = null;

    let stealAttemptChance = 0.20;
    if (defTacticsResolved && defTacticsResolved.defenseScheme) {
      stealAttemptChance *= (1 + (defTacticsResolved.defenseScheme.stealRateMod || 0));
    }

    if (defender && Math.random() < stealAttemptChance) {
      // Use DribbleSystem for steal contest resolution
      const dribbleAttr = this._skillToDribbleAttr(ballCarrier.skillLevel);
      const stealAttr = this._skillToStealAttr(defender.skillLevel);
      const contest = DribbleSystem.resolveDribbleContest(
        { dribbling: dribbleAttr, name: ballCarrier.name },
        { stealing: stealAttr, name: defender.name }
      );

      if (!contest.success) {
        // Dribbler failed = ball was stolen
        stolen = true;
        fastBreakPlayer = defender;
        if (defender.stats) {
          defender.stats.steals = (defender.stats.steals || 0) + 1;
        }
        this._addNarration('steal', {
          defender: defender.name,
          attacker: ballCarrier.name,
        });
        this._addNarration('fastBreakStart', {
          team: defenseTeam.name,
          player: defender.name,
        });
        this._logEvent('steal', `${defender.name} steals from ${ballCarrier.name}!`);
        this._emit('steal', { defender: defender.name, attacker: ballCarrier.name });
      }
    }

    // --- Shooter & team setup ---
    let shooter = stolen ? fastBreakPlayer : ballCarrier;
    const shooterIsHome = stolen ? !isHome : isHome;
    const shooterTeam = stolen ? defenseTeam : offenseTeam;
    const shooterDefender = defenders[Math.floor(Math.random() * defenders.length)];

    // --- Determine play type ---
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
          const bigMen = activePlayers.filter(
            p => p.position === 'C' || p.position === 'PF'
          );
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

    // --- Foul check (15 % on shots, 8 % on fast break) ---
    const foulChance = stolen ? 0.08 : 0.15;
    const isFouled = Math.random() < foulChance;

    // --- Shot type (with optional tactics volume modifier) ---
    const shotOffTactics = shooterIsHome ? this._homeTacticsResolved : this._awayTacticsResolved;
    const shotDefTactics = shooterIsHome ? this._awayTacticsResolved : this._homeTacticsResolved;
    let effectiveThreeChance = THREE_POINT_CHANCE[shooter.position] || 0;
    if (shotOffTactics && shotOffTactics.playStyle) {
      effectiveThreeChance = Math.max(0, Math.min(1,
        effectiveThreeChance * (1 + (shotOffTactics.playStyle.threePointVolume || 0))
      ));
    }
    let shotType = Math.random() < effectiveThreeChance ? '3pt' : '2pt';
    if (playType === 'alleyOop' || playType === 'postUp') shotType = '2pt';

    // --- Resolve shot via ActionResolver ---
    const shotMade = this._resolveShot(
      shooter, shooterDefender, shotType, playType, stolen,
      shotOffTactics, shotDefTactics
    );

    // --- Resolve outcome ---
    if (isFouled) {
      this._resolveFoulPlay({
        shooter,
        shooterIsHome,
        shooterDefender,
        shotType,
        shotMade,
        inBonus,
      });
    } else if (shotMade) {
      this._resolveMadeShot({
        shooter,
        shooterIsHome,
        shooterTeam,
        shotType,
        playType,
        passer,
        stolen,
        activePlayers,
      });
    } else {
      this._resolveMissedShot({
        shooter,
        shooterIsHome,
        shooterDefender,
        shotType,
        defenders,
        offenseTeam,
        defenseTeam,
        stolen,
      });
    }
  }

  _resolveFoulPlay({ shooter, shooterIsHome, shooterDefender, shotType, shotMade, inBonus }) {
    // Track foul on the defending team
    if (shooterIsHome) {
      this._awayFouls++;
      this._awayQuarterFouls++;
    } else {
      this._homeFouls++;
      this._homeQuarterFouls++;
    }

    const foulType = inBonus ? 'foulBonus' : 'foul';
    this._addNarration(foulType, {
      defender: shooterDefender ? shooterDefender.name : 'Defensor',
      player: shooter.name,
    });

    if (shotMade) {
      // And-one situation
      const points = shotType === '2pt' ? 2 : 3;
      this._awardPoints(shooter, shooterIsHome, points);
      this._addNarration('andOne', { player: shooter.name });

      // One free throw — resolved via ActionResolver
      const ftResult = ActionResolver.resolveFreeThrow({
        freeThrow: this._skillToFreeThrowPct(shooter.skillLevel),
        name: shooter.name,
      });
      if (ftResult.made) {
        this._awardPoints(shooter, shooterIsHome, 1);
        this._addNarration('freeThrowMake', { player: shooter.name });
      } else {
        this._addNarration('freeThrowMiss', { player: shooter.name });
      }
    } else {
      // Missed shot — shoot free throws via ActionResolver
      const numFT = shotType === '3pt' ? 3 : 2;
      for (let ft = 0; ft < numFT; ft++) {
        const ftResult = ActionResolver.resolveFreeThrow({
          freeThrow: this._skillToFreeThrowPct(shooter.skillLevel),
          name: shooter.name,
        });
        if (ftResult.made) {
          this._awardPoints(shooter, shooterIsHome, 1);
          this._addNarration('freeThrowMake', { player: shooter.name });
        } else {
          this._addNarration('freeThrowMiss', { player: shooter.name });
        }
      }
    }

    // Possession switches after foul play
    this._switchPossession();
  }

  _resolveMadeShot({
    shooter,
    shooterIsHome,
    shooterTeam,
    shotType,
    playType,
    passer,
    stolen,
    activePlayers,
  }) {
    const points = shotType === '2pt' ? 2 : 3;
    this._awardPoints(shooter, shooterIsHome, points);

    // Choose narration based on play type
    if (stolen) {
      this._addNarration(
        shotType === '2pt' ? 'score2ptFastBreak' : 'score3ptFastBreak',
        { player: shooter.name, team: shooterTeam.name }
      );
    } else if (playType === 'alleyOop') {
      this._addNarration('alleyOop', {
        player: shooter.name,
        passer: passer ? passer.name : 'teammate',
      });
    } else if (playType === 'postUp') {
      this._addNarration('postUp', { player: shooter.name });
    } else if (playType === 'fadeaway') {
      this._addNarration('fadeaway', { player: shooter.name });
    } else if (playType === 'pickAndRoll') {
      this._addNarration('pickAndRoll', { player: shooter.name });
    } else {
      let eventType;
      if (shotType === '2pt') {
        const r = Math.random();
        eventType = r < 0.3 ? 'dunk' : r < 0.6 ? 'layup' : 'score2pt';
      } else {
        eventType = 'score3pt';
      }
      this._addNarration(eventType, {
        player: shooter.name,
        team: shooterTeam.name,
      });
    }

    this._switchPossession();
  }

  _resolveMissedShot({
    shooter,
    shooterIsHome,
    shooterDefender,
    shotType,
    defenders,
    offenseTeam,
    defenseTeam,
    stolen,
  }) {
    const blockChance = shotType === '2pt' ? 0.15 : 0.08;
    if (Math.random() < blockChance && shooterDefender) {
      this._addNarration('block', {
        defender: shooterDefender.name,
        player: shooter.name,
      });
    } else {
      this._addNarration(shotType === '2pt' ? 'miss2pt' : 'miss3pt', {
        player: shooter.name,
      });
    }

    // Rebound — 60 % defensive
    const defenseGetsRebound = Math.random() < 0.6;
    const reboundTeam = defenseGetsRebound ? defenseTeam : offenseTeam;
    const reboundPlayers = reboundTeam.players
      .filter(p => p.isActive !== false)
      .slice(0, 5);
    const rebounder = this._selectWeighted(reboundPlayers, REBOUND_WEIGHTS);

    if (rebounder) {
      if (rebounder.stats) rebounder.stats.rebounds = (rebounder.stats.rebounds || 0) + 1;
      this._addNarration(
        defenseGetsRebound ? 'reboundDefense' : 'reboundOffense',
        { player: rebounder.name }
      );
    }

    if (defenseGetsRebound) {
      this._switchPossession();
    }
    // Offensive rebound keeps same possession — no switch needed
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  _awardPoints(player, isHome, points) {
    if (player.stats) {
      player.stats.pointsScored = (player.stats.pointsScored || 0) + points;
    }
    if (isHome) {
      this._homeScore += points;
      this.homeTeam.score = this._homeScore;
    } else {
      this._awayScore += points;
      this.awayTeam.score = this._awayScore;
    }
    this._emit('score', {
      team: isHome ? 'home' : 'away',
      points,
      scorer: player.name,
      homeScore: this._homeScore,
      awayScore: this._awayScore,
    });
  }

  _switchPossession() {
    this._possession = this._possession === 'home' ? 'away' : 'home';
  }

  /**
   * Select a player from an array using position-based weights.
   * @param {Array} players
   * @param {object} weightMap - { position: number }
   * @returns {object} Selected player
   */
  _selectWeighted(players, weightMap) {
    if (!players || players.length === 0) return null;
    const totalWeight = players.reduce(
      (sum, p) => sum + (weightMap[p.position] || 10),
      0
    );
    let roll = Math.random() * totalWeight;
    for (const p of players) {
      roll -= weightMap[p.position] || 10;
      if (roll <= 0) return p;
    }
    return players[0];
  }

  // -------------------------------------------------------------------------
  // ActionResolver / DribbleSystem / TacticsEngine adapter methods
  // -------------------------------------------------------------------------

  /**
   * Resolve a shot attempt via ActionResolver's probability system.
   * Converts the d20-based skill system to ActionResolver attributes
   * while maintaining calibrated success rates that match the original
   * scoring balance (60-130 ppg for equal-skill teams).
   *
   * Calibration notes (equal skill 3 vs 3):
   *   PG 2pt normal  = 60%  (matches original d20+3+0 >= 12)
   *   C  2pt postUp  = 85%  (matches original d20+3+3+2 >= 12)
   *   SG 3pt normal  = 60%  (matches original d20+3+3 >= 15)
   *   PG 3pt normal  = 55%  (matches original d20+3+2 >= 15)
   */
  _resolveShot(shooter, defender, shotType, playType, stolen, offTactics, defTactics) {
    const OFFENSE_ADVANTAGE = 10;       // Base offensive edge (% points)
    const THREE_POINT_PENALTY = 15;     // 3pt shots are harder than 2pt
    const FAST_BREAK_BONUS = 15;        // Fast break advantage
    const MOD_TO_PERCENT = 5;           // Each position/play modifier point = 5%

    // Map skillLevel to 1-99 attributes for ActionResolver
    const shootingAttr = this._skillToShootingAttr(shooter.skillLevel);
    const defenseAttr = defender
      ? this._skillToShootingAttr(defender.skillLevel)
      : this._skillToShootingAttr(3); // Default defender

    // Get base success percentage from ActionResolver
    let successPct = ActionResolver.calculateSuccessPercentage(shootingAttr, defenseAttr);

    // Offense advantage calibration offset
    successPct += OFFENSE_ADVANTAGE;

    // Position modifier (e.g. C gets +15% on 2pt, SG gets +15% on 3pt)
    const posMod = (POSITION_SHOT_MOD[shotType] || {})[shooter.position] || 0;
    successPct += posMod * MOD_TO_PERCENT;

    // Play type modifier (e.g. postUp +10%, alleyOop +15%)
    const playMod = PLAY_TYPE_MOD[playType] || 0;
    successPct += playMod * MOD_TO_PERCENT;

    // Fast break bonus
    if (stolen) successPct += FAST_BREAK_BONUS;

    // 3pt penalty
    if (shotType === '3pt') successPct -= THREE_POINT_PENALTY;

    // Apply tactics modifiers (only when tactics are configured)
    if (offTactics && offTactics.playStyle) {
      successPct *= (1 + (offTactics.playStyle.shootingMod || 0));
    }
    if (defTactics && defTactics.defenseScheme && shotType === '3pt') {
      // Defensive scheme affects opponent three-point success
      successPct *= (1 + (defTactics.defenseScheme.threePointAllowedMod || 0));
    }

    // Clamp to realistic range
    successPct = Math.max(5, Math.min(95, successPct));

    return ActionResolver.checkSuccess(successPct);
  }

  /**
   * Map skillLevel (1-5) to a 1-99 shooting/defense attribute
   * for ActionResolver's calculateSuccessPercentage.
   */
  _skillToShootingAttr(skillLevel) {
    return Math.min(99, Math.max(1, (skillLevel || 3) * 14 + 15));
  }

  /**
   * Map skillLevel (1-5) to a 1-20 dribbling attribute
   * for DribbleSystem's resolveDribbleContest.
   */
  _skillToDribbleAttr(skillLevel) {
    return Math.min(20, Math.max(1, (skillLevel || 3) * 3 + 2));
  }

  /**
   * Map skillLevel (1-5) to a 1-20 stealing attribute
   * for DribbleSystem's resolveDribbleContest.
   */
  _skillToStealAttr(skillLevel) {
    return Math.min(20, Math.max(1, (skillLevel || 3) * 3 + 2));
  }

  /**
   * Map skillLevel (1-5) to a free-throw success percentage
   * for ActionResolver's resolveFreeThrow.
   * Calibrated to exactly match the original d20 + skillLevel >= 10 system:
   *   skill 1 → 60%, skill 2 → 65%, skill 3 → 70%, skill 4 → 75%, skill 5 → 80%
   */
  _skillToFreeThrowPct(skillLevel) {
    return Math.min(95, Math.max(30, ((skillLevel || 3) + 11) * 5));
  }

  /**
   * Resolve a tactics configuration object.
   * Accepts { playStyle: string|config, defensiveScheme: string|config }.
   * Returns { playStyle: config|null, defenseScheme: config|null }.
   */
  _resolveTacticsConfig(tactics) {
    if (!tactics) return null;
    return {
      playStyle: this._resolvePlayStyleConfig(tactics.playStyle),
      defenseScheme: this._resolveDefenseSchemeConfig(tactics.defensiveScheme),
    };
  }

  /** Resolve a play style from a PLAY_STYLES key string or config object. */
  _resolvePlayStyleConfig(input) {
    if (!input) return null;
    if (typeof input === 'string') return PLAY_STYLES[input.toUpperCase()] || null;
    if (input && input.id) return input;
    return null;
  }

  /** Resolve a defensive scheme from a DEFENSIVE_SCHEMES key string or config object. */
  _resolveDefenseSchemeConfig(input) {
    if (!input) return null;
    if (typeof input === 'string') return DEFENSIVE_SCHEMES[input.toUpperCase()] || null;
    if (input && input.id) return input;
    return null;
  }

  /**
   * Add a narration entry. Emits a 'narration' event.
   * Returns the rendered narration text.
   */
  _addNarration(eventType, data = {}) {
    const text = this._narrator.narrate(eventType, data);

    // Classify text for CSS colouring (mirrors MatchView.jsx logic)
    const type = eventType.includes('score')
      ? 'score'
      : eventType.includes('miss') || eventType.includes('freeThrowMiss')
      ? 'miss'
      : eventType.includes('steal')
      ? 'steal'
      : eventType.includes('FastBreak') || eventType.includes('fastBreak')
      ? 'fastbreak'
      : 'default';

    const entry = { text, type, quarter: this._quarter, round: this._round };
    this._narrationLog.push(entry);
    this._emit('narration', { entry });
    return text;
  }

  /** Append to the internal event log (for getState/getMatchSummary). */
  _logEvent(type, description, details = {}) {
    this._events.push({
      round: this._round,
      quarter: this._quarter,
      possession: this._possession,
      type,
      description,
      details,
      timestamp: Date.now(),
    });
  }

  /** Emit to all subscribers. */
  _emit(event, data) {
    const payload = { event, state: this.getState(), data };
    for (const cb of this._subscribers) {
      try {
        cb(payload);
      } catch (e) {
        // Never crash the simulation due to a subscriber error
        console.error('[GameController] Subscriber error:', e);
      }
    }
  }

  /** Returns the winning team object (or null for a tie). */
  _getWinner() {
    if (this._homeScore > this._awayScore) return this.homeTeam;
    if (this._awayScore > this._homeScore) return this.awayTeam;
    return null;
  }

  /** Build and return the full match summary object. */
  _buildSummary() {
    const winner = this._getWinner();
    return {
      homeTeam: this.homeTeam.name,
      awayTeam: this.awayTeam.name,
      homeScore: this._homeScore,
      awayScore: this._awayScore,
      score: `${this._homeScore} - ${this._awayScore}`,
      winner: winner ? winner.name : 'TIE',
      rounds: this._round,
      quarter: this._quarter,
      narrationLog: [...this._narrationLog],
      events: [...this._events],
      homeTeamStats: this.homeTeam.players.map(p => ({
        name: p.name,
        position: p.position,
        points: p.stats ? p.stats.pointsScored || 0 : 0,
        assists: p.stats ? p.stats.assists || 0 : 0,
        rebounds: p.stats ? p.stats.rebounds || 0 : 0,
        steals: p.stats ? p.stats.steals || 0 : 0,
        blocks: p.stats ? p.stats.blocks || 0 : 0,
      })),
      awayTeamStats: this.awayTeam.players.map(p => ({
        name: p.name,
        position: p.position,
        points: p.stats ? p.stats.pointsScored || 0 : 0,
        assists: p.stats ? p.stats.assists || 0 : 0,
        rebounds: p.stats ? p.stats.rebounds || 0 : 0,
        steals: p.stats ? p.stats.steals || 0 : 0,
        blocks: p.stats ? p.stats.blocks || 0 : 0,
      })),
    };
  }

  /** Returns a Promise that resolves once the controller is resumed. */
  _waitForResume() {
    return new Promise(resolve => {
      const check = () => {
        if (!this._paused) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /** Returns a Promise that resolves after `ms` milliseconds. */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { GameController };
