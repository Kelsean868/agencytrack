// Company Config — TENANT ADMIN surface. The company-wide counterpart to
// Settings v2's My Preferences: one place where an admin shapes how
// AgencyTrack runs for their whole tenant.
//
// Key grammar (used everywhere in this surface):
//   • DEFAULT     — platform default, inherited. Editable; faint DEFAULT tag.
//   • CUSTOM      — tenant-overridden. Teal dot + "Changed by {name} · {date}"
//                   provenance + reset-to-default affordance.
//   • PLATFORM    — platform-locked, never editable. Grey + lock chip.
//   • COMING SOON — value ships hardcoded before its plumbing lands.
//                   Visible, disabled, clock chip.

const ADMIN = { name: 'Alicia Gopaul', initials: 'AG', role: 'Tenant Admin', company: 'Tatil Life' };

// ── the 12 sections, grouped so any setting is findable in seconds ────────
const CFG_NAV = [
  { title: 'Brand', items: [
    { key: 'identity',  label: 'Identity & Branding' },
    { key: 'org',       label: 'Organization' },
  ]},
  { title: 'Standards', items: [
    { key: 'targets',   label: 'Targets & Minimums', dot: true },
    { key: 'cadence',   label: 'Reporting Cadence' },
    { key: 'activity',  label: 'Activity Standards', dot: true },
  ]},
  { title: 'Recognition', items: [
    { key: 'recognition', label: 'Recognition & Gamification', dot: true },
    { key: 'awards',      label: 'Awards & Clubs' },
  ]},
  { title: 'Operations', items: [
    { key: 'financing', label: 'Financing Thresholds' },
    { key: 'kiosk',     label: 'Kiosk' },
    { key: 'policy',    label: 'Policy & Delivery' },
  ]},
  { title: 'Platform', items: [
    { key: 'flags',     label: 'Feature Flags', dot: true },
    { key: 'data',      label: 'Data & Privacy' },
  ]},
];

const CFG_TITLES = {
  identity: 'Identity & Branding', org: 'Organization', targets: 'Targets & Minimums',
  cadence: 'Reporting Cadence', activity: 'Activity Standards',
  recognition: 'Recognition & Gamification', awards: 'Awards & Clubs',
  financing: 'Financing Thresholds', kiosk: 'Kiosk', policy: 'Policy & Delivery',
  flags: 'Feature Flags', data: 'Data & Privacy',
};

// ── tiny icons not in app-tokens ──────────────────────────────────────────
const IconLock = ({ size = 11, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
    <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const IconReset = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
  </svg>
);
const IconDrag = ({ t }) => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill={t.inkDim}>
    <circle cx="3.5" cy="3" r="1.4" /><circle cx="8.5" cy="3" r="1.4" />
    <circle cx="3.5" cy="8" r="1.4" /><circle cx="8.5" cy="8" r="1.4" />
    <circle cx="3.5" cy="13" r="1.4" /><circle cx="8.5" cy="13" r="1.4" />
  </svg>
);

