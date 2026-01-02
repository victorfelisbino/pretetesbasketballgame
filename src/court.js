/**
 * Court Class
 * Represents the basketball court grid and player positions
 */
class Court {
    constructor(width = 50, height = 30) {
        this.width = width;
        this.height = height;
        this.grid = this.initializeGrid();
        this.ballPosition = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
        this.ballPossession = null; // Player with ball
    }

    /**
     * Initialize empty court grid
     */
    initializeGrid() {
        const grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(null); // null = empty space
            }
            grid.push(row);
        }
        return grid;
    }

    /**
     * Place player on court at specific position
     */
    placePlayer(player, x, y) {
        // Validate coordinates
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            throw new Error(`Invalid court position: (${x}, ${y})`);
        }

        // Remove player from previous position if exists
        if (player.x !== undefined && player.y !== undefined) {
            const prevX = Math.floor(player.x);
            const prevY = Math.floor(player.y);
            if (this.grid[prevY] && this.grid[prevY][prevX] === player) {
                this.grid[prevY][prevX] = null;
            }
        }

        // Place player at new position
        player.x = x;
        player.y = y;
        this.grid[Math.floor(y)][Math.floor(x)] = player;
    }

    /**
     * Set up initial team positions
     * Home team on left (offense), Away team on right (defense)
     */
    setupTeams(homeTeam, awayTeam) {
        const homeActive = homeTeam.getActivePlayersOnCourt();
        const awayActive = awayTeam.getActivePlayersOnCourt();

        // Home team starting positions (left side, attacking right)
        const homePositions = {
            'PG': { x: 5, y: 15 },   // Point Guard - left side
            'SG': { x: 10, y: 10 },  // Shooting Guard
            'SF': { x: 10, y: 20 },  // Small Forward
            'PF': { x: 20, y: 12 },  // Power Forward
            'C': { x: 20, y: 18 }    // Center
        };

        // Away team starting positions (right side, attacking left)
        const awayPositions = {
            'PG': { x: 45, y: 15 },  // Point Guard - right side
            'SG': { x: 40, y: 10 },  // Shooting Guard
            'SF': { x: 40, y: 20 },  // Small Forward
            'PF': { x: 30, y: 12 },  // Power Forward
            'C': { x: 30, y: 18 }    // Center
        };

        // Place home team
        homeActive.forEach(player => {
            const pos = homePositions[player.position] || { x: 10, y: 15 };
            this.placePlayer(player, pos.x, pos.y);
        });

        // Place away team
        awayActive.forEach(player => {
            const pos = awayPositions[player.position] || { x: 40, y: 15 };
            this.placePlayer(player, pos.x, pos.y);
        });

        // Give ball to home team PG
        const homePG = homeTeam.getPlayerByPosition('PG');
        if (homePG) {
            this.setBallPossession(homePG);
        }
    }

    /**
     * Set ball possession to player
     */
    setBallPossession(player) {
        this.ballPossession = player;
        if (player) {
            this.ballPosition = { x: player.x, y: player.y };
        }
    }

    /**
     * Move player towards target position
     * Movement speed depends on position (PG faster, C slower)
     */
    movePlayer(player, targetX, targetY) {
        const speedMap = {
            'PG': 10,  // Point Guard - fastest
            'SG': 8,   // Shooting Guard
            'SF': 7,   // Small Forward
            'PF': 6,   // Power Forward
            'C': 5     // Center - slowest
        };

        const speed = speedMap[player.position] || 7;
        const currentX = player.x;
        const currentY = player.y;

        // Calculate distance
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Don't move if already at target
        if (distance === 0) {
            return { x: currentX, y: currentY };
        }

        // Calculate new position (move towards target)
        const moveDistance = Math.min(distance, speed);
        const ratio = moveDistance / distance;
        
        let newX = currentX + (dx * ratio);
        let newY = currentY + (dy * ratio);

        // Clamp to court boundaries
        newX = Math.max(0, Math.min(this.width - 1, newX));
        newY = Math.max(0, Math.min(this.height - 1, newY));

        // Update position on grid
        this.placePlayer(player, newX, newY);

        // Update ball position if player has possession
        if (this.ballPossession === player) {
            this.ballPosition = { x: newX, y: newY };
        }

        return { x: newX, y: newY, distance: distance - moveDistance };
    }

    /**
     * Check if two players are adjacent (close enough for interaction)
     */
    areAdjacent(player1, player2, maxDistance = 3) {
        const dx = player1.x - player2.x;
        const dy = player1.y - player2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= maxDistance;
    }

    /**
     * Get players within range of a position
     */
    getPlayersInRange(x, y, range = 5) {
        const nearby = [];
        for (let row of this.grid) {
            for (let player of row) {
                if (player) {
                    const distance = Math.sqrt(
                        Math.pow(player.x - x, 2) + Math.pow(player.y - y, 2)
                    );
                    if (distance <= range) {
                        nearby.push({ player, distance });
                    }
                }
            }
        }
        return nearby.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Get nearest opponent to player
     */
    getNearestOpponent(player, opponentTeamPlayers) {
        let nearest = null;
        let minDistance = Infinity;

        for (let opponent of opponentTeamPlayers) {
            if (opponent.isActive) {
                const dx = opponent.x - player.x;
                const dy = opponent.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = opponent;
                }
            }
        }

        return nearest;
    }

    /**
     * Get all players in passing range
     */
    getPassingOptions(player, range = 15) {
        const teammates = [];
        for (let row of this.grid) {
            for (let candidate of row) {
                if (candidate && candidate !== player && candidate.isActive) {
                    const distance = Math.sqrt(
                        Math.pow(candidate.x - player.x, 2) + 
                        Math.pow(candidate.y - player.y, 2)
                    );
                    if (distance <= range && distance > 0) {
                        teammates.push({ player: candidate, distance });
                    }
                }
            }
        }
        return teammates.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Calculate shooting distance (distance to opponent basket)
     * Assumes home team shoots at right basket (x=49), away team at left (x=0)
     */
    getShootingDistance(player, isHomeTeam) {
        const basketX = isHomeTeam ? 49 : 0;
        const basketY = 15; // Center of basket
        
        const distance = Math.sqrt(
            Math.pow(basketX - player.x, 2) + 
            Math.pow(basketY - player.y, 2)
        );
        
        // Categorize distance
        if (distance <= 8) return 'close'; // 2-pointer range
        if (distance <= 15) return 'mid';  // Mid-range
        return 'three';                     // 3-pointer range
    }

    /**
     * Get court state as JSON (for logging/display)
     */
    getState() {
        const players = [];
        for (let row of this.grid) {
            for (let player of row) {
                if (player) {
                    players.push({
                        name: player.name,
                        position: player.position,
                        x: Math.round(player.x * 10) / 10,
                        y: Math.round(player.y * 10) / 10,
                        hasBall: this.ballPossession === player
                    });
                }
            }
        }

        return {
            width: this.width,
            height: this.height,
            ballPosition: { 
                x: Math.round(this.ballPosition.x * 10) / 10,
                y: Math.round(this.ballPosition.y * 10) / 10
            },
            ballPossession: this.ballPossession ? this.ballPossession.name : null,
            players
        };
    }

    /**
     * Clear court (reset for new match)
     */
    reset() {
        this.grid = this.initializeGrid();
        this.ballPosition = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
        this.ballPossession = null;
    }
}

// Export for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Court;
}
