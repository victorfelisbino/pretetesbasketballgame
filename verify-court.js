/**
 * Court System Verification Script
 * Run this with: node verify-court.js
 */

// Load all required classes
const fs = require('fs');
const path = require('path');

// Load Player class
eval(fs.readFileSync(path.join(__dirname, 'src/player.js'), 'utf8'));

// Load Team class
eval(fs.readFileSync(path.join(__dirname, 'src/team.js'), 'utf8'));

// Load Court class
eval(fs.readFileSync(path.join(__dirname, 'src/court.js'), 'utf8'));

// Load tests
eval(fs.readFileSync(path.join(__dirname, 'src/court.test.js'), 'utf8'));

// Run the tests
console.log('\n');
runAllTests();
