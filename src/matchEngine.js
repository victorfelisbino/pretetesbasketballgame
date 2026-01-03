import { ActionResolver } from './actionResolver.js';
import { DribbleSystem } from './dribbleSystem.js';

/**
 * Match Engine
 * Core game simulation loop - runs the basketball match
 */
class MatchEngine {
    /**
     * Create a new match engine
     * @param {Team} homeTeam - The home team
     * @param {Team} awayTeam - The away team
     * @param {object} options - Configuration options
     * @param {string} options.language - Narration language ('pt' or 'en', default: 'pt')
     * @param {boolean} options.enableNarration - Enable play-by-play narration (default: true)
     */
    constructor(homeTeam, awayTeam, options = {}) {
        this.homeTeam = homeTeam;
        this.awayTeam = awayTeam;
        this.court = new Court(50, 30);
        
        // Match state
        this.round = 0;
        this.quarter = 1;
        this.possession = 'home'; // Who has the ball
        this.events = []; // Log of all actions
        
        // Score tracking
        this.homeTeam.score = 0;
        this.awayTeam.score = 0;
        
        // Narration system
        this.enableNarration = options.enableNarration !== false;
        this.language = options.language || 'pt';
        if (typeof Narration !== 'undefined') {
            this.narrator = new Narration(this.language);
        } else {
            this.narrator = null;
            this.enableNarration = false;
        }
        this.narrationLog = []; // Store narration texts
        
        // Initialize court with teams
        this.court.setupTeams(homeTeam, awayTeam);
    }
    
    /**
     * Set narration language
     * @param {string} language - 'pt' for Portuguese or 'en' for English
     */
    setLanguage(language) {
        this.language = language;
        if (this.narrator) {
            this.narrator.setLanguage(language);
        }
    }
    
    /**
     * Add narration for an event
     * @param {string} eventType - Type of narration event
     * @param {object} data - Data for the narration template
     */
    addNarration(eventType, data = {}) {
        if (!this.enableNarration || !this.narrator) return null;
        
        const text = this.narrator.narrate(eventType, data);
        this.narrationLog.push({
            round: this.round,
            quarter: this.quarter,
            text,
            eventType
        });
        return text;
    }
    
    /**
     * Get all narration entries
     * @returns {Array} Array of narration objects
     */
    getNarrationLog() {
        return this.narrationLog;
    }

    /**
     * Get current possession team
     */
    getPossessionTeam() {
        return this.possession === 'home' ? this.homeTeam : this.awayTeam;
    }

    /**
     * Get defending team
     */
    getDefendingTeam() {
        return this.possession === 'home' ? this.awayTeam : this.homeTeam;
    }

    /**
     * Log event to match history
     */
    logEvent(type, description, details = {}) {
        this.events.push({
            round: this.round,
            quarter: this.quarter,
            possession: this.possession,
            type, // 'dribble', 'shot', 'steal', 'assist', 'rebound', 'turnover'
            description,
            details,
            timestamp: new Date()
        });
    }

    /**
     * Get random active player from a team
     */
    getRandomPlayer(team) {
        const active = team.getActivePlayers();
        return active[Math.floor(Math.random() * active.length)];
    }

