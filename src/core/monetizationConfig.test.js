/**
 * Monetization Configuration — Exhaustive Tests
 * Quadra Legacy — src/core/monetizationConfig.test.js
 *
 * Run with: node src/core/monetizationConfig.test.js
 *
 * All assertions derive their expected values directly from the source code
 * of monetizationConfig.js.  No external test libraries; plain Node.js only.
 */

import {
  ITEM_CATEGORIES,
  PURCHASABLE_ITEMS,
  NEVER_PURCHASABLE,
  FREE_TIER_LIMITS,
  PREMIUM_TIER_LIMITS,
  getItemById,
  getAllItems,
  getItemsByCategory,
  isNeverPurchasable,
  validatePurchaseRequest,
  getUserLimits,
  hasFeature,
  calculateTotalSpent,
} from './monetizationConfig.js';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         expected: ${JSON.stringify(expected)}`);
    console.log(`         actual:   ${JSON.stringify(actual)}`);
    failCount++;
  }
}

function assertDeepEqual(label, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    console.log(`  PASS  ${label}`);
    passCount++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         expected: ${b}`);
    console.log(`         actual:   ${a}`);
    failCount++;
  }
}

function assertThrows(label, fn) {
  try {
    fn();
    console.log(`  FAIL  ${label} -- expected an error but none was thrown`);
    failCount++;
  } catch (e) {
    console.log(`  PASS  ${label} (threw: ${e.message})`);
    passCount++;
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ===========================================================================
// 1. Config immutability
// ===========================================================================
section('Config immutability');

assert(
  'PURCHASABLE_ITEMS is frozen',
  Object.isFrozen(PURCHASABLE_ITEMS),
  true,
);

assert(
  'Each purchasable item is frozen',
  PURCHASABLE_ITEMS.every(i => Object.isFrozen(i)),
  true,
);

assert(
  'NEVER_PURCHASABLE is frozen',
  Object.isFrozen(NEVER_PURCHASABLE),
  true,
);

assert(
  'FREE_TIER_LIMITS is frozen',
  Object.isFrozen(FREE_TIER_LIMITS),
  true,
);

assert(
  'PREMIUM_TIER_LIMITS is frozen',
  Object.isFrozen(PREMIUM_TIER_LIMITS),
  true,
);

assert(
  'ITEM_CATEGORIES is frozen',
  Object.isFrozen(ITEM_CATEGORIES),
  true,
);

// ===========================================================================
// 2. Zero pay-to-win invariants
// ===========================================================================
section('Zero pay-to-win invariants');

assert(
  'Every item has competitiveAdvantage === false',
  PURCHASABLE_ITEMS.every(i => i.competitiveAdvantage === false),
  true,
);

assert(
  'No purchasable item id appears in NEVER_PURCHASABLE',
  PURCHASABLE_ITEMS.every(i => !NEVER_PURCHASABLE.includes(i.id)),
  true,
);

assert(
  'No purchasable feature appears in NEVER_PURCHASABLE',
  PURCHASABLE_ITEMS.every(i =>
    i.features.every(f => !NEVER_PURCHASABLE.includes(f)),
  ),
  true,
);

assert(
  'Competitive limits match between free and premium tiers (practiceSessionsPerDay)',
  FREE_TIER_LIMITS.practiceSessionsPerDay === PREMIUM_TIER_LIMITS.practiceSessionsPerDay,
  true,
);

assert(
  'Competitive limits match between free and premium tiers (marketplaceListingsPerTeam)',
  FREE_TIER_LIMITS.marketplaceListingsPerTeam === PREMIUM_TIER_LIMITS.marketplaceListingsPerTeam,
  true,
);

// ===========================================================================
// 3. getItemById
// ===========================================================================
section('getItemById');

{
  const item = getItemById('SEASON_PASS');
  assert('getItemById("SEASON_PASS") returns correct id', item?.id, 'SEASON_PASS');
  assert('getItemById("SEASON_PASS") returns correct price', item?.priceUSD, 4.99);
}

{
  const item = getItemById('season_pass');
  assert('getItemById is case-insensitive', item?.id, 'SEASON_PASS');
}

assert('getItemById with unknown id returns null', getItemById('NONEXISTENT'), null);
assert('getItemById with non-string returns null', getItemById(123), null);

// ===========================================================================
// 4. getAllItems
// ===========================================================================
section('getAllItems');

{
  const items = getAllItems();
  assert('getAllItems returns correct count', items.length, PURCHASABLE_ITEMS.length);

  // Mutating the returned array should NOT affect the source
  items.push({ id: 'FAKE' });
  assert(
    'Mutating getAllItems result does not change PURCHASABLE_ITEMS',
    PURCHASABLE_ITEMS.length,
    5,
  );
}

// ===========================================================================
// 5. getItemsByCategory
// ===========================================================================
section('getItemsByCategory');

{
  const cosmetics = getItemsByCategory('cosmetic');
  assert(
    'getItemsByCategory("cosmetic") returns 2 items',
    cosmetics.length,
    2,
  );
  assert(
    'First cosmetic item is DRAFT_BOARD_PREMIUM',
    cosmetics[0].id,
    'DRAFT_BOARD_PREMIUM',
  );
  assert(
    'Second cosmetic item is COSMETIC_BUNDLE',
    cosmetics[1].id,
    'COSMETIC_BUNDLE',
  );
}

assert(
  'getItemsByCategory("season_pass") returns 1 item',
  getItemsByCategory('season_pass').length,
  1,
);

assert(
  'getItemsByCategory with unknown category returns empty array',
  getItemsByCategory('does_not_exist').length,
  0,
);

assert(
  'getItemsByCategory with non-string returns empty array',
  getItemsByCategory(null).length,
  0,
);

// ===========================================================================
// 6. isNeverPurchasable
// ===========================================================================
section('isNeverPurchasable');

assert('isNeverPurchasable("stat_boost") is true', isNeverPurchasable('stat_boost'), true);
assert('isNeverPurchasable("STAT_BOOST") is case-insensitive', isNeverPurchasable('STAT_BOOST'), true);
assert('isNeverPurchasable("season_cosmetics") is false', isNeverPurchasable('season_cosmetics'), false);
assert('isNeverPurchasable with non-string returns false', isNeverPurchasable(42), false);

// ===========================================================================
// 7. validatePurchaseRequest
// ===========================================================================
section('validatePurchaseRequest');

{
  const result = validatePurchaseRequest('SEASON_PASS');
  assert('validatePurchaseRequest("SEASON_PASS") is allowed', result.allowed, true);
}

{
  const result = validatePurchaseRequest('stat_boost');
  assert('validatePurchaseRequest("stat_boost") is blocked', result.allowed, false);
  assert(
    'validatePurchaseRequest("stat_boost") reason mentions blacklist',
    result.reason.includes('blacklisted'),
    true,
  );
}

{
  const result = validatePurchaseRequest('season_cosmetics');
  assert('validatePurchaseRequest for a sub-feature is allowed', result.allowed, true);
}

{
  const result = validatePurchaseRequest('');
  assert('validatePurchaseRequest("") is rejected', result.allowed, false);
}

{
  const result = validatePurchaseRequest('totally_unknown_thing');
  assert('validatePurchaseRequest for unrecognised feature is rejected', result.allowed, false);
}

// ===========================================================================
// 8. getUserLimits
// ===========================================================================
section('getUserLimits');

{
  const free = getUserLimits(false);
  assert('Free tier maxLeagues is 2', free.maxLeagues, 2);
  assert('Free tier adFree is false', free.adFree, false);

  // Mutation guard
  free.maxLeagues = 999;
  assert(
    'Mutating getUserLimits result does not affect FREE_TIER_LIMITS',
    FREE_TIER_LIMITS.maxLeagues,
    2,
  );
}

{
  const premium = getUserLimits(true);
  assert('Premium tier maxLeagues is 5', premium.maxLeagues, 5);
  assert('Premium tier adFree is true', premium.adFree, true);
  assert('Premium tier customCourtSkins is true', premium.customCourtSkins, true);
}

// ===========================================================================
// 9. hasFeature
// ===========================================================================
section('hasFeature');

assert(
  'hasFeature(["SEASON_PASS"], "season_badge") is true',
  hasFeature(['SEASON_PASS'], 'season_badge'),
  true,
);

assert(
  'hasFeature(["SEASON_PASS"], "ad_free") is false',
  hasFeature(['SEASON_PASS'], 'ad_free'),
  false,
);

assert(
  'hasFeature(["REMOVE_ADS"], "ad_free") is true',
  hasFeature(['REMOVE_ADS'], 'ad_free'),
  true,
);

assert(
  'hasFeature with empty array returns false',
  hasFeature([], 'ad_free'),
  false,
);

assert(
  'hasFeature with non-array returns false',
  hasFeature('SEASON_PASS', 'season_badge'),
  false,
);

assert(
  'hasFeature with non-string featureId returns false',
  hasFeature(['SEASON_PASS'], 123),
  false,
);

// ===========================================================================
// 10. calculateTotalSpent
// ===========================================================================
section('calculateTotalSpent');

assert(
  'calculateTotalSpent for single item',
  calculateTotalSpent(['SEASON_PASS']),
  4.99,
);

{
  // 4.99 + 1.99 + 2.99 + 3.49 + 2.49 = 15.95
  const total = calculateTotalSpent([
    'SEASON_PASS',
    'EXTRA_LEAGUE_SLOT',
    'DRAFT_BOARD_PREMIUM',
    'COSMETIC_BUNDLE',
    'REMOVE_ADS',
  ]);
  assert('calculateTotalSpent for all items', total, 15.95);
}

assert(
  'calculateTotalSpent ignores unknown IDs',
  calculateTotalSpent(['SEASON_PASS', 'FAKE_ID']),
  4.99,
);

assert(
  'calculateTotalSpent for empty array is 0',
  calculateTotalSpent([]),
  0,
);

assert(
  'calculateTotalSpent with non-array returns 0',
  calculateTotalSpent('SEASON_PASS'),
  0,
);

// ===========================================================================
// 11. Immutability guards — returned objects must be independent copies
// ===========================================================================
section('Immutability guards — returned copies');

{
  const a = getItemById('SEASON_PASS');
  const b = getItemById('SEASON_PASS');
  a.priceUSD = 0;
  assert(
    'Mutating one getItemById copy does not affect another',
    b.priceUSD,
    4.99,
  );
}

{
  const items1 = getAllItems();
  const items2 = getAllItems();
  items1[0].id = 'HACKED';
  assert(
    'Mutating one getAllItems copy does not affect another',
    items2[0].id,
    'SEASON_PASS',
  );
}

// ===========================================================================
// Summary
// ===========================================================================
console.log('\n===================================');
console.log(`  Total: ${passCount + failCount}  |  Passed: ${passCount}  |  Failed: ${failCount}`);
console.log('===================================\n');

if (failCount > 0) {
  process.exit(1);
}
