# 🏀 Pretetê's Basketball - Mobile Manager Game

**A basketball simulation game inspired by Elifoot, built with React + Firebase**

---

## 📁 Project Structure

```
pretetesbasketballgame/
├── 📄 README.md (this file)
├── 📄 DEVELOPMENT_ROADMAP.md      ← Start here! Full development plan
├── 📄 DEVELOPMENT_CHECKLIST.md    ← Daily task tracking & progress
├── 📄 GAME_MECHANICS_REFERENCE.md ← Game rules, formulas, examples
├── 📄 Pretetes_Basketball_Game_Design.md ← Full design doc (21 pages)
├── 📄 Pretete's Basketball.xlsx   ← Original game design spreadsheet
│
├── 📁 public/
│   ├── index.html                 ← Main HTML file
│   └── styles.css                 ← Global styles
│
├── 📁 src/
│   ├── 🔄 CORE ENGINE (Phase 0)
│   │   ├── dice.js ✅              ← Dice rolling system
│   │   ├── player.js ✅            ← Player class
│   │   ├── team.js ✅              ← Team class
│   │   ├── court.js ⬜             ← Court grid (IN PROGRESS)
│   │   ├── matchEngine.js ⬜       ← Game simulation loop
│   │   ├── actionResolver.js ⬜    ← Action outcomes
│   │   ├── dribbleSystem.js ⬜     ← d20 contests
│   │   └── narration.js ⬜         ← Portuguese narration
│   │
│   ├── 🎮 REACT UI (Phase 0)
│   │   ├── ui/
│   │   │   ├── MatchView.jsx ⬜
│   │   │   ├── TeamSetup.jsx ⬜
│   │   │   ├── ScoreBoard.jsx ⬜
│   │   │   └── NarrationLog.jsx ⬜
│   │   └── gameController.js ⬜
│   │
│   ├── 🔗 BACKEND (Phase 1)
│   │   ├── firebase.js ⬜
│   │   ├── api/ ⬜
│   │   └── models/ ⬜
│   │
│   └── App.jsx (Main React component)
│
└── 📁 docs/
    └── GAME_BALANCE.md (for future reference)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- npm or yarn
- Code editor (VS Code recommended)

### Installation
```bash
# Clone or navigate to project
cd pretetesbasketballgame

# Install dependencies
npm install

# Start development server
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## 📚 Documentation Guide

### For Development Planning
👉 **Start with:** `DEVELOPMENT_ROADMAP.md`
- Complete project timeline
- Phase breakdown
- Risk assessment
- Success criteria

### For Daily Work
👉 **Use:** `DEVELOPMENT_CHECKLIST.md`
- Daily task breakdown
- Progress tracking
- Testing checklist
- Bug logging

### For Gameplay Rules
👉 **Reference:** `GAME_MECHANICS_REFERENCE.md`
- Court dimensions & movement
- Dice system & probabilities
- Skill formulas (YOUR formulas!)
- Action outcomes
- Balance targets

### For Full Vision
👉 **Read:** `Pretetes_Basketball_Game_Design.md` (21 pages)
- Market analysis
- Monetization strategy
- Future features
- Technical implementation

---

## 🎮 Game Overview

### What Is This Game?

A **basketball manager game** where you:
1. Build a team of 12 players
2. Simulate matches with dice-based outcomes
3. Compete in private leagues with friends
4. Progress through seasons

**Inspired by Elifoot** (legendary Brazilian soccer manager from 1987)

### Key Features (MVP)
- ✅ Turn-based possession gameplay on a grid
- ✅ Position-specific movement & attributes
- ✅ Your custom probability formulas (attack vs defense)
- ✅ Portuguese text-based narration
- ✅ Single-player matches
- 🔄 Team management (Phase 1)
- 🔄 Multiplayer leagues (Phase 1)
- 🔄 iOS/Android apps (Phase 2)

---

## 🎯 Development Phases

### Phase 0: Web MVP (Weeks 1-2) 🔴 CURRENT
**Goal:** Prove gameplay is fun  
**Deliverable:** One playable match with narration  
**Stack:** React (web)

