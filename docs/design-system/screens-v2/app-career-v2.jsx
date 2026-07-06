// Career Portal v2 — career journey as the hero
//
// Frame: a vertical 7-level ladder showing where you came from, where you are,
// and where you're going. Past levels are achieved (teal, ✓), current level is
// the present moment (gold-glow, animated pulse), future levels are locked
// (warm grey, dim). Tap any future level → drawer with criteria + perks.
//
// Commission Playground has been pulled out into its own Tools surface —
// Career Portal stays focused on the ladder + commitment + trajectory.

// ── Career levels (mirrors src/components/profile/CareerPortal.jsx) ────────
const CAREER_LEVELS = [
  { level: 1, title: 'Salesperson',    api: 200000, apps: 42, persistency: 90, years: 0  },
  { level: 2, title: 'Advisor II',     api: 250000, apps: 42, persistency: 90, years: 2  },
  { level: 3, title: 'Advisor III',    api: 350000, apps: 48, persistency: 90, years: 3  },
  { level: 4, title: 'Advisor IV',     api: 450000, apps: 48, persistency: 90, years: 4  },
  { level: 5, title: 'Senior Advisor', api: 600000, apps: 52, persistency: 90, years: 5  },
  { level: 6, title: 'Elite Advisor',  api: 800000, apps: 52, persistency: 90, years: 6  },
  { level: 7, title: 'Legend',         api: null,   apps: null, persistency: null, years: 10 },
];

const LEVEL_TAGLINES = {
  1: 'Where every journey starts.',
  2: 'Earned consistency · the first tier reward.',
  3: 'Repeatable production · referrals open up.',
  4: 'Senior tier of the producing ranks.',
  5: 'Industry recognition · advisor seniority.',
  6: 'Elite producer · top-tier rewards.',
  7: 'Chairman\u2019s recognition · the pinnacle.',
};

const UNLOCKS = {
  2: [{ label: 'Higher commission rate',           detail: 'Tier 2 schedule' },
      { label: '\u201CAdvisor II\u201D title',     detail: 'Official designation' },
      { label: 'Advanced training modules',        detail: 'Onboarded access' }],
  3: [{ label: 'Elevated commission tier',         detail: 'Tier 3 schedule' },
      { label: '\u201CAdvisor III\u201D title',    detail: 'Official designation' },
      { label: 'Priority client referrals',        detail: 'Branch-routed leads' }],
  4: [{ label: 'Senior commission tier',           detail: 'Tier 4 schedule' },
      { label: '\u201CAdvisor IV\u201D + cards',   detail: 'Title + business cards' },
      { label: 'Mentorship eligibility',           detail: 'Bring on a junior' }],
  5: [{ label: 'Senior Advisor recognition',       detail: 'Industry standing' },
      { label: 'Dedicated branch support',         detail: 'Direct BM channel' },
      { label: 'Quarterly bonus eligibility',      detail: 'TTD 8K\u201325K per quarter' },
      { label: 'Conference seat',                  detail: 'Annual leadership event' }],
  6: [{ label: '\u201CElite Advisor\u201D title',  detail: 'Top of the producing ranks' },
      { label: 'Top-tier commission',              detail: 'Maximum schedule' },
      { label: 'Conference + retreat',             detail: 'Annual incentive trip' }],
  7: [{ label: '\u201CLegend\u201D designation',   detail: 'Chairman\u2019s recognition' },
      { label: 'Lifetime acknowledgement',         detail: 'Hall of fame' },
      { label: 'Legacy portfolio',                 detail: 'Senior advisor lineage' }],
};

// ── Mock career state ──────────────────────────────────────────────────────
const CAREER_DATA = {
  agentName:        'Marsha Singh',
  currentLevel:     4,
  levelDates:       { 1: '2 Sep 2023', 2: '14 Mar 2024', 3: '8 Nov 2024', 4: '21 Aug 2025' },
  currentTitle:     'Advisor IV',
  monthsAtCurrent:  3,
  ytdApi:           487000,
  ytdApps:          41,
  trailing2YrApi:   472000,
  persistency:      88,
  yearsOfService:   2.4,
  estimateToNext:   'about 3 months',
  weeklyPace:       22000,
  commitment: {
    api:         { mine: 600000, manager: 550000, floor: 450000, unit: 'TTD' },
    apps:        { mine: 52,     manager: 50,     floor: 48,     unit: 'count' },
    persistency: { mine: 92,     manager: 90,     floor: 90,     unit: '%' },
  },
};

