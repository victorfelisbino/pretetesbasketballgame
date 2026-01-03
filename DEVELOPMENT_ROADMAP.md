# 🏀 Quadra Legacy - Development Roadmap

**Project:** Mobile Basketball Manager Game (Inspired by Elifoot)  
**Start Date:** January 1, 2026  
**Target Launch:** ~8 weeks  
**Status:** 🟡 Phase 0 Planning & Core Engine

---

## 📋 Phase Overview

### Phase 0: Web MVP (Weeks 1-2) ⬅️ YOU ARE HERE
Build a **playable web game** with core mechanics before mobile development.

### Phase 1: Web + Multiplayer Backend (Weeks 3-4)
Add Firebase, leagues, team management, PWA deployment.

### Phase 2: React Native Conversion (Weeks 5-7)
Package for iOS/Android app stores.

### Phase 3: Polish & Launch (Weeks 8+)
App store optimization, feedback integration, marketing.

---

## 🎯 Phase 0: Core Engine (CURRENT)

### Objective
**Get one full match playable with text narration in Portuguese**

### Deliverable
- Court grid visualization
- Player positioning & movement
- Match simulation (100 rounds, 5-round possessions)
- Dice rolls + probability formulas
- Text-based Portuguese narration
- Basic React UI (mobile-responsive)

### Tasks

#### ✅ Task 1: Court Grid System
- [ ] Create 50×30 grid coordinate system
- [ ] Define player positions on court
- [ ] Calculate movement based on position (PG moves 10 squares, C moves 5)
- [ ] Implement collision/boundary detection
- [ ] File: `src/court.js`

**Acceptance Criteria:**
- Players can move within grid
- Movement limits enforced per position
- Debug mode shows grid coordinates

---

#### ✅ Task 2: Match Simulation Engine
- [ ] Create 100-round game structure
- [ ] Implement 5-round possession system
- [ ] Define possession flow:
  - Round 1: Offense positioning
  - Round 2: Defense positioning
  - Round 3-5: Play decision + resolution
- [ ] Handle possession switches (turnovers, fouls, etc.)
- [ ] File: `src/matchEngine.js`

**Acceptance Criteria:**
- One match completes without errors
- Possessions tracked correctly
- Events logged for narration

---

#### ✅ Task 3: Dribble vs Steal (d20 System)
- [ ] Implement d20 dribble contest
- [ ] Formula: `DRIBBLE attribute - STEAL/MARKING attribute`
- [ ] Roll resolution: `roll >= (20 - difference) to succeed`
- [ ] Handle success/failure outcomes
- [ ] File: `src/dribbleSystem.js`

**Acceptance Criteria:**
- 70% success with Dribble 16 vs Steal 2
- Turnover/steal on failure
- Integrated into possession flow

---

#### ✅ Task 4: Action Resolution (Your Formulas)
- [ ] Implement attack vs defense success formula:
  - If A > B: `100 - (2*B - A) / 2`
  - If A < B: `(2*A - B) / 2`
  - If A = B: `50%`
- [ ] Implement position-based dice rolls for stats
- [ ] Handle multiple outcomes (success/block/rebound/turnover)
- [ ] File: `src/actionResolver.js`

**Acceptance Criteria:**
- 2-point shot: Success rolls 1d6
- 3-point shot: Success rolls 1d8
- Rebound contests work correctly
- All formulas match Excel calculations

---

#### ✅ Task 5: Portuguese Text Narration
- [ ] Create narration library with Portuguese templates
- [ ] Generate play-by-play text for each action
- [ ] Include player names, scores, time
- [ ] Format like Elifoot (timestamps, action descriptions)
- [ ] File: `src/narration.js`

**Acceptance Criteria:**
- Live match narration displays
- Portuguese grammar correct
- Reads naturally (not robotic)
- Example: "⏱ 8:32 - M. Santos avança com a bola!"

---

#### ✅ Task 6: React UI - Match View
- [ ] Create match display component
- [ ] Show court visualization (canvas or SVG)
- [ ] Display live score & quarter
- [ ] Show possession narration log
- [ ] Add play-by-play event list
- [ ] File: `src/ui/MatchView.jsx`

**Acceptance Criteria:**
- Responsive on mobile (320px+)
- Live updates during match
- Smooth scrolling narration
- Touch-friendly buttons

---

#### ✅ Task 7: Team & Player Setup
- [ ] Create team/player data structures (from existing Player/Team classes)
- [ ] Implement roster loading
- [ ] Display starting lineups
- [ ] Show player stats (ATK, DEF, position, etc.)
- [ ] File: `src/ui/TeamSetup.jsx`

**Acceptance Criteria:**
- Can select 5-player starting lineup
- Player stats visible
- Can create 2 test teams
- Easy to modify for testing

