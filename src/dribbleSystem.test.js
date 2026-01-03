/**
 * DribbleSystem Tests
 * Run with: node src/dribbleSystem.test.js
 */

import { DribbleSystem } from './dribbleSystem.js';

console.log('🏀 DribbleSystem Tests\n');
console.log('='.repeat(50));

// Test 1: Threshold Calculation
console.log('\n📊 Test 1: Threshold Calculation');
console.log('-'.repeat(40));

const testCases = [
    { dribble: 16, steal: 2, expectedThreshold: 6, expectedPercent: 75 },
    { dribble: 10, steal: 10, expectedThreshold: 20, expectedPercent: 5 },
    { dribble: 5, steal: 15, expectedThreshold: 30, expectedPercent: 0 },
    { dribble: 20, steal: 5, expectedThreshold: 5, expectedPercent: 80 },
    { dribble: 18, steal: 3, expectedThreshold: 5, expectedPercent: 80 },
    { dribble: 2, steal: 18, expectedThreshold: 36, expectedPercent: 0 },
];

testCases.forEach(({ dribble, steal, expectedThreshold, expectedPercent }) => {
    const threshold = DribbleSystem.calculateThreshold(dribble, steal);
    const percent = DribbleSystem.calculateSuccessPercent(dribble, steal);
    
    // Threshold is clamped to 21 max
    const clampedExpected = Math.min(21, expectedThreshold);
    const passThreshold = threshold === clampedExpected ? '✅' : '❌';
    const passPercent = Math.abs(percent - expectedPercent) < 1 ? '✅' : '❌';
    
    console.log(`  Dribble ${dribble} vs Steal ${steal}:`);
    console.log(`    Threshold: ${threshold} (expected ${clampedExpected}) ${passThreshold}`);
    console.log(`    Success: ${percent.toFixed(0)}% (expected ${expectedPercent}%) ${passPercent}`);
});

// Test 2: Dribble Contest Resolution
console.log('\n🎲 Test 2: Dribble Contest Resolution');
console.log('-'.repeat(40));

const dribbler = { name: 'Kyrie Irving', dribbling: 18 };
const defender = { name: 'Marcus Smart', stealing: 15 };

console.log(`  ${dribbler.name} (Dribble: ${dribbler.dribbling}) vs ${defender.name} (Steal: ${defender.stealing})`);
console.log(`  Expected success rate: ${DribbleSystem.calculateSuccessPercent(dribbler.dribbling, defender.stealing).toFixed(0)}%\n`);

let successes = 0;
const trials = 10;

for (let i = 0; i < trials; i++) {
    const result = DribbleSystem.resolveDribbleContest(dribbler, defender);
    if (result.success) successes++;
    const icon = result.success ? '✅' : '❌';
    console.log(`  Contest ${i+1}: Roll ${result.roll} vs threshold ${result.threshold} → ${result.outcome.toUpperCase()} ${icon}`);
}

console.log(`\n  Results: ${successes}/${trials} successful (${(successes/trials*100).toFixed(0)}%)`);

// Test 3: Elite Dribbler vs Average Defender
console.log('\n🌟 Test 3: Elite Dribbler vs Average Defender');
console.log('-'.repeat(40));

const eliteDribbler = { name: 'Allen Iverson', dribbling: 20 };
const avgDefender = { name: 'Random Guy', stealing: 8 };

console.log(`  ${eliteDribbler.name} (Dribble: 20) vs ${avgDefender.name} (Steal: 8)`);
const elitePercent = DribbleSystem.calculateSuccessPercent(20, 8);
console.log(`  Success rate: ${elitePercent.toFixed(0)}%`);
console.log(`  Difficulty: ${DribbleSystem.getDifficultyRating(20, 8)}`);
console.log(`  Is safe? ${DribbleSystem.isSafeDribble(eliteDribbler, avgDefender) ? 'Yes ✅' : 'No ❌'}`);

// Test 4: Bad Dribbler vs Elite Defender
console.log('\n⚠️ Test 4: Bad Dribbler vs Elite Defender');
console.log('-'.repeat(40));

const badDribbler = { name: 'Shaq', dribbling: 5 };
const eliteDefender = { name: 'Gary Payton', stealing: 19 };

console.log(`  ${badDribbler.name} (Dribble: 5) vs ${eliteDefender.name} (Steal: 19)`);
const badPercent = DribbleSystem.calculateSuccessPercent(5, 19);
console.log(`  Success rate: ${badPercent.toFixed(0)}%`);
console.log(`  Difficulty: ${DribbleSystem.getDifficultyRating(5, 19)}`);
console.log(`  Is safe? ${DribbleSystem.isSafeDribble(badDribbler, eliteDefender) ? 'Yes ✅' : 'No ❌'}`);

// Test 5: Dribble Move
console.log('\n🏃 Test 5: Dribble Move Resolution');
console.log('-'.repeat(40));

const moveResult = DribbleSystem.resolveDribbleMove(
    { name: 'Chris Paul', dribbling: 17, x: 10, y: 15 },
    { name: 'Jrue Holiday', stealing: 16 },
    3
);

console.log(`  Result: ${moveResult.success ? 'Advanced!' : 'Turnover!'}`);
console.log(`  Roll: ${moveResult.roll} vs Threshold: ${moveResult.threshold}`);
if (moveResult.success) {
    console.log(`  Squares moved: ${moveResult.squaresMoved}`);
} else {
    console.log(`  Ball lost to: ${moveResult.newPossession}`);
}

console.log('\n' + '='.repeat(50));
console.log('✅ All DribbleSystem tests completed!\n');
