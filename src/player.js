/**
 * Player Class
 * Represents individual basketball players
 */
class Player {
    constructor(name, position, skillLevel = 3) {
        this.name = name;
        this.position = position; // PG, SG, SF, PF, C
        this.skillLevel = Math.min(5, Math.max(1, skillLevel)); // 1-5
        
        // Statistics
        this.stats = {
            pointsScored: 0,
            assists: 0,
            rebounds: 0,
            steals: 0,
            blocks: 0,
            fouls: 0,
            freethrows: 0,
            freethrowsMade: 0,
            shots2pt: { made: 0, attempted: 0 },
            shots3pt: { made: 0, attempted: 0 }
        };

        // Game state
        this.foulCount = 0;
        this.isActive = true;
        this.x = 0;
        this.y = 0;

        // Free throw attribute (1-99 scale, position-appropriate default)
        // PG/SG: good FT shooters (70-82), SF: moderate (60-75), PF: lower (50-70), C: lowest (40-60)
        const ftRanges = { PG: [72, 82], SG: [70, 80], SF: [60, 75], PF: [50, 70], C: [40, 60] };
        const ftRange = ftRanges[this.position] || [50, 70];
        this.freeThrow = Math.floor(Math.random() * (ftRange[1] - ftRange[0] + 1)) + ftRange[0];
    }

    /**
     * Get skill level name
     */
    getSkillLevelName() {
        if (this.skillLevel <= 2) return 'Ruim';
        if (this.skillLevel <= 4) return 'Médio';
        return 'Bom';
    }

    /**
     * Add points to player
     */
    addPoints(points) {
        this.stats.pointsScored += points;
    }

    /**
     * Add assist
     */
    addAssist() {
        this.stats.assists++;
    }

    /**
     * Add rebound
     */
    addRebound() {
        this.stats.rebounds++;
    }

    /**
     * Add steal
     */
    addSteal() {
        this.stats.steals++;
    }

    /**
     * Add block
     */
    addBlock() {
        this.stats.blocks++;
    }

    /**
     * Add foul
     */
    addFoul() {
        this.foulCount++;
        this.stats.fouls++;

        // Player fouls out after 5 fouls
        if (this.foulCount >= 5) {
            this.isActive = false;
        }
    }

    /**
     * Add a personal foul committed (NBA rule: foul-out at 6)
     * Used by the Fouls + Free Throws system.
     * Increments foulCount and stats.fouls, then disqualifies the player at 6 fouls.
     */
    addFoulCommitted() {
        this.foulCount++;
        this.stats.fouls++;

        if (this.foulCount >= 6) {
            this.isActive = false;
        }
    }

    /**
     * Check whether this player has fouled out (>= 6 fouls committed, NBA rule)
     * @returns {boolean} true if the player is disqualified
     */
    isFouledOut() {
        return this.foulCount >= 6;
    }

    /**
     * Get free-throw success percentage for this player.
     * The freeThrow attribute (1–99) is treated directly as a success percentage,
     * so a player with freeThrow=75 makes 75 % of their free throws.
     * @returns {number} Success percentage (0–99)
     */
    getFreeThrowSuccessPercent() {
        return this.freeThrow || 70;
    }

    /**
     * Record 2-point attempt
     */
    attempt2Pointer(successful) {
        this.stats.shots2pt.attempted++;
        if (successful) {
            this.stats.shots2pt.made++;
            this.addPoints(2);
        }
    }

    /**
     * Record 3-point attempt
     */
    attempt3Pointer(successful) {
        this.stats.shots3pt.attempted++;
        if (successful) {
            this.stats.shots3pt.made++;
            this.addPoints(3);
        }
    }

    /**
     * Record free throw attempt
     */
    attemptFreeThrow(successful) {
        this.stats.freethrows++;
        if (successful) {
            this.stats.freethrowsMade++;
            this.addPoints(1);
        }
    }

    /**
     * Get shooting percentage for 2-pointers
     */
    get2PointPercentage() {
        if (this.stats.shots2pt.attempted === 0) return 0;
        return (this.stats.shots2pt.made / this.stats.shots2pt.attempted * 100).toFixed(1);
    }

    /**
     * Get shooting percentage for 3-pointers
     */
    get3PointPercentage() {
        if (this.stats.shots3pt.attempted === 0) return 0;
        return (this.stats.shots3pt.made / this.stats.shots3pt.attempted * 100).toFixed(1);
    }

    /**
     * Get player summary for display
     */
    getSummary() {
        return {
            name: this.name,
            position: this.position,
            skillLevel: this.getSkillLevelName(),
            skillValue: this.skillLevel,
            points: this.stats.pointsScored,
            assists: this.stats.assists,
            rebounds: this.stats.rebounds,
            steals: this.stats.steals,
            blocks: this.stats.blocks,
            fouls: this.stats.fouls,
            freeThrowAttr: this.freeThrow,
            freethrowsAttempted: this.stats.freethrows,
            freethrowsMade: this.stats.freethrowsMade,
            isActive: this.isActive,
            foulCount: this.foulCount
        };
    }

    /**
     * Reset player stats for new game
     */
    resetStats() {
        this.stats = {
            pointsScored: 0,
            assists: 0,
            rebounds: 0,
            steals: 0,
            blocks: 0,
            fouls: 0,
            freethrows: 0,
            freethrowsMade: 0,
            shots2pt: { made: 0, attempted: 0 },
            shots3pt: { made: 0, attempted: 0 }
        };
        this.foulCount = 0;
        this.isActive = true;
    }

    /**
     * Create a random player
     */
    static createRandom(index) {
        const names = [
            'Player A', 'Player B', 'Player C', 'Player D', 'Player E',
            'Player F', 'Player G', 'Player H', 'Player I', 'Player J'
        ];
        
        const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
        
        const name = names[index] || `Player ${index}`;
        const position = positions[index % 5];
        const skill = Math.floor(Math.random() * 5) + 1; // 1-5
        
        return new Player(name, position, skill);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}