---

#### ✅ Task 8: Integration & First Match
- [ ] Wire all systems together
- [ ] Create match flow controller
- [ ] Run full match simulation (4 quarters)
- [ ] Display complete narration
- [ ] File: `src/gameController.js`

**Acceptance Criteria:**
- Full match plays without errors
- Score updates correctly
- Narration displays in real-time
- Match concludes with final score

---

## 📊 Progress Tracking

### Week 1-2 Breakdown

| Task | Week | Status | Notes |
|------|------|--------|-------|
| Court Grid | W1 | 🟡 Planning | Starting today |
| Match Engine | W1 | ⬜ Not Started | Blocks on Court Grid |
| Dribble System | W1-W2 | ⬜ Not Started | Needs Action Resolver |
| Action Resolver | W1 | ⬜ Not Started | Core formulas |
| Narration | W2 | ⬜ Not Started | Needs Match Engine |
| React UI | W2 | ⬜ Not Started | Blocks on everything |
| Team Setup | W1-W2 | ⬜ Not Started | Simple component |
| Integration | W2 | ⬜ Not Started | Final assembly |

---

## 🛠 Technical Decisions

### Architecture
```
src/
├── core/
│   ├── court.js          # Court grid system
│   ├── matchEngine.js    # 100-round simulation
│   ├── dribbleSystem.js  # d20 contests
│   ├── actionResolver.js # Your formulas
│   └── gameController.js # Match flow
├── gameplay/
│   ├── narration.js      # Portuguese text
│   ├── player.js         # Player class (existing)
│   ├── team.js           # Team class (existing)
│   └── dice.js           # Dice roller (existing)
├── ui/
│   ├── MatchView.jsx     # Live match display
│   ├── TeamSetup.jsx     # Roster selection
│   ├── ScoreBoard.jsx    # Score & time display
│   └── NarrationLog.jsx  # Event log
└── App.jsx               # Main app

public/
├── index.html
└── styles.css
```

### Technology Stack
- **Frontend:** React (Vite) - Quick builds, modern features
- **Styling:** CSS + Responsive (mobile-first)
- **State:** React useState/useReducer (no Redux yet)
- **Data:** JSON objects (local storage in Phase 1)
- **Build:** Vite (faster than CRA)

### Key Design Patterns
1. **Match Simulation** - Event-driven state machine
2. **Narration** - Template + interpolation
3. **Dice System** - Pure functions (no side effects)
4. **UI Updates** - React hooks (useState for match state)

---

## 📱 File Structure (Current)

```
c:\Users\isabe\pretetesbasketballgame\
├── public/
│   ├── index.html       ✅ Created
│   └── styles.css       ✅ Created (needs update)
├── src/
│   ├── dice.js          ✅ Created (Dice system)
│   ├── player.js        ✅ Created (Player class)
│   ├── team.js          ✅ Created (Team class)
│   ├── gameEngine.js    ⬜ To create (OLD - will replace)
│   ├── ui.js            ⬜ To create (OLD - will replace)
│   ├── main.js          ⬜ To create (OLD - will replace)
│   ├── court.js         ⬜ To create (NEW - Phase 0)
│   ├── matchEngine.js   ⬜ To create (NEW - Phase 0)
│   ├── dribbleSystem.js ⬜ To create (NEW - Phase 0)
│   ├── actionResolver.js ⬜ To create (NEW - Phase 0)
│   ├── narration.js     ⬜ To create (NEW - Phase 0)
│   └── ui/ (NEW DIR)
│       ├── MatchView.jsx
│       ├── TeamSetup.jsx
│       ├── ScoreBoard.jsx
│       └── NarrationLog.jsx
├── DEVELOPMENT_ROADMAP.md    (this file)
├── DESIGN_DOCUMENT.md        (from PDF, for reference)
├── Pretete's Basketball.xlsx (design reference)
└── package.json             (to create)

```

---

## 🎮 Game Balance Reference

### From Your Excel (src/dice.js reference)

**Attack vs Defense Formula:**
```javascript
// Your formula - DO NOT CHANGE
if (attackerSkill > defenderSkill) {
  return 100 - (2 * defenderSkill - attackerSkill) / 2;
} else if (attackerSkill < defenderSkill) {
  return (2 * attackerSkill - defenderSkill) / 2;
} else {
  return 50;
}
```

**Position-Based Dice (Per Quarter):**
```javascript
DICE_TABLES = {
  '2_points': { 'C': '2d6', 'PF': '1d8', 'PG': '1d4' },
  '3_points': { 'SG': '1d6', 'SF': '1d6', 'PG': '1d3' },
  'rebounds': { 'C': '3d6', 'PF': '2d6', 'SF': '1d6' },
  'assists': { 'PG': '1d10', 'SG': '1d6' },
  'steals': { 'PG': '1d4+1d6', 'SG': '1d2+1d3' },
  'blocks': { 'C': '1d8+1d10', 'PF': '1d4+1d5' }
}
```

