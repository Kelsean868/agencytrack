// AgencyTrack — Monthly Recruiting v2. Desktop manager surface.
//   • MonthlyRecruitingScene — quarterly target + funnel stats + an 8-stage
//     pipeline board (kanban). The hire stage feeds the WAR Recruiting KPI.
//   • RecDrillDrawer — one candidate: stage timeline, referrer/owner, source,
//     note, and advance / move-stage actions.
// Wraps ManagerShell (active='recruiting'). teal = pipeline · gold = offer→hire.

// ── Target card — configurable, guidance-aware ────────────────────────────
function RecTargetCard({ t }) {
  const g = REC_TARGET;
  const pct = g.value ? Math.min(100, Math.round((g.licensedThisPeriod / g.value) * 100)) : 0;
  const met = g.value != null && g.licensedThisPeriod >= g.value;
  return (
    <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 18, padding: '16px 20px', background: t.surface, border: `1px solid ${met ? t.success + '44' : t.rule}`, borderRadius: 14, minWidth: 380 }}>
      <CompletionRing t={t} pct={met ? 100 : pct} size={56} color={met ? t.success : t.teal} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <RecEyebrow t={t} color={met ? t.success : t.teal}>{g.label} target</RecEyebrow>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em', fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>
          {g.licensedThisPeriod} of {g.value} licensed {met ? '· met ✓' : ''}
        </div>
        <div style={{ fontSize: 11, color: t.inkMute, marginTop: 3 }}>
          {g.isGuidance ? 'At least 1 per quarter' : 'Firm target'} · set by {g.setBy} · {g.contractedThisPeriod} more contracted
        </div>
      </div>
      <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 11.5, fontWeight: 700, color: t.inkMute, cursor: 'pointer', flexShrink: 0 }}>
        <IconSettings size={13} color={t.inkMute} /> Set target
      </div>
    </div>
  );
}

// ── Candidate mini card (in a pipeline column) ────────────────────────────
function CandidateMini({ t, c, onOpen }) {
  return (
    <div onClick={onOpen} className="a-card" style={{
      flexShrink: 0, padding: '11px 12px', background: t.surface,
      border: `1px solid ${c.stalled ? t.warning + '55' : t.rule}`, borderRadius: 11, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <CandidateAva t={t} initials={c.initials} size={30} stage={c.stage} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{c.source}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
        {c.stage === 'licensed' ? (
          <span style={{ fontSize: 9.5, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}>HIRED {c.hireDate}</span>
        ) : c.stalled ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO }}><IconClock size={10} color={t.warning} /> {c.days}d stalled</span>
        ) : (
          <span style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{c.days}d in stage</span>
        )}
        <span style={{ fontSize: 9.5, color: t.inkMute }}>↳ {c.owner.split(' ')[0]}</span>
      </div>
    </div>
  );
}

// ── Pipeline column (one stage) ───────────────────────────────────────────
function PipelineColumn({ t, stage, onOpen }) {
  const cands = candidatesByStage(stage.key);
  const c = stageColor(t, stage.key);
  return (
    <div style={{ width: 176, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Column header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: `2px solid ${c}`, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: c }}></span>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stage.short}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: APP_FONT_MONO }}>{cands.length}</span>
      </div>
      {/* Cards */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 2 }}>
        {cands.length ? cands.map((cand) => <CandidateMini key={cand.name} t={t} c={cand} onOpen={() => onOpen(cand.name)} />)
          : <div style={{ padding: '12px 10px', border: `1px dashed ${t.rule}`, borderRadius: 10, fontSize: 10.5, color: t.inkFaint, textAlign: 'center', fontStyle: 'italic' }}>Empty</div>}
      </div>
    </div>
  );
}