// ── ADMIN SHELL — tenant-admin sidebar + reused Topbar ────────────────────
function AdminSidebar({ t, active = 'config' }) {
  const sections = [
    { title: null, items: [{ key: 'home', Icon: IconHome, label: 'Overview' }] },
    { title: 'Administration', items: [
      { key: 'config',   Icon: IconSettings, label: 'Company Config' },
      { key: 'users',    Icon: IconUsers,    label: 'Users & Roles' },
      { key: 'branches', Icon: IconGrid,     label: 'Branches & Units' },
    ]},
    { title: 'Account', items: [
      { key: 'audit',   Icon: IconHistory, label: 'Audit Log' },
      { key: 'billing', Icon: IconWallet,  label: 'Billing' },
    ]},
  ];
  return (
    <div style={{ width: SIDEBAR_W, background: t.surface, borderRight: `1px solid ${t.rule}`, display: 'flex', flexDirection: 'column', padding: '20px 12px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px', borderBottom: `1px solid ${t.rule}`, marginBottom: 12 }}>
        <AgencyLogo size={32} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em' }}>AgencyTrack</div>
          <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>{ADMIN.company} · Admin</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map((s, si) => (
          <div key={si} style={{ marginBottom: 14 }}>
            {s.title && <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 12px 6px', fontFamily: APP_FONT_MONO }}>{s.title}</div>}
            {s.items.map((it) => {
              const on = active === it.key;
              return (
                <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 9, background: on ? t.tealTint : 'transparent', color: on ? t.teal : t.inkMute, fontSize: 13, fontWeight: 600, position: 'relative' }}>
                  {on && <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: t.teal, borderRadius: 999 }}></div>}
                  <it.Icon size={17} color={on ? t.teal : t.inkMute} stroke={1.8} />
                  <div style={{ flex: 1 }}>{it.label}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: t.tealTint, color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY }}>{ADMIN.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ADMIN.name}</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>{ADMIN.role}</div>
        </div>
      </div>
    </div>
  );
}

function AdminShell({ t, active = 'config', title, subtitle, children }) {
  return (
    <div style={{ width: APP_W, height: APP_H, background: t.bg, color: t.ink, fontFamily: APP_FONT_SANS, position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      <AmbientBg t={t} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex' }}>
        <AdminSidebar t={t} active={active} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar t={t} title={title} subtitle={subtitle} modeMode={t.mode} />
          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 24px' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── CONFIG CHROME — search toolbar + left section rail + content ──────────
function CfgSearch({ t, query, focused }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: 340, padding: '9px 14px', background: t.surface, borderRadius: 10, border: `1.5px solid ${focused ? t.teal : t.ruleStrong}`, boxShadow: focused ? `0 0 0 3px ${t.tealTint}` : 'none', position: 'relative' }}>
      <IconSearch size={14} color={focused ? t.teal : t.inkMute} />
      {query
        ? <div style={{ flex: 1, fontSize: 13, color: t.ink, fontWeight: 600 }}>{query}<span style={{ display: 'inline-block', width: 1.5, height: 14, background: t.teal, marginLeft: 1, verticalAlign: -2 }}></span></div>
        : <div style={{ flex: 1, fontSize: 12.5, color: t.inkFaint }}>Find a setting…</div>}
      <div style={{ fontSize: 10, color: t.inkFaint, padding: '2px 6px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 4, fontFamily: APP_FONT_MONO }}>⌘F</div>
    </div>
  );
}

function CfgRail({ t, active }) {
  return (
    <div style={{ width: 218, flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: 6 }}>
      {CFG_NAV.map((g) => (
        <div key={g.title} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '8px 10px 5px', fontFamily: APP_FONT_MONO }}>{g.title}</div>
          {g.items.map((it) => {
            const on = active === it.key;
            return (
              <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: on ? t.tealTint : 'transparent', color: on ? t.teal : t.inkMute, fontSize: 12.5, fontWeight: on ? 700 : 600, position: 'relative', minHeight: 18 }}>
                {on && <div style={{ position: 'absolute', left: 0, top: 5, bottom: 5, width: 3, background: t.teal, borderRadius: 999 }}></div>}
                <div style={{ flex: 1, lineHeight: 1.25 }}>{it.label}</div>
                {it.dot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal, opacity: on ? 1 : 0.7, flexShrink: 0 }}></div>}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', marginTop: 'auto' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal }}></div>
        <div style={{ fontSize: 10, color: t.inkFaint }}>customized for {ADMIN.company}</div>
      </div>
    </div>
  );
}

// searchState: null | { query, results: [{section, label, value, hit?}] }
function ConfigChrome({ t, active, children, searchState }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, position: 'relative', zIndex: 4 }}>
        <div style={{ position: 'relative' }}>
          <CfgSearch t={t} query={searchState && searchState.query} focused={!!searchState} />
          {searchState && (
            <div style={{ position: 'absolute', top: 46, left: 0, width: 430, background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 12, boxShadow: t.mode === 'dark' ? '0 18px 44px rgba(0,0,0,0.5)' : '0 18px 44px rgba(38,35,28,0.16)', padding: 6, zIndex: 5 }}>
              {searchState.results.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: i === 0 ? t.tealTint : 'transparent' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: i === 0 ? t.teal : t.inkFaint, letterSpacing: '0.12em', fontFamily: APP_FONT_MONO, textTransform: 'uppercase' }}>{r.section}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, marginTop: 2 }}>{r.label}</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO, flexShrink: 0 }}>{r.value}</div>
                  {i === 0 && <IconArrowR size={13} color={t.teal} />}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 14, padding: '8px 12px 5px', borderTop: `1px solid ${t.rule}`, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>↑↓ MOVE</span>
                <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>↵ JUMP TO SETTING</span>
                <span style={{ fontSize: 10, color: t.inkFaint, fontFamily: APP_FONT_MONO }}>ESC CLOSE</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: t.inkMute }}>Changes apply to everyone at <b style={{ color: t.ink }}>{ADMIN.company}</b> — every change is logged.</div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: t.surface, border: `1px solid ${t.ruleStrong}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: t.inkMute }}>
          <IconHistory size={14} color={t.inkMute} /> Change history
        </div>
        <div style={{ padding: '9px 16px', background: t.teal, color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 700, boxShadow: `0 3px 10px ${t.teal}44` }}>Save changes</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 18 }}>
        <CfgRail t={t} active={active} />
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 13, paddingRight: 4, paddingBottom: 8 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── STATE CHIPS — the locked/default duality grammar ──────────────────────
function PlatformChip({ t }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 999, flexShrink: 0 }}>
      <IconLock color={t.inkMute} />
      <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>PLATFORM</span>
    </div>
  );
}
function SoonChip({ t, tier }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: t.warningTint, border: `1px solid ${t.warning}33`, borderRadius: 999, flexShrink: 0 }}>
      <IconClock size={11} color={t.warning} stroke={2.2} />
      <span style={{ fontSize: 9.5, fontWeight: 700, color: t.warning, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em' }}>{tier ? `HARDCODED · UNLOCKS ${tier}` : 'HARDCODED · COMING SOON'}</span>
    </div>
  );
}
function DefaultTag({ t }) {
  return <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkFaint, fontFamily: APP_FONT_MONO, letterSpacing: '0.08em', flexShrink: 0 }}>DEFAULT</span>;
}
// Provenance line + reset — appears under any tenant-overridden setting.
function Provenance({ t, who = ADMIN.name, date = '12 Jun 2026', def }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: t.inkMute }}>Changed by <b style={{ color: t.ink, fontWeight: 600 }}>{who}</b> · {date}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: t.teal }}>
        <IconReset color={t.teal} /> Reset to default{def ? ` (${def})` : ''}
      </span>
    </div>
  );
}

// ── CONTROLS ──────────────────────────────────────────────────────────────
function CcSeg({ t, options, value, disabled }) {
  return (
    <div style={{ display: 'inline-flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9, opacity: disabled ? 0.55 : 1, flexShrink: 0 }}>
      {options.map((o) => {
        const on = o === value;
        return <div key={o} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: on ? (disabled ? t.inkDim : t.teal) : 'transparent', color: on ? '#fff' : t.inkMute, whiteSpace: 'nowrap' }}>{o}</div>;
      })}
    </div>
  );
}
function CcToggle({ t, on, disabled }) {
  return (
    <div style={{ width: 42, height: 24, borderRadius: 999, background: on ? (disabled ? t.inkDim : t.teal) : t.surfaceMute, border: `1px solid ${on ? 'transparent' : t.ruleStrong}`, position: 'relative', flexShrink: 0, opacity: disabled ? 0.6 : 1 }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}></div>
    </div>
  );
}
// Bordered value field — `changed` paints the teal override treatment.
function CcField({ t, value, suffix, changed, disabled, width = 74, mono = true }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', width, boxSizing: 'border-box', background: disabled ? t.surfaceSoft : t.surface, border: `1.5px solid ${changed ? t.teal : t.ruleStrong}`, borderRadius: 9, opacity: disabled ? 0.55 : 1, flexShrink: 0 }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.ink, fontFamily: mono ? APP_FONT_MONO : APP_FONT_SANS, textAlign: 'right' }}>{value}</span>
      {suffix && <span style={{ fontSize: 11, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{suffix}</span>}
    </div>
  );
}
function CcGhost({ t, children, danger }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', background: 'transparent', border: `1.5px solid ${danger ? t.danger : t.ruleStrong}`, borderRadius: 9, fontSize: 12, fontWeight: 700, color: danger ? t.danger : t.ink, flexShrink: 0, whiteSpace: 'nowrap' }}>{children}</div>
  );
}

// ── SETTING ROW + GROUP CARD ──────────────────────────────────────────────
// state: 'default' | 'custom' | 'platform' | 'soon'
function CfgRow({ t, label, desc, state = 'default', control, value, who, date, def, first, tier }) {
  const grey = state === 'platform' || state === 'soon';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '13px 0', borderTop: first ? 'none' : `1px solid ${t.rule}`, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {state === 'custom' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.teal, flexShrink: 0 }}></div>}
          <div style={{ fontSize: 13.5, fontWeight: 600, color: grey ? t.inkMute : t.ink }}>{label}</div>
        </div>
        {desc && <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 3, lineHeight: 1.45, maxWidth: 520 }}>{desc}</div>}
        {state === 'custom' && <Provenance t={t} who={who} date={date} def={def} />}
        {state === 'platform' && <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4 }}>Platform-managed for now — on the roadmap to open up like everything else.</div>}
        {state === 'soon' && <div style={{ fontSize: 11, color: t.inkMute, marginTop: 4 }}>Ships read-only for now — editing lands with its unlock tier.</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 1 }}>
        {state === 'default' && <DefaultTag t={t} />}
        {state === 'platform' && value && <span style={{ fontSize: 12.5, fontWeight: 700, color: t.inkMute, fontFamily: APP_FONT_MONO }}>{value}</span>}
        {state !== 'platform' && control}
        {state === 'platform' && <PlatformChip t={t} />}
        {state === 'soon' && <SoonChip t={t} tier={tier} />}
      </div>
    </div>
  );
}

function CfgGroup({ t, title, sub, children, accent }) {
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 14, padding: '16px 20px', flexShrink: 0 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: accent || t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 3, lineHeight: 1.45 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// Section header inside the content column — Cabinet Grotesk, generous.
function CfgSectionHead({ t, section, blurb }) {
  return (
    <div style={{ flexShrink: 0, paddingBottom: 2 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: t.ink, letterSpacing: '-0.025em', fontFamily: APP_FONT_DISPLAY, lineHeight: 1.05 }}>{CFG_TITLES[section]}</div>
      {blurb && <div style={{ fontSize: 12, color: t.inkMute, marginTop: 5, lineHeight: 1.5, maxWidth: 640 }}>{blurb}</div>}
    </div>
  );
}

Object.assign(window, {
  ADMIN, CFG_NAV, CFG_TITLES,
  IconLock, IconReset, IconDrag,
  AdminSidebar, AdminShell, ConfigChrome, CfgSearch, CfgRail,
  PlatformChip, SoonChip, DefaultTag, Provenance,
  CcSeg, CcToggle, CcField, CcGhost,
  CfgRow, CfgGroup, CfgSectionHead,
});
