/**
 * DraftRoom.jsx
 * Quadra Legacy — Snake Draft UI
 *
 * Full draft lifecycle: Lobby -> Picking -> Complete
 * Manages 90-second pick timer, AI auto-picks (1 s delay),
 * position filters, player selection card, roster panel, and draft log.
 *
 * Props:
 *   language       — 'pt' | 'en'
 *   draftConfig    — { leagueId, managers, rosterSize, playerPool }
 *   onDraftComplete — (draftResult) => void
 *   onBack          — () => void
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  createDraft,
  startDraft,
  makePick,
  autoPickForManager,
  getManagerRoster,
  getBestAvailable,
  getPositionNeeds,
} from '../gameplay/draftEngine.js';
import { calculateOverall } from '../gameplay/playerCreator.js';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const TEXTS = {
  pt: {
    lobbyTitle:    'Sala do Draft',
    readyBtn:      'Pronto!',
    readyLabel:    'Pronto',
    waitingLabel:  'Aguardando',
    aiLabel:       'IA',
    startingSoon:  'Iniciando...',
    roundPick:     (r, p) => `Rodada ${r}, Pick ${p}`,
    pickerTurn:    (name) => `Vez de: ${name}`,
    yourTurn:      'SUA VEZ!',
    timer:         'Tempo',
    playerPool:    'Jogadores Dispon\u00edveis',
    filterAll:     'Todos',
    draftBtn:      'Draftar Jogador',
    yourRoster:    'Seu Elenco',
    draftLog:      'Hist\u00f3rico',
    logEntry:      (r, p, team, player, pos) =>
      `R${r} #${p}: ${team} \u2014 ${player} (${pos})`,
    completeTitle: 'Draft Conclu\u00eddo!',
    finalRosters:  'Elencos Finais',
    continueBtn:   'Continuar',
    backBtn:       '\u2190 Voltar',
    name:          'Nome',
    pos:           'Pos',
    archetype:     'Arqu\u00e9tipo',
    ovr:           'OVR',
    age:           'Idade',
    selectHint:    'Toque em um jogador para ver detalhes',
    aiThinking:    'IA escolhendo...',
    empty:         'Nenhum jogador ainda',
    you:           '(Voc\u00ea)',
    attack:        'Ataque',
    defense:       'Defesa',
    threePoint:    '3 Pontos',
    passing:       'Passe',
    stamina:       'Stamina',
    posNeeds:      'Precisa',
    errorLabel:    'Erro ao criar o draft',
  },
  en: {
    lobbyTitle:    'Draft Room',
    readyBtn:      'Ready!',
    readyLabel:    'Ready',
    waitingLabel:  'Waiting',
    aiLabel:       'AI',
    startingSoon:  'Starting...',
    roundPick:     (r, p) => `Round ${r}, Pick ${p}`,
    pickerTurn:    (name) => `${name}'s pick`,
    yourTurn:      'YOUR TURN!',
    timer:         'Timer',
    playerPool:    'Available Players',
    filterAll:     'All',
    draftBtn:      'Draft Player',
    yourRoster:    'Your Roster',
    draftLog:      'Draft Log',
    logEntry:      (r, p, team, player, pos) =>
      `R${r} #${p}: ${team} \u2014 ${player} (${pos})`,
    completeTitle: 'Draft Complete!',
    finalRosters:  'Final Rosters',
    continueBtn:   'Continue',
    backBtn:       '\u2190 Back',
    name:          'Name',
    pos:           'Pos',
    archetype:     'Archetype',
    ovr:           'OVR',
    age:           'Age',
    selectHint:    'Tap a player to see details',
    aiThinking:    'AI picking...',
    empty:         'No picks yet',
    you:           '(You)',
    attack:        'Attack',
    defense:       'Defense',
    threePoint:    '3-Point',
    passing:       'Passing',
    stamina:       'Stamina',
    posNeeds:      'Need',
    errorLabel:    'Error creating draft',
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POSITION_FILTERS = ['All', 'PG', 'SG', 'SF', 'PF', 'C'];
const PICK_TIMER_SECONDS = 90;

const KEYFRAMES_CSS = `
@keyframes draftPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.4); }
  50%      { box-shadow: 0 0 20px 6px rgba(255, 107, 53, 0.6); }
}
@keyframes draftPulseBorder {
  0%, 100% { border-color: #ff6b35; }
  50%      { border-color: #ffaa80; }
}
@keyframes timerFlash {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
`;

/** Module-level flag so keyframes are injected only once across mounts. */
let keyframesInjected = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Overall rating with fallback to calculateOverall. */
function getOverall(player) {
  if (player.overall != null) return player.overall;
  if (player.attributes) return calculateOverall(player.attributes);
  return 0;
}

