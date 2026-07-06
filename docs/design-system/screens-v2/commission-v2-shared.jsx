// Commission v2 — shared bits.
//
// "Commission" sidebar entry today opens a wrapper that nests a collapsible
// "Commission Playground" card. v2 promotes it to a real top-level page with
// two redesigned tabs:
//
//   1) Goal Decomposition — annual income goal → activity ladder (income →
//      API → apps → CIs → dials → prospects), grounded by the agent's real
//      run-rate so the playground answers "close this gap".
//   2) Modal Targeting — monthly $ target + mode mix → API required, with a
//      stacked-by-mode cash-flow forecast across the next 12 months.

// ──────────────────────────────────────────────────────────────────────────
// Math — same formulas as the repo's commissionMath.js, transcribed for
// the design environment. Annual = 1.0 first-payment ratio, Monthly = 1/12.
// ──────────────────────────────────────────────────────────────────────────
const COMM_FIRST_PAYMENT_RATIO = {
  annual:     1.0,
  semiAnnual: 0.5,
  quarterly:  0.25,
  monthly:    1 / 12,
};
const COMM_MODES = ['annual', 'semiAnnual', 'quarterly', 'monthly'];
const COMM_MODE_LABEL  = { annual: 'Annual', semiAnnual: 'Semi-Annual', quarterly: 'Quarterly', monthly: 'Monthly' };
const COMM_MODE_SHORT  = { annual: 'ANN', semiAnnual: 'SEMI', quarterly: 'QTR', monthly: 'MO' };

function commWeightedRatioSum(mix) {
  return COMM_MODES.reduce((s, m) => s + (mix[m] || 0) * COMM_FIRST_PAYMENT_RATIO[m], 0);
}
function commReverseCalc({ targetCommission, mix, rate }) {
  const C = rate / 100;
  const w = commWeightedRatioSum(mix);
  if (C === 0 || w === 0) return 0;
  return targetCommission / (C * w);
}
function commModeBreakdown({ totalApi, mix, rate }) {
  const C = rate / 100;
  return COMM_MODES.map((mode) => {
    const weight = mix[mode] || 0;
    const modeApi = totalApi * weight;
    return {
      mode, weight, modeApi,
      commission: modeApi * C * COMM_FIRST_PAYMENT_RATIO[mode],
    };
  });
}
function commCashFlow({ totalApi, mix, rate }) {
  const C = rate / 100;
  const months = Array(12).fill(null).map(() => ({ annual: 0, semiAnnual: 0, quarterly: 0, monthly: 0 }));
  const a = totalApi * (mix.annual     || 0) * C;
  const s = totalApi * (mix.semiAnnual || 0) * C;
  const q = totalApi * (mix.quarterly  || 0) * C;
  const m = totalApi * (mix.monthly    || 0) * C;
  months[0].annual += a;
  months[0].semiAnnual += s * 0.5;
  months[6].semiAnnual += s * 0.5;
  [0, 3, 6, 9].forEach(i => { months[i].quarterly += q * 0.25; });
  for (let i = 0; i < 12; i++) months[i].monthly += m / 12;
  return months.map((row, i) => ({
    month: i + 1,
    annual: row.annual, semiAnnual: row.semiAnnual,
    quarterly: row.quarterly, monthly: row.monthly,
    total: row.annual + row.semiAnnual + row.quarterly + row.monthly,
  }));
}

// Goal-decomp chain: produces the 7-stage ladder.
function commDecompose(inp) {
  const {
    incomeGoal, taxRate, renewalIncome, settlementRate,
    commissionRate, avgPolicyAPI, persistencyRate,
    ciToSaleRatio, dialsToCIRatio, prospectRatio,
  } = inp;
  const preTax       = taxRate < 100 ? incomeGoal / (1 - taxRate / 100) : 0;
  const firstYrComm  = Math.max(0, preTax - renewalIncome);
  const adjusted     = persistencyRate > 0 ? firstYrComm / (persistencyRate / 100) : 0;
  const apiToWrite   = commissionRate > 0 ? adjusted / (commissionRate / 100) : 0;
  const apiToSettle  = apiToWrite * (settlementRate / 100);
  const apps         = avgPolicyAPI > 0 ? apiToWrite / avgPolicyAPI : 0;
  const cis          = apps * ciToSaleRatio;
  const dials        = cis * dialsToCIRatio;
  const prospects    = dials * prospectRatio;
  return { incomeGoal, preTax, firstYrComm, adjusted, apiToWrite, apiToSettle, apps, cis, dials, prospects };
}

