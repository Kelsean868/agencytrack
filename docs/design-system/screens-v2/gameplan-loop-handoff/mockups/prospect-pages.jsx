// Prospect Prep v2 — page bodies (mobile-first). Hero next-call card, prep
// list, new-prep bottom sheet, manager read view, and a convert moment.

// ── NextCallHero — the appointment-bound hero ───────────────────────────────
function NextCallHero({ t, prep, readOnly = false }) {
  const urgent = prep.inDays <= 1 && !prep.prepped;
  return (
    <div className="a-card a-rise" style={{
      position: 'relative', overflow: 'hidden', flexShrink: 0,
      padding: '16px 18px',
      background: t.surface, border: `1px solid ${urgent ? t.warning + '66' : t.teal + '55'}`, borderRadius: 14,
      boxShadow: `0 6px 18px ${t.mode === 'light' ? 'rgba(1,105,111,0.08)' : 'rgba(0,0,0,0.4)'}`,
    }}>
      <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, background: `radial-gradient(circle, ${urgent ? t.warningTint : t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Eyebrow t={t} color={urgent ? t.warning : t.teal}>{readOnly ? 'NEXT JOINT CALL' : 'YOUR NEXT JOINT CALL'}</Eyebrow>
        <ApptBadge t={t} inDays={prep.inDays} prepped={prep.prepped} />
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>
          {ppInitials(prep.clientName)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: '-0.018em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.1 }}>{prep.clientName}</div>
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 3, fontFamily: APP_FONT_MONO }}>
            {prep.clientAge} yrs · {prep.clientOccupation}
          </div>
        </div>
      </div>

      {/* call facts */}
      <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          { k: 'WHEN', v: `${prep.date} · ${prep.time}` },
          { k: 'TYPE', v: PP_APPT_TYPES[prep.appointmentType] },
          { k: 'POLICY', v: PP_POLICY_TYPES[prep.policyType] },
          { k: 'EST. API', v: ppTtd(prep.estApi), gold: true },
        ].map((f, i) => (
          <div key={i} style={{ flex: '1 1 44%', minWidth: 0, padding: '8px 11px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{f.k}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: f.gold ? t.gold : t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.008em', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.v}</div>
          </div>
        ))}
      </div>

      {/* source + note */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginTop: 12 }}>
        <PPpill t={t} tone="teal">{PP_SOURCES[prep.source]}{prep.socialPlatform ? ` · ${prep.socialPlatform}` : ''}</PPpill>
        {prep.prepped ? <PPpill t={t} tone="teal">✓ Prepped</PPpill> : <PPpill t={t} tone="warn">Needs prep</PPpill>}
      </div>
      {prep.note && (
        <div style={{ position: 'relative', marginTop: 11, padding: '10px 12px', borderRadius: 9, background: t.surfaceSoft, border: `1px solid ${t.rule}`, fontSize: 11.5, color: t.ink, lineHeight: 1.5 }}>
          {prep.note}
        </div>
      )}

      {/* Objection rehearsal */}
      {prep.objections.length > 0 && (
        <div style={{ position: 'relative', marginTop: 13 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, marginBottom: 8 }}>
            REHEARSE THE OBJECTIONS · {prep.objections.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {prep.objections.map((o) => <ObjectionChip key={o} t={t} value={o} expanded />)}
          </div>
        </div>
      )}

      {/* CTA */}
      {!readOnly && (
        <div style={{ position: 'relative', display: 'flex', gap: 9, marginTop: 14 }}>
          <div style={{ flex: 1, padding: '11px 14px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: `0 4px 12px ${t.teal}44` }}>
            {prep.prepped ? 'Edit prep' : 'Finish prep'}
          </div>
          <div style={{ padding: '11px 14px', background: t.surface, color: t.gold, border: `1px solid ${t.gold}55`, borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Log Policy
          </div>
        </div>
      )}
    </div>
  );
}

// ── PrepRow — compact list item for later calls ─────────────────────────────
function PrepRow({ t, prep, readOnly = false }) {
  return (
    <div className="a-card" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: t.surfaceMute, color: t.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>
        {ppInitials(prep.clientName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prep.clientName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{prep.date} · {prep.time}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: t.inkFaint }}></span>
          <span style={{ fontSize: 10, color: t.inkMute }}>{PP_APPT_TYPES[prep.appointmentType]}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <ApptBadge t={t} inDays={prep.inDays} prepped={prep.prepped} />
        {!prep.prepped && <span style={{ fontSize: 9, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>NEEDS PREP</span>}
      </div>
    </div>
  );
}

// ── PrepListBody — hero + upcoming list ─────────────────────────────────────
function PrepListBody({ t, data, readOnly = false }) {
  const [hero, ...rest] = data.preps;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <NextCallHero t={t} prep={hero} readOnly={readOnly} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Later this week · {rest.length}</span>
          {!readOnly && <span style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPlus size={12} color={t.teal} stroke={2.4} /> New prep</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rest.map((p) => <PrepRow key={p.id} t={t} prep={p} readOnly={readOnly} />)}
        </div>
      </div>
    </div>
  );
}

// ── NewPrepSheet — bottom-sheet create flow ─────────────────────────────────
function FieldLabel({ t, children, req }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: t.inkMute, marginBottom: 5, letterSpacing: '0.02em' }}>{children}{req && <span style={{ color: t.danger }}> *</span>}</div>;
}
function FauxInput({ t, value, placeholder }) {
  const empty = !value;
  return (
    <div style={{ height: 42, display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 10, border: `1px solid ${empty ? t.rule : t.ruleStrong}`, background: t.surface, fontSize: 13.5, fontWeight: empty ? 500 : 600, color: empty ? t.inkDim : t.ink }}>
      {value || placeholder}
    </div>
  );
}
function FauxSelect({ t, value, placeholder }) {
  const empty = !value;
  return (
    <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderRadius: 10, border: `1px solid ${empty ? t.rule : t.ruleStrong}`, background: t.surface, fontSize: 13.5, fontWeight: empty ? 500 : 600, color: empty ? t.inkDim : t.ink }}>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder}</span>
      <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke={t.inkFaint} strokeWidth="1.8" strokeLinecap="round"><path d="M2 4l4 4 4-4" /></svg>
    </div>
  );
}

function NewPrepSheet({ t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
      {/* scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,13,9,0.4)', backdropFilter: 'blur(2px)' }}></div>
      {/* sheet */}
      <div className="a-rise" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%',
        background: t.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22,
        boxShadow: '0 -10px 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* handle + header */}
        <div style={{ flexShrink: 0, padding: '10px 0 4px' }}>
          <div style={{ width: 40, height: 5, borderRadius: 999, background: t.ruleStrong, margin: '0 auto' }}></div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 18px 12px', borderBottom: `1px solid ${t.rule}` }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.01em' }}>New joint-call prep</div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>Brief your manager on an upcoming call</div>
          </div>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: t.surfaceMute, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.inkMute }}>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div>
            <FieldLabel t={t} req>Client name</FieldLabel>
            <FauxInput t={t} value="Kevon Baptiste" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 92 }}><FieldLabel t={t}>Age</FieldLabel><FauxInput t={t} value="29" /></div>
            <div style={{ flex: 1 }}><FieldLabel t={t}>Occupation</FieldLabel><FauxInput t={t} value="Software developer" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><FieldLabel t={t}>Source</FieldLabel><FauxSelect t={t} value="Social Media" /></div>
            <div style={{ flex: 1 }}><FieldLabel t={t}>Platform</FieldLabel><FauxSelect t={t} value="Instagram" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><FieldLabel t={t}>Appointment</FieldLabel><FauxSelect t={t} value="2nd Interview" /></div>
            <div style={{ flex: 1 }}><FieldLabel t={t} req>Date</FieldLabel><FauxInput t={t} value="02 Dec 2026" /></div>
          </div>
          <div>
            <FieldLabel t={t}>Likely policy</FieldLabel>
            <FauxSelect t={t} value="Term Life" />
          </div>
          <div>
            <FieldLabel t={t}>Objections expected</FieldLabel>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {Object.keys(PP_OBJECTIONS).map((k) => {
                const on = k === 'no-need';
                return (
                  <div key={k} style={{ padding: '7px 12px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, border: `1.5px solid ${on ? t.warning : t.rule}`, background: on ? t.warningTint : t.surface, color: on ? t.warning : t.inkMute }}>
                    {PP_OBJECTIONS[k].label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ flexShrink: 0, padding: '12px 18px', borderTop: `1px solid ${t.rule}`, background: t.surface }}>
          <div style={{ padding: '13px', background: t.teal, color: '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, textAlign: 'center', boxShadow: `0 4px 12px ${t.teal}44` }}>
            Save prep
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { NextCallHero, PrepRow, PrepListBody, NewPrepSheet, FieldLabel, FauxInput, FauxSelect });
