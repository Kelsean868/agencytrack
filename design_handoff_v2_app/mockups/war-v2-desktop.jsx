// AgencyTrack — Weekly WARs v2. Desktop manager surface.
//   • WeeklyWarsScene — My WAR (file my own) + team matrix (who filed / behind)
//     + review queue, with an 8-week consistency read.
//   • WarDrillDrawer — one leader's full WAR: KPIs, production, note, history,
//     approve / request changes.
// Wraps ManagerShell (active='war'). teal = ops · gold = recognition (streaks).

// ── Header strip — week + filing state + configure-targets affordance ─────
function WarHeaderStrip({ t }) {
  const stats = [
    { k: 'FILED', v: `${WAR_FILED}/${WAR_TEAM.length}`, c: t.success },
    { k: 'TO REVIEW', v: WAR_PENDING_REVIEW, c: t.teal },
    { k: 'NOT FILED', v: WAR_NOT_FILED, c: t.danger },
  ];
  return (
    <div className="a-card a-rise" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 22, padding: '15px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
      <div>
        <WAREyebrow t={t} color={t.teal}>Week 48 · WAR cycle</WAREyebrow>
        <div style={{ fontSize: 13, color: t.inkMute, marginTop: 5 }}>Reports due Monday 9 AM · your branch leadership team</div>
      </div>
      <div style={{ width: 1, alignSelf: 'stretch', background: t.rule, margin: '2px 0' }}></div>
      <div style={{ display: 'flex', gap: 26 }}>
        {stats.map((s) => (
          <div key={s.k}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.c, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO, marginTop: 4 }}>{s.k}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}></div>
      <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>
        <IconSettings size={14} color={t.inkMute} /> Configure targets
      </div>
    </div>
  );
}