Tasks:
- Court grid system
- Match simulation (100 rounds)
- Dribble/steal system (d20)
- Portuguese narration
- Basic React UI

**Status:** Just started - Court grid in progress

### Phase 1: Web + Multiplayer (Weeks 3-4)
**Goal:** Add Firebase backend  
**Deliverable:** Private leagues, team management  
**Stack:** React + Firebase

### Phase 2: Mobile Apps (Weeks 5-7)
**Goal:** Publish to App Stores  
**Deliverable:** iOS/Android native apps  
**Stack:** React Native

### Phase 3: Launch (Week 8+)
**Goal:** Polish & optimize  
**Deliverable:** Production-ready game

---

## 🔧 Key Systems

### 1. Court Grid System
- **50×30 grid** representing the basketball court
- **Position-based movement:** PG moves 10 squares/round (with ball), C moves 5
- **Ball possession:** Tracked player

### 2. Match Simulation
- **100 rounds per match** (4 quarters × 25 possessions)
- **5 rounds per possession** (positioning → decision → resolution)
- **Event logging** for narration

### 3. Probability System
**YOUR FORMULA** (attack vs defense):
```javascript
if (attacker > defender) {
  success = 100 - (2*defender - attacker) / 2
} else if (attacker < defender) {
  success = (2*attacker - defender) / 2
} else {
  success = 50
}
```

Examples:
- Attack 99, Defend 51 → 98% success
- Attack 75, Defend 75 → 50% success
- Attack 51, Defend 99 → 2% success

### 4. Dribble vs Steal (d20)
**Formula:**
```
threshold = 20 - (dribble - steal)
roll d20: success if roll >= threshold
```

**Example:** Dribble 16 vs Steal 2 → threshold 6 → 75% success

### 5. Position-Based Dice
Each position rolls different dice for stats:
- **2-Pointers:** C rolls 2d6, PF rolls 1d8, PG rolls 1d4
- **3-Pointers:** SG/SF roll 1d6, PG rolls 1d3
- **Rebounds:** C rolls 3d6, PF rolls 2d6, SF rolls 1d6
- **Assists:** PG rolls 1d10, SG rolls 1d6
- **Steals:** PG rolls 1d4+1d6, SG rolls 1d2+1d3
- **Blocks:** C rolls 1d8+1d10, PF rolls 1d4+1d5

---

## 🎲 Dice & Probability

### Dice Notation
- `1d6` = one 6-sided die → results 1-6
- `2d6` = two dice, sum them → results 2-12
- `1d4+1d6` = roll both, sum → results 2-10

### Key Files
- `src/dice.js` - All dice rolling logic (ALREADY BUILT ✅)
- `src/actionResolver.js` - Applies dice to actions (TODO)

---

## 📱 Mobile Considerations

### Phase 0 (Web MVP)
- ✅ Mobile-responsive CSS
- ✅ Works in mobile browser
- ✅ Touch-friendly buttons

### Phase 2 (React Native)
- React Native for iOS/Android
- Same Firebase backend
- Native app feel

---

## 🧪 Testing & Quality Assurance

### Unit Tests (Before Committing Code)
- Dice averages (1d6 = 3.5, 2d6 = 7)
- Probability formula (A=99, B=51 = 98%)
- Dribble system (D=16, S=2 = 75%)

### Integration Tests
- Full match completion
- Score in 80-120 range
- Better team wins 60-70%
- Narration displays correctly

### Balance Tests
- Run 10 matches
- Check average score
- Verify win rate vs skill
- Adjust formulas if needed

See `DEVELOPMENT_CHECKLIST.md` for full testing plan.

---

## 🐛 Known Issues & Limitations

### Phase 0 (Web MVP) Limitations
- ❌ No fouls system (Phase 1)
- ❌ No substitutions (Phase 2)
- ❌ No free throws (Phase 1)
- ❌ Simple AI (random play selection)
- ❌ No localStorage/save (Phase 1 with Firebase)

### Bug Tracking
See `DEVELOPMENT_CHECKLIST.md` for bug reports.

---

## 💰 Revenue Model (Future)

### Monetization Strategy (Phase 3+)
- **Freemium:** Free to play, optional purchases
- **Premium Features:** $2.99/season pass
- **Cosmetics:** Team uniforms, court designs
- **Remove Ads:** $2.99 one-time

