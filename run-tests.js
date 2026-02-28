#!/usr/bin/env node
/**
 * Quadra Legacy — Test Runner
 * Discovers and runs all *.test.js files in src/
 * Reports total pass/fail and exits with code 1 if anything fails.
 *
 * Usage:  node run-tests.js
 *         npm test
 */

import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR   = join(__dirname, 'src');

// -----------------------------------------------------------------------
// Discover all *.test.js files recursively
// -----------------------------------------------------------------------
function walkDir(dir) {
  const entries = readdirSync(dir);
  const files   = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full));
    } else if (entry.endsWith('.test.js')) {
      files.push(full);
    }
  }
  return files;
}

const testFiles = walkDir(SRC_DIR).sort();

if (testFiles.length === 0) {
  console.log('No test files found.');
  process.exit(0);
}

// -----------------------------------------------------------------------
// Run each test file and collect results
// -----------------------------------------------------------------------
const results = [];
let anyFailed = false;

console.log('');
console.log('🏀 Quadra Legacy — Test Suite');
console.log('='.repeat(60));
console.log(`  Found ${testFiles.length} test file(s)\n`);

for (const file of testFiles) {
  const label = relative(__dirname, file).replace(/\\/g, '/');
  process.stdout.write(`  Running ${label} … `);

  const result = spawnSync(process.execPath, [file], {
    encoding: 'utf-8',
    timeout:  30_000,   // 30 s per test file
    env: process.env,
  });

  const passed = result.status === 0;
  if (!passed) anyFailed = true;

  console.log(passed ? '✅' : '❌');

  results.push({ label, passed, stdout: result.stdout, stderr: result.stderr, status: result.status });
}

// -----------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log('  Summary');
console.log('='.repeat(60));

for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`  ${icon}  ${r.label}`);
  if (!r.passed) {
    // Print last few lines of stdout/stderr for failures
    const out = (r.stdout || '').trim().split('\n').slice(-10).join('\n');
    const err = (r.stderr || '').trim().split('\n').slice(-5).join('\n');
    if (out) console.log('     ' + out.split('\n').join('\n     '));
    if (err) console.log('     STDERR: ' + err.split('\n').join('\n     '));
  }
}

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log('');
console.log(`  Total: ✅ ${passed} passed, ❌ ${failed} failed`);
console.log('');

process.exit(anyFailed ? 1 : 0);
