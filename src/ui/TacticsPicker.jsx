import React, { useState } from 'react';
import { PLAY_STYLES, DEFENSIVE_SCHEMES } from '../core/tacticsEngine.js';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const TEXTS = {
  pt: {
    title: 'Plano de Jogo',
    offenseHeading: 'Ataque',
    defenseHeading: 'Defesa',
    confirm: 'Confirmar',
    back: '\u2190 Voltar',
  },
  en: {
    title: 'Game Plan',
    offenseHeading: 'Offense',
    defenseHeading: 'Defense',
    confirm: 'Lock In',
    back: '\u2190 Back',
  },
};

/** Per-play-style translated labels and short descriptions. */
const PLAY_STYLE_I18N = {
  TRANSITION: {
    pt: { name: 'Contra-Ataque',          desc: '+velocidade, -efici\u00eancia no meio-campo' },
    en: { name: 'Fast Break',             desc: '+speed, -half-court efficiency' },
  },
  HALF_COURT: {
    pt: { name: 'Meia-Quadra',            desc: '+% arremesso, -transi\u00e7\u00e3o' },
    en: { name: 'Half-Court',             desc: '+shooting%, -transition' },
  },
  ISOLATION: {
    pt: { name: 'Isola\u00e7\u00e3o',     desc: '+uso da estrela, -qu\u00edmica' },
    en: { name: 'Isolation',              desc: '+star usage, -chemistry' },
  },
  SPREAD_3PT: {
    pt: { name: 'Aberto / 3 Pontos',      desc: '+volume de 3pts, -pontua\u00e7\u00e3o no garraf\u00e3o' },
    en: { name: 'Spread / 3PT',           desc: '+3pt volume, -paint scoring' },
  },
  POST_UP: {
    pt: { name: 'Jogo no Poste',          desc: '+pontua\u00e7\u00e3o C/PF, -fantasy pts armadores' },
    en: { name: 'Post Up',               desc: '+C/PF scoring, -guard fantasy pts' },
  },
};

/** Per-defensive-scheme translated labels and short descriptions. */
const DEFENSE_I18N = {
  MAN_TO_MAN: {
    pt: { name: 'Individual',             desc: 'Melhores matchups, risco alto de roubos' },
    en: { name: 'Man-to-Man',            desc: 'Best matchups, high steal risk' },
  },
  ZONE: {
    pt: { name: 'Zona',                   desc: 'Reduz 3pts%, +rebotes, -roubos' },
    en: { name: 'Zone',                  desc: 'Reduces 3pt%, +rebounds, -steals' },
  },
  PRESS: {
    pt: { name: 'Press\u00e3o Total',     desc: '+turnovers, alto custo de stamina' },
    en: { name: 'Full-Court Press',       desc: '+turnovers, high stamina cost' },
  },
  HACK_A_CENTER: {
    pt: { name: 'Hack-a-Piv\u00f4',      desc: 'For\u00e7a lances livres, alto risco/recompensa' },
    en: { name: 'Hack-a-Center',         desc: 'Forces FTs, high risk/reward' },
  },
};

// ---------------------------------------------------------------------------
// Styles (inline, referencing CSS custom-property values for consistency
// with the existing dark theme defined in main.css)
// ---------------------------------------------------------------------------

