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
            shots2pt: { made: 0, attempted: 0 },
            shots3pt: { made: 0, attempted: 0 }
        };

        // Game state
        this.foulCount = 0;
        this.isActive = true;
        this.x = 0;
        this.y = 0;
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
