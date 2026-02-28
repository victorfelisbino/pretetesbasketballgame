/**
 * Fantasy Dashboard Component — Quadra Legacy
 *
 * Shows fantasy scores, weekly matchups, and player performance.
 * Three tabs: Fantasy Standings, Last Match breakdown, Scoring Rules.
 *
 * Imports scoring logic from core/fantasyScoring.js (pure module, no UI deps).
 */

import { useState, useMemo } from 'react';
import {
  DEFAULT_SCORING_CONFIG,
  SCORING_PRESETS,
  calculatePlayerFantasyPoints,
  normalizePlayerStatsFromEngine,
} from '../core/fantasyScoring.js';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const translations = {
  pt: {
    back: 'Voltar',
    title: 'Fantasy Dashboard',
    tabs: {
      standings: 'Classificacao Fantasy',
      lastMatch: 'Ultima Partida',
      scoringRules: 'Regras de Pontuacao',
    },
    // Standings tab
    rank: '#',
    team: 'Time',
    totalFpts: 'FPts Total',
    avgFpts: 'FPts/Jogo',
    noStandings: 'Nenhum dado de classificacao disponivel.',
    // Last Match tab
    player: 'Jogador',
    position: 'Pos',
    pts: 'PTS',
    reb: 'REB',
    ast: 'AST',
    stl: 'STL',
    blk: 'BLK',
    fpts: 'FPts',
    noMatchData: 'Nenhum dado de partida disponivel.',
    homeTeam: 'Time da Casa',
    awayTeam: 'Time Visitante',
    // Scoring Rules tab
    statCategory: 'Categoria',
    pointsPer: 'Pontos Por',
    activePreset: 'Preset Ativo',
    presetNames: {
      standard: 'Padrao',
      volume: 'Volume',
      allAround: 'Completo',
      defenseFirst: 'Defesa Primeiro',
      custom: 'Personalizado',
    },
    categoryLabels: {
      points: 'Pontos',
      rebounds: 'Rebotes',
      assists: 'Assistencias',
      steals: 'Roubos de Bola',
      blocks: 'Tocos',
      turnovers: 'Turnovers',
      fgMissed: 'Arremessos Errados',
      ftMade: 'Lances Livres Convertidos',
      ftMissed: 'Lances Livres Errados',
      doubleDouble: 'Double-Double (bonus)',
      tripleDouble: 'Triple-Double (bonus)',
    },
  },
  en: {
    back: 'Back',
    title: 'Fantasy Dashboard',
    tabs: {
      standings: 'Fantasy Standings',
      lastMatch: 'Last Match',
      scoringRules: 'Scoring Rules',
    },
    // Standings tab
    rank: '#',
    team: 'Team',
    totalFpts: 'Total FPts',
    avgFpts: 'Avg FPts/Game',
    noStandings: 'No standings data available.',
    // Last Match tab
    player: 'Player',
    position: 'Pos',
    pts: 'PTS',
    reb: 'REB',
    ast: 'AST',
    stl: 'STL',
    blk: 'BLK',
    fpts: 'FPts',
    noMatchData: 'No match data available.',
    homeTeam: 'Home Team',
    awayTeam: 'Away Team',
    // Scoring Rules tab
    statCategory: 'Stat Category',
    pointsPer: 'Points Per',
    activePreset: 'Active Preset',
    presetNames: {
      standard: 'Standard',
      volume: 'Volume',
      allAround: 'All-Around',
      defenseFirst: 'Defense First',
      custom: 'Custom',
    },
    categoryLabels: {
      points: 'Points',
      rebounds: 'Rebounds',
      assists: 'Assists',
      steals: 'Steals',
      blocks: 'Blocks',
      turnovers: 'Turnovers',
      fgMissed: 'Missed Field Goals',
      ftMade: 'Made Free Throws',
      ftMissed: 'Missed Free Throws',
      doubleDouble: 'Double-Double (bonus)',
      tripleDouble: 'Triple-Double (bonus)',
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect which scoring preset (if any) matches the active config.
 * Returns the preset key or 'custom' if none match.
 */
function detectActivePreset(config) {
  const keys = Object.keys(DEFAULT_SCORING_CONFIG);
  for (const [presetName, presetConfig] of Object.entries(SCORING_PRESETS)) {
    const match = keys.every((k) => config[k] === presetConfig[k]);
    if (match) return presetName;
  }
  return 'custom';
}

/**
 * Normalise a player entry from lastMatchStats into the canonical shape
 * expected by calculatePlayerFantasyPoints.  Accepts both engine format
 * (player.stats.*) and pre-normalised fantasy format.
 */
function normalisePlayer(p) {
  // If the player already has the canonical 'points' key (not 'pointsScored'),
  // assume it is pre-normalised.  Otherwise run through the engine bridge.
  if (p && typeof p === 'object' && 'points' in p && 'rebounds' in p) {
    return p;
  }
  try {
    return normalizePlayerStatsFromEngine(p);
  } catch {
    // Fallback: return as-is and let the scoring function work with what it has
    return p;
  }
}

/**
 * Return a CSS colour token based on fantasy point thresholds.
 */
function performanceColor(fpts) {
  if (fpts > 30) return '#4caf50'; // green — top performer
  if (fpts > 20) return '#ff9800'; // orange — good
  return 'inherit';
}

// ---------------------------------------------------------------------------
// Inline styles (dark theme, orange accent, mobile-first)
// ---------------------------------------------------------------------------

const ACCENT = '#ff6b35';

const styles = {
  container: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: '#1a1a2e',
    color: '#e0e0e0',
    minHeight: '100vh',
    padding: '12px',
    maxWidth: '900px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  backBtn: {
    background: 'transparent',
    border: `1px solid ${ACCENT}`,
    color: ACCENT,
    padding: '8px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9em',
    flexShrink: 0,
    minHeight: '44px',
  },
  title: {
    fontSize: '1.3em',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '16px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  tab: (active) => ({
    flex: '1 1 0',
    minWidth: '110px',
    padding: '10px 8px',
    border: 'none',
    borderBottom: active ? `3px solid ${ACCENT}` : '3px solid transparent',
    background: active ? 'rgba(255,107,53,0.15)' : 'transparent',
    color: active ? ACCENT : '#aaa',
    fontWeight: active ? 700 : 400,
    fontSize: '0.82em',
    cursor: 'pointer',
    borderRadius: '8px 8px 0 0',
    transition: 'all 0.2s',
    minHeight: '44px',
    whiteSpace: 'nowrap',
  }),
  tableWrapper: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85em',
    minWidth: '480px',
  },
  th: {
    padding: '10px 8px',
    textAlign: 'left',
    borderBottom: '2px solid rgba(255,107,53,0.3)',
    color: ACCENT,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: '#1a1a2e',
  },
  thRight: {
    padding: '10px 8px',
    textAlign: 'right',
    borderBottom: '2px solid rgba(255,107,53,0.3)',
    color: ACCENT,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: '#1a1a2e',
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
  },
  tdRight: {
    padding: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  userRow: {
    background: 'rgba(255,107,53,0.12)',
  },
  emptyMessage: {
    textAlign: 'center',
    padding: '40px 16px',
    color: '#888',
    fontSize: '0.95em',
  },
  sectionTitle: {
    fontSize: '1em',
    fontWeight: 600,
    color: '#fff',
    margin: '20px 0 10px',
    paddingLeft: '4px',
  },
  presetBadge: (active) => ({
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '0.85em',
    fontWeight: 600,
    background: active ? ACCENT : 'rgba(255,255,255,0.08)',
    color: active ? '#fff' : '#aaa',
    marginRight: '8px',
    marginBottom: '6px',
  }),
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StandingsTab({ standings, t }) {
  if (!standings || standings.length === 0) {
    return <p style={styles.emptyMessage}>{t.noStandings}</p>;
  }

  // Sort by fantasyPts descending
  const sorted = [...standings].sort((a, b) => {
    const aFpts = a.stats?.fantasyPts ?? 0;
    const bFpts = b.stats?.fantasyPts ?? 0;
    return bFpts - aFpts;
  });

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>{t.rank}</th>
            <th style={styles.th}>{t.team}</th>
            <th style={styles.thRight}>{t.totalFpts}</th>
            <th style={styles.thRight}>{t.avgFpts}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, index) => {
            const fpts = team.stats?.fantasyPts ?? 0;
            const played = team.stats?.played ?? 0;
            const avg = played > 0 ? (fpts / played).toFixed(1) : '0.0';
            return (
              <tr
                key={team.id}
                style={team.isUserTeam ? styles.userRow : undefined}
              >
                <td style={styles.td}>{index + 1}</td>
                <td style={{ ...styles.td, fontWeight: team.isUserTeam ? 700 : 400 }}>
                  {team.isUserTeam ? '\u2B50 ' : ''}
                  {team.name}
                </td>
                <td style={{ ...styles.tdRight, fontWeight: 600 }}>
                  {fpts.toFixed(1)}
                </td>
                <td style={styles.tdRight}>{avg}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LastMatchTab({ lastMatchStats, scoringConfig, t }) {
  // Compute fantasy breakdown for all players from both teams
  const rows = useMemo(() => {
    if (!lastMatchStats) return null;

    const config = scoringConfig || DEFAULT_SCORING_CONFIG;
    const allPlayers = [];

    const processPlayers = (players, teamLabel) => {
      if (!Array.isArray(players)) return;
      for (const p of players) {
        const normalised = normalisePlayer(p);
        const result = calculatePlayerFantasyPoints(normalised, config);
        allPlayers.push({
          playerName: normalised.playerName || normalised.name || 'Unknown',
          position: normalised.position || '—',
          pts: normalised.points ?? 0,
          reb: normalised.rebounds ?? 0,
          ast: normalised.assists ?? 0,
          stl: normalised.steals ?? 0,
          blk: normalised.blocks ?? 0,
          fpts: result.totalPoints,
          team: teamLabel,
        });
      }
    };

    processPlayers(
      lastMatchStats.homePlayers,
      lastMatchStats.homeTeam || t.homeTeam
    );
    processPlayers(
      lastMatchStats.awayPlayers,
      lastMatchStats.awayTeam || t.awayTeam
    );

    // Sort by fantasy points descending
    allPlayers.sort((a, b) => b.fpts - a.fpts);
    return allPlayers;
  }, [lastMatchStats, scoringConfig, t]);

  if (!lastMatchStats || !rows) {
    return <p style={styles.emptyMessage}>{t.noMatchData}</p>;
  }

  const matchTitle = `${lastMatchStats.homeTeam || t.homeTeam} vs ${lastMatchStats.awayTeam || t.awayTeam}`;

  return (
    <div>
      <h3 style={{ ...styles.sectionTitle, textAlign: 'center' }}>
        {matchTitle}
      </h3>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.player}</th>
              <th style={styles.th}>{t.position}</th>
              <th style={styles.thRight}>{t.pts}</th>
              <th style={styles.thRight}>{t.reb}</th>
              <th style={styles.thRight}>{t.ast}</th>
              <th style={styles.thRight}>{t.stl}</th>
              <th style={styles.thRight}>{t.blk}</th>
              <th style={styles.thRight}>{t.fpts}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.playerName}-${i}`}>
                <td style={{ ...styles.td, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.playerName}
                </td>
                <td style={{ ...styles.td, color: '#aaa' }}>{row.position}</td>
                <td style={styles.tdRight}>{row.pts}</td>
                <td style={styles.tdRight}>{row.reb}</td>
                <td style={styles.tdRight}>{row.ast}</td>
                <td style={styles.tdRight}>{row.stl}</td>
                <td style={styles.tdRight}>{row.blk}</td>
                <td
                  style={{
                    ...styles.tdRight,
                    fontWeight: 700,
                    color: performanceColor(row.fpts),
                  }}
                >
                  {row.fpts.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoringRulesTab({ scoringConfig, t }) {
  const config = scoringConfig || DEFAULT_SCORING_CONFIG;
  const activePreset = detectActivePreset(config);

  const CATEGORY_KEYS = [
    'points',
    'rebounds',
    'assists',
    'steals',
    'blocks',
    'turnovers',
    'fgMissed',
    'ftMade',
    'ftMissed',
    'doubleDouble',
    'tripleDouble',
  ];

  const presetKeys = ['standard', 'volume', 'allAround', 'defenseFirst'];

  return (
    <div>
      {/* Active preset indicator */}
      <h3 style={styles.sectionTitle}>{t.activePreset}</h3>
      <div style={{ padding: '0 4px 12px', display: 'flex', flexWrap: 'wrap' }}>
        {presetKeys.map((key) => (
          <span key={key} style={styles.presetBadge(activePreset === key)}>
            {t.presetNames[key]}
          </span>
        ))}
        {activePreset === 'custom' && (
          <span style={styles.presetBadge(true)}>
            {t.presetNames.custom}
          </span>
        )}
      </div>

      {/* Scoring table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>{t.statCategory}</th>
              <th style={styles.thRight}>{t.pointsPer}</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_KEYS.map((key) => {
              const value = config[key];
              const isNegative = value < 0;
              return (
                <tr key={key}>
                  <td style={styles.td}>{t.categoryLabels[key]}</td>
                  <td
                    style={{
                      ...styles.tdRight,
                      fontWeight: 600,
                      color: isNegative ? '#ef5350' : '#4caf50',
                    }}
                  >
                    {value > 0 ? '+' : ''}
                    {value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FantasyDashboard({
  language = 'pt',
  leagueId,
  standings = [],
  lastMatchStats = null,
  scoringConfig = null,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('standings');
  const t = translations[language] || translations.pt;
  const resolvedConfig = scoringConfig || DEFAULT_SCORING_CONFIG;

  const TAB_KEYS = ['standings', 'lastMatch', 'scoringRules'];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {onBack && (
          <button style={styles.backBtn} onClick={onBack}>
            &larr; {t.back}
          </button>
        )}
        <h2 style={styles.title}>{t.title}</h2>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            style={styles.tab(activeTab === key)}
            onClick={() => setActiveTab(key)}
          >
            {t.tabs[key]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'standings' && (
          <StandingsTab standings={standings} t={t} />
        )}

        {activeTab === 'lastMatch' && (
          <LastMatchTab
            lastMatchStats={lastMatchStats}
            scoringConfig={resolvedConfig}
            t={t}
          />
        )}

        {activeTab === 'scoringRules' && (
          <ScoringRulesTab scoringConfig={resolvedConfig} t={t} />
        )}
      </div>
    </div>
  );
}
