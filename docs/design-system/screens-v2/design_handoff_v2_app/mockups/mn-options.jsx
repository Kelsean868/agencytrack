// Money Needs — worksheet depth, 3 options side by side. A decision aid:
// how much of the rev 1–5 worksheet (34 line items · 5 expense groups · 3
// sub-calculators · single-open accordion · Done footer) survives the merge.
const { useState } = React;
const V = (k) => `var(--${k})`;
const ttd = (n) => 'TTD ' + Math.round(n).toLocaleString();

// ── The real worksheet: 5 groups, 34 line items, calc-fed rows ──────────────
const GROUPS = [
  { key: 'housing', name: 'Housing & Utilities', calc: 'Mortgage calculator',
    items: [['Rent / mortgage', 4200, true], ['Property tax / rates', 300], ['Home insurance', 250], ['Electricity (T&TEC)', 600], ['Water (WASA)', 120], ['Internet / cable', 480], ['Phone', 350], ['Maintenance & repairs', 400], ['Security', 300]] },
  { key: 'living', name: 'Living & Food',
    items: [['Groceries', 2800], ['Dining out', 700], ['Household supplies', 350], ['Clothing', 400], ['Personal care', 300], ['Subscriptions', 180]] },
  { key: 'transport', name: 'Transport', calc: 'Vehicle loan calculator',
    items: [['Car loan / hire purchase', 2100, true], ['Fuel', 900], ['Insurance', 450], ['Licence & inspection', 90], ['Maintenance', 400], ['Taxi / public', 150]] },
  { key: 'family', name: 'Family & Education', calc: 'Education-need calculator',
    items: [['School fees', 1800, true], ['Lessons / extra-curricular', 500], ['Childcare', 600], ['Medical / health plan', 700], ['Pharmacy', 250], ['Elderly / dependent support', 500]] },
  { key: 'debt', name: 'Debt, Savings & Protection',
    items: [['Credit card payments', 900], ['Personal loan', 750], ['Savings / investments', 1200], ['Existing life premiums', 650], ['Pension / annuity', 800], ['Emergency fund', 400], ['Tithes / giving', 300]] },
];
const TOTAL_MONTHLY = GROUPS.reduce((s, g) => s + g.items.reduce((a, [, v]) => a + v, 0), 0);
const RENEWAL = 36000, TAX = 0.20;
const required = Math.max(0, (TOTAL_MONTHLY * 12) / (1 - TAX) - RENEWAL);
const ITEM_COUNT = GROUPS.reduce((s, g) => s + g.items.length, 0);