**Dribble vs Steal (d20):**
```javascript
difference = DRIBBLE - STEAL_MARKING
threshold = 20 - difference
roll >= threshold to succeed
Example: Dribble 16 vs Steal 2 → threshold 6 → 70% success
```

---

## 🧪 Testing Strategy

### Unit Tests (Manual)
- [ ] Dice roller (1d6 should average 3.5)
- [ ] Probability formula (A=99 vs B=51 should be ~98%)
- [ ] Dribble system (70% success rate with example)
- [ ] Court boundaries (players can't go off-grid)

### Integration Tests
- [ ] One full match (4 quarters, 100 rounds)
- [ ] Score updates correctly
- [ ] Narration generates without errors
- [ ] Possession tracking accurate

### Play Tests
- [ ] Game feels balanced (scores 80-120 range)
- [ ] Matches finish in reasonable time (<1 minute)
- [ ] Random variation creates different outcomes
- [ ] Better teams win more often

---

## 📝 Next Steps

### IMMEDIATE (Do First)
1. ✅ Review this roadmap
2. ⬜ Create `src/court.js` with grid system
3. ⬜ Create `src/matchEngine.js` with game loop
4. ⬜ Create test match to verify core flow

### This Week
- Implement all Phase 0 tasks
- Get one full match working
- Manual testing & balance adjustments

### Next Week (Week 2)
- Optimize performance
- Polish narration
- Create React UI components
- Integration testing with friends

---

## 🚀 Success Criteria for Phase 0

**The game is ready for Phase 1 when:**
- ✅ One full match completes (4 quarters, 100 rounds)
- ✅ Scores feel balanced (average 90-110 ppg)
- ✅ Narration is readable Portuguese
- ✅ All dice probabilities work correctly
- ✅ Dribble/steal contests resolve properly
- ✅ React UI displays match in real-time
- ✅ Can play 2 different test teams and see different results

---

## 📚 Reference Documents

**Game Design:**
- [Game Design Document (PDF)](./Pretetes_Basketball_Game_Design.md) - Full vision & mechanics
- [Design Excel Sheet](./Pretete's%20Basketball.xlsx) - Dice tables & formulas

**Code References:**
- `src/dice.js` - All dice logic already built ✅
- `src/player.js` - Player class ready ✅
- `src/team.js` - Team class ready ✅

---

## 📞 Decision Points

### Decision 1: Court Size
- [ ] Decision needed: Court grid dimensions?
  - Option A: 50×30 (wide court, more movement)
  - Option B: 30×20 (compact, faster simulation)
  - **Recommendation:** 50×30 for more tactical depth

### Decision 2: Game Speed
- [ ] How long should one match take?
  - Option A: ~1 minute (fast, arcade-like)
  - Option B: ~3-5 minutes (realistic quarter duration)
  - **Recommendation:** ~2 minutes for Phase 0 testing

### Decision 3: AI Difficulty
- [ ] Should computer opponents be smart?
  - Phase 0: Random play selection (simple)
  - Phase 1: Basic strategy (pick shots vs passes)
  - Phase 2: Positional awareness (C scores inside, PG passes)

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gameplay too complex | Hard to implement | Keep Phase 0 simple (no fouls/substitutions) |
| Poor performance | 100 rounds too slow | Profile early, optimize bottlenecks |
| Unbalanced scores | Game not fun | A/B test different skill ranges |
| Narration in Portuguese bugs | Confusing to players | Test with native Brazilian English speakers |

---

## 📅 Weekly Checklist

### Week 1 (Jan 1-7)
- [ ] Court grid system working
- [ ] Match engine core loop done
- [ ] Action resolver implemented
- [ ] One test match completes

### Week 2 (Jan 8-14)
- [ ] Dribble/steal system integrated
- [ ] Narration engine complete
- [ ] React UI created
- [ ] Full match ready to demo

### Success = Playable match by Jan 14 ✅

---

## 💡 Notes

- **Portuguese Focus:** Game narration should feel natural for Brazilian players
- **Simplicity First:** Copy Elifoot's magic - keep it simple!
- **Mobile-First Design:** All UI must work on phone screens (320px minimum)
- **Fast Iteration:** Build, test, iterate quickly
- **Friends = Marketing:** If friends have fun, they'll invite others

---

**Document Version:** 1.0  
**Last Updated:** January 1, 2026  
**Author:** Development Team  
**Status:** 🟡 Planning Phase 0