/** Color for overall rating badge. */
function getOvrColor(ovr) {
  if (ovr >= 80) return '#ff6b35';
  if (ovr >= 65) return '#4caf50';
  if (ovr >= 50) return '#ff9800';
  return '#8b9dc3';
}

/** Timer bar color based on time remaining. */
function getTimerColor(timeLeft, total) {
  const pct = timeLeft / total;
  if (pct > 0.5)  return '#4caf50';
  if (pct > 0.2)  return '#ff9800';
  return '#f44336';
}

// ---------------------------------------------------------------------------
// Inline Styles (dark theme, orange #ff6b35 accent)
// ---------------------------------------------------------------------------

const S = {
  /* ---- Layout ---- */
  wrapper: {
    maxWidth: 600,
    margin: '0 auto',
    padding: '12px 16px 80px',
  },

  backBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '2px solid var(--primary, #ff6b35)',
    color: 'var(--primary, #ff6b35)',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: '0.95rem',
    minHeight: 44,
    marginBottom: 16,
  },

  errorBox: {
    padding: '16px',
    background: 'rgba(244, 67, 54, 0.12)',
    border: '2px solid #f44336',
    borderRadius: 10,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 20,
  },

  /* ---- Lobby ---- */
  lobbyTitle: {
    textAlign: 'center',
    color: 'var(--primary, #ff6b35)',
    fontSize: '1.6rem',
    fontWeight: 'bold',
    marginBottom: 24,
  },

  managerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 24,
  },

  managerRow: (isUser) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: isUser
      ? 'rgba(255, 107, 53, 0.08)'
      : 'var(--bg-card, #16213e)',
    border: isUser
      ? '2px solid var(--primary, #ff6b35)'
      : '2px solid var(--bg-input, #0f3460)',
    borderRadius: 10,
    minHeight: 48,
  }),

  managerName: {
    color: 'var(--text-light, #ffffff)',
    fontWeight: 600,
    fontSize: '1rem',
  },

  managerTag: {
    fontSize: '0.82rem',
    color: 'var(--text-muted, #8b9dc3)',
    marginLeft: 6,
  },

  readyBadge: (ready) => ({
    fontSize: '0.82rem',
    fontWeight: 600,
    color: ready ? '#4caf50' : 'var(--text-muted, #8b9dc3)',
    padding: '4px 10px',
    borderRadius: 12,
    background: ready
      ? 'rgba(76, 175, 80, 0.15)'
      : 'rgba(139, 157, 195, 0.1)',
  }),

  primaryBtn: {
    display: 'block',
    width: '100%',
    padding: '16px',
    fontSize: '1.15rem',
    fontWeight: 'bold',
    background:
      'linear-gradient(135deg, var(--primary, #ff6b35), var(--primary-dark, #e85a24))',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    minHeight: 52,
    transition: 'transform 0.2s, box-shadow 0.2s',
  },

  startingText: {
    textAlign: 'center',
    color: 'var(--primary, #ff6b35)',
    fontSize: '1.2rem',
    fontWeight: 600,
    padding: '16px 0',
  },

  /* ---- Picking: Header ---- */
  headerBar: {
    textAlign: 'center',
    marginBottom: 12,
  },

  roundLabel: {
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  pickerName: (isUserTurn) => ({
    fontSize: isUserTurn ? '1.4rem' : '1.15rem',
    fontWeight: 'bold',
    color: isUserTurn ? '#ff6b35' : 'var(--text-light, #ffffff)',
  }),

  yourTurnBanner: {
    background: 'rgba(255, 107, 53, 0.12)',
    border: '2px solid #ff6b35',
    borderRadius: 10,
    padding: '10px 16px',
    textAlign: 'center',
    marginBottom: 12,
    animation: 'draftPulse 1.5s ease-in-out infinite',
  },

  yourTurnText: {
    color: '#ff6b35',
    fontWeight: 'bold',
    fontSize: '1.3rem',
    letterSpacing: 1,
  },

  aiOverlay: {
    textAlign: 'center',
    padding: '12px',
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.92rem',
    fontStyle: 'italic',
  },

  /* ---- Timer ---- */
  timerWrap: { marginBottom: 14 },

  timerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: '0.82rem',
    color: 'var(--text-muted, #8b9dc3)',
  },

  timerSeconds: (urgent) => ({
    fontWeight: 'bold',
    fontSize: '0.85rem',
    color: urgent ? '#f44336' : 'var(--text-muted, #8b9dc3)',
    animation: urgent ? 'timerFlash 1s infinite' : 'none',
  }),

  timerBarBg: {
    width: '100%',
    height: 6,
    background: 'var(--bg-input, #0f3460)',
    borderRadius: 3,
    overflow: 'hidden',
  },

  timerBarFill: (pct, color) => ({
    width: `${pct}%`,
    height: '100%',
    background: color,
    borderRadius: 3,
    transition: 'width 1s linear',
  }),

  /* ---- Position Filters ---- */
  filtersRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 12,
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 4,
  },

  filterBtn: (active) => ({
    padding: '8px 14px',
    fontSize: '0.85rem',
    fontWeight: 600,
    minHeight: 36,
    minWidth: 44,
    border: active
      ? '2px solid #ff6b35'
      : '2px solid var(--bg-input, #0f3460)',
    borderRadius: 8,
    background: active
      ? 'rgba(255, 107, 53, 0.15)'
      : 'var(--bg-card, #16213e)',
    color: active ? '#ff6b35' : 'var(--text-muted, #8b9dc3)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }),

  /* ---- Section headings ---- */
  sectionHeading: {
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 20,
  },

  /* ---- Player Pool ---- */
  poolWrap: {
    maxHeight: 300,
    overflowY: 'auto',
    border: '1px solid var(--bg-input, #0f3460)',
    borderRadius: 10,
    background: 'var(--bg-card, #16213e)',
  },

  poolHeader: {
    display: 'grid',
    gridTemplateColumns: '1fr 42px 76px 42px',
    gap: 6,
    padding: '8px 12px',
    fontSize: '0.75rem',
    color: 'var(--text-muted, #8b9dc3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottom: '1px solid var(--bg-input, #0f3460)',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-card, #16213e)',
    zIndex: 1,
  },

  playerRow: (selected) => ({
    display: 'grid',
    gridTemplateColumns: '1fr 42px 76px 42px',
    gap: 6,
    padding: '10px 12px',
    minHeight: 44,
    alignItems: 'center',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(15, 52, 96, 0.5)',
    background: selected ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
    transition: 'background 0.15s',
  }),

  playerName: {
    color: 'var(--text-light, #ffffff)',
    fontWeight: 500,
    fontSize: '0.92rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  poolCell: {
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.82rem',
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  playerOvr: (ovr) => ({
    fontWeight: 'bold',
    fontSize: '0.92rem',
    textAlign: 'center',
    color: getOvrColor(ovr),
  }),

  /* ---- Selected Player Card ---- */
  selectedCard: {
    background: 'var(--bg-card, #16213e)',
    border: '2px solid var(--primary, #ff6b35)',
    borderRadius: 12,
    padding: '16px',
    marginTop: 12,
    marginBottom: 12,
  },

  selectedTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  selectedName: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: 'var(--text-light, #ffffff)',
    marginBottom: 4,
  },

  selectedMeta: {
    fontSize: '0.88rem',
    color: 'var(--text-muted, #8b9dc3)',
    marginBottom: 2,
  },

  ovrBadge: (ovr) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: '50%',
    flexShrink: 0,
    background:
      ovr >= 80
        ? 'rgba(255, 107, 53, 0.15)'
        : ovr >= 65
          ? 'rgba(76, 175, 80, 0.15)'
          : 'rgba(139, 157, 195, 0.1)',
    border: `2px solid ${getOvrColor(ovr)}`,
    fontWeight: 'bold',
    fontSize: '1rem',
    color: getOvrColor(ovr),
  }),

  attrList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },

  attrRow: {
    display: 'flex',
    alignItems: 'center',
  },

  attrLabel: {
    fontSize: '0.82rem',
    color: 'var(--text-muted, #8b9dc3)',
    width: 56,
    flexShrink: 0,
  },

  attrBarBg: {
    flex: 1,
    height: 6,
    background: 'var(--bg-input, #0f3460)',
    borderRadius: 3,
    margin: '0 10px',
    overflow: 'hidden',
  },

  attrBarFill: (val) => ({
    width: `${val}%`,
    height: '100%',
    background: getOvrColor(val),
    borderRadius: 3,
  }),

  attrValue: (val) => ({
    fontSize: '0.88rem',
    fontWeight: 600,
    color: getOvrColor(val),
    width: 28,
    textAlign: 'right',
    flexShrink: 0,
  }),

  draftBtn: (disabled) => ({
    display: 'block',
    width: '100%',
    padding: '14px 30px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    background: disabled
      ? 'var(--bg-input, #0f3460)'
      : 'linear-gradient(135deg, var(--primary, #ff6b35), var(--primary-dark, #e85a24))',
    color: disabled ? 'var(--text-muted, #8b9dc3)' : '#ffffff',
    border: 'none',
    borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minHeight: 48,
    transition: 'transform 0.2s, box-shadow 0.2s',
    opacity: disabled ? 0.6 : 1,
  }),

  /* ---- Your Roster ---- */
  rosterWrap: {
    background: 'var(--bg-card, #16213e)',
    border: '1px solid var(--bg-input, #0f3460)',
    borderRadius: 10,
    padding: '10px 12px',
    maxHeight: 200,
    overflowY: 'auto',
  },

  rosterItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid rgba(15, 52, 96, 0.3)',
  },

  rosterPlayerName: {
    color: 'var(--text-light, #ffffff)',
    fontSize: '0.88rem',
    fontWeight: 500,
  },

  rosterPlayerInfo: {
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.82rem',
  },

  posNeedsText: {
    fontSize: '0.8rem',
    color: '#ff9800',
    marginTop: 4,
    marginBottom: 4,
  },

  emptyText: {
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.88rem',
    textAlign: 'center',
    padding: '8px 0',
    fontStyle: 'italic',
  },

  /* ---- Draft Log ---- */
  logWrap: {
    background: 'var(--bg-card, #16213e)',
    border: '1px solid var(--bg-input, #0f3460)',
    borderRadius: 10,
    padding: '10px 12px',
    maxHeight: 180,
    overflowY: 'auto',
    fontSize: '0.82rem',
  },

  logEntry: (isUser) => ({
    padding: '4px 0',
    color: isUser ? '#ff6b35' : 'var(--text-muted, #8b9dc3)',
    borderBottom: '1px solid rgba(15, 52, 96, 0.2)',
    fontWeight: isUser ? 600 : 400,
  }),

  /* ---- Complete Phase ---- */
  completeTitle: {
    textAlign: 'center',
    color: 'var(--primary, #ff6b35)',
    fontSize: '1.6rem',
    fontWeight: 'bold',
    marginBottom: 24,
  },

  teamSection: { marginBottom: 20 },

  teamName: (isUser) => ({
    fontSize: '1rem',
    fontWeight: 'bold',
    color: isUser ? '#ff6b35' : 'var(--text-light, #ffffff)',
    marginBottom: 8,
    padding: '8px 12px',
    background: isUser
      ? 'rgba(255, 107, 53, 0.08)'
      : 'var(--bg-card, #16213e)',
    borderRadius: 8,
    border: isUser
      ? '1px solid #ff6b35'
      : '1px solid var(--bg-input, #0f3460)',
  }),

  teamRosterList: { padding: '0 12px' },

  teamRosterItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px solid rgba(15, 52, 96, 0.2)',
    fontSize: '0.88rem',
  },

  teamRosterPlayerName: { color: 'var(--text-light, #ffffff)' },
  teamRosterMeta: { color: 'var(--text-muted, #8b9dc3)' },
};

