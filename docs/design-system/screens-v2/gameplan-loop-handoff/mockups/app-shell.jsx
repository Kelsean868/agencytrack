// App shell — sidebar + topbar + content slot. Used by every desktop screen.

const SIDEBAR_W = 232;

function Sidebar({ t, active = 'home' }) {
  const sections = [
    { title: null, items: [
      { key: 'home',     Icon: IconHome,    label: 'Dashboard' },
      { key: 'wizard',   Icon: IconWizard,  label: 'Weekly Report' },
      { key: 'history',  Icon: IconHistory, label: 'History' },
    ]},
    { title: 'Planning', items: [
      { key: 'lookahead',Icon: IconChart,   label: 'Game Plan', badge: 'NEW' },
      { key: 'money',    Icon: IconWallet,  label: 'Money Needs', child: true },
      { key: 'goals',    Icon: IconTarget,  label: 'Goals' },
    ]},
    { title: 'Tools', items: [
      { key: 'commission',Icon: IconBolt,    label: 'Commission' },
      { key: 'persistency',Icon: IconRepeat, label: 'Persistency' },
      { key: 'ledger',   Icon: IconBook,    label: 'Policy Ledger' },
      { key: 'prospect', Icon: IconSearch,  label: 'Prospect Prep' },
    ]},
    { title: 'Recognition', items: [
      { key: 'awards',   Icon: IconMedal,   label: 'Awards' },
      { key: 'career',   Icon: IconShield,  label: 'Career Portal' },
    ]},
  ];
  return (
    <div style={{
      width: SIDEBAR_W, background: t.surface,
      borderRight: `1px solid ${t.rule}`,
      display: 'flex', flexDirection: 'column', padding: '20px 12px',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px', borderBottom: `1px solid ${t.rule}`, marginBottom: 12 }}>
        <AgencyLogo size={32} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em' }}>AgencyTrack</div>
          <div style={{ fontSize: 10, color: t.inkMute, marginTop: 1 }}>Tatil Life · South</div>
        </div>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map((s, si) => (
          <div key={si} style={{ marginBottom: 14 }}>
            {s.title && (
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: t.inkFaint,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                padding: '10px 12px 6px', fontFamily: APP_FONT_MONO,
              }}>{s.title}</div>
            )}
            {s.items.map((it) => {
              const isActive = active === it.key;
              return (
                <div key={it.key} style={{
                  display: 'flex', alignItems: 'center', gap: it.child ? 9 : 11,
                  padding: it.child ? '7px 12px 7px 32px' : '9px 12px', borderRadius: 9,
                  background: isActive ? t.tealTint : 'transparent',
                  color: isActive ? t.teal : t.inkMute,
                  transition: 'background-color 180ms ease, color 180ms ease',
                  fontSize: it.child ? 12 : 13, fontWeight: 600,
                  position: 'relative',
                }}>
                  {isActive && (
                    <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, background: t.teal, borderRadius: 999 }}></div>
                  )}
                  {it.child && (
                    <div style={{ position: 'absolute', left: 19, top: -2, width: 10, height: 16, borderLeft: `1.5px solid ${t.rule}`, borderBottom: `1.5px solid ${t.rule}`, borderBottomLeftRadius: 5, pointerEvents: 'none' }}></div>
                  )}
                  <it.Icon size={it.child ? 15 : 17} color={isActive ? t.teal : t.inkMute} stroke={1.8} />
                  <div style={{ flex: 1 }}>{it.label}</div>
                  {it.badge && (
                    <div style={{
                      padding: '1px 6px', borderRadius: 999, fontSize: 8.5, fontWeight: 700,
                      background: t.gold, color: t.surface, letterSpacing: '0.06em',
                    }}>{it.badge}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Role switcher + Footer — agent chip */}
      <RoleSwitcher t={t} current="agent" />
      <div style={{
        padding: '12px 10px', borderTop: `1px solid ${t.rule}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: t.tealTint,
          color: t.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, fontFamily: APP_FONT_DISPLAY,
        }}>MS</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Marsha Singh</div>
          <div style={{ fontSize: 10.5, color: t.inkMute, marginTop: 1 }}>Senior Associate</div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ t, title, subtitle, modeMode = 'light' }) {
  return (
    <div style={{
      height: 60, background: t.surface, borderBottom: `1px solid ${t.rule}`,
      padding: '0 28px', display: 'flex', alignItems: 'center', gap: 18,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.ink, letterSpacing: '-0.012em', fontFamily: APP_FONT_DISPLAY }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: t.inkMute, marginTop: 1 }}>{subtitle}</div>}
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, width: 280,
        padding: '8px 14px', background: t.surfaceSoft, borderRadius: 9,
        border: `1px solid ${t.rule}`,
      }}>
        <IconSearch size={14} color={t.inkMute} />
        <div style={{ flex: 1, fontSize: 12.5, color: t.inkFaint }}>Search agents, policies, weeks…</div>
        <div style={{ fontSize: 10, color: t.inkFaint, padding: '2px 6px', background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 4, fontFamily: APP_FONT_MONO }}>⌘K</div>
      </div>

      {/* Mode toggle */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, background: t.surface,
        border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.inkMute,
      }}>
        {modeMode === 'dark' ? <IconSun size={16} color={t.inkMute} /> : <IconMoon size={16} color={t.inkMute} />}
      </div>

      {/* Bell */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, background: t.surface,
        border: `1px solid ${t.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.inkMute, position: 'relative',
      }}>
        <IconBell size={16} color={t.inkMute} />
        <div style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: t.danger, border: `2px solid ${t.surface}` }}></div>
      </div>
    </div>
  );
}

// Page shell — sidebar + topbar + scrollable content
function AppShell({ t, active, title, subtitle, children }) {
  return (
    <div style={{
      width: APP_W, height: APP_H, background: t.bg,
      color: t.ink, fontFamily: APP_FONT_SANS,
      position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
    }}>
      <AmbientBg t={t} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex',
      }}>
        <Sidebar t={t} active={active} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Topbar t={t} title={title} subtitle={subtitle} modeMode={t.mode} />
          <div style={{ flex: 1, overflow: 'hidden', padding: '24px 28px' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Small composable bits
function Eyebrow({ t, children, color }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      color: color || t.teal, fontFamily: APP_FONT_MONO,
    }}>{children}</div>
  );
}

function Pill({ t, children, color, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 9.5, fontWeight: 700,
      color: color || t.teal, background: bg || t.tealTint,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      fontFamily: APP_FONT_SANS,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>{children}</span>
  );
}

// Compact scorecard — replaces circular gauges per Gemini + Perplexity rec
function Scorecard({ t, eyebrow, value, sub, accent, big, progress }) {
  return (
    <div className="a-card a-rise" style={{
      flex: 1, padding: '14px 16px',
      background: t.surface, border: `1px solid ${t.rule}`, borderRadius: 11,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent || t.teal, letterSpacing: '0.14em', fontFamily: APP_FONT_MONO }}>{eyebrow}</div>
      <div style={{
        fontSize: big ? 28 : 22, fontWeight: 700, color: t.ink, letterSpacing: '-0.022em',
        fontFamily: APP_FONT_DISPLAY, lineHeight: 1, marginTop: 8,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.inkMute, marginTop: 5 }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ marginTop: 10, height: 4, background: t.surfaceMute, borderRadius: 999, overflow: 'hidden' }}>
          <div className="a-progress-grow" style={{ width: `${progress}%`, height: 4, background: `linear-gradient(90deg, ${t.tealDark}, ${t.teal})`, borderRadius: 999 }}></div>
        </div>
      )}
    </div>
  );
}

