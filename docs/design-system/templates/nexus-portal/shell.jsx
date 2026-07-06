// Nexus app UI kit — v2 navigation shell.
// Rebuilds the portal chrome on the 2026 redesign nav components:
//   desktop  → SideNavSections (sectioned, drag-reorder, persisted) + ⌘K CommandPalette
//   mobile   → MobileTab (adaptive More + create FAB) + MobileMore + MobileCreateSheet
// Screen CONTENT comes from screens.jsx (DashboardScreen / LedgerScreen / AwardsScreen).
// Host owns & persists the four bits of per-role state the components expect:
//   sidebar order · mobile-tab order · pinned items · frequent-visit counts (localStorage).
const {
  SideNavSections, MobileTab, MobileMore, MobileCreateSheet, CommandPalette,
  EmptyState, Icon, Avatar,
} = window.AgencyTrackDesignSystem_ad1cd7;
const { useState, useEffect, useCallback } = React;

/* ---- nav model (icon names come from the DS Icon `name=` set) ---- */
const BASE_SECTIONS = [
  { g: 'Overview',    items: [['home', 'Dashboard'], ['wizard', 'Weekly Report'], ['history', 'History']] },
  { g: 'Planning',    items: [['chart', 'Game Plan'], ['wallet', 'Money Needs'], ['target', 'Goals']] },
  { g: 'Tools',       items: [['bolt', 'Commission'], ['repeat', 'Persistency'], ['book', 'Policy Ledger'], ['search', 'Prospect Prep']] },
  { g: 'Recognition', items: [['medal', 'Awards'], ['shield', 'Career Portal']] },
];
const BASE_TABS = [['home', 'Home', 'Dashboard'], ['chart', 'Plan', 'Game Plan'], ['wallet', 'Money', 'Money Needs'], ['medal', 'Awards', 'Awards']];
const QUICK_ACTIONS = [
  ['plus', 'Log activity', 'Dashboard', ['agent']],
  ['book', 'New policy', 'Policy Ledger', ['agent']],
  ['wizard', 'Weekly report', 'Weekly Report', ['agent']],
  ['bolt', 'Commission estimate', 'Commission', ['agent']],
];
const META = {
  'Dashboard':      'Week 27 · Jun 29 – Jul 5 · Marsha Singh',
  'Policy Ledger':  'Reconciliation · November settlement',
  'Awards':         'Campaigns, awards & career — settled production only',
};
const ALL_ITEMS = BASE_SECTIONS.flatMap(s => s.items);
const iconFor = (label) => (ALL_ITEMS.find(i => i[1] === label) || ['grid'])[0];

/* ---- localStorage helpers ---- */
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (e) { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* apply a persisted [g -> label[]] order map onto BASE_SECTIONS */
function orderedSections(orderMap) {
  return BASE_SECTIONS.map(sec => {
    const ord = orderMap[sec.g];
    if (!ord) return sec;
    const byLabel = Object.fromEntries(sec.items.map(i => [i[1], i]));
    const items = ord.map(l => byLabel[l]).filter(Boolean);
    sec.items.forEach(i => { if (!items.includes(i)) items.push(i); }); // any new items
    return { g: sec.g, items };
  });
}
function orderedTabs(order) {
  if (!order) return BASE_TABS;
  const byId = Object.fromEntries(BASE_TABS.map(t => [t[2], t]));
  const tabs = order.map(id => byId[id]).filter(Boolean);
  BASE_TABS.forEach(t => { if (!tabs.includes(t)) tabs.push(t); });
  return tabs;
}
/* move `from` to `to`'s position within a label list */
function reorder(list, from, to) {
  const a = [...list]; const fi = a.indexOf(from), ti = a.indexOf(to);
  if (fi < 0 || ti < 0) return a;
  a.splice(ti, 0, a.splice(fi, 1)[0]); return a;
}

function ContentArea({ active, nav }) {
  if (active === 'Dashboard') return <DashboardScreen />;
  if (active === 'Policy Ledger') return <LedgerScreen />;
  if (active === 'Awards') return <AwardsScreen />;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 16 }}>
      <EmptyState icon={iconFor(active)} title={active}
        body="This screen isn’t part of the UI-kit sample — but the sidebar, command palette (⌘K) and mobile sheets are all fully wired. Try reordering the sidebar or opening ⌘K."
        cta="Back to Dashboard" onCta={() => nav('Dashboard')} />
    </div>
  );
}

