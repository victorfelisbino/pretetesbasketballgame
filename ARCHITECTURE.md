# Quadra Legacy — Architecture Reference

**Version:** 2026-02-27
**Status:** Single source of truth. All developers and sub-agents must consult this document before touching any integration point.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Module Dependency Graph](#2-module-dependency-graph)
3. [Core Data Contracts](#3-core-data-contracts)
4. [Canonical Stat Name Mapping](#4-canonical-stat-name-mapping)
5. [Module Format Reference](#5-module-format-reference)
6. [Integration Points and Known Issues](#6-integration-points-and-known-issues)
7. [Current Gaps](#7-current-gaps)
8. [Test Coverage Map](#8-test-coverage-map)
9. [Phase Gate Checklist](#9-phase-gate-checklist)
10. [Canonical Integration Recipe](#10-canonical-integration-recipe)

---

## 1. System Overview

Quadra Legacy is a mobile basketball manager game built with **Vite + React 19** on the frontend, **Firebase 12** (Firestore, Auth) as the cloud backend, and a **pure-JS dice-based simulation engine** that is intentionally decoupled from the UI.

### Two Distinct Operation Modes

| Mode | Entry Point | Backend | Persistence |
|------|-------------|---------|-------------|
| Guest / Offline | `App.jsx` → MatchView.jsx | None | `localStorage` via `localLeague.js`, `playerStats.js` |
| Authenticated / Online | `App.jsx` → Firebase layers | Firestore | Cloud documents; offline cache via `persistentLocalCache` |

### Directory Layout

```
src/
  core/
    fantasyScoring.js       Fantasy points engine
    tacticsEngine.js        Tactics/play-style modifiers (UNWIRED)
  gameplay/
    playerCreator.js        Archetype-based player generation
    seasonManager.js        Season lifecycle: schedule, standings, playoffs
  firebase/
    config.js               App init, auth, db exports
    auth.js                 Auth operations
    database.js             Firestore CRUD for all 6 collections
    league.js               Higher-level league lifecycle operations
    index.js                Barrel re-export (PARTIALLY STALE — see §6)
  league/
    localLeague.js          localStorage league system
  stats/
    playerStats.js          localStorage career stats tracker
  ui/
    MatchView.jsx           Live match simulation view (THIRD inline sim copy)
    TeamSetup.jsx           Team setup form (creates plain-object teams)
    LeagueHub.jsx           League creation and selection hub
    LeagueView.jsx          League standings, schedule, teams tab view
    PlayerStatsView.jsx     Career stats leaderboard and profiles
    AuthScreen.jsx          Login / register form
    BasketballCourt.jsx     SVG court visualization
    ScoreBoard.jsx          Standalone scoreboard component
    NarrationLog.jsx        Standalone play-by-play component
    PlayerCard.jsx          Player profile card (full and compact modes)
  contexts/
    AuthContext.jsx         React auth state provider
  actionResolver.js         Shot/rebound/foul probability engine
  dribbleSystem.js          d20 dribble vs steal system
  matchEngine.js            Match loop (LEGACY — three missing imports)
  gameController.js         Match orchestrator (standalone, inlines Narrator+Dice)
  narration.js              Bilingual narration templates (CommonJS)
  player.js                 Player class (CommonJS)
  team.js                   Team class (CommonJS)
  court.js                  Court grid system (CommonJS)
  dice.js                   DiceRoller static class (CommonJS)
  App.jsx                   Root component / router
  main.jsx                  ReactDOM entry point
```

---

## 2. Module Dependency Graph

```
main.jsx
  └─ App.jsx
       ├─ contexts/AuthContext.jsx
       │    └─ firebase/index.js  ← BROKEN BARREL (see §6, Issue 1)
       ├─ ui/TeamSetup.jsx        (no engine imports — creates plain objects)
       ├─ ui/MatchView.jsx        (inlines DiceRoller + Narrator v3)
       ├─ ui/LeagueHub.jsx
       │    └─ league/localLeague.js
       ├─ ui/LeagueView.jsx
       │    └─ league/localLeague.js
       ├─ ui/PlayerStatsView.jsx
       │    └─ stats/playerStats.js
       └─ ui/AuthScreen.jsx
            └─ contexts/AuthContext.jsx

gameController.js            ← Current headless orchestrator
  ├─ actionResolver.js       (imported but NEVER CALLED in _simulateRound)
  ├─ dribbleSystem.js        (imported but NEVER CALLED in _simulateRound)
  ├─ [DiceRoller — INLINED]  (mirrors dice.js)
  └─ [Narrator — INLINED]    (mirrors narration.js + MatchView extensions)

matchEngine.js               ← Legacy match loop (NOT used by any UI)
  ├─ actionResolver.js
  ├─ dribbleSystem.js
  ├─ Court — MISSING IMPORT  (line 21: new Court(50, 30))
  ├─ Narration — GLOBAL ONLY (line 40: typeof Narration !== 'undefined')
  └─ DiceRoller — GLOBAL ONLY (line 623: DiceRoller.rollDie(20))

actionResolver.js            (pure static, no imports)
dribbleSystem.js             (pure static, no imports)

firebase/league.js
  ├─ firebase/database.js
  └─ firebase/config.js

firebase/database.js
  └─ firebase/config.js

core/fantasyScoring.js       (no imports — pure computation)
core/tacticsEngine.js        (no imports — pure computation, UNWIRED)
gameplay/seasonManager.js    (no imports — pure computation)
gameplay/playerCreator.js    (no imports — injects Player-class methods)

league/localLeague.js        (no imports — uses localStorage directly)
stats/playerStats.js         (no imports — uses localStorage directly)
```

---

## 3. Core Data Contracts

### 3.1 Player Shape — plain-object format (TeamSetup.jsx output)

This is the shape consumed by `MatchView.jsx`, `GameController`, and `playerStats.js`.

```js
{
  name:       string,
  position:   'PG' | 'SG' | 'SF' | 'PF' | 'C',
  skillLevel: number,        // 1–5 integer
  isActive:   boolean,       // defaults to true
  stats: {
    pointsScored: number,    // CANONICAL name inside the engine
    assists:      number,
    rebounds:     number,
    steals:       number,
    blocks:       number,
    // NOTE: fouls, freethrowsMade, freethrows are ABSENT in plain-object players
  },
  // Optional (only present on Player-class or playerCreator instances):
  attributes: {
    Attack, Defense, ThreePoint, FieldGoal, FieldGoalPaint,
    FieldGoalMidRange, DunkLayup, FreeThrow, Passing,
    StealMarking, Blocking, Stamina, Chemistry, Morale
  },
  d20: { Dribble: number, StealMarkingD20: number }
}
```

### 3.2 Team Shape — plain-object format (TeamSetup.jsx output)

```js
{
  name:    string,
  score:   number,           // updated live during simulation
  players: Player[],
  getActivePlayers():   Player[],   // returns first 5 active players
  getActivePlayersOnCourt(): Player[]
}
```

### 3.3 Player Shape — Player class (player.js / playerCreator.js)

The `player.js` class constructor: `new Player(name, position, skillLevel)`.

```js
{
  name, position, skillLevel,  // constructor args
  isActive: true,
  foulCount: 0,
  stats: {
    pointsScored, assists, rebounds, steals, blocks, fouls,
    freethrows,        // ATTEMPTS only (no separate made count in plain Player)
    freethrowsMade,    // PRESENT on Player class, ABSENT on playerCreator objects
    shots2pt: { made, attempted },
    shots3pt: { made, attempted }
  }
}
// Key methods:
//   addFoul()             — disqualifies at 5 (legacy rule)
//   addFoulCommitted()    — disqualifies at 6 (NBA rule)
//   isFouledOut()         — checks foulCount >= 6
//   getFreeThrowSuccessPercent()
//   attemptFreeThrow(made: boolean)
//   getSummary()          — returns flat object with key "points" (not "pointsScored")
```

### 3.4 Firestore Player Document (`players/{playerId}`)

```js
{
  teamId, leagueId, name, age, position, archetype,
  nationality, hometown, height_cm, weight_kg, dominantHand,
  attributes: { Attack, Defense, ThreePoint, FieldGoal, FieldGoalPaint,
                FieldGoalMidRange, DunkLayup, FreeThrow, Passing,
                StealMarking, Blocking, Stamina, Chemistry, Morale },
  d20attrs: { Dribble, StealMarkingD20 },
  potential, salary, xp,
  career: { seasons, totalPoints, totalRebounds, totalAssists,
            totalSteals, totalBlocks },
  createdAt, updatedAt
}
```

### 3.5 Firestore PlayerStats Shape (for `updateMatchResult` / `processMatchResult`)

```js
// REQUIRED format for all Firestore match result writes
{ [playerId]: { pts, reb, ast, stl, blk, to, fgMade, fgAttempted, ftMade, ftAttempted } }
```

**Critical:** This format uses short-key names. The engine produces long-key names. No bridge function between engine output and this format exists anywhere in the codebase.

### 3.6 MatchEngine / GameController Summary Output

```js
{
  homeTeam, awayTeam,
  homeScore, awayScore, score,   // score = "79 - 82" string
  winner,                        // team name or "TIE"
  rounds,
  homeTeamStats: [{ name, position, points, assists, rebounds, steals, blocks }],
  awayTeamStats: [{ name, position, points, assists, rebounds, steals, blocks }]
}
```

### 3.7 Local League Shape (`localLeague.js`)

```js
{
  id, name, season, status,      // status: 'setup' | 'in-progress' | 'completed'
  teams: [{
    id, name, players, isUserTeam,
    stats: { played, wins, draws, losses, pointsFor, pointsAgainst, points }
    // NOTE: "draws" is soccer terminology — basketball games cannot draw
    // NOTE: "points" here means league table points (3 for a win), not game score
  }],
  schedule: [{ id, round, homeTeamId, awayTeamId, homeTeamName, awayTeamName,
               status, homeScore, awayScore, playedAt }],
  maxTeams, currentRound, createdAt
}
```

---

## 4. Canonical Stat Name Mapping

The following table maps the same logical stat across all layers. Mismatches are the primary integration hazard.

| Stat | `player.js` stats field | Engine / GC summary | `seasonManager.js` | Firestore (`processMatchResult`) | `playerStats.js` localStorage |
|------|------------------------|---------------------|-------------------|----------------------------------|-------------------------------|
| Points scored | `pointsScored` | `points` | `pts` | `pts` | `totalPoints` (career), `points` (per game) |
| Rebounds | `rebounds` | `rebounds` | `reb` | `reb` | `rebounds` |
| Assists | `assists` | `assists` | `ast` | `ast` | `assists` |
| Steals | `steals` | `steals` | `stl` | `stl` | `steals` |
| Blocks | `blocks` | `blocks` | `blk` | `blk` | `blocks` |
| Turnovers | NOT TRACKED | NOT TRACKED | `to` | `to` | `turnovers` |
| FG Made | `shots2pt.made + shots3pt.made` | NOT IN SUMMARY | — | `fgMade` | `twoPointMade + threePointMade` |
| FG Attempted | `shots2pt.attempted + shots3pt.attempted` | NOT IN SUMMARY | — | `fgAttempted` | `twoPointAttempts + threePointAttempts` |
| FT Made | `freethrowsMade` | NOT IN SUMMARY | — | `ftMade` | `freeThrowMade` |
| FT Attempted | `freethrows` (attempts only) | NOT IN SUMMARY | — | `ftAttempted` | `freeThrowAttempts` |

**The only bridge function** is `normalizePlayerStatsFromEngine(enginePlayer)` in `src/core/fantasyScoring.js`. It handles `pointsScored → points` and fills in zero for missing fields (turnovers, blocks, minutesPlayed). It has NO call sites — it must be explicitly invoked before any fantasy scoring calculation.

---

## 5. Module Format Reference

| File | Format | Export style |
|------|--------|-------------|
| `src/dice.js` | CommonJS | `module.exports = DiceRoller` |
| `src/player.js` | CommonJS | `module.exports = Player` |
| `src/team.js` | CommonJS | `module.exports = Team` |
| `src/court.js` | CommonJS | `module.exports = Court` |
| `src/narration.js` | CommonJS | `module.exports = { Narration, templates }` |
| `src/actionResolver.js` | ES Module | `export { ActionResolver, POSITION_DICE }` |
| `src/dribbleSystem.js` | ES Module | `export { DribbleSystem }` |
| `src/matchEngine.js` | ES Module | `export { MatchEngine }` |
| `src/gameController.js` | ES Module | `export { GameController }` |
| `src/gameplay/playerCreator.js` | ES Module | named exports |
| `src/gameplay/seasonManager.js` | ES Module | named exports |
| `src/core/fantasyScoring.js` | ES Module | named exports |
| `src/core/tacticsEngine.js` | ES Module | named exports |
| `src/firebase/config.js` | ES Module | named exports |
| `src/firebase/auth.js` | ES Module | named exports |
| `src/firebase/database.js` | ES Module | named exports |
| `src/firebase/league.js` | ES Module | named exports |
| `src/firebase/index.js` | ES Module | barrel (STALE) |
| `src/league/localLeague.js` | ES Module | named exports |
| `src/stats/playerStats.js` | ES Module | named exports |
| `src/court.test.js` | CommonJS-style | `module.exports = { runAllTests }` |

**Why the split exists:** `dice.js`, `player.js`, `team.js`, `court.js`, and `narration.js` were written before Vite was introduced. They use `module.exports` which is incompatible with Vite's strict ESM mode (requires `"type": "module"` in `package.json`).
**Consequence:** `gameController.js` and `MatchView.jsx` both inline their own copies of `DiceRoller` and `Narrator` to avoid this CJS/ESM boundary. This creates three separate implementations of each.

---

## 6. Integration Points and Known Issues

### Issue 1 — `firebase/index.js` stale barrel ✅ FIXED (2026-02-27)

**File:** `src/firebase/index.js`
**Problem:** The barrel exports functions that do not exist in the current `database.js` or `league.js`:
- Exports `saveTeam`, `updateTeam`, `deleteTeam`, `saveMatch`, `getMatchHistory`, `saveGame`, `loadGame`, `getSavedGames`, `updateSave`, `deleteSave`, `savePlayerStats`, `getPlayerStats` — NONE of these are defined in `database.js`
- Exports `addTeamToLeague`, `generateSchedule`, `recordMatchResult`, `getStandings`, `getUpcomingMatches`, `getRecentResults`, `startNewSeason` from `league.js` — NONE of these are defined in `league.js`
- Exports `getUserData` from `auth.js` — `auth.js` does not export `getUserData`

**Impact:** `AuthContext.jsx` imports `getUserData` from this barrel. It will always be `undefined`, silently breaking user data loading after login.

**Required fix:** Rewrite `firebase/index.js` to only re-export functions that actually exist in the backing modules.

---

### Issue 2 — Three parallel simulation implementations ✅ FIXED (2026-02-27) (ARCHITECTURAL RISK)

**Files:** `src/matchEngine.js`, `src/gameController.js`, `src/ui/MatchView.jsx`

All three files contain independent full match simulation loops. They are NOT wired together.

| Implementation | Used by | Dice/Narration | Foul bonus threshold | Steal chance |
|----------------|---------|----------------|----------------------|--------------|
| `matchEngine.js` | Nothing (no call sites in UI) | Global DiceRoller + global Narration | 5 fouls/quarter | 25% |
| `gameController.js` | Not yet wired to any UI component | Inline DiceRoller + inline Narrator | 4 fouls/quarter | 20% |
| `MatchView.jsx` | `App.jsx` (production path) | Inline DiceRoller + inline Narrator | 4 fouls/quarter | 20% |

**The actual production simulation is the one inside `MatchView.jsx`.** The other two are not invoked. Changes to `matchEngine.js` have zero effect on running games.

---

### Issue 3 — `matchEngine.js` missing imports ✅ FIXED (2026-02-27) (BLOCKING if used)

**File:** `src/matchEngine.js`

| Line | Usage | Missing import |
|------|-------|----------------|
| 21 | `this.court = new Court(50, 30)` | `Court` |
| 40 | `typeof Narration !== 'undefined'` | `Narration` |
| 623 | `DiceRoller.rollDie(20)` | `DiceRoller` |

If `MatchEngine` is ever imported and instantiated, it will throw `ReferenceError: Court is not defined` at line 21.

---

### Issue 4 — `actionResolver.js` and `dribbleSystem.js` are imported but never called in the active simulation

**File:** `src/gameController.js` lines 20–21

Both modules are imported, but `_simulateRound()` uses none of their methods. The steal check at line 694–698 of `gameController.js` uses inline dice math (a custom formula) rather than `DribbleSystem.resolveDribbleContest()`. The shot resolution at lines 760–767 uses a simple d20 + skillBonus check rather than `ActionResolver.resolve2PointerAttempt()`.

**Consequence:** The position-based dice tables in `POSITION_DICE` (actionResolver.js) and the formal d20 threshold formula in `DribbleSystem` are bypassed entirely in production.

---

### Issue 5 — `tacticsEngine.js` is complete but has zero call sites (UNWIRED)

**File:** `src/core/tacticsEngine.js`

All exported functions (`applyPlayStyleModifiers`, `applyDefensiveSchemeModifiers`, `calculateChemistryBonus`, `createGamePlan`) are fully implemented. No file in the project imports from `tacticsEngine.js`. Tactics modifiers do not affect simulation outcomes.

---

### Issue 6 — Stat format mismatch breaks the Firestore pipeline

**The chain:**

```
Engine produces:          { points, rebounds, assists, steals, blocks }
      ↓ (missing bridge)
Firestore requires:       { pts, reb, ast, stl, blk, to, fgMade, fgAttempted, ftMade, ftAttempted }
```

`league.js:processMatchResult()` (line 362) expects the short-key format.
`seasonManager.js:_computeFantasyFromMatchStats()` (line 392) expects the short-key format with `stats.teamId` on each entry.
`normalizePlayerStatsFromEngine()` in `fantasyScoring.js` converts player objects to the intermediate long-key format, but stops short of the Firestore short-key format.

**No complete bridge function exists** that takes game engine output all the way to the Firestore/seasonManager format.

---

### Issue 7 — `fantasyScoring.js` DEFAULT_SCORING_CONFIG duplicated in `database.js`

**Files:** `src/core/fantasyScoring.js` (line 25), `src/firebase/database.js` (line 428)

Both define `DEFAULT_SCORING_CONFIG` independently. They are currently identical, but any future modification to one will silently diverge from the other.

---

### Issue 8 — `localLeague.js` soccer-style standings ✅ FIXED (2026-02-27) (draws, 3-point wins)

**File:** `src/league/localLeague.js` lines 99–107, 216–225

Team stats include a `draws` counter and a `points` field that awards 3 for a win and 1 for a draw. Basketball does not have draws. This creates conceptual confusion and differs from the `seasonManager.js` standings model (which uses `wins`, `losses`, `fantasyPts`).

---

### Issue 9 — `playerStats.js:recordMatchStats` passes player as its own gameStats

**File:** `src/stats/playerStats.js` lines 119–126

```js
homePlayers.forEach(player => {
  recordGameStats({ ...player, teamName: homeTeamName }, player);
  //                                                    ^^^^^^ same object as gameStats
});
```

`recordGameStats` reads `gameStats.points` (not `pointsScored`), meaning the points will always be 0 for engine-produced plain-object players (which store `stats.pointsScored`, not a top-level `points` field).

---

### Issue 10 — `AuthContext.jsx` calls nonexistent `getUserData` ✅ FIXED (2026-02-27)

**File:** `src/contexts/AuthContext.jsx` line 14

Imports `getUserData` from `../firebase/index.js`. As established in Issue 1, `firebase/index.js` re-exports `getUserData` from `auth.js` — but `auth.js` does not export `getUserData`. This will cause silent `undefined` access at runtime, and user profile data will never load.

---

### Issue 11 — `narration.js` key names differ from `gameController.js` and `MatchView.jsx`

**Files:** `src/narration.js`, `src/gameController.js`, `src/ui/MatchView.jsx`

`narration.js` defines templates for `freeThrowMade` and `freeThrowMissed`.
`gameController.js` and `MatchView.jsx` use `freeThrowMake` and `freeThrowMiss`.
If `narration.js` is ever properly imported (after the CJS/ESM issue is resolved), all free throw narration will fall back to the `[freeThrowMake]` / `[freeThrowMiss]` fallback string instead of real commentary.

---

### Issue 12 — `playerCreator.js` getter alias `rebounding` maps to `FieldGoalPaint`

**File:** `src/gameplay/playerCreator.js`

The getter `player.rebounding` is aliased to `player.attributes.FieldGoalPaint`. This is semantically incorrect — rebounding ability is not the same as in-paint shooting. `actionResolver.js` reads `player.rebounding` for rebound contests. This results in players with high paint shooting being rated as elite rebounders.

---

## 7. Current Gaps

### Gap 1 — No call sites exist for `normalizePlayerStatsFromEngine()`

The bridge function exists in `fantasyScoring.js` but is never called. Fantasy scoring is therefore never computed in a live match context.

### Gap 2 — No bridge from engine summary to Firestore stat format

After a match ends, `GameController._buildSummary()` produces stats with long keys. There is no function that transforms this into the `{ pts, reb, ast, stl, blk, to, fgMade, fgAttempted, ftMade, ftAttempted }` format required by `processMatchResult()`.

### Gap 3 — Turnovers are never tracked

No simulation path (MatchView, GameController, or MatchEngine) increments `player.stats.turnovers` or any equivalent field. All Firestore `to` fields will be 0. Fantasy point deductions for turnovers will never apply.

### Gap 4 — `matchEngine.js` is orphaned

`MatchEngine` has no call sites in the UI. It is never imported by `App.jsx`, `GameController`, or any component. The foul system it contains (proper `ActionResolver.checkFoulOnShotAttempt`, `handleShotFoul`, `handleNonShootingFoul`) is more correct than the production simulation in `MatchView.jsx`, but these code paths are entirely unreachable.

### Gap 5 — `leagueView.jsx` passes raw team objects to `onPlayMatch` without adding `getActivePlayers`

**File:** `src/ui/LeagueView.jsx` lines 63–71

```js
const homeTeam = league.teams.find(t => t.id === nextUserMatch.homeTeamId);
```

Teams stored in `localLeague.js` are plain objects created by `generateAITeams()` (which uses `addTeamToLocalLeague`). They do NOT have `getActivePlayers()` methods. When `MatchView.jsx` tries to call `offenseTeam.players.filter(...)`, it will work because the raw `players` array is accessed directly — but `TeamSetup.jsx` adds `getActivePlayers` manually. AI teams added by `generateAITeams` skip that step and will not be compatible if the simulation path is changed to call `team.getActivePlayers()`.

### Gap 6 — No test runner configured

`package.json` scripts contain `"test": "echo \"Error: no test specified\" && exit 1"`. The three test files (`actionResolver.test.js`, `dribbleSystem.test.js`, `court.test.js`) must be run manually with `node` (ES module files require `--input-type=module`) or through a browser. None are integrated into any CI pipeline.

### Gap 7 — `firebase/index.js` barrel is stale and blocks Auth

See Issue 1. Until this barrel is rewritten, `AuthContext.jsx` cannot fetch user document data.

---

## 8. Test Coverage Map

| Module | Test File | Test Type | Can Run Today? |
|--------|-----------|-----------|----------------|
| `actionResolver.js` | `actionResolver.test.js` | Manual node script | YES — ES module, `node --input-type=module src/actionResolver.test.js` |
| `dribbleSystem.js` | `dribbleSystem.test.js` | Manual node script | YES — ES module |
| `court.js` | `court.test.js` | Manual in-browser | NO — requires global `Court`, `Player`, `Team` from CommonJS files loaded first |
| `player.js` | None | — | Not covered |
| `team.js` | None | — | Not covered |
| `dice.js` | None | — | Not covered |
| `matchEngine.js` | None | — | Not covered (also broken: missing imports) |
| `gameController.js` | `gameController.test.js` | Manual node script | YES — ES module |
| `narration.js` | None | — | Not covered |
| `fantasyScoring.js` | `core/fantasyScoring.test.js` | Manual node script | YES — ES module |
| `seasonManager.js` | `gameplay/seasonManager.test.js` | Manual node script | YES — ES module |
| `playerCreator.js` | `gameplay/playerCreator.test.js` | Manual node script | YES — ES module |
| `tacticsEngine.js` | `core/tacticsEngine.test.js` | Manual node script | YES — ES module |
| `localLeague.js` | None | — | Not covered |
| `playerStats.js` | None | — | Not covered |
| Firebase layer | None | — | Not covered |

---

## 9. Phase Gate Checklist

The following items must be resolved before work on each phase can be treated as complete.

### Phase 0 Gate (Core Simulation — CURRENT PHASE)

- [x] Fix `firebase/index.js` barrel (Issue 1) — re-export only real functions
- [x] Fix `AuthContext.jsx` getUserData import (Issue 10)
- [ ] Resolve CJS/ESM split for `dice.js`, `player.js`, `team.js`, `court.js`, `narration.js`
      (recommended: add `export` alongside existing `module.exports` or convert fully to ESM)
- [ ] Add three missing imports to `matchEngine.js` (Issue 3): `Court`, `Narration`, `DiceRoller`
- [ ] Decide on canonical simulation path: either consolidate MatchView/GameController/MatchEngine
      into one implementation or document the boundary explicitly
- [ ] Wire `ActionResolver.resolve2PointerAttempt` / `resolve3PointerAttempt` into the active simulation
- [ ] Wire `DribbleSystem.resolveDribbleContest` into the active steal resolution
- [ ] Implement the engine→Firestore stat format bridge (Gap 2)
- [ ] Add turnover tracking to the active simulation path (Gap 3)
- [ ] Fix `playerCreator.js` `rebounding` getter alias (Issue 12): map to `Blocking` or a composite

### Phase 1 Gate (League Mode)

- [ ] All Phase 0 gates passed
- [ ] `processMatchResult` can receive engine output after format bridge is applied
- [ ] `seasonManager.js` standings calculation uses same stat key format as engine
- [ ] `localLeague.js` standings model converted from soccer (draws/league points) to basketball
- [ ] `LeagueView.jsx` passed teams include `getActivePlayers()` method

### Phase 2 Gate (Fantasy Scoring)

- [ ] All Phase 1 gates passed
- [ ] `normalizePlayerStatsFromEngine()` called at every match-end event
- [ ] `DEFAULT_SCORING_CONFIG` deduplication: one source of truth (fantasyScoring.js)
- [ ] `database.js` `DEFAULT_SCORING_CONFIG` deleted; `fantasyScoring.js` version imported instead
- [ ] `league.js` inline `calcFantasyPts()` replaced with `calculatePlayerFantasyPoints()` from fantasyScoring.js

### Phase 3 Gate (Tactics)

- [ ] All Phase 2 gates passed
- [ ] `tacticsEngine.js` imported into active simulation path
- [ ] `applyPlayStyleModifiers` called on ball carrier stats before shot resolution
- [ ] `applyDefensiveSchemeModifiers` called on defender stats
- [ ] `calculateChemistryBonus` applied to team-level shot modifiers

---

## 10. Canonical Integration Recipe

This section defines the exact call sequence a developer or agent must follow when integrating the simulation engine with the Firebase backend for a complete match result.

### Step 1 — Create team objects compatible with the engine

```js
// Use TeamSetup.jsx's handleStartMatch() pattern, or:
const team = {
  name: 'Team Name',
  score: 0,
  players: players.map(p => ({
    name: p.name,
    position: p.position,
    skillLevel: p.skillLevel,          // integer 1–5
    isActive: true,
    stats: { pointsScored: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0 }
  })),
  getActivePlayers() { return this.players.filter(p => p.isActive).slice(0, 5); }
};
```

### Step 2 — Run the match

```js
import { GameController } from './gameController.js';

const gc = new GameController(homeTeam, awayTeam, { language: 'pt', speed: 0 });
const summary = await gc.runFullMatch();
// summary.homeScore, summary.awayScore, summary.homeTeamStats, summary.awayTeamStats
```

### Step 3 — Convert engine stat output to Firestore format

No utility function currently exists. Until one is created, use this recipe inline:

```js
function engineStatsToFirestore(teamStatArray, teamId) {
  const result = {};
  for (const p of teamStatArray) {
    if (!p.id) continue;          // requires player to have a Firestore id
    result[p.id] = {
      pts:          p.points        || 0,
      reb:          p.rebounds      || 0,
      ast:          p.assists       || 0,
      stl:          p.steals        || 0,
      blk:          p.blocks        || 0,
      to:           0,              // WARNING: turnovers not tracked (Gap 3)
      fgMade:       0,              // WARNING: FG splits not tracked in summary
      fgAttempted:  0,              // WARNING: tracked per-player in Player class only
      ftMade:       0,              // WARNING: not in GameController summary output
      ftAttempted:  0,
    };
  }
  return result;
}
```

### Step 4 — Apply fantasy scoring

```js
import { normalizePlayerStatsFromEngine, calculatePlayerFantasyPoints,
         DEFAULT_SCORING_CONFIG } from './core/fantasyScoring.js';

// For each player in the engine output:
const normalized = normalizePlayerStatsFromEngine(enginePlayerStat);
const fantasyPts = calculatePlayerFantasyPoints(normalized, DEFAULT_SCORING_CONFIG);
```

### Step 5 — Persist results to Firestore

```js
import { processMatchResult } from './firebase/league.js';

const playerStats = {
  ...engineStatsToFirestore(summary.homeTeamStats),
  ...engineStatsToFirestore(summary.awayTeamStats)
};

const result = await processMatchResult(
  matchId,
  summary.homeScore,
  summary.awayScore,
  playerStats,
  summary.events
);
if (result.error) { console.error(result.error); }
```

### Step 6 — Record local stats (guest mode)

```js
import { recordMatchStats } from './stats/playerStats.js';

// NOTE: playerStats.js expects { points } not { pointsScored }
// Map first:
const homeStatsForLocal = summary.homeTeamStats.map(p => ({ ...p })); // already uses "points"
const awayStatsForLocal = summary.awayTeamStats.map(p => ({ ...p }));

recordMatchStats(homeStatsForLocal, awayStatsForLocal, homeTeam.name, awayTeam.name);
```

---

## Appendix A — Attribute Scale Reference

| Scale | Used in | Purpose |
|-------|---------|---------|
| 1–5 | `player.js`, `team.js`, `TeamSetup.jsx` | Legacy skill level — maps to dice roll bonuses |
| 1–99 | `playerCreator.js` `attributes.*`, `actionResolver.js` | Full attribute scale — used in probability formula |
| 1–20 (d20) | `playerCreator.js` `d20.*`, `dribbleSystem.js` | Dribble and steal contests — lower threshold is better |

Conversion from scale 1–5 to 1–99 (used in `matchEngine.js` for backwards compat):
- `shooting = skillLevel * 18 + 10`
- `defense  = skillLevel * 18 + 10`
- `blocking = skillLevel * 14`
- `rebounding = skillLevel * 15 + 10`

---

## Appendix B — Probability Formulas

### Shot Success Percentage (ActionResolver, 1–99 scale)

```
A = attacker attribute, D = defender attribute

if A > D:  successPct = 100 - (2*D - A) / 2
if A < D:  successPct = (2*A - D) / 2
if A = D:  successPct = 50
Result clamped to [2, 98]
```

### d20 Dribble/Steal Contest Threshold (DribbleSystem)

```
threshold = 20 - (dribblingAttr - stealingAttr)
threshold clamped to [1, 21]
roll = d20 (1–20)
success = roll >= threshold
successPct = ((21 - threshold) / 20) * 100, clamped to [0, 100]
```

### Foul Probabilities (ActionResolver)

```
Shooting foul (2pt attempt): 15% base
Shooting foul (3pt attempt): 12% base
Reach-in foul (dribble):     10% base
```

---

## Appendix C — File Count and Line Count Summary

| Category | Files | Approximate Lines |
|----------|-------|-------------------|
| Core simulation engine | 5 (dice, player, team, court, narration) | ~1,000 |
| ES module simulation | 4 (actionResolver, dribbleSystem, matchEngine, gameController) | ~1,800 |
| Gameplay systems | 2 (playerCreator, seasonManager) | ~1,400 |
| Core features | 2 (fantasyScoring, tacticsEngine) | ~700 |
| Firebase layer | 4 (config, auth, database, league) + 1 index | ~1,100 |
| Local persistence | 2 (localLeague, playerStats) | ~700 |
| React UI | 11 (all .jsx + contexts) | ~2,800 |
| Tests | 3 | ~380 |
| Config | 2 (package.json, vite.config.js) | ~50 |
| **Total** | **~40** | **~9,930** |
