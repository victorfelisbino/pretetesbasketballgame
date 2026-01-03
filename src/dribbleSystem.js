/**
 * Dribble System
 * Handles d20-based dribble vs steal/marking contests
 * 
 * Formula: threshold = 20 - (DRIBBLE - STEAL_MARKING)
 * Roll d20: roll >= threshold = success (advance with ball)
 *           roll < threshold = failure (turnover)
 */

class DribbleSystem {
    /**
     * Roll a d20
     * @returns {number} Result 1-20
     */
    static rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    }

    /**
     * Calculate the success threshold for a dribble attempt
     * Lower threshold = easier to succeed
     * 
     * @param {number} dribbleSkill - Dribbler's dribble attribute (1-20, higher is better)
     * @param {number} stealSkill - Defender's steal/marking attribute (1-20, higher is better)
     * @returns {number} Threshold needed to succeed (roll >= this)
     */
    static calculateThreshold(dribbleSkill, stealSkill) {
        const difference = dribbleSkill - stealSkill;
        const threshold = 20 - difference;
        
        // Clamp threshold to 1-21 (21 = impossible, 1 = almost guaranteed)
        return Math.max(1, Math.min(21, threshold));
    }

    /**
     * Calculate success percentage for a dribble attempt
     * @param {number} dribbleSkill - Dribbler's skill (1-20)
     * @param {number} stealSkill - Defender's skill (1-20)
     * @returns {number} Success percentage (0-100)
     */
    static calculateSuccessPercent(dribbleSkill, stealSkill) {
        const threshold = this.calculateThreshold(dribbleSkill, stealSkill);
        
        if (threshold > 20) return 0;  // Impossible
        if (threshold <= 1) return 100; // Guaranteed (natural 1 still succeeds)
        
        // Chance = (21 - threshold) / 20 * 100
        // e.g., threshold 6 = 15/20 = 75% (rolls 6-20 succeed)
        const successRolls = 21 - threshold;
        return (successRolls / 20) * 100;
    }

    /**
     * Resolve a dribble contest
     * @param {Object} dribbler - Player with ball { dribbling, name }
     * @param {Object} defender - Defending player { stealing, marking, name }
     * @returns {Object} Contest result
     */
    static resolveDribbleContest(dribbler, defender) {
        // Get skill values (support both flat and nested skills)
        const dribbleSkill = dribbler.dribbling || dribbler.skills?.dribbling || 10;
        const stealSkill = defender.stealing || defender.marking || 
                          defender.skills?.stealing || defender.skills?.marking || 10;

        const threshold = this.calculateThreshold(dribbleSkill, stealSkill);
        const roll = this.rollD20();
        const success = roll >= threshold;
        const successPercent = this.calculateSuccessPercent(dribbleSkill, stealSkill);

        return {
            success,
            roll,
            threshold,
            successPercent,
            dribbler: dribbler.name || 'Dribbler',
            defender: defender.name || 'Defender',
            dribbleSkill,
            stealSkill,
            outcome: success ? 'advance' : 'turnover',
            description: success 
                ? `${dribbler.name || 'Dribbler'} beats ${defender.name || 'Defender'} with the dribble!`
                : `${defender.name || 'Defender'} steals from ${dribbler.name || 'Dribbler'}!`
        };
    }

    /**
     * Resolve a dribble move (advancing with ball)
     * @param {Object} dribbler - Player with ball
     * @param {Object} defender - Closest defender
     * @param {number} distance - Squares to move
     * @returns {Object} Move result with final position
     */
    static resolveDribbleMove(dribbler, defender, distance = 1) {
        const contest = this.resolveDribbleContest(dribbler, defender);
        
        if (contest.success) {
            return {
                ...contest,
                squaresMoved: distance,
                newX: (dribbler.x || 0) + distance,
                newY: dribbler.y || 0
            };
        } else {
            return {
                ...contest,
                squaresMoved: 0,
                ballLost: true,
                newPossession: defender.name
            };
        }
    }

    /**
     * Check if a dribble attempt is safe (high success chance)
     * Useful for AI decision making
     * @param {Object} dribbler - Player with ball
     * @param {Object} defender - Defender
     * @param {number} safetyThreshold - Minimum success % to consider safe (default 60%)
     * @returns {boolean} Whether attempt is considered safe
     */
    static isSafeDribble(dribbler, defender, safetyThreshold = 60) {
        const dribbleSkill = dribbler.dribbling || dribbler.skills?.dribbling || 10;
        const stealSkill = defender.stealing || defender.marking || 
                          defender.skills?.stealing || 10;
        
        const successPercent = this.calculateSuccessPercent(dribbleSkill, stealSkill);
        return successPercent >= safetyThreshold;
    }

    /**
     * Get difficulty rating for a dribble attempt
     * @param {number} dribbleSkill - Dribbler's skill
     * @param {number} stealSkill - Defender's skill
     * @returns {string} Difficulty rating
     */
    static getDifficultyRating(dribbleSkill, stealSkill) {
        const successPercent = this.calculateSuccessPercent(dribbleSkill, stealSkill);
        
        if (successPercent >= 80) return 'Easy';
        if (successPercent >= 60) return 'Moderate';
        if (successPercent >= 40) return 'Challenging';
        if (successPercent >= 20) return 'Difficult';
        return 'Dangerous';
    }
}

// Export for ES modules
export { DribbleSystem };
