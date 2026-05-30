// Daily Capture v2 — reporting-mode surfaces.
//   AgentModePicker  — agent chooses daily / weekly / hybrid (mobile),
//                      with locked/suggested states from a manager override.
//   ManagerModePanel — manager/admin sets mode across the team with
//                      recommend vs lock + provenance + a tenant default.

const _MODE_ICON = { daily: IconClock, weekly: IconWizard, hybrid: IconRepeat };

// ── Agent mode picker (mobile) ──────────────────────────────────────────────
function AgentModePicker({ t, data, locked = false }) {
  const active = data.mode;
  const prov = locked
    ? { source: 'mgr', by: 'T. Ramcharan · Unit Mgr', locked: true }
    : data.modeProvenance;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Lock / suggestion banner */}
      {locked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: t.warningTint, border: `1px solid ${t.warning}44`, borderRadius: 11, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: t.surface, border: `1px solid ${t.warning}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: t.warning }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>Your manager set this to Daily</div>
            <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Locked by T. Ramcharan · ask to change</div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>
        {locked ? 'Your reporting mode' : 'How do you want to report?'}
      </div>

      {DC_MODES.map((m) => {
        const isActive = m.key === active;
        const Ico = _MODE_ICON[m.key];
        const tone = m.key === 'daily' ? t.teal : m.key === 'weekly' ? t.inkAccent : t.gold;
        return (
          <div key={m.key} style={{
            display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', flexShrink: 0,
            background: isActive ? (m.key === 'daily' ? t.tealTint : m.key === 'weekly' ? t.inkAccentTint : t.goldTint) : t.surface,
            border: `1.5px solid ${isActive ? tone : t.rule}`, borderRadius: 12,
            opacity: locked && !isActive ? 0.5 : 1,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: isActive ? tone : t.surfaceMute, color: isActive ? '#fff' : t.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ico size={19} color={isActive ? '#fff' : t.inkMute} stroke={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, fontFamily: APP_FONT_DISPLAY }}>{m.label}</div>
              <div style={{ fontSize: 11, color: t.inkMute, marginTop: 1 }}>{m.blurb}</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${isActive ? tone : t.ruleStrong}`,
              background: isActive ? tone : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isActive && <IconCheck size={12} color="#fff" stroke={3} />}
            </div>
          </div>
        );
      })}

      {/* Transition note */}
      <div style={{ flexShrink: 0, padding: '11px 14px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 11 }}>
        <div style={{ fontSize: 10.5, color: t.inkMute, lineHeight: 1.5 }}>
          <b style={{ color: t.ink }}>Switching mid-week is safe.</b> Daily entries roll into your weekly report automatically; switching to daily turns this week's draft into a catch-up entry. Nothing is lost.
        </div>
      </div>

      {!locked && (
        <div style={{ flexShrink: 0, padding: '12px 16px', background: t.teal, color: '#fff', borderRadius: 11, fontSize: 13.5, fontWeight: 700, textAlign: 'center', boxShadow: `0 4px 12px ${t.teal}44` }}>
          Save preference
        </div>
      )}
    </div>
  );
}

// ── Manager / admin team mode panel (desktop) ───────────────────────────────
function ManagerModePanel({ t, data, isAdmin = false }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DCManagerBanner t={t} data={data} />

      {/* Tenant default */}
      <div className="a-card a-rise" style={{ flexShrink: 0, padding: '16px 20px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <Eyebrow t={t} color={t.inkAccent}>COMPANY DEFAULT</Eyebrow>
          <div style={{ fontSize: 13, color: t.inkMute, marginTop: 6, lineHeight: 1.4 }}>
            New agents start here. {isAdmin ? 'You can change the tenant-wide default.' : 'Set by the tenant admin in Company Config.'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ModeBadge t={t} mode={data.tenantDefault} size="lg" />
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
              {DC_MODES.map((m) => {
                const on = m.key === data.tenantDefault;
                return <div key={m.key} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.ink : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent' }}>{m.label}</div>;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team list */}
      <div className="a-card" style={{ flexShrink: 0, padding: '8px 0 4px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: APP_FONT_MONO }}>Unit S·02 · 6 agents</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.tealTint, border: `1px solid ${t.teal}44`, borderRadius: 8, color: t.teal, fontSize: 11, fontWeight: 700 }}>
            <IconUsers size={13} color={t.teal} stroke={2} /> Set whole unit
          </div>
        </div>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 18px', borderBottom: `1px solid ${t.rule}` }}>
          <div style={{ flex: 1, fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>AGENT</div>
          <div style={{ width: 120, fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>SET BY</div>
          <div style={{ width: 90, fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>LAST LOG</div>
          <div style={{ width: 210, textAlign: 'right', fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.1em', fontFamily: APP_FONT_MONO }}>MODE · RECOMMEND / LOCK</div>
        </div>
        {data.team.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: i < data.team.length - 1 ? `1px solid ${t.rule}` : 'none' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, fontFamily: APP_FONT_DISPLAY, flexShrink: 0 }}>{a.name.split(' ').map(s=>s[0]).join('')}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ fontSize: 9.5, color: t.inkFaint, fontFamily: APP_FONT_MONO, marginTop: 1 }}>{a.unit}</div>
              </div>
            </div>
            <div style={{ width: 120, fontSize: 10, color: a.assigned ? t.gold : t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.02em', lineHeight: 1.3 }}>
              {a.setBy === 'self' ? 'Agent\u2019s choice' : a.setBy}
            </div>
            <div style={{ width: 90, fontSize: 10.5, fontWeight: 600, color: a.behind ? t.warning : t.inkMute, fontFamily: APP_FONT_MONO }}>{a.lastLogged}</div>
            <div style={{ width: 210, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              {/* mode segmented */}
              <div style={{ display: 'flex', gap: 2, padding: 2, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 8 }}>
                {['daily','weekly','hybrid'].map((mk) => {
                  const on = a.mode === mk;
                  const tone = mk === 'daily' ? t.teal : mk === 'weekly' ? t.inkAccent : t.gold;
                  return <div key={mk} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9.5, fontWeight: 700, fontFamily: APP_FONT_MONO, background: on ? t.surface : 'transparent', color: on ? tone : t.inkFaint, border: on ? `1px solid ${tone}44` : '1px solid transparent' }}>{mk[0].toUpperCase()}</div>;
                })}
              </div>
              {/* lock toggle */}
              <div title={a.locked ? 'Locked' : 'Recommend'} style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: a.locked ? t.warningTint : t.surfaceSoft,
                border: `1px solid ${a.locked ? t.warning + '55' : t.rule}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: a.locked ? t.warning : t.inkFaint,
              }}>
                {a.locked ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></svg>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { AgentModePicker, ManagerModePanel });
