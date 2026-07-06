// Game Plan v2 (was "Looking Ahead") — shared model, sample data, anchor,
// step rail, and atoms. The planning module that builds an agent's year:
//   Money Needs  →  Year Plan  →  Monthly Plan  →  Review & Commit
// On commit, the plan's annual API/Apps flow into Goals (personalAnnualAPI),
// closing the loop: plan the year → commit it → chase it on the Goals page.
//
// Grounded in the repo's MoneyNeedsPanel + moneyNeedsService:
//   • 5 expense groups (Fixed / Living / Business / Savings / Misc), each
//     line item annualized by frequency (M/Q/S/A).
//   • PAYE gross-up → Required Gross Income → minus renewals → Required
//     1st-Year Commissions (the income goal sent to the Commission decomp).
//   • Product-line commission targets (Life / A&H / Property / Motor).
//   • A share-with-manager visibility toggle → the manager-review hook.

// ──────────────────────────────────────────────────────────────────────────
// Sample plan — Marsha Singh, 2026, in draft. Numbers reconcile with the
// Goals work: Required 1st-Year Commissions = TTD 300K → decomposes to a
// TTD 600K API commitment, split across product lines, broken into months.
// ──────────────────────────────────────────────────────────────────────────
const PLAN_SAMPLE = {
  agent: 'Marsha Singh',
  year: 2026,
  today: 'THU · 26 NOV',
  status: 'draft',          // 'draft' | 'committed'
  completeness: 75,         // % of the plan built out

  // ── Step 1 · Money Needs ──────────────────────────────────────────────
  // Line items are the real worksheet's standard set, PRE-SEEDED so agents
  // edit amounts into a familiar checklist instead of naming everything from
  // a blank page. Each item: { label, amount, freq } where freq ∈ M/Q/S/A.
  money: {
    afterTaxNeed: 264000,
    paye:         66000,
    grossNeed:    330000,
    renewals:     30000,
    commissionNeed: 300000,   // Required 1st-Year Commissions → income goal
    shared: true,             // visible to Unit + Branch managers
    groups: [
      { key: 'fixed', label: 'Fixed Expenses', tone: 'teal', items: [
        { label: 'Rent or mortgage payments',            amount: 5000, freq: 'M' },
        { label: 'Utilities — gas, light, phone, water', amount: 1500, freq: 'M' },
        { label: 'Disability income insurance',          amount: 300,  freq: 'M' },
        { label: 'Homeowners insurance',                 amount: 200,  freq: 'M' },
        { label: 'Car insurance',                        amount: 700,  freq: 'M' },
        { label: 'Property taxes',                       amount: 100,  freq: 'M' },
        { label: 'Other',                                amount: 200,  freq: 'M' },
      ] },
      { key: 'living', label: 'Living Expenses', tone: 'accent', items: [
        { label: 'Food',                       amount: 2500, freq: 'M' },
        { label: 'Clothing',                   amount: 400,  freq: 'M' },
        { label: 'Laundry, tailoring',         amount: 100,  freq: 'M' },
        { label: 'Entertainment',              amount: 600,  freq: 'M' },
        { label: 'Car expenses, nonbusiness',  amount: 800,  freq: 'M' },
        { label: 'Medical — doctor, dentist',  amount: 400,  freq: 'M' },
        { label: 'Household',                  amount: 800,  freq: 'M' },
        { label: 'Other',                      amount: 400,  freq: 'M' },
      ] },
      { key: 'business', label: 'Business Expenses', tone: 'gold', items: [
        { label: 'Sales promotion, advertising, tuition',  amount: 800, freq: 'M' },
        { label: 'Trade association dues, services, events',amount: 600, freq: 'M' },
        { label: 'Telephone, computer, stationery, postage',amount: 400, freq: 'M' },
        { label: 'Secretarial and banking services',       amount: 300, freq: 'M' },
        { label: 'Business travel, car expense',           amount: 500, freq: 'M' },
        { label: 'Business entertainment',                 amount: 200, freq: 'M' },
        { label: 'Other',                                  amount: 200, freq: 'M' },
      ] },
      { key: 'savings', label: 'Savings & Accumulation', tone: 'success', items: [
        { label: 'Life insurance',                  amount: 1000, freq: 'M' },
        { label: 'Savings account',                 amount: 1200, freq: 'M' },
        { label: 'Debt reduction (not mortgage)',   amount: 500,  freq: 'M' },
        { label: 'Investments',                     amount: 500,  freq: 'M' },
        { label: 'Slush fund',                      amount: 200,  freq: 'M' },
        { label: 'Other',                           amount: 100,  freq: 'M' },
      ] },
      { key: 'misc', label: 'Miscellaneous', tone: 'inkMute', items: [
        { label: 'Donations — religious, charitable', amount: 400, freq: 'M' },
        { label: 'Recreation',                        amount: 300, freq: 'M' },
        { label: 'Club dues',                         amount: 200, freq: 'M' },
        { label: 'Gifts and services',                amount: 200, freq: 'M' },
        { label: 'Vacation',                          amount: 300, freq: 'M' },
        { label: 'Other',                             amount: 100, freq: 'M' },
      ] },
    ],
    // Optional detail calculators (real worksheet side-tables). Pre-seeded too.
    subCalcs: [
      { key: 'industry', label: 'Insurance Industry Expenses', rollsInto: 'Business Expenses', items: [
        { label: 'Life License Renewal',        amount: 1000,  freq: 'A' },
        { label: 'General License Renewal',     amount: 1000,  freq: 'A' },
        { label: 'TTAIFA fees',                 amount: 1250,  freq: 'A' },
        { label: 'TTII Portal Fee',             amount: 500,   freq: 'A' },
        { label: 'CPD classes',                 amount: 900,   freq: 'A' },
        { label: 'TTAIFA Courses (FSCP / etc)', amount: 10500, freq: 'A' },
        { label: 'TTAIFA Congress',             amount: 12000, freq: 'A' },
        { label: 'MDRT membership fee',         amount: 2000,  freq: 'A' },
        { label: 'MDRT Convention',             amount: 15000, freq: 'A' },
        { label: 'Branch Retreats',             amount: 1000,  freq: 'A' },
        { label: 'Other Industry Events',       amount: 1000,  freq: 'A' },
      ] },
      { key: 'car', label: 'Car Expenses', split: '⅓ personal · ⅔ business', items: [
        { label: 'Gas / Petrol / Electric',  amount: 1500, freq: 'M' },
        { label: 'Mechanical Servicing',     amount: 1000, freq: 'Q' },
        { label: 'Insurance',                amount: 9000, freq: 'A' },
        { label: 'Parking fees',             amount: 500,  freq: 'M' },
        { label: 'Tickets',                  amount: 900,  freq: 'A' },
        { label: 'Car wash and maintenance', amount: 240,  freq: 'M' },
        { label: 'Miscellaneous',            amount: 2000, freq: 'A' },
        { label: 'Vehicle Loan',             amount: 3500, freq: 'M' },
      ] },
      { key: 'loans', label: 'Loans / Debt Payments', items: [
        { label: 'Credit Card #1',   amount: 0,    freq: 'M' },
        { label: 'Credit Card #2',   amount: 0,    freq: 'M' },
        { label: 'Car Loan #1',      amount: 3500, freq: 'M' },
        { label: 'Car Loan #2',      amount: 0,    freq: 'M' },
        { label: 'Personal Loan #1', amount: 0,    freq: 'M' },
        { label: 'Personal Loan #2', amount: 0,    freq: 'M' },
        { label: 'Sou-sou #1',       amount: 0,    freq: 'M' },
        { label: 'Sou-sou #2',       amount: 0,    freq: 'M' },
        { label: 'Hire-Purchase',    amount: 0,    freq: 'M' },
        { label: 'Other',            amount: 0,    freq: 'M' },
      ] },
    ],
    // Renewal income deducted before commissions required (by product line).
    renewalLines: [
      { label: 'Life',     amount: 15000 },
      { label: 'Health',   amount: 6000 },
      { label: 'Property', amount: 5000 },
      { label: 'Motor',    amount: 4000 },
    ],
    // First-Year Commission TARGETS by line (= the Year Plan allocation).
    commissionTargets: [
      { label: 'Life',     amount: 180000 },
      { label: 'Health',   amount: 48000 },
      { label: 'Property', amount: 40000 },
      { label: 'Motor',    amount: 32000 },
    ],
  },

  // ── Step 2 · Year Plan ────────────────────────────────────────────────
  yearPlan: {
    commissionTarget: 300000,
    apiTarget: 600000,
    mode: 'percent',          // 'percent' | 'direct'
    profile: 'composite',     // license class — NOT stored on the user yet
    profiles: {
      composite: {
        label: 'Composite', sub: 'Life + General',
        lines: [
          { key: 'life',     label: 'Life',     pct: 60, commission: 180000, api: 360000, cases: 30, avgCase: 12000, tone: 'teal',    award: true  },
          { key: 'health',   label: 'Health',   pct: 17, commission: 48000,  api: 100000, cases: 25, avgCase: 4000,  tone: 'accent',  award: false },
          { key: 'property', label: 'Property', pct: 13, commission: 40000,  api: 80000,  cases: 16, avgCase: 5000,  tone: 'gold',    award: false },
          { key: 'motor',    label: 'Motor',    pct: 10, commission: 32000,  api: 60000,  cases: 20, avgCase: 3000,  tone: 'warning', award: false },
        ],
      },
      life: {
        label: 'Life only', sub: 'Life license',
        lines: [
          { key: 'term',      label: 'Term',             pct: 45, commission: 135000, api: 270000, cases: 22, avgCase: 12000, tone: 'teal',    award: true },
          { key: 'endowment', label: 'Endowment',        pct: 25, commission: 75000,  api: 150000, cases: 15, avgCase: 10000, tone: 'accent',  award: true },
          { key: 'ci',        label: 'Critical Illness', pct: 20, commission: 66000,  api: 120000, cases: 18, avgCase: 6700,  tone: 'gold',    award: true },
          { key: 'annuity',   label: 'Annuities',        pct: 10, commission: 24000,  api: 60000,  cases: 6,  avgCase: 10000, tone: 'warning', award: true },
        ],
      },
      general: {
        label: 'General only', sub: 'General license',
        lines: [
          { key: 'motor',      label: 'Motor',      pct: 40, commission: 96000, api: 240000, cases: 80, avgCase: 3000,  tone: 'teal',    award: false },
          { key: 'property',   label: 'Property',   pct: 30, commission: 84000, api: 180000, cases: 40, avgCase: 4500,  tone: 'accent',  award: false },
          { key: 'commercial', label: 'Commercial', pct: 20, commission: 72000, api: 120000, cases: 12, avgCase: 10000, tone: 'gold',    award: false },
          { key: 'health',     label: 'Health',     pct: 10, commission: 48000, api: 60000,  cases: 15, avgCase: 4000,  tone: 'warning', award: false },
        ],
      },
    },
  },

  // ── Step 3 · Monthly Plan ─────────────────────────────────────────────
  monthly: {
    apiTarget: 600000,
    currentMonth: 'NOV',
    // production-year shaped; actuals run Jan→Nov (Nov partial, day 26/30)
    months: [
      { m: 'JAN', target: 42000, actual: 36000 },
      { m: 'FEB', target: 44000, actual: 40000 },
      { m: 'MAR', target: 50000, actual: 48000 },
      { m: 'APR', target: 48000, actual: 42000 },
      { m: 'MAY', target: 52000, actual: 46000 },
      { m: 'JUN', target: 56000, actual: 55000 },
      { m: 'JUL', target: 50000, actual: 43000 },
      { m: 'AUG', target: 44000, actual: 38000 },
      { m: 'SEP', target: 52000, actual: 50000 },
      { m: 'OCT', target: 56000, actual: 58000 },
      { m: 'NOV', target: 56000, actual: 31000, partial: true, daysPct: 0.87 },
      { m: 'DEC', target: 50000, actual: 0, future: true },
    ],
    suggestions: [
      'Book 2 more FFIs this week',
      'TTD 25K to clear the Nov target',
      'Convert the 3 open Persaud quotes',
    ],
  },

  // ── Link out ──────────────────────────────────────────────────────────
  goalsCommitment: { api: 600000, apps: 50 },
  manager: { name: 'T. Ramcharan', role: 'Unit Manager' },
};

