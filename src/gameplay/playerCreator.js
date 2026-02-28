/**
 * playerCreator.js
 * Quadra Legacy — Player Creator System
 *
 * Generates fictional Brazilian basketball players for the manager game.
 * Pure logic module: zero network calls, zero React dependencies.
 *
 * Exports:
 *   createPlayerManual(options)   — user-specified identity, auto-generated attributes
 *   createPlayerAuto(options)     — fully automatic generation
 *   generatePlayerPool(count, options) — batch generation for draft pools
 *
 * Compatibility: returned objects are duck-type compatible with the Player class
 * defined in src/player.js and with all property lookups in src/actionResolver.js.
 * We do NOT extend Player directly because player.js uses CommonJS (module.exports)
 * while this module is an ES module; mixing the two inheritance chains requires a
 * bundler guarantee we cannot assume here. Instead we inject every Player method
 * directly onto each plain object so all match-engine, Team-class, and
 * ActionResolver call sites work without modification.
 */

// ─────────────────────────────────────────────────────────────────────────────
// NAME DATA
// ─────────────────────────────────────────────────────────────────────────────

const BRAZILIAN_FIRST_NAMES = [
  'João', 'Lucas', 'Gabriel', 'Rafael', 'Mateus', 'Felipe', 'Thiago', 'Bruno',
  'Diego', 'André', 'Carlos', 'Marcos', 'Paulo', 'Ricardo', 'Eduardo', 'Fernando',
  'Gustavo', 'Henrique', 'Leonardo', 'Rodrigo', 'Alexandre', 'Daniel', 'Vinícius',
  'Pedro', 'Arthur', 'Caio', 'Victor', 'Enzo', 'Igor', 'Luan', 'Murilo', 'Natan',
  'Otávio', 'Renan', 'Samuel', 'Tiago', 'Vagner', 'Welton', 'Xavier', 'Yuri',
];

const BRAZILIAN_LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha',
  'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado',
  'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Cruz', 'Castro',
];

/** International first names grouped by nationality, for the 30 % non-Brazilian pool. */
const INTL_FIRST_NAMES = {
  American:  ['James', 'DeShawn', 'Marcus', 'Isaiah', 'Tyrone', 'Darius', 'Malik', 'Trevon'],
  Spanish:   ['Alejandro', 'Carlos', 'Miguel', 'Sergio', 'Rubén', 'Óscar'],
  Argentine: ['Facundo', 'Matías', 'Agustín', 'Santiago', 'Nicolás', 'Ezequiel'],
  French:    ['Antoine', 'Théo', 'Nicolas', 'Maxime', 'Kévin', 'Guillaume'],
  Serbian:   ['Nikola', 'Luka', 'Bogdan', 'Stefan', 'Marko', 'Nemanja'],
};

const INTL_LAST_NAMES = {
  American:  ['Johnson', 'Williams', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Jackson', 'Martin', 'Thompson'],
  Spanish:   ['García', 'Martínez', 'López', 'Sánchez', 'González', 'Fernández', 'Romero', 'Torres'],
  Argentine: ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Sosa', 'Pereyra'],
  French:    ['Martin', 'Bernard', 'Thomas', 'Petit', 'Durand', 'Robert', 'Richard', 'Simon'],
  Serbian:   ['Jokić', 'Dončić', 'Bogdanović', 'Bjelica', 'Teodosić', 'Milutinov'],
};

/** Non-Brazilian nationality pool (30 % share). */
const INTL_NATIONALITIES = ['American', 'Spanish', 'Argentine', 'French', 'Serbian'];
/** Probabilities for each international nationality (must sum to 1.0). */
const INTL_NAT_WEIGHTS   = [0.40, 0.20, 0.20, 0.10, 0.10];

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION DATA
// ─────────────────────────────────────────────────────────────────────────────

const BRAZILIAN_CITIES = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Salvador', 'Fortaleza',
  'Curitiba', 'Manaus', 'Recife', 'Porto Alegre', 'Belém', 'Goiânia',
  'Guarulhos', 'Campinas', 'São Luís', 'São Gonçalo', 'Maceió', 'Natal',
  'Teresina', 'Campo Grande', 'Nova Iguaçu', 'Contagem', 'João Pessoa',
  'São José dos Campos', 'Uberlândia', 'Sorocaba', 'Ribeirão Preto',
  'Aracaju', 'Cuiabá', 'Feira de Santana', 'Joinville', 'Londrina',
  'Ananindeua', 'Santos', 'Niterói', 'Serra', 'Caxias do Sul',
];