// ── Drill drawer — one candidate ──────────────────────────────────────────
function RecDrillDrawer({ t, name }) {
  const c = REC_CANDIDATES.find((x) => x.name === name) || REC_CANDIDATES[0];
  const hired = c.stage === 'licensed';
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)', animation: 'app-fade-in 280ms ease both', zIndex: 20 }}></div>
      <div className="a-card" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 460,
        background: t.surface, borderLeft: `1px solid ${t.rule}`, zIndex: 21,
        display: 'flex', flexDirection: 'column', animation: 'app-slide-in 320ms cubic-bezier(0.22,1,0.36,1) both',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.16)',
      }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${t.rule}` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>✕ Close</span>
          <div style={{ flex: 1 }}></div>
          <StagePill t={t} stage={c.stage} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <CandidateAva t={t} initials={c.initials} size={52} stage={c.stage} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY }}>{c.name}</div>
              <div style={{ fontSize: 12, color: t.inkMute, marginTop: 1 }}>{c.source} · {hired ? `hired ${c.hireDate}` : `${c.days} days in stage`}</div>
            </div>
          </div>

          {/* Referrer + owner */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div style={{ flex: 1, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>REFERRED BY</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 3 }}>{c.referrer}</div>
            </div>
            <div style={{ flex: 1, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>OWNED BY</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.ink, marginTop: 3 }}>{c.owner}</div>
            </div>
          </div>

          {/* Stage timeline */}
          <div style={{ marginTop: 18 }}>
            <RecEyebrow t={t} color={t.teal}>Pipeline stage</RecEyebrow>
            <div style={{ marginTop: 12 }}><StageTimeline t={t} stage={c.stage} vertical /></div>
          </div>

          {/* Note */}
          <div style={{ marginTop: 18 }}>
            <RecEyebrow t={t} color={t.inkFaint}>Latest note</RecEyebrow>
            <div style={{ marginTop: 9, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 12.5, color: t.ink, lineHeight: 1.55 }}>{c.note}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '14px 20px', borderTop: `1px solid ${t.rule}` }}>
          {hired ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', background: t.successTint, color: t.success, borderRadius: 10, fontSize: 12.5, fontWeight: 700, border: `1px solid ${t.success}44` }}>
              <IconCheck size={15} color={t.success} stroke={2.4} /> Hired &amp; active · counts toward WAR
            </div>
          ) : (
            <>
              <div className="a-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                <IconArrowR size={15} color="#fff" stroke={2.4} /> Advance stage
              </div>
              <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>Log touch</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── SCENE ─────────────────────────────────────────────────────────────────
function MonthlyRecruitingScene({ t, drawer = null }) {
  const stats = [
    { k: 'IN PIPELINE', v: REC_TOTAL, c: t.teal },
    { k: 'NEAR HIRE', v: REC_LATE_FUNNEL, c: t.gold },
    { k: 'STALLED', v: REC_STALLED, c: t.warning },
    { k: 'HIRED · QTR', v: REC_LICENSED, c: t.success },
  ];
  return (
    <ManagerShell t={t} active="recruiting" title="Monthly Recruiting" subtitle="Build the bench — anyone refers, you drive the pipeline">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', position: 'relative' }}>
        {/* Top strip — target + stats + add */}
        <div style={{ flexShrink: 0, display: 'flex', gap: 14, alignItems: 'stretch' }}>
          <RecTargetCard t={t} />
          <div className="a-card a-rise" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 26, padding: '16px 22px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
            {stats.map((s) => (
              <div key={s.k}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginTop: 4 }}>{s.k}</div>
              </div>
            ))}
            <div style={{ flex: 1 }}></div>
            <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
              <IconPlus size={16} color="#fff" stroke={2.4} /> Add candidate
            </div>
          </div>
        </div>

        {/* Pipeline board */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '16px 18px', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <RecEyebrow t={t} color={t.teal}>Pipeline · {REC_TOTAL} candidates</RecEyebrow>
            <span style={{ fontSize: 11, color: t.inkMute }}>Only “Licensed &amp; active” counts as a hire · feeds your WAR</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4 }}>
            {REC_STAGES.map((s) => <PipelineColumn key={s.key} t={t} stage={s} onOpen={() => {}} />)}
          </div>
        </div>

        {drawer && <RecDrillDrawer t={t} name={drawer} />}
      </div>
    </ManagerShell>
  );
}

Object.assign(window, {
  RecTargetCard, CandidateMini, PipelineColumn, RecDrillDrawer, MonthlyRecruitingScene,
});
