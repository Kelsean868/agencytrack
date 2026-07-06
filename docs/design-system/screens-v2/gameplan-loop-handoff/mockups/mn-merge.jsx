// Money Needs merged allocator — the allocation half + app shell.
// Loads after mn-merge-core.jsx (globals: Icon, V, ttd, SliderField, Card, etc.).

const { useState: useS, useMemo: useM } = React;

// ── A single product-line allocation row ────────────────────────────────────
function LineCard({ lineKey, api, max, onApi, expandable, expanded, onToggle, children }) {
  const L = LINES[lineKey];
  const commission = api * L.rate;
  const apps = api / AVG_POLICY;
  const tone = L.tone;
  return (
    <Card style={{ padding: 0, overflow: 'hidden', borderColor: expanded ? V(tone) : V('border') }}>
      <div style={{ padding: '15px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: `var(--${tone}-tint)`, color: V(tone), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={lineKey === 'life' ? 'target' : lineKey === 'ah' ? 'badgeCheck' : 'scale'} size={16} color={V(tone)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="font-display" style={{ fontSize: 15.5, fontWeight: 700, color: V('ink') }}>{L.label}</span>
              {L.eligible && <Pill fg={V('gold')} bg={V('gold-tint')} icon={<Icon name="award" size={11} color={V('gold')} />}>AWARD-ELIGIBLE</Pill>}
            </div>
            {L.sub && <div style={{ fontSize: 10.5, color: V('ink-muted'), marginTop: 1 }}>{L.sub} · {L.rate * 100}% first-year</div>}
          </div>
          {expandable && (
            <div onClick={onToggle} role="button" tabIndex={0} style={{ cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '0 8px', borderRadius: 9, background: expanded ? V('primary-tint') : V('surface-muted'), color: expanded ? V('primary') : V('ink-muted'), fontSize: 11, fontWeight: 700 }}>
              <Icon name="layers" size={14} color={expanded ? V('primary') : V('ink-muted')} />
              {expanded ? 'Products' : 'Split'}
              <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={13} color={expanded ? V('primary') : V('ink-muted')} />
            </div>
          )}
        </div>
        <SliderField value={api} max={max} onChange={onApi} eligible={L.eligible} accent={tone} />
        <div style={{ display: 'flex', gap: 18, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${V('border')}` }}>
          <div><Label>First-yr commission</Label><div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: V('ink'), marginTop: 3 }}>{ttd(commission)}</div></div>
          <div><Label>Derived apps</Label><div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: V('ink'), marginTop: 3 }}>{Math.round(apps)} <span style={{ fontSize: 10, color: V('ink-faint'), fontWeight: 600 }}>est.</span></div></div>
          <div style={{ flex: 1 }} />
        </div>
      </div>
      {expanded && children}
    </Card>
  );
}

// ── Phase 2 · generic per-product drill (Life or General) ───────────────────
// Up to 4 user-NAMED products under a line. Names are editable; values are
// slider+field. Award eligibility follows the parent line (Life = eligible).
function ProductDrill({ lineKey, lineTotal, names, vals, setNames, setVals }) {
  const L = LINES[lineKey];
  const tone = L.tone;
  const sum = vals.reduce((s, v) => s + (v || 0), 0);
  const bal = sum - lineTotal;
  const balanced = Math.abs(bal) < 2500;
  const [editing, setEditing] = useS(false);
  const setVal = (i, nv) => setVals(vals.map((v, j) => (j === i ? nv : v)));
  const setName = (i, nn) => setNames(names.map((n, j) => (j === i ? nn : n)));
  const autoBalance = () => {
    if (sum === 0) { setVals(names.map((_, i) => (i === 0 ? lineTotal : 0))); return; }
    const f = lineTotal / sum; const next = []; let acc = 0;
    names.forEach((_, i) => {
      if (i === names.length - 1) next[i] = Math.max(0, lineTotal - acc);
      else { next[i] = Math.round((vals[i] || 0) * f / 5000) * 5000; acc += next[i]; }
    });
    setVals(next);
  };
  return (
    <div style={{ background: V('surface-muted'), borderTop: `1px solid ${V('border')}`, padding: '15px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13, flexWrap: 'wrap' }}>
        <Label>Split {L.label} into products</Label>
        <span className="font-mono" style={{ fontSize: 9.5, color: V('ink-faint') }}>max {MAX_PRODUCTS} · {L.eligible ? 'award-eligible' : 'not eligible'}</span>
        <div style={{ flex: 1 }} />
        <div onClick={() => setEditing(!editing)} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 28, display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', borderRadius: 8, background: editing ? V(`${tone}-tint`) : V('surface-raised'), border: `1px solid ${editing ? V(tone) : V('border')}`, color: editing ? V(tone) : V('ink-muted'), fontSize: 11, fontWeight: 700 }}>
          <Icon name="pencil" size={12} color={editing ? V(tone) : V('ink-muted')} />{editing ? 'Done' : 'Rename'}
        </div>
        {balanced
          ? <Pill fg={V('success')} bg={V('success-tint')} icon={<Icon name="check" size={11} color={V('success')} />}>BALANCED</Pill>
          : <Pill fg={V('warning')} bg={V('warning-tint')} icon={<Icon name="alert" size={11} color={V('warning')} />}>{bal > 0 ? 'OVER' : 'UNDER'} {ttd(Math.abs(bal))}</Pill>}
        {!balanced && <div onClick={autoBalance} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 28, display: 'flex', alignItems: 'center', padding: '0 11px', borderRadius: 8, background: V('primary'), color: '#fff', fontSize: 11, fontWeight: 700 }}>Auto-balance</div>}
      </div>
      {/* sum bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 8, background: V('surface'), borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          {names.map((_, i) => (
            <div key={i} style={{ width: `${((vals[i] || 0) / Math.max(lineTotal, sum, 1)) * 100}%`, background: V(tone), opacity: 1 - i * 0.18, borderRight: `1px solid ${V('surface-raised')}` }} />
          ))}
        </div>
        <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: balanced ? V('success') : V('warning') }}>{ttd(sum)} / {ttd(lineTotal)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {names.map((nm, i) => {
          const v = vals[i] || 0; const apps = v / AVG_POLICY, comm = v * L.rate;
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                {editing ? (
                  <input value={nm} maxLength={22} onChange={(e) => setName(i, e.target.value)} aria-label={`product ${i + 1} name`}
                    style={{ fontSize: 12.5, fontWeight: 700, color: V('ink'), background: V('surface-raised'), border: `1px solid ${V(tone)}`, borderRadius: 7, padding: '4px 8px', width: 160, fontFamily: "'Satoshi', sans-serif" }} />
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: V('ink') }}>{nm || <span style={{ color: V('ink-faint'), fontStyle: 'italic' }}>Unnamed</span>}</span>
                )}
                {L.eligible && <Pill fg={V('gold')} bg={V('gold-tint')} icon={<Icon name="award" size={10} color={V('gold')} />}>ELIGIBLE</Pill>}
                <div style={{ flex: 1 }} />
                <span className="font-mono" style={{ fontSize: 10.5, color: V('ink-muted') }}>{Math.round(apps)} apps · {ttd(comm)} comm</span>
              </div>
              <SliderField value={v} max={lineTotal} step={5000} onChange={(nv) => setVal(i, nv)} eligible={L.eligible} accent={tone} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 12px', background: V('surface-raised'), borderRadius: 10, border: `1px solid ${V('border')}` }}>
        <Icon name="info" size={14} color={V('ink-faint')} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 10.5, color: V('ink-muted'), lineHeight: 1.5 }}>Name up to {MAX_PRODUCTS} products under {L.label}. {lineKey === 'general' ? 'Motor & Property are General-license lines.' : ''} Derived apps use the blended average policy size ({ttd(AVG_POLICY)}) — per-product avg-policy is a pending data decision (build sheet).</div>
      </div>
    </div>
  );
}

// ── License segmented switch (live reflow) ──────────────────────────────────
function LicenseSwitch({ license, onChange }) {
  const opts = [{ k: 'life', l: 'Life' }, { k: 'general', l: 'General' }, { k: 'composite', l: 'Composite' }];
  return (
    <div style={{ display: 'flex', gap: 3, padding: 3, background: V('surface-muted'), border: `1px solid ${V('border')}`, borderRadius: 10 }}>
      {opts.map((o) => {
        const on = o.k === license;
        return <div key={o.k} onClick={() => onChange(o.k)} role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: on ? V('surface-raised') : 'transparent', color: on ? V('ink') : V('ink-muted'), border: on ? `1px solid ${V('border')}` : '1px solid transparent', minHeight: 36, display: 'flex', alignItems: 'center' }}>{o.l}</div>;
      })}
    </div>
  );
}

// ── First-run license picker ────────────────────────────────────────────────
function LicensePicker({ onPick }) {
  const cards = [
    { k: 'life', l: 'Life only', d: 'Life + A&H lines', note: 'Tatil pilot' },
    { k: 'general', l: 'General only', d: 'Motor / Property + A&H' },
    { k: 'composite', l: 'Composite', d: 'All lines', rec: true },
  ];
  const [sel, setSel] = useS('composite');
  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: '40px 8px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: V('primary-tint'), color: V('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Icon name="badgeCheck" size={24} color={V('primary')} /></div>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 800, color: V('ink'), letterSpacing: '-0.02em' }}>What's your license class?</div>
        <div style={{ fontSize: 13, color: V('ink-muted'), marginTop: 7, lineHeight: 1.5 }}>It sets which product lines you allocate across. A&H shows for everyone.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cards.map((c) => {
          const on = sel === c.k;
          return (
            <div key={c.k} onClick={() => setSel(c.k)} role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '15px 17px', borderRadius: 13, background: on ? V('primary-tint') : V('surface-raised'), border: `1.5px solid ${on ? V('primary') : V('border')}`, display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? V('primary') : V('border-strong')}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <div style={{ width: 10, height: 10, borderRadius: '50%', background: V('primary') }} />}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="font-display" style={{ fontSize: 15.5, fontWeight: 700, color: V('ink') }}>{c.l}</span>{c.rec && <Pill fg={V('primary')} bg={V('primary-tint')}>DEFAULT</Pill>}{c.note && <Pill fg={V('gold')} bg={V('gold-tint')}>{c.note.toUpperCase()}</Pill>}</div>
                <div style={{ fontSize: 11.5, color: V('ink-muted'), marginTop: 2 }}>{c.d}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div onClick={() => onPick(sel)} role="button" tabIndex={0} style={{ cursor: 'pointer', marginTop: 18, minHeight: 48, background: V('primary'), color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14.5, fontWeight: 700 }}>Continue <Icon name="chevronRight" size={16} color="#fff" /></div>
    </div>
  );
}

// ── State views ──────────────────────────────────────────────────────────────
function NoNeedState({ onDoBudget }) {
  return (
    <Card style={{ padding: '28px 22px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, background: V('surface-muted'), color: V('ink-faint'), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Icon name="wallet" size={22} color={V('ink-faint')} /></div>
      <div className="font-display" style={{ fontSize: 17, fontWeight: 700, color: V('ink') }}>No commission target yet</div>
      <div style={{ fontSize: 12.5, color: V('ink-muted'), marginTop: 7, lineHeight: 1.5, maxWidth: 320, margin: '7px auto 0' }}>Do the budget above to get your required first-year commission — then allocate it across your lines. Or enter a target from scratch.</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
        <div onClick={onDoBudget} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 18px', borderRadius: 11, background: V('primary'), color: '#fff', fontSize: 13.5, fontWeight: 700 }}>Do the budget</div>
        <div role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 18px', borderRadius: 11, background: V('surface-raised'), border: `1px solid ${V('border')}`, color: V('ink'), fontSize: 13.5, fontWeight: 700 }}>Enter from scratch</div>
      </div>
    </Card>
  );
}
function LoadingState() {
  const bar = (w) => <div style={{ height: 12, width: w, background: V('surface-muted'), borderRadius: 6 }} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: 0.7 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', gap: 11, alignItems: 'center', marginBottom: 14 }}><div style={{ width: 30, height: 30, borderRadius: 9, background: V('surface-muted') }} />{bar(120)}</div>
          <div style={{ height: 6, background: V('surface-muted'), borderRadius: 999 }} />
          <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>{bar(80)}{bar(60)}</div>
        </Card>
      ))}
    </div>
  );
}
function ErrorState({ onRetry }) {
  return (
    <Card style={{ padding: '28px 22px', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, background: V('danger-tint'), color: V('danger'), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Icon name="alert" size={22} color={V('danger')} /></div>
      <div className="font-display" style={{ fontSize: 17, fontWeight: 700, color: V('ink') }}>Couldn't load your plan</div>
      <div style={{ fontSize: 12.5, color: V('ink-muted'), marginTop: 7 }}>Your saved targets are safe. Retry when you're back online.</div>
      <div onClick={onRetry} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 18px', borderRadius: 11, background: V('primary'), color: '#fff', fontSize: 13.5, fontWeight: 700, marginTop: 18 }}><Icon name="rotate" size={15} color="#fff" />Try again</div>
    </Card>
  );
}

// ── Composition bar — 5 group segments, one glance at where money goes ──────
function CompositionBar({ groups, calcs, h = 9 }) {
  const total = worksheetAnnual(groups, calcs) || 1;
  return (
    <div style={{ display: 'flex', height: h, borderRadius: 999, overflow: 'hidden', background: V('surface-muted') }}>
      {MN_GROUPS.map((g, i) => {
        const w = (groupAnnual({ items: groups[g.key] }, calcs) / total) * 100;
        return <div key={g.key} style={{ width: `${w}%`, background: V(GROUP_TONES[i % 5]), borderRight: i < MN_GROUPS.length - 1 ? `1px solid ${V('surface-raised')}` : 'none' }} />;
      })}
    </div>
  );
}

// Frequency select — the per-line M/Q/S/A control (repo parity).
function FreqSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Frequency"
      style={{ height: 38, padding: '0 8px', background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: V('ink'), fontFamily: "'Satoshi', sans-serif" }}>
      {FREQ.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
    </select>
  );
}
function AmtInput({ value, onChange, w = 92 }) {
  return (
    <div style={{ position: 'relative', width: w, flexShrink: 0 }}>
      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 8.5, fontWeight: 700, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>TTD</span>
      <input type="number" value={value === 0 ? '' : value} step={50} placeholder="0" min={0} onChange={(e) => onChange(Math.max(0, +e.target.value || 0))}
        style={{ width: '100%', height: 38, padding: '0 8px 0 30px', background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: V('ink'), textAlign: 'right' }} />
    </div>
  );
}

// Manual line — description heading + amount · frequency · annualized · delete.
function ManualLine({ item, onChange, onDelete }) {
  return (
    <div style={{ background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 11, padding: 11, marginBottom: 8 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: V('ink'), marginBottom: 8 }}>{item.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <AmtInput value={item.amt} onChange={(v) => onChange(item.id, { amt: v })} />
        <FreqSelect value={item.f} onChange={(v) => onChange(item.id, { f: v })} />
        <span style={{ flex: 1, minWidth: 70, textAlign: 'right', fontSize: 11, color: V('ink-muted'), fontFamily: "'JetBrains Mono', monospace" }}>{ttd(annualize(item.amt, item.f))} / yr</span>
        {onDelete && <div onClick={() => onDelete(item.id)} role="button" tabIndex={0} aria-label="Delete" style={{ cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V('ink-faint') }}>✕</div>}
      </div>
    </div>
  );
}

// Calculator-fed line — empty → CTA; filled → value + Recalculate (repo parity).
function CalcFedLine({ item, calcs, onOpenCalc }) {
  const annual = calcFedAnnual(item.calcFed, calcs);
  const filled = annual > 0;
  const calcId = item.calcFed.split('.')[0];
  return (
    <div style={{ borderRadius: 11, padding: 11, marginBottom: 8, border: `1px solid ${filled ? V('border') : V('primary')}`, background: filled ? V('surface') : V('primary-tint') }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: V('ink') }}>{item.label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: V('primary'), fontFamily: "'JetBrains Mono', monospace" }}><Icon name="award" size={10} color={V('primary')} />Calculator</span>
      </div>
      {!filled ? (
        <div onClick={() => onOpenCalc(calcId)} role="button" tabIndex={0} style={{ cursor: 'pointer', marginTop: 8, minHeight: 44, borderRadius: 10, background: V('primary'), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 700 }}>
          <Icon name="sliders" size={14} color="#fff" />Build with calculator →
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span className="font-display" style={{ fontSize: 15, fontWeight: 800, color: V('ink') }}>{ttd(annual)}</span>
          <span style={{ fontSize: 10.5, color: V('ink-muted') }}>/ yr</span>
          <div style={{ flex: 1 }} />
          <div onClick={() => onOpenCalc(calcId)} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: 9, border: `1px solid ${V('border')}`, color: V('primary'), fontSize: 11.5, fontWeight: 700 }}><Icon name="sliders" size={13} color={V('primary')} />Recalculate</div>
        </div>
      )}
    </div>
  );
}

// ── Sub-calculator modal — Done footer fills the field (repo parity) ────────
function SubCalcModal({ calcId, calcs, setCalc, onClose }) {
  const c = MN_CALCS[calcId];
  const items = calcs[calcId].items;
  const total = calcAnnual(items);
  const personal = Math.round(total * CAR_PERSONAL_PCT / 100), business = Math.round(total * CAR_BUSINESS_PCT / 100);
  const setItem = (id, patch) => setCalc(calcId, items.map((it) => it.id === id ? { ...it, ...patch } : it));
  const addItem = () => setCalc(calcId, [...items, { id: 'n' + Date.now(), label: 'New item', amt: 0, f: 'M' }]);
  const delItem = (id) => setCalc(calcId, items.filter((it) => it.id !== id));
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.55)', backdropFilter: 'blur(3px)' }} />
      <div className="a-scale-in" style={{ position: 'relative', width: '100%', maxWidth: 460, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: V('surface-raised'), borderRadius: 18, border: `1px solid ${V('border')}`, boxShadow: '0 30px 90px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${V('border')}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: V('primary-tint'), color: V('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sliders" size={16} color={V('primary')} /></div>
          <div style={{ flex: 1 }}>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: V('ink') }}>{c.title}</div>
            <div style={{ fontSize: 10.5, color: V('ink-muted') }}>{c.feeds}</div>
          </div>
          <div onClick={onClose} role="button" tabIndex={0} style={{ cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V('ink-muted'), fontSize: 17 }}>✕</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {c.split && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: 12, padding: '10px 12px', background: V('surface-muted'), borderRadius: 10, fontSize: 11, color: V('ink-muted') }}>
              <span>Personal ({CAR_PERSONAL_PCT}%): <b style={{ color: V('ink') }}>{ttd(personal)}</b> → Living</span>
              <span>Business ({CAR_BUSINESS_PCT}%): <b style={{ color: V('ink') }}>{ttd(business)}</b> → Business</span>
            </div>
          )}
          {items.map((it) => <ManualLine key={it.id} item={it} onChange={setItem} onDelete={delItem} />)}
          <div onClick={addItem} role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '9px', borderRadius: 10, border: `1.5px dashed ${V('primary')}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: V('primary'), fontWeight: 700, fontSize: 12.5 }}><Icon name="plus" size={14} color={V('primary')} />Add item</div>
        </div>
        <div style={{ borderTop: `1px solid ${V('border')}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace" }}>Annual total</div>
            <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: V('ink') }}>{c.split ? `${ttd(personal)} · ${ttd(business)}` : ttd(total)}</div>
          </div>
          <div onClick={onClose} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 46, display: 'flex', alignItems: 'center', gap: 7, padding: '0 18px', borderRadius: 12, background: V('primary'), color: '#fff', fontSize: 14, fontWeight: 700 }}><Icon name="check" size={15} color="#fff" />Done — use this figure</div>
        </div>
      </div>
    </div>
  );
}

// ── PAYE build-up — the cascade to income-required (repo parity) ────────────
function PayeBuildup({ afterTax, preTax, renewals }) {
  const paye = Math.max(0, preTax - afterTax);
  const commissionsRequired = Math.max(0, preTax - renewals);
  const Row = ({ l, v, strong, sub, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: strong ? '8px 0 0' : '3px 0' }}>
      <div><span style={{ fontSize: strong ? 13 : 12, color: strong ? V('ink') : V('ink-muted'), fontWeight: strong ? 700 : 400 }}>{l}</span>{sub && <div style={{ fontSize: 10, color: V('ink-faint') }}>{sub}</div>}</div>
      <span className="font-mono" style={{ fontSize: strong ? 15 : 12.5, fontWeight: strong ? 800 : 600, color: color || V('ink') }}>{v}</span>
    </div>
  );
  return (
    <Card style={{ padding: '15px 18px' }}>
      <div style={{ paddingBottom: 9, borderBottom: `1px solid ${V('border')}`, marginBottom: 6 }}>
        <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: V('ink') }}>The income your lifestyle requires</div>
        <div style={{ fontSize: 10.5, color: V('ink-muted'), marginTop: 1 }}>Everything above is your choice — this is the annual income it takes to fund it.</div>
      </div>
      <Row l="After-tax take-home (= annual budget)" v={ttd(afterTax)} />
      <Row l="+ PAYE" v={`+ ${ttd(paye)}`} color={V('ink-muted')} />
      <div style={{ borderTop: `1px solid ${V('border')}`, marginTop: 6 }}><Row l="= Income you must earn" v={ttd(preTax)} strong /></div>
      {renewals > 0 && <Row l="− Renewal income" v={`− ${ttd(renewals)}`} color={V('success')} />}
      <div style={{ borderTop: `1px solid ${V('border')}`, marginTop: 6 }}><Row l="1st-year commissions required" sub={renewals === 0 ? 'all of it — no renewal income yet' : null} v={ttd(commissionsRequired)} strong color={V('gold')} /></div>
    </Card>
  );
}

// ── Money Needs worksheet — repo-faithful flow + Option-C disclosure ────────
// 5 expense groups · per-line frequency · manual + calculator-fed lines · 3
// sub-calculators · single-open accordion · live composition + total. The PAYE
// build-up + seam sit just below (rendered by App).
function BudgetWorksheet({ groups, setLine, addLine, delLine, calcs, openCalc, setOpenCalc, renewalIncome, setRenewal, openGroup, setOpenGroup, expanded, setExpanded, firstRun, required, monthlyAnnual }) {
  const filledTotal = MN_GROUPS.reduce((s, g) => s + groups[g.key].filter((it) => lineAnnual(it, calcs) > 0).length, 0);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: `1px solid ${V('border')}` }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: V('primary-tint'), color: V('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="wallet" size={18} color={V('primary')} /></div>
        <div style={{ flex: 1 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: V('ink') }}>Money Needs · {new Date().getFullYear()}</div>
          <div style={{ fontSize: 11.5, color: V('ink-muted') }}>{firstRun ? 'Design the life you want — fill your budget' : 'Your annual budget → income required → commission'}</div>
        </div>
        {!firstRun && (
          <div onClick={() => setExpanded(!expanded)} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: 9, background: expanded ? V('primary-tint') : V('surface-muted'), border: `1px solid ${expanded ? V('primary') : V('border')}`, color: expanded ? V('primary') : V('ink-muted'), fontSize: 12, fontWeight: 700 }}>
            <Icon name="layers" size={13} color={expanded ? V('primary') : V('ink-muted')} />{expanded ? 'Compact' : 'Edit worksheet'}
          </div>
        )}
      </div>

      {/* total + composition — the spine */}
      <div style={{ padding: '16px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <Label>Total annual budget</Label>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace" }}>{filledTotal} of {MN_ITEM_COUNT} filled</span>
        </div>
        <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: V('ink'), letterSpacing: '-0.02em', marginTop: 5 }}>{ttd(monthlyAnnual)}<span style={{ fontSize: 13, color: V('ink-faint'), fontWeight: 600 }}> / yr</span></div>
        <div style={{ marginTop: 11 }}><CompositionBar groups={groups} calcs={calcs} /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginTop: 10 }}>
          {MN_GROUPS.map((g, i) => {
            const pct = Math.round((groupAnnual({ items: groups[g.key] }, calcs) / (monthlyAnnual || 1)) * 100);
            return (
              <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: V(GROUP_TONES[i % 5]) }} />
                <span style={{ fontSize: 10.5, color: V('ink-muted') }}>{g.name.split(' ')[0]} <b style={{ color: V('ink') }}>{pct}%</b></span>
              </div>
            );
          })}
        </div>
      </div>

      {firstRun && (
        <div style={{ margin: '0 20px 12px', padding: '11px 13px', background: V('primary-tint'), borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="info" size={15} color={V('primary')} />
          <div style={{ fontSize: 11.5, color: V('ink'), fontWeight: 600 }}>First time here — tap a group to fill it in. The total updates as you go; calculators feed the ƒ lines.</div>
        </div>
      )}

      <div style={{ padding: '0 20px 18px' }}>
        {!expanded ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {MN_GROUPS.map((g, i) => {
              const hasCalc = groups[g.key].some((it) => it.calcFed);
              return (
                <div key={g.key} onClick={() => { setExpanded(true); setOpenGroup(g.key); }} role="button" tabIndex={0}
                  style={{ cursor: 'pointer', padding: '11px 13px', background: V('surface-raised'), border: `1px solid ${V('border')}`, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: V(GROUP_TONES[i % 5]), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V('ink') }}>{g.name}</div>
                    <div style={{ fontSize: 10, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace" }}>{groups[g.key].length} items{hasCalc ? ' · ƒ calculator' : ''}</div>
                  </div>
                  <span className="font-mono" style={{ fontSize: 12.5, fontWeight: 700, color: V('ink') }}>{ttd(groupAnnual({ items: groups[g.key] }, calcs))}</span>
                  <Icon name="chevronRight" size={15} color={V('ink-faint')} />
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div style={{ position: 'sticky', top: 56, zIndex: 5, margin: '0 -20px 12px', padding: '9px 20px', background: V('surface'), borderTop: `1px solid ${V('border')}`, borderBottom: `1px solid ${V('border')}`, display: 'flex', alignItems: 'center', gap: 9 }}>
              <Icon name="seam" size={14} color={V('primary')} />
              <span style={{ fontSize: 11, color: V('ink-muted'), fontWeight: 600 }}>Required commission</span>
              <div style={{ flex: 1 }} />
              <span className="font-display" style={{ fontSize: 16, fontWeight: 800, color: V('primary') }}>{ttd(required)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MN_GROUPS.map((g, i) => {
                const open = openGroup === g.key;
                const items = groups[g.key];
                const calcFed = items.filter((it) => it.calcFed);
                const manual = items.filter((it) => !it.calcFed);
                return (
                  <div key={g.key} style={{ border: `1px solid ${open ? V(GROUP_TONES[i % 5]) : V('border')}`, borderRadius: 11, overflow: 'hidden', background: V('surface-raised') }}>
                    <div onClick={() => setOpenGroup(open ? null : g.key)} role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10, background: open ? `var(--${GROUP_TONES[i % 5]}-tint)` : 'transparent' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: V(GROUP_TONES[i % 5]), flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: V('ink') }}>{g.name}</div>
                        <div style={{ fontSize: 9.5, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{items.filter((it) => lineAnnual(it, calcs) > 0).length} of {items.length} filled</div>
                      </div>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: V('ink') }}>{ttd(groupAnnual({ items }, calcs))} <span style={{ color: V('ink-faint') }}>/yr</span></span>
                      <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} color={V('ink-faint')} />
                    </div>
                    {open && (
                      <div style={{ padding: '8px 13px 12px', borderTop: `1px solid ${V('border')}` }}>
                        {calcFed.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, background: V('primary-tint'), marginBottom: 8 }}><Icon name="award" size={11} color={V('primary')} /><span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: V('primary') }}>From your calculators</span></div>
                            {calcFed.map((it) => <CalcFedLine key={it.id} item={it} calcs={calcs} onOpenCalc={setOpenCalc} />)}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, background: V('surface-muted'), marginBottom: 8 }}><Icon name="pencil" size={11} color={V('ink-muted')} /><span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: V('ink-muted') }}>Your entries</span></div>
                        {manual.map((it) => <ManualLine key={it.id} item={it} onChange={(id, patch) => setLine(g.key, id, patch)} onDelete={(id) => delLine(g.key, id)} />)}
                        <div onClick={() => addLine(g.key)} role="button" tabIndex={0} style={{ cursor: 'pointer', height: 36, borderRadius: 9, border: `1.5px dashed ${V('primary')}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: V('primary'), fontSize: 12, fontWeight: 700 }}><Icon name="plus" size={13} color={V('primary')} />Add item</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!firstRun && (
              <div onClick={() => setExpanded(false)} role="button" tabIndex={0} style={{ cursor: 'pointer', marginTop: 12, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, background: V('ink'), color: V('surface'), fontSize: 13, fontWeight: 700 }}>
                <Icon name="check" size={15} color={V('surface')} />Done · collapse to summary
              </div>
            )}
          </div>
        )}

        {/* renewal income — the offset in the build-up */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${V('border')}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Label>Renewal income</Label>
            <div style={{ fontSize: 10.5, color: V('ink-muted'), marginTop: 2 }}>existing book, per year — reduces what you must write</div>
          </div>
          <AmtInput value={renewalIncome} onChange={setRenewal} w={104} />
        </div>
      </div>
      {openCalc && <SubCalcModal calcId={openCalc} calcs={calcs} setCalc={(k, items) => setOpenCalc.setCalc(k, items)} onClose={() => setOpenCalc(null)} />}
    </Card>
  );
}
function Allocation({ license, setLicense, required, lineApi, setLineApi, expand, setExpand, prodNames, setProdNames, prodVals, setProdVals, onSend }) {
  const visible = LICENSE_LINES[license];
  const totalComm = visible.reduce((s, k) => s + lineApi[k] * LINES[k].rate, 0);
  const pct = required > 0 ? Math.min(999, Math.round((totalComm / required) * 100)) : 0;
  const lifeApi = visible.includes('life') ? lineApi.life : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: V('primary-tint'), color: V('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sliders" size={18} color={V('primary')} /></div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: V('ink') }}>Allocate it across your lines</div>
            <div style={{ fontSize: 11.5, color: V('ink-muted') }}>License-aware · A&H always shown · slider or type</div>
          </div>
          <LicenseSwitch license={license} onChange={setLicense} />
        </div>
        {/* % of need allocated */}
        <div style={{ marginTop: 15 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <Label>Allocated vs required</Label>
            <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? V('success') : pct >= 80 ? V('ink') : V('warning') }}>{ttd(totalComm)} <span style={{ color: V('ink-faint') }}>/ {ttd(required)}</span> · {pct}%</span>
          </div>
          <div style={{ height: 9, background: V('surface-muted'), borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, pct)}%`, height: 9, background: pct >= 100 ? V('success') : pct >= 80 ? V('primary') : V('warning'), borderRadius: 999, transition: 'width 0.2s' }} />
          </div>
        </div>
      </Card>

      {visible.map((k) => {
        const L = LINES[k];
        const max = Math.round((required / L.rate) * 1.5 / 5000) * 5000;
        return (
          <LineCard key={k} lineKey={k} api={lineApi[k]} max={max} onApi={(v) => setLineApi({ ...lineApi, [k]: v })}
            expandable={!!L.drill} expanded={!!L.drill && expand[k]} onToggle={() => setExpand({ ...expand, [k]: !expand[k] })}>
            {L.drill && <ProductDrill lineKey={k} lineTotal={lineApi[k]}
              names={prodNames[k]} vals={prodVals[k]}
              setNames={(n) => setProdNames({ ...prodNames, [k]: n })}
              setVals={(v) => setProdVals({ ...prodVals, [k]: v })} />}
          </LineCard>
        );
      })}

      {visible.includes('life') && <AwardStrip lifeApi={lifeApi} />}

      {/* The seam continues: hand the API targets to the Playground */}
      <SendBar onSend={onSend} />
    </div>
  );
}

// ── Send bar — the hop from allocation → Playground ─────────────────────────
function SendBar({ onSend }) {
  return (
    <Card style={{ padding: '15px 18px', borderColor: V('primary'), background: V('primary-tint') }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: V('surface-raised'), color: V('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="seam" size={18} color={V('primary')} /></div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: V('ink') }}>Targets set — turn them into activity</div>
          <div style={{ fontSize: 11.5, color: V('ink-muted'), marginTop: 1 }}>Send these API figures to the Playground to back-solve your weekly numbers.</div>
        </div>
        <div onClick={onSend} role="button" tabIndex={0} className="pulse" style={{ cursor: 'pointer', minHeight: 46, display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', borderRadius: 12, background: V('primary'), color: '#fff', fontSize: 14, fontWeight: 700 }}>
          Send to Playground <Icon name="chevronRight" size={16} color="#fff" />
        </div>
      </div>
    </Card>
  );
}

// ── Playground hop — a confirm modal, then NAVIGATE to the full page ─────────
const PG_RATIOS = { ciToSale: 0.5, ffiToCI: 0.67, aiToFFI: 0.75, dialsToAI: 0.2, weeks: 46 };
function pgRows(license, lineApi, prodNames, prodVals, expand) {
  const visible = LICENSE_LINES[license];
  return visible.map((k) => {
    const L = LINES[k];
    const drilled = !!L.drill && expand[k];
    const products = drilled ? prodNames[k].map((nm, i) => ({ name: nm || `Product ${i + 1}`, api: prodVals[k][i] || 0 })).filter((p) => p.api > 0) : null;
    return { key: k, label: L.label, eligible: L.eligible, tone: L.tone, api: lineApi[k], products };
  });
}
function pgDecompose(lifeApi) {
  const apps = lifeApi / AVG_POLICY;
  const salesWk = apps / PG_RATIOS.weeks;
  const ci = salesWk / PG_RATIOS.ciToSale;
  const ffi = ci / PG_RATIOS.ffiToCI;
  const ai = ffi / PG_RATIOS.aiToFFI;
  const pc = ai / PG_RATIOS.dialsToAI;
  return {
    apps,
    act: [
      { code: 'P.C', label: 'Prospecting calls', wk: Math.ceil(pc), tone: 'accent' },
      { code: 'A.I', label: 'Approach', wk: Math.ceil(ai), tone: 'primary' },
      { code: 'F.F.I', label: 'Fact-find', wk: Math.ceil(ffi), tone: 'primary' },
      { code: 'C.I', label: 'Close', wk: Math.ceil(ci), tone: 'primary' },
    ],
    award: awardReading(lifeApi),
  };
}

// Confirm modal — names exactly what hands over before navigating.
function PlaygroundConfirm({ license, lineApi, prodNames, prodVals, expand, onCancel, onOpen }) {
  const rows = pgRows(license, lineApi, prodNames, prodVals, expand);
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.55)', backdropFilter: 'blur(3px)' }} />
      <div className="a-scale-in" style={{ position: 'relative', width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto', background: V('surface'), borderRadius: 20, border: `1px solid ${V('border')}`, boxShadow: '0 30px 90px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${V('border')}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: V('primary-tint'), color: V('primary'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="seam" size={19} color={V('primary')} /></div>
            <div style={{ flex: 1 }}>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: V('ink') }}>Send to Playground</div>
              <div style={{ fontSize: 12, color: V('ink-muted'), marginTop: 1 }}>These targets become the Playground's starting point.</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ padding: '12px 14px', background: V('surface-raised'), border: `1px solid ${V('border')}`, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-display" style={{ fontSize: 14.5, fontWeight: 700, color: V('ink') }}>{r.label}</span>
                {r.eligible && <Pill fg={V('gold')} bg={V('gold-tint')} icon={<Icon name="award" size={10} color={V('gold')} />}>AWARDS</Pill>}
                <div style={{ flex: 1 }} />
                <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: V('primary') }}>{ttd(r.api)}</span>
              </div>
              {r.products && (
                <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px dashed ${V('border')}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {r.products.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                      <span style={{ color: V('ink-muted') }}>{p.name}</span><div style={{ flex: 1, borderBottom: `1px dotted ${V('border-strong')}` }} /><span className="font-mono" style={{ fontWeight: 700, color: V('ink') }}>{ttd(p.api)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 13px', background: V('surface-muted'), borderRadius: 10 }}>
            <Icon name="info" size={14} color={V('ink-faint')} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 10.5, color: V('ink-muted'), lineHeight: 1.5 }}>Only <b style={{ color: V('ink') }}>Life</b> API drives the award projection. All lines decompose into activity. Money Needs stays the source — edit there to change.</div>
          </div>
        </div>
        <div style={{ padding: '4px 22px 20px', display: 'flex', gap: 10 }}>
          <div onClick={onCancel} role="button" tabIndex={0} style={{ cursor: 'pointer', flex: 1, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: V('surface-raised'), border: `1px solid ${V('border')}`, color: V('ink'), fontSize: 14, fontWeight: 700 }}>Cancel</div>
          <div onClick={onOpen} role="button" tabIndex={0} style={{ cursor: 'pointer', flex: 1.4, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, background: V('primary'), color: '#fff', fontSize: 14, fontWeight: 700 }}><Icon name="seam" size={15} color="#fff" />Send to Playground</div>
        </div>
      </div>
    </div>
  );
}

// "Target sent" ack — mirrors the shipped #738 modal: data is written to the
// Playground key; the agent continues to the Game Plan hub (or stays).
function PlaygroundAck({ onContinue, onStay }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={onStay} style={{ position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.55)', backdropFilter: 'blur(3px)' }} />
      <div className="a-scale-in" style={{ position: 'relative', width: '100%', maxWidth: 380, background: V('surface-raised'), borderRadius: 18, border: `1px solid ${V('border')}`, boxShadow: '0 30px 90px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        <div style={{ padding: '28px 22px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: V('primary-tint'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={28} color={V('primary')} stroke={2.4} /></div>
          <div>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 800, color: V('ink') }}>Target sent!</div>
            <div style={{ fontSize: 13, color: V('ink-muted'), marginTop: 4 }}>Saved to your Commission Playground</div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${V('border')}`, marginTop: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div onClick={onContinue} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 46, display: 'flex', alignItems: 'center', gap: 7, padding: '0 18px', borderRadius: 12, background: V('primary'), color: '#fff', fontSize: 14, fontWeight: 700 }}>Continue to Game Plan <Icon name="chevronRight" size={15} color="#fff" /></div>
          <div onClick={onStay} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 10px', color: V('ink-muted'), fontSize: 13, fontWeight: 600 }}>Stay here</div>
        </div>
      </div>
    </div>
  );
}

