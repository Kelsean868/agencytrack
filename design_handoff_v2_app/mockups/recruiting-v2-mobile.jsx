// AgencyTrack — Monthly Recruiting v2. Mobile manager surface (390×844).
//   Tabbed: "Funnel" (target + stage-by-stage counts) and "People" (candidate
//   list). Uses MFrame + ManagerMNav. teal = pipeline · gold = offer→hire.

function RecMobileScene({ t, view = 'funnel' }) {
  return (
    <MFrame t={t}>
      {/* Header */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, padding: '8px 16px 0', background: t.surface, borderBottom: `1px solid ${t.rule}`, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 700, color: t.ink, letterSpacing: '-0.02em', fontFamily: APP_FONT_DISPLAY }}>Recruiting</div>
            <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{REC_TARGET.label} · {REC_TOTAL} in pipeline · {REC_LICENSED} hired</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${t.teal}44` }}>
            <IconPlus size={20} color="#fff" stroke={2.4} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, marginTop: 12, marginBottom: 12 }}>
          {[['funnel', 'Funnel'], ['people', `People · ${REC_TOTAL}`]].map(([k, l]) => {
            const on = k === view;
            return <div key={k} style={{ flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent' }}>{l}</div>;
          })}
        </div>
      </div>

      <div style={{ position: 'absolute', top: 168, left: 0, right: 0, bottom: 92, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {view === 'funnel' ? <RecFunnelMobile t={t} /> : <RecPeopleMobile t={t} />}
      </div>

      <ManagerMNav t={t} active="more" />
    </MFrame>
  );
}

function RecFunnelMobile({ t }) {
  const g = REC_TARGET;
  const met = g.value != null && g.licensedThisPeriod >= g.value;
  const maxCount = Math.max(...REC_STAGES.map((s) => candidatesByStage(s.key).length), 1);
  return (
    <>
      {/* Target hero */}
      <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 15, padding: '16px 18px', background: t.surface, border: `1px solid ${met ? t.success + '44' : t.rule}`, borderRadius: 17 }}>
        <div className="a-glow-soft" style={{ position: 'absolute', top: -70, right: -50, width: 200, height: 200, background: `radial-gradient(circle, ${met ? t.successTint : t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative' }}><CompletionRing t={t} pct={met ? 100 : 0} size={58} color={met ? t.success : t.teal} /></div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <RecEyebrow t={t} color={met ? t.success : t.teal}>{g.label} target</RecEyebrow>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>{g.licensedThisPeriod} of {g.value} licensed{met ? ' ✓' : ''}</div>
          <div style={{ fontSize: 11, color: t.inkMute, marginTop: 3 }}>At least 1 / quarter · {g.contractedThisPeriod} more contracted</div>
        </div>
      </div>

      {/* Vertical funnel */}
      <div className="a-card" style={{ flexShrink: 0, padding: '15px 17px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 15 }}>
        <RecEyebrow t={t} color={t.teal}>Pipeline by stage</RecEyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 13 }}>
          {REC_STAGES.map((s) => {
            const n = candidatesByStage(s.key).length;
            const c = stageColor(t, s.key);
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: c, flexShrink: 0 }}></span>
                <span style={{ width: 92, fontSize: 12, fontWeight: 600, color: t.ink, flexShrink: 0 }}>{s.short}</span>
                <div style={{ flex: 1, height: 8, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${(n / maxCount) * 100}%`, height: 8, background: c, borderRadius: 999, minWidth: n ? 6 : 0 }}></div>
                </div>
                <span style={{ width: 18, textAlign: 'right', fontSize: 13, fontWeight: 700, color: n ? t.ink : t.inkFaint, fontFamily: APP_FONT_MONO, flexShrink: 0 }}>{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function RecPeopleMobile({ t }) {
  // order by furthest-along first
  const ordered = [...REC_CANDIDATES].sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage));
  return (
    <>
      {ordered.map((c) => (
        <div key={c.name} className="a-card" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: t.surface, border: `1px solid ${c.stalled ? t.warning + '44' : t.rule}`, borderRadius: 14 }}>
          <CandidateAva t={t} initials={c.initials} size={38} stage={c.stage} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{c.name}</div>
            <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>
              {c.stage === 'licensed' ? `hired ${c.hireDate}` : c.stalled ? `${c.days}d stalled` : `${c.days}d · ↳ ${c.owner.split(' ')[0]}`}
            </div>
          </div>
          <StagePill t={t} stage={c.stage} small />
        </div>
      ))}
    </>
  );
}

Object.assign(window, { RecMobileScene, RecFunnelMobile, RecPeopleMobile });