    /**
     * Simulate one round of action
     * Returns true if action was successful, false if turnover
     */
    simulateAction() {
        const possessionTeam = this.getPossessionTeam();
        const defendingTeam = this.getDefendingTeam();
        const isHome = this.possession === 'home';

        // Get player with ball - MUST be from possession team
        let ballCarrier = this.court.ballPossession;
        const possessionPlayers = possessionTeam.getActivePlayers();
        
        // Check if current ball carrier is on the possession team
        if (!ballCarrier || !possessionPlayers.includes(ballCarrier)) {
            // Pick a random player from possession team (weighted by position)
            // PG most likely to bring ball up, but others can too
            const weights = { 'PG': 40, 'SG': 25, 'SF': 15, 'PF': 12, 'C': 8 };
            let totalWeight = 0;
            for (let p of possessionPlayers) {
                totalWeight += weights[p.position] || 10;
            }
            let roll = Math.random() * totalWeight;
            for (let p of possessionPlayers) {
                roll -= weights[p.position] || 10;
                if (roll <= 0) {
                    ballCarrier = p;
                    break;
                }
            }
            if (!ballCarrier) ballCarrier = possessionPlayers[0];
            this.court.setBallPossession(ballCarrier);
        }

        // Move towards basket - higher skill = more steps
        // Skill 5 = 4 steps, Skill 1 = 2 steps
        const targetBasketX = isHome ? 49 : 0;
        const targetBasketY = 15;
        const moveSteps = 1 + Math.ceil(ballCarrier.skillLevel / 2);
        
        for (let step = 0; step < moveSteps; step++) {
            this.court.movePlayer(ballCarrier, targetBasketX, targetBasketY);
        }

        // Check for steal attempt AFTER movement (when near basket/defenders)
        const defender = this.court.getNearestOpponent(ballCarrier, defendingTeam.getActivePlayers());
        // Attempt steal if defender is close (within 5 squares) - 25% chance
        if (defender && this.court.areAdjacent(ballCarrier, defender, 5) && Math.random() < 0.25) {
            const stealSuccess = this.simulateDribbleContest(ballCarrier, defender);
            
            if (stealSuccess === true) {
                // Ball carrier escaped
                this.addNarration('stealAttemptFail', { defender: defender.name, attacker: ballCarrier.name });
            }
            
            if (stealSuccess === false) {
                // Turnover! Defender gets fast break opportunity
                this.logEvent('turnover', `${defender.name} steals from ${ballCarrier.name}!`);
                this.addNarration('steal', { defender: defender.name, attacker: ballCarrier.name });
                this.court.setBallPossession(defender);
                this.switchPossession();
                
                // FAST BREAK: Stealing player gets immediate shot attempt!
                this.addNarration('fastBreakStart', { team: this.getPossessionTeam().name, player: defender.name });
                this.simulateFastBreak(defender);
                return false;
            }
        }

        // Check shooting distance
        const shootDistance = this.court.getShootingDistance(ballCarrier, isHome);

        // Determine shot type based on distance and position
        let shotType = '2pt';
        if (shootDistance === 'three') {
            shotType = '3pt';
        } else if (shootDistance === 'mid') {
            // Guards (PG, SG) prefer 3-pointers even from mid-range (40% chance)
            // SF sometimes takes 3s (20% chance)
            const threePointChance = { 'PG': 0.4, 'SG': 0.4, 'SF': 0.2, 'PF': 0.05, 'C': 0 };
            if (Math.random() < (threePointChance[ballCarrier.position] || 0)) {
                shotType = '3pt';
            }
        }
        
        return this.simulateShot(ballCarrier, shotType, isHome);
    }

    /**
     * Simulate dribble vs steal contest (d20 system)
     * Uses DribbleSystem for proper d20 mechanics
     * Returns true if dribble wins, false if steal wins
     */
    simulateDribbleContest(ballCarrier, defender) {
        // Map skill level (1-5) to dribble/steal attribute (1-20)
        const dribbleAttr = ballCarrier.dribbling || (ballCarrier.skillLevel * 4);
        const stealAttr = defender.stealing || (defender.skillLevel * 4);

        // Use proper DribbleSystem
        const result = DribbleSystem.resolveDribbleContest(
            { ...ballCarrier, dribbling: dribbleAttr },
            { ...defender, stealing: stealAttr }
        );

        this.logEvent('dribble_contest', 
            result.description,
            {
                roll: result.roll,
                threshold: result.threshold,
                dribbleSkill: result.dribbleSkill,
                stealSkill: result.stealSkill,
                success: result.success,
                successPercent: result.successPercent
            }
        );

        return result.success;
    }

