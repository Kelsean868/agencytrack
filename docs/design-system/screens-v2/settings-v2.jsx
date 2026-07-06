// Settings v2 — the central customization surface (reached from the avatar /
// profile menu). Consolidates the app's scattered customizations into one
// place, scoped by role with an inheritance + lock model that reuses the
// recommend-vs-lock grammar from Goals:
//
//   • My Preferences — personal, affects only your view (every user).
//   • Team Defaults  — defaults a manager sets for the levels beneath them;
//     each can be RECOMMENDED (lower roles may override) or LOCKED (lower
//     roles see it read-only, with "Locked by …" provenance).
//   • Account — profile basics.
//
// A setting resolves down the hierarchy Company → SM → Branch → Unit → Agent;
// if a higher role locked it, you can't change it. In-context controls (the
// Tweaks-style panels on each surface) read/write the same stored value — this
// is the canonical home, not a replacement.

const ROLE_RANK = { company: 0, sm: 1, branch: 2, unit: 3, agent: 4 };
const ROLE_NAME = { company: 'Company', sm: 'Sales Manager', branch: 'South Branch · Trevor R.', unit: 'Unit S·02', agent: 'You' };
const ROLE_TITLE = { sm: 'Sales Manager', branch: 'Branch Manager', unit: 'Unit Manager', agent: 'Agent' };

// ── controls ───────────────────────────────────────────────────────────────
function SgSeg({ t, options, value, disabled }) {
  return (
    <div style={{ display: 'inline-flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, opacity: disabled ? 0.55 : 1 }}>
      {options.map((o) => {
        const on = o === value;
        return <div key={o} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: on ? (disabled ? t.inkDim : t.teal) : 'transparent', color: on ? '#fff' : t.inkMute, whiteSpace: 'nowrap' }}>{o}</div>;
      })}
    </div>
  );
}
function SgToggle({ t, on, disabled }) {
  return (
    <div style={{ width: 42, height: 24, borderRadius: 999, background: on ? (disabled ? t.inkDim : t.teal) : t.surfaceMute, border: `1px solid ${on ? 'transparent' : t.ruleStrong}`, position: 'relative', flexShrink: 0, opacity: disabled ? 0.6 : 1 }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></div>
    </div>
  );
}
function SgSelect({ t, value, disabled }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 12px', background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: t.ink, opacity: disabled ? 0.55 : 1 }}>
      {value} <IconChevD size={12} color={t.inkMute} stroke={2.2} />
    </div>
  );
}
function SgSwatches({ t, values }) {
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      {values.map((c, i) => <div key={i} style={{ width: 24, height: 24, borderRadius: 7, background: c, border: i === 0 ? `2px solid ${t.ink}` : `1px solid ${t.rule}` }}></div>)}
    </div>
  );
}
function LockChip({ t, by }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.inkMute} strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>LOCKED BY {by.toUpperCase()}</span>
    </div>
  );
}

