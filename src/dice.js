/**
 * Dice Roller Engine
 * Handles all dice rolling mechanics for the basketball game
 */
class DiceRoller {
    /**
     * Roll a single die with specified sides
     * @param {number} sides - Number of sides on the die
     * @returns {number} Random number between 1 and sides
     */
    static rollDie(sides = 6) {
        return Math.floor(Math.random() * sides) + 1;
    }

    /**
     * Roll multiple dice
     * @param {number} quantity - Number of dice to roll
     * @param {number} sides - Sides per die
     * @returns {Object} { rolls: [], total: number }
     */
    static rollMultiple(quantity, sides) {
        const rolls = [];
        let total = 0;
        
        for (let i = 0; i < quantity; i++) {
            const roll = this.rollDie(sides);
            rolls.push(roll);
            total += roll;
        }
        
        return {
            rolls,
            total,
            notation: `${quantity}d${sides}`
        };
    }

    /**
     * Parse dice notation and roll
     * @param {string} notation - Notation like "1d6", "2d8", etc.
     * @returns {Object} Roll result with details
     */
    static rollNotation(notation) {
        const match = notation.match(/^(\d+)d(\d+)$/i);
        
        if (!match) {
            throw new Error(`Invalid dice notation: ${notation}`);
        }
        
        const quantity = parseInt(match[1]);
        const sides = parseInt(match[2]);
        
        return this.rollMultiple(quantity, sides);
    }

    /**
     * Evaluate multiple dice expressions
     * @param {Array<string>} notations - Array of dice notations
     * @returns {Object} Combined roll results
     */
    static rollMultipleExpressions(notations) {
        const results = [];
        let totalSum = 0;

        notations.forEach(notation => {
            const result = this.rollNotation(notation);
            results.push(result);
            totalSum += result.total;
        });

        return {
            results,
            totalSum,
            expressions: notations
        };
    }

    /**
     * Roll for action with skill level modifier
     * @param {string} actionType - Type of action (e.g., "2point", "3point")
     * @param {string} skillLevel - Skill level: "Ruim", "Médio", "Bom"
     * @returns {Object} Action roll result
     */
    static rollAction(actionType, skillLevel) {
        const actionDice = {
            '2point': '1d6',
            '3point': '1d8',
            'assist': '1d6',
            'rebound': '2d6',
            'steal': '1d4',
            'freethrow': '1d4',
            'block': '1d6',
            'foul': '1d3'
        };

        const dice = actionDice[actionType] || '1d6';
        const roll = this.rollNotation(dice);

        // Apply skill modifier
        const modifier = this.getSkillModifier(skillLevel);
        const modifiedTotal = Math.max(1, roll.total + modifier);

        return {
            ...roll,
            skillLevel,
            modifier,
            modifiedTotal,
            actionType
        };
    }

    /**
     * Get modifier based on skill level
     * @param {string} skillLevel - "Ruim", "Médio", "Bom"
     * @returns {number} Modifier value
     */
    static getSkillModifier(skillLevel) {
        const modifiers = {
            'Ruim': -2,
            'Médio': 0,
            'Bom': +2
        };
        return modifiers[skillLevel] || 0;
    }

    /**
     * Calculate success percentage based on attack vs defense
     * @param {number} attackSkill - Attack skill value (1-5)
     * @param {number} defenseSkill - Defense skill value (1-5)
     * @returns {Object} Success calculation details
     */
    static calculateSuccessPercentage(attackSkill, defenseSkill) {
        let percentage = 50; // Base percentage

        if (attackSkill > defenseSkill) {
            // Situation 1: A > B
            // Formula: 100 - (2*B - A)/2
            percentage = Math.min(100, 100 - ((2 * defenseSkill - attackSkill) / 2));
        } else if (attackSkill < defenseSkill) {
            // Situation 2: A < B
            // Formula: (2*A - B)/2
            percentage = Math.max(0, (2 * attackSkill - defenseSkill) / 2);
        } else {
            // Situation 3: A = B
            // 50% chance
            percentage = 50;
        }

        // Clamp to 0-100
        percentage = Math.max(0, Math.min(100, percentage));

        return {
            attackSkill,
            defenseSkill,
            percentage: Math.round(percentage),
            formula: attackSkill > defenseSkill 
                ? '100 - (2*B - A)/2'
                : attackSkill < defenseSkill
                ? '(2*A - B)/2'
                : '50%',
            result: Math.random() * 100 < percentage
        };
    }

    /**
     * Resolve an action attempt
     * @param {number} attackerSkill - Attacker skill level (1-5)
     * @param {number} defenderSkill - Defender skill level (1-5)
     * @param {string} actionType - Type of action
     * @returns {Object} Complete action result
     */
    static resolveAction(attackerSkill, defenderSkill, actionType) {
        const skillLevelMap = {
            1: 'Ruim',
            2: 'Ruim',
            3: 'Médio',
            4: 'Bom',
            5: 'Bom'
        };

        const attackerLevel = skillLevelMap[attackerSkill];
        const roll = this.rollAction(actionType, attackerLevel);
        const success = this.calculateSuccessPercentage(attackerSkill, defenderSkill);

        return {
            ...roll,
            ...success,
            success: success.result,
            timestamp: new Date()
        };
    }

    /**
     * Get all available action types with their dice requirements
     * @returns {Object} Action types and their dice
     */
    static getAvailableActions() {
        return {
            '2point': { name: '2-Point Shot', dice: '1d6' },
            '3point': { name: '3-Point Shot', dice: '1d8' },
            'assist': { name: 'Assist', dice: '1d6' },
            'rebound': { name: 'Rebound', dice: '2d6' },
            'steal': { name: 'Steal', dice: '1d4' },
            'freethrow': { name: 'Free Throw', dice: '1d4' },
            'block': { name: 'Block', dice: '1d6' },
            'foul': { name: 'Foul', dice: '1d3' }
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiceRoller;
}
