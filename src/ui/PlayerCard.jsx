/**
 * PlayerCard.jsx
 * Quadra Legacy — Player Card UI Component
 *
 * Displays a player's profile in either full or compact mode.
 *
 * Props:
 *   player  {object}  — player object produced by playerCreator.js (required)
 *   compact {boolean} — compact mode: name + position + top 3 attrs + overall
 *                       full mode:    all identity fields, all attributes with bars
 *                       default: false
 *   onClick {function} — optional click handler (useful in draft/roster lists)
 *
 * Overall rating displayed (both modes):
 *   cardOverall = Math.round((Attack + Defense + Stamina + ThreePoint) / 4)
 *   Falls back to player.overall if cardOverall is absent (legacy objects).
 *
 * Design constraints:
 *   • Mobile-first — works at 375 px wide
 *   • Inline styles only — no external CSS class dependencies
 *   • Brazilian Portuguese attribute labels
 *   • No network calls, no Firebase, no side effects
 */

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & LOOKUP TABLES
// ─────────────────────────────────────────────────────────────────────────────

/** Brazilian Portuguese attribute labels. */
const ATTR_LABELS_PT = {
  Attack:            'Ataque',
  FieldGoal:         'Arremesso',
  FieldGoalPaint:    'Arremesso no Garrafão',
  FieldGoalMidRange: 'Arremesso do Médio',
  ThreePoint:        'Três Pontos',
  DunkLayup:         'Enterrada / Bandeja',
  FreeThrow:         'Lance Livre',
  Passing:           'Passe',
  Defense:           'Defesa',
  StealMarking:      'Marcação / Roubo',
  Blocking:          'Bloqueio',
  Stamina:           'Stamina',
  Chemistry:         'Química',
  Morale:            'Moral',
  Potential:         'Potencial',
};

/** Short labels for compact mode (≤10 chars). */
const ATTR_LABELS_SHORT_PT = {
  Attack:            'Ataque',
  FieldGoal:         'Arremesso',
  FieldGoalPaint:    'Garrafão',
  FieldGoalMidRange: 'Médio Ranço',
  ThreePoint:        '3 Pontos',
  DunkLayup:         'Entrd/Band',
  FreeThrow:         'Lc Livre',
  Passing:           'Passe',
  Defense:           'Defesa',
  StealMarking:      'Marcação',
  Blocking:          'Bloqueio',
  Stamina:           'Stamina',
  Chemistry:         'Química',
  Morale:            'Moral',
  Potential:         'Potencial',
};

/** Key attributes shown in full mode, in display order. */
const FULL_MODE_ATTR_ORDER = [
  'Attack',
  'FieldGoal',
  'FieldGoalPaint',
  'FieldGoalMidRange',
  'ThreePoint',
  'DunkLayup',
  'FreeThrow',
  'Passing',
  'Defense',
  'StealMarking',
  'Blocking',
  'Stamina',
  'Chemistry',
  'Morale',
  'Potential',
];

/** Archetype labels in PT. */
const ARCHETYPE_PT = {
  Scorer:    'Artilheiro',
  Defender:  'Defensor',
  Playmaker: 'Armador',
  Rebounder: 'Reboteiro',
  Stretch:   'Espaçador',
};

/** Position labels. */
const POSITION_PT = {
  PG: 'Armador',
  SG: 'Ala-Armador',
  SF: 'Ala',
  PF: 'Ala-Pivô',
  C:  'Pivô',
};

/** Overall grade label based on rating. */
function overallGrade(overall) {
  if (overall >= 88) return { label: 'Elite', color: '#FFD700' };
  if (overall >= 78) return { label: 'Ótimo', color: '#00CFFF' };
  if (overall >= 68) return { label: 'Bom',   color: '#44DD88' };
  if (overall >= 55) return { label: 'Médio', color: '#FFAA33' };
  return                    { label: 'Fraco', color: '#FF5555' };
}

/** Color for attribute bar fill, based on value 1-99. */
function attrBarColor(value) {
  if (value >= 80) return '#44DD88';  // green
  if (value >= 65) return '#00CFFF';  // blue
  if (value >= 50) return '#FFAA33';  // amber
  return '#FF6655';                   // red
}

/** Hand label in PT. */
function handLabel(hand) {
  if (hand === 'Left')  return 'Canhoto';
  if (hand === 'Right') return 'Destro';
  return hand || '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  bg:          '#1A1A2E',
  surface:     '#16213E',
  surfaceAlt:  '#0F3460',
  accent:      '#FF6B35',
  accentDark:  '#C94A1A',
  text:        '#E0E0E0',
  textMuted:   '#8899AA',
  border:      '#2A3A5A',
  cardBg:      '#0D1B2A',
};

