/**
 * NarrationLog
 * Standalone scrollable play-by-play narration component — extracted from
 * MatchView.jsx.
 *
 * Props:
 *   events      {Array}   - Array of narration entries. Each entry can be:
 *                           • A plain string  (text only)
 *                           • An object { text, type, quarter?, round? }
 *                             where type is one of: 'score' | 'miss' | 'steal'
 *                             | 'fastbreak' | 'default'
 *   maxVisible  {number}  - Maximum number of entries to render at once.
 *                           Defaults to 8. The NEWEST entries are shown.
 *   language    {string}  - 'pt' | 'en'. Controls the section heading text.
 *   title       {string?} - Override the section heading entirely.
 *
 * Behaviour:
 *   • Auto-scrolls to the newest entry whenever `events` changes.
 *   • Each new entry plays a fade-in + slide-up animation (@keyframes fadeIn
 *     is defined in main.css and reused here; no extra keyframe needed).
 *   • The container is touch-scrollable (-webkit-overflow-scrolling: touch)
 *     for smooth momentum on iOS.
 *   • Caps the rendered list at `maxVisible` items to keep the DOM light for
 *     long matches (100 rounds × many narrations).
 *   • Accepts both the GameController event format { text, type, ... } and
 *     plain strings for backward-compatibility with any existing callers.
 *
 * Styling:
 *   Reuses existing CSS classes from src/styles/main.css:
 *     .narration-feed    — container
 *     .narration-item    — each entry (default primary orange left border)
 *     .narration-item.score      — green border, tinted bg
 *     .narration-item.miss       — red border
 *     .narration-item.steal      — orange border, tinted bg
 *     .narration-item.fastbreak  — purple border, tinted bg
 */