const styles = {
  wrapper: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '20px 16px',
  },

  backBtn: {
    marginBottom: 20,
    padding: '10px 20px',
    background: 'transparent',
    border: '2px solid var(--primary, #ff6b35)',
    color: 'var(--primary, #ff6b35)',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: '1rem',
    minHeight: 44,
  },

  title: {
    textAlign: 'center',
    marginBottom: 28,
    color: 'var(--primary, #ff6b35)',
    fontSize: '1.6rem',
  },

  sectionHeading: {
    color: 'var(--text-muted, #8b9dc3)',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  section: {
    marginBottom: 28,
  },

  cardsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  card: (selected) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '14px 16px',
    minHeight: 56,
    background: selected
      ? 'rgba(255, 107, 53, 0.12)'
      : 'var(--bg-card, #16213e)',
    border: selected
      ? '2px solid var(--primary, #ff6b35)'
      : '2px solid var(--bg-input, #0f3460)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: selected
      ? '0 0 12px rgba(255, 107, 53, 0.25)'
      : 'none',
    WebkitTapHighlightColor: 'transparent',
  }),

  cardName: (selected) => ({
    fontWeight: 600,
    fontSize: '1rem',
    color: selected
      ? 'var(--primary, #ff6b35)'
      : 'var(--text-light, #ffffff)',
  }),

  cardDesc: {
    fontSize: '0.82rem',
    color: 'var(--text-muted, #8b9dc3)',
    lineHeight: 1.4,
  },

  confirmBtn: {
    display: 'block',
    width: '100%',
    padding: '16px 30px',
    fontSize: '1.15rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, var(--primary, #ff6b35), var(--primary-dark, #e85a24))',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    minHeight: 52,
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PLAY_STYLE_KEYS = Object.keys(PLAY_STYLES);
const DEFENSE_KEYS = Object.keys(DEFENSIVE_SCHEMES);

function TacticsPicker({ language = 'pt', onConfirm, onBack }) {
  const [playStyle, setPlayStyle] = useState('HALF_COURT');
  const [defenseScheme, setDefenseScheme] = useState('MAN_TO_MAN');

  const lang = (language === 'en') ? 'en' : 'pt';
  const t = TEXTS[lang];

  const handleConfirm = () => {
    if (typeof onConfirm === 'function') {
      onConfirm({ playStyle, defenseScheme });
    }
  };

  return (
    <div style={styles.wrapper} className="tactics-picker">
      {/* Back button */}
      {onBack && (
        <button
          className="back-btn"
          onClick={onBack}
          style={styles.backBtn}
        >
          {t.back}
        </button>
      )}

      {/* Title */}
      <h2 style={styles.title}>{t.title}</h2>

      {/* ---- Offense Section ---- */}
      <div style={styles.section}>
        <h3 style={styles.sectionHeading}>{t.offenseHeading}</h3>
        <div style={styles.cardsGrid}>
          {PLAY_STYLE_KEYS.map((key) => {
            const selected = playStyle === key;
            const i18n = PLAY_STYLE_I18N[key]?.[lang] ?? { name: key, desc: '' };
            return (
              <button
                key={key}
                type="button"
                style={styles.card(selected)}
                aria-pressed={selected}
                onClick={() => setPlayStyle(key)}
                onMouseEnter={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = 'var(--primary, #ff6b35)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = 'var(--bg-input, #0f3460)';
                  }
                }}
              >
                <span style={styles.cardName(selected)}>{i18n.name}</span>
                <span style={styles.cardDesc}>{i18n.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Defense Section ---- */}
      <div style={styles.section}>
        <h3 style={styles.sectionHeading}>{t.defenseHeading}</h3>
        <div style={styles.cardsGrid}>
          {DEFENSE_KEYS.map((key) => {
            const selected = defenseScheme === key;
            const i18n = DEFENSE_I18N[key]?.[lang] ?? { name: key, desc: '' };
            return (
              <button
                key={key}
                type="button"
                style={styles.card(selected)}
                aria-pressed={selected}
                onClick={() => setDefenseScheme(key)}
                onMouseEnter={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = 'var(--primary, #ff6b35)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = 'var(--bg-input, #0f3460)';
                  }
                }}
              >
                <span style={styles.cardName(selected)}>{i18n.name}</span>
                <span style={styles.cardDesc}>{i18n.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm */}
      <button
        type="button"
        style={styles.confirmBtn}
        onClick={handleConfirm}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.03)';
          e.currentTarget.style.boxShadow = '0 5px 20px rgba(255, 107, 53, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {t.confirm}
      </button>
    </div>
  );
}

export default TacticsPicker;