// Backward-compat alias: hub + anchor read the composite split by default.
PLAN_SAMPLE.yearPlan.lines = PLAN_SAMPLE.yearPlan.profiles.composite.lines;

// Steps shown in the rail. Self-Improvement deferred (folded into Goals' growth strip).
const PLAN_STEPS = [
  { key: 'money',   n: 1, label: 'Money Needs',   sub: 'What you need to earn',     active: 'money',     state: 'done'    },
  { key: 'year',    n: 2, label: 'Year Plan',     sub: 'Split it across lines',     active: 'lookahead', state: 'active'  },
  { key: 'monthly', n: 3, label: 'Monthly Plan',  sub: 'Break it into months',      active: 'lookahead', state: 'todo'    },
  { key: 'commit',  n: 4, label: 'Review & Commit',sub: 'Lock it → your Goals',     active: 'lookahead', state: 'todo'    },
];

const FREQ_LABEL = { M: '/mo', Q: '/qtr', S: '/6mo', A: '/yr' };
const FREQ_MULT  = { M: 12, Q: 4, S: 2, A: 1 };
const FREQ_NAME  = { M: 'Monthly', Q: 'Quarterly', S: 'Semi-Annual', A: 'Annually' };
function annualize(amount, freq) { return (parseFloat(amount) || 0) * (FREQ_MULT[freq] || 12); }
function groupAnnual(items) { return items.reduce((s, i) => s + annualize(i.amount, i.freq), 0); }
function filledCount(items) { return items.filter((i) => (parseFloat(i.amount) || 0) > 0).length; }

