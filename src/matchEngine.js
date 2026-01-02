/**
 * Match Engine
 * Core game simulation loop - runs the basketball match
 */
class MatchEngine {
    constructor(homeTeam, awayTeam) {
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
        
        // Initialize court with teams
        this.court.setupTeams(homeTeam, awayTeam);
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

        // Get player with ball
        let ballCarrier = this.court.ballPossession;
        if (!ballCarrier || ballCarrier.isActive === false) {
            // Find PG or random player
            ballCarrier = possessionTeam.getPlayerByPosition('PG') || this.getRandomPlayer(possessionTeam);
            if (!ballCarrier) return false;
            this.court.setBallPossession(ballCarrier);
        }

        // Check for steal attempt
        const defender = this.court.getNearestOpponent(ballCarrier, defendingTeam.getActivePlayers());
        if (defender && this.court.areAdjacent(ballCarrier, defender, 2)) {
            const stealSuccess = this.simulateDribbleContest(ballCarrier, defender);
            
            if (stealSuccess === false) {
                // Turnover!
                this.logEvent('turnover', `${defender.name} steals from ${ballCarrier.name}!`);
                this.court.setBallPossession(defender);
                this.switchPossession();
                return false;
            }
        }

        // Move towards basket
        const targetBasketX = isHome ? 49 : 0;
        const targetBasketY = 15;
        this.court.movePlayer(ballCarrier, targetBasketX, targetBasketY);

        // Check shooting distance
        const shootDistance = this.court.getShootingDistance(ballCarrier, isHome);

        // Decide action: pass, dribble, or shoot
        const random = Math.random();
        
        if (shootDistance === 'close' && random > 0.3) {
            // Shoot 2-pointer
            return this.simulateShot(ballCarrier, '2pt', isHome);
        } else if (shootDistance === 'three' && random > 0.5) {
            // Shoot 3-pointer
            return this.simulateShot(ballCarrier, '3pt', isHome);
        } else if (random > 0.6) {
            // Try to pass
            const targets = this.court.getPassingOptions(ballCarrier, 15);
            if (targets.length > 0) {
                const receiver = targets[0].player;
                this.logEvent('pass', `${ballCarrier.name} passes to ${receiver.name}`);
                this.court.setBallPossession(receiver);
                ballCarrier.addAssist();
                return true;
            }
        }

        // Dribble (default action)
        this.logEvent('dribble', `${ballCarrier.name} dribbles the ball`);
        return true;
    }

    /**
     * Simulate dribble vs steal contest (d20 system)
     * Returns true if dribble wins, false if steal wins
     */
    simulateDribbleContest(ballCarrier, defender) {
        // Get dribble and steal attributes (based on skill level)
        const dribbleSkill = ballCarrier.skillLevel * 2 + DiceRoller.rollDie(4);
        const stealSkill = defender.skillLevel * 2 + DiceRoller.rollDie(4);

        // Roll d20
        const roll = DiceRoller.rollDie(20);
        const threshold = 20 - (dribbleSkill - stealSkill);

        const success = roll >= threshold;

        this.logEvent('dribble_contest', 
            `${ballCarrier.name} (dribble ${dribbleSkill}) vs ${defender.name} (steal ${stealSkill})`,
            {
                roll,
                threshold,
                dribbleSkill,
                stealSkill,
                success
            }
        );

        return success;
    }

    /**
     * Simulate shot attempt
     * Returns true if score, false if miss/turnover
     */
    simulateShot(shooter, shotType, isHome) {
        const diceMap = {
            '2pt': {
                'PG': { q: 1, s: 4 },
                'SG': { q: 1, s: 6 },
                'SF': { q: 1, s: 6 },
                'PF': { q: 1, s: 8 },
                'C': { q: 2, s: 6 }
            },
            '3pt': {
                'PG': { q: 1, s: 3 },
                'SG': { q: 1, s: 6 },
                'SF': { q: 1, s: 6 },
                'PF': { q: 1, s: 4 },
                'C': { q: 1, s: 3 }
            }
        };

        const dice = diceMap[shotType][shooter.position];
        const roll = DiceRoller.rollMultiple(dice.q, dice.s);
        
        // Skill modifier (higher skill = better shooting)
        const successThreshold = shooter.skillLevel * 2;
        const success = roll.total >= successThreshold;

        if (success) {
            const points = shotType === '2pt' ? 2 : 3;
            shooter.addPoints(points);
            
            if (isHome) {
                this.homeTeam.score += points;
            } else {
                this.awayTeam.score += points;
            }

            this.logEvent('shot_made', 
                `${shooter.name} makes a ${shotType}! (+${points})`,
                { shotType, points, roll: roll.total }
            );

            // Switch possession after score
            this.switchPossession();
            return true;
        } else {
            this.logEvent('shot_missed', 
                `${shooter.name} misses the ${shotType}`,
                { shotType, roll: roll.total }
            );

            // Rebound attempt
            return this.simulateRebound(shooter);
        }
    }

    /**
     * Simulate rebound after missed shot
     */
    simulateRebound(shooter) {
        const defendingTeam = this.getDefendingTeam();
        const isHome = this.possession === 'home';
        
        // Get closest defender for rebound
        const defenders = defendingTeam.getActivePlayers();
        let bestRebounder = defenders[0];
        let bestDistance = Infinity;

        for (let defender of defenders) {
            const dist = Math.sqrt(
                Math.pow(defender.x - shooter.x, 2) + 
                Math.pow(defender.y - shooter.y, 2)
            );
            if (dist < bestDistance) {
                bestDistance = dist;
                bestRebounder = defender;
            }
        }

        // Roll rebound dice
        const diceMap = {
            'PG': { q: 1, s: 4 },
            'SG': { q: 1, s: 4 },
            'SF': { q: 1, s: 6 },
            'PF': { q: 2, s: 6 },
            'C': { q: 3, s: 6 }
        };

        const shooterDice = diceMap[shooter.position];
        const rebounderDice = diceMap[bestRebounder.position];

        const shooterRoll = DiceRoller.rollMultiple(shooterDice.q, shooterDice.s);
        const rebounderRoll = DiceRoller.rollMultiple(rebounderDice.q, rebounderDice.s);

        if (rebounderRoll.total > shooterRoll.total) {
            // Turnover - defending team gets ball
            this.logEvent('rebound', 
                `${bestRebounder.name} grabs the rebound!`,
                { shooterRoll: shooterRoll.total, rebounderRoll: rebounderRoll.total }
            );
            
            this.court.setBallPossession(bestRebounder);
            this.switchPossession();
            return false;
        } else {
            // Offensive rebound
            this.logEvent('offensive_rebound',
                `${shooter.name} gets the offensive rebound!`,
                { shooterRoll: shooterRoll.total, rebounderRoll: rebounderRoll.total }
            );
            
            this.court.setBallPossession(shooter);
            return true;
        }
    }

    /**
     * Switch possession to other team
     */
    switchPossession() {
        this.possession = this.possession === 'home' ? 'away' : 'home';
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

        for (let q = 1; q <= 4; q++) {
            this.simulateQuarter();
        }

        this.logEvent('match_end', 'Match ended', {
            homeScore: this.homeTeam.score,
            awayScore: this.awayTeam.score,
            winner: this.getWinner().name
        });

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

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MatchEngine;
}
