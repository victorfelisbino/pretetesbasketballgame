/**
 * Monetization Configuration — Quadra Legacy
 * src/core/monetizationConfig.js
 *
 * Central, immutable source of truth for every purchasable item and every
 * pay-to-win guard-rail in the game.  This module is intentionally pure:
 * no UI, no Firebase, no React dependencies.
 *
 * DESIGN PRINCIPLES
 * -----------------
 *  1. Zero pay-to-win: no purchasable item may grant a competitive advantage.
 *  2. Immutability: all exported constants are deep-frozen.  Utility functions
 *     return copies so callers cannot mutate the canonical data.
 *  3. Determinism: every exported function is pure — same inputs, same outputs.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** Allowed item categories. */
export const ITEM_CATEGORIES = Object.freeze([
  'season_pass',
  'expansion',
  'cosmetic',
  'utility',
]);

// ---------------------------------------------------------------------------
// Purchasable items
// ---------------------------------------------------------------------------

/**
 * Canonical list of items that players may buy.
 * Every item MUST have `competitiveAdvantage: false`.
 */
export const PURCHASABLE_ITEMS = Object.freeze([
  Object.freeze({
    id: 'SEASON_PASS',
    name: 'Season Pass',
    description: 'Unlock premium cosmetic rewards for the current season.',
    category: 'season_pass',
    priceUSD: 4.99,
    competitiveAdvantage: false,
    features: ['season_cosmetics', 'season_badge', 'season_emotes'],
  }),
  Object.freeze({
    id: 'EXTRA_LEAGUE_SLOT',
    name: 'Extra League Slot',
    description: 'Join one additional league beyond the free-tier limit.',
    category: 'expansion',
    priceUSD: 1.99,
    competitiveAdvantage: false,
    features: ['extra_league_slot'],
  }),
  Object.freeze({
    id: 'DRAFT_BOARD_PREMIUM',
    name: 'Draft Board Premium',
    description: 'Enhanced draft-room UI with custom themes and animations.',
    category: 'cosmetic',
    priceUSD: 2.99,
    competitiveAdvantage: false,
    features: ['draft_theme_dark', 'draft_theme_retro', 'draft_animations'],
  }),
  Object.freeze({
    id: 'COSMETIC_BUNDLE',
    name: 'Cosmetic Bundle',
    description: 'A collection of court skins, jersey colours and ball effects.',
    category: 'cosmetic',
    priceUSD: 3.49,
    competitiveAdvantage: false,
    features: ['court_skins', 'jersey_colours', 'ball_effects'],
  }),
  Object.freeze({
    id: 'REMOVE_ADS',
    name: 'Remove Ads',
    description: 'Permanently remove all banner and interstitial advertisements.',
    category: 'utility',
    priceUSD: 2.49,
    competitiveAdvantage: false,
    features: ['ad_free'],
  }),
]);

// ---------------------------------------------------------------------------
// Never-purchasable features (pay-to-win blacklist)
// ---------------------------------------------------------------------------

/**
 * Features that MUST NEVER be sold — selling any of these would constitute
 * a competitive / pay-to-win advantage.
 */
export const NEVER_PURCHASABLE = Object.freeze([
  'stat_boost',
  'extra_skill_points',
  'guaranteed_draft_pick',
  'salary_cap_increase',
  'injury_immunity',
  'fatigue_reduction',
  'referee_favour',
  'matchmaking_priority',
  'auto_win',
  'xp_multiplier',
  'unlock_all_tactics',
  'player_attribute_boost',
]);

// ---------------------------------------------------------------------------
// Tier limits
// ---------------------------------------------------------------------------

/**
 * Limits that apply to free-tier users.
 * Competitive fields (practiceSessionsPerDay, marketplaceListingsPerTeam) are
 * identical between free and premium tiers to ensure zero pay-to-win.
 */
export const FREE_TIER_LIMITS = Object.freeze({
  maxLeagues: 2,
  maxTeamsPerLeague: 1,
  practiceSessionsPerDay: 5,
  marketplaceListingsPerTeam: 10,
  customCourtSkins: false,
  adFree: false,
});

