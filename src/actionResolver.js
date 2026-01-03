/**
 * Action Resolver
 * Handles all action outcomes with position-based dice rolls
 * Uses the attack vs defense formula for success calculations
 */

/**
 * Position-based dice tables for each action type
 */
const POSITION_DICE = {
    '2point': {
        C: '2d6',
        PF: '1d8',
        SF: '1d4',
        SG: '1d4',
        PG: '1d4'
    },
    '3point': {
        SG: '1d6',
        SF: '1d6',
        PG: '1d3',
        PF: null,  // Can't shoot 3s
        C: null    // Can't shoot 3s
    },
    rebound: {
        C: '3d6',
        PF: '2d6',
        SF: '1d6',
        SG: null,  // Rarely rebounds
        PG: null   // Rarely rebounds
    },
    assist: {
        PG: '1d10',
        SG: '1d6',
        SF: null,
        PF: null,
        C: null
    },
    steal: {
        PG: '1d4+1d6',
        SG: '1d2+1d3',
        SF: null,
        PF: null,
        C: null
    },
    block: {
        C: '1d8+1d10',
        PF: '1d4+1d5',
        SF: null,
        SG: null,
        PG: null
    }
};

/**
 * Action Resolver Class
 */
class ActionResolver {
    /**
     * Roll a single die
     * @param {number} sides - Number of sides
     * @returns {number} Roll result
     */
    static rollDie(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    /**
     * Parse and roll dice notation (e.g., "2d6", "1d4+1d6")
     * @param {string} notation - Dice notation
     * @returns {Object} { rolls: [], total: number, notation: string }
     */
    static rollDice(notation) {
        if (!notation) {
            return { rolls: [], total: 0, notation: 'none', canPerform: false };
        }

        const parts = notation.split('+');
        const allRolls = [];
        let total = 0;

        for (const part of parts) {
            const match = part.trim().match(/^(\d+)d(\d+)$/i);
            if (match) {
                const quantity = parseInt(match[1]);
                const sides = parseInt(match[2]);
                
                for (let i = 0; i < quantity; i++) {
                    const roll = this.rollDie(sides);
                    allRolls.push(roll);
                    total += roll;
                }
            }
        }

        return {
            rolls: allRolls,
            total,
            notation,
            canPerform: true
        };
    }

    /**
     * Calculate success percentage based on attack vs defense
     * Uses YOUR formula - DO NOT CHANGE
     * @param {number} attackSkill - Attacker skill (1-99)
     * @param {number} defenseSkill - Defender skill (1-99)
     * @returns {number} Success percentage (0-100)
     */
    static calculateSuccessPercentage(attackSkill, defenseSkill) {
        let percentage;

        if (attackSkill > defenseSkill) {
            // Formula: 100 - (2*B - A) / 2
            percentage = 100 - ((2 * defenseSkill - attackSkill) / 2);
        } else if (attackSkill < defenseSkill) {
            // Formula: (2*A - B) / 2
            percentage = (2 * attackSkill - defenseSkill) / 2;
        } else {
            // Equal skills = 50%
            percentage = 50;
        }

        // Clamp to 0-100
        return Math.max(0, Math.min(100, percentage));
    }

    /**
     * Check if an action succeeds based on success percentage
     * @param {number} successPercent - Success percentage
     * @returns {boolean} Whether the action succeeded
     */
    static checkSuccess(successPercent) {
        const roll = Math.random() * 100;
        return roll < successPercent;
    }

    /**
     * Get dice notation for a position and action type
     * @param {string} actionType - Type of action
     * @param {string} position - Player position (PG, SG, SF, PF, C)
     * @returns {string|null} Dice notation or null if can't perform
     */
    static getDiceForAction(actionType, position) {
        const actionDice = POSITION_DICE[actionType];
        if (!actionDice) return null;
        return actionDice[position] || null;
    }

    /**
     * Roll for a specific action based on position
     * @param {string} actionType - Type of action
     * @param {string} position - Player position
     * @returns {Object} Roll result with canPerform flag
     */
    static rollForAction(actionType, position) {
        const dice = this.getDiceForAction(actionType, position);
        
        if (!dice) {
            return {
                rolls: [],
                total: 0,
                notation: 'none',
                canPerform: false,
                reason: `${position} cannot perform ${actionType}`
            };
        }

        const result = this.rollDice(dice);
        result.actionType = actionType;
        result.position = position;
        return result;
    }

    /**
     * Resolve a 2-point shot attempt
     * @param {Object} shooter - Shooting player { position, shooting, name }
     * @param {Object} defender - Defending player { defense, blocking, name }
     * @returns {Object} Shot result
     */
    static resolve2PointerAttempt(shooter, defender) {
        const position = shooter.position || 'SF';
        const diceResult = this.rollForAction('2point', position);

        if (!diceResult.canPerform) {
            return {
                success: false,
                made: false,
                points: 0,
                blocked: false,
                reason: diceResult.reason,
                diceResult
            };
        }

        // Calculate success based on shooting vs defense
        const shootingSkill = shooter.shooting || shooter.skills?.shooting || 50;
        const defenseSkill = defender.defense || defender.skills?.defense || 50;
        const successPercent = this.calculateSuccessPercentage(shootingSkill, defenseSkill);
        
        // Check for block first (defender's blocking skill)
        const blockingSkill = defender.blocking || defender.skills?.blocking || 30;
        const blockChance = Math.min(25, blockingSkill / 4); // Max 25% block chance
        const blocked = Math.random() * 100 < blockChance;

        if (blocked) {
            return {
                success: false,
                made: false,
                points: 0,
                blocked: true,
                blocker: defender.name || 'Defender',
                successPercent,
                diceResult
            };
        }

        // Check if shot is made
        const made = this.checkSuccess(successPercent);

        return {
            success: true,
            made,
            points: made ? 2 : 0,
            blocked: false,
            shooter: shooter.name || 'Shooter',
            successPercent,
            diceResult
        };
    }

    /**
     * Resolve a 3-point shot attempt
     * @param {Object} shooter - Shooting player { position, shooting3pt, name }
     * @param {Object} defender - Defending player { perimeterDefense, name }
     * @returns {Object} Shot result
     */
    static resolve3PointerAttempt(shooter, defender) {
        const position = shooter.position || 'SG';
        const diceResult = this.rollForAction('3point', position);

        if (!diceResult.canPerform) {
            return {
                success: false,
                made: false,
                points: 0,
                blocked: false,
                reason: `${position} cannot shoot 3-pointers`,
                diceResult
            };
        }

        // Calculate success based on 3pt shooting vs perimeter defense
        const shooting3pt = shooter.shooting3pt || shooter.skills?.shooting3pt || 40;
        const perimeterDef = defender.perimeterDefense || defender.skills?.perimeterDefense || 50;
        const successPercent = this.calculateSuccessPercentage(shooting3pt, perimeterDef);

        // 3-pointers are harder to block (max 10%)
        const blockingSkill = defender.blocking || defender.skills?.blocking || 30;
        const blockChance = Math.min(10, blockingSkill / 10);
        const blocked = Math.random() * 100 < blockChance;

        if (blocked) {
            return {
                success: false,
                made: false,
                points: 0,
                blocked: true,
                blocker: defender.name || 'Defender',
                successPercent,
                diceResult
            };
        }

        // Check if shot is made
        const made = this.checkSuccess(successPercent);

        return {
            success: true,
            made,
            points: made ? 3 : 0,
            blocked: false,
            shooter: shooter.name || 'Shooter',
            successPercent,
            diceResult
        };
    }

    /**
     * Resolve a rebound contest between offensive and defensive players
     * @param {Object} offensePlayer - Offensive rebounder { position, rebounding, name }
     * @param {Object} defensePlayer - Defensive rebounder { position, rebounding, name }
     * @returns {Object} Rebound result
     */
    static resolveReboundContest(offensePlayer, defensePlayer) {
        const offPosition = offensePlayer.position || 'PF';
        const defPosition = defensePlayer.position || 'C';

        const offDiceResult = this.rollForAction('rebound', offPosition);
        const defDiceResult = this.rollForAction('rebound', defPosition);

        // Get rebounding skills
        const offRebounding = offensePlayer.rebounding || offensePlayer.skills?.rebounding || 50;
        const defRebounding = defensePlayer.rebounding || defensePlayer.skills?.rebounding || 60;

        // Base roll totals
        let offTotal = offDiceResult.canPerform ? offDiceResult.total : 0;
        let defTotal = defDiceResult.canPerform ? defDiceResult.total : 0;

        // Add skill bonus (skill / 10)
        offTotal += Math.floor(offRebounding / 10);
        defTotal += Math.floor(defRebounding / 10);

        // Defensive rebounding has natural advantage (+2)
        defTotal += 2;

        // Determine winner
        const defenseWins = defTotal >= offTotal;

        return {
            winner: defenseWins ? 'defense' : 'offense',
            winnerPlayer: defenseWins ? defensePlayer.name : offensePlayer.name,
            type: defenseWins ? 'defensive' : 'offensive',
            offenseRoll: offDiceResult,
            defenseRoll: defDiceResult,
            offenseTotal: offTotal,
            defenseTotal: defTotal
        };
    }

    /**
     * Resolve a pass attempt
     * @param {Object} passer - Passing player { position, passing, name }
     * @param {Object} receiver - Receiving player { name }
     * @param {Object} defender - Defending player { stealing, name }
     * @returns {Object} Pass result
     */
    static resolvePassAttempt(passer, receiver, defender) {
        const position = passer.position || 'PG';
        
        // Get passing skill
        const passingSkill = passer.passing || passer.skills?.passing || 60;
        const stealingSkill = defender.stealing || defender.skills?.stealing || 40;

        // Calculate success
        const successPercent = this.calculateSuccessPercentage(passingSkill, stealingSkill);
        
        // Check for steal
        const stealDice = this.rollForAction('steal', defender.position || 'SG');
        let stealBonus = 0;
        if (stealDice.canPerform) {
            stealBonus = stealDice.total;
        }

        // Adjusted steal chance
        const stealChance = Math.min(30, (100 - successPercent) / 3 + stealBonus);
        const stolen = Math.random() * 100 < stealChance;

        if (stolen) {
            return {
                success: false,
                completed: false,
                stolen: true,
                stealer: defender.name || 'Defender',
                passer: passer.name || 'Passer',
                successPercent,
                stealDice
            };
        }

        // Check if pass is completed
        const completed = this.checkSuccess(successPercent);

        return {
            success: true,
            completed,
            stolen: false,
            passer: passer.name || 'Passer',
            receiver: receiver.name || 'Receiver',
            successPercent,
            turnover: !completed
        };
    }

    /**
     * Resolve a steal attempt
     * @param {Object} defender - Stealing player { position, stealing, name }
     * @param {Object} ballHandler - Ball handler { dribbling, name }
     * @returns {Object} Steal result
     */
    static resolveStealAttempt(defender, ballHandler) {
        const position = defender.position || 'PG';
        const diceResult = this.rollForAction('steal', position);

        if (!diceResult.canPerform) {
            return {
                success: false,
                stolen: false,
                reason: `${position} cannot attempt steals`,
                diceResult
            };
        }

        // Calculate success
        const stealingSkill = defender.stealing || defender.skills?.stealing || 50;
        const dribblingSkill = ballHandler.dribbling || ballHandler.skills?.dribbling || 60;
        const successPercent = this.calculateSuccessPercentage(stealingSkill, dribblingSkill);

        // Add dice bonus
        const adjustedPercent = Math.min(100, successPercent + diceResult.total);
        const stolen = this.checkSuccess(adjustedPercent);

        return {
            success: true,
            stolen,
            stealer: defender.name || 'Defender',
            ballHandler: ballHandler.name || 'Ball Handler',
            successPercent: adjustedPercent,
            diceResult
        };
    }

    /**
     * Resolve a block attempt
     * @param {Object} defender - Blocking player { position, blocking, name }
     * @param {Object} shooter - Shooting player { name }
     * @returns {Object} Block result
     */
    static resolveBlockAttempt(defender, shooter) {
        const position = defender.position || 'C';
        const diceResult = this.rollForAction('block', position);

        if (!diceResult.canPerform) {
            return {
                success: false,
                blocked: false,
                reason: `${position} cannot attempt blocks`,
                diceResult
            };
        }

        // Calculate block chance based on dice and skill
        const blockingSkill = defender.blocking || defender.skills?.blocking || 50;
        const baseChance = 15 + (blockingSkill / 5); // 15-35% base
        const diceBonus = diceResult.total * 2;
        const blockChance = Math.min(50, baseChance + diceBonus); // Max 50%

        const blocked = Math.random() * 100 < blockChance;

        return {
            success: true,
            blocked,
            blocker: defender.name || 'Defender',
            shooter: shooter.name || 'Shooter',
            blockChance,
            diceResult
        };
    }

    /**
     * Get available actions for a position
     * @param {string} position - Player position
     * @returns {Object} Available actions with dice
     */
    static getAvailableActions(position) {
        const actions = {};
        
        for (const [actionType, positions] of Object.entries(POSITION_DICE)) {
            const dice = positions[position];
            actions[actionType] = {
                canPerform: dice !== null,
                dice: dice
            };
        }

        return actions;
    }
}

// Export for use
export { ActionResolver, POSITION_DICE };