import React, { useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Heading translations
// ---------------------------------------------------------------------------
const HEADINGS = {
  pt: 'Narração ao Vivo',
  en: 'Live Play-by-Play',
};

// ---------------------------------------------------------------------------
// Normalise an entry to { text, type, quarter, round }
// Handles both plain strings and GameController-style objects.
// ---------------------------------------------------------------------------
function normaliseEntry(entry) {
  if (typeof entry === 'string') {
    return { text: entry, type: 'default', quarter: null, round: null };
  }
  if (entry && typeof entry === 'object') {
    return {
      text: entry.text || String(entry),
      type: entry.type || 'default',
      quarter: entry.quarter || null,
      round: entry.round || null,
    };
  }
  return { text: String(entry), type: 'default', quarter: null, round: null };
}

// ---------------------------------------------------------------------------
// Quarter badge shown on the first entry of each quarter transition
// ---------------------------------------------------------------------------
function QuarterBadge({ quarter, language }) {
  if (!quarter) return null;
  const label = language === 'en' ? `Q${quarter}` : `${quarter}º Período`;
  return (
    <div style={styles.quarterBadge} aria-label={label}>
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single narration entry row
// ---------------------------------------------------------------------------
function NarrationItem({ entry, showQuarterBadge, language, isNewest }) {
  const { text, type, quarter } = entry;
  // CSS class mirrors main.css .narration-item with optional type modifier
  const className = `narration-item${type && type !== 'default' ? ` ${type}` : ''}`;

  return (
    <>
      {showQuarterBadge && (
        <QuarterBadge quarter={quarter} language={language} />
      )}
      <div
        className={className}
        style={isNewest ? styles.newestItem : undefined}
        role="listitem"
      >
        {text}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state placeholder
// ---------------------------------------------------------------------------
function EmptyState({ language }) {
  return (
    <div style={styles.emptyState}>
      {language === 'pt'
        ? 'Aguardando o início da partida…'
        : 'Waiting for the match to begin…'}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main NarrationLog component
// ---------------------------------------------------------------------------
function NarrationLog({
  events = [],
  maxVisible = 8,
  language = 'pt',
  title = null,
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  // Normalise all entries
  const normalised = events.map(normaliseEntry);

  // Slice to the last `maxVisible` entries
  const visible = normalised.slice(-maxVisible);

  // Scroll to bottom whenever events array changes (new entries appended)
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [events.length]);

  const heading = title || HEADINGS[language] || HEADINGS.pt;

  return (
    <div
      className="narration-feed"
      ref={containerRef}
      style={styles.container}
      role="list"
      aria-label={heading}
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions"
    >
      {/* Section heading */}
      <h3 style={styles.heading}>{heading}</h3>

      {/* Entries */}
      {visible.length === 0 ? (
        <EmptyState language={language} />
      ) : (
        <div style={styles.entriesWrapper}>
          {visible.map((entry, idx) => {
            const globalIdx = normalised.length - visible.length + idx;
            const isNewest = idx === visible.length - 1;

            // Show a quarter divider badge when the quarter changes
            const prevEntry = idx > 0 ? visible[idx - 1] : null;
            const showQuarterBadge =
              entry.quarter !== null &&
              idx === 0 &&
              entry.quarter > 1;
            const quarterChanged =
              prevEntry &&
              entry.quarter !== null &&
              prevEntry.quarter !== null &&
              entry.quarter !== prevEntry.quarter;

            return (
              <NarrationItem
                key={`${globalIdx}-${entry.text.slice(0, 20)}`}
                entry={entry}
                showQuarterBadge={showQuarterBadge || quarterChanged}
                language={language}
                isNewest={isNewest}
              />
            );
          })}

          {/* Invisible sentinel used for scroll-into-view */}
          <div ref={bottomRef} style={styles.scrollSentinel} aria-hidden />
        </div>
      )}

      {/* Total entry count badge */}
      {events.length > maxVisible && (
        <div style={styles.overflowNote}>
          {language === 'pt'
            ? `+ ${events.length - maxVisible} jogadas anteriores`
            : `+ ${events.length - maxVisible} earlier plays`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles
// These extend / override .narration-feed rules from main.css while remaining
// mobile-first and compatible with 375 px viewport widths.
// ---------------------------------------------------------------------------
const styles = {
  container: {
    // Overrides .narration-feed — keep property values in sync with main.css
    // so the component looks identical whether mounted inside MatchView or
    // as a standalone element.
    maxHeight: '340px',      // slightly shorter than main.css 400 px on mobile
    overflowY: 'auto',
    // Smooth momentum scrolling on iOS Safari
    WebkitOverflowScrolling: 'touch',
    // Scrollbar styling for Webkit (matches main.css ::-webkit-scrollbar)
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--primary, #ff6b35) rgba(0,0,0,0.2)',
    padding: '15px',
  },

  heading: {
    // Matches .narration-feed h3
    color: 'var(--secondary, #4ec9b0)',
    marginBottom: '12px',
    borderBottom: '1px solid var(--bg-input, #0f3460)',
    paddingBottom: '8px',
    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
    fontWeight: '600',
    letterSpacing: '0.4px',
  },

  entriesWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },

  newestItem: {
    // Subtle glow on the latest entry to draw the user's eye
    boxShadow: '0 0 8px rgba(255, 107, 53, 0.25)',
  },

  emptyState: {
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.9rem',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px 0',
  },

  quarterBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(78, 201, 176, 0.15)',
    color: 'var(--secondary, #4ec9b0)',
    border: '1px solid var(--secondary, #4ec9b0)',
    borderRadius: '12px',
    fontSize: '0.72rem',
    fontWeight: '700',
    padding: '3px 10px',
    marginTop: '10px',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
  },

  overflowNote: {
    marginTop: '10px',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted, #8b9dc3)',
    fontStyle: 'italic',
    paddingTop: '8px',
    borderTop: '1px solid var(--bg-input, #0f3460)',
  },

  scrollSentinel: {
    height: '1px',
    flexShrink: 0,
  },
};

export default NarrationLog;