function Header({ active, dark, onToggleDark, onSearch, onCreate, view, onView }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', borderBottom: '1px solid var(--rule)', background: 'var(--surface)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, letterSpacing: '-.015em', color: 'var(--ink)', lineHeight: 1.1 }}>{active}</div>
        <div style={{ fontSize: 12, color: 'var(--inkMute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{META[active] || 'Nexus agent portal'}</div>
      </div>
      <div style={{ flex: 1 }} />
      <button onClick={onSearch} aria-label="Search and jump to (Command K)"
        style={{ display: 'flex', alignItems: 'center', gap: 9, height: 38, padding: '0 12px', minWidth: 210, background: 'var(--surfaceMute)', border: '1px solid var(--rule)', borderRadius: 11, color: 'var(--inkFaint)', font: '13px var(--sans)', cursor: 'pointer' }}>
        <Icon name="search" size={16} /><span style={{ flex: 1, textAlign: 'left' }}>Search screens…</span>
        <kbd style={{ font: '700 10px var(--mono)', letterSpacing: '.05em', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 6, padding: '2px 6px', color: 'var(--inkMute)' }}>⌘K</kbd>
      </button>
      <div className="seg" role="tablist" aria-label="Preview device" style={{ display: 'flex', gap: 2, background: 'var(--surfaceMute)', border: '1px solid var(--rule)', borderRadius: 11, padding: 3 }}>
        {[['Desktop', 'desktop'], ['Mobile', 'mobile']].map(([lab, v]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => onView(v)}
            style={{ border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--ink)' : 'var(--inkMute)', font: '700 12px var(--sans)', padding: '6px 11px', borderRadius: 8, cursor: 'pointer', boxShadow: view === v ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>{lab}</button>
        ))}
      </div>
      <button className="quick-create" onClick={onCreate} aria-label="Quick create"><Icon name="plus" size={18} /></button>
      <button onClick={onToggleDark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{ width: 38, height: 38, borderRadius: 11, border: '1px solid var(--rule)', background: 'var(--surfaceMute)', color: 'var(--inkMute)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        <Icon name={dark ? 'sun' : 'moon'} size={17} />
      </button>
      <Avatar initials="MS" size={34} />
    </header>
  );
}

function NexusKitShell() {
  const [active, setActive] = useState(() => localStorage.getItem('nexus-kit-active') || 'Dashboard');
  const [dark, setDark] = useState(() => localStorage.getItem('nexus-kit-dark') === '1');
  const [view, setView] = useState('desktop');
  const [collapsed, setCollapsed] = useState(false);
  const [navOrder, setNavOrder] = useState(() => load('nexus-kit-navorder', {}));
  const [tabOrder, setTabOrder] = useState(() => load('nexus-kit-taborder', null));
  const [pins, setPins] = useState(() => load('nexus-kit-pins', ['Policy Ledger']));
  const [visits, setVisits] = useState(() => load('nexus-kit-visits', { 'Awards': 3, 'Game Plan': 2, 'History': 1 }));
  const [palette, setPalette] = useState({ open: false, mode: 'search' });
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const sections = orderedSections(navOrder);
  const tabs = orderedTabs(tabOrder);
  const pinSet = new Set(pins);
  const pinnedItems = pins.map(l => [iconFor(l), l]);
  const frequentItems = Object.entries(visits).filter(([l]) => !pinSet.has(l)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => [iconFor(l), l]);
  const screens = ALL_ITEMS.map(([ic, label]) => ({ id: label, label, ic, grp: (BASE_SECTIONS.find(s => s.items.some(i => i[1] === label)) || {}).g }));

  const nav = useCallback((label) => {
    setActive(label); localStorage.setItem('nexus-kit-active', label);
    setVisits(v => { const nx = { ...v, [label]: (v[label] || 0) + 1 }; save('nexus-kit-visits', nx); return nx; });
    setMoreOpen(false); setCreateOpen(false); setPalette({ open: false, mode: 'search' });
  }, []);
  const toggleDark = () => setDark(d => { const nx = !d; localStorage.setItem('nexus-kit-dark', nx ? '1' : '0'); return nx; });
  const onSideReorder = (g, order, from, to) => setNavOrder(m => { const nx = { ...m, [g]: reorder(order, from, to) }; save('nexus-kit-navorder', nx); return nx; });
  const onTabReorder = (from, to) => setTabOrder(() => { const nx = reorder(tabs.map(t => t[2]), from, to); save('nexus-kit-taborder', nx); return nx; });
  const togglePin = (label) => setPins(p => { const nx = p.includes(label) ? p.filter(x => x !== label) : [...p, label]; save('nexus-kit-pins', nx); return nx; });

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => ({ open: !p.open, mode: 'search' })); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const themeClass = 'nexus' + (dark ? ' dark' : '');
  const deep = !tabs.some(t => t[2] === active);

  /* ---------- MOBILE ---------- */
  if (view === 'mobile') {
    return (
      <div className={themeClass} style={{ width: 1280, height: 800, display: 'grid', placeItems: 'center', background: dark ? '#100D0A' : '#E7E4DC' }}>
        <div style={{ position: 'absolute', top: 22, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div className="seg" role="tablist" aria-label="Preview device" style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--ruleStrong)', borderRadius: 11, padding: 3 }}>
            {[['Desktop', 'desktop'], ['Mobile', 'mobile']].map(([lab, v]) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                style={{ border: 'none', background: view === v ? 'var(--teal)' : 'transparent', color: view === v ? '#fff' : 'var(--inkMute)', font: '700 12px var(--sans)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer' }}>{lab}</button>
            ))}
          </div>
        </div>
        <div className={themeClass} data-view="mobile" style={{ position: 'relative', width: 390, height: 720, borderRadius: 40, overflow: 'hidden', border: '10px solid #17130F', boxShadow: '0 30px 70px -20px rgba(0,0,0,.6)', background: 'var(--bg)' }}>
          <div style={{ height: '100%', overflowY: 'auto', padding: '20px 16px 84px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(150deg,var(--heroA),var(--heroB))', color: 'var(--heroInk)', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800 }}>A</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, color: 'var(--ink)', letterSpacing: '-.015em' }}>{active}</div>
                <div style={{ fontSize: 11, color: 'var(--inkMute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{META[active] || 'Nexus agent portal'}</div>
              </div>
              <button onClick={toggleDark} aria-label={dark ? 'Light mode' : 'Dark mode'} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--rule)', background: 'var(--surfaceMute)', color: 'var(--inkMute)', display: 'grid', placeItems: 'center' }}><Icon name={dark ? 'sun' : 'moon'} size={16} /></button>
            </div>
            <ContentArea active={active} nav={nav} />
          </div>
          <MobileTab tabs={tabs} screen={active} go={nav} onMore={() => setMoreOpen(true)}
            primary={{ label: 'Log activity' }} onCreate={() => setCreateOpen(true)}
            current={deep ? { ic: iconFor(active), label: active } : undefined} onReorder={onTabReorder} />
          <MobileMore open={moreOpen} title="All screens" sections={sections} active={active}
            onNav={nav} onClose={() => setMoreOpen(false)}
            pinnedItems={pinnedItems} frequentItems={frequentItems} pinnedSet={pinSet} onTogglePin={togglePin} />
          <MobileCreateSheet open={createOpen} actions={QUICK_ACTIONS.map(a => [a[0], a[1], a[2]])} onGo={nav} onClose={() => setCreateOpen(false)} />
        </div>
      </div>
    );
  }

  /* ---------- DESKTOP ---------- */
  return (
    <div className={themeClass} style={{ width: 1280, height: 800, overflow: 'hidden', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
      <div className="shell" style={{ height: '100%' }}>
        <nav className={'side' + (collapsed ? ' is-collapsed' : '')} aria-label="Primary">
          <div className="side-brand"><span className="side-mark">A</span><span>AgencyTrack</span></div>
          <div className="side-role">Agent · My Book</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <SideNavSections sections={sections} active={active} onNav={nav} onReorder={onSideReorder} />
          </div>
          <button className="side-collapse" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name={collapsed ? 'arrow' : 'grid'} size={16} /><span>{collapsed ? '' : 'Collapse'}</span>
          </button>
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Header active={active} dark={dark} onToggleDark={toggleDark}
            onSearch={() => setPalette({ open: true, mode: 'search' })}
            onCreate={() => setPalette({ open: true, mode: 'create' })}
            view={view} onView={setView} />
          <main className="nx-screen-enter" key={active} style={{ flex: 1, overflow: 'auto', padding: '22px 26px' }}>
            <ContentArea active={active} nav={nav} />
          </main>
        </div>
      </div>
      <CommandPalette open={palette.open} mode={palette.mode} screens={screens} roles={['agent']}
        quickActions={QUICK_ACTIONS} onGo={nav} onClose={() => setPalette({ open: false, mode: 'search' })} />
    </div>
  );
}

Object.assign(window, { NexusKitShell });