// Destination PREVIEW — the Game Plan → Commission Playground step the agent
// lands on. In-app this is a TAB (onOpenTab('game-plan')), NOT a router route:
// no breadcrumb, no back-button chrome — the app's nav is the way back. Shown
// here only so the mock can preview what receives the targets.
function PlaygroundPage({ license, lineApi, onBack }) {
  const lifeApi = LICENSE_LINES[license].includes('life') ? lineApi.life : 0;
  const { apps, act, award } = pgDecompose(lifeApi);
  return (
    <div className="a-fade-up">
      {/* tab-context strip (NOT a router breadcrumb) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: '9px 13px', background: V('primary-tint'), borderRadius: 11 }}>
        <Icon name="info" size={14} color={V('primary')} />
        <div style={{ flex: 1, fontSize: 11, color: V('ink'), fontWeight: 600 }}>You're now on the <b>Game Plan</b> tab · Commission Playground. In-app this is <span className="font-mono" style={{ fontSize: 10 }}>onOpenTab('game-plan')</span> — not a route.</div>
        <div onClick={onBack} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center', padding: '0 11px', borderRadius: 8, background: V('surface-raised'), border: `1px solid ${V('border')}`, color: V('ink-muted'), fontSize: 11, fontWeight: 700 }}>← Money Needs tab</div>
      </div>

      <div style={{ background: V('surface-raised'), border: `1px solid ${V('border')}`, borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '22px 24px 18px', background: V('primary'), color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -10, opacity: 0.18 }}><Icon name="sliders" size={130} color="#fff" stroke={1.2} /></div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', fontFamily: "'JetBrains Mono', monospace", opacity: 0.85 }}>PRE-FILLED FROM YOUR MONEY NEEDS PLAN</div>
            <div className="font-display" style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>Your weekly numbers</div>
            <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 7 }}>Back-solved from {ttd(lifeApi)} Life API · ~{Math.round(apps)} apps/yr</div>
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label>This week, to stay on plan</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 10 }}>
              {act.map((a) => (
                <div key={a.code} style={{ padding: '14px 15px', background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: V(a.tone), background: V(`${a.tone}-tint`) }}>{a.code}</span>
                  </div>
                  <div className="font-display" style={{ fontSize: 28, fontWeight: 800, color: V('ink'), marginTop: 9 }}>{a.wk}<span style={{ fontSize: 12, color: V('ink-faint'), fontWeight: 600 }}> /wk</span></div>
                  <div style={{ fontSize: 10.5, color: V('ink-muted'), marginTop: 3 }}>{a.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 16px', background: V('gold-tint'), border: `1px solid ${V('gold')}33`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 11 }}>
            <Icon name="award" size={17} color={V('gold')} />
            <div style={{ flex: 1, fontSize: 12.5, color: V('ink'), fontWeight: 600 }}>{award.reached ? <>On track for <b>{award.reached.name}</b>{award.next && <> · {ttd(award.gap)} more Life API for {award.next.name}</>}</> : 'Set a Life target to project an award.'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: V('surface'), border: `1px solid ${V('border')}`, borderRadius: 10 }}>
            <Icon name="info" size={14} color={V('ink-faint')} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: V('ink-muted'), lineHeight: 1.5 }}>Conversion ratios are editable here in the Playground. Targets came from Money Needs — <b style={{ color: V('ink') }}>go back</b> to change the API split. (Prototype: in-app this is the live Playground route, pre-filled.)</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div onClick={onBack} role="button" tabIndex={0} style={{ cursor: 'pointer', flex: 1, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, background: V('surface'), border: `1px solid ${V('border')}`, color: V('ink'), fontSize: 14, fontWeight: 700 }}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><Icon name="chevronRight" size={15} color={V('ink')} /></span>Back to Money Needs</div>
            <div role="button" tabIndex={0} style={{ cursor: 'pointer', flex: 1.2, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, background: V('primary'), color: '#fff', fontSize: 14, fontWeight: 700 }}><Icon name="check" size={15} color="#fff" />Save plan</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useS('light');
  const [device, setDevice] = useS('desktop');
  const [demo, setDemo] = useS('live');
  const [license, setLicense] = useS(null);
  const [groups, setGroups] = useS(() => Object.fromEntries(MN_GROUPS.map((g) => [g.key, g.items.map((it) => ({ ...it }))])));
  const [calcs, setCalcs] = useS(() => Object.fromEntries(Object.entries(MN_CALCS).map(([k, c]) => [k, { items: c.items.map((it) => ({ ...it })) }])));
  const [openCalc, setOpenCalcState] = useS(null);
  const [renewalIncome, setRenewal] = useS(36000);
  const [openGroup, setOpenGroup] = useS(MN_GROUPS[0].key);
  const [wsExpanded, setWsExpanded] = useS(false);
  const [lineApi, setLineApi] = useS({ life: 300000, ah: 40000, general: 60000 });
  const [expand, setExpand] = useS({ life: false, general: false });
  const [prodNames, setProdNames] = useS({ life: [...PRODUCT_DEFAULTS.life], general: [...PRODUCT_DEFAULTS.general] });
  const [prodVals, setProdVals] = useS({ life: [150000, 60000, 50000, 40000], general: [30000, 20000, 5000, 5000] });
  const [playground, setPlayground] = useS(false);   // confirm modal open
  const [pgAck, setPgAck] = useS(false);              // "target sent" ack
  const [route, setRoute] = useS('allocator');        // mock-only: 'allocator' | 'playground' (in-app = tab via onOpenTab)

  const afterTax = useM(() => worksheetAnnual(groups, calcs), [groups, calcs]);
  const preTax = useM(() => grossUpPAYE(afterTax), [afterTax]);
  const required = useM(() => Math.max(0, preTax - renewalIncome), [preTax, renewalIncome]);
  // line/calc mutators
  const setLine = (gk, id, patch) => setGroups((g) => ({ ...g, [gk]: g[gk].map((it) => it.id === id ? { ...it, ...patch } : it) }));
  const addLine = (gk) => setGroups((g) => ({ ...g, [gk]: [...g[gk], { id: 'n' + Date.now(), label: 'New item', amt: 0, f: 'M' }] }));
  const delLine = (gk, id) => setGroups((g) => ({ ...g, [gk]: g[gk].filter((it) => it.id !== id) }));
  const setCalc = (k, items) => setCalcs((c) => ({ ...c, [k]: { items } }));
  const openCalcApi = Object.assign((v) => setOpenCalcState(v), { setCalc });

  const W = device === 'mobile' ? 420 : 720;
  const wrap = { 'data-theme': theme };

  const toolBtn = (active, on, children) => (
    <div onClick={on} role="button" tabIndex={0} style={{ cursor: 'pointer', minWidth: 40, minHeight: 36, padding: '0 11px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, background: active ? V('surface-raised') : 'transparent', border: `1px solid ${active ? V('border') : 'transparent'}`, color: active ? V('ink') : V('ink-muted'), fontSize: 12, fontWeight: 700 }}>{children}</div>
  );

  return (
    <div {...wrap} style={{ minHeight: '100vh', background: V('surface'), transition: 'background 0.25s' }}>
      {/* toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: V('surface-raised'), borderBottom: `1px solid ${V('border')}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="font-display" style={{ fontSize: 14, fontWeight: 800, color: V('ink') }}>Money Needs <span style={{ color: V('primary') }}>+ Allocator</span></span>
        <span style={{ fontSize: 10.5, color: V('ink-faint'), fontFamily: "'JetBrains Mono', monospace" }}>merged surface · prototype</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, padding: 2, background: V('surface-muted'), borderRadius: 9 }}>
          {toolBtn(device === 'desktop', () => setDevice('desktop'), <><Icon name="monitor" size={14} color={device === 'desktop' ? V('ink') : V('ink-muted')} />Desktop</>)}
          {toolBtn(device === 'mobile', () => setDevice('mobile'), <><Icon name="smartphone" size={14} color={device === 'mobile' ? V('ink') : V('ink-muted')} />Mobile</>)}
        </div>
        <div style={{ display: 'flex', gap: 2, padding: 2, background: V('surface-muted'), borderRadius: 9 }}>
          {toolBtn(theme === 'light', () => setTheme('light'), <Icon name="sun" size={15} color={theme === 'light' ? V('ink') : V('ink-muted')} />)}
          {toolBtn(theme === 'dark', () => setTheme('dark'), <Icon name="moon" size={15} color={theme === 'dark' ? V('ink') : V('ink-muted')} />)}
        </div>
        <select value={demo} onChange={(e) => setDemo(e.target.value)} style={{ padding: '8px 10px', background: V('surface-muted'), border: `1px solid ${V('border')}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: V('ink'), fontFamily: "'Satoshi', sans-serif" }}>
          <option value="live">State: Live</option>
          <option value="firstrun">First run (guided)</option>
          <option value="nobudget">No commission need</option>
          <option value="loading">Loading</option>
          <option value="error">Error</option>
        </select>
        {license && <div onClick={() => setLicense(null)} role="button" tabIndex={0} style={{ cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', padding: '0 11px', borderRadius: 8, background: V('surface-muted'), color: V('ink-muted'), fontSize: 12, fontWeight: 700 }}>↺ License</div>}
      </div>

      {/* body */}
      <div style={{ maxWidth: W, margin: '0 auto', padding: device === 'mobile' ? '18px 14px 60px' : '26px 20px 80px', transition: 'max-width 0.25s' }}>
        {route === 'playground' ? (
          <PlaygroundPage license={license} lineApi={lineApi} onBack={() => setRoute('allocator')} />
        ) : license === null ? (
          <LicensePicker onPick={setLicense} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BudgetWorksheet groups={groups} setLine={setLine} addLine={addLine} delLine={delLine} calcs={calcs} openCalc={openCalc} setOpenCalc={openCalcApi} renewalIncome={renewalIncome} setRenewal={setRenewal} openGroup={openGroup} setOpenGroup={setOpenGroup} expanded={wsExpanded || demo === 'firstrun'} setExpanded={setWsExpanded} firstRun={demo === 'firstrun'} required={required} monthlyAnnual={afterTax} />
            <PayeBuildup afterTax={afterTax} preTax={preTax} renewals={renewalIncome} />
            <Seam required={required} />
            {demo === 'loading' ? <LoadingState />
              : demo === 'error' ? <ErrorState onRetry={() => setDemo('live')} />
              : demo === 'nobudget' ? <NoNeedState onDoBudget={() => setDemo('live')} />
              : <Allocation license={license} setLicense={setLicense} required={required} lineApi={lineApi} setLineApi={setLineApi} expand={expand} setExpand={setExpand} prodNames={prodNames} setProdNames={setProdNames} prodVals={prodVals} setProdVals={setProdVals} onSend={() => setPlayground(true)} />}
          </div>
        )}
      </div>
      {playground && <PlaygroundConfirm license={license} lineApi={lineApi} prodNames={prodNames} prodVals={prodVals} expand={expand} onCancel={() => setPlayground(false)} onOpen={() => { setPlayground(false); setPgAck(true); }} />}
      {pgAck && <PlaygroundAck onContinue={() => { setPgAck(false); setRoute('playground'); window.scrollTo(0, 0); }} onStay={() => setPgAck(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