// ── My WAR — file my own leadership report ────────────────────────────────
function MyWarCard({ t }) {
  const w = MY_WAR;
  const pct = warCompletion(w.kpis);
  return (
    <div className="a-card a-rise" style={{ flexShrink: 0, position: 'relative', overflow: 'hidden', padding: '18px 20px', background: t.surface, border: `1px solid ${t.teal}44`, borderRadius: 16 }}>
      <div className="a-glow-soft" style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, background: `radial-gradient(circle, ${t.tealTint} 0%, transparent 65%)`, pointerEvents: 'none' }}></div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 13 }}>
        <CompletionRing t={t} pct={pct} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <WAREyebrow t={t} color={t.teal}>My WAR · {w.week}</WAREyebrow>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>Leadership activities</div>
        </div>
        <WarStatusPill t={t} status={w.status} />
      </div>

      {/* Production block — manager also sells */}
      <div style={{ position: 'relative', display: 'flex', gap: 10, marginTop: 15 }}>
        <div style={{ flex: 1, padding: '10px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>MY API · THIS WEEK</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{ttd(w.prod.apiWeek)}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>APPLICATIONS</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{w.prod.apps}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 13px', background: t.goldTint, border: `1px solid ${t.gold}33`, borderRadius: 11 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>FILING STREAK</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, letterSpacing: '-0.02em', marginTop: 3 }}>{w.streak} wks</div>
        </div>
      </div>

      {/* Managerial KPIs grid */}
      <div style={{ position: 'relative', marginTop: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>MANAGERIAL KPIs</span>
          <span style={{ fontSize: 10, color: t.inkFaint, fontStyle: 'italic' }}>Targets set by upper management · none mandatory yet</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
          {WAR_KPIS.map((k) => <WarKpiChip key={k.key} t={t} kpi={k} value={w.kpis[k.key]} />)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ position: 'relative', display: 'flex', gap: 10, marginTop: 16 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 16px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${t.teal}44` }}>
          <IconCheck size={15} color="#fff" stroke={2.4} /> Submit my WAR
        </div>
        <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>
          File weekly report
        </div>
      </div>
    </div>
  );
}

// ── Team matrix row ───────────────────────────────────────────────────────
function TeamWarRow({ t, m, onOpen }) {
  const pct = warCompletion(m.kpis);
  const sm = warStatusMeta(t, m.status);
  const filed = m.status === 'filed';
  return (
    <div onClick={onOpen} className="a-card" style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 15px',
      background: t.surface, border: `1px solid ${m.status === 'missing' ? t.danger + '33' : t.rule}`, borderRadius: 12, cursor: 'pointer',
    }}>
      {filed ? <CompletionRing t={t} pct={pct} size={42} stroke={4.5} /> : (
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {m.status === 'draft' ? <IconClock size={18} color={sm.fg} /> : <IconAlert size={18} color={sm.fg} />}
        </div>
      )}
      <div style={{ width: 168, flexShrink: 0, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.005em' }}>{m.name}</div>
        <div style={{ fontSize: 10.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{m.role} · {m.unit}</div>
      </div>

      {/* KPI mini-dots */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
        {WAR_KPIS.map((k) => {
          const v = m.kpis[k.key];
          const met = k.kind === 'check' ? !!v : (k.target != null ? v >= k.target : v > 0);
          const fg = met ? t.success : v > 0 ? t.warning : t.inkDim;
          return (
            <div key={k.key} title={k.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: fg }}></span>
              <span style={{ fontSize: 9, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>{k.kind === 'check' ? (v ? '✓' : '·') : v}</span>
            </div>
          );
        })}
      </div>

      {/* Streak */}
      <div style={{ flexShrink: 0 }}><StreakDots t={t} history={WAR_HISTORY[m.name]} label={false} /></div>

      {/* Status / action */}
      <div style={{ width: 120, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        {filed && !m.reviewed ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: t.teal, color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>Review</span>
        ) : filed && m.reviewed ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: t.success, fontFamily: APP_FONT_MONO }}><IconCheck size={13} color={t.success} stroke={2.4} /> Reviewed</span>
        ) : (
          <WarStatusPill t={t} status={m.status} />
        )}
      </div>
      <IconChevR size={15} color={t.inkFaint} stroke={2.4} />
    </div>
  );
}

// ── Drill drawer — one leader's full WAR ──────────────────────────────────
function WarDrillDrawer({ t, name }) {
  const m = WAR_TEAM.find((x) => x.name === name) || WAR_TEAM[0];
  const pct = warCompletion(m.kpis);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)', animation: 'app-fade-in 280ms ease both', zIndex: 20 }}></div>
      <div className="a-card" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 480,
        background: t.surface, borderLeft: `1px solid ${t.rule}`, zIndex: 21,
        display: 'flex', flexDirection: 'column', animation: 'app-slide-in 320ms cubic-bezier(0.22,1,0.36,1) both',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.16)',
      }}>
        {/* Close strip */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${t.rule}` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>✕ Close</span>
          <div style={{ flex: 1 }}></div>
          <WarStatusPill t={t} status={m.status} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <CompletionRing t={t} pct={pct} size={56} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: t.ink, letterSpacing: '-0.015em', fontFamily: APP_FONT_DISPLAY }}>{m.name}</div>
              <div style={{ fontSize: 12, color: t.inkMute, marginTop: 1 }}>{m.role} · {m.unit}{m.filedOn ? ` · filed ${m.filedOn}` : ''}</div>
            </div>
          </div>

          {/* Production */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div style={{ flex: 1, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>OWN API</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>{ttd(m.prod.apiWeek)}</div>
            </div>
            <div style={{ flex: 1, padding: '11px 13px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>APPS</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>{m.prod.apps}</div>
            </div>
            <div style={{ flex: 1, padding: '11px 13px', background: t.goldTint, border: `1px solid ${t.gold}33`, borderRadius: 11 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.gold, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>STREAK</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.gold, fontFamily: APP_FONT_DISPLAY, marginTop: 3 }}>{m.streak} wks</div>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ marginTop: 18 }}>
            <WAREyebrow t={t} color={t.teal}>Managerial KPIs</WAREyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 11 }}>
              {WAR_KPIS.map((k) => <WarKpiChip key={k.key} t={t} kpi={k} value={m.kpis[k.key]} />)}
            </div>
          </div>

          {/* Note */}
          {m.note && (
            <div style={{ marginTop: 18 }}>
              <WAREyebrow t={t} color={t.inkFaint}>Leader's note</WAREyebrow>
              <div style={{ marginTop: 9, padding: '12px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11, fontSize: 12.5, color: t.ink, lineHeight: 1.55 }}>{m.note}</div>
            </div>
          )}

          {/* History */}
          <div style={{ marginTop: 18 }}>
            <WAREyebrow t={t} color={t.inkFaint}>Filing consistency · 8 weeks</WAREyebrow>
            <div style={{ marginTop: 10 }}><StreakDots t={t} history={WAR_HISTORY[m.name]} /></div>
          </div>
        </div>

        {/* Footer actions */}
        {m.status === 'filed' && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '14px 20px', borderTop: `1px solid ${t.rule}` }}>
            <div className="a-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', background: t.teal, color: '#fff', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              <IconCheck size={15} color="#fff" stroke={2.4} /> Approve WAR
            </div>
            <div className="a-card" style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 16px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: t.inkMute, cursor: 'pointer' }}>Request changes</div>
          </div>
        )}
      </div>
    </>
  );
}

// ── SCENE ─────────────────────────────────────────────────────────────────
function WeeklyWarsScene({ t, drawer = null }) {
  return (
    <ManagerShell t={t} active="war" title="Weekly WARs" subtitle="Weekly Activity Reports — file yours, review your leaders'">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden', position: 'relative' }}>
        <WarHeaderStrip t={t} />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, overflow: 'hidden' }}>
          {/* Left — My WAR */}
          <div style={{ width: 430, flexShrink: 0, overflowY: 'auto', paddingRight: 4 }}>
            <MyWarCard t={t} />
          </div>

          {/* Right — team matrix */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0 }}>
              <WAREyebrow t={t} color={t.warning}>★ Team WARs · {WAR_PENDING_REVIEW} to review</WAREyebrow>
              <span style={{ fontSize: 11, color: t.inkMute }}>Tap a leader to review their report</span>
            </div>
            {/* KPI legend */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 15px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>KPIs:</span>
              {WAR_KPIS.map((k) => (
                <span key={k.key} style={{ fontSize: 10, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{k.label}</span>
              ))}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, paddingRight: 4 }}>
              {WAR_TEAM.map((m) => <TeamWarRow key={m.name} t={t} m={m} onOpen={() => {}} />)}
            </div>
          </div>
        </div>

        {drawer && <WarDrillDrawer t={t} name={drawer} />}
      </div>
    </ManagerShell>
  );
}

Object.assign(window, {
  WarHeaderStrip, MyWarCard, TeamWarRow, WarDrillDrawer, WeeklyWarsScene,
});
