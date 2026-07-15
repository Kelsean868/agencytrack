// Company Config prototype — controls, chips, rows. All styled off the
// Nexus app tokens (var(--*)) inside a .nexus scope.

const CCPIcons = window.AgencyTrackDesignSystem_ad1cd7;

const ccpMono = 'var(--mono)';
const ccpSans = 'var(--sans)';
const ccpDisplay = 'var(--display)';

const CcpIconLock = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const CcpIconReset = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
  </svg>
);
const CcpIconX = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const CcpIconTrash = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
);

// ── chips ─────────────────────────────────────────────────────────────────
function CcpPlatformChip() {
  return (
    <span className="ccp-chip" style={{ background: 'var(--surfaceMute)', border: '1px solid var(--rule)', color: 'var(--inkMute)' }}>
      <CcpIconLock /> PLATFORM
    </span>
  );
}
function CcpSoonChip({ tier }) {
  return (
    <span className="ccp-chip" style={{ background: 'var(--warningTint)', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)', color: 'var(--warning)' }}>
      <CCPIcons.Icon name="clock" size={11} /> HARDCODED · UNLOCKS {tier || 'SOON'}
    </span>
  );
}
function CcpDefaultTag() {
  return <span style={{ font: '700 9.5px ' + ccpMono, letterSpacing: '.08em', color: 'var(--inkFaint)', flexShrink: 0 }}>DEFAULT</span>;
}

// ── inputs ────────────────────────────────────────────────────────────────
function ccpFieldStyle({ changed, disabled, w = 74, mono = true }) {
  return {
    width: w, boxSizing: 'border-box', padding: '8px 12px',
    background: disabled ? 'var(--surfaceMute)' : 'var(--surface)',
    border: `1.5px solid ${changed ? 'var(--teal)' : 'var(--ruleStrong)'}`,
    borderRadius: 9, opacity: disabled ? 0.55 : 1,
    font: '700 13px ' + (mono ? ccpMono : ccpSans), color: 'var(--ink)',
    textAlign: mono ? 'right' : 'left', outline: 'none', flexShrink: 0,
  };
}

function CcpNumber({ value, onChange, suffix, changed, disabled, w = 74 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
      <input className="ccp-input" type="text" inputMode="numeric" value={value} disabled={disabled}
        onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ''); onChange(v === '' ? 0 : parseInt(v, 10)); }}
        style={ccpFieldStyle({ changed, disabled, w })} aria-label="value" />
      {suffix && <span style={{ font: '500 11px ' + ccpMono, color: 'var(--inkMute)', whiteSpace: 'nowrap' }}>{suffix}</span>}
    </span>
  );
}

function CcpText({ value, onChange, changed, disabled, w = 180, mono = false }) {
  return (
    <input className="ccp-input" type="text" value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={ccpFieldStyle({ changed, disabled, w, mono })} aria-label="value" />
  );
}

// currency: edits as a raw number, displays TTD-formatted when blurred
function CcpCurrency({ value, onChange, changed, disabled }) {
  const [editing, setEditing] = React.useState(false);
  const [raw, setRaw] = React.useState('');
  return (
    <input className="ccp-input" type="text" inputMode="numeric" disabled={disabled}
      value={editing ? raw : ccpTTD(value)}
      onFocus={() => { setRaw(String(value)); setEditing(true); }}
      onBlur={() => { setEditing(false); const n = parseInt(raw.replace(/[^0-9]/g, ''), 10); if (!isNaN(n)) onChange(n); }}
      onChange={(e) => setRaw(e.target.value)}
      style={ccpFieldStyle({ changed, disabled, w: 130 })} aria-label="amount in TTD" />
  );
}

function CcpSeg({ options, value, onChange, changed, disabled }) {
  return (
    <span role="radiogroup" style={{ display: 'inline-flex', gap: 3, padding: 3, background: 'var(--surfaceMute)', border: `1px solid ${changed ? 'var(--teal)' : 'var(--rule)'}`, borderRadius: 9, opacity: disabled ? 0.55 : 1, flexShrink: 0 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button key={o} role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o)}
            className="ccp-segbtn"
            style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: disabled ? 'default' : 'pointer', font: '700 11.5px ' + ccpSans, background: on ? 'var(--teal)' : 'transparent', color: on ? '#fff' : 'var(--inkMute)', whiteSpace: 'nowrap' }}>{o}</button>
        );
      })}
    </span>
  );
}

