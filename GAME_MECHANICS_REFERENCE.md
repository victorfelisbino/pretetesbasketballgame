# 🎮 Game Mechanics Quick Reference

**For:** Developers building Quadra Legacy  
**Ref:** From Game Design Document + Your Excel Sheets  
**Last Updated:** January 1, 2026

---

## 📐 Court & Movement

### Court Dimensions
- **Grid:** 50 × 30 (width × height)
- **Units:** Grid squares (configurable for scaling)
- **Boundary:** Hard limits (players can't move off-court)

### Movement Speed (Squares per Round)

| Position | WITH Ball | WITHOUT Ball | Role |
|----------|-----------|--------------|------|
| **PG** | 10 | 13 | Playmaker, ball handler |
| **SG** | 8 | 11 | Scorer, 3pt specialist |
| **SF** | 7 | 10 | Versatile, 3pt shooting |
| **PF** | 6 | 8 | Inside-out, rebounds |
| **C** | 5 | 7 | Rim protector, interior |

**Why:** Faster guards can bring ball up court; centers are slower but more powerful inside.

---

## 🎲 Dice System

### Standard Dice Notation
- `1d6` = Roll one 6-sided die (results: 1-6, average: 3.5)
- `2d6` = Roll two 6-sided dice (results: 2-12, average: 7)
- `1d4+1d6` = Roll both and sum (results: 2-10)

### Rolling Function
```javascript
// Example usage
const roll = DiceRoller.rollNotation('2d6');
// Returns: { rolls: [4, 5], total: 9, notation: '2d6' }
```

---

## 🔢 Skill-Based Success Probability

### Your Formula (DO NOT CHANGE)
```
IF attackerSkill > defenderSkill:
  successPercent = 100 - (2*B - A) / 2

ELSE IF attackerSkill < defenderSkill:
  successPercent = (2*A - B) / 2

ELSE (A == B):
  successPercent = 50%
```

### Examples
| Attacker | Defender | Success % | Outcome |
|----------|----------|-----------|---------|
| 99 | 51 | 98% | Elite beats average |
| 51 | 99 | 2% | Average vs elite |
| 75 | 75 | 50% | Even match |
| 85 | 70 | 72.5% | Better wins |
| 99 | 99 | 50% | Even (same skill) |

**Why:** Rewards better players but always keeps variance (not 0/100%).

---

## 🎯 Position-Based Actions (Per Quarter)

### 2-Point Attempts
Roll dice based on position:

| Position | Dice | Min | Max | Why |
|----------|------|-----|-----|-----|
| **C** | 2d6 | 2 | 12 | Centers shoot inside |
| **PF** | 1d8 | 1 | 8 | Power forwards, mid-range |
| **SG/SF** | 1d4 | 0 | 4 | Guards less 2pt volume |
| **PG** | 1d4 | 0 | 4 | Point guard playmaker |

**Success Check:** Roll is subject to attack vs defense formula above.

---

### 3-Point Attempts
| Position | Dice | Min | Max | Why |
|----------|------|-----|-----|-----|
| **SG** | 1d6 | 0 | 6 | Shooting guard specialist |
| **SF** | 1d6 | 0 | 6 | Small forward versatile |
| **PG** | 1d3 | 0 | 3 | Can shoot 3pt but less |
| **PF/C** | — | — | — | Can't shoot 3pt (low % irl) |

---

### Rebounds
| Position | Dice | Min | Max | Why |
|----------|------|-----|-----|-----|
| **C** | 3d6 | 3 | 18 | Best rebounder |
| **PF** | 2d6 | 2 | 12 | Power forward edge |
| **SF** | 1d6 | 1 | 6 | Can rebound but not specialty |
| **SG/PG** | — | — | — | Rarely get rebounds |

---

### Assists
| Position | Dice | Min | Max |
|----------|------|-----|-----|
| **PG** | 1d10 | 1 | 10 |
| **SG** | 1d6 | 0 | 6 |
| **Others** | — | — | — |

---

### Steals
| Position | Dice | Min | Max |
|----------|------|-----|-----|
| **PG** | 1d4 + 1d6 | 2 | 10 |
| **SG** | 1d2 + 1d3 | 2 | 5 |
| **Others** | — | — | — |

---

### Blocks
| Position | Dice | Min | Max |
|----------|------|-----|-----|
| **C** | 1d8 + 1d10 | 2 | 18 |
| **PF** | 1d4 + 1d5 | 2 | 9 |
| **Others** | — | — | — |

---

## 🎪 Dribble vs Steal (d20 System)

### The Formula
```
dribble_success_threshold = 20 - (DRIBBLE - STEAL_MARKING)

Roll d20:
IF roll >= threshold: DRIBBLE SUCCEEDS (advance with ball)
IF roll < threshold: TURNOVER (defender steals)
```

### Key Notes
- **DRIBBLE attribute:** 1-20 scale, LOWER is better (easier to handle ball)
- **STEAL/MARKING attribute:** 1-20 scale, LOWER is better (easier to steal)
- **Difference:** Larger difference = higher success rate for dribbler

### Examples

| Dribble | Steal | Diff | Threshold | Success % | Interpretation |
|---------|-------|------|-----------|-----------|-----------------|
| 16 | 2 | 14 | 6 | 75% | Good ball handler vs weak defender |
| 10 | 10 | 0 | 20 | 5% | Evenly matched (rare success) |
| 8 | 12 | -4 | 24 | 0% | Weaker ball handler, stronger defender |
| 18 | 4 | 14 | 6 | 75% | Excellent dribbler vs decent defender |
| 5 | 18 | -13 | 33 | 0% | Can't dribble past elite defender |

**Why:** Allows skilled ball handlers to create chances, but elite defenders can still force turnovers.

---

## 🏀 Game Flow (100 Rounds per Match)

### Structure
```
GAME (4 Quarters)
├─ QUARTER 1
│  ├─ POSSESSION 1 (5 rounds max)
│  │  ├─ Round 1: Offense positioning (move, no play yet)
│  │  ├─ Round 2: Defense positioning (react)
│  │  ├─ Round 3: Offense action (dribble/pass/shoot)
│  │  ├─ Round 4: Defense reaction (steal/block)
│  │  └─ Round 5: Final action or timeout
│  ├─ POSSESSION 2
│  │  └─ [Repeat]
│  └─ ... (≈25 possessions per quarter)
├─ QUARTER 2
│  └─ [Repeat]
├─ QUARTER 3
│  └─ [Repeat]
└─ QUARTER 4
   └─ [Repeat]
```

### Total Rounds = 100 (configurable: 10, 20, 30 plays per quarter)

---

## 🎯 Action Outcomes

### Successful 2-Pointer
1. Attacker initiates shot attempt
2. Roll 1d6 (or position-specific dice)
3. Check success % against defender (your formula)
4. If success: +2 points + event log
5. Rebound opportunity (automatic)

### Successful 3-Pointer
1. Similar to 2-pointer
2. Roll 1d8 (or position-specific dice)
3. If success: +3 points + event log

### Successful Assist
1. Passer initiates pass
2. Check success % (passer skill vs defender marking)
3. If success: Receiver gets possession, passer gets assist
4. If fail: Turnover (defender intercepts)

### Rebound Contest
1. Two players (off + def) contest loose ball
2. Roll both positions' rebound dice
3. Higher roll wins possession
4. Winner continues possession, loser loses ball

### Steal Attempt
1. Defender initiates steal on ball handler
2. Use d20 dribble system (see above)
3. If success: Turnover + defender gets ball
4. If fail: Turnover on offense (penalty for risky play)

---

## 📊 Player Attributes

### Core Skills (1-99 scale, higher = better)

**Offensive:**
- **Attack** (1-99) - Overall offensive ability
- **FieldGoal** (1-99) - General shooting accuracy
- **FieldGoalPaint** (1-99) - Shooting inside paint
- **FieldGoalMidRange** (1-99) - Mid-range shooting
- **ThreePoint** (1-99) - 3-point shooting
- **DunkLayup** (1-99) - Close-range finishing
- **FreeThrow** (1-99) - Free throw accuracy
- **Passing** (1-99) - Pass accuracy

**Defensive:**
- **Defense** (1-99) - Overall defensive ability
- **StealMarking** (1-99) - Steal/guard ability
- **Blocking** (1-99) - Shot blocking

**Physical/Mental:**
- **Stamina** (1-99) - Endurance over 4 quarters
- **Chemistry** (1-99) - Team synergy bonus
- **Morale** (1-99) - Consistency
- **Potential** (1-99) - Growth ceiling

### d20 Attributes (1-20 scale, LOWER = better)

- **Dribble** (1-20) - Ball handling (vs Steal/Marking in d20 contests)
- **StealMarkingD20** (1-20) - Defensive pressure (separate from 1-99 Steal/Marking)

---

## 🎬 Narration Template Examples

### Portuguese Narration (Elifoot Style)

```
⏱ 8:32 - M. Santos avança com a bola!
⏱ 8:28 - Passa para J. Silva no garrafão!
⏱ 8:25 - CESTA DE 2 PONTOS! Santos 47×42
⏱ 8:10 - Corinthians na reposição...
⏱ 8:05 - Tentativa de 3 pontos... ERROU!
⏱ 8:02 - REBOTE! A. Pereira pega a bola!
⏱ 7:58 - Contra-ataque do Santos!
⏱ 7:55 - TOCO! Defesa espetacular!
```

### Template Variables
- `{jogador}` = Player name
- `{time}` = Team name
- `{score}` = Current score (e.g., "47×42")
- `{pontos}` = Points scored (2 or 3)
- `{defensor}` = Defender name

---

## ⚙️ Balance Targets

### Scoring Range (Per Team, Per Match)
- **Target average:** 90-110 points per match
- **Range:** 70-130 (allow variance)
- **Better team:** Win 60-70% of time
- **Close match:** 50-50 chance when evenly skilled

### Possession Breakdown
- **Successful possessions:** 40-50%
- **Turnovers:** 25-35%
- **Shooting attempts:** 25-35%
- **Other (fouls, timeouts):** 5-10% (Phase 1+)

### Player Distribution
```
Skill Level (1-99)
50-59 = Rookie / Journeyman
60-74 = Solid / Starter
75-84 = All-Star
85-94 = MVP-caliber
95-99 = Legendary
```

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Dice: 1d6 average = 3.5 (after 1000 rolls)
- [ ] Probability: A=99, B=51 = 98%
- [ ] Dribble: D=16, S=2 = 75% success
- [ ] Movement: PG can move 10 squares/round

### Integration Tests
- [ ] Full match completes
- [ ] Score is 80-120 range
- [ ] Better team wins more
- [ ] Narration generates correctly

---

## 📝 Common Mistakes to Avoid

1. **Formula Off-by-One:** Double-check parentheses in success formula
2. **Dice Min/Max:** Remember 2d6 starts at 2 (not 0)
3. **Position Names:** PG ≠ PF (Point Guard vs Power Forward)
4. **Scale Confusion:** Attributes 1-99, but d20 is 1-20
5. **Portuguese Typos:** "cesta" (basket), "rebote" (rebound), "toco" (block)
6. **Boundary Check:** Players at grid edge can't move off-court
7. **Possession Timing:** 5 rounds max per possession
8. **Turnover Logic:** Loss of ball possession, not loss of game

---

## 🔗 File References

| File | Purpose | Status |
|------|---------|--------|
| `src/dice.js` | Dice rolling + probability | ✅ Done |
| `src/player.js` | Player class | ✅ Done |
| `src/team.js` | Team class | ✅ Done |
| `src/court.js` | Court grid + movement | ⬜ TODO |
| `src/matchEngine.js` | Game loop | ⬜ TODO |
| `src/actionResolver.js` | Action outcomes | ⬜ TODO |
| `src/dribbleSystem.js` | d20 dribble contests | ⬜ TODO |
| `src/narration.js` | Portuguese text | ⬜ TODO |
| `src/ui/MatchView.jsx` | React UI | ⬜ TODO |

---

## 💡 Tips

- **Balance Testing:** Run 10 matches, check avg score and win %. Adjust formulas if off.
- **Portuguese:** Use native speaker to check narration for natural flow.
- **Movement:** Test boundary conditions (player at edge trying to move off)
- **Dice:** Log all rolls to verify probabilities match theory.
- **Narration:** Add timestamps so player can follow game timeline.

---

**Version:** 1.0  
**Last Updated:** January 1, 2026  
**Status:** Reference Document
