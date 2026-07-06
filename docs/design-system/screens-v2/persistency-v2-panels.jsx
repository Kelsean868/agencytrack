// Persistency v2 — drawer panels: manager entry (precedence lock) + playground.

const PERS_TARGET = { name: 'Priya Naidu', unit: 'S·01', initials: 'PN', level: 'L1', pct: 72 };

// Manager entry — the six business inputs → derived persistency. Manager-wins
// precedence: saving locks the month and overrides the agent's self-entry.
function PersEntryForm({ t, agent = PERS_TARGET }) {
  const inputs = [
    { l: 'Gross settled API', v: 'TTD 13,000', mono: true },
    { l: 'Net settled API',   v: 'TTD 9,360',  mono: true },
    { l: 'Lapses (TTD)',      v: 'TTD 3,640',  mono: true, warn: true },
    { l: 'Reinstatements (TTD)', v: 'TTD 655', mono: true },
    { l: 'Policies in force', v: '48' },
    { l: 'Policies issued (mth)', v: '6' },
  ];
  const band = persBand(t, agent.pct);
  return (
    <>
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
        <Eyebrow t={t} color={t.teal}>Persistency · {PERS_MONTH}</Eyebrow>
        <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>Edit {agent.name}</div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 3 }}>{agent.unit} · {agent.level} · enter the month's six figures</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GoldBanner t={t}
          title="Priya self-entered this month — you're overriding it"
          body="Saving locks the month. Your figures take precedence over her self-entry, and she'll see the record as read-only with your name on it." />

        {/* Derived persistency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: band.bg, border: `1px solid ${band.fg}33`, borderRadius: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: band.fg, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>DERIVED PERSISTENCY</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.026em', lineHeight: 1, marginTop: 5 }}>{agent.pct}%</div>
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ textAlign: 'right', fontSize: 11.5, color: t.inkMute, lineHeight: 1.5 }}>Computed from net ÷ gross<br/>settled, net of lapses<br/><span style={{ color: band.fg, fontWeight: 700 }}>{band.label} · {PERS_FLOOR}% floor</span></div>
        </div>

        {/* Six inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {inputs.map((f) => (
            <div key={f.l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{f.l}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 8, fontSize: 13, fontWeight: 700, color: f.warn ? t.warning : t.ink, fontFamily: APP_FONT_MONO }}>{f.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, display: 'flex', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: '0 0 auto', padding: '11px 18px', background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 9, fontSize: 13, fontWeight: 700, color: t.ink }}>Cancel</div>
        <div style={{ flex: 1, padding: '11px 18px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px ${t.teal}44` }}>
          <IconShield size={14} color="#fff" /> Save &amp; lock the month
        </div>
      </div>
    </>
  );
}

// Persistency playground — what-if coaching. Levers → projected % vs the gate.
function PersPlayground({ t, agent = PERS_TARGET }) {
  const current = agent.pct;       // 72
  const projected = 86;            // with the levers below
  const gate = PERS_GATE;
  const levers = [
    { l: 'Policies saved / month', val: '6', pos: 62, hint: '+9 pp' },
    { l: 'Additional clean API / quarter', val: 'TTD 40k', pos: 45, hint: '+5 pp' },
  ];
  const atRisk = [
    { c: 'A. Gopaul', p: 'Whole Life · TTD 1,200 API', d: 'Grace ends 12 Dec' },
    { c: 'R. Mohammed', p: 'Term · TTD 480 API', d: 'Missed 2 payments' },
    { c: 'K. Baksh', p: 'WL · TTD 2,100 API', d: 'NSF — retry pending' },
  ];
  return (
    <>
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${t.rule}`, flexShrink: 0 }}>
        <Eyebrow t={t} color={t.teal}>Persistency playground · coaching</Eyebrow>
        <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY, marginTop: 6 }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: t.inkMute, marginTop: 3 }}>{agent.unit} · model the path back above the {gate}% gate</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Current → projected */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, padding: '12px 14px', background: t.dangerTint, border: `1px solid ${t.danger}33`, borderRadius: 11 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.danger, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>NOW</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{current}%</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: t.inkFaint }}><IconArrowR size={18} color={t.inkFaint} stroke={2.2} /></div>
          <div style={{ flex: 1, padding: '12px 14px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 11 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.warning, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>PROJECTED</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{projected}%</div>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', background: t.successTint, border: `1px solid ${t.success}33`, borderRadius: 11 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.success, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO }}>GATE</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>{gate}%</div>
          </div>
        </div>
        {/* Projected bar vs gate */}
        <div style={{ position: 'relative', height: 8, background: t.surfaceMute, borderRadius: 999 }}>
          <div className="a-progress-grow" style={{ width: `${projected}%`, height: 8, background: `linear-gradient(90deg, ${t.warning}, ${t.warning})`, borderRadius: 999 }}></div>
          <div style={{ position: 'absolute', top: -3, left: `${gate}%`, width: 2, height: 14, background: t.success, borderRadius: 999 }}></div>
        </div>
        <div style={{ fontSize: 11, color: t.inkMute, marginTop: -6 }}>The two levers below still leave her <b style={{ color: t.warning }}>4 pp</b> short of the gate — needs one more.</div>

        {/* Levers */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO, marginBottom: 10 }}>Levers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {levers.map((lv) => (
              <div key={lv.l}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{lv.l}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>{lv.hint}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_MONO, padding: '4px 10px', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 8 }}>{lv.val}</span>
                  </span>
                </div>
                <div style={{ position: 'relative', height: 6, background: t.surfaceMute, borderRadius: 999 }}>
                  <div style={{ width: `${lv.pos}%`, height: 6, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
                  <div style={{ position: 'absolute', top: '50%', left: `${lv.pos}%`, transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: t.surface, border: `2px solid ${t.teal}`, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* At-risk policies → Policy Ledger */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Her at-risk policies</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.teal }}>Open Policy Ledger →</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {atRisk.map((p) => (
              <div key={p.c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: t.warning, flexShrink: 0 }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink }}>{p.c}</div>
                  <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{p.p}</div>
                </div>
                <div style={{ fontSize: 10.5, color: t.warning, fontWeight: 600, fontFamily: APP_FONT_MONO }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 18px', borderTop: `1px solid ${t.rule}`, background: t.surfaceSoft, display: 'flex', gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, padding: '11px 18px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 12px ${t.teal}44` }}>
          Share this plan with {agent.name.split(' ')[0]} <IconArrowR size={14} color="#fff" stroke={2.4} />
        </div>
      </div>
    </>
  );
}

Object.assign(window, { PERS_TARGET, PersEntryForm, PersPlayground });
