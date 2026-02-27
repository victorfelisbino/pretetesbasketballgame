# 🏀 Quadra Legacy – Mobile Game Master Plan

**The definitive product strategy & implementation reference for transforming Quadra Legacy into a mobile-first basketball manager game with a Coach × Fantasy League hybrid model.**

> **How to use this document:**  
> Read it top-to-bottom once before picking up any implementation task. Then use it as a living reference: every sub-agent, workstream lead, and feature owner should check the relevant section before starting work. The sections build on each other — vision → existing foundation → market context → differentiator → gaps → feature specs → plan → tech → people → money → growth → success → principles.

---

## 📑 Table of Contents

1. [Vision & Elevator Pitch](#1-vision--elevator-pitch)
2. [What Is Already Built](#2-what-is-already-built)
3. [Competitive & Market Context](#3-competitive--market-context)
4. [The Coach × Fantasy Hybrid – Core Concept & Differentiator](#4-the-coach--fantasy-hybrid--core-concept--differentiator)
5. [Gaps in the Current Roadmap](#5-gaps-in-the-current-roadmap)
6. [Full Feature Specification](#6-full-feature-specification)
7. [Revised Phased Implementation Plan](#7-revised-phased-implementation-plan)
8. [Technical Architecture](#8-technical-architecture)
9. [Sub-Agent & Team Workstream Assignments](#9-sub-agent--team-workstream-assignments)
10. [Monetization Strategy](#10-monetization-strategy)
11. [Viral Growth Loop](#11-viral-growth-loop)
12. [Definition of Success & Milestone Criteria](#12-definition-of-success--milestone-criteria)
13. [Non-Negotiable Product Principles](#13-non-negotiable-product-principles)

---

## 1. Vision & Elevator Pitch

### 🎯 One-Sentence Pitch

> **Quadra Legacy** is the mobile basketball game where you are both the **coach calling plays** AND the **fantasy manager building the perfect roster** — all in a social league you share with friends.

### 🔭 Expanded Vision

Most mobile sports games make you choose: either you play a *fantasy* game (draft real/fictional players, collect stats, win your bracket) or a *manager* game (tactics, formations, training, season progression). Quadra Legacy does **both at once**, with a single fictional universe so no real-athlete licensing is needed.

You create your own players from scratch, develop them across seasons, deploy them in tactically rich simulated matches, and compete in live private leagues — all on a phone screen, in sessions as short as 3 minutes.

The closest spiritual ancestor is **Elifoot** (Brazil, 1987), which achieved cult status among Brazilian gamers with nothing more than text-based narration and simple statistics. Quadra Legacy brings that same soul to basketball, adds a social/fantasy layer, and ships it as a mobile-first app.

### 🏁 Where We Are Headed (12-Month Horizon)

| Milestone | Target |
|-----------|--------|
| Playable web MVP | Phase 0 (Jan 2026) |
| Firebase multiplayer + private leagues | Phase 1 (Feb 2026) |
| React Native iOS/Android | Phase 2 (Mar–Apr 2026) |
| Coach × Fantasy hybrid beta | Phase 3 (May–Jun 2026) |
| Draft system + fantasy scoring | Phase 4 (Jul 2026) |
| App Store launch (v1.0) | Phase 5 (Aug–Sep 2026) |
| Season 2 live + viral mechanics | Phase 6 (Oct–Dec 2026) |

---

## 2. What Is Already Built

> Reference the existing codebase before building anything new.  
> Files marked ✅ are complete and tested. Files marked ⬜ are planned but not yet created.

### 📁 Core Engine (JavaScript / Vite)

| File | Status | What It Does |
|------|--------|-------------|
| `src/dice.js` | ✅ Done | Full dice roller — supports any notation (`1d6`, `2d6`, `1d4+1d6`). Pure functions, no side effects. |
| `src/player.js` | ✅ Done | Player class — attributes on 1–99 scale (Attack, Defense, ThreePoint, Stamina, Chemistry, Morale, Potential) plus a d20-scale Dribble/StealMarkingD20 pair. |
| `src/team.js` | ✅ Done | Team class — 12-player roster, starting lineup selection, basic team metadata. |
| `src/court.js` | ✅ Done | 50×30 grid, position-based movement speeds (PG 10/13, SG 8/11, SF 7/10, PF 6/8, C 5/7), boundary detection, zone helpers. |
| `src/matchEngine.js` | ✅ Done | 100-round game loop, 5-round possession flow (positioning → action → resolution), event log, quarter management. |
| `src/actionResolver.js` | ✅ Done | Implements the custom attack-vs-defense probability formula; position-based dice tables for 2pt, 3pt, rebounds, assists, steals, blocks. |
| `src/dribbleSystem.js` | ✅ Done | d20 dribble contest (`threshold = 20 − (DRIBBLE − STEAL)`); all test cases passing. |
| `src/narration.js` | ✅ Done | Portuguese play-by-play templates, random template selection, time formatter. |

### 🖥️ React UI

| File | Status | Notes |
|------|--------|-------|
| `src/ui/MatchView.jsx` | ✅ Done | Live court canvas, scoreboard, narration log, Speed Up, Pause controls. |
| `src/ui/TeamSetup.jsx` | ✅ Done | 5-player lineup selection, stat display. |
| `src/ui/ScoreBoard.jsx` | ⬜ Needed | Extracted standalone scoreboard component. |
| `src/ui/NarrationLog.jsx` | ⬜ Needed | Scrollable narration stream. |
| `src/gameController.js` | ⬜ Needed | Wires all systems, runs simulation. |

### 🌐 Backend

| Layer | Status | Plan |
|-------|--------|------|
| Firebase Auth | ⬜ | Phase 1 |
| Firestore (teams, leagues, seasons) | ⬜ | Phase 1 |
| Cloud Functions (match adjudication) | ⬜ | Phase 2 |
| REST API wrapper | ⬜ | Phase 2 |

### 📚 Documentation

| File | What It Covers |
|------|---------------|
| `README.md` | Project overview, quick-start, phase summary |
| `DEVELOPMENT_ROADMAP.md` | Phase 0 detailed task breakdown with acceptance criteria |
| `DEVELOPMENT_CHECKLIST.md` | Day-by-day progress log, bug tracker |
| `GAME_MECHANICS_REFERENCE.md` | Dice tables, probability formulas, court dimensions |
| `Pretetes_Basketball_Game_Design.pdf` | Original 21-page design document |

---

## 3. Competitive & Market Context

### 📊 Market Snapshot

- Global mobile gaming market: **~$100 B / year** (2025)
- Sports management mobile sub-segment: **~$4–6 B / year**
- Brazilian mobile gaming audience: **~100 M users**, heavily skewed toward free-to-play social games
- Average revenue per daily active user (ARPDAU) for sports manager games: **$0.08–$0.25**

### 🏆 Key Competitors & What They Do Well

| Game | Strengths | Weaknesses for Our Audience |
|------|-----------|-----------------------------|
| **NBA 2K Mobile** | Deep player cards, authentic NBA branding | Heavy pay-to-win, licensing costs mean no original players |
| **Basketball GM** (web) | Free, deep simulation, open-source | No social layer, desktop-only UX, unappealing visuals |
| **Astonishing Basketball** (mobile) | Great depth, active community | Complex onboarding, no fantasy layer, no friend leagues |
| **Top Eleven** (soccer) | Massive player base, strong social features | Soccer only; card-heavy monetization |
| **Hoop League Tactics** | Tactically deep, real-time draft | Niche audience, limited retention mechanics |
| **Elifoot** (soccer, Brazilian) | Cultural touchstone, loyal community, text-narration magic | Soccer only; aging tech stack; no fantasy layer |

### ✅ What Successful Mobile Manager / Fantasy Games Do Well

1. **Fast sessions** — meaningful decisions in 2–5 minutes
2. **Social virality** — every action generates a shareable moment
3. **Progression clarity** — players always know what to work toward next
4. **Asymmetric depth** — casual players can enjoy surface; hardcore players find deep systems
5. **Season cadence** — fixed end dates create urgency and drive re-engagement
6. **Low barrier to entry** — no paywall at first session; fun before friction
7. **Narrative identity** — *your* team has a name, a story, a city
8. **Reward variety** — XP, coins, badges, leaderboard rank, narrative achievements

### 🚫 Where Competitors Fail

- Pay-to-win ruins competitive integrity (especially in friend leagues)
- Over-reliance on real-player licensing creates legal risk and limits creativity
- No original fictional universe → no sense of authorship/ownership
- Desktop-first design that ports badly to mobile
- Fantasy and manager modes exist in separate apps, never integrated

---

## 4. The Coach × Fantasy Hybrid – Core Concept & Differentiator

### 🧠 The Core Idea

In Quadra Legacy, every player wears **two hats simultaneously**:

| Hat | What It Means |
|-----|--------------|
| **Coach** | You set formations, rotations, play calls (fast break, half-court, zone defense, hack-a-center), timeouts, and in-game substitutions. Your tactical decisions affect match outcomes. |
| **Fantasy Manager** | You draft, trade, develop, and score players based on individual statistical performance — exactly like a fantasy league, but the players are fictional and belong to your universe. |

These two modes are **not separate screens or modes** — they coexist in every match, every game day, every season.

### ⚙️ How They Interact (The Flywheel)

```
Draft players  →  Set tactics  →  Simulate match  →  Players earn stats
     ↑                                                        ↓
  Trade/develop ←  Fantasy scoring  ←  Rival leagues  ←  Leaderboard
```

- Your **coaching choices** (e.g., "run isolation plays for my PG") directly affect which players generate fantasy points.
- Your **fantasy roster decisions** (who to start, who to bench) create tactical constraints (e.g., your best fantasy PG may not fit your preferred offensive scheme).
- **Tension** = the differentiator. Every decision has both a tactical *and* a fantasy-scoring consequence.

### 🎯 Why This Is a Differentiator

1. **No direct competition**: No other mobile basketball game integrates coach-level tactics with live fantasy scoring in a single session.
2. **Replayability**: The same roster can be deployed differently every game, changing both outcomes and fantasy points earned.
3. **Community hooks**: Friend leagues create shared narrative — "my scheme beat your stars" is a conversation starter.
4. **Accessible fantasy**: Friends who find traditional fantasy leagues too passive get an active role; friends who find tactical sims too complex can focus on roster management.
5. **Fictional players**: Full ownership of player identities, no licensing risks, unique world-building opportunity.

---

## 5. Gaps in the Current Roadmap

The existing `DEVELOPMENT_ROADMAP.md` covers Phase 0 (core match simulation) and sketches Phases 1–3 (Firebase, React Native, polish). However, it is **missing the following systems** that are required for the Coach × Fantasy hybrid vision:

### 🔴 Critical Gaps (Blockers for the Core Differentiator)

| Gap | Impact | When to Add |
|-----|--------|-------------|
| **Player Creator / Generator** | Without custom players there is no fantasy identity | Phase 1 |
| **Draft System** (snake + auction) | Core acquisition loop is undefined | Phase 2 |
| **Fantasy Scoring Engine** | Stats need to map to fantasy points; no spec exists | Phase 2 |
| **Coaching / Tactics Layer** | Play calling, rotations, schemes are not spec'd | Phase 2 |
| **League Management** | Season structure, standings, playoffs undefined | Phase 1 |
| **Social / Viral Features** | No share mechanics, no friend-invite loop | Phase 3 |

### 🟡 Important Gaps (Required for Retention)

| Gap | Impact | When to Add |
|-----|--------|-------------|
| **Player Progression / Development** | Without aging and growth there is no multi-season hook | Phase 2 |
| **Staff System** | Coaches, trainers, scouts not spec'd | Phase 3 |
| **Finances / Team Budget** | No salary cap, no economic tension | Phase 3 |
| **AI Opponent Tiers** | Current AI is random; no escalating challenge | Phase 1 |
| **Achievements / Badges** | No recognition of milestones | Phase 2 |
| **Free Throws / Fouls** | Marked as Phase 1 but never detailed | Phase 1 |

### 🟢 Nice-to-Have Gaps (Polish for v1.0+)

| Gap | Impact | When to Add |
|-----|--------|-------------|
| **Cosmetics** (jerseys, courts) | Monetization + identity | Phase 3 |
| **Hall of Fame** | Long-term narrative payoff | Phase 4+ |
| **Historical Stats Archive** | Fantasy bragging rights | Phase 3 |
| **Push Notifications** | Re-engagement mechanism | Phase 3 |
| **Accessibility** (screen readers, high contrast) | Inclusivity | Phase 3 |

---

## 6. Full Feature Specification

> Each sub-section below is a self-contained feature spec. Implementation agents should read the relevant sub-section before building.

---

### 6.1 Player Creator

**Purpose:** Generate the fictional athletes that populate every team.

**Two creation modes:**

| Mode | Description |
|------|-------------|
| **Manual** | User inputs name, position, hometown, archetype (Scorer / Defender / Playmaker / Rebounder / Stretch) |
| **Auto-Generate** | System generates player from archetype + rng seed; produces a full name, nationality, age, and attribute spread |

**Player Identity Fields:**

```
id           : UUID
name         : string  (first + last)
nickname     : string  (optional)
nationality  : string
hometown     : string
age          : integer (18–38)
position     : enum  { PG, SG, SF, PF, C }
archetype    : enum  { Scorer, Defender, Playmaker, Rebounder, Stretch }
height_cm    : integer
weight_kg    : integer
dominantHand : enum  { Left, Right }
```

**Attribute System (1–99, higher = better):**

| Attribute | Category | Affects |
|-----------|----------|---------|
| Attack | Offense | Overall offensive success rate |
| FieldGoal | Offense | General shooting % |
| FieldGoalPaint | Offense | Inside scoring (C, PF) |
| FieldGoalMidRange | Offense | Mid-range (SG, SF) |
| ThreePoint | Offense | 3pt (SG, SF, PG) |
| DunkLayup | Offense | Close finishing |
| FreeThrow | Offense | FT accuracy |
| Passing | Offense | Assist rate |
| Defense | Defense | Overall defensive success |
| StealMarking | Defense | Steal rate |
| Blocking | Defense | Block rate |
| Stamina | Physical | Fatigue curve over 4 quarters |
| Chemistry | Team | Synergy bonus when playing with teammates |
| Morale | Mental | Consistency (reduces variance) |
| Potential | Growth | Max attribute ceiling at career peak |

**d20-scale Attributes (1–20, lower = more skilled at that action):**

| Attribute | Use |
|-----------|-----|
| Dribble | Determines ball-handling in d20 dribble contests |
| StealMarkingD20 | Determines defensive pressure in d20 contests |

**Archetype Attribute Templates (starting distribution):**

| Archetype | High | Medium | Low |
|-----------|------|--------|-----|
| Scorer | Attack, ThreePoint | Stamina | Defense, Passing |
| Defender | Defense, StealMarking | Stamina | ThreePoint, DunkLayup |
| Playmaker | Passing, Dribble | ThreePoint | Blocking |
| Rebounder | FieldGoalPaint, Blocking | Defense | ThreePoint |
| Stretch | ThreePoint, FieldGoalMidRange | Attack | Blocking, FieldGoalPaint |

---

### 6.2 Draft Systems

**Purpose:** The primary way players acquire and build their roster each season.

#### 6.2.1 Snake Draft

- All league managers pick in a determined order for each round.
- Order reverses every other round (Round 1: 1→N; Round 2: N→1; etc.).
- **Draft board:** Real-time view of available players; each manager picks one at a time.
- **Pick timer:** 90 seconds per pick on mobile (auto-pick on timeout = best available at position).
- **Traded picks:** Managers can trade future-round picks.
- **Draft lobby:** Shows all managers, ready status, round/pick counter.

#### 6.2.2 Auction Draft

- All managers receive an equal starting budget (e.g., 200 credits).
- Any manager nominates a player; all managers bid simultaneously.
- Highest bid wins player + pays that amount from budget.
- Remaining budget unspent at draft end converts to season salary cap space.
- **Bid timer:** 15-second countdown per nomination, 5-second extension on each new bid.
- **Budget visibility:** All managers see each other's remaining budget.

#### 6.2.3 Free Agency (in-season)

- Players not drafted are in the free agent pool.
- Managers can sign free agents to fill injuries or roster gaps.
- Signing uses remaining salary cap space.
- 24-hour waiver period before a free agent can be officially signed.

#### 6.2.4 Trades

- Any manager can propose a trade to any other manager.
- Counteroffers supported.
- Trade review window: 24 hours before trade executes.
- League commissioner can veto trade (optional setting per league).

---

### 6.3 Coaching / Tactics Layer

**Purpose:** Give the "Coach" half of the hybrid model meaningful gameplay decisions.

#### 6.3.1 Play Styles (Per Team, Per Match)

| Play Style | Effect |
|------------|--------|
| **Transition / Fast Break** | +Possession speed, -Half-court efficiency |
| **Half-Court Offense** | +Shooting %, -Transition opportunities |
| **Isolation** | +Star player usage, -Team Chemistry bonus |
| **Spread / 3pt Heavy** | +3pt volume, -Paint scoring |
| **Post Up** | +C/PF scoring, -PG/SG fantasy points |

#### 6.3.2 Defensive Schemes

| Scheme | Effect |
|--------|--------|
| **Man-to-Man** | Best player vs. opponent's best player; high steal risk |
| **Zone Defense** | Reduces 3pt %, +rebound positioning, -steal chances |
| **Press** | +Turnover rate for both teams, high stamina cost |
| **Hack-a-Center** | Forces opponent C to take FTs; high risk/high reward |

#### 6.3.3 In-Game Decisions

- **Substitutions:** Swap players mid-quarter; tracked for stamina management.
- **Timeouts:** 3 per half; halts match simulation, allows scheme switch.
- **Foul strategy:** Choose to foul deliberately or play clean defense.
- **Late-game mode:** Down 5 with 2 min left → auto-switch to press + 3pt heavy?

#### 6.3.4 Rotation Templates

Pre-built rotation plans the manager sets before the match:
- Starter minutes target (e.g., PG plays 32 min)
- Foul trouble trigger (auto-bench at 3 fouls in first half)
- Fatigue threshold (sub out at Stamina < 30%)

---

### 6.4 Fantasy Scoring Engine

**Purpose:** Translate every match statistic into fantasy points, enabling the fantasy competition layer.

#### 6.4.1 Default Scoring System

| Stat | Points |
|------|--------|
| Point scored | +1 |
| Rebound | +1.2 |
| Assist | +1.5 |
| Steal | +2 |
| Block | +2 |
| Turnover | −1 |
| FG Made | +0 (included in Points) |
| FG Missed | −0.5 |
| FT Made | +1 |
| FT Missed | −0.75 |
| Double-Double | +5 bonus |
| Triple-Double | +15 bonus |

#### 6.4.2 Custom Scoring Modes

League commissioners can adjust any scoring weight before the season starts. Common presets:

| Mode | Description |
|------|-------------|
| **Standard** | Default table above |
| **Volume** | Points and shots weighted heavier |
| **All-Around** | Assists and rebounds weighted higher |
| **Defense First** | Steals and blocks worth 3× normal |

#### 6.4.3 Fantasy League Formats

| Format | Description |
|--------|-------------|
| **Head-to-Head Weekly** | Your roster's fantasy points vs. one opponent each week |
| **Rotisserie / Roto** | Rank in each category; cumulative season ranking |
| **Points League** | Total fantasy points accumulated all season |

---

### 6.5 Social & Viral Systems

**Purpose:** Make every game moment shareable and turn players into recruiters.

#### 6.5.1 Friend Leagues

- Create a private league with a 6-character invite code.
- Up to 12 managers per league.
- League chat (text, emoji reactions on match events).
- League history persists across seasons (rivalry tracking).

#### 6.5.2 Share Cards

Auto-generated image cards for:
- Draft picks ("I just drafted [Player] #1 overall — come fight me in my league")
- Big match moments ("[Player] hit a game-winner — 3 fantasy pts in the final 10 seconds")
- Weekly fantasy results ("I beat [Opponent] 147–132 this week")
- Season trophies ("Quadra Legacy Season 3 Champion 🏆")

Cards use team colors, player avatar, and league name. Optimized for Instagram/WhatsApp stories.

#### 6.5.3 Global Leaderboard

- Weekly global fantasy leaders (across all leagues).
- All-time best single-game fantasy score.
- Streaks (most consecutive wins, longest unbeaten run).

#### 6.5.4 Rival System

- Auto-detect frequent matchups in the same league.
- "All-time record" displayed in every head-to-head match.
- Rivalry badge unlocked after 5 matches vs. same opponent.

---

### 6.6 Game Modes

| Mode | Description | Social? |
|------|-------------|---------|
| **Private League** | 4–12 friends, full season + playoffs | Yes |
| **Solo Season** | Single-player against AI opponents, all difficulty tiers | No |
| **Quick Match** | Single match, pick teams, simulate | No |
| **Draft Challenge** | Pick your team in a live draft vs. AI or friends, then play a mini-tournament | Yes (optional) |
| **Exhibition** | Scrimmage with no stats tracking; test new rosters/tactics | No |
| **Weekly Challenge** | Fixed roster challenge distributed to all players globally; compete on the weekly leaderboard | Yes (global) |

---

### 6.7 Player Progression & Development

**Purpose:** Create a multi-season hook; make every player feel like an investment.

#### 6.7.1 Season Progression

- Players gain **XP** each match based on minutes played and performance.
- XP fills a **Development Bar**; when full, player can **level up** one chosen attribute (max +3 per attribute per season).
- **Potential** (1–99) is the hard ceiling — a player with Potential 70 cannot train Attack above 70.

#### 6.7.2 Aging Curve

| Age Range | Effect |
|-----------|--------|
| 18–22 | High growth rate; Potential partially hidden |
| 23–28 | Peak years; growth slows |
| 29–33 | Decline begins (Stamina, Speed attributes drop 1–2/season) |
| 34+ | Significant decline; retire risk each season |

#### 6.7.3 Breakthrough Events

Random narrative events that can boost or hurt a player:

- "Summer training breakthrough" → +5 to one attribute permanently
- "Injury" → Misses 2–4 simulated games; attribute penalty until recovered
- "Slump" → Morale drops, attribute variance increases for N matches
- "Team chemistry spark" → Chemistry bonus for all teammates

#### 6.7.4 Retirement

- Players 35+ have a retirement probability each season (scales with Stamina).
- Retired players go to the **Hall of Fame** if they earned ≥3 seasonal awards.
- Released / retired players become free agents or retire from the fictional league permanently.

---

### 6.8 Finances & Team Budget

**Purpose:** Create economic tension and strategic trade-offs.

#### 6.8.1 Salary Cap

- Each team has a salary cap of **$20M (fictional currency)** per season.
- Player salaries determined at draft time based on attribute total and scarcity.
- Trades must be salary-cap compliant within 15% difference.

#### 6.8.2 Revenue Streams (in-game)

| Source | Amount |
|--------|--------|
| Per win | +$250K |
| Per playoff appearance | +$500K |
| Player of the Week award | +$100K |
| Star player bonus (if on your team) | +$50K/season |

Revenue can be spent on:
- Staff upgrades (see Section 6.10)
- Facility upgrades (tiny attribute bonuses for home team)
- Waiver claims / free agent signing

---

### 6.9 Season Structure

**Purpose:** Define the cadence of competition and provide natural on/off ramps.

#### 6.9.1 Season Calendar

| Phase | Duration | Events |
|-------|----------|--------|
| Pre-Season Draft | 3 days (real time) | Snake or Auction Draft, roster finalization |
| Regular Season | 14 days (real time) | ~18 simulated games per team; weekly fantasy matchups |
| Trade Deadline | Day 10 of Regular Season | Last chance for trades |
| Playoffs | 5 days (real time) | Top 4 teams per league; single elimination |
| Off-Season | 3 days (real time) | Player development, free agency, pre-draft scouting |

#### 6.9.2 Match Simulation Cadence

- 1–3 matches simulated per real-world day during the regular season.
- Managers can watch live (real-time narration) or check results async.
- Push notification when your match is about to be simulated (optional).

---

### 6.10 AI Tiers & Staff

#### 6.10.1 AI Opponent Tiers

| Tier | Behavior | Recommended Phase |
|------|----------|-------------------|
| **Rookie** | Random play selection; no tactical adjustments | Phase 0 (current) |
| **Amateur** | Prefers high-% shots; basic rotation management | Phase 1 |
| **Pro** | Recognizes opponent tendencies; adjusts scheme by quarter | Phase 2 |
| **Elite** | Full tactical awareness; optimal lineups; exploits player fatigue | Phase 3 |
| **Legend** | Near-perfect roster optimization; adapts every possession | Phase 4+ |

#### 6.10.2 Staff System

| Staff Role | Effect |
|------------|--------|
| **Head Coach** | Unlocks advanced tactics; boosts team-wide scheme execution |
| **Assistant Coach** | Improves specific position group's performance |
| **Athletic Trainer** | Reduces injury risk; speeds Stamina recovery between matches |
| **Scout** | Reveals hidden player Potential; improves draft pick evaluation |
| **Team Psychologist** | Improves Morale recovery; reduces slump duration |

Staff are acquired via in-game currency earned through season performance. Each staff member has a **Tier** (1–5) and an associated **cost**. No real-money purchase required for staff.

---

## 7. Revised Phased Implementation Plan

> This revises and extends the existing `DEVELOPMENT_ROADMAP.md` to incorporate the Coach × Fantasy hybrid vision.  
> Each phase has a **go/no-go gate** — do not proceed to the next phase unless gate criteria are met.

---

### Phase 0: Core Match Engine (Weeks 1–2) ✅ IN PROGRESS

**Goal:** Prove that the match simulation is fun and correct.

**Deliverables:**
- Complete all ⬜ tasks in `DEVELOPMENT_CHECKLIST.md`
- One playable match with Portuguese narration
- All dice/probability unit tests passing

**Gate Criteria:**
- [ ] Match completes without errors
- [ ] Scores average 90–110 ppg
- [ ] Narration is readable Portuguese
- [ ] Dribble/steal d20 system working

---

### Phase 1: Web App + Firebase + Private Leagues (Weeks 3–5)

**Goal:** Add persistence and first multiplayer experience.

**Deliverables:**

| Task | Description |
|------|-------------|
| `src/gameController.js` | Wire all Phase 0 systems; run a complete match |
| Firebase Auth | Email + Google sign-in |
| Firestore schema (v1) | Users, Teams, Leagues, Matches (see Section 8) |
| Team Management UI | Create / edit team name, roster |
| League Management UI | Create/join private league (invite code) |
| Basic Player Creator | Manual name/position/archetype; auto-generate stats |
| Amateur AI | Prefers high-% shots; basic rotation |
| Fouls + Free Throws | Add to match engine |
| PWA Manifest | Installable web app (Add to Home Screen) |

**Gate Criteria:**
- [ ] Two real users can create accounts, join a league, simulate a match
- [ ] Match results persist in Firestore
- [ ] Page loads < 3 s on mobile connection

---

### Phase 2: React Native + Draft + Fantasy Scoring (Weeks 6–10)

**Goal:** Deliver the Coach × Fantasy hybrid core.

**Deliverables:**

| Task | Description |
|------|-------------|
| React Native scaffolding | Shared logic from web; native shell |
| Snake Draft UI | Real-time draft with pick timer |
| Fantasy Scoring Engine | Stats → points per Section 6.4 |
| Head-to-Head Weekly Fantasy | Weekly matchup score view |
| Coaching/Tactics UI | Play style + defensive scheme selector |
| Rotation Templates | Pre-match lineup/rotation configuration |
| Player Progression (v1) | XP, level-up, attribute training |
| Aging (simplified) | Decline starts at 30; retirement at 35+ |
| iOS/Android Beta | TestFlight + Google Play internal testing |
| Push Notifications | Match starting, result available |

**Gate Criteria:**
- [ ] Draft 5 players, simulate a 4-quarter match, see fantasy score
- [ ] Native app runs on iOS 15+ and Android 10+
- [ ] Fantasy scoreboard updates within 30 s of match completion
- [ ] 10 internal beta testers complete one full draft-to-result cycle

---

### Phase 3: Social, Viral & Monetization (Weeks 11–15)

**Goal:** Add the hooks that drive organic growth.

**Deliverables:**

| Task | Description |
|------|-------------|
| Share Cards | Auto-generated shareable images |
| Auction Draft UI | Bidding interface with budget display |
| Trade System | Propose, counter-offer, execute |
| Staff System (v1) | Scout + Athletic Trainer unlockable |
| Cosmetics (v1) | 3 jersey sets per team, 3 court themes |
| Season 1 official launch | 3-week regular season + playoffs |
| League Chat | In-app text channel per league |
| Global Leaderboard | Weekly top 100 fantasy managers |
| Rival System | Head-to-head record tracking |
| Monetization live | Season Pass, cosmetic bundle (see Section 10) |

**Gate Criteria:**
- [ ] ≥ 100 DAU organically without paid acquisition
- [ ] ≥ 30% of users share at least one card per season
- [ ] App Store rating ≥ 4.2

---

### Phase 4: Depth & Season 2 (Weeks 16–20)

**Goal:** Retain players through a second season and deepen the simulation.

**Deliverables:**

| Task | Description |
|------|-------------|
| Pro AI tier | Tactical opponent adaptation |
| Free Agency (in-season) | Waiver wire, 24-hour claim period |
| Weekly Challenge mode | Global fixed-roster leaderboard |
| Staff System (v2) | Head Coach + Team Psychologist |
| Finances / Salary Cap (v1) | $20M cap, player salaries |
| Historical Stats Archive | Full season-by-season records |
| Hall of Fame | Retired legends displayed |
| Breakthrough Events | Random narrative player events |
| Accessibility Pass | Screen reader support, high-contrast mode |

**Gate Criteria:**
- [ ] ≥ 40% of Season 1 players start Season 2
- [ ] Average session length ≥ 4 minutes

---

### Phase 5: App Store Launch v1.0 (Weeks 21–24)

**Goal:** Public launch with full feature parity between web and native.

**Deliverables:**
- App Store Connect + Google Play Store listing with screenshots/videos
- App Store Optimization (ASO) — keywords, localizations (PT/EN)
- Onboarding tutorial (first-time user experience)
- Customer support channel
- Analytics integration (Mixpanel or Firebase Analytics)
- Launch press kit (social media, Brazilian gaming communities)

**Gate Criteria:**
- [ ] Approved in both App Stores
- [ ] Crash rate < 0.5%
- [ ] Day-1 retention ≥ 40%
- [ ] Day-7 retention ≥ 20%

---

## 8. Technical Architecture

> This section gives folder/module layout and backend schema direction. Detailed implementation is in each feature spec (Section 6) and phase plan (Section 7).

### 8.1 Frontend Module Layout

```
pretetesbasketballgame/
│
├── src/
│   ├── core/                     # Pure simulation (no UI, no network)
│   │   ├── dice.js               ✅ Dice rolling
│   │   ├── player.js             ✅ Player model + attribute logic
│   │   ├── team.js               ✅ Team model
│   │   ├── court.js              ✅ Court grid
│   │   ├── matchEngine.js        ✅ Game loop
│   │   ├── actionResolver.js     ✅ Attack/defense formulas
│   │   ├── dribbleSystem.js      ✅ d20 dribble contests
│   │   ├── fantasyScoring.js     ⬜ Stats → fantasy points
│   │   ├── tacticsEngine.js      ⬜ Play style modifiers
│   │   └── progressionEngine.js  ⬜ XP, aging, breakthrough events
│   │
│   ├── gameplay/
│   │   ├── narration.js          ✅ Portuguese play-by-play
│   │   ├── playerCreator.js      ⬜ Generate player from archetype
│   │   ├── draftEngine.js        ⬜ Snake + auction draft logic
│   │   ├── tradeEngine.js        ⬜ Trade proposal + validation
│   │   ├── seasonManager.js      ⬜ Season calendar + scheduling
│   │   └── aiOpponent.js         ⬜ AI tier implementations
│   │
│   ├── ui/                       # React components (web)
│   │   ├── MatchView.jsx         ✅ Live match display
│   │   ├── TeamSetup.jsx         ✅ Lineup selection
│   │   ├── ScoreBoard.jsx        ⬜ Score + quarter display
│   │   ├── NarrationLog.jsx      ⬜ Scrollable event log
│   │   ├── DraftRoom.jsx         ⬜ Draft lobby + pick UI
│   │   ├── FantasyDashboard.jsx  ⬜ Weekly fantasy scores
│   │   ├── TacticsPicker.jsx     ⬜ Scheme selector
│   │   ├── LeagueHub.jsx         ⬜ League home screen
│   │   ├── PlayerCard.jsx        ⬜ Player stat display
│   │   └── ShareCard.jsx         ⬜ Shareable image generator
│   │
│   ├── mobile/                   # React Native screens (Phase 2)
│   │   ├── screens/
│   │   │   ├── HomeScreen.jsx
│   │   │   ├── LeagueScreen.jsx
│   │   │   ├── DraftScreen.jsx
│   │   │   ├── MatchScreen.jsx
│   │   │   ├── RosterScreen.jsx
│   │   │   └── ProfileScreen.jsx
│   │   └── navigation/
│   │       └── AppNavigator.jsx
│   │
│   ├── backend/                  # Firebase / API integration
│   │   ├── firebase.js           ⬜ Firebase init
│   │   ├── auth.js               ⬜ Auth helpers
│   │   ├── db/
│   │   │   ├── users.js          ⬜ User CRUD
│   │   │   ├── teams.js          ⬜ Team CRUD
│   │   │   ├── leagues.js        ⬜ League CRUD
│   │   │   ├── matches.js        ⬜ Match records
│   │   │   └── players.js        ⬜ Player registry
│   │   └── functions/            ⬜ Cloud Function wrappers
│   │
│   ├── gameController.js         ⬜ Main simulation orchestrator
│   └── App.jsx                   Main React entry point
│
├── public/
│   ├── index.html
│   └── styles.css
│
└── docs/
    └── GAME_BALANCE.md
```

### 8.2 Backend Schema Direction (Firestore)

All collections use Firestore. Document IDs are UUIDs unless noted.

```
users/{userId}
  ├── displayName : string
  ├── email       : string
  ├── createdAt   : timestamp
  └── stats       : { totalWins, totalLosses, fantasyPtsAllTime }

teams/{teamId}
  ├── ownerId     : userId
  ├── name        : string
  ├── city        : string
  ├── colorPrimary : hex string
  ├── colorSecondary : hex string
  ├── season      : integer
  └── players/    : sub-collection of playerIds (12 max)

players/{playerId}
  ├── teamId      : teamId (null if free agent)
  ├── name, age, position, archetype, nationality ...
  ├── attributes  : { Attack, Defense, ThreePoint, ... }   (1-99)
  ├── d20attrs    : { Dribble, StealMarkingD20 }            (1-20)
  ├── potential   : integer
  ├── salary      : integer  (fictional currency)
  ├── xp          : integer
  └── career      : { seasons, totalPoints, totalRebounds, ... }

leagues/{leagueId}
  ├── name        : string
  ├── inviteCode  : string (6 chars)
  ├── commissionerId : userId
  ├── draftType   : enum { snake, auction }
  ├── fantasyMode : enum { headToHead, roto, points }
  ├── scoringConfig : { points, rebounds, assists, ... }
  ├── teamIds     : [teamId]
  └── season      : integer

matches/{matchId}
  ├── leagueId    : leagueId
  ├── homeTeamId  : teamId
  ├── awayTeamId  : teamId
  ├── homeScore   : integer
  ├── awayScore   : integer
  ├── status      : enum { scheduled, live, completed }
  ├── season      : integer
  ├── week        : integer
  ├── events      : [{ type, playerId, result, timestamp }]
  └── playerStats : { [playerId]: { pts, reb, ast, stl, blk, to } }

seasons/{seasonId}
  ├── leagueId    : leagueId
  ├── number      : integer
  ├── status      : enum { draft, regular, playoffs, offseason }
  ├── schedule    : [{ week, matchIds }]
  └── standings   : [{ teamId, wins, losses, fantasyPts }]
```

### 8.3 Key Architectural Principles

1. **Pure core logic** — all simulation code in `src/core/` has zero network calls and zero React dependencies. This makes it portable to React Native and unit-testable in isolation.
2. **Event-driven match** — the match engine emits events to a subscriber array; the UI subscribes for live updates; Firestore listens for persistence. Single source of truth.
3. **Offline-first** — React Native app must function without network for match simulation; sync to Firestore when connection restored.
4. **Modular tactics** — `tacticsEngine.js` injects play-style modifiers as a multiplier map into `actionResolver.js`. No hardcoded scheme logic in the match engine.
5. **Versioned scoring** — fantasy scoring config is stored per-league per-season; changing weights mid-season is blocked by a guard function.

---

## 9. Sub-Agent & Team Workstream Assignments

> Use this section to assign implementation work across agents or team members. Each workstream is independently buildable given the specs in Section 6 and architecture in Section 8.

### Workstream A – Core Simulation (Phase 0 / Phase 1)

**Owns:** `src/core/`, `src/gameController.js`

| Task | Priority | Spec Ref |
|------|----------|----------|
| Complete `src/gameController.js` (wire all Phase 0 systems) | 🔴 Now | DEVELOPMENT_CHECKLIST.md |
| Add fouls + free throws to match engine | 🔴 Phase 1 | Section 5 Gaps |
| Implement `tacticsEngine.js` (play style multipliers) | 🟡 Phase 2 | Section 6.3 |
| Implement `progressionEngine.js` (XP, aging) | 🟡 Phase 2 | Section 6.7 |
| Amateur AI tier | 🟡 Phase 1 | Section 6.10 |
| Pro + Elite AI tiers | 🟢 Phase 3–4 | Section 6.10 |

### Workstream B – Fantasy & Draft (Phase 2)

**Owns:** `src/gameplay/draftEngine.js`, `src/core/fantasyScoring.js`, `src/gameplay/tradeEngine.js`

| Task | Priority | Spec Ref |
|------|----------|----------|
| Snake draft engine (timer, pick order, auto-pick) | 🔴 Phase 2 | Section 6.2.1 |
| Auction draft engine (bidding, budget) | 🟡 Phase 2 | Section 6.2.2 |
| Fantasy scoring engine (default + custom weights) | 🔴 Phase 2 | Section 6.4 |
| Head-to-head weekly fantasy matchup calculation | 🟡 Phase 2 | Section 6.4.3 |
| Trade proposal + validation (salary cap check) | 🟡 Phase 3 | Section 6.2.4 |
| Free agency / waiver system | 🟡 Phase 3 | Section 6.2.3 |

### Workstream C – Player & Roster Systems (Phase 1 / Phase 2)

**Owns:** `src/gameplay/playerCreator.js`, `src/backend/db/players.js`

| Task | Priority | Spec Ref |
|------|----------|----------|
| Player Creator (manual + auto-generate) | 🔴 Phase 1 | Section 6.1 |
| Archetype attribute templates | 🔴 Phase 1 | Section 6.1 |
| Player Progression (XP, level-up) | 🟡 Phase 2 | Section 6.7 |
| Aging curve + retirement | 🟡 Phase 2 | Section 6.7 |
| Breakthrough events | 🟢 Phase 4 | Section 6.7 |
| Staff system | 🟢 Phase 3 | Section 6.10 |

### Workstream D – Backend & Infrastructure (Phase 1 / Phase 2)

**Owns:** `src/backend/`, Firebase project

| Task | Priority | Spec Ref |
|------|----------|----------|
| Firebase project setup + Auth | 🔴 Phase 1 | Section 8.2 |
| Firestore schema (users, teams, leagues, matches) | 🔴 Phase 1 | Section 8.2 |
| Season manager (`seasonManager.js`) + scheduling | 🟡 Phase 1 | Section 6.9 |
| Cloud Functions: match adjudication, trade execution | 🟡 Phase 2 | Section 8.1 |
| Offline sync (React Native) | 🟡 Phase 2 | Section 8.3 |
| Push notification integration | 🟡 Phase 3 | Section 6.5 |

### Workstream E – UI / UX (Phase 0 / Phase 1 / Phase 2)

**Owns:** `src/ui/`, `src/mobile/`

| Task | Priority | Spec Ref |
|------|----------|----------|
| Complete `ScoreBoard.jsx` + `NarrationLog.jsx` | 🔴 Phase 0 | DEVELOPMENT_CHECKLIST |
| League creation / join UI | 🔴 Phase 1 | Section 6.5.1 |
| Player Card component | 🔴 Phase 1 | Section 6.1 |
| Draft Room UI (web) | 🟡 Phase 2 | Section 6.2 |
| Fantasy Dashboard | 🟡 Phase 2 | Section 6.4 |
| Tactics Picker | 🟡 Phase 2 | Section 6.3 |
| React Native screen scaffolding | 🟡 Phase 2 | Section 8.1 |
| Share Card generator | 🟢 Phase 3 | Section 6.5.2 |
| Cosmetics (jerseys, courts) | 🟢 Phase 3 | Section 7 Phase 3 |
| Onboarding tutorial | 🟡 Phase 5 | Section 7 Phase 5 |

### Workstream F – Social & Growth (Phase 3)

**Owns:** Share Cards, Leaderboards, Rival System, League Chat

| Task | Priority | Spec Ref |
|------|----------|----------|
| Share Card image generation | 🟡 Phase 3 | Section 6.5.2 |
| Global Leaderboard (weekly fantasy leaders) | 🟡 Phase 3 | Section 6.5.3 |
| Rival System (head-to-head tracking) | 🟢 Phase 3 | Section 6.5.4 |
| League Chat | 🟢 Phase 3 | Section 6.5.1 |
| App Store listing + ASO | 🟡 Phase 5 | Section 7 Phase 5 |

---

## 10. Monetization Strategy

> **Core Principle: Zero Pay-to-Win.** No feature that improves your competitive results in league play can be purchased with real money. Every competitive advantage is earned through gameplay.

### 10.1 What You Can Buy (Real Money)

| Item | Price | Category |
|------|-------|----------|
| **Season Pass** | $2.99/season | Premium UX |
| **Cosmetic Bundle** (3 jersey sets + 2 court themes) | $1.99 | Cosmetics |
| **Remove Ads** | $3.99 one-time | Premium UX |
| **Extra League Slot** (default 1 free league, buy 2nd+) | $0.99/slot | Convenience |
| **Draft Board Premium** (advanced stats view in draft) | $0.99/season | Information |

**Season Pass includes:**
- Ad-free experience for the season
- 3 exclusive jersey designs (cosmetic only)
- Extended historical stats view (up to 3 seasons back vs. 1 free)
- Priority match simulation slot (no gameplay impact)
- Founder badge (cosmetic)

### 10.2 What You Can NEVER Buy (to Protect Competitive Integrity)

- Player attribute boosts
- Better AI opponent chances
- Higher XP gain rates
- Extra draft picks in competitive leagues
- Stronger players, higher Potential players
- Fantasy scoring multipliers

### 10.3 Free Tier (Sustainable & Fun Without Spending)

| Feature | Free | Paid |
|---------|------|------|
| Join/create leagues | ✅ (1 league) | ✅ (unlimited with extra slot) |
| Draft & play | ✅ | ✅ |
| Fantasy scoring | ✅ | ✅ |
| Stats archive | Last 1 season | Last 3+ seasons |
| Cosmetics | 2 default jerseys | 5+ jersey sets |
| Ads | Banner + interstitial between matches | None |
| Share Cards | Standard design | Premium animated design |

### 10.4 Revenue Projections

| Scenario | DAU | ARPDAU | Monthly Revenue |
|----------|-----|--------|-----------------|
| Conservative (soft launch) | 500 | $0.05 | $750 |
| Moderate (6-mo post-launch) | 5,000 | $0.08 | $12,000 |
| Optimistic (12 months) | 20,000 | $0.12 | $72,000 |

These are illustrative estimates for planning. Validate with actual A/B testing post-launch.

---

## 11. Viral Growth Loop

**The core loop that turns players into recruiters:**

```
1. Player creates their team (identity investment)
        ↓
2. Player joins a private league with friends (social commitment)
        ↓
3. Match happens → notable moment occurs (big upset, last-second shot)
        ↓
4. Share Card auto-generated → player shares to WhatsApp/Instagram
        ↓
5. Friend sees the card → curious about the game
        ↓
6. Friend downloads → gets invited to an existing league OR creates new league
        ↓
7. New player creates their team → loop repeats
```

### 11.1 Share Triggers (Moments Worth Sharing)

These moments should always trigger a Share Card prompt:

| Moment | Share Card Template |
|--------|-------------------|
| Draft pick (any round) | "I just drafted [Name] — is your squad ready?" |
| Season-opening win | "Season [N] starts with a W 🏆" |
| Comeback victory (down 10+ in Q4) | "They had NO idea what was coming." |
| Fantasy blowout (won by 40+ pts) | "Fantasy Week [N]: Dominant." |
| Player hits triple-double | "[Name] just went OFF — triple-double in Week [N]." |
| Season champion | "Quadra Legacy Season [N] Champion 🏆" |
| Rival win (beat your all-time rival) | "The rivalry is MINE now." |

### 11.2 Network Effects

| Signal | Effect |
|--------|--------|
| Every new player joins ≥1 league | Each new player strengthens at least 1 existing player's retention |
| League requires ≥4 managers | Creates demand for 3 more recruits per league creator |
| Season structure | Fixed end dates create "come back before season ends" urgency |
| Rivalry badges | Personal narrative hooks that keep returning players engaged |

### 11.3 App Store & Community Growth

- **Brazilian Gaming Communities:** Subreddits, Discord servers, Facebook groups focused on Elifoot and basketball games. Organic launch in these communities before paid acquisition.
- **Streamer / Content Creator Seeding:** Provide free Season Pass to 10–20 Brazilian basketball gaming influencers at launch.
- **App Store Reviews:** Prompt users who complete a full season to rate the app.

---

## 12. Definition of Success & Milestone Criteria

### 12.1 Milestone Gates

| Milestone | Criteria |
|-----------|----------|
| **Phase 0 Complete** | Full match runs; score 90–110 ppg; Portuguese narration; all unit tests pass |
| **Phase 1 Complete** | 2 users play a full match stored in Firestore; PWA installable; page load < 3 s |
| **Phase 2 Complete** | Full draft → match → fantasy score cycle works on iOS + Android; 10 beta testers confirm |
| **Phase 3 Complete** | 100 DAU organic; 30% share rate; App Store rating ≥ 4.2 |
| **Phase 4 Complete** | 40% Season 1 → Season 2 retention; avg session ≥ 4 min |
| **Launch v1.0** | Listed on App Store + Google Play; crash rate < 0.5%; Day-7 retention ≥ 20% |

### 12.2 North Star Metric

> **Leagues completed per week** — a league-week is one full matchweek played by all managers in a league.

This metric captures both acquisition (more leagues = more players) and retention (all managers must stay active for the league to complete). Optimizing for this one number aligns all teams.

### 12.3 Key Performance Indicators

| KPI | Target (6 months post-launch) |
|-----|-------------------------------|
| Daily Active Users (DAU) | 2,000+ |
| Day-1 Retention | ≥ 40% |
| Day-7 Retention | ≥ 20% |
| Day-30 Retention | ≥ 10% |
| Average Session Length | ≥ 4 minutes |
| Leagues Completed / Week | ≥ 50 |
| Paying Users (conversion) | ≥ 3% of DAU |
| Share Rate (shares per active user per week) | ≥ 25% |
| App Store Rating | ≥ 4.3 |
| Crash-Free Sessions | ≥ 99.5% |

### 12.4 Anti-Metrics (Things We Actively Avoid Optimizing For)

- **Time-in-app at the expense of session quality** — we do not want players opening the app anxiously; we want them opening it with anticipation.
- **Revenue from competitive features** — any uplift in revenue from pay-to-win mechanics is a failure signal, not a success.
- **Fake installs / inflated ratings** — all growth must be organic or from honest performance marketing.

---

## 13. Non-Negotiable Product Principles

> These are the "soul" of Quadra Legacy. Any feature, mechanic, or monetization decision that violates these principles must be rejected — no exceptions.

---

### 🏅 Principle 1 — Competitive Integrity Is Sacred

The outcome of a match or a fantasy league is determined entirely by the manager's decisions and skill, plus controlled randomness. Real money cannot buy a better result. If a paying player can win more often than a free player at the same skill level, we have failed.

---

### 🎭 Principle 2 — Every Player Has a Story

Players in Quadra Legacy are fictional people, not trading card numbers. They have names, hometowns, arcs, breakthrough moments, and eventually retirement. The UI should always make it feel like you are managing athletes, not optimizing statistics.

---

### 📱 Principle 3 — Mobile-First, Always

Every feature must be designed for a 375px screen and a single thumb. Desktop is secondary. If a feature requires a keyboard and mouse to use effectively, it is not finished.

---

### ⚡ Principle 4 — Respect the Player's Time

A full match experience — including reviewing tactics, watching narration, and checking fantasy results — must be completable in under 5 minutes. Sessions longer than 10 minutes must be entirely optional. Players should never feel "stuck" doing mandatory tasks.

---

### 🇧🇷 Principle 5 — Portuguese First, Then English

The core audience is Brazilian. All narration, all first-run text, all UI strings default to Brazilian Portuguese. English is a secondary localization. Do not sacrifice natural-sounding PT narration for implementation convenience.

---

### 🤝 Principle 6 — Social, Not Solitary

Every core feature should have a social dimension. Solo play is supported, but the best version of Quadra Legacy is always played in a private league with friends. Features that deepen the social experience are prioritized over features that only improve solo play.

---

### 🔬 Principle 7 — Depth Is Discoverable, Not Required

New users must be able to start playing immediately with no tutorial. Advanced systems (auction drafts, custom fantasy scoring, salary cap management) reveal themselves gradually. A first-time player who ignores all advanced settings should still have fun.

---

### 🎲 Principle 8 — Randomness Has Purpose

Dice and probability are central to the game's fun. But randomness exists to create memorable moments and narrative, not to override skill. A manager with a significantly better roster and tactics should win more often. Upsets should feel exciting, not unfair.

---

### ♻️ Principle 9 — Seasons Create Meaning

Every season has a beginning, middle, and end. Player careers evolve. Teams change. Champions are crowned. This rhythmic structure is what transforms a game into a *world* that players return to. Never make the season structure feel like a grind treadmill — make each season feel like a new story.

---

### 📣 Principle 10 — Build in Public, Iterate in Community

The development team should be active in the Brazilian basketball gaming community. Share changelogs. Explain balance decisions. Invite feedback before shipping, not after. The players are the co-authors of this game's future.

---

---

**Document Version:** 1.0  
**Created:** February 2026  
**Status:** 🟢 Active Reference — Read Before Implementing  
**Maintainer:** Quadra Legacy Product & Engineering Team

> _This document supersedes high-level product decisions scattered across prior design documents. When in conflict with `DEVELOPMENT_ROADMAP.md` or `DEVELOPMENT_CHECKLIST.md`, this document takes precedence on strategic direction; those documents take precedence on day-to-day task status._

---

**Made with 💜 by the Quadra Legacy Dev Team**
