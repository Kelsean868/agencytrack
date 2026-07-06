// Daily Capture v2 — the per-day entry form. Full weekly field set, logged
// for a single day, optimized for speed: count fields use ± steppers, money
// fields a compact input, advanced production (PPP / lumpsum) collapses.

// ── Stepper — − value + for count fields ────────────────────────────────────
function Stepper({ t, value, accent }) {
  const c = accent || t.teal;
  const Btn = ({ sign }) => (
    <div style={{
      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
      background: sign === '+' ? c : t.surfaceSoft,
      border: `1px solid ${sign === '+' ? c : t.ruleStrong}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: sign === '+' ? '#fff' : t.inkMute,
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        {sign === '+' ? <path d="M6 2v8M2 6h8" /> : <path d="M2 6h8" />}
      </svg>
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <Btn sign="−" />
      <div style={{ minWidth: 30, textAlign: 'center', fontSize: 17, fontWeight: 700, color: value > 0 ? t.ink : t.inkDim, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>{value}</div>
      <Btn sign="+" />
    </div>
  );
}

// ── Count row ───────────────────────────────────────────────────────────────
function CountRow({ t, label, value, accent, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${t.rule}` }}>
      <span style={{ fontSize: 12.5, color: value > 0 ? t.ink : t.inkMute, fontWeight: value > 0 ? 600 : 500, minWidth: 0 }}>{label}</span>
      <Stepper t={t} value={value} accent={accent} />
    </div>
  );
}

// ── Money row ───────────────────────────────────────────────────────────────
function MoneyRow({ t, label, value, last }) {
  const empty = !value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${t.rule}` }}>
      <span style={{ fontSize: 12.5, color: empty ? t.inkMute : t.ink, fontWeight: empty ? 500 : 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', height: 32, width: 128, borderRadius: 8, border: `1px solid ${empty ? t.rule : t.ruleStrong}`, background: empty ? t.surfaceSoft : t.surface, overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: t.inkFaint, paddingLeft: 9, fontFamily: APP_FONT_MONO }}>TTD</span>
        <span style={{ flex: 1, textAlign: 'right', paddingRight: 10, fontSize: 14, fontWeight: 700, color: empty ? t.inkDim : t.ink, fontFamily: APP_FONT_DISPLAY }}>{value ? value.toLocaleString() : '0'}</span>
      </div>
    </div>
  );
}

// ── Group card ──────────────────────────────────────────────────────────────
function GroupCard({ t, group, entry }) {
  const c = ({ teal: t.teal, accent: t.inkAccent, gold: t.gold }[group.tone]) || t.teal;
  const filled = group.fields.filter((f) => (entry[f.key] || 0) > 0).length;
  return (
    <div className="a-card" style={{ flexShrink: 0, padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: c }}></span>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, flex: 1 }}>{group.label}</span>
        <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{filled}/{group.fields.length}</span>
      </div>
      {group.fields.map((f, i) => (
        <CountRow key={f.key} t={t} label={f.label} value={entry[f.key] || 0} accent={c} last={i === group.fields.length - 1} />
      ))}
    </div>
  );
}

// ── DailyEntryBody — the whole scrollable form ──────────────────────────────
function DailyEntryBody({ t, data, mobile = true, hideSave = false }) {
  const entry = data.today.entry;
  const credit = data.today.apiCredit;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, paddingBottom: 4 }}>
      {/* Activity groups */}
      {DC_FIELD_GROUPS.map((g) => (
        <GroupCard key={g.key} t={t} group={g} entry={entry} />
      ))}

      {/* Production */}
      <div className="a-card" style={{ flexShrink: 0, padding: '13px 15px', background: t.surface, border: `1px solid ${t.gold}44`, borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: t.gold }}></span>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, flex: 1 }}>Production</span>
          <span style={{ fontSize: 9.5, color: t.gold, fontWeight: 700, fontFamily: APP_FONT_MONO }}>{dcTtd(credit)} credit</span>
        </div>
        <CountRow t={t} label="New business — apps" value={entry.newBizApps} accent={t.gold} />
        <MoneyRow t={t} label="New business — API" value={entry.newBizApi} />
        {/* advanced collapsed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '7px 0 0', borderTop: `1px dashed ${t.rule}`, color: t.inkMute, fontSize: 11, fontWeight: 600 }}>
          <IconChevR size={13} color={t.inkMute} stroke={2.2} /> PPP increases & lumpsums
          <span style={{ marginLeft: 'auto', fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>OPTIONAL</span>
        </div>
      </div>

      {/* Notes */}
      <div className="a-card" style={{ flexShrink: 0, padding: '13px 15px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>Note (optional)</div>
        <div style={{ fontSize: 12, color: t.inkFaint, lineHeight: 1.5 }}>Persaud family referral converted — two more in the pipeline for Friday.</div>
      </div>

      {/* Save bar */}
      {!hideSave && (
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: t.teal, color: '#fff', borderRadius: 12, boxShadow: `0 6px 16px ${t.teal}55` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Save today</div>
            <div style={{ fontSize: 10.5, opacity: 0.85, fontFamily: APP_FONT_MONO }}>Rolls into your {data.weekShort} report</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.18)', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
            Log <IconArrowR size={14} color="#fff" stroke={2.6} />
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

Object.assign(window, { Stepper, CountRow, MoneyRow, GroupCard, DailyEntryBody });