// ── shared bits ─────────────────────────────────────────────────────────────
function Phone({ children }) {
  return <div style={{ width: 360, flexShrink: 0, background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 22, overflow: 'hidden', boxShadow: '0 12px 40px rgba(40,37,29,0.10)', display: 'flex', flexDirection: 'column', height: 720 }}>{children}</div>;
}
function Label({ children }) { return <div style={{ fontSize: 9.5, fontWeight: 700, color: V('ink-faint'), letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>{children}</div>; }
function Field({ label, value, calc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <span style={{ flex: 1, fontSize: 12.5, color: V('ink') }}>{label}{calc && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: V('accent'), fontFamily: "'JetBrains Mono', monospace", background: V('accent-tint'), padding: '1px 5px', borderRadius: 5 }}>ƒ calc</span>}</span>
      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: V('ink') }}>{ttd(value)}</span>
    </div>
  );
}
function SeamMini() {
  return (
    <div style={{ background: V('primary'), color: '#fff', borderRadius: 13, padding: '13px 15px', margin: '4px 0' }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', fontFamily: "'JetBrains Mono', monospace", opacity: 0.85 }}>REQUIRED FIRST-YEAR COMMISSION</div>
      <div className="font-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>{ttd(required)}</div>
      <div style={{ fontSize: 10.5, opacity: 0.9, marginTop: 4 }}>Now, here's how you'll write it ↓</div>
    </div>
  );
}
function AllocMini() {
  const lines = [['Life', 300000, V('primary'), true], ['A&H', 40000, V('accent')], ['Motor / Property', 60000, V('gold')]];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label>Allocate across your lines</Label>
      {lines.map(([nm, api, c, elig]) => (
        <div key={nm} style={{ padding: '10px 12px', background: V('raised'), border: `1px solid ${V('border')}`, borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: V('ink') }}>{nm}</span>
            {elig && <span style={{ fontSize: 8, fontWeight: 700, color: V('gold'), background: V('gold-tint'), padding: '1px 5px', borderRadius: 5, fontFamily: "'JetBrains Mono', monospace" }}>AWARDS</span>}
            <div style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: c }}>{ttd(api)}</span>
          </div>
          <div style={{ height: 5, background: V('muted'), borderRadius: 999, marginTop: 7, overflow: 'hidden' }}><div style={{ width: nm === 'Life' ? '72%' : nm === 'A&H' ? '34%' : '48%', height: 5, background: c, borderRadius: 999 }} /></div>
        </div>
      ))}
    </div>
  );
}
function Header({ step, title, sub }) {
  return (
    <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${V('border')}` }}>
      <Label>{step}</Label>
      <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: V('ink'), marginTop: 3 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: V('ink-muted'), marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Scroll({ children }) { return <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>{children}</div>; }

// ── Worksheet accordion (single-open) used by B and C ───────────────────────
function Worksheet({ openKey, setOpenKey, compact }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {GROUPS.map((g) => {
        const open = openKey === g.key;
        const subtotal = g.items.reduce((a, [, v]) => a + v, 0);
        return (
          <div key={g.key} style={{ border: `1px solid ${open ? V('primary') : V('border')}`, borderRadius: 11, overflow: 'hidden', background: V('raised') }}>
            <div onClick={() => setOpenKey(open ? null : g.key)} style={{ cursor: 'pointer', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9, background: open ? V('primary-tint') : 'transparent' }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: open ? V('primary') : V('muted'), color: open ? '#fff' : V('ink-muted'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{g.items.length}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: V('ink') }}>{g.name}</div>
                {g.calc && <div style={{ fontSize: 9.5, color: V('accent'), fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>ƒ {g.calc}</div>}
              </div>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: V('ink') }}>{ttd(subtotal)}</span>
              <span style={{ fontSize: 13, color: V('ink-faint'), transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
            </div>
            {open && (
              <div style={{ padding: '4px 13px 12px', borderTop: `1px solid ${V('border')}` }}>
                {g.items.map(([nm, v, calc], i) => <div key={i} style={{ borderBottom: i < g.items.length - 1 ? `1px solid ${V('muted')}` : 'none' }}><Field label={nm} value={v} calc={calc} /></div>)}
                {g.calc && <div style={{ marginTop: 8, padding: '8px 11px', background: V('accent-tint'), borderRadius: 8, display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 10.5, fontWeight: 700, color: V('accent') }}>ƒ Open {g.calc}</span></div>}
              </div>
            )}
          </div>
        );
      })}
      {/* Done footer */}
      <div style={{ marginTop: 4, padding: '11px 13px', background: V('ink'), color: V('surface'), borderRadius: 11, display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700 }}>{ITEM_COUNT} items · {GROUPS.length} groups</span>
        <span className="font-display mono" style={{ fontSize: 14, fontWeight: 800 }}>{ttd(TOTAL_MONTHLY)}/mo</span>
        <span style={{ fontSize: 11, fontWeight: 700, background: V('primary'), color: '#fff', padding: '5px 11px', borderRadius: 8 }}>Done</span>
      </div>
    </div>
  );
}

// ── OPTION A — compact 2-field (what the merge mock currently has) ──────────
function OptionA() {
  return (
    <Phone>
      <Header step="OPTION A" title="Compact budget" sub="2 inputs → required commission" />
      <Scroll>
        <div style={{ background: V('raised'), border: `1px solid ${V('border')}`, borderRadius: 12, padding: '14px 15px', marginBottom: 12 }}>
          <Label>Monthly life budget</Label>
          <div style={{ marginTop: 6, marginBottom: 12, padding: '11px 13px', background: V('muted'), borderRadius: 9, fontSize: 16, fontWeight: 700, color: V('ink'), textAlign: 'right' }} className="mono">{ttd(TOTAL_MONTHLY)}</div>
          <Label>Renewal income (yr)</Label>
          <div style={{ marginTop: 6, padding: '11px 13px', background: V('muted'), borderRadius: 9, fontSize: 16, fontWeight: 700, color: V('ink'), textAlign: 'right' }} className="mono">{ttd(RENEWAL)}</div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${V('border')}`, fontSize: 11, color: V('ink-muted'), lineHeight: 1.5 }}>×12 → gross-up (÷0.80) → less renewals → required commission.</div>
        </div>
        <SeamMini />
        <div style={{ marginTop: 12 }}><AllocMini /></div>
      </Scroll>
    </Phone>
  );
}

// ── OPTION B — full worksheet, allocator below the seam ─────────────────────
function OptionB() {
  const [openKey, setOpenKey] = useState('housing');
  return (
    <Phone>
      <Header step="OPTION B" title="Full worksheet" sub={`${ITEM_COUNT} items · 5 groups · 3 calculators`} />
      <Scroll>
        <Worksheet openKey={openKey} setOpenKey={setOpenKey} />
        <div style={{ margin: '14px 0' }}><SeamMini /></div>
        <AllocMini />
      </Scroll>
    </Phone>
  );
}