function CcpToggle({ on, onChange, disabled }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 42, height: 24, borderRadius: 999, border: `1px solid ${on ? 'transparent' : 'var(--ruleStrong)'}`, background: on ? 'var(--teal)' : 'var(--surfaceMute)', position: 'relative', cursor: disabled ? 'default' : 'pointer', flexShrink: 0, opacity: disabled ? 0.55 : 1, padding: 0, transition: 'background .15s ease' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'left .15s ease' }}></span>
    </button>
  );
}

function CcpGhostBtn({ children, danger, onClick, small }) {
  return (
    <button onClick={onClick} className={'ccp-ghost' + (danger ? ' is-danger' : '')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: small ? '6px 11px' : '8px 13px', background: 'transparent', border: `1.5px solid ${danger ? 'var(--danger)' : 'var(--ruleStrong)'}`, borderRadius: 9, font: '700 12px ' + ccpSans, color: danger ? 'var(--danger)' : 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{children}</button>
  );
}

// ── milestones (editable number chips) ───────────────────────────────────
function CcpMilestones({ value, onChange, changed, disabled }) {
  const [adding, setAdding] = React.useState('');
  const commit = () => {
    const n = parseInt(adding, 10);
    if (!isNaN(n) && n > 0 && !value.includes(n)) onChange([...value, n].sort((a, b) => a - b));
    setAdding('');
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 420 }}>
      {value.map((s) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 12px', background: 'var(--surface)', border: `1.5px solid ${changed ? 'var(--teal)' : 'var(--ruleStrong)'}`, borderRadius: 9 }}>
          <span style={{ font: '700 13px ' + ccpMono, color: 'var(--ink)' }}>{s}</span>
          <span style={{ font: '500 10px ' + ccpMono, color: 'var(--inkMute)' }}>WK</span>
          {!disabled && (
            <button aria-label={`Remove ${s}-week milestone`} onClick={() => onChange(value.filter((x) => x !== s))}
              className="ccp-xbtn" style={{ border: 'none', background: 'transparent', color: 'var(--inkFaint)', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center' }}><CcpIconX /></button>
          )}
        </span>
      ))}
      {!disabled && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px', border: '1.5px dashed var(--ruleStrong)', borderRadius: 9 }}>
          <input className="ccp-input" type="text" inputMode="numeric" placeholder="wk" value={adding}
            onChange={(e) => setAdding(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            onBlur={() => { if (adding) commit(); }}
            style={{ width: 34, border: 'none', outline: 'none', background: 'transparent', font: '700 13px ' + ccpMono, color: 'var(--ink)', textAlign: 'center' }} aria-label="Add milestone (weeks)" />
          <button onClick={commit} aria-label="Add milestone" style={{ border: 'none', background: 'transparent', color: 'var(--inkMute)', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center' }}><CCPIcons.Icon name="plus" size={13} /></button>
        </span>
      )}
    </span>
  );
}

// ── text chips (career levels) ────────────────────────────────────────────
function CcpTextChips({ value, onChange, changed, disabled }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 480 }}>
      {value.map((s, i) => (
        <input key={i} className="ccp-input" type="text" value={s} disabled={disabled}
          onChange={(e) => { const nx = [...value]; nx[i] = e.target.value; onChange(nx); }}
          style={{ ...ccpFieldStyle({ changed, disabled, w: Math.max(84, s.length * 7.4 + 30), mono: false }), textAlign: 'center', fontWeight: 700, fontSize: 12 }}
          aria-label={`Career level ${i + 1}`} />
      ))}
    </span>
  );
}

