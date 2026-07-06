// Daily Capture v2 — scenes. Mobile (MFrame) for the agent surfaces; desktop
// (AppShell) for the manager/admin reporting-mode panel.

// ── Agent · daily entry (mobile) ────────────────────────────────────────────
function DailyEntryScene({ t }) {
  const data = DAILY_SAMPLE;
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Log Today" sub={`${data.dayOfWeek.toUpperCase()} · ${data.weekShort}`} />
      {/* scroll area (clipped) */}
      <div style={{ position: 'absolute', top: 108, left: 0, right: 0, bottom: 200, overflow: 'hidden', padding: '0 18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <DailyAnchorStrip t={t} data={data} />
          <DailyEntryBody t={t} data={data} hideSave />
        </div>
      </div>
      {/* fixed save CTA above nav */}
      <div style={{ position: 'absolute', left: 18, right: 18, bottom: 136, zIndex: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: t.teal, color: '#fff', borderRadius: 12, boxShadow: `0 8px 22px ${t.teal}66` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Save today</div>
            <div style={{ fontSize: 10.5, opacity: 0.85, fontFamily: APP_FONT_MONO }}>Rolls into your {data.weekShort} report</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.18)', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
            Log <IconArrowR size={14} color="#fff" stroke={2.6} />
          </div>
        </div>
      </div>
      <MNav t={t} active="submit" />
    </MFrame>
  );
}

// ── Agent · reporting-mode picker (mobile) ──────────────────────────────────
function ModePickerScene({ t, locked = false }) {
  const data = DAILY_SAMPLE;
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Reporting Mode" sub="DAILY CAPTURE · SETTINGS" />
      <MContent>
        <AgentModePicker t={t} data={data} locked={locked} />
      </MContent>
      <MNav t={t} active="more" />
    </MFrame>
  );
}

// ── Manager / admin · team mode panel (desktop) ─────────────────────────────
function ManagerModeScene({ t, isAdmin = false }) {
  const data = DAILY_SAMPLE;
  return (
    <AppShell t={t} active="" title="Reporting Mode" subtitle={isAdmin ? 'Tenant admin · company default + overrides' : `${data.manager.name} · set how your unit logs`}>
      <ManagerModePanel t={t} data={data} isAdmin={isAdmin} />
    </AppShell>
  );
}

Object.assign(window, { DailyEntryScene, ModePickerScene, ManagerModeScene });