    /**
     * Simulate shot attempt using ActionResolver
     * Returns true if score, false if miss/turnover
     */
    simulateShot(shooter, shotType, isHome) {
        const defendingTeam = this.getDefendingTeam();
        const defender = this.court.getNearestOpponent(shooter, defendingTeam.getActivePlayers()) || 
                        defendingTeam.getActivePlayers()[0];

        // Map skill level to shooting attributes (1-99 scale)
        const shootingSkill = shooter.shooting || (shooter.skillLevel * 18 + 10);
        const shooting3pt = shooter.shooting3pt || (shooter.skillLevel * 15 + 5);
        const defenseSkill = defender.defense || (defender.skillLevel * 18 + 10);
        const perimeterDef = defender.perimeterDefense || (defender.skillLevel * 16 + 8);
        const blockingSkill = defender.blocking || (defender.skillLevel * 14);

        let result;
        if (shotType === '2pt') {
            result = ActionResolver.resolve2PointerAttempt(
                { ...shooter, shooting: shootingSkill },
                { ...defender, defense: defenseSkill, blocking: blockingSkill }
            );
        } else {
            result = ActionResolver.resolve3PointerAttempt(
                { ...shooter, shooting3pt: shooting3pt },
                { ...defender, perimeterDefense: perimeterDef, blocking: blockingSkill }
            );
        }

        // Check if position can perform this shot
        if (!result.diceResult.canPerform) {
            this.logEvent('shot_rejected', 
                `${shooter.name} cannot shoot ${shotType} from ${shooter.position} position`,
                result
            );
            // Fall back to 2pt for centers trying 3pt
            if (shotType === '3pt') {
                return this.simulateShot(shooter, '2pt', isHome);
            }
            return false;
        }

        if (result.blocked) {
            this.logEvent('shot_blocked', 
                `${shooter.name}'s shot BLOCKED by ${result.blocker}!`,
                { shotType, ...result }
            );
            this.addNarration('block', { player: shooter.name, defender: result.blocker });
            return this.simulateRebound(shooter);
        }

        if (result.made) {
            const points = result.points;
            shooter.addPoints(points);
            
            if (isHome) {
                this.homeTeam.score += points;
            } else {
                this.awayTeam.score += points;
            }

            this.logEvent('shot_made', 
                `${shooter.name} makes a ${shotType}! (+${points})`,
                { shotType, points, successPercent: result.successPercent, dice: result.diceResult }
            );
            
            const team = isHome ? this.homeTeam.name : this.awayTeam.name;
            if (shotType === '2pt') {
                this.addNarration('score2pt', { player: shooter.name, team });
            } else {
                this.addNarration('score3pt', { player: shooter.name, team });
            }

            this.switchPossession();
            return true;
        } else {
            this.logEvent('shot_missed', 
                `${shooter.name} misses the ${shotType}`,
                { shotType, successPercent: result.successPercent, dice: result.diceResult }
            );
            
            if (shotType === '2pt') {
                this.addNarration('miss2pt', { player: shooter.name });
            } else {
                this.addNarration('miss3pt', { player: shooter.name });
            }

            return this.simulateRebound(shooter);
        }
    }

