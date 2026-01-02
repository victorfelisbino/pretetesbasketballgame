/**
 * Team Class
 * Represents a basketball team with multiple players
 */
class Team {
    constructor(name, players = []) {
        this.name = name;
        this.players = players;
        this.score = 0;
        this.quarter = 1;
    }

    /**
     * Add player to team
     */
    addPlayer(player) {
        if (this.players.length < 12) { // Max 12 players on roster
            this.players.push(player);
        }
    }

    /**
     * Get active players on court (first 5)
     */
    getActivePlayersOnCourt() {
        return this.players.filter((p, i) => p.isActive && i < 5);
    }

    /**
     * Get all active players
     */
    getActivePlayers() {
        return this.players.filter(p => p.isActive);
    }

    /**
     * Get player by name
     */
    getPlayerByName(name) {
        return this.players.find(p => p.name === name);
    }

    /**
     * Get player by position
     */
    getPlayerByPosition(position) {
        return this.players.find(p => p.position === position && p.isActive);
    }

    /**
     * Get random active player
     */
    getRandomActivePlayer() {
        const active = this.getActivePlayers();
        if (active.length === 0) return null;
        return active[Math.floor(Math.random() * active.length)];
    }

    /**
     * Add points to team
     */
    addPoints(points) {
        this.score += points;
    }

    /**
     * Get team score
     */
    getScore() {
        return this.score;
    }

    /**
     * Get team statistics
     */
    getTeamStats() {
        const totalStats = {
            totalPoints: this.score,
            totalAssists: 0,
            totalRebounds: 0,
            totalSteals: 0,
            totalBlocks: 0,
            totalFouls: 0,
            shots2pt: { made: 0, attempted: 0 },
            shots3pt: { made: 0, attempted: 0 }
        };

        this.players.forEach(player => {
            totalStats.totalAssists += player.stats.assists;
            totalStats.totalRebounds += player.stats.rebounds;
            totalStats.totalSteals += player.stats.steals;
            totalStats.totalBlocks += player.stats.blocks;
            totalStats.totalFouls += player.stats.fouls;
            totalStats.shots2pt.made += player.stats.shots2pt.made;
            totalStats.shots2pt.attempted += player.stats.shots2pt.attempted;
            totalStats.shots3pt.made += player.stats.shots3pt.made;
            totalStats.shots3pt.attempted += player.stats.shots3pt.attempted;
        });

        return totalStats;
    }

    /**
     * Get team shooting percentage
     */
    getShootingPercentage() {
        const stats = this.getTeamStats();
        const totalAttempts = stats.shots2pt.attempted + stats.shots3pt.attempted;
        if (totalAttempts === 0) return 0;
        
        const totalMade = stats.shots2pt.made + stats.shots3pt.made;
        return (totalMade / totalAttempts * 100).toFixed(1);
    }

    /**
     * Reset team for new game
     */
    reset() {
        this.score = 0;
        this.quarter = 1;
        this.players.forEach(p => p.resetStats());
    }

    /**
     * Get player summaries
     */
    getPlayerSummaries() {
        return this.players.map(p => p.getSummary());
    }

    /**
     * Create team with random players
     */
    static createWithRandomPlayers(name, playerCount = 5) {
        const players = [];
        for (let i = 0; i < playerCount; i++) {
            players.push(Player.createRandom(i));
        }
        return new Team(name, players);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Team;
}