// 6 achievement badges (port of BadgeGrid — kiosk-style medals)
const BADGES = [
  { id: 'mdrt',    name: 'MDRT Pace',     desc: 'On track for MDRT',         earned: true,  tier: 3, color: '#f59e0b' },
  { id: 'streak',  name: 'Consistent',    desc: '8 consecutive submissions', earned: true,  tier: 2, color: '#4ab5b8' },
  { id: 'big_wk',  name: 'Big Week',      desc: 'Over TTD 20k API in a week', earned: true,  tier: 3, color: '#4ab5b8' },
  { id: 'apps',    name: 'App Machine',   desc: '5+ apps in a single week',  earned: true,  tier: 2, color: '#f59e0b' },
  { id: 'mdrtQ',   name: 'MDRT Qualified',desc: 'TTD 500K API · this year',  earned: false, tier: 5, color: '#a89a85' },
  { id: 'leg',     name: 'Untouchable',   desc: '52 consecutive weeks',      earned: false, tier: 5, color: '#a89a85' },
];

// ──────────────────────────────────────────────────────────────────────────
// Visual state helpers
// ──────────────────────────────────────────────────────────────────────────
function levelStateFor(level, currentLevel) {
  if (level < currentLevel) return 'achieved';
  if (level === currentLevel) return 'current';
  return 'locked';
}

function levelNodeGrad(state) {
  if (state === 'achieved') return 'radial-gradient(circle at 32% 28%, #b9e9eb 0%, #4ab5b8 50%, #016970 100%)';
  if (state === 'current')  return 'radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)';
  return 'radial-gradient(circle at 32% 28%, #e0d6c8 0%, #a89a85 50%, #5a4e3d 100%)';
}

function levelAccent(state, t) {
  if (state === 'achieved') return t.teal;
  if (state === 'current')  return t.gold;
  return t.inkFaint;
}