const BASE_STYLES = {
  card: {
    background:      COLORS.surface,
    border:          `1px solid ${COLORS.border}`,
    borderRadius:    12,
    overflow:        'hidden',
    fontFamily:      "'Segoe UI', system-ui, sans-serif",
    color:           COLORS.text,
    maxWidth:        375,
    width:           '100%',
    boxSizing:       'border-box',
    cursor:          'pointer',
  },
  header: {
    background:      COLORS.surfaceAlt,
    padding:         '12px 14px 10px',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    gap:             8,
  },
  name: {
    fontSize:        16,
    fontWeight:      700,
    color:           '#FFFFFF',
    lineHeight:      1.2,
    margin:          0,
  },
  nickname: {
    fontSize:        12,
    color:           COLORS.accent,
    fontStyle:       'italic',
    marginTop:       2,
  },
  badge: {
    padding:         '3px 8px',
    borderRadius:    20,
    fontSize:        11,
    fontWeight:      700,
    letterSpacing:   0.5,
    whiteSpace:      'nowrap',
  },
  overallCircle: {
    width:           52,
    height:          52,
    borderRadius:    '50%',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    border:          '2px solid rgba(255,255,255,0.15)',
  },
  overallNumber: {
    fontSize:        18,
    fontWeight:      800,
    lineHeight:      1,
    color:           '#FFFFFF',
  },
  overallLabel: {
    fontSize:        9,
    color:           'rgba(255,255,255,0.7)',
    textTransform:   'uppercase',
    letterSpacing:   0.5,
    marginTop:       1,
  },
  body: {
    padding:         '10px 14px 14px',
  },
  metaRow: {
    display:         'flex',
    flexWrap:        'wrap',
    gap:             6,
    marginBottom:    10,
  },
  metaChip: {
    background:      COLORS.cardBg,
    border:          `1px solid ${COLORS.border}`,
    borderRadius:    6,
    padding:         '3px 8px',
    fontSize:        11,
    color:           COLORS.textMuted,
    display:         'flex',
    alignItems:      'center',
    gap:             4,
  },
  metaChipValue: {
    color:           COLORS.text,
    fontWeight:      600,
  },
  sectionLabel: {
    fontSize:        10,
    fontWeight:      700,
    color:           COLORS.textMuted,
    textTransform:   'uppercase',
    letterSpacing:   1,
    marginBottom:    6,
    marginTop:       10,
  },
  attrRow: {
    display:         'flex',
    alignItems:      'center',
    gap:             8,
    marginBottom:    5,
  },
  attrLabel: {
    fontSize:        11,
    color:           COLORS.textMuted,
    width:           140,
    flexShrink:      0,
    whiteSpace:      'nowrap',
    overflow:        'hidden',
    textOverflow:    'ellipsis',
  },
  attrBarTrack: {
    flex:            1,
    height:          7,
    background:      COLORS.cardBg,
    borderRadius:    4,
    overflow:        'hidden',
  },
  attrValue: {
    fontSize:        11,
    fontWeight:      700,
    color:           COLORS.text,
    width:           26,
    textAlign:       'right',
    flexShrink:      0,
  },
  divider: {
    border:          'none',
    borderTop:       `1px solid ${COLORS.border}`,
    margin:          '8px 0',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (plain functions, no hooks needed)
// ─────────────────────────────────────────────────────────────────────────────

/** Single attribute row with label, progress bar, and numeric value. */
function AttrRow({ attrKey, value, short }) {
  const label     = short
    ? (ATTR_LABELS_SHORT_PT[attrKey] || attrKey)
    : (ATTR_LABELS_PT[attrKey] || attrKey);
  const fillColor = attrBarColor(value);
  const fillPct   = `${clampValue(value)}%`;

  return (
    <div style={BASE_STYLES.attrRow}>
      <span style={BASE_STYLES.attrLabel} title={ATTR_LABELS_PT[attrKey]}>
        {label}
      </span>
      <div style={BASE_STYLES.attrBarTrack}>
        <div
          style={{
            height:       '100%',
            width:        fillPct,
            background:   fillColor,
            borderRadius: 4,
            transition:   'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ ...BASE_STYLES.attrValue, color: fillColor }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

/** Overall rating circle. */
function OverallCircle({ overall, grade }) {
  return (
    <div style={{ ...BASE_STYLES.overallCircle, background: grade.color + '22', borderColor: grade.color + '88' }}>
      <span style={BASE_STYLES.overallNumber}>{overall}</span>
      <span style={BASE_STYLES.overallLabel}>{grade.label}</span>
    </div>
  );
}

/** Small pill badge. */
function Badge({ label, color = COLORS.accent }) {
  return (
    <span
      style={{
        ...BASE_STYLES.badge,
        background: color + '22',
        color:      color,
        border:     `1px solid ${color}55`,
      }}
    >
      {label}
    </span>
  );
}

/** Key/value chip for meta information. */
function MetaChip({ label, value }) {
  return (
    <span style={BASE_STYLES.metaChip}>
      {label}:&nbsp;<span style={BASE_STYLES.metaChipValue}>{value}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function clampValue(v) {
  return Math.max(0, Math.min(100, v || 0));
}

/**
 * Get the top N attributes by value from a player's attributes object.
 * Excludes Potential and Morale from the "performance" top-3.
 */
function getTopAttributes(attributes, n = 3) {
  if (!attributes) return [];
  const exclude = new Set(['Potential', 'Morale', 'Chemistry']);
  return Object.entries(attributes)
    .filter(([key])         => !exclude.has(key))
    .sort(([, a], [, b])    => b - a)
    .slice(0, n)
    .map(([key, value])     => ({ key, value }));
}

/**
 * Safely read a player's overall rating.
 * Prefers cardOverall (spec formula) over the weighted-model overall field.
 * Falls back gracefully for objects created outside playerCreator.
 */
function getDisplayOverall(player) {
  if (player.cardOverall !== undefined) return player.cardOverall;
  if (player.overall     !== undefined) return player.overall;
  // Legacy player: derive from attributes if present
  if (player.attributes) {
    const a = player.attributes;
    return Math.round(((a.Attack || 50) + (a.Defense || 50) + (a.Stamina || 50) + (a.ThreePoint || 50)) / 4);
  }
  // Absolute fallback for old Player class objects
  return player.skillLevel ? player.skillLevel * 20 : 50;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPACT MODE
// ─────────────────────────────────────────────────────────────────────────────

function CompactCard({ player, onClick }) {
  const displayOverall = getDisplayOverall(player);
  const grade          = overallGrade(displayOverall);
  const topAttrs       = getTopAttributes(player.attributes, 3);
  const posLabel       = player.position || '—';
  const archLabel      = player.archetype ? (ARCHETYPE_PT[player.archetype] || player.archetype) : null;

  return (
    <div
      style={{ ...BASE_STYLES.card, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
      aria-label={`Jogador ${player.name}, posição ${posLabel}, avaliação ${displayOverall}`}
    >
      {/* Header */}
      <div style={BASE_STYLES.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={BASE_STYLES.name}>{player.name || 'Jogador'}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <Badge label={posLabel}                              color={COLORS.accent} />
            {archLabel && <Badge label={archLabel}              color='#7B68EE' />}
          </div>
        </div>
        <OverallCircle overall={displayOverall} grade={grade} />
      </div>

      {/* Top 3 attributes */}
      {topAttrs.length > 0 && (
        <div style={{ padding: '8px 14px 12px' }}>
          <p style={BASE_STYLES.sectionLabel}>Atributos em Destaque</p>
          {topAttrs.map(({ key, value }) => (
            <AttrRow key={key} attrKey={key} value={value} short />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL MODE
// ─────────────────────────────────────────────────────────────────────────────

function FullCard({ player, onClick }) {
  const displayOverall = getDisplayOverall(player);
  const grade          = overallGrade(displayOverall);
  const posLabel       = player.position || '—';
  const posName        = POSITION_PT[player.position] || player.position || '—';
  const archLabel      = player.archetype ? (ARCHETYPE_PT[player.archetype] || player.archetype) : null;
  const attrs          = player.attributes || {};

  // Split attributes into groups for cleaner visual hierarchy
  const OFFENSE_ATTRS  = ['Attack', 'FieldGoal', 'FieldGoalPaint', 'FieldGoalMidRange', 'ThreePoint', 'DunkLayup', 'FreeThrow', 'Passing'];
  const DEFENSE_ATTRS  = ['Defense', 'StealMarking', 'Blocking'];
  const PHYSICAL_ATTRS = ['Stamina'];
  const MENTAL_ATTRS   = ['Chemistry', 'Morale', 'Potential'];

  const renderAttrGroup = (keys, filterFn = () => true) =>
    keys.filter(k => attrs[k] !== undefined && filterFn(k)).map(key => (
      <AttrRow key={key} attrKey={key} value={attrs[key]} />
    ));

  return (
    <div
      style={{ ...BASE_STYLES.card, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
      aria-label={`Ficha completa de ${player.name}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={BASE_STYLES.header}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={BASE_STYLES.name}>{player.name || 'Jogador'}</p>
          {player.nickname && (
            <p style={BASE_STYLES.nickname}>"{player.nickname}"</p>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <Badge label={posLabel}                              color={COLORS.accent} />
            <Badge label={posName}                               color='#4AB8C1' />
            {archLabel && <Badge label={archLabel}              color='#7B68EE' />}
          </div>
        </div>
        <OverallCircle overall={displayOverall} grade={grade} />
      </div>

      {/* ── Identity chips ─────────────────────────────────────────────── */}
      <div style={{ ...BASE_STYLES.body, paddingBottom: 6 }}>
        <div style={BASE_STYLES.metaRow}>
          {player.age          && <MetaChip label="Idade"        value={`${player.age} anos`} />}
          {player.nationality  && <MetaChip label="Nacion."      value={player.nationality} />}
          {player.hometown     && <MetaChip label="Cidade"        value={player.hometown} />}
          {player.height_cm    && <MetaChip label="Altura"        value={`${player.height_cm} cm`} />}
          {player.weight_kg    && <MetaChip label="Peso"          value={`${player.weight_kg} kg`} />}
          {player.dominantHand && <MetaChip label="Mão"           value={handLabel(player.dominantHand)} />}
        </div>

        {/* Potential (revealed) */}
        {player.revealedPotential !== undefined && (
          <div
            style={{
              background:    COLORS.cardBg,
              border:        `1px solid ${COLORS.border}`,
              borderRadius:  8,
              padding:       '6px 10px',
              display:       'flex',
              justifyContent:'space-between',
              alignItems:    'center',
              marginBottom:  8,
            }}
          >
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>
              Potencial Máximo (estimado)
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: player.revealedPotential >= 80 ? '#FFD700'
                      : player.revealedPotential >= 65 ? '#00CFFF'
                      : COLORS.textMuted,
              }}
            >
              {player.revealedPotential}
            </span>
          </div>
        )}

        <hr style={BASE_STYLES.divider} />

        {/* ── OFFENSE ────────────────────────────────────────────────── */}
        <p style={BASE_STYLES.sectionLabel}>Ataque</p>
        {renderAttrGroup(OFFENSE_ATTRS)}

        <hr style={BASE_STYLES.divider} />

        {/* ── DEFENSE ────────────────────────────────────────────────── */}
        <p style={BASE_STYLES.sectionLabel}>Defesa</p>
        {renderAttrGroup(DEFENSE_ATTRS)}

        <hr style={BASE_STYLES.divider} />

        {/* ── PHYSICAL + MENTAL ──────────────────────────────────────── */}
        <p style={BASE_STYLES.sectionLabel}>Físico & Mental</p>
        {renderAttrGroup(PHYSICAL_ATTRS)}
        {renderAttrGroup(MENTAL_ATTRS)}

        {/* ── d20 Special Attributes ─────────────────────────────────── */}
        {player.d20 && (
          <>
            <hr style={BASE_STYLES.divider} />
            <p style={BASE_STYLES.sectionLabel}>Habilidades Especiais (d20)</p>
            <div
              style={{
                display:    'grid',
                gridTemplateColumns: '1fr 1fr',
                gap:        8,
              }}
            >
              <D20Chip
                label="Drible"
                value={player.d20.Dribble}
                hint="Menor = melhor"
              />
              <D20Chip
                label="Pressão Def."
                value={player.d20.StealMarkingD20}
                hint="Menor = melhor"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Small display for d20 attributes. */
function D20Chip({ label, value, hint }) {
  // Invert colour logic: lower d20 = better = greener
  const fillColor = value <= 5  ? '#44DD88'  // elite
                  : value <= 10 ? '#00CFFF'  // good
                  : value <= 15 ? '#FFAA33'  // average
                  : '#FF6655';              // weak

  return (
    <div
      style={{
        background:   COLORS.cardBg,
        border:       `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding:      '6px 10px',
        textAlign:    'center',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, color: fillColor }}>{value}</div>
      <div style={{ fontSize: 10, color: COLORS.text, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 9,  color: COLORS.textMuted }}>{hint}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PlayerCard — displays a player in full or compact mode.
 *
 * @param {object}   props
 * @param {object}   props.player   — Player object from playerCreator.js
 * @param {boolean}  [props.compact=false] — Show compact version
 * @param {function} [props.onClick] — Optional click handler
 */
function PlayerCard({ player, compact = false, onClick }) {
  if (!player) {
    return (
      <div
        style={{
          ...BASE_STYLES.card,
          padding: 20,
          textAlign: 'center',
          color: COLORS.textMuted,
          fontSize: 13,
        }}
      >
        Nenhum jogador selecionado.
      </div>
    );
  }

  return compact
    ? <CompactCard player={player} onClick={onClick} />
    : <FullCard    player={player} onClick={onClick} />;
}

export default PlayerCard;
