// Money Needs — merged allocator prototype. Money Needs (budget → required
// first-year commission) and the Year-Plan allocator folded onto ONE surface.
// The seam is the deliberate handoff: "your required commission" → "how you'll
// write it" (license-aware API lines, slider + direct entry). Phase 2 drills a
// Life line into its 4 products. Nexus tokens via CSS vars (see the HTML shell).

const { useState, useMemo } = React;

// ── Lucide icons (inline paths, stroke=currentColor) ───────────────────────
const P = {
  wallet: ['rect:3,6,18,13,2', 'M3 10h18', 'M16 14h2'],
  seam: ['M4 4v7a4 4 0 0 0 4 4h12', 'm15 10 5 5-5 5'],
  sliders: ['M21 4H14', 'M10 4H3', 'M21 12H12', 'M8 12H3', 'M21 20H16', 'M12 20H3', 'c:14,4,2', 'c:8,12,2', 'c:16,20,2'],
  target: ['c:12,12,10', 'c:12,12,6', 'c:12,12,2'],
  scale: ['m16 16 3-8 3 8c-2 1.5-4 1.5-6 0', 'm2 16 3-8 3 8c-2 1.5-4 1.5-6 0', 'M7 21h10', 'M12 3v18', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2'],
  layers: ['m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z', 'm6.08 9.5-3.48 1.59a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59', 'm6.08 14.5-3.48 1.59a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59'],
  award: ['c:12,8,6', 'M15.48 12.89 17 22l-5-3-5 3 1.52-9.11'],
  badgeCheck: ['M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z', 'm9 12 2 2 4-4'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z', 'M12 9v4', 'M12 17h.01'],
  info: ['c:12,12,10', 'M12 16v-4', 'M12 8h.01'],
  lock: ['rect:3,11,18,11,2', 'M7 11V7a5 5 0 0 1 10 0v4'],
  chevronDown: ['m6 9 6 6 6-6'],
  pencil: ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497Z', 'm15 5 4 4'],
  chevronRight: ['m9 18 6-6-6-6'],
  check: ['M20 6 9 17l-5-5'],
  plus: ['M5 12h14', 'M12 5v14'],
  sun: ['c:12,12,4', 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  monitor: ['rect:2,3,20,14,2', 'M8 21h8', 'M12 17v4'],
  smartphone: ['rect:5,2,14,20,2', 'M12 18h.01'],
  rotate: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
};
function Icon({ name, size = 18, color = 'currentColor', stroke = 2, style }) {
  const parts = P[name] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {parts.map((d, i) => {
        if (d.startsWith('c:')) { const [x, y, r] = d.slice(2).split(','); return <circle key={i} cx={x} cy={y} r={r} />; }
        if (d.startsWith('rect:')) { const [x, y, w, h, rx] = d.slice(5).split(','); return <rect key={i} x={x} y={y} width={w} height={h} rx={rx} />; }
        return <path key={i} d={d} />;
      })}
    </svg>
  );
}

const V = (k) => `var(--${k})`;
const ttd = (n) => 'TTD ' + Math.round(n).toLocaleString();
const ttdK = (n) => n >= 1000 ? `TTD ${(n / 1000).toFixed(n % 1000 ? 1 : 0)}K` : ttd(n);

// ── Domain ──────────────────────────────────────────────────────────────────
const TAX = 0.20, AVG_POLICY = 9600;
const LINES = {
  life:    { key: 'life',    label: 'Life',            rate: 0.40, eligible: true,  tone: 'primary', drill: true },
  ah:      { key: 'ah',      label: 'A&H',             rate: 0.20, eligible: false, tone: 'accent', sub: 'Accident & Health' },
  general: { key: 'general', label: 'Motor / Property', rate: 0.125, eligible: false, tone: 'gold', sub: 'General — Motor, Property & more', drill: true },
};
// Default product names per drillable line (user-editable, max 4 each).
// Motor & Property are General-license lines — they live under General, never Life.
const PRODUCT_DEFAULTS = {
  life:    ['Whole Life', 'Annuities', 'Critical Illness', 'Term'],
  general: ['Motor', 'Property', 'Group', 'Commercial'],
};
const MAX_PRODUCTS = 4;
const LICENSE_LINES = {
  life:      ['life', 'ah'],
  general:   ['general', 'ah'],
  composite: ['life', 'ah', 'general'],
};
const LIFE_PRODUCTS = [
  { key: 'wl',   label: 'Whole Life' },
  { key: 'ann',  label: 'Annuities' },
  { key: 'ci',   label: 'Critical Illness' },
  { key: 'term', label: 'Term' },
];
const AWARDS = [
  { name: 'Platinum Club', api: 600_000, top: true },
  { name: 'Gold Club', api: 400_000 },
  { name: 'Silver Club', api: 250_000 },
  { name: 'Bronze Club', api: 150_000 },
];
function awardReading(lifeApi) {
  const asc = [...AWARDS].reverse();
  let reached = null;
  for (const a of asc) if (lifeApi >= a.api) reached = a;
  const next = AWARDS.slice().reverse().find((a) => lifeApi < a.api);
  const top = reached && reached.top;
  return { reached, next: top ? null : next, top, gap: next ? next.api - lifeApi : 0 };
}

// ── Controls ─────────────────────────────────────────────────────────────────
function SliderField({ value, max, step = 5000, onChange, eligible = true, accent = 'primary' }) {
  const clamp = (v) => Math.max(0, Math.min(max, v));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input type="range" min={0} max={max} step={step} value={Math.min(value, max)}
        className={eligible ? 'eligible' : 'neutral'}
        onChange={(e) => onChange(clamp(+e.target.value))}
        style={{ flex: 1, accentColor: eligible ? V(accent) : V('ink-muted') }}
        aria-label="target amount" />
      <div style={{ position: 'relative', width: 120, flexShrink: 0 }}>
        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 700, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>TTD</span>
        <input type="number" value={Math.round(value)} step={step}
          onChange={(e) => onChange(clamp(+e.target.value || 0))}
          style={{ width: '100%', padding: '9px 9px 9px 34px', background: V('surface-muted'), border: `1px solid ${V('border')}`, borderRadius: 9, fontSize: 13, fontWeight: 700, color: V('ink'), textAlign: 'right' }} />
      </div>
    </div>
  );
}

function Pill({ children, fg, bg, icon }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: bg, color: fg, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>{icon}{children}</span>;
}
function Card({ children, style }) {
  return <div style={{ background: V('surface-raised'), border: `1px solid ${V('border')}`, borderRadius: 16, ...style }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: V('ink-faint'), letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>{children}</div>;
}

// ── Budget (Money Needs half — compact) ─────────────────────────────────────
function BudgetCard({ budget, setBudget, required }) {
  const annual = budget.monthly * 12;
  const gross = annual / (1 - TAX);
  const fld = (label, key, val, hint) => (
    <div>
      <Label>{label}</Label>
      <div style={{ position: 'relative', marginTop: 6 }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>TTD</span>
        <input type="number" value={val} step={1000} onChange={(e) => setBudget({ ...budget, [key]: +e.target.value || 0 })}
          style={{ width: '100%', padding: '11px 12px 11px 40px', background: V('surface-muted'), border: `1px solid ${V('border')}`, borderRadius: 10, fontSize: 15, fontWeight: 700, color: V('ink'), textAlign: 'right' }} />
      </div>
      {hint && <div style={{ fontSize: 10, color: V('ink-faint'), marginTop: 4 }}>{hint}</div>}
    </div>
  );
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: `1px solid ${V('border')}` }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: V('primary-tint'), color: V('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="wallet" size={18} color={V('primary')} /></div>
        <div style={{ flex: 1 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: V('ink') }}>Money Needs</div>
          <div style={{ fontSize: 11.5, color: V('ink-muted') }}>Your life budget → the income you must produce</div>
        </div>
        <Pill fg={V('ink-muted')} bg={V('surface-muted')}>STEP 1</Pill>
      </div>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {fld('Monthly life budget', 'monthly', budget.monthly, 'after-tax living need')}
          {fld('Renewal income', 'renewalIncome', budget.renewalIncome, 'existing book, per year')}
        </div>
        {/* the chain, compact */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['Annual budget', ttd(annual), '×12'],
            [`Grossed up for PAYE (${TAX * 100}%)`, ttd(gross), '÷ 0.80'],
            ['Less renewal income', '− ' + ttd(budget.renewalIncome), null],
          ].map(([l, v, tag], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ color: V('ink-muted') }}>{l}</span>
              {tag && <span style={{ fontSize: 9, fontWeight: 700, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace" }}>{tag}</span>}
              <div style={{ flex: 1, borderBottom: `1px dotted ${V('border-strong')}`, margin: '0 2px' }} />
              <span className="font-mono" style={{ fontWeight: 700, color: V('ink') }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── THE SEAM — the deliberate handoff ───────────────────────────────────────
function Seam({ required }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
      <div style={{ width: 2, height: 14, background: V('border-strong') }} />
      <div style={{ width: '100%', background: V('primary'), borderRadius: 16, padding: '18px 22px', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: `0 8px 24px ${V('primary-tint')}` }}>
        <div style={{ position: 'absolute', top: -40, right: -20, opacity: 0.18 }}><Icon name="seam" size={150} color="#fff" stroke={1.2} /></div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', fontFamily: "'JetBrains Mono', monospace", opacity: 0.85 }}>YOUR REQUIRED FIRST-YEAR COMMISSION</div>
            <div className="font-display" style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}>{ttd(required)}</div>
            <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="seam" size={15} color="#fff" /> Now, here's how you'll write it →
            </div>
          </div>
        </div>
      </div>
      <div style={{ width: 2, height: 14, background: V('border-strong') }} />
    </div>
  );
}

// ── Award strip ──────────────────────────────────────────────────────────────
function AwardStrip({ lifeApi }) {
  const r = awardReading(lifeApi);
  return (
    <Card style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Icon name="award" size={16} color={V('gold')} />
        <div className="font-display" style={{ fontSize: 13.5, fontWeight: 700, color: V('ink') }}>Annual awards · Life production only</div>
        <div style={{ flex: 1 }} />
        {r.reached
          ? <Pill fg={V('gold')} bg={V('gold-tint')} icon={<Icon name="badgeCheck" size={12} color={V('gold')} />}>{r.reached.name.toUpperCase()}</Pill>
          : <Pill fg={V('ink-muted')} bg={V('surface-muted')}>NOT YET</Pill>}
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        {[...AWARDS].reverse().map((a) => {
          const on = lifeApi >= a.api;
          const inContention = !on && lifeApi >= a.api * 0.85;
          const fg = on ? V('gold') : inContention ? V('warning') : V('ink-faint');
          const bg = on ? V('gold-tint') : inContention ? V('warning-tint') : V('surface-muted');
          return (
            <div key={a.name} style={{ flex: 1, padding: '8px 9px', borderRadius: 9, background: bg, border: `1px solid ${on ? V('gold') : 'transparent'}33` }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: fg, fontFamily: "'JetBrains Mono', monospace" }}>{a.name.split(' ')[0]}</div>
              <div style={{ fontSize: 10, color: V('ink-muted'), marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{ttdK(a.api)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: V('ink-muted'), marginTop: 11 }}>
        {r.top ? <span style={{ color: V('gold'), fontWeight: 700 }}>Top tier reached — Platinum Club.</span>
          : r.next ? <>Allocate <b style={{ color: V('ink') }}>{ttd(r.gap)}</b> more Life API to reach <b style={{ color: V('ink') }}>{r.next.name}</b>.</>
          : 'Set a Life target to project awards.'}
      </div>
    </Card>
  );
}

// ── Money Needs worksheet — 5 groups · 34 line items · 3 sub-calculators ────
// Faithful to the repo MoneyNeedsPanel: 5 expense groups, per-line FREQUENCY
// (M/Q/S/A → annualized), manual + calculator-fed lines, 3 sub-calculators,
// and the PAYE build-up to income-required. Surfaced Option-C style (compact
// group rows → full worksheet) with our live-number / composition additions.
const FREQ = [{ v: 'M', l: 'Monthly', m: 12 }, { v: 'Q', l: 'Quarterly', m: 4 }, { v: 'S', l: 'Semi-Annual', m: 2 }, { v: 'A', l: 'Annual', m: 1 }];
const FREQ_M = { M: 12, Q: 4, S: 2, A: 1 };
function annualize(amount, f) { return (parseFloat(amount) || 0) * (FREQ_M[f] || 1); }

// The 5 real expense groups. `calcFed` lines are driven by a sub-calculator
// (never typed directly): their annual value flows in from the calc.
const MN_GROUPS = [
  { key: 'fixedExpenses', name: 'Fixed Expenses', tone: 'primary', items: [
    { id: 'rent', label: 'Rent / mortgage', amt: 4200, f: 'M' }, { id: 'proptax', label: 'Property tax / rates', amt: 3600, f: 'A' }, { id: 'homeins', label: 'Home insurance', amt: 250, f: 'M' }, { id: 'power', label: 'Electricity (T&TEC)', amt: 600, f: 'M' }, { id: 'water', label: 'Water (WASA)', amt: 120, f: 'M' }, { id: 'net', label: 'Internet / cable', amt: 480, f: 'M' }, { id: 'phone', label: 'Phone', amt: 350, f: 'M' } ] },
  { key: 'livingExpenses', name: 'Living Expenses', tone: 'accent', items: [
    { id: 'carPersonal', label: 'Car expenses (personal share)', calcFed: 'carExpenses.personal' }, { id: 'groceries', label: 'Groceries', amt: 2800, f: 'M' }, { id: 'dining', label: 'Dining out', amt: 700, f: 'M' }, { id: 'clothing', label: 'Clothing', amt: 400, f: 'M' }, { id: 'personal', label: 'Personal care', amt: 300, f: 'M' }, { id: 'health', label: 'Medical / health plan', amt: 700, f: 'M' } ] },
  { key: 'businessExpenses', name: 'Business Expenses', tone: 'gold', items: [
    { id: 'industry', label: 'Professional / industry expenses', calcFed: 'insuranceIndustry' }, { id: 'carBusiness', label: 'Car expenses (business share)', calcFed: 'carExpenses.business' }, { id: 'office', label: 'Office / admin', amt: 500, f: 'M' } ] },
  { key: 'savingsAccumulation', name: 'Savings & Accumulation', tone: 'success', items: [
    { id: 'debtReduction', label: 'Debt reduction (non-mortgage)', calcFed: 'loansDebt' }, { id: 'savings', label: 'Savings / investments', amt: 1200, f: 'M' }, { id: 'pension', label: 'Pension / annuity', amt: 800, f: 'M' }, { id: 'education', label: 'Children education fund', amt: 600, f: 'M' }, { id: 'emergency', label: 'Emergency fund', amt: 400, f: 'M' } ] },
  { key: 'miscellaneous', name: 'Miscellaneous', tone: 'warning', items: [
    { id: 'giving', label: 'Tithes / giving', amt: 300, f: 'M' }, { id: 'entertainment', label: 'Entertainment', amt: 350, f: 'M' }, { id: 'gifts', label: 'Gifts', amt: 200, f: 'M' }, { id: 'vacation', label: 'Vacation', amt: 1500, f: 'A' } ] },
];
const MN_ITEM_COUNT = MN_GROUPS.reduce((s, g) => s + g.items.length, 0);
const GROUP_TONES = ['primary', 'accent', 'gold', 'success', 'warning'];

// The 3 sub-calculators (repo: Insurance Industry, Car Expenses w/ personal-
// business split, Loans & Debt). Each is its own line-item list with frequency.
const CAR_PERSONAL_PCT = 33, CAR_BUSINESS_PCT = 67;
const MN_CALCS = {
  insuranceIndustry: { title: 'Insurance Industry Expenses', feeds: 'Professional / industry expenses → Business', items: [
    { id: 'c1', label: 'Association dues (AICO)', amt: 1200, f: 'A' }, { id: 'c2', label: 'Licensing & registration', amt: 800, f: 'A' }, { id: 'c3', label: 'CPD / training courses', amt: 1500, f: 'A' } ] },
  carExpenses: { title: 'Car Expenses', split: true, feeds: 'Personal → Living · Business → Business', items: [
    { id: 'c1', label: 'Fuel', amt: 900, f: 'M' }, { id: 'c2', label: 'Insurance', amt: 5400, f: 'A' }, { id: 'c3', label: 'Maintenance', amt: 400, f: 'M' }, { id: 'c4', label: 'Licence & inspection', amt: 90, f: 'M' } ] },
  loansDebt: { title: 'Loans & Debt', feeds: 'Debt reduction → Savings & Accumulation', items: [
    { id: 'c1', label: 'Credit card payments', amt: 900, f: 'M' }, { id: 'c2', label: 'Personal loan', amt: 750, f: 'M' } ] },
};
function calcAnnual(items) { return items.reduce((s, it) => s + annualize(it.amt, it.f), 0); }
// Resolve a calc-fed line's annual value from the live calc state.
function calcFedAnnual(calcKey, calcs) {
  const [k, part] = calcKey.split('.');
  const total = calcAnnual(calcs[k].items);
  if (part === 'personal') return Math.round(total * CAR_PERSONAL_PCT / 100);
  if (part === 'business') return Math.round(total * CAR_BUSINESS_PCT / 100);
  return total;
}
// Annual value of any line (manual = amt×freq; calc-fed = from its calc).
function lineAnnual(it, calcs) { return it.calcFed ? calcFedAnnual(it.calcFed, calcs) : annualize(it.amt, it.f); }
function groupAnnual(g, calcs) { return g.items.reduce((s, it) => s + lineAnnual(it, calcs), 0); }
function worksheetAnnual(groups, calcs) { return MN_GROUPS.reduce((s, g) => s + groupAnnual({ items: groups[g.key] }, calcs), 0); }

// PAYE gross-up (T&T brackets, approx): allowance 90k; 25% to 1M taxable, 30% above.
// Solve gross where gross − tax(gross) = afterTax (the annual budget = take-home).
function payeTax(gross) {
  const taxable = Math.max(0, gross - 90000);
  return Math.min(taxable, 1000000) * 0.25 + Math.max(0, taxable - 1000000) * 0.30;
}
function grossUpPAYE(afterTax) { let g = afterTax; for (let i = 0; i < 50; i++) g = afterTax + payeTax(g); return g; }

Object.assign(window, { Icon, V, ttd, ttdK, SliderField, Pill, Card, Label, BudgetCard, Seam, AwardStrip, LINES, LICENSE_LINES, LIFE_PRODUCTS, PRODUCT_DEFAULTS, MAX_PRODUCTS, AWARDS, awardReading, TAX, AVG_POLICY, P, MN_GROUPS, MN_ITEM_COUNT, GROUP_TONES, FREQ, FREQ_M, annualize, MN_CALCS, CAR_PERSONAL_PCT, CAR_BUSINESS_PCT, calcAnnual, calcFedAnnual, lineAnnual, groupAnnual, worksheetAnnual, payeTax, grossUpPAYE });