// ── bands table ───────────────────────────────────────────────────────────
function CcpBandTable({ value, onChange, changed, disabled }) {
  const upd = (i, patch) => { const nx = value.map((b, j) => (j === i ? { ...b, ...patch } : b)); onChange(nx); };
  const cols = '92px 1fr 148px 138px 34px';
  const th = { font: '700 9.5px ' + ccpMono, letterSpacing: '.12em', color: 'var(--inkFaint)', textTransform: 'uppercase', textAlign: 'left', paddingBottom: 8 };
  return (
    <div className="ccp-tablewrap" style={{ overflowX: 'auto' }}>
    <div style={{ minWidth: 700 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center' }}>
        <div style={th}>Band</div><div style={th}>Tenure (months)</div>
        <div style={{ ...th, textAlign: 'right' }}>Annual API floor</div>
        <div style={{ ...th, textAlign: 'right' }}>Weekly floor</div><div></div>
      </div>
      {value.map((b, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--rule)' }}>
          <CcpText value={b.band} onChange={(v) => upd(i, { band: v })} changed={changed} disabled={disabled} w={72} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <CcpNumber value={b.from} onChange={(v) => upd(i, { from: v })} changed={changed} disabled={disabled} w={60} />
            <span style={{ fontSize: 11, color: 'var(--inkFaint)' }}>to</span>
            {b.to === null
              ? <span style={{ ...ccpFieldStyle({ disabled: true, w: 60 }), display: 'inline-grid', placeItems: 'center', textAlign: 'center' }}>∞</span>
              : <CcpNumber value={b.to} onChange={(v) => upd(i, { to: v })} changed={changed} disabled={disabled} w={60} />}
            {b.to === null && <span style={{ font: '700 10px ' + ccpMono, color: 'var(--inkFaint)' }}>OPEN</span>}
          </span>
          <span style={{ textAlign: 'right' }}><CcpCurrency value={b.floor} onChange={(v) => upd(i, { floor: v })} changed={changed} disabled={disabled} /></span>
          <span style={{ textAlign: 'right', font: '500 12px ' + ccpMono, color: 'var(--inkMute)' }}>{ccpTTD(Math.round(b.floor / 48))}</span>
          {!disabled && value.length > 1 ? (
            <button aria-label={`Delete band ${b.band}`} onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="ccp-xbtn" style={{ border: 'none', background: 'transparent', color: 'var(--inkFaint)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}><CcpIconTrash /></button>
          ) : <span></span>}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 11, borderTop: '1px solid var(--rule)', marginTop: 2 }}>
        <CcpGhostBtn small onClick={() => {
          const last = value[value.length - 1];
          const nx = value.map((b, i) => (i === value.length - 1 ? { ...b, to: (b.from || 0) + 12 } : b));
          onChange([...nx, { band: 'L' + (value.length + 1), from: (last.from || 0) + 13, to: null, floor: last.floor + 100000 }]);
        }}><CCPIcons.Icon name="plus" size={13} /> Add band</CcpGhostBtn>
        <span style={{ fontSize: 11, color: 'var(--inkFaint)', lineHeight: 1.4 }}>Bands must cover month 0 onward with no gaps — the last band stays open-ended. Weekly floors derive automatically (annual ÷ 48).</span>
      </div>
    </div>
    </div>
  );
}

// ── points table ──────────────────────────────────────────────────────────
// ── points table — names/codes editable, add + delete activities ────────
function CcpPointsTable({ value, onChange, changed, disabled }) {
  const cols = '1fr 88px 84px 34px';
  const th = { font: '700 9.5px ' + ccpMono, letterSpacing: '.12em', color: 'var(--inkFaint)', paddingBottom: 8 };
  const upd = (i, patch) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ccp-tablewrap" style={{ overflowX: 'auto' }}>
    <div style={{ minWidth: 380 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center' }}>
        <div style={th}>ACTIVITY</div><div style={th}>CODE</div><div style={{ ...th, textAlign: 'right' }}>POINTS</div><div></div>
      </div>
      {value.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--rule)' }}>
          <CcpText value={r.act} onChange={(v) => upd(i, { act: v })} changed={changed} disabled={disabled} w="100%" />
          <CcpText value={r.code} onChange={(v) => upd(i, { code: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) })} changed={changed} disabled={disabled} w={80} mono />
          <span style={{ textAlign: 'right' }}>
            <CcpNumber value={r.pts} onChange={(v) => upd(i, { pts: v })} changed={changed} disabled={disabled} w={64} />
          </span>
          {!disabled && value.length > 1 ? (
            <button aria-label={`Delete ${r.act || 'activity'}`} onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="ccp-xbtn" style={{ border: 'none', background: 'transparent', color: 'var(--inkFaint)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}><CcpIconTrash /></button>
          ) : <span></span>}
        </div>
      ))}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 11, borderTop: '1px solid var(--rule)', marginTop: 2 }}>
          <CcpGhostBtn small onClick={() => onChange([...value, { act: 'New activity', code: 'NEW', pts: 1 }])}><CCPIcons.Icon name="plus" size={13} /> Add activity</CcpGhostBtn>
          <span style={{ fontSize: 11, color: 'var(--inkFaint)', lineHeight: 1.4 }}>Codes appear on Daily Capture and the WAR — keep them short. Deleting an activity stops new points; history keeps what was already earned.</span>
        </div>
      )}
    </div>
    </div>
  );
}

