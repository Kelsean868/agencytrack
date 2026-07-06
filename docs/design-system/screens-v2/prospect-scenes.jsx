// Prospect Prep v2 — scenes (mobile-first) + the convert moment.

// ── Convert moment — prep closed into a policy (quiet celebration) ──────────
function ConvertMoment({ t }) {
  const c = PROSPECT_SAMPLE.converted;
  const glow = t.mode === 'light' ? t.gold + '44' : t.gold + '77';
  return (
    <MFrame t={t}>
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(3px)', opacity: 0.4, pointerEvents: 'none' }}>
        <MHeader t={t} title="Prospect Prep" sub="JOINT-CALL PREP" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: t.mode === 'light' ? 'rgba(247,246,242,0.84)' : 'rgba(16,13,9,0.86)' }}></div>
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '78%', height: '42%', background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`, pointerEvents: 'none' }}></div>
      <DCConfetti colors={[t.gold, t.teal, t.tealLight, '#fde9a8', '#fff']} count={36} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
        <div className="dc-pop" style={{ position: 'relative', width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle at 32% 26%, #fde9a8 0%, #e0aa3e 48%, #a06b12 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 -5px 12px rgba(0,0,0,0.22), inset 0 5px 12px rgba(255,255,255,0.42), 0 0 34px ${glow}`, marginBottom: 22 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <div className="dc-rise2 dc-rd1" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: t.gold, fontFamily: APP_FONT_MONO }}>CALL CLOSED · POLICY LOGGED</div>
        <div className="dc-rise2 dc-rd2" style={{ fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: '-0.028em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.08, marginTop: 10 }}>
          {c.clientName} signed
        </div>
        <div className="dc-rise2 dc-rd2" style={{ fontSize: 13, color: t.inkMute, lineHeight: 1.55, marginTop: 11, maxWidth: 290 }}>
          Your joint call converted — <b style={{ color: t.ink }}>{PP_POLICY_TYPES[c.policyType]}</b>, {ppTtd(c.api)} API. It's on your policy ledger and counts toward your week.
        </div>
        <div className="dc-rise2 dc-rd3" style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          {[{ k: 'POLICY', v: PP_POLICY_TYPES[c.policyType] }, { k: 'API', v: ppTtd(c.api) }].map((s, i) => (
            <div key={i} style={{ padding: '11px 18px', borderRadius: 12, background: i === 1 ? t.goldTint : t.surfaceSoft, border: `1px solid ${i === 1 ? t.gold + '55' : t.rule}` }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: i === 1 ? t.gold : t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>{s.k}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY, marginTop: 5 }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div className="dc-rise2 dc-rd3" style={{ marginTop: 24, padding: '12px 26px', background: t.teal, color: '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700, boxShadow: `0 4px 14px ${t.teal}55` }}>
          View on ledger
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: t.ink, borderRadius: 999, opacity: 0.85, zIndex: 30 }}></div>
    </MFrame>
  );
}

// ── Mobile scenes ───────────────────────────────────────────────────────────
function ProspectMobileScene({ t, sheet = false }) {
  const data = PROSPECT_SAMPLE;
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Prospect Prep" sub="JOINT-CALL PREP" />
      <MContent>
        <PrepListBody t={t} data={data} />
      </MContent>
      <MNav t={t} active="more" />
      {sheet && <NewPrepSheet t={t} />}
    </MFrame>
  );
}

// ── Desktop scene ───────────────────────────────────────────────────────────
function ProspectDesktopScene({ t, managerView = false }) {
  const data = PROSPECT_SAMPLE;
  const title = managerView ? `${data.agent} · Prospect Prep` : 'Prospect Prep';
  const sub = managerView
    ? `Viewing as ${data.manager.name} · read-only ahead of your joint call`
    : `${data.agent} · ${data.today} · prep for upcoming joint calls`;
  return (
    <AppShell t={t} active="prospect" title={title} subtitle={sub}>
      <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {managerView && <PPManagerBanner t={t} data={data} />}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1.3, minWidth: 0, display: 'flex' }}>
            <NextCallHero t={t} prep={data.preps[0]} readOnly={managerView} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Later this week · {data.preps.length - 1}</div>
            {data.preps.slice(1).map((p) => <PrepRow key={p.id} t={t} prep={p} readOnly={managerView} />)}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Mobile "More" hub — shows WHERE Prospect Prep lives in the mobile app ──
function MoreHubScene({ t }) {
  const tiles = [
    { key: 'goals',     label: 'Goals',        Icon: IconTarget, tint: t.tealTint,  fg: t.teal },
    { key: 'gameplan',  label: 'Game Plan',    Icon: IconChart,  tint: t.tealTint,  fg: t.teal },
    { key: 'commission',label: 'Commission',   Icon: IconBolt,   tint: t.tealTint,  fg: t.teal },
    { key: 'persist',   label: 'Persistency',  Icon: IconRepeat, tint: t.tealTint,  fg: t.teal },
    { key: 'ledger',    label: 'Policy Ledger',Icon: IconBook,   tint: t.tealTint,  fg: t.teal },
    { key: 'prospect',  label: 'Prospect Prep',Icon: IconSearch, tint: t.tealTint,  fg: t.teal, highlight: true },
    { key: 'awards',    label: 'Awards',       Icon: IconMedal,  tint: t.goldTint,  fg: t.gold },
    { key: 'career',    label: 'Career Portal',Icon: IconShield, tint: t.goldTint,  fg: t.gold },
    { key: 'settings',  label: 'Settings',     Icon: IconSettings,tint: t.surfaceMute, fg: t.inkMute },
  ];
  return (
    <MFrame t={t}>
      <MHeader t={t} title="More" sub="ALL TOOLS" />
      <MContent>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 11 }}>
          {tiles.map((tile) => (
            <div key={tile.key} style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
              padding: '16px 8px', borderRadius: 14,
              background: tile.highlight ? tile.tint : t.surface,
              border: `1.5px solid ${tile.highlight ? tile.fg : t.rule}`,
              boxShadow: tile.highlight ? `0 4px 14px ${tile.fg}33` : 'none',
            }}>
              {tile.highlight && (
                <div style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: tile.fg }}></div>
              )}
              <div style={{ width: 42, height: 42, borderRadius: 11, background: tile.tint, color: tile.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <tile.Icon size={20} color={tile.fg} stroke={1.9} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.2 }}>{tile.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 11, background: t.tealTint, border: `1px solid ${t.teal}33`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconSearch size={16} color={t.teal} stroke={2} />
          <div style={{ fontSize: 11.5, color: t.ink, lineHeight: 1.45 }}>
            <b>Prospect Prep</b> lives here under More — open it to brief your manager before a joint call.
          </div>
        </div>
      </MContent>
      <MNav t={t} active="more" />
    </MFrame>
  );
}

Object.assign(window, { ConvertMoment, ProspectMobileScene, ProspectDesktopScene, MoreHubScene });
