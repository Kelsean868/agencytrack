// Weekly Report Wizard v2 — shared model, panel, chrome bits.
//
// Re-pagination: the repo today has 9 step components grouped into 5 long
// scrolling screens. v2 fans them back out to 12 micro-steps grouped into
// 4 named phases (Activity · Sales · Reflection · Goals). Each step does
// one concept and scrolls minimally on mobile.
//
// "New names added" lives at the end of Activity — the natural bridge:
// what you did this week → the names that came out of it → who you sold to.

const WIZARD_PHASES = [
  { key: 'activity',   label: 'Activity',   stepRange: [1, 5]  },
  { key: 'sales',      label: 'Sales',      stepRange: [6, 8]  },
  { key: 'reflection', label: 'Reflection', stepRange: [9, 10] },
  { key: 'goals',      label: 'Goals',      stepRange: [11, 12]},
];

const WIZARD_STEPS = [
  { n: 1,  phase: 'activity',   title: 'Letters & outreach',        eyebrow: 'Step 1 · Activity' },
  { n: 2,  phase: 'activity',   title: 'Seminars & tradeshows',     eyebrow: 'Step 2 · Activity' },
  { n: 3,  phase: 'activity',   title: 'Calls & face-to-face',      eyebrow: 'Step 3 · Activity' },
  { n: 4,  phase: 'activity',   title: 'Social & content',          eyebrow: 'Step 4 · Activity' },
  { n: 5,  phase: 'activity',   title: 'New names added',           eyebrow: 'Step 5 · Activity' },
  { n: 6,  phase: 'sales',      title: 'Approaches & interviews',   eyebrow: 'Step 6 · Sales' },
  { n: 7,  phase: 'sales',      title: 'New business this week',    eyebrow: 'Step 7 · Sales' },
  { n: 8,  phase: 'sales',      title: 'Delivery & service',        eyebrow: 'Step 8 · Sales' },
  { n: 9,  phase: 'reflection', title: 'Hours worked',              eyebrow: 'Step 9 · Reflection' },
  { n: 10, phase: 'reflection', title: 'Rate your week',            eyebrow: 'Step 10 · Reflection' },
  { n: 11, phase: 'goals',      title: 'Targets for next week',     eyebrow: 'Step 11 · Goals' },
  { n: 12, phase: 'goals',      title: 'Review & submit',           eyebrow: 'Step 12 · Goals' },
];

// Sample "live" working values shown in the mid-step mock.
const WIZARD_SAMPLE = {
  weekLabel: 'Week of Nov 24',
  weekShort: 'WK 48',
  agent: 'Marsha Singh',
  // Production fields entered so far during this session
  newBusinessApps: 2,
  newBusinessLives: 4,
  newBusinessAPI: 18400,
  pppApps: 1,
  pppAPIInc: 6000,
  lumpsumGross: 60000,
  // Activity (from earlier steps)
  totalCalls: 47,
  newNames: 8,
  ciConducted: 4,
  newCIBooked: 3,
  oldCIBooked: 2,
  officeHours: 0,        // not yet entered (phase 3)
  fieldHours: 0,
  // Comm rate
  commissionRate: 7.5,
  // Last week comparisons
  lastWeek: {
    api: 21800, apps: 3, calls: 42, names: 6, ciConv: 67,
  },
  // 6-week API sparkline (oldest → this week, this week excludes mid-edit)
  apiSparkline: [12400, 18900, 15200, 24100, 21800, 0],  // last 0 = this week so far
};

