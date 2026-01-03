/**
 * ActionResolver Tests
 * Run with: node src/actionResolver.test.js
 */

import { ActionResolver, POSITION_DICE } from './actionResolver.js';

console.log('🏀 ActionResolver Tests\n');
console.log('='.repeat(50));

// Test 1: Success Percentage Formula
console.log('\n📊 Test 1: Success Percentage Formula');
console.log('-'.repeat(40));

const testCases = [
    { attack: 99, defense: 51, expected: 98 },
    { attack: 51, defense: 99, expected: 2 },
    { attack: 75, defense: 75, expected: 50 },
    { attack: 85, defense: 70, expected: 72.5 },
    { attack: 99, defense: 99, expected: 50 }
];

testCases.forEach(({ attack, defense, expected }) => {
    const result = ActionResolver.calculateSuccessPercentage(attack, defense);
    const pass = Math.abs(result - expected) < 1 ? '✅' : '❌';
    console.log(`  A=${attack} vs D=${defense}: ${result.toFixed(1)}% (expected ${expected}%) ${pass}`);
});

// Test 2: Position-Based Dice
console.log('\n🎲 Test 2: Position-Based Dice Rolls');
console.log('-'.repeat(40));

const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
const actions = ['2point', '3point', 'rebound', 'assist', 'steal', 'block'];

console.log('\n  2-Point Shots:');
positions.forEach(pos => {
    const result = ActionResolver.rollForAction('2point', pos);
    console.log(`    ${pos}: ${result.canPerform ? `${result.notation} → ${result.total}` : '❌ Cannot'}`);
});

console.log('\n  3-Point Shots:');
positions.forEach(pos => {
    const result = ActionResolver.rollForAction('3point', pos);
    console.log(`    ${pos}: ${result.canPerform ? `${result.notation} → ${result.total}` : '❌ Cannot'}`);
});

console.log('\n  Rebounds:');
positions.forEach(pos => {
    const result = ActionResolver.rollForAction('rebound', pos);
    console.log(`    ${pos}: ${result.canPerform ? `${result.notation} → ${result.total}` : '❌ Cannot'}`);
});

// Test 3: 2-Point Shot Resolution
console.log('\n🏀 Test 3: 2-Point Shot Resolution');
console.log('-'.repeat(40));

const shooter = { name: 'LeBron', position: 'SF', shooting: 85 };
const defender = { name: 'Gobert', defense: 90, blocking: 80 };

for (let i = 0; i < 5; i++) {
    const result = ActionResolver.resolve2PointerAttempt(shooter, defender);
    const outcome = result.blocked ? '🚫 BLOCKED' : result.made ? '✅ MADE' : '❌ MISSED';
    console.log(`  Shot ${i+1}: ${outcome} (${result.successPercent.toFixed(0)}% success, dice: ${result.diceResult.total})`);
}

// Test 4: 3-Point Shot Resolution
console.log('\n🎯 Test 4: 3-Point Shot Resolution');
console.log('-'.repeat(40));

const shooter3pt = { name: 'Curry', position: 'SG', shooting3pt: 95 };
const perimeterDef = { name: 'Smart', perimeterDefense: 75 };

for (let i = 0; i < 5; i++) {
    const result = ActionResolver.resolve3PointerAttempt(shooter3pt, perimeterDef);
    const outcome = result.blocked ? '🚫 BLOCKED' : result.made ? '✅ MADE' : '❌ MISSED';
    console.log(`  Shot ${i+1}: ${outcome} (${result.successPercent.toFixed(0)}% success, dice: ${result.diceResult.total})`);
}

// Test 5: Center can't shoot 3s
console.log('\n🚫 Test 5: Center Cannot Shoot 3-Pointers');
console.log('-'.repeat(40));
const center = { name: 'Shaq', position: 'C', shooting3pt: 10 };
const result3pt = ActionResolver.resolve3PointerAttempt(center, perimeterDef);
console.log(`  ${center.name} (C) tries 3pt: ${result3pt.canPerform === false ? '❌ Cannot perform' : '✅ Allowed'}`);
console.log(`  Reason: ${result3pt.reason || 'N/A'}`);

// Test 6: Rebound Contest
console.log('\n🏀 Test 6: Rebound Contest');
console.log('-'.repeat(40));

const offRebounder = { name: 'Rodman', position: 'PF', rebounding: 95 };
const defRebounder = { name: 'Gobert', position: 'C', rebounding: 90 };

for (let i = 0; i < 5; i++) {
    const result = ActionResolver.resolveReboundContest(offRebounder, defRebounder);
    console.log(`  Contest ${i+1}: ${result.winner.toUpperCase()} rebound by ${result.winnerPlayer} (Off: ${result.offenseTotal}, Def: ${result.defenseTotal})`);
}

// Test 7: Pass Attempt
console.log('\n🏀 Test 7: Pass Attempt');
console.log('-'.repeat(40));

const passer = { name: 'Magic', position: 'PG', passing: 95 };
const receiver = { name: 'Kareem' };
const stealingDef = { name: 'Gary Payton', position: 'PG', stealing: 90 };

for (let i = 0; i < 5; i++) {
    const result = ActionResolver.resolvePassAttempt(passer, receiver, stealingDef);
    const outcome = result.stolen ? '🔥 STOLEN' : result.completed ? '✅ COMPLETED' : '❌ TURNOVER';
    console.log(`  Pass ${i+1}: ${outcome} (${result.successPercent.toFixed(0)}% success)`);
}

// Test 8: Available Actions per Position
console.log('\n📋 Test 8: Available Actions per Position');
console.log('-'.repeat(40));

positions.forEach(pos => {
    const available = ActionResolver.getAvailableActions(pos);
    const canDo = Object.entries(available)
        .filter(([_, v]) => v.canPerform)
        .map(([k, v]) => `${k}(${v.dice})`)
        .join(', ');
    console.log(`  ${pos}: ${canDo}`);
});

console.log('\n' + '='.repeat(50));
console.log('✅ All ActionResolver tests completed!\n');