### Revenue Targets
- **Year 1:** $1K-$60K (conservative to optimistic)
- **Year 3:** $20K-$240K

See `Pretetes_Basketball_Game_Design.md` (pages 5-7) for full analysis.

---

## 📞 Questions & Decisions Needed

### Open Questions
1. **Court Size:** 50×30 (wide, tactical) or 30×20 (compact, fast)?
2. **Match Duration:** ~1 minute (fast) or ~3-5 minutes (realistic)?
3. **AI Difficulty:** Random selection or basic strategy?
4. **Language:** Portuguese first, then English?

### How to Decide
- Try both options in code
- Test with a few matches
- See which feels more fun
- Document decision in `DEVELOPMENT_CHECKLIST.md`

---

## 🤝 Contributing

### Code Style
- Use clear variable names (e.g., `attackerSkill`, not `a`)
- Add comments for complex formulas
- Keep functions small and testable

### Testing Before Push
1. Run unit tests
2. Play one full match
3. Check narration for typos
4. Verify no console errors

### Committing Changes
```bash
git add .
git commit -m "Feature: Court grid system"
git push
```

---

## 📚 External References

### Game Design Inspiration
- **Elifoot** - Original soccer manager (1987-2025)
- **Basketball GM** - Modern open-source manager
- **Astonishing Basketball Manager** - Popular mobile version

### Technologies Used
- **React** - UI framework
- **Firebase** (Phase 1) - Backend & multiplayer
- **React Native** (Phase 2) - Mobile apps
- **Vite** - Build tool

---

## ✅ Success Criteria

### Phase 0 Complete When:
- [ ] One full match runs without errors
- [ ] Score is 80-120 ppg (balanced)
- [ ] Narration displays in Portuguese
- [ ] All dice probabilities verified
- [ ] Dribble/steal d20 system works
- [ ] React UI shows live match
- [ ] Better teams win ~60% vs weak teams
- [ ] Match plays in <2 minutes
- [ ] Code is clean and documented

### Phase 0 Success: Ready for Phase 1 ✅

---

## 🎓 Learning Resources

### If You Need to Learn:
- **React Basics:** https://react.dev (official tutorial)
- **JavaScript Dice:** See `src/dice.js` for examples
- **Brazilian Portuguese:** Use translator for common phrases
- **Game Design:** Read your 21-page design doc!

---

## 📞 Support & Questions

- **Stuck on a task?** Check `GAME_MECHANICS_REFERENCE.md`
- **Lost progress?** See `DEVELOPMENT_CHECKLIST.md` for current status
- **Need context?** Read `DEVELOPMENT_ROADMAP.md` for the big picture
- **Game rules?** Check `Pretetes_Basketball_Game_Design.md`

---

## 🎬 Next Steps (Right Now)

1. ✅ Read this README
2. ✅ Read `DEVELOPMENT_ROADMAP.md` (10 min)
3. ✅ Read `GAME_MECHANICS_REFERENCE.md` (reference material)
4. ⬜ **START:** Build `src/court.js` (court grid system)
5. ⬜ Test that you can create players and move them on the grid
6. ⬜ Move to next task in `DEVELOPMENT_CHECKLIST.md`

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Total Development Time** | 13-15 weeks |
| **Phase 0 Duration** | 2 weeks |
| **Core Files (Phase 0)** | 8 files |
| **Lines of Code Est.** | 3,000-5,000 |
| **Test Cases** | 20+ |
| **Target Launch** | April 2026 |

---

## 🏁 Vision

**By April 2026, you'll have:**
- ✅ A working basketball manager game
- ✅ Playable with friends in private leagues
- ✅ Available on iOS & Android
- ✅ Revenue streams from 1,000+ players
- ✅ Brazilian gaming community supporting it

**Like Elifoot, but for basketball.** 🏀

---

**Version:** 1.0  
**Created:** January 1, 2026  
**Status:** 🟡 Phase 0 in Progress  
**Last Updated:** January 1, 2026

**Made with 💜 by the Pretetê's Basketball Dev Team**