// ── clubs table — fully customizable awards & clubs ───────────────────
function CcpClubsTable({ value, onChange, changed, disabled }) {
  const cols = '1fr 150px 150px 62px 34px';
  const th = { font: '700 9.5px ' + ccpMono, letterSpacing: '.12em', color: 'var(--inkFaint)', paddingBottom: 8 };
  const upd = (i, patch) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ccp-tablewrap" style={{ overflowX: 'auto' }}>
    <div style={{ minWidth: 700 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center' }}>
        <div style={th}>CLUB / AWARD</div><div style={{ ...th, textAlign: 'right' }}>QUALIFYING API</div><div style={th}>RECOGNITION</div><div style={th}>ACTIVE</div><div></div>
      </div>
      {value.map((c, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--rule)', opacity: c.active === false ? 0.6 : 1 }}>
          <CcpText value={c.name} onChange={(v) => upd(i, { name: v })} changed={changed} disabled={disabled} w="100%" />
          <span style={{ textAlign: 'right' }}><CcpCurrency value={c.threshold} onChange={(v) => upd(i, { threshold: v })} changed={changed} disabled={disabled} /></span>
          <CcpSeg options={['Badge', 'Badge + trip']} value={c.tier} onChange={(v) => upd(i, { tier: v })} changed={changed} disabled={disabled} />
          <CcpToggle on={c.active !== false} onChange={(v) => upd(i, { active: v })} disabled={disabled} />
          {!disabled && value.length > 1 ? (
            <button aria-label={`Delete ${c.name || 'club'}`} onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="ccp-xbtn" style={{ border: 'none', background: 'transparent', color: 'var(--inkFaint)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}><CcpIconTrash /></button>
          ) : <span></span>}
        </div>
      ))}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 11, borderTop: '1px solid var(--rule)', marginTop: 2 }}>
          <CcpGhostBtn small onClick={() => onChange([...value, { name: 'New award', threshold: 500000, tier: 'Badge', active: true }])}><CCPIcons.Icon name="plus" size={13} /> Add award</CcpGhostBtn>
          <span style={{ fontSize: 11, color: 'var(--inkFaint)', lineHeight: 1.4 }}>Inactive awards stop qualifying new seasons — earned badges are never revoked. Qualification reads settled API for the active season.</span>
        </div>
      )}
    </div>
    </div>
  );
}

