// Persistency Playground — v1 / v2 model lab.
// A focused, interactive surface: flip the tenant model (v1 ⇄ v2) and watch the
// same agent's book + what-if levers recompute live. Demonstrates the calc
// change described in the spec. Imports tokens/icons/ttd from app-tokens.jsx.

const GATE = 90, FLOOR = 80;
const rem = (m) => Math.max(0, 24 - m);

// Priya Naidu's book. gross = 13,000 · v1 = 72.0% · v2 = 85.8% (no changes).
const BOOK = [
  { id: 'active', name: '5 active policies', type: 'In force', api: 8700, state: 'active' },
  { id: 'gopaul',  name: 'A. Gopaul',   type: 'Whole Life', api: 1200, state: 'lapsed', lapseMonth: 6,  age: 8,  reinstateMonth: null, note: 'Grace ends 12 Dec' },
  { id: 'mohammed',name: 'R. Mohammed', type: 'Term',       api: 480,  state: 'lapsed', lapseMonth: 4,  age: 7,  reinstateMonth: null, note: 'Missed 2 payments' },
  { id: 'baksh',   name: 'K. Baksh',    type: 'Whole Life', api: 1960, state: 'lapsed', lapseMonth: 18, age: 21, reinstateMonth: null, note: 'NSF — retry pending' },
  { id: 'singh',   name: 'D. Singh',    type: 'Term',       api: 660,  state: 'lapsed', lapseMonth: 9,  age: 13, reinstateMonth: 11, note: 'Reinstated month 11' },
];
const AT_RISK = ['gopaul', 'mohammed', 'baksh'];

// ── Calc engine ────────────────────────────────────────────────────────────
function policyDebitV2(p) {
  if (p.state === 'active') return 0;
  const debitM = rem(p.lapseMonth);
  const creditM = p.reinstateMonth != null ? rem(p.reinstateMonth) : 0;
  return p.api * Math.max(0, debitM - creditM) / 24;
}
function grossOf(book) { return book.reduce((s, p) => s + p.api, 0); }
function persistency(book, model) {
  const gross = grossOf(book);
  if (gross === 0) return 0;
  if (model === 'v1') {
    const lapsedOpen = book.filter((p) => p.state === 'lapsed' && p.reinstateMonth == null)
                           .reduce((s, p) => s + p.api, 0);
    return (gross - lapsedOpen) / gross * 100;
  }
  const debit = book.reduce((s, p) => s + policyDebitV2(p), 0);
  return (gross - debit) / gross * 100;
}

// Apply levers (reinstatements + clean API) to the base book → working book.
function applyLevers(reinstated, cleanApi) {
  const book = BOOK.map((p) => {
    if (reinstated[p.id] && p.state === 'lapsed' && p.reinstateMonth == null) {
      return { ...p, reinstateMonth: p.age }; // reinstate "now" = at current age
    }
    return { ...p };
  });
  if (cleanApi > 0) book.push({ id: 'clean', name: 'New clean API', type: 'Added', api: cleanApi, state: 'active' });
  return book;
}

function bandColor(t, pct) {
  if (pct >= GATE) return t.success;
  if (pct >= FLOOR) return t.warning;
  return t.danger;
}
function bandLabel(pct) {
  if (pct >= GATE) return 'Award-eligible';
  if (pct >= FLOOR) return 'Watch';
  return 'Below floor';
}

// ── Toggle (matches Settings SgToggle / segmented grammar) ───────────────────
function ModelSeg({ t, model, onChange }) {
  const opts = [
    { v: 'v1', label: 'v1 · Ratio' },
    { v: 'v2', label: 'v2 · Rolling 24-mo' },
  ];
  return (
    <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.12)', borderRadius: 9, padding: 3, gap: 3 }}>
      {opts.map((o) => {
        const on = model === o.v;
        return (
          <div key={o.v} onClick={() => onChange(o.v)} style={{
            padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em',
            background: on ? '#fff' : 'transparent', color: on ? t.tealDark : 'rgba(255,255,255,0.8)',
            transition: 'all 160ms ease', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.18)' : 'none', whiteSpace: 'nowrap',
          }}>{o.label}</div>
        );
      })}
    </div>
  );
}

function PolicyRow({ t, p, model, on, onToggle, pp }) {
  const debit = policyDebitV2({ ...p, reinstateMonth: on ? p.age : null });
  const v1hit = p.api;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px',
      background: on ? t.successTint : t.surface, border: `1px solid ${on ? t.success + '55' : t.rule}`,
      borderRadius: 11, transition: 'all 180ms ease' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: on ? t.success : t.warning, flexShrink: 0 }}></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{p.name} <span style={{ color: t.inkFaint, fontWeight: 500 }}>· {p.type}</span></div>
        <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2, fontFamily: APP_FONT_MONO }}>
          {ttd(p.api)} · lapsed month {p.lapseMonth} · {p.age} mo into life · {p.note}
        </div>
      </div>
      {/* model-aware impact badge */}
      {!on && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.success, fontFamily: APP_FONT_DISPLAY }}>+{pp.toFixed(1)} pp</div>
          <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>
            {model === 'v2' ? `credit ${rem(p.age)}mo` : `+${ttd(v1hit)} net`}
          </div>
        </div>
      )}
      {on && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>reinstated</div>
          <div style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{model === 'v2' ? `debit ${ttd(debit)}` : 'added back'}</div>
        </div>
      )}
      <div onClick={onToggle} style={{ width: 42, height: 24, borderRadius: 999, flexShrink: 0, cursor: 'pointer',
        background: on ? t.success : t.surfaceMute, border: `1px solid ${on ? 'transparent' : t.ruleStrong}`,
        position: 'relative', transition: 'background 180ms ease' }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 180ms ease' }}></div>
      </div>
    </div>
  );
}