// ──────────────────────────────────────────────────────────────────────────
// LadderNode — single node in the vertical timeline
// ──────────────────────────────────────────────────────────────────────────
function LadderNode({ t, lvl, state, dateEarned, monthsAt, isLast, animClass, onClick }) {
  const accent = levelAccent(state, t);
  const isCurrent  = state === 'current';
  const isAchieved = state === 'achieved';
  const fmtApi = lvl.api ? `TTD ${(lvl.api / 1000).toFixed(0)}K API` : 'Top';
  const cursor = state === 'locked' ? 'pointer' : 'default';

  return (
    <div className={animClass} style={{
      position: 'relative', display: 'flex', gap: 16,
      paddingBottom: isLast ? 0 : 24,
      cursor,
    }} onClick={state === 'locked' ? onClick : undefined}>
      {/* Connector line */}
      {!isLast && (
        <div style={{
          position: 'absolute', left: 27, top: 56, bottom: 4,
          width: isAchieved ? 2 : 0,
          background: isAchieved ? t.teal : 'transparent',
          borderLeft: !isAchieved ? `2px dashed ${t.rule}` : 'none',
        }}></div>
      )}

      {/* Node coin — 3D gradient for achieved/current, flat greyed-out coin with lock badge for locked */}
      {state === 'locked' ? (
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: t.surfaceMute,
          color: t.inkFaint,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 18,
          fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em',
          border: `1px solid ${t.rule}`,
          flexShrink: 0, zIndex: 1, position: 'relative',
        }}>
          {lvl.level}
          {/* Lock badge overlay */}
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 22, height: 22, borderRadius: '50%',
            background: t.surface, border: `1.5px solid ${t.rule}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: t.inkMute,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
        </div>
      ) : (
        <div className={isCurrent ? 'a-glow-soft' : ''} style={{
          width: 56, height: 56, borderRadius: '50%',
          background: levelNodeGrad(state),
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 18,
          fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em',
          boxShadow: isCurrent
            ? `0 0 0 4px ${t.goldTint}, 0 0 20px rgba(245,158,11,0.45), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.42)`
            : `0 4px 8px rgba(0,0,0,0.06), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.42)`,
          position: 'relative', flexShrink: 0, zIndex: 1,
        }}>
          {isAchieved ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : lvl.level}
          <span style={{
            position: 'absolute', top: '12%', left: '20%', width: '36%', height: '20%',
            borderRadius: '50%', background: 'rgba(255,255,255,0.42)', filter: 'blur(2.5px)',
          }}></span>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2,
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em',
            color: accent, fontFamily: APP_FONT_MONO,
          }}>LEVEL {lvl.level}</div>
          {isCurrent && (
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
              padding: '2px 7px', background: t.goldTint, color: t.gold,
              borderRadius: 999, fontFamily: APP_FONT_MONO,
            }}>YOU ARE HERE</div>
          )}
        </div>
        <div style={{
          fontSize: 17, fontWeight: 700, color: t.ink,
          fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em',
        }}>{lvl.title}</div>
        <div style={{ fontSize: 11, color: t.inkMute, marginTop: 3, lineHeight: 1.4 }}>
          {isAchieved   && `Earned ${dateEarned}`}
          {isCurrent    && `Reached ${dateEarned} · ${monthsAt} months in`}
          {!isAchieved && !isCurrent && `${fmtApi} · ${lvl.years}+ yrs of service`}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CareerLadder — composes 7 nodes
// ──────────────────────────────────────────────────────────────────────────
function CareerLadder({ t, currentLevel, levelDates, monthsAtCurrent, onLevelClick }) {
  return (
    <div className="a-card" style={{
      padding: '20px 22px 22px', background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 14, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <Eyebrow t={t}>Your career ladder</Eyebrow>
        <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
          {currentLevel} of {CAREER_LEVELS.length} levels reached
        </div>
      </div>
      <div>
        {CAREER_LEVELS.map((lvl, i) => {
          const state = levelStateFor(lvl.level, currentLevel);
          return (
            <LadderNode
              key={lvl.level}
              t={t}
              lvl={lvl}
              state={state}
              dateEarned={levelDates[lvl.level]}
              monthsAt={monthsAtCurrent}
              isLast={i === CAREER_LEVELS.length - 1}
              animClass={`a-fade-up a-d-${Math.min(i + 1, 8)}`}
              onClick={() => onLevelClick?.(lvl.level)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Time-to-next card — large estimate
// ──────────────────────────────────────────────────────────────────────────
function TimeToNextCard({ t, currentLevel, estimate, weeklyPace }) {
  const nextLevel = CAREER_LEVELS.find(l => l.level === currentLevel + 1);
  if (!nextLevel) return null;
  return (
    <div className="a-card a-rise" style={{
      padding: '20px 22px',
      background: t.surface, border: `1px solid ${t.teal}33`,
      borderRadius: 14, position: 'relative', overflow: 'hidden',
      boxShadow: `0 4px 14px rgba(74, 181, 184, 0.18)`,
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -60, right: -60, width: 220, height: 220,
        background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }}></div>
      <div style={{ position: 'relative' }}>
        <Eyebrow t={t}>Next milestone</Eyebrow>
        <div style={{
          fontSize: 17, fontWeight: 700, color: t.ink,
          letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY, marginTop: 6,
        }}>Level {nextLevel.level} — {nextLevel.title}</div>
        <div style={{
          fontSize: 32, fontWeight: 700, color: t.teal,
          letterSpacing: '-0.025em', lineHeight: 1, marginTop: 14,
          fontFamily: APP_FONT_DISPLAY,
        }}>{estimate}</div>
        <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 6, lineHeight: 1.5 }}>
          At your current pace of TTD {(weeklyPace / 1000).toFixed(0)}K/week
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Commitment scorecard with floor / target / mine markers
// ──────────────────────────────────────────────────────────────────────────
function CommitmentCard({ t, label, c, animClass }) {
  const max = Math.max(c.mine, c.manager, c.floor) * 1.08;
  const fmt = (v) => c.unit === 'TTD' ? `TTD ${(v/1000).toFixed(0)}K` : c.unit === '%' ? `${v}%` : String(v);
  const fillColor = c.mine >= c.manager ? t.success : c.mine >= c.floor ? t.warning : t.danger;
  return (
    <div className={`a-card ${animClass || ''}`} style={{
      padding: '14px 16px', background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 11,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{label.toUpperCase()}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
        <div style={{
          fontSize: 22, fontWeight: 700, color: fillColor,
          fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1,
        }}>{fmt(c.mine)}</div>
        <div style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO }}>MY COMMITMENT</div>
      </div>

      {/* Step-bar: fill + floor + manager markers */}
      <div style={{ position: 'relative', height: 18, marginTop: 14 }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 7, height: 4,
          background: t.surfaceMute, borderRadius: 999,
        }}></div>
        <div className="a-progress-grow" style={{
          position: 'absolute', left: 0, top: 7, height: 4,
          width: `${Math.min(100, (c.mine / max) * 100)}%`,
          background: fillColor, borderRadius: 999,
          transformOrigin: 'left center',
        }}></div>
        {/* Floor marker */}
        <div style={{
          position: 'absolute', left: `${(c.floor / max) * 100}%`,
          top: 3, width: 1.5, height: 12, background: t.inkFaint,
        }}></div>
        {/* Manager target marker */}
        <div style={{
          position: 'absolute', left: `${(c.manager / max) * 100}%`,
          top: 0, width: 2, height: 18, background: t.ink,
        }}></div>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: 6,
        fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
      }}>
        <span>FLOOR · {fmt(c.floor)}</span>
        <span>TARGET · {fmt(c.manager)}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Trajectory mini-chart — last 4 quarters
// ──────────────────────────────────────────────────────────────────────────
function TrajectoryCard({ t }) {
  // 8 quarters, simulated growth
  const values = [98, 112, 142, 168, 198, 245, 312, 396];
  const max = Math.max(...values);
  return (
    <div className="a-card a-fade-up" style={{
      padding: '16px 18px', background: t.surface, border: `1px solid ${t.rule}`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow t={t}>Trajectory · 8 quarters</Eyebrow>
        <div style={{ fontSize: 10.5, color: t.success, fontFamily: APP_FONT_MONO, fontWeight: 700 }}>↗ +18% YoY</div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
        {values.map((v, i) => {
          const h = Math.max(4, (v / max) * 56);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div className="a-bar-grow" style={{
                width: '100%', height: h,
                background: i === values.length - 1
                  ? `linear-gradient(180deg, ${t.tealLight}, ${t.teal})`
                  : i >= values.length - 2
                    ? `linear-gradient(180deg, ${t.teal}, ${t.tealDark})`
                    : t.inkDim,
                borderRadius: 3,
                transformOrigin: 'bottom center',
                animationDelay: `${0.3 + i * 0.06}s`,
              }}></div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
        Q1 2024 → Q4 2025 · TTD per quarter
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Badges section — kiosk-style medals, matches Awards
// ──────────────────────────────────────────────────────────────────────────
function BadgeMedal({ t, badge, size = 56 }) {
  // Unearned badges keep the same coin shape + star icon but render flat —
  // no gradient, no specular highlight, no inset shadows, greyed out — with a
  // small lock badge overlaid in the corner.
  if (!badge.earned) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: t.surfaceMute,
        color: t.inkFaint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${t.rule}`,
        position: 'relative',
      }}>
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="13 2 4 14 11 14 10 22 19 10 12 10 13 2" />
        </svg>
        {/* Lock badge overlay */}
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: size * 0.38, height: size * 0.38, borderRadius: '50%',
          background: t.surface, border: `1.5px solid ${t.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.inkMute,
        }}>
          <svg width={size * 0.2} height={size * 0.2} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
      </div>
    );
  }
  const grad = 'radial-gradient(circle at 32% 28%, ' + (badge.color === '#f59e0b' ? '#fde68a 0%, #f59e0b 50%, #b45309 100%' : '#b9e9eb 0%, #4ab5b8 50%, #016970 100%') + ')';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: grad, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.22), inset 0 2px 4px rgba(255,255,255,0.42), 0 0 12px ${badge.color}44`,
      position: 'relative',
    }}>
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 4 14 11 14 10 22 19 10 12 10 13 2" />
      </svg>
      <span style={{
        position: 'absolute', top: '12%', left: '20%', width: '36%', height: '20%',
        borderRadius: '50%', background: 'rgba(255,255,255,0.42)', filter: 'blur(2.5px)',
      }}></span>
    </div>
  );
}