const COMM_CADENCES = [
  { key: 'annual',    label: 'Annual',  short: 'YR',  div: 1   },
  { key: 'semi',      label: 'Semi',    short: '6MO', div: 2   },
  { key: 'quarterly', label: 'Quarter', short: 'QTR', div: 4   },
  { key: 'monthly',   label: 'Month',   short: 'MO',  div: 10  },
  { key: 'weekly',    label: 'Week',    short: 'WK',  div: 43  },
  { key: 'daily',     label: 'Day',     short: 'DAY', div: 215 },
];

// Sample working state.
const COMM_SAMPLE = {
  agent: 'Marsha Singh',
  weekShort: 'WK 48',
  year: 2026,
  // Goal-decomp inputs
  decomp: {
    incomeGoal:      300000,
    taxRate:         25,
    renewalIncome:   50000,
    settlementRate:  90,
    commissionRate:  35,
    avgPolicyAPI:    12000,
    persistencyRate: 90,
    ciToSaleRatio:   2.0,
    dialsToCIRatio:  2.5,
    prospectRatio:   2.0,
  },
  // Modal-targeting inputs
  modal: {
    targetCommission: 25000,
    commissionRate:   35,
    mix: { annual: 0.40, semiAnnual: 0.25, quarterly: 0.20, monthly: 0.15 },
  },
  // Real-world anchor — pulled from the agent's recent activity
  anchor: {
    ytdComm: 175000,
    projComm: 245000,
    goalComm: 300000,
    persistency4w: 92,
    weeksRemaining: 4,
    historyWeeks: 11,    // ≥8 needed for auto-populated activity ratios
  },
  saved: ['Coach goal', 'My commitment', 'Stretch'],   // pretend scenarios
  // Manager-perspective overlay — when manager views agent's playground
  manager: {
    name: 'T. Ramcharan',
    role: 'Unit Manager',
    suggestedIncomeGoal: 350000,
    note: 'You\'re on the edge of MDRT. I think a stretch into TTD 350K is realistic given your pipeline.',
  },
};

// Format helpers — extend ttd for compact display in tiny cells
function ttdCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000)    return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}
function ttdWith(n) { return `TTD ${ttdCompact(n)}`; }
function fmtNum(n) { return Math.round(n).toLocaleString(); }

// ──────────────────────────────────────────────────────────────────────────
// Atoms
// ──────────────────────────────────────────────────────────────────────────

// Compact assumption input row — label, value, optional unit, optional badge
function AssumeRow({ t, label, value, unit, badge, focused, hint, prefix }) {
  return (
    <div style={{
      padding: '9px 12px',
      background: focused ? t.surface : t.surfaceSoft,
      border: `1px solid ${focused ? t.teal : t.rule}`,
      borderRadius: 9,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: focused ? `0 0 0 3px ${t.tealTint}` : 'none',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, color: t.ink, fontWeight: 600 }}>{label}</span>
          {badge && (
            <span style={{
              padding: '1px 6px', borderRadius: 999,
              background: t.tealTint, color: t.teal,
              fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em',
              fontFamily: APP_FONT_MONO,
            }}>{badge}</span>
          )}
        </div>
        {hint && <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 2, lineHeight: 1.35 }}>{hint}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
        {prefix && <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>{prefix}</span>}
        <span style={{
          fontSize: 14, fontWeight: 700, color: t.ink,
          fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', lineHeight: 1,
        }}>{value}</span>
        {unit && <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

function AssumeGroup({ t, label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow t={t} color={t.inkMute}>{label}</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );
}

// Tab pills — matches the repo's pattern but more polished
function CommTabPills({ t, active = 'goal' }) {
  const tabs = [
    { key: 'goal',  label: 'Goal decomposition', sub: 'Income → daily activity' },
    { key: 'modal', label: 'Modal targeting',    sub: 'Monthly $ → API + mix' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      background: t.surfaceSoft, border: `1px solid ${t.rule}`,
      borderRadius: 11, alignSelf: 'flex-start',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.key;
        return (
          <div key={tab.key} style={{
            padding: '8px 14px', borderRadius: 8,
            background: isActive ? t.surface : 'transparent',
            border: isActive ? `1px solid ${t.rule}` : '1px solid transparent',
            boxShadow: isActive ? '0 1px 2px rgba(40,37,29,0.05)' : 'none',
            display: 'flex', flexDirection: 'column', gap: 1,
            cursor: 'pointer',
          }}>
            <span style={{
              fontSize: 12.5, fontWeight: 700,
              color: isActive ? t.ink : t.inkMute,
              letterSpacing: '-0.005em',
            }}>{tab.label}</span>
            <span style={{
              fontSize: 9.5, color: isActive ? t.inkMute : t.inkFaint,
              fontFamily: APP_FONT_MONO, letterSpacing: '0.06em',
            }}>{tab.sub}</span>
          </div>
        );
      })}
    </div>
  );
}