/**
 * Limits that apply to premium-tier users.
 * practiceSessionsPerDay and marketplaceListingsPerTeam MUST match
 * FREE_TIER_LIMITS to preserve competitive fairness.
 */
export const PREMIUM_TIER_LIMITS = Object.freeze({
  maxLeagues: 5,
  maxTeamsPerLeague: 3,
  practiceSessionsPerDay: 5,           // same as free — NOT pay-to-win
  marketplaceListingsPerTeam: 10,       // same as free — NOT pay-to-win
  customCourtSkins: true,
  adFree: true,
});

// ---------------------------------------------------------------------------
// Utility functions (all pure, all return copies)
// ---------------------------------------------------------------------------

/**
 * Look up a purchasable item by its `id` string.
 * Accepts the exact id (e.g. "SEASON_PASS") or a case-insensitive match.
 * Returns a shallow copy of the item, or `null` if not found.
 */
export function getItemById(itemId) {
  if (typeof itemId !== 'string') return null;
  const upper = itemId.toUpperCase();
  const item = PURCHASABLE_ITEMS.find(
    i => i.id === itemId || i.id === upper
  );
  return item ? { ...item, features: [...item.features] } : null;
}

/**
 * Return an array containing copies of every purchasable item.
 */
export function getAllItems() {
  return PURCHASABLE_ITEMS.map(i => ({ ...i, features: [...i.features] }));
}

/**
 * Return copies of all items belonging to the given category.
 */
export function getItemsByCategory(category) {
  if (typeof category !== 'string') return [];
  return PURCHASABLE_ITEMS
    .filter(i => i.category === category)
    .map(i => ({ ...i, features: [...i.features] }));
}

/**
 * Returns `true` when featureId appears in the NEVER_PURCHASABLE blacklist.
 * Comparison is case-insensitive.
 */
export function isNeverPurchasable(featureId) {
  if (typeof featureId !== 'string') return false;
  const lower = featureId.toLowerCase();
  return NEVER_PURCHASABLE.some(f => f.toLowerCase() === lower);
}

/**
 * Validate whether a purchase request for `featureId` is allowed.
 * Returns `{ allowed: boolean, reason: string }`.
 */
export function validatePurchaseRequest(featureId) {
  if (typeof featureId !== 'string' || featureId.trim() === '') {
    return { allowed: false, reason: 'Invalid feature ID.' };
  }
  if (isNeverPurchasable(featureId)) {
    return { allowed: false, reason: `Feature "${featureId}" is blacklisted as pay-to-win.` };
  }
  const item = getItemById(featureId);
  if (item) {
    return { allowed: true, reason: 'Item is available for purchase.' };
  }
  // featureId might be a sub-feature rather than an item id
  const parentItem = PURCHASABLE_ITEMS.find(i => i.features.includes(featureId));
  if (parentItem) {
    return { allowed: true, reason: `Feature available via item "${parentItem.id}".` };
  }
  return { allowed: false, reason: `Feature "${featureId}" is not recognised.` };
}

/**
 * Return the appropriate tier-limit object (copy) based on premium status.
 */
export function getUserLimits(isPremium) {
  return isPremium ? { ...PREMIUM_TIER_LIMITS } : { ...FREE_TIER_LIMITS };
}

/**
 * Given a list of purchased item IDs, check whether any of those items
 * includes `featureId` in its `features` array.
 */
export function hasFeature(purchasedItems, featureId) {
  if (!Array.isArray(purchasedItems) || typeof featureId !== 'string') {
    return false;
  }
  return purchasedItems.some(pid => {
    const item = getItemById(pid);
    return item !== null && item.features.includes(featureId);
  });
}

/**
 * Sum the USD price of every item whose ID appears in `purchasedItems`.
 * Unrecognised IDs are silently ignored.  Returns a number rounded to
 * two decimal places.
 */
export function calculateTotalSpent(purchasedItems) {
  if (!Array.isArray(purchasedItems)) return 0;
  const total = purchasedItems.reduce((sum, pid) => {
    const item = getItemById(pid);
    return item ? sum + item.priceUSD : sum;
  }, 0);
  return Math.round(total * 100) / 100;
}