    /**
     * Simulate rebound after missed shot using ActionResolver
     */
    simulateRebound(shooter) {
        const defendingTeam = this.getDefendingTeam();
        const possessionTeam = this.getPossessionTeam();
        
        // Get best rebounders from each team (weighted by position)
        const getRebound = (players) => {
            const weights = { 'C': 50, 'PF': 35, 'SF': 10, 'SG': 3, 'PG': 2 };
            let best = players[0];
            let bestWeight = 0;
            for (let p of players) {
                const weight = (weights[p.position] || 5) + (p.rebounding || p.skillLevel * 10);
                if (weight > bestWeight) {
                    bestWeight = weight;
                    best = p;
                }
            }
            return best;
        };

        const offRebounder = getRebound(possessionTeam.getActivePlayers());
        const defRebounder = getRebound(defendingTeam.getActivePlayers());

        // Map skill levels to rebounding attributes
        const offRebounding = offRebounder.rebounding || (offRebounder.skillLevel * 15 + 10);
        const defRebounding = defRebounder.rebounding || (defRebounder.skillLevel * 15 + 15);

        const result = ActionResolver.resolveReboundContest(
            { ...offRebounder, rebounding: offRebounding },
            { ...defRebounder, rebounding: defRebounding }
        );

        if (result.winner === 'defense') {
            this.logEvent('rebound', 
                `${result.winnerPlayer} grabs the defensive rebound!`,
                { 
                    offenseTotal: result.offenseTotal, 
                    defenseTotal: result.defenseTotal,
                    offenseRoll: result.offenseRoll,
                    defenseRoll: result.defenseRoll
                }
            );
            
            this.addNarration('reboundDefense', { player: result.winnerPlayer });
            this.court.setBallPossession(defRebounder);
            this.switchPossession();
            return false;
        } else {
            this.logEvent('offensive_rebound',
                `${result.winnerPlayer} gets the offensive rebound!`,
                { 
                    offenseTotal: result.offenseTotal, 
                    defenseTotal: result.defenseTotal,
                    offenseRoll: result.offenseRoll,
                    defenseRoll: result.defenseRoll
                }
            );
            
            this.addNarration('reboundOffense', { player: result.winnerPlayer });
            this.court.setBallPossession(offRebounder);
            return true;
        }
    }
    /**
     * Simulate fast break after steal
     * Player gets bonus shot with advantage
     */
    simulateFastBreak(player) {
        const isHome = this.possession === 'home';
        
        this.logEvent('fast_break', `${player.name} on the fast break!`);
        
        // Fast break shot has +3 bonus (easier shot)
        const skillBonus = player.skillLevel + 3; // Fast break advantage
        
        // Guards tend to pull up for 3, big men go for layup
        const threePointChance = { 'PG': 0.5, 'SG': 0.6, 'SF': 0.3, 'PF': 0.1, 'C': 0 };
        const shotType = Math.random() < (threePointChance[player.position] || 0) ? '3pt' : '2pt';
        
        const positionMod = {
            '2pt': { 'PG': 0, 'SG': 1, 'SF': 1, 'PF': 2, 'C': 3 },
            '3pt': { 'PG': 2, 'SG': 3, 'SF': 2, 'PF': 0, 'C': -2 }
        };
        
        const posMod = positionMod[shotType][player.position] || 0;
        const roll = DiceRoller.rollDie(20);
        const totalRoll = roll + skillBonus + posMod;
        
        const difficulty = shotType === '2pt' ? 12 : 15;
        const success = totalRoll >= difficulty;
        
        if (success) {
            const points = shotType === '2pt' ? 2 : 3;
            player.addPoints(points);
            
            if (isHome) {
                this.homeTeam.score += points;
            } else {
                this.awayTeam.score += points;
            }
            
            this.logEvent('fast_break_score', 
                `${player.name} scores on the fast break! (+${points})`,
                { shotType, points, roll: totalRoll }
            );
            
            // Narrate fast break score
            const team = isHome ? this.homeTeam.name : this.awayTeam.name;
            if (shotType === '2pt') {
                this.addNarration('score2ptFastBreak', { player: player.name, team });
            } else {
                this.addNarration('score3ptFastBreak', { player: player.name, team });
            }
        } else {
            this.logEvent('fast_break_miss', 
                `${player.name} misses the fast break ${shotType}!`,
                { shotType, roll: totalRoll }
            );
            
            // Narrate fast break miss
            if (shotType === '2pt') {
                this.addNarration('miss2pt', { player: player.name });
            } else {
                this.addNarration('miss3pt', { player: player.name });
            }
        }
        
        // After fast break, switch possession back
        this.switchPossession();
    }

    /**
     * Switch possession to other team
     */
    switchPossession() {
        this.possession = this.possession === 'home' ? 'away' : 'home';
        // Clear ball possession so next action picks a new player from new team
        this.court.ballPossession = null;
        
        // Reset all players to starting positions for new possession
        this.court.resetPositions(this.homeTeam, this.awayTeam);
    }