// Role switcher — jump between the three sign-ons (agent / manager / CRO).
// Each non-current role links to that role's dashboard HTML.
function RoleSwitcher({ t, current = 'agent' }) {
  const roles = [
    { key: 'agent',   label: 'Agent',   href: 'AgencyTrack%20Agent%20Dashboard%20v2.html' },
    { key: 'manager', label: 'Manager', href: 'AgencyTrack%20Manager%20Dashboard%20v2.html' },
    { key: 'cro',     label: 'CRO',     href: 'AgencyTrack%20CRO.html' },
  ];
  return (
    <div style={{ padding: '0 4px 8px' }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: t.inkFaint, letterSpacing: '0.16em', fontFamily: APP_FONT_MONO, padding: '0 4px 6px' }}>VIEW AS</div>
      <div style={{ display: 'flex', gap: 3, padding: 3, background: t.surfaceSoft, border: `1px solid ${t.rule}`, borderRadius: 9 }}>
        {roles.map((r) => {
          const on = r.key === current;
          const cell = (
            <div style={{ width: '100%', textAlign: 'center', padding: '6px 2px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: on ? t.teal : 'transparent', color: on ? '#fff' : t.inkMute, whiteSpace: 'nowrap' }}>{r.label}</div>
          );
          return on
            ? <div key={r.key} style={{ flex: 1 }}>{cell}</div>
            : <a key={r.key} href={r.href} style={{ flex: 1, display: 'block', textDecoration: 'none' }}>{cell}</a>;
        })}
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, AppShell, Eyebrow, Pill, Scorecard, SIDEBAR_W, RoleSwitcher });