// ---------------------------------------------------------------------------
// Hover helpers (reused on multiple buttons)
// ---------------------------------------------------------------------------

function onPrimaryEnter(e) {
  e.currentTarget.style.transform = 'scale(1.03)';
  e.currentTarget.style.boxShadow = '0 5px 20px rgba(255, 107, 53, 0.4)';
}
function onPrimaryLeave(e) {
  e.currentTarget.style.transform = 'scale(1)';
  e.currentTarget.style.boxShadow = 'none';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DraftRoom({ language = 'pt', draftConfig, onDraftComplete, onBack }) {
  const lang = language === 'en' ? 'en' : 'pt';
  const t = TEXTS[lang];

  // ---- State ----
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [posFilter, setPosFilter] = useState('All');
  const [timeLeft, setTimeLeft] = useState(PICK_TIMER_SECONDS);
  const [isUserReady, setIsUserReady] = useState(false);

  // ---- Refs ----
  const timerRef     = useRef(null);
  const aiTimeoutRef = useRef(null);
  const logEndRef    = useRef(null);

  // ---- Inject CSS keyframes (once per module) ----
  useEffect(() => {
    if (keyframesInjected) return;
    const style = document.createElement('style');
    style.textContent = KEYFRAMES_CSS;
    document.head.appendChild(style);
    keyframesInjected = true;
  }, []);

  // ---- Initialise draft from config ----
  useEffect(() => {
    if (!draftConfig) return;
    try {
      const d = createDraft({
        leagueId:   draftConfig.leagueId,
        managers:   draftConfig.managers,
        rosterSize: draftConfig.rosterSize ?? 8,
        playerPool: draftConfig.playerPool,
      });
      // Cache full player pool so getManagerRoster returns complete objects
      // after they are removed from the active pool by makePick.
      d._allPlayers = [...d.playerPool];
      setDraft(d);
      setError(null);
    } catch (err) {
      console.error('[DraftRoom] Failed to create draft:', err);
      setError(err.message);
    }
  }, [draftConfig?.leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Derived values ----
  const userManager = useMemo(
    () => draft?.managers?.find((m) => m.isUser) || null,
    [draft?.managers],
  );

  const managerMap = useMemo(() => {
    if (!draft?.managers) return {};
    return Object.fromEntries(draft.managers.map((m) => [m.id, m]));
  }, [draft?.managers]);

  const allPlayersMap = useMemo(() => {
    if (!draft?._allPlayers) return new Map();
    return new Map(draft._allPlayers.map((p) => [p.id, p]));
  }, [draft?._allPlayers]);

  const currentManager =
    draft?.currentPick ? managerMap[draft.currentPick.managerId] || null : null;

  const isUserTurn = !!(
    draft?.status === 'picking' &&
    currentManager &&
    currentManager.isUser
  );

  const isAITurn = !!(
    draft?.status === 'picking' &&
    currentManager &&
    currentManager.isAI
  );

  const availablePlayers = useMemo(() => {
    if (!draft || draft.status === 'lobby') return [];
    return getBestAvailable(draft, posFilter === 'All' ? null : posFilter);
  }, [draft, posFilter]);

  const userRoster = useMemo(() => {
    if (!draft || !userManager) return [];
    return getManagerRoster(draft, userManager.id);
  }, [draft, userManager?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const posNeeds = useMemo(() => {
    if (!draft || !userManager) return [];
    return getPositionNeeds(userRoster, draft.rosterSize);
  }, [userRoster, draft?.rosterSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-start when all managers are ready (lobby) ----
  useEffect(() => {
    if (!draft || draft.status !== 'lobby') return;
    const allReady = draft.managers.every((m) => m.isAI || m.ready);
    if (!allReady) return;

    const timeout = setTimeout(() => {
      setDraft((prev) => {
        if (!prev || prev.status !== 'lobby') return prev;
        try {
          return startDraft(prev);
        } catch (err) {
          console.error('[DraftRoom] startDraft failed:', err);
          return prev;
        }
      });
    }, 800);

    return () => clearTimeout(timeout);
  }, [draft?.managers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- AI auto-pick (1 s delay) ----
  useEffect(() => {
    if (!draft || draft.status !== 'picking' || !draft.currentPick) return;
    if (!currentManager || !currentManager.isAI) return;

    const managerId = currentManager.id;

    aiTimeoutRef.current = setTimeout(() => {
      setDraft((prev) => {
        if (!prev || prev.status !== 'picking') return prev;
        if (prev.currentPick?.managerId !== managerId) return prev;
        try {
          const result = autoPickForManager(prev, managerId);
          return result.draft;
        } catch (err) {
          console.error('[DraftRoom] AI auto-pick failed:', err);
          return prev;
        }
      });
    }, 1000);

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [draft?.currentPick?.managerId, draft?.currentPick?.pickNumber, draft?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Pick timer (user turn only) ----
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const total = draft?.pickTimerSeconds || PICK_TIMER_SECONDS;
    if (!isUserTurn) {
      setTimeLeft(total);
      return;
    }

    setTimeLeft(total);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isUserTurn, draft?.currentPick?.pickNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-pick on timer expiry ----
  useEffect(() => {
    if (timeLeft !== 0 || !isUserTurn || !userManager) return;

    setDraft((prev) => {
      if (!prev || prev.status !== 'picking') return prev;
      if (prev.currentPick?.managerId !== userManager.id) return prev;
      try {
        const result = autoPickForManager(prev, userManager.id);
        return result.draft;
      } catch (err) {
        console.error('[DraftRoom] Auto-pick on timeout failed:', err);
        return prev;
      }
    });
    setSelectedPlayer(null);
  }, [timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Clear selected player if they were picked by AI ----
  useEffect(() => {
    if (!selectedPlayer || !draft) return;
    const stillAvailable = draft.playerPool.some(
      (p) => p.id === selectedPlayer.id,
    );
    if (!stillAvailable) setSelectedPlayer(null);
  }, [draft?.playerPool?.length, selectedPlayer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-scroll draft log ----
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [draft?.picks?.length]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, []);

  // ---- Handlers ----

  const handleReady = useCallback(() => {
    setIsUserReady(true);
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        managers: prev.managers.map((m) =>
          m.isUser ? { ...m, ready: true } : m,
        ),
      };
    });
  }, []);

  const handleSelectPlayer = useCallback((player) => {
    setSelectedPlayer((prev) => (prev?.id === player.id ? null : player));
  }, []);

  const handleDraftPlayer = useCallback(() => {
    if (!selectedPlayer || !isUserTurn || !userManager) return;

    const playerId = selectedPlayer.id;

    setDraft((prev) => {
      if (!prev || prev.status !== 'picking') return prev;
      if (prev.currentPick?.managerId !== userManager.id) return prev;
      try {
        const result = makePick(prev, userManager.id, playerId);
        return result.draft;
      } catch (err) {
        console.error('[DraftRoom] makePick failed:', err);
        return prev;
      }
    });
    setSelectedPlayer(null);
  }, [selectedPlayer, isUserTurn, userManager]);

  const handleContinue = useCallback(() => {
    if (!draft || draft.status !== 'complete') return;
    if (typeof onDraftComplete !== 'function') return;

    onDraftComplete({
      draftId:  draft.id,
      leagueId: draft.leagueId,
      picks:    draft.picks,
      rosters:  Object.fromEntries(
        draft.managers.map((m) => [m.id, getManagerRoster(draft, m.id)]),
      ),
      managers: draft.managers,
    });
  }, [draft, onDraftComplete]);

  // ===========================================================================
  // Guard: no draft / error
  // ===========================================================================

  if (error) {
    return (
      <div style={S.wrapper} className="draft-room">
        {onBack && (
          <button style={S.backBtn} onClick={onBack}>
            {t.backBtn}
          </button>
        )}
        <div style={S.errorBox}>
          {t.errorLabel}: {error}
        </div>
      </div>
    );
  }

  if (!draft) return null;

  // ===========================================================================
  // LOBBY
  // ===========================================================================

  if (draft.status === 'lobby') {
    const allReady = draft.managers.every((m) => m.isAI || m.ready);

    return (
      <div style={S.wrapper} className="draft-room">
        {onBack && (
          <button style={S.backBtn} onClick={onBack}>
            {t.backBtn}
          </button>
        )}

        <h2 style={S.lobbyTitle}>{t.lobbyTitle}</h2>

        <div style={S.managerList}>
          {draft.managers.map((m) => (
            <div key={m.id} style={S.managerRow(m.isUser)}>
              <div>
                <span style={S.managerName}>{m.name}</span>
                {m.isUser && (
                  <span style={S.managerTag}>{t.you}</span>
                )}
                {m.isAI && (
                  <span style={S.managerTag}>{t.aiLabel}</span>
                )}
              </div>
              <span style={S.readyBadge(m.isAI || m.ready)}>
                {m.isAI || m.ready ? t.readyLabel : t.waitingLabel}
              </span>
            </div>
          ))}
        </div>

        {!isUserReady && userManager && (
          <button
            style={S.primaryBtn}
            onClick={handleReady}
            onMouseEnter={onPrimaryEnter}
            onMouseLeave={onPrimaryLeave}
          >
            {t.readyBtn}
          </button>
        )}

        {allReady && <p style={S.startingText}>{t.startingSoon}</p>}
      </div>
    );
  }

  // ===========================================================================
  // COMPLETE
  // ===========================================================================

  if (draft.status === 'complete') {
    return (
      <div style={S.wrapper} className="draft-room">
        {onBack && (
          <button style={S.backBtn} onClick={onBack}>
            {t.backBtn}
          </button>
        )}

        <h2 style={S.completeTitle}>{t.completeTitle}</h2>

        <h3 style={S.sectionHeading}>{t.finalRosters}</h3>

        {draft.managers.map((m) => {
          const roster = getManagerRoster(draft, m.id);
          return (
            <div key={m.id} style={S.teamSection}>
              <div style={S.teamName(m.isUser)}>
                {m.name} {m.isUser ? t.you : ''}
              </div>
              <div style={S.teamRosterList}>
                {roster.map((p, idx) => {
                  const ovr = getOverall(p);
                  return (
                    <div key={p.id || idx} style={S.teamRosterItem}>
                      <span style={S.teamRosterPlayerName}>
                        {idx + 1}. {p.name}
                      </span>
                      <span style={S.teamRosterMeta}>
                        {p.position} | {p.archetype} | {ovr} OVR
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button
          style={S.primaryBtn}
          onClick={handleContinue}
          onMouseEnter={onPrimaryEnter}
          onMouseLeave={onPrimaryLeave}
        >
          {t.continueBtn}
        </button>
      </div>
    );
  }

  // ===========================================================================
  // PICKING
  // ===========================================================================

  const totalTimer = draft.pickTimerSeconds || PICK_TIMER_SECONDS;
  const timerPct   = (timeLeft / totalTimer) * 100;
  const timerColor = getTimerColor(timeLeft, totalTimer);
  const timerUrgent = timeLeft <= 10;

  /** Attribute keys to display in the selected player card. */
  const ATTR_DISPLAY = [
    ['attack',     'Attack'],
    ['defense',    'Defense'],
    ['threePoint', 'ThreePoint'],
    ['passing',    'Passing'],
    ['stamina',    'Stamina'],
  ];

  return (
    <div style={S.wrapper} className="draft-room">
      {onBack && (
        <button style={S.backBtn} onClick={onBack}>
          {t.backBtn}
        </button>
      )}

      {/* ---- Header ---- */}
      <div style={S.headerBar}>
        <div style={S.roundLabel}>
          {draft.currentPick &&
            t.roundPick(draft.currentPick.round, draft.currentPick.pickNumber)}
        </div>
        <div style={S.pickerName(isUserTurn)}>
          {currentManager && t.pickerTurn(currentManager.name)}
        </div>
      </div>

      {/* ---- Your Turn Banner ---- */}
      {isUserTurn && (
        <div style={S.yourTurnBanner}>
          <span style={S.yourTurnText}>{t.yourTurn}</span>
        </div>
      )}

      {/* ---- AI Thinking ---- */}
      {isAITurn && <div style={S.aiOverlay}>{t.aiThinking}</div>}

      {/* ---- Timer (user turn only) ---- */}
      {isUserTurn && (
        <div style={S.timerWrap}>
          <div style={S.timerRow}>
            <span>{t.timer}</span>
            <span style={S.timerSeconds(timerUrgent)}>{timeLeft}s</span>
          </div>
          <div style={S.timerBarBg}>
            <div style={S.timerBarFill(timerPct, timerColor)} />
          </div>
        </div>
      )}

      {/* ---- Position Filters ---- */}
      <div style={S.filtersRow}>
        {POSITION_FILTERS.map((pos) => (
          <button
            key={pos}
            type="button"
            style={S.filterBtn(posFilter === pos)}
            aria-pressed={posFilter === pos}
            onClick={() => setPosFilter(pos)}
          >
            {pos === 'All' ? t.filterAll : pos}
          </button>
        ))}
      </div>

      {/* ---- Available Players ---- */}
      <h3 style={{ ...S.sectionHeading, marginTop: 0 }}>
        {t.playerPool} ({availablePlayers.length})
      </h3>

      <div style={S.poolWrap}>
        {/* Column headers */}
        <div style={S.poolHeader}>
          <span>{t.name}</span>
          <span style={{ textAlign: 'center' }}>{t.pos}</span>
          <span style={{ textAlign: 'center' }}>{t.archetype}</span>
          <span style={{ textAlign: 'center' }}>{t.ovr}</span>
        </div>

        {/* Player rows */}
        {availablePlayers.map((p) => {
          const ovr = getOverall(p);
          const isSelected = selectedPlayer?.id === p.id;
          return (
            <div
              key={p.id}
              style={S.playerRow(isSelected)}
              onClick={() => handleSelectPlayer(p)}
              onMouseEnter={(e) => {
                if (!isSelected)
                  e.currentTarget.style.background = 'rgba(255,107,53,0.05)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={S.playerName}>{p.name}</span>
              <span style={S.poolCell}>{p.position}</span>
              <span style={S.poolCell}>{p.archetype}</span>
              <span style={S.playerOvr(ovr)}>{ovr}</span>
            </div>
          );
        })}
      </div>

      {/* ---- Selected Player Detail Card ---- */}
      {selectedPlayer && (
        <div style={S.selectedCard}>
          <div style={S.selectedTop}>
            <div>
              <div style={S.selectedName}>{selectedPlayer.name}</div>
              <div style={S.selectedMeta}>
                {selectedPlayer.position} | {selectedPlayer.archetype} |{' '}
                {t.age}: {selectedPlayer.age}
              </div>
              {selectedPlayer.height_cm && (
                <div style={S.selectedMeta}>
                  {selectedPlayer.height_cm}cm | {selectedPlayer.weight_kg}kg
                  {selectedPlayer.nationality
                    ? ` | ${selectedPlayer.nationality}`
                    : ''}
                </div>
              )}
            </div>
            <div style={S.ovrBadge(getOverall(selectedPlayer))}>
              {getOverall(selectedPlayer)}
            </div>
          </div>

          {/* Key attributes */}
          {selectedPlayer.attributes && (
            <div style={S.attrList}>
              {ATTR_DISPLAY.map(([labelKey, attrKey]) => {
                const val = selectedPlayer.attributes[attrKey] ?? 0;
                return (
                  <div key={attrKey} style={S.attrRow}>
                    <span style={S.attrLabel}>{t[labelKey]}</span>
                    <div style={S.attrBarBg}>
                      <div style={S.attrBarFill(val)} />
                    </div>
                    <span style={S.attrValue(val)}>{val}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Draft confirm button */}
          <button
            type="button"
            style={S.draftBtn(!isUserTurn)}
            disabled={!isUserTurn}
            onClick={handleDraftPlayer}
            onMouseEnter={(e) => {
              if (isUserTurn) onPrimaryEnter(e);
            }}
            onMouseLeave={(e) => {
              if (isUserTurn) onPrimaryLeave(e);
            }}
          >
            {t.draftBtn}
          </button>
        </div>
      )}

      {/* Hint when no player selected */}
      {!selectedPlayer && isUserTurn && (
        <p style={S.emptyText}>{t.selectHint}</p>
      )}

      {/* ---- Your Roster ---- */}
      <h3 style={S.sectionHeading}>
        {t.yourRoster} ({userRoster.length}/{draft.rosterSize})
      </h3>

      {posNeeds.length > 0 && (
        <div style={S.posNeedsText}>
          {t.posNeeds}: {posNeeds.join(', ')}
        </div>
      )}

      <div style={S.rosterWrap}>
        {userRoster.length === 0 ? (
          <p style={S.emptyText}>{t.empty}</p>
        ) : (
          userRoster.map((p, idx) => {
            const ovr = getOverall(p);
            return (
              <div key={p.id || idx} style={S.rosterItem}>
                <span style={S.rosterPlayerName}>
                  {idx + 1}. {p.name}
                </span>
                <span style={S.rosterPlayerInfo}>
                  {p.position} | {ovr}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ---- Draft Log ---- */}
      <h3 style={S.sectionHeading}>
        {t.draftLog} ({draft.picks.length})
      </h3>

      <div style={S.logWrap}>
        {draft.picks.length === 0 ? (
          <p style={S.emptyText}>{t.empty}</p>
        ) : (
          draft.picks.map((pick, idx) => {
            const mgr = managerMap[pick.managerId];
            const playerObj = allPlayersMap.get(pick.playerId);
            const pos = playerObj?.position || '??';
            const isUserPick = mgr?.isUser;
            return (
              <div key={idx} style={S.logEntry(isUserPick)}>
                {t.logEntry(
                  pick.round,
                  pick.pickNumber,
                  mgr?.name || '???',
                  pick.playerName,
                  pos,
                )}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

export default DraftRoom;