    /**
     * Run one complete quarter (25 rounds)
     */
    simulateQuarter() {
        const startRound = this.round;
        const roundsInQuarter = 25;

        for (let i = 0; i < roundsInQuarter; i++) {
            this.round++;
            this.simulateAction();
        }

        this.logEvent('quarter_end', `End of Quarter ${this.quarter}`, {
            homeScore: this.homeTeam.score,
            awayScore: this.awayTeam.score
        });
        
        // Narrate quarter end
        this.addNarration('quarterEnd', {
            quarter: this.quarter,
            homeTeam: this.homeTeam.name,
            homeScore: this.homeTeam.score,
            awayTeam: this.awayTeam.name,
            awayScore: this.awayTeam.score
        });
        
        // Check for close game or blowout
        const diff = Math.abs(this.homeTeam.score - this.awayTeam.score);
        if (diff <= 5) {
            this.addNarration('closeGame', { diff });
        } else if (diff >= 15) {
            const leadingTeam = this.homeTeam.score > this.awayTeam.score ? this.homeTeam.name : this.awayTeam.name;
            this.addNarration('blowout', { team: leadingTeam, diff });
        }

        this.quarter++;
    }

    /**
     * Run complete match (4 quarters = 100 rounds)
     */
    simulateMatch() {
        this.logEvent('match_start', 'Match started', {
            homeTeam: this.homeTeam.name,
            awayTeam: this.awayTeam.name
        });
        
        // Narrate match start
        this.addNarration('matchStart', {
            homeTeam: this.homeTeam.name,
            awayTeam: this.awayTeam.name
        });

        for (let q = 1; q <= 4; q++) {
            this.simulateQuarter();
        }

        this.logEvent('match_end', 'Match ended', {
            homeScore: this.homeTeam.score,
            awayScore: this.awayTeam.score,
            winner: this.getWinner() ? this.getWinner().name : 'TIE'
        });
        
        // Narrate match end
        const winner = this.getWinner();
        if (winner) {
            const loser = winner === this.homeTeam ? this.awayTeam : this.homeTeam;
            this.addNarration('matchEnd', {
                winnerTeam: winner.name,
                loserTeam: loser.name,
                winnerScore: winner.score,
                loserScore: loser.score
            });
        } else {
            this.addNarration('matchTie', { score: this.homeTeam.score });
        }

        return this.getMatchSummary();
    }

    /**
     * Get match winner
     */
    getWinner() {
        if (this.homeTeam.score > this.awayTeam.score) {
            return this.homeTeam;
        } else if (this.awayTeam.score > this.homeTeam.score) {
            return this.awayTeam;
        }
        return null; // Tie
    }

    /**
     * Get full match summary
     */
    getMatchSummary() {
        const winner = this.getWinner();
        const score = `${this.homeTeam.score}-${this.awayTeam.score}`;

        return {
            homeTeam: this.homeTeam.name,
            awayTeam: this.awayTeam.name,
            score,
            winner: winner ? winner.name : 'TIE',
            rounds: this.round,
            events: this.events,
            homeTeamStats: this.homeTeam.players.map(p => ({
                name: p.name,
                position: p.position,
                points: p.stats.pointsScored,
                assists: p.stats.assists,
                rebounds: p.stats.rebounds,
                steals: p.stats.steals
            })),
            awayTeamStats: this.awayTeam.players.map(p => ({
                name: p.name,
                position: p.position,
                points: p.stats.pointsScored,
                assists: p.stats.assists,
                rebounds: p.stats.rebounds,
                steals: p.stats.steals
            }))
        };
    }

    /**
     * Get match events formatted for narration
     */
    getEvents() {
        return this.events;
    }

    /**
     * Get current match state
     */
    getState() {
        return {
            round: this.round,
            quarter: this.quarter,
            possession: this.possession,
            homeScore: this.homeTeam.score,
            awayScore: this.awayTeam.score,
            courtState: this.court.getState(),
            lastEvents: this.events.slice(-5) // Last 5 events
        };
    }
}

// Export for ES modules
export { MatchEngine };