// ── a setting row ────────────────────────────────────────────────────────
// row: { label, desc, control, value, options, lockedBy, recommendedBy }
function SettingRow({ t, row, role, teamMode }) {
  const lockedAbove = row.lockedBy && ROLE_RANK[row.lockedBy] < ROLE_RANK[role];
  const control = (dis) => {
    if (row.control === 'toggle') return <SgToggle t={t} on={row.value} disabled={dis} />;
    if (row.control === 'segmented') return <SgSeg t={t} options={row.options} value={row.value} disabled={dis} />;
    if (row.control === 'swatch') return <SgSwatches t={t} values={row.options} />;
    if (row.control === 'action') return <div style={{ padding: '7px 13px', background: t.surfaceSoft, border: `1px solid ${t.ruleStrong}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.ink }}>{row.value}</div>;
    return <SgSelect t={t} value={row.value} disabled={dis} />;
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderTop: `1px solid ${t.rule}`, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: lockedAbove ? t.inkMute : t.ink }}>{row.label}</div>
        {row.desc && <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 2, lineHeight: 1.4 }}>{row.desc}</div>}
        {lockedAbove && <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4 }}>Set by {ROLE_NAME[row.lockedBy]} — you can't change this.</div>}
        {!lockedAbove && row.recommendedBy && <div style={{ fontSize: 11, color: t.teal, marginTop: 4 }}>Recommended by {ROLE_NAME[row.recommendedBy]} — you can change it.</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {lockedAbove ? <LockChip t={t} by={row.lockedBy === 'company' ? 'company' : row.lockedBy === 'sm' ? 'Sales Mgr' : 'Branch'} /> : control(false)}
        {/* Team Defaults: lock-for-team toggle */}
        {teamMode && !lockedAbove && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 12, borderLeft: `1px solid ${t.rule}` }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: row.lockForTeam ? t.gold : t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.04em' }}>{row.lockForTeam ? 'LOCKED' : 'RECOMMEND'}</span>
            <div style={{ width: 38, height: 22, borderRadius: 999, background: row.lockForTeam ? t.gold : t.surfaceMute, border: `1px solid ${row.lockForTeam ? 'transparent' : t.ruleStrong}`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, left: row.lockForTeam ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingGroup({ t, title, sub, rows, role, teamMode }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '16px 20px', flexShrink: 0 }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 3 }}>{sub}</div>}
      </div>
      {rows.map((r, i) => <SettingRow key={r.label} t={t} row={r} role={role} teamMode={teamMode} />)}
    </div>
  );
}

// ── the data, by tab + role ────────────────────────────────────────────────
function prefsGroups(role) {
  return [
    { title: 'APPEARANCE', rows: [
      { label: 'Theme', desc: 'Light, dark, or follow your device.', control: 'segmented', options: ['Light', 'Dark', 'System'], value: 'Light' },
      { label: 'Density', desc: 'Row height across tables and lists.', control: 'segmented', options: ['Comfortable', 'Compact'], value: 'Comfortable' },
    ] },
    { title: 'VIEW DEFAULTS', sub: 'How surfaces open for you. In-context controls still work — they change the same setting.', rows: [
      { label: 'Default time period', desc: 'Production, reports, and dashboards open here.', control: 'segmented', options: ['Week', 'Month', 'Quarter', 'Year'], value: 'Week' },
      { label: 'Activity KPI detail', desc: 'Condensed floor categories, a coach\u2019s set, or every captured KPI.', control: 'segmented', options: ['Condensed', 'Coach\u2019s set', 'Full'], value: 'Condensed', recommendedBy: role === 'agent' ? 'branch' : null },
      { label: 'Master Sheet preset', desc: 'Which column set loads first.', control: 'select', value: 'Production' },
      ...(role !== 'agent' ? [{ label: 'Default scope', desc: 'Whose numbers you land on.', control: 'segmented', options: ['Unit', 'Branch'], value: role === 'unit' ? 'Unit' : 'Branch' }] : []),
    ] },
    { title: 'MEETING MODE', rows: [
      { label: 'Presenter chrome', desc: 'Show private notes & quick actions while presenting.', control: 'toggle', value: true },
      { label: 'Open-slide team photos', desc: 'Up to 10 photos for the welcome slideshow.', control: 'action', value: 'Manage photos' },
    ] },
    { title: 'NOTIFICATIONS', rows: [
      { label: 'Weekly report reminders', control: 'toggle', value: true },
      { label: 'Exception alerts', desc: 'Below-floor, off-pace, gone-quiet, persistency.', control: 'toggle', value: true },
      { label: 'Recognition shout-outs', control: 'toggle', value: role !== 'agent' },
    ] },
  ];
}

function teamGroups(role) {
  return [
    { title: 'ONBOARDING DEFAULTS', sub: 'What new agents and the levels beneath you start with.', teamMode: true, rows: [
      { label: 'Default time period', control: 'segmented', options: ['Week', 'Month', 'Quarter', 'Year'], value: 'Week', lockForTeam: false },
      { label: 'Activity KPI detail', desc: 'Lock to keep the room consistent, or recommend.', control: 'segmented', options: ['Condensed', 'Coach\u2019s set', 'Full'], value: 'Condensed', lockForTeam: true },
      { label: 'Master Sheet preset', control: 'select', value: 'Production', lockForTeam: false },
    ] },
    { title: 'MEETING MODE DEFAULTS', teamMode: true, rows: [
      { label: 'Run order', desc: 'Exception-first, or roster order.', control: 'segmented', options: ['Exception-first', 'Roster'], value: 'Exception-first', lockForTeam: true },
      { label: 'Recognition moment', desc: 'Champions + most-improved + awards.', control: 'toggle', value: true, lockForTeam: false },
    ] },
    { title: 'POLICY & THRESHOLDS', sub: 'Standards that cascade down. Greyed rows are locked above you.', teamMode: true, rows: [
      { label: 'Company API floor', desc: 'TTD 9.60M tenure minimum.', control: 'select', value: 'TTD 9.60M', lockedBy: 'company' },
      { label: 'Weekly activity floors', desc: 'Calls 60 · Contacts 40 · Appts 20 · FF 10 · CI 10 · API 4,800 · Apps 1 · Referrals 100.', control: 'action', value: 'View floors', lockedBy: 'company' },
      { label: 'Persistency threshold', desc: 'Minimum book persistency.', control: 'select', value: '80%', lockedBy: 'company' },
      { label: 'Persistency calculation model', desc: 'Tenant-wide. v2 tracks each policy over a rolling 24-month lifecycle (time-weighted credits \u2212 debits); switching restates persistency for the whole organisation.', control: 'segmented', options: ['v1 \u00b7 Settled ratio', 'v2 \u00b7 Rolling 24-mo'], value: 'v1 \u00b7 Settled ratio', lockedBy: 'company' },
      { label: 'Persistency restatement scope', desc: 'When the model switches: apply going forward only (prior periods keep their original basis), or restate history (recompute all prior periods under the active model).', control: 'segmented', options: ['Going forward', 'Restate history'], value: 'Going forward', lockedBy: 'company' },
      { label: 'Award criteria', desc: 'Eagles Club, MDRT, Q4 Champion…', control: 'action', value: 'View criteria', lockedBy: 'sm' },
      { label: 'Tenure goal floors', desc: 'L1 TTD 250K → L4 TTD 550K.', control: 'action', value: 'View tenure floors', lockedBy: 'company' },
    ] },
  ];
}

function SettingsTabs({ t, active, role }) {
  const tabs = [['prefs', 'My Preferences']];
  if (role !== 'agent') tabs.push(['team', 'Team Defaults']);
  tabs.push(['account', 'Account']);
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 10, alignSelf: 'flex-start', flexShrink: 0 }}>
      {tabs.map(([k, l]) => {
        const on = k === active;
        return <div key={k} style={{ padding: '8px 16px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: on ? t.surface : 'transparent', color: on ? t.teal : t.inkMute, border: on ? `1px solid ${t.rule}` : '1px solid transparent', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.04)' : 'none' }}>{l}</div>;
      })}
    </div>
  );
}

function SettingsView({ t, role = 'branch', tab = 'prefs' }) {
  const groups = tab === 'team' ? teamGroups(role) : tab === 'account' ? [] : prefsGroups(role);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <SettingsTabs t={t} active={tab} role={role} />
        <div style={{ fontSize: 11.5, color: t.inkMute }}>Signed in as <b style={{ color: t.ink }}>{ROLE_TITLE[role]}</b></div>
        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '8px 16px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, boxShadow: `0 3px 10px ${t.teal}44` }}>Save changes</div>
      </div>

      {tab === 'team' && (
        <GoldBanner t={t} title="Defaults for the levels beneath you" body="Recommend a default and they can change it; lock it and it becomes the standard they can't override. You can't change rows locked by a higher level." />
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 13, paddingRight: 4 }}>
        {tab === 'account' ? (
          <SettingGroup t={t} title="ACCOUNT" sub="Your profile and sign-in." role={role} rows={[
            { label: 'Name', control: 'action', value: 'Trevor Ramcharan' },
            { label: 'Role', control: 'action', value: ROLE_TITLE[role] },
            { label: 'Branch', control: 'action', value: 'South Branch' },
            { label: 'Email', control: 'action', value: 'trevor.r@tatil.co.tt' },
            { label: 'Password', control: 'action', value: 'Change' },
          ]} />
        ) : groups.map((g) => <SettingGroup key={g.title} t={t} title={g.title} sub={g.sub} rows={g.rows} role={role} teamMode={!!g.teamMode} />)}
      </div>
    </div>
  );
}

// Mobile settings
function SettingsMobile({ t, role = 'agent', tab = 'prefs' }) {
  const groups = prefsGroups(role);
  return (
    <MFrame t={t}>
      <MHeader t={t} title="Settings" sub={ROLE_TITLE[role].toUpperCase()} />
      <MContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map((g) => (
            <div key={g.title} className="a-card" style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 13, padding: '13px 15px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO, marginBottom: 2 }}>{g.title}</div>
              {g.rows.map((r) => {
                const lockedAbove = r.lockedBy && ROLE_RANK[r.lockedBy] < ROLE_RANK[role];
                return (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: `1px solid ${t.rule}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: lockedAbove ? t.inkMute : t.ink }}>{r.label}</div>
                      {lockedAbove && <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 2 }}>Locked by {ROLE_NAME[r.lockedBy]}</div>}
                      {!lockedAbove && r.recommendedBy && <div style={{ fontSize: 10.5, color: t.teal, marginTop: 2 }}>Recommended by your branch</div>}
                    </div>
                    {lockedAbove ? <LockChip t={t} by={r.lockedBy === 'company' ? 'company' : 'branch'} />
                      : r.control === 'toggle' ? <SgToggle t={t} on={r.value} />
                      : r.control === 'action' ? <span style={{ fontSize: 12, fontWeight: 700, color: t.teal }}>{r.value} ›</span>
                      : <span style={{ fontSize: 12, fontWeight: 700, color: t.ink }}>{Array.isArray(r.options) ? r.value : r.value} ›</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </MContent>
      <ManagerMNav t={t} active="more" />
    </MFrame>
  );
}

Object.assign(window, {
  ROLE_RANK, ROLE_NAME, ROLE_TITLE, SettingsView, SettingsMobile,
  SettingRow, SettingGroup, SettingsTabs, prefsGroups, teamGroups,
});
