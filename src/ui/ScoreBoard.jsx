/**
 * ScoreBoard
 * Standalone scoreboard component — extracted from MatchView.jsx.
 *
 * Props:
 *   homeTeamName   {string}  - Name of the home team
 *   awayTeamName   {string}  - Name of the away team
 *   homeScore      {number}  - Current home score
 *   awayScore      {number}  - Current away score
 *   quarter        {number}  - Current quarter (1–4)
 *   timeRemaining  {number}  - Seconds remaining in the current quarter (0–720)
 *   possession     {string?} - 'home' | 'away' | null
 *   language       {string}  - 'pt' | 'en'. Defaults to 'pt'.
 *
 * Styling:
 *   Uses CSS classes defined in src/styles/main.css (.scoreboard,
 *   .scoreboard-teams, .scoreboard-team, .game-clock, .clock-time,
 *   .clock-quarter, .possession-indicator, .quarter-indicator).
 *   Additional mobile-first rules are scoped via inline styles so the
 *   component is self-contained and portable to future React Native screens.
 *
 * Design:
 *   Mobile-first — legible at 375 px with a single thumb. Score numerals are
 *   large enough to read at a glance. Quarter indicator uses dot notation on
 *   narrow screens.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Quarter-dot indicator
// Shows Q1–Q4 as filled/empty circles. Compact on mobile.
// ---------------------------------------------------------------------------
function QuarterDots({ currentQuarter }) {
  return (
    <div style={styles.quarterDots} aria-label={`Período ${currentQuarter} de 4`}>
      {[1, 2, 3, 4].map(q => (
        <span
          key={q}
          style={{
            ...styles.quarterDot,
            ...(q < currentQuarter
              ? styles.quarterDotDone
              : q === currentQuarter
              ? styles.quarterDotActive
              : styles.quarterDotInactive),
          }}
          title={`Q${q}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Possession arrow indicator
// ---------------------------------------------------------------------------
function PossessionArrow({ possession, side }) {
  const showing =
    (side === 'home' && possession === 'home') ||
    (side === 'away' && possession === 'away');

  return (
    <span
      style={{
        ...styles.possessionArrow,
        opacity: showing ? 1 : 0,
        transform: side === 'home' ? 'scaleX(1)' : 'scaleX(-1)',
      }}
      aria-hidden={!showing}
    >
      ►
    </span>
  );
}

// ---------------------------------------------------------------------------
// Time formatter (seconds → MM:SS)
// ---------------------------------------------------------------------------
function formatTime(seconds) {
  const s = typeof seconds === 'number' ? Math.max(0, Math.round(seconds)) : 0;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Quarter label
// ---------------------------------------------------------------------------
function quarterLabel(quarter, language) {
  if (language === 'en') {
    return `Q${quarter}`;
  }
  return `${quarter}º Q`;
}

// ---------------------------------------------------------------------------
// Main ScoreBoard component
// ---------------------------------------------------------------------------
function ScoreBoard({
  homeTeamName = 'Casa',
  awayTeamName = 'Visitante',
  homeScore = 0,
  awayScore = 0,
  quarter = 1,
  timeRemaining = 720,
  possession = null,
  language = 'pt',
}) {
  const diff = Math.abs(homeScore - awayScore);
  const isCloseGame = diff <= 5;

  return (
    <div className="scoreboard" style={styles.root}>
      {/* ---- Game clock row ---- */}
      <div className="game-clock" style={styles.clockRow}>
        <span className="clock-quarter" style={styles.clockQuarter}>
          {quarterLabel(quarter, language)}
        </span>

        <span className="clock-time" style={styles.clockTime}>
          {formatTime(timeRemaining)}
        </span>

        <QuarterDots currentQuarter={quarter} />
      </div>

      {/* ---- Teams + Scores ---- */}
      <div className="scoreboard-teams" style={styles.teamsRow}>
        {/* Home */}
        <div className="scoreboard-team home" style={styles.teamBlock}>
          <PossessionArrow possession={possession} side="home" />
          <div className="name" style={styles.teamName}>
            {homeTeamName}
          </div>
          <div
            className="score"
            style={{
              ...styles.scoreNumber,
              color: 'var(--primary, #ff6b35)',
              textShadow: possession === 'home' ? '0 0 20px rgba(255,107,53,0.6)' : 'none',
            }}
          >
            {homeScore}
          </div>
        </div>

        {/* VS separator */}
        <div style={styles.vsBlock}>
          <span className="scoreboard-vs" style={styles.vs}>
            ×
          </span>
          {isCloseGame && (
            <span style={styles.closeGameTag}>
              {language === 'pt' ? '⚡ QUENTE!' : '⚡ HOT!'}
            </span>
          )}
        </div>

        {/* Away */}
        <div className="scoreboard-team away" style={styles.teamBlock}>
          <div
            className="score"
            style={{
              ...styles.scoreNumber,
              color: 'var(--secondary, #4ec9b0)',
              textShadow: possession === 'away' ? '0 0 20px rgba(78,201,176,0.6)' : 'none',
            }}
          >
            {awayScore}
          </div>
          <div className="name" style={styles.teamName}>
            {awayTeamName}
          </div>
          <PossessionArrow possession={possession} side="away" />
        </div>
      </div>

      {/* ---- Quarter progress bar ---- */}
      <div className="quarter-indicator" style={styles.progressBarWrap}>
        <div style={styles.progressBarTrack}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${Math.min(100, ((720 - timeRemaining) / 720) * 100)}%`,
            }}
          />
        </div>
        <span style={styles.progressLabel}>
          {language === 'pt'
            ? `${quarter}º Período`
            : `Quarter ${quarter}`}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles
// All numeric sizes are set in rem/% intentionally — scales on any device.
// The CSS variables (--primary, --secondary, etc.) are provided by main.css.
// ---------------------------------------------------------------------------
const styles = {
  root: {
    // Overrides are additive on top of .scoreboard from main.css
    padding: '15px 12px',
  },

  clockRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    flexWrap: 'wrap',
  },

  clockTime: {
    // Overrides .clock-time
    fontSize: 'clamp(1.6rem, 5vw, 2.5rem)',
    fontWeight: 'bold',
    color: '#ff4444',
    fontFamily: "'Courier New', monospace",
    letterSpacing: '2px',
  },

  clockQuarter: {
    // Overrides .clock-quarter
    fontSize: 'clamp(0.95rem, 3vw, 1.4rem)',
    fontWeight: 'bold',
    color: 'var(--primary, #ff6b35)',
    backgroundColor: 'rgba(255,107,53,0.2)',
    padding: '4px 12px',
    borderRadius: '5px',
    minWidth: '54px',
    textAlign: 'center',
  },

  teamsRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
    // Prevent overflow on very narrow screens
    flexWrap: 'nowrap',
  },

  teamBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: '1',
    minWidth: 0, // allow text truncation
    maxWidth: '160px',
    gap: '4px',
  },

  teamName: {
    fontSize: 'clamp(0.75rem, 3vw, 1.1rem)',
    color: 'var(--text-muted, #8b9dc3)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%',
  },

  scoreNumber: {
    // Overrides .scoreboard-team .score
    fontSize: 'clamp(2.2rem, 9vw, 3.5rem)',
    fontWeight: 'bold',
    lineHeight: 1,
    transition: 'color 0.2s ease, text-shadow 0.3s ease',
  },

  vsBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
    width: '40px',
  },

  vs: {
    fontSize: '1.3rem',
    color: 'var(--text-muted, #8b9dc3)',
  },

  closeGameTag: {
    fontSize: '0.65rem',
    color: '#ff9800',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },

  possessionArrow: {
    fontSize: '1.1rem',
    color: 'var(--primary, #ff6b35)',
    transition: 'opacity 0.3s ease',
    alignSelf: 'center',
  },

  progressBarWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '6px',
  },

  progressBarTrack: {
    flex: 1,
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },

  progressBarFill: {
    height: '100%',
    backgroundColor: 'var(--primary, #ff6b35)',
    borderRadius: '2px',
    transition: 'width 0.4s linear',
  },

  progressLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #8b9dc3)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  quarterDots: {
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
  },

  quarterDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'background-color 0.3s ease',
  },

  quarterDotDone: {
    backgroundColor: 'var(--text-muted, #8b9dc3)',
  },

  quarterDotActive: {
    backgroundColor: 'var(--primary, #ff6b35)',
    boxShadow: '0 0 4px rgba(255,107,53,0.7)',
  },

  quarterDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
};

export default ScoreBoard;