// ── OPTION C — compact by default, worksheet as expandable drill ────────────
function OptionC() {
  const [drill, setDrill] = useState(false);
  const [openKey, setOpenKey] = useState('housing');
  return (
    <Phone>
      <Header step="OPTION C" title="Compact + drill" sub="essentials shown · full worksheet on demand" />
      <Scroll>
        <div style={{ background: V('raised'), border: `1px solid ${V('border')}`, borderRadius: 12, padding: '14px 15px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Label>Monthly life budget</Label>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: V('success'), background: V('success-tint'), padding: '2px 7px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace" }}>{ITEM_COUNT} ITEMS ROLLED UP</span>
          </div>
          <div style={{ marginTop: 7, padding: '11px 13px', background: V('muted'), borderRadius: 9, fontSize: 18, fontWeight: 800, color: V('ink'), textAlign: 'right' }} className="mono font-display">{ttd(TOTAL_MONTHLY)}</div>
          <div onClick={() => setDrill(!drill)} style={{ cursor: 'pointer', marginTop: 10, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${drill ? V('primary') : V('border-strong')}`, background: drill ? V('primary-tint') : 'transparent', display: 'flex', alignItems: 'center', gap: 8, color: drill ? V('primary') : V('ink-muted') }}>
            <span style={{ fontSize: 13, fontWeight: 700, transform: drill ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{drill ? 'Hide full worksheet' : 'Edit full worksheet'}</span>
            <span style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", opacity: 0.8 }}>5 groups</span>
          </div>
          {drill && <div style={{ marginTop: 11 }}><Worksheet openKey={openKey} setOpenKey={setOpenKey} /></div>}
          <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${V('border')}` }}><Field label="Renewal income (yr)" value={RENEWAL} /></div>
        </div>
        <SeamMini />
        <div style={{ marginTop: 12 }}><AllocMini /></div>
      </Scroll>
    </Phone>
  );
}

// ── tradeoff cards ───────────────────────────────────────────────────────────
function Trade({ tone, verdict, pros, cons, moots }) {
  return (
    <div style={{ width: 360, flexShrink: 0, padding: '15px 17px', background: V('raised'), border: `1px solid ${V('border')}`, borderRadius: 14, borderTop: `3px solid ${tone}` }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: V('ink'), marginBottom: 9 }}>{verdict}</div>
      {[['Pros', pros, V('success')], ['Cons', cons, V('warning')]].map(([h, list, c]) => (
        <div key={h} style={{ marginBottom: 9 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: c, letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{h.toUpperCase()}</div>
          {list.map((x, i) => <div key={i} style={{ fontSize: 11.5, color: V('ink-muted'), lineHeight: 1.5, paddingLeft: 12, position: 'relative', marginBottom: 2 }}><span style={{ position: 'absolute', left: 0, color: c }}>·</span>{x}</div>)}
        </div>
      ))}
      <div style={{ fontSize: 10.5, color: V('ink'), background: V('muted'), borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}><b>#738 worksheet:</b> {moots}</div>
    </div>
  );
}

function App() {
  return (
    <div style={{ minHeight: '100vh', padding: '28px 32px 60px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto 22px' }}>
        <div className="font-display" style={{ fontSize: 26, fontWeight: 800, color: V('ink'), letterSpacing: '-0.02em' }}>Money Needs — how much worksheet survives the merge?</div>
        <div style={{ fontSize: 13.5, color: V('ink-muted'), marginTop: 6, lineHeight: 1.55, maxWidth: 760 }}>The merged surface currently uses Option A (2 fields). Your rev 1–5 worksheet from #738 is <b style={{ color: V('ink') }}>{ITEM_COUNT} line items across {GROUPS.length} groups</b> with calc-fed rows, 3 sub-calculators, single-open accordion and a Done footer. Same required-commission output ({ttd(required)}) feeds the same seam + allocator in all three — only the budget half differs. Scroll each phone.</div>
      </div>
      <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 16 }}>
        <OptionA /><OptionB /><OptionC />
      </div>
      <div style={{ display: 'flex', gap: 20, overflowX: 'auto', marginTop: 18 }}>
        <Trade tone={V('warning')} verdict="A · Collapse to essentials"
          pros={['Fastest path to the number', 'One clean scroll into allocation', 'Lowest build / least to maintain']}
          cons={['Throws away real budgeting rigor', 'No expense breakdown to trust the number', 'Agents re-do the maths elsewhere']}
          moots="Mostly mooted — the detailed worksheet is dropped from this surface." />
        <Trade tone={V('primary')} verdict="B · Full worksheet + allocator"
          pros={['Keeps every bit of #738 intact', 'Most accurate, most trustworthy number', 'No rework — one place for the whole plan']}
          cons={['Very long surface; seam pushed far down', 'Heavy on mobile (34 rows + 3 calcs)', 'The merge bet — “one honest scroll” — strains']}
          moots="Fully preserved — worksheet sits above the seam." />
        <Trade tone={V('success')} verdict="C · Compact default, worksheet drill ★"
          pros={['Light by default — number + seam stay close', 'Full rigor one tap away when wanted', 'Reuses #738 wholesale as the drill']}
          cons={['Two levels of depth to design well', 'Need a clear rolled-up ↔ detailed sync', 'Slightly more build than A']}
          moots="Preserved as an expandable drill — #738 becomes the detail layer." />
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