// Cadence selector — chips. Used at the head of the activity ladder.
function CadenceChips({ t, active = 'annual', compact = false }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
      {COMM_CADENCES.map(c => {
        const isActive = c.key === active;
        return (
          <div key={c.key} style={{
            padding: compact ? '5px 8px' : '6px 12px',
            borderRadius: 6,
            fontSize: compact ? 10 : 11, fontWeight: 700,
            color: isActive ? t.teal : t.inkMute,
            background: isActive ? t.surface : 'transparent',
            border: isActive ? `1px solid ${t.teal}33` : '1px solid transparent',
            letterSpacing: '0.005em', whiteSpace: 'nowrap', cursor: 'pointer',
            fontFamily: APP_FONT_SANS,
          }}>{c.label}</div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AnchorStrip — the "your reality" hero at the top of every commission tab.
// Shows YTD earned, projected annual run-rate vs goal, gap, persistency.
// This is the single biggest change vs the repo: the playground is no longer
// a free-floating calculator — it opens already anchored to "what's actually
// happening with your commission this year and how big the gap is to goal".
// ──────────────────────────────────────────────────────────────────────────
function AnchorStrip({ t, anchor, goal, mobile = false }) {
  const gap = goal - anchor.projComm;
  const pct = Math.min(100, Math.round((anchor.projComm / goal) * 100));
  return (
    <div className="a-card a-rise" style={{
      position: 'relative', overflow: 'hidden',
      padding: mobile ? '14px 16px' : '18px 22px',
      flexShrink: 0,
      background: t.surface, border: `1px solid ${t.gold}55`, borderRadius: 14,
      boxShadow: `0 6px 18px ${t.mode === 'light' ? 'rgba(176,125,26,0.08)' : 'rgba(0,0,0,0.4)'}`,
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -70, right: -70, width: 240, height: 240,
        background: `radial-gradient(circle, ${t.goldTint} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }}></div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <Eyebrow t={t} color={t.gold}>YOUR REALITY · {anchor.weeksRemaining} WEEKS LEFT IN {COMM_SAMPLE.year}</Eyebrow>
          <div style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.1, marginTop: 6 }}>
            On pace for <span style={{ color: t.teal }}>{ttdWith(anchor.projComm)}</span> in commission this year
          </div>
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 5, lineHeight: 1.4 }}>
            {ttdWith(anchor.ytdComm)} earned YTD · projected from {anchor.historyWeeks}-week trailing run-rate
          </div>
        </div>
        <div style={{ display: 'flex', gap: mobile ? 10 : 16, alignItems: 'stretch' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: gap > 0 ? t.warning : t.success, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>
              {gap > 0 ? 'GAP TO GOAL' : 'ABOVE GOAL'}
            </div>
            <div style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, color: gap > 0 ? t.warning : t.success, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 6 }}>
              {gap > 0 ? '−' : '+'}{ttdWith(Math.abs(gap))}
            </div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>
              vs {ttdWith(goal)} goal · {pct}%
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ position: 'relative', marginTop: 14, height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
        <div className="a-progress-grow" style={{
          width: `${pct}%`, height: 8,
          background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`,
          borderRadius: 999, transformOrigin: 'left center',
        }}></div>
        {/* Goal marker */}
        <div style={{ position: 'absolute', top: -3, right: 0, bottom: -3, width: 2, background: t.gold, borderRadius: 1 }}></div>
      </div>

      {/* Foot row */}
      {!mobile && (
        <div style={{ position: 'relative', display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'YTD EARNED',     value: ttdWith(anchor.ytdComm), tone: t.teal },
            { label: 'PROJECTED',      value: ttdWith(anchor.projComm), tone: t.ink },
            { label: 'GOAL',           value: ttdWith(goal),           tone: t.gold },
            { label: 'PERSISTENCY 4W', value: `${anchor.persistency4w}%`, tone: t.success },
          ].map((k, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: k.tone, flexShrink: 0 }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.14em' }}>{k.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', marginTop: 2 }}>{k.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  COMM_FIRST_PAYMENT_RATIO, COMM_MODES, COMM_MODE_LABEL, COMM_MODE_SHORT, COMM_CADENCES,
  commReverseCalc, commModeBreakdown, commCashFlow, commDecompose, commWeightedRatioSum,
  COMM_SAMPLE, ttdCompact, ttdWith, fmtNum,
  AssumeRow, AssumeGroup, CommTabPills, CadenceChips, AnchorStrip,
});