const INTL_CITIES = {
  American:  ['Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix', 'Atlanta', 'Dallas', 'Miami', 'Detroit', 'Charlotte'],
  Spanish:   ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza'],
  Argentine: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Mar del Plata'],
  French:    ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Bordeaux', 'Lille', 'Nice', 'Strasbourg'],
  Serbian:   ['Belgrade', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica'],
};

// ─────────────────────────────────────────────────────────────────────────────
// POSITION PHYSICAL PROFILES
// ─────────────────────────────────────────────────────────────────────────────

/** height_cm and weight_kg ranges by position. */
const POSITION_PHYSICAL = {
  PG: { heightRange: [175, 190], weightRange: [70,  85]  },
  SG: { heightRange: [185, 198], weightRange: [80,  95]  },
  SF: { heightRange: [195, 208], weightRange: [90,  110] },
  PF: { heightRange: [203, 213], weightRange: [100, 115] },
  C:  { heightRange: [208, 220], weightRange: [110, 130] },
};

// ─────────────────────────────────────────────────────────────────────────────
// ARCHETYPE ATTRIBUTE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
//
// All 1-99-scale attributes are listed for every archetype so there are no
// "unspecified" gaps. Attributes that are characteristically low for an archetype
// are given explicit low ranges (20–40) so the generator never silently defaults
// to a neutral mid-range for a specialist player.
//
// d20-scale attributes (Dribble, StealMarkingD20): 1 = most skilled, 20 = least.
// Range [min, max] — the generator picks within this range before position bonus.

const ARCHETYPE_TEMPLATES = {
  Scorer: {
    // KEY HIGH
    Attack:            [75, 90],
    ThreePoint:        [70, 85],
    // MEDIUM
    Stamina:           [60, 75],
    FieldGoal:         [65, 80],
    FieldGoalMidRange: [64, 78],
    DunkLayup:         [62, 78],
    FreeThrow:         [62, 78],
    Morale:            [58, 75],
    Chemistry:         [52, 70],
    // LOW
    Defense:           [35, 50],
    Passing:           [35, 50],
    StealMarking:      [32, 48],
    Blocking:          [22, 38],
    FieldGoalPaint:    [48, 65],
    // GROWTH
    Potential:         [48, 95],
    // d20: Scorer is decent with the ball
    Dribble:           [8,  15],
    StealMarkingD20:   [12, 18],
  },

  Defender: {
    // KEY HIGH
    Defense:           [75, 90],
    StealMarking:      [70, 85],
    Stamina:           [70, 80],
    Blocking:          [55, 72],
    // MEDIUM
    FieldGoalPaint:    [50, 68],
    DunkLayup:         [35, 50],
    Attack:            [44, 60],
    FieldGoal:         [44, 62],
    Passing:           [46, 63],
    Morale:            [62, 80],
    Chemistry:         [56, 75],
    FreeThrow:         [44, 62],
    // LOW
    ThreePoint:        [28, 44],
    FieldGoalMidRange: [30, 48],
    // GROWTH
    Potential:         [42, 88],
    // d20: elite pressure defence
    Dribble:           [10, 17],
    StealMarkingD20:   [2,   8],
  },

  Playmaker: {
    // KEY HIGH
    Passing:           [75, 90],
    Dribble:           [2,   6], // Very low d20 = elite dribbler
    ThreePoint:        [55, 70],
    // MEDIUM
    Attack:            [55, 72],
    FieldGoal:         [57, 74],
    FieldGoalMidRange: [57, 74],
    DunkLayup:         [52, 70],
    FreeThrow:         [64, 80],
    StealMarking:      [58, 75],
    Stamina:           [60, 78],
    Chemistry:         [72, 88],
    Morale:            [60, 78],
    Defense:           [44, 62],
    // LOW
    Blocking:          [18, 34],
    FieldGoalPaint:    [42, 60],
    // GROWTH
    Potential:         [46, 92],
    StealMarkingD20:   [9,  15],
  },

  Rebounder: {
    // KEY HIGH
    FieldGoalPaint:    [75, 90],
    Blocking:          [70, 85],
    Defense:           [60, 75],
    DunkLayup:         [72, 88],
    // MEDIUM
    Attack:            [56, 75],
    FieldGoal:         [58, 76],
    Stamina:           [62, 78],
    Chemistry:         [50, 70],
    Morale:            [54, 72],
    FreeThrow:         [46, 64],
    StealMarking:      [40, 58],
    // LOW
    ThreePoint:        [18, 34],
    FieldGoalMidRange: [26, 44],
    Passing:           [32, 50],
    // GROWTH
    Potential:         [40, 88],
    // d20: big men are not ball-handlers
    Dribble:           [14, 19],
    StealMarkingD20:   [11, 17],
  },

  Stretch: {
    // KEY HIGH
    ThreePoint:        [80, 90],
    FieldGoalMidRange: [70, 85],
    FreeThrow:         [72, 86],
    // MEDIUM
    Attack:            [55, 70],
    FieldGoal:         [68, 82],
    DunkLayup:         [44, 62],
    Passing:           [50, 68],
    Stamina:           [56, 74],
    Morale:            [58, 76],
    Chemistry:         [54, 72],
    Defense:           [38, 57],
    StealMarking:      [35, 54],
    // LOW
    Blocking:          [18, 34],
    FieldGoalPaint:    [22, 40],
    // GROWTH
    Potential:         [42, 90],
    // d20: moderate ball-handling
    Dribble:           [9,  16],
    StealMarkingD20:   [11, 18],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// POSITION BONUSES
// ─────────────────────────────────────────────────────────────────────────────
//
// Applied on top of archetype values after initial generation so that even a
// Scorer playing C has above-average paint scoring compared to a Scorer playing PG.
// For d20 attributes, negative = better (lower d20 = more skilled).
// Values are raw additions to the generated number before clamping.

const POSITION_BONUSES = {
  PG: { Passing: +8,  ThreePoint: +4,   StealMarking: +5, Stamina: +3,  Dribble: -3 },
  SG: { ThreePoint: +6, FieldGoalMidRange: +6, Stamina: +2, StealMarking: +3           },
  SF: { Attack: +5,  FieldGoalMidRange: +4, Defense: +3                                },
  PF: { FieldGoalPaint: +6, Blocking: +8,  DunkLayup: +6                               },
  C:  { FieldGoalPaint: +9, Blocking: +12, DunkLayup: +9, Stamina: -3                  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VALID ENUMERATIONS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_POSITIONS  = ['PG', 'SG', 'SF', 'PF', 'C'];
const VALID_ARCHETYPES = ['Scorer', 'Defender', 'Playmaker', 'Rebounder', 'Stretch'];
const DOMINANT_HANDS   = ['Right', 'Right', 'Right', 'Left']; // 75% right-handed

// ─────────────────────────────────────────────────────────────────────────────
// RANDOM-NUMBER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mulberry32 seeded PRNG.
 * Returns a function that produces floats in [0, 1).
 * If no seed is provided, falls back to Math.random (unseeded).
 */
function makeRng(seed) {
  if (seed === undefined || seed === null) {
    return () => Math.random();
  }
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RFC 4122 UUID v4, generated with the provided rng function. */
function generateUUID(rng) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const v = c === 'x'
      ? Math.floor(rng() * 16)
      : (Math.floor(rng() * 16) & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Pick a random element from an array using the provided rng. */
function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Random integer in [min, max] inclusive. */
function randInt(min, max, rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Clamp a number to [min, max]. */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generate one 1-99 attribute from a [min, max] template range.
 * Adds a small ±variance to create realistic spread within the archetype.
 */
function generateAttr(min, max, rng, variance = 6) {
  const base  = randInt(min, max, rng);
  const delta = Math.round((rng() * 2 - 1) * variance);
  return clamp(base + delta, 1, 99);
}

/**
 * Generate one d20 attribute from a [min, max] range.
 * Clamped to [1, 20]. Lower value = more skilled (per spec).
 */
function generateD20Attr(min, max, rng) {
  return clamp(randInt(min, max, rng), 1, 20);
}

/**
 * Convert a d20 dribble value (1 = best, 20 = worst) to a 1-99 dribbling
 * skill rating so actionResolver.js can use it for its attack-vs-defense
 * success formula.
 *   d20 = 1  →  skill = 99
 *   d20 = 20 →  skill = 1
 */
function d20ToSkill(d20) {
  return clamp(Math.round(99 - ((d20 - 1) / 19) * 98), 1, 99);
}

/**
 * Weighted-random age generation.
 * Distribution skews toward prime career years (22-26).
 */
function generateAge(rng) {
  const roll = rng();
  if (roll < 0.06) return randInt(18, 19, rng); // raw prospect
  if (roll < 0.18) return randInt(20, 21, rng); // young talent
  if (roll < 0.52) return randInt(22, 26, rng); // prime years  ← heaviest bucket
  if (roll < 0.76) return randInt(27, 30, rng); // peak / early decline
  if (roll < 0.91) return randInt(31, 34, rng); // veteran
  return randInt(35, 38, rng);                  // greybeard
}

/**
 * Pick a weighted item from a parallel [items, weights] pair.
 * weights must sum to 1.0.
 */
function weightedPick(items, weights, rng) {
  const r = rng();
  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return items[i];
  }
  return items[items.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTRIBUTE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full attribute set for a player of a given position and archetype.
 * Returns { attrs, d20Attrs }.
 *
 * attrs    — plain object with all 1-99 scale attributes
 * d20Attrs — plain object with Dribble and StealMarkingD20 (1-20 scale)
 */
function buildAttributes(position, archetype, rng) {
  const template = ARCHETYPE_TEMPLATES[archetype];
  const posBonus = POSITION_BONUSES[position] || {};

  // All standard 1-99 attributes
  const ATTR_KEYS = [
    'Attack', 'FieldGoal', 'FieldGoalPaint', 'FieldGoalMidRange',
    'ThreePoint', 'DunkLayup', 'FreeThrow', 'Passing',
    'Defense', 'StealMarking', 'Blocking',
    'Stamina', 'Chemistry', 'Morale', 'Potential',
  ];

  const attrs = {};
  for (const key of ATTR_KEYS) {
    const [lo, hi] = template[key];
    const raw      = generateAttr(lo, hi, rng, 6);
    const bonus    = posBonus[key] || 0;
    attrs[key]     = clamp(raw + bonus, 1, 99);
  }

  // d20 attributes — Dribble
  const [dLo, dHi]     = template.Dribble;
  const dribbleBase    = generateD20Attr(dLo, dHi, rng);
  // PG bonus is negative (lower d20 = better dribbler)
  const dribbleBonus   = posBonus.Dribble || 0;
  const d20Dribble     = clamp(dribbleBase + dribbleBonus, 1, 20);

  // d20 attributes — StealMarkingD20
  const [sLo, sHi]     = template.StealMarkingD20;
  const d20StealMark   = generateD20Attr(sLo, sHi, rng);

  return {
    attrs,
    d20Attrs: {
      Dribble:          d20Dribble,
      StealMarkingD20:  d20StealMark,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERALL RATING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weighted overall rating (1-99).
 * Mirrors the formula specified in the master plan:
 *   "Attack + Defense + Stamina + ThreePoint / 4, rounded"
 * but uses a fuller weighted model so the card display simple formula
 * (Attack+Defense+Stamina+ThreePoint)/4 is also separately available.
 */
function calculateOverall(attrs) {
  const weights = {
    Attack:         1.6,
    Defense:        1.6,
    ThreePoint:     1.0,
    FieldGoal:      0.9,
    Stamina:        0.9,
    DunkLayup:      0.7,
    Passing:        0.7,
    Blocking:       0.6,
    FieldGoalPaint: 0.5,
  };
  let weightSum   = 0;
  let weightedVal = 0;
  for (const [key, w] of Object.entries(weights)) {
    if (attrs[key] !== undefined) {
      weightedVal += attrs[key] * w;
      weightSum   += w;
    }
  }
  return Math.round(weightedVal / weightSum);
}

/**
 * Simple card-display overall: (Attack + Defense + Stamina + ThreePoint) / 4
 * as described in the spec for PlayerCard.jsx.
 */
function calculateCardOverall(attrs) {
  return Math.round((attrs.Attack + attrs.Defense + attrs.Stamina + attrs.ThreePoint) / 4);
}

/**
 * Map overall rating to legacy skillLevel (1-5) for Player class compatibility.
 * The matchEngine and TeamSetup both read skillLevel.
 */
function overallToSkillLevel(overall) {
  if (overall >= 82) return 5;
  if (overall >= 70) return 4;
  if (overall >= 55) return 3;
  if (overall >= 40) return 2;
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER OBJECT FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assemble the final player data object from individual components.
 *
 * The returned object is a plain object (not a class instance) that satisfies
 * every interface expected by the existing codebase:
 *
 * ✔ player.js Player class API  (all methods injected)
 * ✔ actionResolver.js property lookups  (legacy aliases as getters)
 * ✔ TeamSetup.jsx inline player shape   (stamina, maxStamina, addPoints, isActive …)
 * ✔ matchEngine.js                      (skillLevel, stats, foulCount, isActive, x, y)
 *
 * @param {object} config - All identity and attribute fields
 * @returns {object} Complete player object
 */
function buildPlayerObject(config) {
  const {
    id, name, nickname, nationality, hometown, age,
    position, archetype, height_cm, weight_kg, dominantHand,
    attrs, d20Attrs,
  } = config;

  const overall      = calculateOverall(attrs);
  const cardOverall  = calculateCardOverall(attrs);
  const skillLevel   = overallToSkillLevel(overall);

  // Reveal potential with ±10 % noise so young players feel like unknowns.
  // Actual ceiling is attrs.Potential; the revealedPotential is what scouts see.
  const potNoise        = Math.floor((Math.random() * 0.2 - 0.1) * attrs.Potential);
  const revealedPotential = clamp(attrs.Potential + potNoise, 1, 99);

  // ── Build the object ──────────────────────────────────────────────────────
  const player = {
    // Identity
    id,
    name,
    nickname:         nickname || null,
    nationality,
    hometown,
    age,
    position,
    archetype,
    height_cm,
    weight_kg,
    dominantHand,

    // Rich attributes (1-99 scale) — source of truth
    attributes: { ...attrs },

    // d20-scale attributes (1-20, lower = more skilled)
    d20: { ...d20Attrs },

    // Derived
    overall,
    cardOverall,
    revealedPotential,

    // ── Legacy Player class compatibility ──────────────────────────────────
    // All of these are read by matchEngine, Team, TeamSetup, and tests.
    skillLevel,
    foulCount:    0,
    isActive:     true,
    x:            0,
    y:            0,
    stamina:      100,   // Full stamina at game start (read by TeamSetup)
    maxStamina:   100,

    // Legacy stats object — exact shape used by Player class
    stats: {
      pointsScored: 0,
      assists:      0,
      rebounds:     0,
      steals:       0,
      blocks:       0,
      fouls:        0,
      freethrows:   0,
      shots2pt:     { made: 0, attempted: 0 },
      shots3pt:     { made: 0, attempted: 0 },
    },

    // ── ActionResolver legacy property aliases (getters) ──────────────────
    // actionResolver.js resolves: shooter.shooting, defender.defense, etc.
    // These getters delegate to the authoritative attributes object.
    get shooting()         { return this.attributes.FieldGoal; },
    get shooting3pt()      { return this.attributes.ThreePoint; },
    get defense()          { return this.attributes.Defense; },
    get blocking()         { return this.attributes.Blocking; },
    /** Rebounding — composite of Blocking (physical presence, 60%) and FieldGoalPaint (inside activity, 40%). */
    get rebounding()       { return Math.round(this.attributes.Blocking * 0.6 + this.attributes.FieldGoalPaint * 0.4); },
    get passing()          { return this.attributes.Passing; },
    get stealing()         { return this.attributes.StealMarking; },
    /**
     * Dribbling — converts the d20 value to a 1-99 skill scale so the
     * attack-vs-defense success formula in actionResolver can compare it
     * directly with other 1-99 attributes.
     */
    get dribbling()        { return d20ToSkill(this.d20.Dribble); },
    /**
     * Perimeter defense — averaged from Defense + StealMarking so it reads
     * slightly differently from raw Defense (used in 3pt-shot contest).
     */
    get perimeterDefense() {
      return Math.round((this.attributes.Defense + this.attributes.StealMarking) / 2);
    },
  };

  // ── Inject Player class methods directly ─────────────────────────────────
  // This keeps the object duck-type identical to `new Player()` without
  // needing a prototype chain cross-module-system boundary.

  player.getSkillLevelName = function () {
    if (this.skillLevel <= 2) return 'Ruim';
    if (this.skillLevel <= 4) return 'Médio';
    return 'Bom';
  };

  player.addPoints = function (points) {
    this.stats.pointsScored += points;
  };

  player.addAssist = function () {
    this.stats.assists++;
  };

  player.addRebound = function () {
    this.stats.rebounds++;
  };

  player.addSteal = function () {
    this.stats.steals++;
  };

  player.addBlock = function () {
    this.stats.blocks++;
  };

  player.addFoul = function () {
    this.foulCount++;
    this.stats.fouls++;
    if (this.foulCount >= 5) {
      this.isActive = false;
    }
  };

  player.attempt2Pointer = function (successful) {
    this.stats.shots2pt.attempted++;
    if (successful) {
      this.stats.shots2pt.made++;
      this.addPoints(2);
    }
  };

  player.attempt3Pointer = function (successful) {
    this.stats.shots3pt.attempted++;
    if (successful) {
      this.stats.shots3pt.made++;
      this.addPoints(3);
    }
  };

  player.attemptFreeThrow = function (successful) {
    this.stats.freethrows++;
    if (successful) {
      this.addPoints(1);
    }
  };

  player.get2PointPercentage = function () {
    if (this.stats.shots2pt.attempted === 0) return 0;
    return (this.stats.shots2pt.made / this.stats.shots2pt.attempted * 100).toFixed(1);
  };

  player.get3PointPercentage = function () {
    if (this.stats.shots3pt.attempted === 0) return 0;
    return (this.stats.shots3pt.made / this.stats.shots3pt.attempted * 100).toFixed(1);
  };

  /**
   * getSummary — extended version of Player.getSummary().
   * Includes all new identity fields so the rich data is accessible from
   * the same method that existing code already calls.
   */
  player.getSummary = function () {
    return {
      id:           this.id,
      name:         this.name,
      nickname:     this.nickname,
      position:     this.position,
      archetype:    this.archetype,
      age:          this.age,
      hometown:     this.hometown,
      nationality:  this.nationality,
      height_cm:    this.height_cm,
      weight_kg:    this.weight_kg,
      dominantHand: this.dominantHand,
      skillLevel:   this.getSkillLevelName(),
      skillValue:   this.skillLevel,
      overall:      this.overall,
      cardOverall:  this.cardOverall,
      potential:    this.revealedPotential,
      points:       this.stats.pointsScored,
      assists:      this.stats.assists,
      rebounds:     this.stats.rebounds,
      steals:       this.stats.steals,
      blocks:       this.stats.blocks,
      fouls:        this.stats.fouls,
      isActive:     this.isActive,
      foulCount:    this.foulCount,
    };
  };

  player.resetStats = function () {
    this.stats = {
      pointsScored: 0,
      assists:      0,
      rebounds:     0,
      steals:       0,
      blocks:       0,
      fouls:        0,
      freethrows:   0,
      shots2pt:     { made: 0, attempted: 0 },
      shots3pt:     { made: 0, attempted: 0 },
    };
    this.foulCount = 0;
    this.isActive  = true;
    this.stamina   = this.maxStamina;
  };

  return player;
}

// ─────────────────────────────────────────────────────────────────────────────
// NATIONALITY / NAME / LOCATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate nationality.
 * 70 % Brazilian, 30 % distributed across INTL_NATIONALITIES by INTL_NAT_WEIGHTS.
 */
function generateNationality(rng) {
  if (rng() < 0.70) return 'Brazilian';
  return weightedPick(INTL_NATIONALITIES, INTL_NAT_WEIGHTS, rng);
}

/** Generate a full name appropriate for the given nationality. */
function generateName(nationality, rng) {
  if (nationality === 'Brazilian') {
    const first = pick(BRAZILIAN_FIRST_NAMES, rng);
    const last  = pick(BRAZILIAN_LAST_NAMES, rng);
    return `${first} ${last}`;
  }
  const firstPool = INTL_FIRST_NAMES[nationality] || INTL_FIRST_NAMES.American;
  const lastPool  = INTL_LAST_NAMES[nationality]  || INTL_LAST_NAMES.American;
  return `${pick(firstPool, rng)} ${pick(lastPool, rng)}`;
}

/** Generate a hometown appropriate for the given nationality. */
function generateHometown(nationality, rng) {
  if (nationality === 'Brazilian') {
    return pick(BRAZILIAN_CITIES, rng);
  }
  const cityPool = INTL_CITIES[nationality] || INTL_CITIES.American;
  return pick(cityPool, rng);
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function validatePosition(position) {
  if (!VALID_POSITIONS.includes(position)) {
    throw new Error(
      `Invalid position "${position}". Must be one of: ${VALID_POSITIONS.join(', ')}.`
    );
  }
}

function validateArchetype(archetype) {
  if (!VALID_ARCHETYPES.includes(archetype)) {
    throw new Error(
      `Invalid archetype "${archetype}". Must be one of: ${VALID_ARCHETYPES.join(', ')}.`
    );
  }
}

function validateAge(age) {
  if (age !== undefined) {
    const n = Number(age);
    if (!Number.isInteger(n) || n < 18 || n > 38) {
      throw new Error(`Invalid age "${age}". Must be an integer between 18 and 38.`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createPlayerManual(options)
 *
 * Generate a player with user-provided identity fields. Attributes are
 * generated automatically from the archetype template with ±variance.
 *
 * @param {object} options
 * @param {string}  options.name        - Full name (required)
 * @param {string}  options.position    - 'PG' | 'SG' | 'SF' | 'PF' | 'C' (required)
 * @param {string}  options.archetype   - 'Scorer' | 'Defender' | 'Playmaker' | 'Rebounder' | 'Stretch' (required)
 * @param {number}  [options.age]       - 18–38; generated if omitted
 * @param {string}  [options.hometown]  - Free text; generated if omitted
 * @param {string}  [options.nationality] - Free text; 'Brazilian' default if omitted
 * @param {string}  [options.nickname]  - Optional nickname string
 * @param {number}  [options.seed]      - RNG seed for reproducibility
 * @returns {object} Player object
 */
export function createPlayerManual(options = {}) {
  const { name, position, archetype, age, hometown, nationality, nickname, seed } = options;

  // Required field validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('createPlayerManual: "name" is required and must be a non-empty string.');
  }
  if (!position) {
    throw new Error('createPlayerManual: "position" is required.');
  }
  if (!archetype) {
    throw new Error('createPlayerManual: "archetype" is required.');
  }

  validatePosition(position);
  validateArchetype(archetype);
  validateAge(age);

  const rng = makeRng(seed);
  const finalNationality = nationality || 'Brazilian';
  const finalAge         = age !== undefined ? Number(age) : generateAge(rng);
  const finalHometown    = hometown || generateHometown(finalNationality, rng);

  const physRange    = POSITION_PHYSICAL[position];
  const height_cm    = randInt(...physRange.heightRange, rng);
  const weight_kg    = randInt(...physRange.weightRange, rng);
  const dominantHand = pick(DOMINANT_HANDS, rng);

  const { attrs, d20Attrs } = buildAttributes(position, archetype, rng);

  return buildPlayerObject({
    id:           generateUUID(rng),
    name:         name.trim(),
    nickname:     nickname || null,
    nationality:  finalNationality,
    hometown:     finalHometown,
    age:          finalAge,
    position,
    archetype,
    height_cm,
    weight_kg,
    dominantHand,
    attrs,
    d20Attrs,
  });
}

/**
 * createPlayerAuto(options)
 *
 * Fully automatic player generation. Every identity field is generated from
 * RNG — name, nationality, age, hometown, physical profile, and attributes.
 *
 * Nationality distribution: 70 % Brazilian / 30 % international.
 * Age distribution: weighted toward prime career years (22-26).
 *
 * @param {object} [options]
 * @param {string}  [options.position]  - Force a specific position
 * @param {string}  [options.archetype] - Force a specific archetype
 * @param {number}  [options.seed]      - RNG seed for reproducibility
 * @returns {object} Player object
 */
export function createPlayerAuto(options = {}) {
  const { position, archetype, seed } = options;

  if (position)  validatePosition(position);
  if (archetype) validateArchetype(archetype);

  const rng = makeRng(seed);

  const finalPosition  = position  || pick(VALID_POSITIONS, rng);
  const finalArchetype = archetype || pick(VALID_ARCHETYPES, rng);
  const finalNat       = generateNationality(rng);
  const finalName      = generateName(finalNat, rng);
  const finalAge       = generateAge(rng);
  const finalHometown  = generateHometown(finalNat, rng);

  const physRange    = POSITION_PHYSICAL[finalPosition];
  const height_cm    = randInt(...physRange.heightRange, rng);
  const weight_kg    = randInt(...physRange.weightRange, rng);
  const dominantHand = pick(DOMINANT_HANDS, rng);

  const { attrs, d20Attrs } = buildAttributes(finalPosition, finalArchetype, rng);

  return buildPlayerObject({
    id:           generateUUID(rng),
    name:         finalName,
    nickname:     null,
    nationality:  finalNat,
    hometown:     finalHometown,
    age:          finalAge,
    position:     finalPosition,
    archetype:    finalArchetype,
    height_cm,
    weight_kg,
    dominantHand,
    attrs,
    d20Attrs,
  });
}

/**
 * generatePlayerPool(count, options)
 *
 * Generate a batch of players suitable for a draft pool.
 * Ensures a reasonable positional distribution across the pool so every
 * draft slot has a spread of PG/SG/SF/PF/C options available.
 *
 * @param {number} count - Number of players to generate (recommended: 5× team count)
 * @param {object} [options]
 * @param {string[]}  [options.positions]   - Restrict to these positions only
 * @param {string[]}  [options.archetypes]  - Restrict to these archetypes only
 * @param {number[]}  [options.ageRange]    - [minAge, maxAge] filter; players outside
 *                                           this range are regenerated
 * @param {number[]}  [options.qualityRange] - [minOverall, maxOverall] clamp; players
 *                                            outside are regenerated (max 3 retries)
 * @param {number}    [options.seed]        - Base seed; each player uses seed+i
 * @returns {object[]} Array of player objects
 */
export function generatePlayerPool(count = 30, options = {}) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('generatePlayerPool: "count" must be a positive integer.');
  }

  const {
    positions:    allowedPositions  = VALID_POSITIONS,
    archetypes:   allowedArchetypes = VALID_ARCHETYPES,
    ageRange:     [minAge, maxAge]  = [18, 38],
    qualityRange: [minQ, maxQ]      = [1, 99],
    seed,
  } = options;

  // Validate any supplied filters
  allowedPositions.forEach(validatePosition);
  allowedArchetypes.forEach(validateArchetype);

  const pool    = [];
  const posLen  = allowedPositions.length;

  // Balanced position distribution: cycle through positions sequentially,
  // randomly shuffling each full cycle so the ordering is not predictable.
  const positionQueue = [];
  while (positionQueue.length < count) {
    const shuffled = [...allowedPositions].sort(() => 0.5 - Math.random());
    positionQueue.push(...shuffled);
  }

  for (let i = 0; i < count; i++) {
    const playerSeed    = seed !== undefined ? (seed + i * 7919) : undefined;
    const forcedPos     = positionQueue[i % (posLen * Math.ceil(count / posLen))] || positionQueue[i];
    const forcedArch    = pick(allowedArchetypes, makeRng(playerSeed));

    let player;
    let attempts = 0;
    const MAX_RETRIES = 3;

    do {
      player = createPlayerAuto({
        position:  forcedPos,
        archetype: forcedArch,
        seed:      playerSeed !== undefined ? playerSeed + attempts : undefined,
      });
      attempts++;
      // Enforce ageRange filter
      const ageOk     = player.age >= minAge && player.age <= maxAge;
      // Enforce qualityRange filter (up to MAX_RETRIES; then accept anyway)
      const qualityOk = player.overall >= minQ && player.overall <= maxQ;
      if ((ageOk && qualityOk) || attempts >= MAX_RETRIES) break;
    } while (true);

    pool.push(player);
  }

  return pool;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAMED RE-EXPORTS (for consumers that want individual utilities)
// ─────────────────────────────────────────────────────────────────────────────

export {
  VALID_POSITIONS,
  VALID_ARCHETYPES,
  ARCHETYPE_TEMPLATES,
  POSITION_PHYSICAL,
  BRAZILIAN_FIRST_NAMES,
  BRAZILIAN_LAST_NAMES,
  BRAZILIAN_CITIES,
  calculateCardOverall,
  calculateOverall,
  overallToSkillLevel,
  d20ToSkill,
};
