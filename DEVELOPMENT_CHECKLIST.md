# 📋 Daily Development Checklist & Progress Log

**Project:** Pretetê's Basketball Game  
**Phase:** 0 - Web MVP (Core Engine)  
**Target Duration:** 2 weeks (Jan 1-14, 2026)

---

## 🎯 Phase 0 Daily Tasks

### Day 1-2: Court Grid System

**Task: Create src/court.js**

- [ ] Define court dimensions (50×30 grid)
- [ ] Create player position class with (x, y) coordinates
- [ ] Implement position-based movement speed:
  - [ ] PG: 10 squares/round (with ball), 13 (without)
  - [ ] SG: 8 squares/round (with ball), 11 (without)
  - [ ] SF: 7 squares/round (with ball), 10 (without)
  - [ ] PF: 6 squares/round (with ball), 8 (without)
  - [ ] C: 5 squares/round (with ball), 7 (without)
- [ ] Add boundary detection (can't move off-court)
- [ ] Create helper functions:
  - [ ] `canPlayerMove(player, direction, roundsLeft)`
  - [ ] `getMaxMovement(position, hasBall)`
  - [ ] `distanceBetween(player1, player2)`
  - [ ] `getPlayersInZone(x, y, radius)`
- [ ] Export Court class

**Status:** ⬜ Not Started  
**Completion:** __/__/26  
**Notes:**

---

### Day 2-3: Match Simulation Engine

**Task: Create src/matchEngine.js**

- [ ] Create GameState class with:
  - [ ] Quarter (1-4)
  - [ ] Possession counter (≈100 total)
  - [ ] Current possession (1-5 rounds)
  - [ ] Score (home/away)
  - [ ] Ball possession (which team)
  - [ ] Ball handler (which player)
- [ ] Implement game loop:
  - [ ] `simulateRound(gameState, offenseActions, defenseActions)`
  - [ ] `switchPossession()`
  - [ ] `endQuarter()`
  - [ ] `isGameOver()`
- [ ] Create possession flow:
  - [ ] Round 1: Offense positioning
  - [ ] Round 2: Defense positioning
  - [ ] Round 3-5: Play execution
- [ ] Event system for narration:
  - [ ] `gameState.events = []`
  - [ ] Each action logs event: `{ type, player, result, timestamp }`
- [ ] Export MatchEngine class

**Status:** ⬜ Not Started  
**Completion:** __/__/26  
**Notes:**

---

### Day 3-4: Action Resolver

**Task: Create src/actionResolver.js**

- [ ] Implement YOUR attack vs defense formula:
  - [ ] `calculateSuccessPercentage(attackerSkill, defenderSkill)`
  - [ ] Test with examples (A=99, B=51 should be 98%)
- [ ] Implement position-based dice outcomes:
  - [ ] `rollForAction(actionType, position)`
  - [ ] 2-point: C rolls 2d6, PF rolls 1d8, PG rolls 1d4
  - [ ] 3-point: SG/SF roll 1d6, PG rolls 1d3
  - [ ] Rebounds: C rolls 3d6, PF rolls 2d6, SF rolls 1d6
  - [ ] Assists: PG rolls 1d10, SG rolls 1d6
  - [ ] Steals: PG rolls 1d4+1d6, SG rolls 1d2+1d3
  - [ ] Blocks: C rolls 1d8+1d10, PF rolls 1d4+1d5
- [ ] Handle outcomes:
  - [ ] Success: Add points/assist/rebound
  - [ ] Failure: Turnover/blocked shot/bad pass
- [ ] Create ResolveAction class with:
  - [ ] `resolve2PointerAttempt(attacker, defender)`
  - [ ] `resolve3PointerAttempt(attacker, defender)`
  - [ ] `resolveReboundContest(offPlayer, defPlayer)`
  - [ ] `resolvePassAttempt(passer, receiver, defender)`
- [ ] Export ActionResolver class

**Status:** ⬜ Not Started  
**Completion:** __/__/26  
**Notes:**

---

### Day 4-5: Dribble vs Steal System

**Task: Create src/dribbleSystem.js**

- [ ] Implement d20 dribble contest:
  - [ ] `calculateDribbleSuccess(dribbleAttribute, stealAttribute)`
  - [ ] Formula: `difference = dribble - steal_marking`
  - [ ] `threshold = 20 - difference`
  - [ ] `roll >= threshold to succeed`
- [ ] Test cases:
  - [ ] Dribble 16 vs Steal 2 → threshold 6 → 70% ✅
  - [ ] Dribble 10 vs Steal 10 → threshold 20 → 5% (tied)
  - [ ] Dribble 5 vs Steal 15 → threshold 30 → impossible (0%) ✅
- [ ] Handle outcomes:
  - [ ] Success: Player advances with ball
  - [ ] Failure: Turnover (defender steals)
- [ ] Integrate into MatchEngine:
  - [ ] Call dribbleSystem on dribble actions
  - [ ] Apply success/failure results
- [ ] Create DribbleSystem class
- [ ] Export DribbleSystem class

**Status:** ⬜ Not Started  
**Completion:** __/__/26  
**Notes:**

---

### Day 5-6: Portuguese Narration Engine

**Task: Create src/narration.js**

- [ ] Create narration templates (Portuguese):
  - [ ] Possession start: "Time A na reposição..."
  - [ ] Dribble: "{jogador} avança com a bola!"
  - [ ] Pass: "Passa para {alvo}!"
  - [ ] Shot attempt: "Tentativa de {2|3} pontos..."
  - [ ] Made basket: "CESTA! {time} {score}!"
  - [ ] Missed: "ERROU!"
  - [ ] Rebound: "REBOTE! {jogador} pega!"
  - [ ] Steal: "ROUBO! {defensor} recupera!"
  - [ ] Block: "TOCO! Defesa espetacular!"
  - [ ] Turnover: "BOLA PERDIDA!"
- [ ] Create NarrationEngine class:
  - [ ] `generateNarration(event, gameState)`
  - [ ] Returns formatted string: "⏱ 8:32 - M. Santos avança com a bola!"
- [ ] Handle randomization:
  - [ ] Multiple templates per action (avoid repetition)
  - [ ] Random selection from array
- [ ] Time formatting:
  - [ ] `formatTime(round)` → "8:32" format
- [ ] Export NarrationEngine class

**Status:** ⬜ Not Started  
**Completion:** __/__/26  
**Notes:**

---

### Day 6-7: React UI - Match View

**Task: Create src/ui/MatchView.jsx**

- [ ] Create React component:
  - [ ] Display court canvas (500px wide min, mobile responsive)
  - [ ] Show player positions on court
  - [ ] Display ball position
  - [ ] Update in real-time
- [ ] Create scoreboard:
  - [ ] Team A score & name
  - [ ] Team B score & name
  - [ ] Quarter display (Q1-Q4)
  - [ ] Possession counter
- [ ] Create narration log:
  - [ ] Scrollable list of recent events
  - [ ] Max 10 visible lines
  - [ ] Auto-scroll to latest
  - [ ] Timestamp for each event
- [ ] Create control buttons:
  - [ ] "Start Match"
  - [ ] "Pause" (for testing)
  - [ ] "Speed Up" (2x, 4x simulation)
- [ ] Mobile responsive:
  - [ ] Works at 320px width
  - [ ] Touch-friendly buttons
  - [ ] Readable on phone screen
- [ ] Export MatchView component

**Status:** ⬜ Not Started  
**Completion:** __/__/26  
**Notes:**

---

### Day 7: Integration & First Match

**Task: Create src/gameController.js & wire everything**

- [ ] Create GameController class:
  - [ ] Initialize teams (test rosters)
  - [ ] Initialize match engine
  - [ ] Run simulation loop
  - [ ] Collect narration events
  - [ ] Return final match result
- [ ] Wire to React:
  - [ ] GameController state in MatchView
  - [ ] Update UI on each round
  - [ ] Display narration in real-time
- [ ] Run first test match:
  - [ ] Team A (random 5 players) vs Team B (random 5 players)
  - [ ] Simulate 4 quarters
  - [ ] Check score is reasonable (80-120 ppg)
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