// ── activity standards — editable names, add/delete, override counts ─────
function CcpStandardsTable({ value, onChange, changed, disabled }) {
  const cols = '1fr 110px 190px 34px';
  const th = { font: '700 9.5px ' + ccpMono, letterSpacing: '.12em', color: 'var(--inkFaint)', paddingBottom: 8 };
  const upd = (i, patch) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="ccp-tablewrap" style={{ overflowX: 'auto' }}>
    <div style={{ minWidth: 560 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center' }}>
        <div style={th}>STANDARD</div><div style={{ ...th, textAlign: 'right' }}>PER WEEK</div><div style={th}>MANAGER OVERRIDES</div><div></div>
      </div>
      {value.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--rule)' }}>
          <CcpText value={r.name} onChange={(v) => upd(i, { name: v })} changed={changed} disabled={disabled} w="100%" />
          <span style={{ textAlign: 'right' }}><CcpNumber value={r.wk} onChange={(v) => upd(i, { wk: v })} changed={changed} disabled={disabled} w={70} /></span>
          {r.ovr > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--inkMute)' }}>
              <CCPIcons.Icon name="users" size={12} /> {r.ovr} manager{r.ovr > 1 ? 's' : ''} override this
            </span>
          ) : <span style={{ fontSize: 11, color: 'var(--inkFaint)' }}>—</span>}
          {!disabled && value.length > 1 ? (
            <button aria-label={`Delete ${r.name || 'standard'}`} onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="ccp-xbtn" style={{ border: 'none', background: 'transparent', color: 'var(--inkFaint)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}><CcpIconTrash /></button>
          ) : <span></span>}
        </div>
      ))}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 11, borderTop: '1px solid var(--rule)', marginTop: 2 }}>
          <CcpGhostBtn small onClick={() => onChange([...value, { name: 'New standard', wk: 5, ovr: 0 }])}><CCPIcons.Icon name="plus" size={13} /> Add standard</CcpGhostBtn>
          <span style={{ fontSize: 11, color: 'var(--inkFaint)', lineHeight: 1.4 }}>Override counts are read-only here — per-manager overrides live in the manager flow.</span>
        </div>
      )}
    </div>
    </div>
  );
}

// ── brand-mark upload (logo / favicon) ─────────────────────────────
function CcpUpload({ value, onChange, shape = 'tile', changed, disabled }) {
  const ref = React.useRef(null);
  const wide = shape === 'wide';
  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(f);
    e.target.value = '';
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      <span style={{ width: wide ? 168 : 56, height: 56, borderRadius: 12, border: `1.5px ${value ? 'solid' : 'dashed'} ${changed ? 'var(--teal)' : 'var(--ruleStrong)'}`, background: 'var(--surfaceMute)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {value
          ? <img src={value} alt="Uploaded mark" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--inkFaint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5-8 8" /></svg>}
      </span>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <CcpGhostBtn small onClick={() => ref.current && ref.current.click()}>{value ? 'Replace' : 'Upload'}</CcpGhostBtn>
        {value && <button className="ccp-link" onClick={() => onChange(null)} style={{ border: 'none', background: 'transparent', padding: 0, font: '700 11px ' + ccpSans, color: 'var(--inkMute)', cursor: 'pointer' }}>Remove</button>}
      </span>
      <input ref={ref} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" onChange={pick} style={{ display: 'none' }} aria-label="Upload image" />
    </span>
  );
}

// value preview for search results + history log
function ccpPreview(item, v) {
  if (v === undefined || v === null) return '';
  switch (item.type) {
    case 'currency': return ccpTTD(v);
    case 'number': return v + (item.suffix ? ' ' + item.suffix.replace('of month', '') : '');
    case 'toggle': case 'flag': return v ? 'ON' : 'OFF';
    case 'bands': return v.length + ' bands';
    case 'points': return v.length + ' activities';
    case 'clubs': return v.length + ' awards';
    case 'standards': return v.length + ' standards';
    case 'upload': return v ? 'Uploaded' : '—';
    case 'milestones': return v.join(' · ') + ' wk';
    case 'textchips': return v.length + ' levels';
    default: return String(v);
  }
}

Object.assign(window, {
  CcpIconLock, CcpIconReset, CcpIconX, CcpIconTrash,
  CcpPlatformChip, CcpSoonChip, CcpDefaultTag,
  CcpNumber, CcpText, CcpCurrency, CcpSeg, CcpToggle, CcpGhostBtn,
  CcpMilestones, CcpTextChips, CcpBandTable, CcpPointsTable, CcpClubsTable, CcpStandardsTable, CcpUpload,
  ccpPreview, ccpFieldStyle,
});