function computeWizardLive(d) {
  const lumpsumCredit = (d.lumpsumGross || 0) * 0.10;
  const lumpsumComm   = (d.lumpsumGross || 0) * 0.005;
  const totalProductionAPI = (d.newBusinessAPI || 0) + (d.pppAPIInc || 0) + lumpsumCredit;
  const totalApps = (d.newBusinessApps || 0) + (d.pppApps || 0);
  const nbComm = (d.newBusinessAPI || 0) * (d.commissionRate / 100);
  const totalComm = nbComm + lumpsumComm;
  // Conversion = CI conducted / apps written (CIs that closed)
  const ciConv = d.ciConducted > 0 ? Math.round(((d.newBusinessApps || 0) / d.ciConducted) * 100) : 0;
  return {
    totalProductionAPI, totalApps, totalComm, ciConv,
    lumpsumCredit, lumpsumComm,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// AutosaveChip — a real, visible trust signal. Animates the check on save.
// Three states: saving / saved / failed. The mock always shows "Saved · 12s".
// ──────────────────────────────────────────────────────────────────────────
function AutosaveChip({ t, state = 'saved', stamp = '12s ago' }) {
  const saved   = state === 'saved';
  const saving  = state === 'saving';
  const failed  = state === 'failed';
  const fg = failed ? t.danger : saved ? t.success : t.inkMute;
  const bg = failed ? t.dangerTint : saved ? t.successTint : t.surfaceSoft;
  const border = failed ? `${t.danger}33` : saved ? `${t.success}44` : t.rule;
  return (
    <div className={saved ? 'a-glow-soft' : ''} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px 6px 10px',
      background: bg, border: `1px solid ${border}`, borderRadius: 999,
      color: fg, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em',
      fontFamily: APP_FONT_SANS,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%',
        background: saved ? t.success : failed ? t.danger : 'transparent',
        border: saving ? `2px solid ${t.inkMute}` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {saved && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {failed && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18" />
            <line x1="6"  y1="6"  x2="18" y2="18" />
          </svg>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span style={{ fontSize: 11.5, color: fg }}>
          {saved && 'Saved'}
          {saving && 'Saving\u2026'}
          {failed && 'Save failed'}
        </span>
        <span style={{ fontSize: 9.5, color: t.inkFaint, fontWeight: 600, letterSpacing: '0.06em', fontFamily: APP_FONT_MONO, marginTop: 1 }}>
          {saved && stamp}
          {saving && 'autosave'}
          {failed && 'tap to retry'}
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PhaseProgress — 11 dot bar grouped into 4 named phases. Current step is
// a filled teal pill, past are filled teal dots, future are empty.
// ──────────────────────────────────────────────────────────────────────────
function PhaseProgress({ t, currentStep = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {/* Phase labels row */}
      <div style={{ display: 'flex', gap: 6 }}>
        {WIZARD_PHASES.map(ph => {
          const [a, b] = ph.stepRange;
          const isActive = currentStep >= a && currentStep <= b;
          const isPast = currentStep > b;
          const width = (b - a + 1);
          return (
            <div key={ph.key} style={{ flex: width, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                color: isActive ? t.teal : isPast ? t.success : t.inkFaint,
                fontFamily: APP_FONT_MONO, textTransform: 'uppercase',
              }}>{ph.label}</span>
              {isActive && (
                <span style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
                  · {currentStep - a + 1}/{width}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Step bar */}
      <div style={{ display: 'flex', gap: 6 }}>
        {WIZARD_PHASES.map(ph => {
          const [a, b] = ph.stepRange;
          const width = b - a + 1;
          return (
            <div key={ph.key} style={{ flex: width, display: 'flex', gap: 3 }}>
              {Array.from({ length: width }).map((_, i) => {
                const n = a + i;
                const isCurrent = n === currentStep;
                const isPast = n < currentStep;
                return (
                  <div key={n} className={isCurrent ? 'a-progress-grow' : ''} style={{
                    flex: isCurrent ? 1.6 : 1,
                    height: 4, borderRadius: 999,
                    background: isCurrent
                      ? `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`
                      : isPast ? t.teal : t.surfaceMute,
                    transformOrigin: 'left center',
                  }}></div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// MiniSparkline — 6-week trend, last bar marked "now". Used in side panel.
// ──────────────────────────────────────────────────────────────────────────
function MiniSparkline({ t, values, currentLive, w = 140, h = 36 }) {
  const data = [...values];
  if (currentLive !== undefined) data[data.length - 1] = currentLive;
  const max = Math.max(...data, 1);
  const bw = (w - 5 * 4) / 6; // 5 gaps of 4
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const isLast = i === data.length - 1;
        const bh = Math.max(2, (v / max) * (h - 4));
        return (
          <rect key={i}
            x={i * (bw + 4)} y={h - bh}
            width={bw} height={bh}
            rx={2}
            fill={isLast ? t.gold : t.teal}
            opacity={isLast ? 1 : 0.55 + i * 0.08}
          />
        );
      })}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// WeekSoFarPanel — the persistent live sidebar.
// On desktop: right rail, 300 px. On mobile: collapsed bottom strip that
// expands to a sheet (rendered separately in the mobile chrome).
// ──────────────────────────────────────────────────────────────────────────
function WeekSoFarPanel({ t, data, live, variant = 'desktop' }) {
  const wide = variant === 'desktop';
  const delta = (a, b) => {
    if (b == null || b === 0) return null;
    const d = a - b;
    if (d === 0) return null;
    return d > 0 ? `+${d}` : `${d}`;
  };
  const apiDelta = live.totalProductionAPI - data.lastWeek.api;
  return (
    <div style={{
      width: wide ? 304 : '100%', flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Eyebrow strip */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Eyebrow t={t}>Your week so far</Eyebrow>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>
          {data.weekShort} · LIVE
        </span>
      </div>

      {/* Hero card: production API + commission */}
      <div className="a-card a-rise" style={{
        position: 'relative', overflow: 'hidden',
        padding: '16px 16px 14px',
        background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14,
      }}>
        <div className="a-glow-soft" style={{
          position: 'absolute', top: -60, right: -60, width: 200, height: 200,
          background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}></div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>PRODUCTION API</div>
          <div style={{
            fontSize: 32, fontWeight: 700, color: t.ink,
            letterSpacing: '-0.024em', fontFamily: APP_FONT_DISPLAY,
            lineHeight: 1, marginTop: 8,
          }}>{ttd(live.totalProductionAPI)}</div>
          {apiDelta !== 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <span style={{
                padding: '2px 7px', borderRadius: 999,
                background: apiDelta > 0 ? t.successTint : t.warningTint,
                color: apiDelta > 0 ? t.success : t.warning,
                fontSize: 10, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em',
              }}>{apiDelta > 0 ? '▲' : '▼'} {ttd(Math.abs(apiDelta))}</span>
              <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>vs last wk</span>
            </div>
          )}
          {/* Sparkline */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <MiniSparkline t={t} values={data.apiSparkline} currentLive={live.totalProductionAPI} w={148} h={36} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.1em' }}>EST. COMM</div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: t.teal,
                fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em',
                marginTop: 2, lineHeight: 1,
              }}>{ttd(live.totalComm)}</div>
              <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 2 }}>{data.commissionRate}% rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2x2 mini-scorecards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { eye: 'APPS',  value: live.totalApps,       sub: `${data.newBusinessApps} NB · ${data.pppApps} PPP`, delta: delta(live.totalApps, data.lastWeek.apps), tone: 'gold' },
          { eye: 'CONV.', value: `${live.ciConv}%`,    sub: `${data.newBusinessApps} of ${data.ciConducted} CIs`,    delta: delta(live.ciConv, data.lastWeek.ciConv) ? `${delta(live.ciConv, data.lastWeek.ciConv)}pp` : null, tone: 'teal' },
          { eye: 'CALLS', value: data.totalCalls,      sub: 'Ref · F-up · Cold',                          delta: delta(data.totalCalls, data.lastWeek.calls), tone: 'ink' },
          { eye: 'NAMES', value: data.newNames,        sub: 'New prospects',                                          delta: delta(data.newNames, data.lastWeek.names), tone: 'ink' },
        ].map((k, i) => {
          const accent = k.tone === 'gold' ? t.gold : k.tone === 'teal' ? t.teal : t.ink;
          const positive = k.delta && k.delta.startsWith('+');
          return (
            <div key={i} className={`a-fade-up a-d-${i + 1}`} style={{
              padding: '11px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{k.eye}</div>
                {k.delta && (
                  <div style={{
                    padding: '1px 5px', borderRadius: 999,
                    background: positive ? t.successTint : t.warningTint,
                    color: positive ? t.success : t.warning,
                    fontSize: 8.5, fontWeight: 700, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em',
                  }}>{k.delta}</div>
                )}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700, color: t.ink,
                letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY,
                lineHeight: 1, marginTop: 7,
              }}>{k.value}</div>
              <div style={{ fontSize: 10, color: t.inkMute, marginTop: 4, lineHeight: 1.3, letterSpacing: '0.005em' }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Tiny "still to enter" hint */}
      <div style={{
        padding: '10px 12px', background: t.surfaceSoft, border: `1px dashed ${t.ruleStrong}`, borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <IconClock size={13} color={t.inkMute} stroke={2} />
        <div style={{ flex: 1, fontSize: 10.5, color: t.inkMute, lineHeight: 1.4 }}>
          Hours, ratings, and next-week goals coming up in <span style={{ color: t.ink, fontWeight: 700 }}>5 more steps</span>.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Form input atoms — match the existing v2 tone (compact, calm, mono labels)
// ──────────────────────────────────────────────────────────────────────────
function NumField({ t, label, value, hint, lastWeek, focused, suggested, big, suffix }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: focused ? t.surface : t.surface,
      border: `1px solid ${focused ? t.teal : t.rule}`,
      borderRadius: 11,
      boxShadow: focused ? `0 0 0 3px ${t.tealTint}` : 'none',
      transition: 'box-shadow 180ms ease, border-color 180ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, letterSpacing: '-0.005em' }}>{label}</div>
          {hint && <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 3, lineHeight: 1.35 }}>{hint}</div>}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: big ? 22 : 18, fontWeight: 700, color: value > 0 ? t.ink : t.inkFaint,
              fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.018em', lineHeight: 1,
            }}>{value || 0}</span>
            {suffix && <span style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{suffix}</span>}
          </div>
          {lastWeek !== undefined && (
            <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 4, letterSpacing: '0.06em' }}>
              LAST WK · {lastWeek}
            </div>
          )}
          {suggested !== undefined && (
            <div style={{
              fontSize: 9, color: t.teal, fontFamily: APP_FONT_MONO, marginTop: 4, letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: t.teal }}></span>
              SUGGESTED {suggested}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CurrencyField({ t, label, hint, value, lastWeek, focused, big = true }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: t.surface,
      border: `1px solid ${focused ? t.teal : t.rule}`,
      borderRadius: 12,
      boxShadow: focused ? `0 0 0 3px ${t.tealTint}` : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{label}</div>
          {hint && <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 3 }}>{hint}</div>}
        </div>
        {lastWeek !== undefined && (
          <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
            LAST WK · {ttd(lastWeek)}
          </div>
        )}
      </div>
      <div style={{
        marginTop: 10,
        display: 'flex', alignItems: 'baseline', gap: 8,
      }}>
        <span style={{
          fontSize: big ? 30 : 22, fontWeight: 700, color: value > 0 ? t.teal : t.inkFaint,
          fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.026em', lineHeight: 1,
        }}>{value > 0 ? ttd(value) : 'TTD 0'}</span>
        {focused && (
          <span style={{
            display: 'inline-block', width: 2, height: big ? 30 : 22,
            background: t.teal, animation: 'app-glow-soft 1.1s ease-in-out infinite',
            marginLeft: 2,
          }}></span>
        )}
      </div>
    </div>
  );
}

// Wizard chrome eyebrow (e.g. "Step 6 · Sales")
function StepTitle({ t, eyebrow, title, sub }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>{eyebrow}</div>
      <div style={{
        fontSize: 26, fontWeight: 700, color: t.ink,
        letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY,
        marginTop: 6, lineHeight: 1.1,
      }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: t.inkMute, marginTop: 6, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

Object.assign(window, {
  WIZARD_PHASES, WIZARD_STEPS, WIZARD_SAMPLE,
  computeWizardLive,
  AutosaveChip, PhaseProgress, MiniSparkline, WeekSoFarPanel,
  NumField, CurrencyField, StepTitle,
});