// ── Format helpers ──────────────────────────────────────────────────────────
function pK(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000)    return `${Math.round(n / 1000)}K`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}
function pTtd(n) { return `TTD ${pK(n)}`; }
function pNum(n) { return Math.round(n).toLocaleString(); }
function toneColor(t, key) {
  return ({ teal: t.teal, accent: t.inkAccent, gold: t.gold, warning: t.warning, success: t.success, inkMute: t.inkMute }[key]) || t.teal;
}

// ──────────────────────────────────────────────────────────────────────────
// PlanAnchorStrip — "your reality" for planning. Leads with the income need
// (the number the whole plan exists to hit) and pairs it with plan
// completeness + draft/committed status. Teal-bordered; gold accents the
// commission target.
// ──────────────────────────────────────────────────────────────────────────
function PlanAnchorStrip({ t, data, mobile = false, managerView = false }) {
  const committed = data.status === 'committed';
  return (
    <div className="a-card a-rise" style={{
      position: 'relative', overflow: 'hidden',
      padding: mobile ? '14px 16px' : '18px 22px', flexShrink: 0,
      background: t.surface, border: `1px solid ${committed ? t.teal + '55' : t.warning + '55'}`, borderRadius: 14,
      boxShadow: `0 6px 18px ${t.mode === 'light' ? 'rgba(1,105,111,0.08)' : 'rgba(0,0,0,0.4)'}`,
    }}>
      <div className="a-glow-soft" style={{
        position: 'absolute', top: -70, right: -70, width: 240, height: 240,
        background: `radial-gradient(circle, ${committed ? t.tealTint : t.warningTint} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }}></div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eyebrow t={t} color={committed ? t.teal : t.warning}>
              {managerView ? `${data.agent.toUpperCase()}'S ${data.year} PLAN` : `YOUR ${data.year} PLAN`}
            </Eyebrow>
            <span style={{
              padding: '2px 9px', borderRadius: 999, fontSize: 8.5, fontWeight: 700,
              letterSpacing: '0.1em', fontFamily: APP_FONT_MONO,
              color: committed ? t.success : t.warning, background: committed ? t.successTint : t.warningTint,
            }}>{committed ? '✓ COMMITTED' : 'DRAFT'}</span>
          </div>
          <div style={{
            fontSize: mobile ? 17 : 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em',
            fontFamily: APP_FONT_DISPLAY, lineHeight: 1.15, marginTop: 8,
          }}>
            Earn <span style={{ color: t.gold }}>{pTtd(data.money.commissionNeed)}</span> in commission to cover your year
          </div>
          <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 5, lineHeight: 1.45, maxWidth: 460 }}>
            {pTtd(data.money.grossNeed)} gross need, {pTtd(data.money.renewals)} from your renewal book — leaving {pTtd(data.money.commissionNeed)} to earn, a <b style={{ color: t.ink }}>{pTtd(data.yearPlan.apiTarget)} API</b> commitment.
          </div>
        </div>
        {!mobile && (
          <div style={{ textAlign: 'right', minWidth: 132 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>PLAN BUILT</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 6 }}>{data.completeness}%</div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 5, fontFamily: APP_FONT_MONO }}>3 of 4 steps</div>
          </div>
        )}
      </div>

      {/* Foot chips */}
      {!mobile && (
        <div style={{ position: 'relative', display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'AFTER-TAX NEED', value: pTtd(data.money.afterTaxNeed), tone: t.ink },
            { label: 'RENEWALS COVER', value: pTtd(data.money.renewals),     tone: t.success },
            { label: 'COMMISSION NEED',value: pTtd(data.money.commissionNeed), tone: t.gold },
            { label: 'API COMMITMENT', value: pTtd(data.yearPlan.apiTarget),  tone: t.teal },
          ].map((k, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: k.tone, flexShrink: 0 }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.12em' }}>{k.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.012em', marginTop: 2 }}>{k.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// StepRail — the 4 planning steps as jump-able cards. `current` highlights
// the step the page is on; done steps get a check, todo steps are muted.
// ──────────────────────────────────────────────────────────────────────────
function StepRail({ t, current = 'year', mobile = false, onChain = false, doneKeys = null }) {
  return (
    <div style={{ display: mobile ? 'flex' : 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 8 : 10 }}>
      {PLAN_STEPS.map((s, i) => {
        const isCurrent = s.key === current;
        const done = doneKeys ? doneKeys.includes(s.key) : s.state === 'done';
        const todo = !done && !isCurrent;
        const accent = isCurrent ? t.teal : done ? t.success : t.inkFaint;
        return (
          <React.Fragment key={s.key}>
            <div className={`a-card a-d-${i + 1}`} style={{
              flex: 1, minWidth: 0, flexShrink: 0,
              padding: mobile ? '11px 13px' : '12px 14px',
              background: isCurrent ? t.tealTint : t.surface,
              border: `1px solid ${isCurrent ? t.teal + '66' : t.rule}`,
              borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11,
              opacity: todo ? 0.72 : 1,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: done ? t.success : isCurrent ? t.teal : t.surfaceMute,
                color: (done || isCurrent) ? '#fff' : t.inkMute,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, fontFamily: APP_FONT_DISPLAY,
                boxShadow: isCurrent ? `0 0 0 3px ${t.tealTint}` : 'none',
              }}>
                {done ? <IconCheck size={14} color="#fff" stroke={2.6} /> : s.n}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: accent, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>
                  {done ? 'DONE' : isCurrent ? 'CURRENT' : `STEP ${s.n}`}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em', marginTop: 2 }}>{s.label}</div>
                <div style={{ fontSize: 9.5, color: t.inkFaint, marginTop: 1 }}>{s.sub}</div>
              </div>
            </div>
            {onChain && i < PLAN_STEPS.length - 1 && !mobile && (
              <div style={{ display: 'flex', alignItems: 'center', color: t.inkDim, flexShrink: 0 }}>
                <IconChevR size={15} color={t.inkFaint} stroke={2} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── SectionHead (planning) ──────────────────────────────────────────────────
function PlanSectionHead({ t, title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{title}</div>
        {sub && <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.03em' }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ── PlanManagerBanner — gold "you're reviewing a shared plan" clarifier ─────
function PlanManagerBanner({ t, data }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      background: t.goldTint, border: `1px solid ${t.gold}55`, borderRadius: 11, flexShrink: 0,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: t.gold, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0,
      }}>TR</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>
          {data.agent.split(' ')[0]} shared her plan with you — your notes here are a <span style={{ color: t.gold }}>suggestion</span>, she still commits it herself.
        </div>
        <div style={{ fontSize: 10, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO, letterSpacing: '0.06em' }}>
          MANAGER VIEW · {data.manager.name.toUpperCase()} · {data.manager.role.toUpperCase()}
        </div>
      </div>
      <div style={{
        padding: '6px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 999,
        color: t.inkMute, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        EXIT VIEW
      </div>
    </div>
  );
}

Object.assign(window, {
  PLAN_SAMPLE, PLAN_STEPS, FREQ_LABEL, FREQ_MULT, FREQ_NAME,
  annualize, groupAnnual, filledCount,
  pK, pTtd, pNum, toneColor,
  PlanAnchorStrip, StepRail, PlanSectionHead, PlanManagerBanner,
});