function AgentPlayground({ t, model, subject }) {
  const subj = subject || { name: 'Priya Naidu', sub: 'S·01 · L1 · November 2025' };
  const [reinstated, setReinstated] = React.useState({});
  const [cleanApi, setCleanApi] = React.useState(0);

  const baseNow = persistency(BOOK, model);
  const projBook = applyLevers(reinstated, cleanApi);
  const projected = persistency(projBook, model);
  const projColor = bandColor(t, projected);

  // marginal pp of reinstating each at-risk policy, given current selections
  const ppFor = (id) => {
    if (reinstated[id]) return 0;
    const withIt = applyLevers({ ...reinstated, [id]: true }, cleanApi);
    return persistency(withIt, model) - projected;
  };

  const v1now = persistency(BOOK, 'v1');
  const v2now = persistency(BOOK, 'v2');

  const formula = model === 'v2'
    ? { title: 'Active formula · v2', body: 'Net Impact = Credits − Debits, time-weighted.', mono: 'debit = API × max(0, rem(lapse) − rem(reinstate)) ÷ 24\npersistency = (Σ API − Σ debit) ÷ Σ API × 100', foot: 'rem(m) = months remaining to 24. Early lapses cost more; reinstating recovers the remaining months; impact self-expires at 24.' }
    : { title: 'Active formula · v1', body: 'Net Settled ÷ Gross Settled — timing-blind.', mono: 'net = Σ API − Σ (open lapsed API)\npersistency = net ÷ gross × 100', foot: 'A lapse subtracts its full API for the whole reporting window regardless of when it happened. Reinstatement adds it back in full.' };

  return (
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 'clamp(16px,3vw,32px)' }}>
        <div style={{ width: '100%', maxWidth: 960, display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, color: t.teal }}>PERSISTENCY PLAYGROUND · WHAT-IF COACHING</div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', color: t.ink, marginTop: 4 }}>{subj.name} <span style={{ color: t.inkFaint, fontWeight: 500, fontSize: 18 }}>· {subj.sub}</span></div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 999, fontSize: 11, fontWeight: 700, fontFamily: APP_FONT_MONO, color: t.inkMute }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: model === 'v2' ? t.teal : t.warning }}></span>
              MODEL: {model === 'v2' ? 'v2 · ROLLING 24-MO' : 'v1 · SETTLED RATIO'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 16, alignItems: 'start' }} className="lab-grid">
            {/* LEFT — projection + levers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* NOW → PROJECTED → GATE */}
              <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                  <div style={{ flex: 1, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>NOW</div>
                    <div style={{ fontSize: 27, fontWeight: 800, color: bandColor(t, baseNow), fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{baseNow.toFixed(1)}%</div>
                    <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>{bandLabel(baseNow)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: t.inkFaint }}><IconArrowR size={18} color={t.inkFaint} stroke={2.2} /></div>
                  <div style={{ flex: 1, padding: '12px 14px', background: projColor + '14', border: `1px solid ${projColor}44`, borderRadius: 11 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: projColor, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>PROJECTED</div>
                    <div style={{ fontSize: 27, fontWeight: 800, color: projColor, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{projected.toFixed(1)}%</div>
                    <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>{bandLabel(projected)}</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px 14px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 11 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: t.success, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>GATE</div>
                    <div style={{ fontSize: 27, fontWeight: 800, color: t.success, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{GATE}%</div>
                    <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>award-eligible</div>
                  </div>
                </div>
                {/* bar vs gate */}
                <div style={{ position: 'relative', height: 8, background: t.surfaceMute, borderRadius: 999, marginTop: 14 }}>
                  <div style={{ width: `${Math.min(100, projected)}%`, height: 8, background: projColor, borderRadius: 999, transition: 'width 320ms cubic-bezier(0.34,1,0.64,1)' }}></div>
                  <div style={{ position: 'absolute', top: -3, left: `${GATE}%`, width: 2, height: 14, background: t.success, borderRadius: 999 }}></div>
                  <div style={{ position: 'absolute', top: -3, left: `${FLOOR}%`, width: 2, height: 14, background: t.danger, borderRadius: 999 }}></div>
                </div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 9 }}>
                  {projected >= GATE
                    ? <span><b style={{ color: t.success }}>Above the {GATE}% gate.</b> This plan clears award eligibility.</span>
                    : <span>Still <b style={{ color: projColor }}>{(GATE - projected).toFixed(1)} pp</b> short of the {GATE}% gate.</span>}
                </div>
              </div>

              {/* Levers — reinstatements */}
              <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 4 }}>Levers · her at-risk policies</div>
                <div style={{ fontSize: 11.5, color: t.inkMute, marginBottom: 11 }}>
                  {model === 'v2'
                    ? 'Ranked by recoverable time-weighted credit — reinstating an early lapse recovers the most, and it decays each month.'
                    : 'Each reinstatement adds the policy\u2019s full API back to Net — biggest API wins, timing ignored.'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AT_RISK.map((id) => {
                    const p = BOOK.find((x) => x.id === id);
                    return <PolicyRow key={id} t={t} p={p} model={model} on={!!reinstated[id]} pp={ppFor(id)}
                      onToggle={() => setReinstated((r) => ({ ...r, [id]: !r[id] }))} />;
                  })}
                </div>

                {/* clean API lever */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.rule}` }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>Additional clean API written</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, padding: '4px 10px', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 8 }}>{ttd(cleanApi)}</span>
                  </div>
                  <input type="range" min="0" max="4000" step="200" value={cleanApi}
                    onChange={(e) => setCleanApi(+e.target.value)}
                    style={{ width: '100%', accentColor: t.teal }} />
                </div>
              </div>
            </div>

            {/* RIGHT — formula + comparison */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Active formula */}
              <div style={{ background: t.tealTint, border: `1px solid #BFE0E0`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>{formula.title}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 6, lineHeight: 1.35 }}>{formula.body}</div>
                <pre style={{ fontFamily: APP_FONT_MONO, fontSize: 11.5, lineHeight: 1.6, color: t.tealDark, background: 'rgba(255,255,255,0.55)', border: '1px solid #BFE0E0', borderRadius: 8, padding: '10px 12px', margin: '11px 0 0', whiteSpace: 'pre-wrap' }}>{formula.mono}</pre>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 10, lineHeight: 1.5 }}>{formula.foot}</div>
              </div>

              {/* Same book, both models */}
              <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 10 }}>Same book · both models (no levers)</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ m: 'v1', val: v1now }, { m: 'v2', val: v2now }].map((x) => (
                    <div key={x.m} onClick={() => setModel(x.m)} style={{ flex: 1, cursor: 'pointer', padding: '12px 14px', borderRadius: 11,
                      background: model === x.m ? bandColor(t, x.val) + '14' : t.surfaceSoft,
                      border: `1.5px solid ${model === x.m ? bandColor(t, x.val) + '66' : t.rule}`, transition: 'all 160ms ease' }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{x.m === 'v1' ? 'SETTLED RATIO' : 'ROLLING 24-MO'}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: bandColor(t, x.val), fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{x.val.toFixed(1)}%</div>
                      <div style={{ fontSize: 9.5, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>{bandLabel(x.val)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: t.inkMute, marginTop: 11, lineHeight: 1.5 }}>
                  Nothing about the book changed — only the weighting. K. Baksh's <b style={{ color: t.ink }}>TTD 1,960</b> lapse lands at month 18, so v2 charges only <b style={{ color: t.ink }}>6 of 24</b> months of it.
                </div>
              </div>

              {/* per-policy weighting detail */}
              <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 10 }}>How each lapse is charged · {model}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {BOOK.filter((p) => p.state === 'lapsed').map((p) => {
                    const eff = projBook.find((x) => x.id === p.id);
                    const v2d = policyDebitV2(eff);
                    const v1d = eff.reinstateMonth != null ? 0 : p.api;
                    const charged = model === 'v2' ? v2d : v1d;
                    const pctCharged = charged / p.api * 100;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 78, fontSize: 11, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ flex: 1, position: 'relative', height: 16, background: t.surfaceMute, borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pctCharged)}%`, height: '100%', background: charged > 0 ? t.danger : t.success, opacity: 0.85, transition: 'width 280ms ease' }}></div>
                        </div>
                        <div style={{ width: 92, textAlign: 'right', fontSize: 10.5, fontFamily: APP_FONT_MONO, color: charged > 0 ? t.danger : t.success }}>
                          −{ttd(charged)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, color: t.inkFaint, marginTop: 10, fontFamily: APP_FONT_MONO }}>Bar = share of policy API charged as a debit under {model}.</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, color: t.inkFaint, fontFamily: APP_FONT_MONO, textAlign: 'center', paddingTop: 4 }}>
            Illustrative book · reproduces the worked numbers in the Persistency v2 spec · the model switch above is the same tenant-admin toggle proposed for Settings › Policy &amp; Thresholds.
          </div>
        </div>
      </div>
  );
}

Object.assign(window, {
  GATE, FLOOR, rem, policyDebitV2, grossOf, persistency, applyLevers,
  bandColor, bandLabel, BOOK, AT_RISK, ModelSeg, PolicyRow, AgentPlayground,
});