function BadgesSection({ t, mobile = false }) {
  const earnedCount = BADGES.filter(b => b.earned).length;
  return (
    <div className="a-card" style={{
      padding: '18px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <Eyebrow t={t}>Your collection</Eyebrow>
        <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
          {earnedCount} of {BADGES.length} earned · 14 in catalogue
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 14 }}>
        {BADGES.map((b, i) => (
          <div key={b.id} className={`a-fade-up a-d-${Math.min(i + 1, 8)}`} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <BadgeMedal t={t} badge={b} size={mobile ? 46 : 56} />
            <div style={{
              fontSize: mobile ? 11 : 12, fontWeight: 700, color: b.earned ? t.ink : t.inkFaint,
              letterSpacing: '-0.005em', marginTop: 8,
            }}>{b.name}</div>
            <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 2, lineHeight: 1.3 }}>{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Level drill drawer — criteria + unlocks
// ──────────────────────────────────────────────────────────────────────────
function LevelDrillDetail({ t, level }) {
  const lvl = CAREER_LEVELS.find(l => l.level === level);
  if (!lvl) return null;
  const isNext = level === CAREER_DATA.currentLevel + 1;
  const tagline = LEVEL_TAGLINES[level] || '';
  const unlocks = UNLOCKS[level] || [];

  const criteria = [];
  if (lvl.api !== null)         criteria.push({ label: '2-yr Avg API', current: CAREER_DATA.trailing2YrApi, target: lvl.api, fmt: 'TTD' });
  if (lvl.apps !== null)        criteria.push({ label: 'YTD applications', current: CAREER_DATA.ytdApps, target: lvl.apps, fmt: 'count' });
  if (lvl.persistency !== null) criteria.push({ label: 'Persistency rate', current: CAREER_DATA.persistency, target: lvl.persistency, fmt: '%' });
  criteria.push({ label: 'Years of service', current: CAREER_DATA.yearsOfService, target: lvl.years, fmt: 'years' });

  const fmtV = (v, kind) => {
    if (kind === 'TTD')    return v >= 1000 ? `TTD ${(v / 1000).toFixed(0)}K` : `TTD ${v}`;
    if (kind === '%')      return `${Math.round(v)}%`;
    if (kind === 'years')  return `${v.toFixed(1)} yrs`;
    return String(Math.round(v));
  };

  return (
    <>
      <div style={{ padding: '22px 22px 16px', borderBottom: `1px solid ${t.rule}` }}>
        <Eyebrow t={t} color={isNext ? t.gold : t.teal}>{isNext ? '★ NEXT MILESTONE' : 'FUTURE LEVEL'}</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>
          Level {lvl.level} — {lvl.title}
        </div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 4, lineHeight: 1.5 }}>
          {tagline}
        </div>

        {isNext && (
          <div style={{
            marginTop: 14, padding: '12px 14px', background: t.tealTint,
            border: `1px solid ${t.teal}33`, borderRadius: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>ESTIMATED ARRIVAL</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, marginTop: 4, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em' }}>
              {CAREER_DATA.estimateToNext}
            </div>
            <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4 }}>
              At your current pace · TTD {(CAREER_DATA.weeklyPace / 1000).toFixed(0)}K/week
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px' }}>
        <Eyebrow t={t} color={t.inkMute}>Criteria · {criteria.length} to clear</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {criteria.map((c, i) => {
            const pct = Math.min(100, Math.round((c.current / c.target) * 100));
            const met = c.current >= c.target;
            return (
              <div key={i} style={{
                padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`,
                borderRadius: 9,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: met ? t.success : 'transparent',
                    border: met ? 'none' : `1.5px solid ${t.warning}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {met && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: t.ink }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: met ? t.success : t.warning, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{pct}%</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 10.5, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{fmtV(c.current, c.fmt)}</div>
                  <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{fmtV(c.target, c.fmt)}</div>
                </div>
                <div style={{ height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                  <div className="a-progress-grow" style={{
                    width: `${Math.min(pct, 100)}%`, height: 4,
                    background: met ? t.success : t.warning, borderRadius: 999, transformOrigin: 'left center',
                  }}></div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: 18, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', color: t.gold, fontFamily: APP_FONT_MONO, textTransform: 'uppercase',
        }}>★ What you unlock</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {unlocks.map((u, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: t.goldTint, border: `1px solid ${t.gold}33`,
              borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: `radial-gradient(circle at 32% 28%, #fde68a 0%, #f59e0b 50%, #b45309 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.4)',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>{u.label}</div>
                <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{u.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        padding: '12px 22px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 11.5, color: t.inkMute }}>5 weeks left in this year</div>
        <div style={{
          padding: '8px 14px', background: t.teal, color: '#fff', borderRadius: 8,
          fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          Set commitment <IconArrowR size={12} color="#fff" stroke={2.4} />
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Desktop composed screen
// ──────────────────────────────────────────────────────────────────────────
function CareerPortalV2({ t, drawerLevel = null }) {
  return (
    <AppShell t={t} active="career" title="Career" subtitle={`${CAREER_DATA.agentName} · Level ${CAREER_DATA.currentLevel} · ${CAREER_DATA.currentTitle}`}>
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>

        {/* Two-column: ladder + sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>

          {/* Left — ladder */}
          <CareerLadder
            t={t}
            currentLevel={CAREER_DATA.currentLevel}
            levelDates={CAREER_DATA.levelDates}
            monthsAtCurrent={CAREER_DATA.monthsAtCurrent}
          />

          {/* Right — sidebar stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TimeToNextCard
              t={t}
              currentLevel={CAREER_DATA.currentLevel}
              estimate={CAREER_DATA.estimateToNext}
              weeklyPace={CAREER_DATA.weeklyPace}
            />
            <TrajectoryCard t={t} />
          </div>
        </div>

        {/* Commitment scorecards */}
        <div>
          <Eyebrow t={t}>Your annual commitment</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
            <CommitmentCard t={t} label="Annual API" c={CAREER_DATA.commitment.api}         animClass="a-fade-up a-d-1" />
            <CommitmentCard t={t} label="Applications" c={CAREER_DATA.commitment.apps}      animClass="a-fade-up a-d-2" />
            <CommitmentCard t={t} label="Persistency" c={CAREER_DATA.commitment.persistency} animClass="a-fade-up a-d-3" />
          </div>
        </div>

        {/* Badges */}
        <BadgesSection t={t} />

        {/* Drawer */}
        {drawerLevel !== null && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)',
              animation: 'app-fade-in 280ms ease both', zIndex: 20,
            }}></div>
            <div className="a-card" style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 460, background: t.surface, borderLeft: `1px solid ${t.rule}`,
              boxShadow: t.mode === 'light' ? '-12px 0 32px rgba(40,37,29,0.08)' : '-12px 0 32px rgba(0,0,0,0.5)',
              zIndex: 21, display: 'flex', flexDirection: 'column',
              animation: 'kiosk-slide-r 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            }}>
              <div style={{
                position: 'absolute', top: 16, right: 16, zIndex: 5,
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px 8px 10px',
                background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                borderRadius: 999, cursor: 'pointer',
                color: t.ink, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Close
              </div>
              <LevelDrillDetail t={t} level={drawerLevel} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mobile composed screen
// ──────────────────────────────────────────────────────────────────────────
function CareerPortalV2Mobile({ t, sheetLevel = null }) {
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Career" sub={`LEVEL ${CAREER_DATA.currentLevel} · ${CAREER_DATA.currentTitle.toUpperCase()}`} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Time to next — hero */}
          <TimeToNextCard
            t={t}
            currentLevel={CAREER_DATA.currentLevel}
            estimate={CAREER_DATA.estimateToNext}
            weeklyPace={CAREER_DATA.weeklyPace}
          />

          {/* Ladder */}
          <CareerLadder
            t={t}
            currentLevel={CAREER_DATA.currentLevel}
            levelDates={CAREER_DATA.levelDates}
            monthsAtCurrent={CAREER_DATA.monthsAtCurrent}
          />

          {/* Commitment scorecards — stacked */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, fontFamily: APP_FONT_MONO }}>Your annual commitment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <CommitmentCard t={t} label="Annual API"  c={CAREER_DATA.commitment.api}        animClass="a-fade-up a-d-1" />
              <CommitmentCard t={t} label="Applications" c={CAREER_DATA.commitment.apps}      animClass="a-fade-up a-d-2" />
              <CommitmentCard t={t} label="Persistency"  c={CAREER_DATA.commitment.persistency} animClass="a-fade-up a-d-3" />
            </div>
          </div>

          {/* Trajectory */}
          <TrajectoryCard t={t} />

          {/* Badges — 3-col on mobile */}
          <BadgesSection t={t} mobile />
        </div>
      </MContent>
      <MNav t={t} active="more" />

      {sheetLevel !== null && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 25, animation: 'app-fade-in 240ms ease both' }}></div>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: 660, background: t.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderTop: `1px solid ${t.rule}`,
            boxShadow: '0 -12px 32px rgba(0,0,0,0.25)',
            zIndex: 26, display: 'flex', flexDirection: 'column',
            animation: 'kiosk-rise 320ms cubic-bezier(0.34, 1, 0.64, 1) both',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'relative', padding: '12px 16px 6px' }}>
              <div style={{ width: 40, height: 4, background: t.inkDim, borderRadius: 999, margin: '0 auto' }}></div>
              <div style={{
                position: 'absolute', top: 8, right: 12,
                width: 32, height: 32, borderRadius: '50%',
                background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.ink, cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
            <LevelDrillDetail t={t} level={sheetLevel} />
          </div>
        </>
      )}
    </MFrame>
  );
}

Object.assign(window, { CareerPortalV2, CareerPortalV2Mobile });
