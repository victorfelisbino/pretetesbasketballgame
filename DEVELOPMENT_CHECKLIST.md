# 📋 Daily Development Checklist & Progress Log

**Project:** Quadra Legacy  
**Phase:** 0 - Web MVP (Core Engine)  
**Target Duration:** 2 weeks (Jan 1-14, 2026)

---

## 🎯 Phase 0 Daily Tasks

### Day 1-2: Court Grid System

**Task: Create src/court.js**

- [x] Define court dimensions (50×30 grid)
- [x] Create player position class with (x, y) coordinates
- [x] Implement position-based movement speed:
  - [x] PG: 10 squares/round (with ball), 13 (without)
  - [x] SG: 8 squares/round (with ball), 11 (without)
  - [x] SF: 7 squares/round (with ball), 10 (without)
  - [x] PF: 6 squares/round (with ball), 8 (without)
  - [x] C: 5 squares/round (with ball), 7 (without)
- [x] Add boundary detection (can't move off-court)
- [x] Create helper functions:
  - [x] `canPlayerMove(player, direction, roundsLeft)`
  - [x] `getMaxMovement(position, hasBall)`
  - [x] `distanceBetween(player1, player2)`
  - [x] `getPlayersInZone(x, y, radius)`
- [x] Export Court class

**Status:** ✅ Complete  
**Completion:** 01/02/26  
**Notes:** Full court system with player positioning and movement

---

### Day 2-3: Match Simulation Engine

**Task: Create src/matchEngine.js**

- [x] Create GameState class with:
  - [x] Quarter (1-4)
  - [x] Possession counter (≈100 total)
  - [x] Current possession (1-5 rounds)
  - [x] Score (home/away)
  - [x] Ball possession (which team)
  - [x] Ball handler (which player)
- [x] Implement game loop:
  - [x] `simulateRound(gameState, offenseActions, defenseActions)`
  - [x] `switchPossession()`
  - [x] `endQuarter()`
  - [x] `isGameOver()`
- [x] Create possession flow:
  - [x] Round 1: Offense positioning
  - [x] Round 2: Defense positioning
  - [x] Round 3-5: Play execution
- [x] Event system for narration:
  - [x] `gameState.events = []`
  - [x] Each action logs event: `{ type, player, result, timestamp }`
- [x] Export MatchEngine class

**Status:** ✅ Complete  
**Completion:** 01/02/26  
**Notes:** Integrated with ActionResolver and DribbleSystem

---

### Day 3-4: Action Resolver

**Task: Create src/actionResolver.js**

- [x] Implement YOUR attack vs defense formula:
  - [x] `calculateSuccessPercentage(attackerSkill, defenderSkill)`
  - [x] Test with examples (A=99, B=51 should be 98%)
- [x] Implement position-based dice outcomes:
  - [x] `rollForAction(actionType, position)`
  - [x] 2-point: C rolls 2d6, PF rolls 1d8, PG rolls 1d4
  - [x] 3-point: SG/SF roll 1d6, PG rolls 1d3
  - [x] Rebounds: C rolls 3d6, PF rolls 2d6, SF rolls 1d6
  - [x] Assists: PG rolls 1d10, SG rolls 1d6
  - [x] Steals: PG rolls 1d4+1d6, SG rolls 1d2+1d3
  - [x] Blocks: C rolls 1d8+1d10, PF rolls 1d4+1d5
- [x] Handle outcomes:
  - [x] Success: Add points/assist/rebound
  - [x] Failure: Turnover/blocked shot/bad pass
- [x] Create ResolveAction class with:
  - [x] `resolve2PointerAttempt(attacker, defender)`
  - [x] `resolve3PointerAttempt(attacker, defender)`
  - [x] `resolveReboundContest(offPlayer, defPlayer)`
  - [x] `resolvePassAttempt(passer, receiver, defender)`
- [x] Export ActionResolver class

**Status:** ✅ Complete  
**Completion:** 01/02/26  
**Notes:** Full position-based dice system with tests passing

---

### Day 4-5: Dribble vs Steal System

**Task: Create src/dribbleSystem.js**

- [x] Implement d20 dribble contest:
  - [x] `calculateDribbleSuccess(dribbleAttribute, stealAttribute)`
  - [x] Formula: `difference = dribble - steal_marking`
  - [x] `threshold = 20 - difference`
  - [x] `roll >= threshold to succeed`
- [x] Test cases:
  - [x] Dribble 16 vs Steal 2 → threshold 6 → 75% ✅
  - [x] Dribble 10 vs Steal 10 → threshold 20 → 5% (tied)
  - [x] Dribble 5 vs Steal 15 → threshold 30 → impossible (0%) ✅
- [x] Handle outcomes:
  - [x] Success: Player advances with ball
  - [x] Failure: Turnover (defender steals)
- [x] Integrate into MatchEngine:
  - [x] Call dribbleSystem on dribble actions
  - [x] Apply success/failure results
- [x] Create DribbleSystem class
- [x] Export DribbleSystem class

**Status:** ✅ Complete  
**Completion:** 01/02/26  
**Notes:** D20 system with all test cases passing

---

### Day 5-6: Portuguese Narration Engine

**Task: Create src/narration.js**

- [x] Create narration templates (Portuguese):
  - [x] Possession start: "Time A na reposição..."
  - [x] Dribble: "{jogador} avança com a bola!"
  - [x] Pass: "Passa para {alvo}!"
  - [x] Shot attempt: "Tentativa de {2|3} pontos..."
  - [x] Made basket: "CESTA! {time} {score}!"
  - [x] Missed: "ERROU!"
  - [x] Rebound: "REBOTE! {jogador} pega!"
  - [x] Steal: "ROUBO! {defensor} recupera!"
  - [x] Block: "TOCO! Defesa espetacular!"
  - [x] Turnover: "BOLA PERDIDA!"
- [x] Create NarrationEngine class:
  - [x] `generateNarration(event, gameState)`
  - [x] Returns formatted string: "⏱ 8:32 - M. Santos avança com a bola!"
- [x] Handle randomization:
  - [x] Multiple templates per action (avoid repetition)
  - [x] Random selection from array
- [x] Time formatting:
  - [x] `formatTime(round)` → "8:32" format
- [x] Export NarrationEngine class

**Status:** ✅ Complete  
**Completion:** 01/02/26  
**Notes:** Full bilingual narration (PT/EN) with blocks, rebounds, and all events

---

### Day 6-7: React UI - Match View

**Task: Create src/ui/MatchView.jsx**

- [x] Create React component:
  - [x] Display court canvas (500px wide min, mobile responsive)
  - [x] Show player positions on court
  - [x] Display ball position
  - [x] Update in real-time
- [x] Create scoreboard:
  - [x] Team A score & name
  - [x] Team B score & name
  - [x] Quarter display (Q1-Q4)
  - [x] Possession counter
- [x] Create narration log:
  - [x] Scrollable list of recent events
  - [x] Max 10 visible lines
  - [x] Auto-scroll to latest
  - [x] Timestamp for each event
- [x] Create control buttons:
  - [x] "Start Match"
  - [x] "Pause" (for testing)
  - [x] "Speed Up" (2x, 4x simulation)
- [x] Mobile responsive:
  - [x] Works at 320px width
  - [x] Touch-friendly buttons
  - [x] Readable on phone screen
- [x] Export MatchView component

**Status:** ✅ Complete  
**Completion:** 01/02/26  
**Notes:** Full UI with court visualization, fouls, free throws, and play types

---

### Day 7: Integration & First Match

**Task: Create src/gameController.js & wire everything**

- [x] Create GameController class:
  - [x] Initialize teams (test rosters)
  - [x] Initialize match engine
  - [x] Run simulation loop
  - [x] Collect narration events
  - [x] Return final match result
- [x] Wire to React:
  - [x] GameController state in MatchView
  - [x] Update UI on each round
  - [x] Display narration in real-time
- [x] Run first test match:
  - [x] Team A (random 5 players) vs Team B (random 5 players)
  - [x] Simulate 4 quarters
  - [x] Check score is reasonable (80-120 ppg)
  - [ ] Verify all events logged
  - [ ] Check narration displays correctly
- [ ] Debug & fix:
  - [ ] Check for console errors
  - [ ] Verify dice probabilities
  - [ ] Test dribble success rate
  - [ ] Validate action outcomes

**Status:** ⬜ Not Started  
**Completion:** __/__/26  
**Notes:**

---

## 📊 Progress Summary

### Completed Tasks ✅
- [x] Design document review
- [x] Development roadmap created
- [x] Dice system (src/dice.js)
- [x] Player class (src/player.js)
- [x] Team class (src/team.js)

### In Progress 🟡
- [ ] Court grid system

### Not Started ⬜
- [ ] Match simulation engine
- [ ] Action resolver
- [ ] Dribble system
- [ ] Narration engine
- [ ] React UI
- [ ] Integration & first match

### Overall Completion: 15% (1 of 7 major tasks)

---

## 🧪 Testing Log

### Unit Tests

**Dice System Tests:**
- [ ] Test 1d6: Average should be 3.5 over 1000 rolls
- [ ] Test 3d6: Average should be 10.5 over 1000 rolls
- [ ] Test combined (1d4+1d6): Results between 2-10

**Probability Formula Tests:**
- [ ] A=99, B=51: Should be ~98% success
- [ ] A=51, B=99: Should be ~2% success
- [ ] A=75, B=75: Should be 50% success
- [ ] Edge cases (A=1, B=99): Should be 0-1%

**Dribble System Tests:**
- [ ] Dribble 16 vs Steal 2: 70% success rate
- [ ] Dribble 10 vs Steal 10: ~5% success rate
- [ ] Dribble 5 vs Steal 15: 0% success rate (impossible)

### Integration Tests

**Full Match Tests:**
- [ ] Match 1: Team A (random) vs Team B (random)
  - [ ] Completion status: ⬜
  - [ ] Final score: ____ - ____
  - [ ] Duration: ____ seconds
  - [ ] Issues: ____________
  
- [ ] Match 2: High-skill team vs Low-skill team
  - [ ] Completion status: ⬜
  - [ ] Final score: ____ - ____
  - [ ] Duration: ____ seconds
  - [ ] Issues: ____________
  
- [ ] Match 3: Equal-skill teams
  - [ ] Completion status: ⬜
  - [ ] Final score: ____ - ____
  - [ ] Duration: ____ seconds
  - [ ] Issues: ____________

### Balance Testing

- [ ] Average score range: Should be 80-120 per team
- [ ] Skill advantage: Better team wins 60-70% of time
- [ ] Variance: Different matches have different scores
- [ ] Narration: No obvious bugs or typos

---

## 🐛 Bug Reports

### Found Bugs

| # | Title | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | Example Bug | High | ⬜ Open | Description here |

### Known Limitations (Phase 0)

- [ ] No fouls system (added Phase 1)
- [ ] No substitutions (added Phase 2)
- [ ] No free throws (added Phase 1)
- [ ] Simple AI (random play selection)
- [ ] No localStorage (Firebase in Phase 1)

---

## 💬 Notes & Decisions

### Technical Decisions Made
- **Language:** JavaScript (React) for web MVP
- **Court Size:** 50×30 grid (decision pending)
- **Match Duration:** ~2 minutes (decision pending)
- **State Management:** React hooks (useState for now)

### Questions to Resolve
1. Court size: 50×30 vs 30×20?
2. Game speed: 1 min vs 3-5 min per match?
3. Starting lineups: Balanced or random?
4. Player names: Random or predefined?

### Meeting Notes
- __(Add notes from discussions)__

---

## 📅 Week 1-2 Timeline

```
Week 1 (Jan 1-7):
│
├─ Days 1-2: Court Grid
├─ Days 2-3: Match Engine
├─ Days 3-4: Action Resolver
├─ Days 4-5: Dribble System
├─ Days 5-6: Narration
├─ Days 6-7: React UI
└─ Day 7: Integration

Week 2 (Jan 8-14):
│
├─ Days 8-9: Testing & Debugging
├─ Days 10-12: Balance Adjustments
├─ Days 13-14: Polish & Optimization
└─ END OF PHASE 0 ✅
```

---

## ✅ Success Checklist (Phase 0 Complete When)

- [ ] One full match completes (4 quarters × 100 rounds)
- [ ] Score is balanced (80-120 ppg range)
- [ ] Narration displays in Portuguese
- [ ] Dice probabilities match formulas
- [ ] Dribble/steal d20 system works
- [ ] React UI shows match in real-time
- [ ] Can play with different random teams
- [ ] Better teams win more often (~60%)
- [ ] No critical bugs
- [ ] Runs without errors on React dev server

**Phase 0 Ready for Phase 1:** ⬜ (Target: Jan 14, 2026)

---

**Document Version:** 1.0  
**Last Updated:** January 1, 2026  
**Status:** 🟡 Just Started
