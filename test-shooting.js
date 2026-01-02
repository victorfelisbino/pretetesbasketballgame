// Quick test to see what's happening
class DiceRoller {
    static rollDie(sides = 6) {
        return Math.floor(Math.random() * sides) + 1;
    }
    static rollMultiple(quantity, sides) {
        const rolls = [];
        let total = 0;
        for (let i = 0; i < quantity; i++) {
            const roll = this.rollDie(sides);
            rolls.push(roll);
            total += roll;
        }
        return { rolls, total, notation: `${quantity}d${sides}` };
    }
}

// Test shooting
console.log('=== SHOOTING TEST ===\n');

const players = [
    { name: 'Magic', position: 'PG', skillLevel: 5 },
    { name: 'Shaq', position: 'C', skillLevel: 5 },
];

for (let player of players) {
    console.log(`Testing ${player.name} (${player.position}, Skill ${player.skillLevel})`);
    
    // 2-pointer dice
    const diceMap = {
        '2pt': {
            'PG': { q: 1, s: 4 },
            'C': { q: 2, s: 6 }
        }
    };
    
    const dice = diceMap['2pt'][player.position];
    console.log(`  Dice: ${dice.q}d${dice.s}`);
    
    const successThreshold = player.skillLevel * 2;
    console.log(`  Success Threshold: ${successThreshold}`);
    
    // Roll 10 times
    let successes = 0;
    for (let i = 0; i < 10; i++) {
        const roll = DiceRoller.rollMultiple(dice.q, dice.s);
        const success = roll.total >= successThreshold;
        if (success) successes++;
        console.log(`    Roll ${i+1}: ${roll.total} ${success ? '✓ SUCCESS' : '✗ FAIL'}`);
    }
    
    console.log(`  Success Rate: ${successes}/10 (${successes * 10}%)\n`);
}
