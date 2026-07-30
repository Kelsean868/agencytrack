// AgencyTrack — unified app shell. One `screen` state drives the sidebar, so
// Planner / Dialer / Lead Entry / Activity are real destinations sharing ONE
// sync store. Nav collapsed by default; focus mode and the collapsible action
// plan carry across every screen.
const { SideNavSections, Topbar, Icon, Avatar } = window.AgencyTrackDesignSystem_ad1cd7;
const { useState, useEffect, useRef, useCallback } = React;

const AGENT_NAV = [
  { g: 'Today', items: [['home', 'Dashboard'], ['clock', 'Planner'], ['users', 'Dialer'], ['grid', 'Pipeline'], ['plus', 'Lead Entry'], ['calendar', 'Activities'], ['chart', 'Weekly Numbers'], ['history', 'Activity']] },
  { g: 'Planning', items: [['chart', 'Game Plan'], ['wallet', 'Money Needs'], ['target', 'Goals']] },
  { g: 'Tools', items: [['bolt', 'Commission'], ['book', 'The Book'], ['shield', 'Who Sees What']] },
  { g: 'Recognition', items: [['trophy', 'Leaderboard'], ['medal', 'Awards'], ['users', 'My Referrals']] },
];
// Manager nav leads with the unit, not the diary: the desk is the landing screen and
// lead supply (import) sits beside it, because that is the manager's actual lever.
// Every glyph name below MUST be a key in the DS Icon's own set — it resolves
// `NAME_PATHS[name] || NAME_PATHS.grid`, so a typo silently becomes the grid glyph.
// `upload` is NOT in the set; `download` (tray + arrow) is the import glyph here.
const MANAGER_NAV = [
  { g: 'The unit', items: [['grid', 'Unit Desk'], ['download', 'Bulk Import'], ['users', 'Dialer'], ['filter', 'Pipeline'], ['wizard', 'Recruiting'], ['history', 'Activity']] },
  { g: 'My diary', items: [['clock', 'Planner'], ['calendar', 'Activities'], ['chart', 'Weekly Numbers'], ['plus', 'Lead Entry']] },
  { g: 'Unit planning', items: [['chart', 'Game Plan'], ['target', 'Standards'], ['trophy', 'Leaderboard']] },
  { g: 'Oversight', items: [['bolt', 'Commission'], ['book', 'The Book'], ['shield', 'Who Sees What'], ['medal', 'Awards']] },
];
// Producing manager sells and manages, so the nav is the agent's with the unit groups
// folded in rather than a separate shell.
const PMANAGER_NAV = [
  { g: 'My week', items: [['clock', 'Planner'], ['filter', 'Pipeline'], ['users', 'Dialer'], ['calendar', 'Activities'], ['chart', 'Weekly Numbers']] },
  { g: 'My unit', items: [['grid', 'Unit Desk'], ['wizard', 'Recruiting'], ['download', 'Bulk Import'], ['history', 'Activity']] },
  { g: 'Planning', items: [['target', 'Game Plan'], ['wallet', 'Money Needs']] },
  { g: 'Oversight', items: [['bolt', 'Commission'], ['book', 'The Book'], ['shield', 'Who Sees What']] },
];
const ROUTED = ['Unit Desk', 'Planner', 'Dialer', 'Pipeline', 'The Book', 'Commission', 'Recruiting', 'My Referrals', 'Lead Entry', 'Bulk Import', 'Activities', 'Weekly Numbers', 'Game Plan', 'Who Sees What', 'Activity'];
const AGENT_TABS = ['Pipeline', 'Planner', 'Dialer', 'The Book', 'Commission', 'Game Plan'];
const MANAGER_TABS = ['Unit Desk', 'Pipeline', 'Recruiting', 'Bulk Import', 'Planner', 'Weekly Numbers'];
// A producing manager needs both halves reachable: their own selling surfaces AND the
// unit ones. The tab set is the union, led by the pipeline that shows the split.
const PMANAGER_TABS = ['Pipeline', 'Planner', 'Dialer', 'Unit Desk', 'Recruiting', 'Weekly Numbers'];
const META = {
  'Unit Desk': 'Tatil Life South · 5 agents · week 27',
  'Planner': 'Wednesday 1 July 2026 · week 27 · Tatil Life South',
  'Dialer': 'Call block · queue worked top to bottom',
  'Lead Entry': 'New leads land in a call queue immediately',
  'Bulk Import': 'A spreadsheet becomes worked queues',
  'Activities': 'Every open call, appointment and task · closes as its own type',
  'Weekly Numbers': 'Evidenced and declared activity in one ledger',
  'Who Sees What': 'Every record type, every role · stated, not discovered',
  'Game Plan': 'The gap decides the week · your ratios, run backwards',
  'Pipeline': 'Stage by stage · drag to advance, drop in Client to write a policy',
  'The Book': 'Delivery, clawback and persistency · written but not yet safe',
  'Commission': 'Earned against paid · reconciled to the carrier statement',
  'Recruiting': 'Candidate to producing agent · named, because a recruit is the agency’s',
  'My Referrals': 'The people you brought in · your referrals only',
  'Activity': 'Everything the system recorded, newest first',
};

// The DS Icon set, by name. Kept here as an author-time guard: SideNavSections
// addresses glyphs by name and the Icon falls back to `grid` on a miss, so an
// unknown name is invisible at runtime and two nav items end up identical —
// which is exactly the defect this list exists to catch.
const DS_ICON_NAMES = ['home', 'wizard', 'history', 'chart', 'target', 'wallet', 'medal', 'shield', 'bolt',
  'repeat', 'book', 'users', 'grid', 'settings', 'search', 'bell', 'sun', 'moon', 'trophy', 'clock',
  'filter', 'download', 'calendar', 'check', 'plus', 'arrow', 'pin'];
[['AGENT_NAV', AGENT_NAV], ['MANAGER_NAV', MANAGER_NAV]].forEach(([which, nav]) => {
  const bad = nav.flatMap(g => g.items).filter(([ic]) => !DS_ICON_NAMES.includes(ic));
  if (bad.length) console.warn('[nav] ' + which + ' uses glyph names the DS Icon does not have — these will all render as the grid fallback: ' + bad.map(b => b[0] + ' (' + b[1] + ')').join(', '));
});

// ── activity feed screen ────────────────────────────────────────────────────
const ACT_TONE = {
  lead_created: ['var(--teal)', 'var(--tealTint)'], call_logged: ['var(--inkAccent)', 'var(--inkAccentTint)'],
  scheduled: ['var(--teal)', 'var(--tealTint)'], kept: ['var(--success)', 'var(--successTint)'],
  task_completed: ['var(--success)', 'var(--successTint)'], call_block: ['var(--inkAccent)', 'var(--inkAccentTint)'],
  archive: ['var(--warning)', 'var(--warningTint)'], dead: ['var(--danger)', 'var(--dangerTint)'],
  system_flag: ['var(--warning)', 'var(--warningTint)'], churn: ['var(--warning)', 'var(--warningTint)'],
  sync: ['var(--teal)', 'var(--tealTint)'], sync_planner: ['var(--teal)', 'var(--tealTint)'],
  import: ['var(--teal)', 'var(--tealTint)'], import_undo: ['var(--inkMute)', 'var(--surfaceMute)'],
  assign: ['var(--inkAccent)', 'var(--inkAccentTint)'], reassign: ['var(--inkAccent)', 'var(--inkAccentTint)'],
  joint_call: ['var(--goldInk)', 'var(--goldTint)'], nudge: ['var(--warning)', 'var(--warningTint)'],
  queue: ['var(--teal)', 'var(--tealTint)'], task_added: ['var(--teal)', 'var(--tealTint)'],
  declared: ['var(--goldInk)', 'var(--goldTint)'],
  escalated: ['var(--inkAccent)', 'var(--inkAccentTint)'], eliminated: ['var(--success)', 'var(--successTint)'],
  stage: ['var(--teal)', 'var(--tealTint)'], converted: ['var(--goldInk)', 'var(--goldTint)'],
  persistency: ['var(--danger)', 'var(--dangerTint)'],
  commission: ['var(--goldInk)', 'var(--goldTint)'],
  applied: ['var(--inkAccent)', 'var(--inkAccentTint)'], issued: ['var(--goldInk)', 'var(--goldTint)'],
  recruit: ['var(--inkAccent)', 'var(--inkAccentTint)'],
};
function ActivityScreen({ store }) {
  const groups = [
    ['Leads', ['lead_created', 'queue', 'import', 'import_undo', 'assign', 'reassign', 'stage', 'converted', 'applied', 'issued']],
    ['Calls', ['call_logged', 'call_block', 'system_flag', 'archive', 'dead']],
    ['Planner', ['scheduled', 'task_completed', 'task_added', 'kept', 'churn', 'sync_planner']],
    ['Numbers', ['declared', 'eliminated']],
    ['The book', ['persistency', 'commission']],
    ['Coaching', ['joint_call', 'nudge', 'escalated', 'recruit']],
    ['System', ['sync', 'system']],
  ];
  const [filter, setFilter] = useState('All');
  const keys = filter === 'All' ? null : (groups.find(g => g[0] === filter) || [null, []])[1];
  const rows = store.activities.filter(a => !keys || keys.includes(a.type));
  return (
    <div className="scr-wrap">
      <div className="scr-tool">
        <span className="scr-eyebrow">Activity feed</span>
        <div className="seg-sm">
          {['All'].concat(groups.map(g => g[0])).map(f => (
            <button key={f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <span className="pl-stat">{store.activities.length} entries</span>
      </div>
      <div className="af">
        {rows.length === 0 ? <div className="ap-empty"><b>Nothing here yet</b><span>Work a call or book a slot and it shows up.</span></div>
          : rows.map(a => {
            const t = ACT_TONE[a.type] || ['var(--inkMute)', 'var(--surfaceMute)'];
            return (
              <div key={a.id} className="af-row">
                <span className="af-dot" style={{ background: t[0] }}></span>
                <span className="af-type" style={{ color: t[0], background: t[1] }}>{a.type.replace(/_/g, ' ').toUpperCase()}</span>
                <span className="af-msg">{a.message}</span>
                <span className="af-at">{a.at}</span>
              </div>
            );
          })}
      </div>
      <p className="rc-fine">This is <code>sync-service.js</code>'s activity log made visible — every cross-module rule writes here, so you can see the system reacting rather than take it on trust.</p>
    </div>
  );
}

function StubScreen({ label, onGoto }) {
  return (
    <div className="scr-wrap">
      <div className="ap-empty" style={{ margin: 'auto', padding: '60px 20px' }}>
        <span className="ap-empty-ic"><Icon name="grid" size={28} /></span>
        <b>{label}</b>
        <span>Not part of this build — the four routed screens are Planner, Dialer, Lead Entry and Activity.</span>
        <button className="pb pb-ghost" style={{ marginTop: 14 }} onClick={() => onGoto('Planner')}>Back to Planner</button>
      </div>
    </div>
  );
}

// Book a slot directly. Drag-to-schedule only covers things already in the action
// plan, so an appointment you already have a time for needs its own door in.
function NewEventOverlay({ events, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('FFI');
  const [startHour, setStartHour] = useState(14);
  const [duration, setDuration] = useState(1);
  const endHour = startHour + duration;
  // Warn rather than block: a manager double-booking on purpose is legitimate.
  const clash = events.filter(e => e.type !== 'SUGGESTION' && !['cancelled', 'postponed'].includes(e.status)
    && startHour < e.endHour && endHour > e.startHour);
  const valid = title.trim() && endHour <= 18;
  const slots = [];
  for (let h = 8; h <= 17.5; h += 0.5) slots.push(h);

  return (
    <div className="ov" role="dialog" aria-modal="true" aria-label="Book an event" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ov-scrim"></div>
      <div className="ov-panel ne-panel">
        <div className="ov-head">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ov-title" style={{ display: 'block' }}>Book an event</span>
            <span className="ov-sub" style={{ display: 'block' }}>Wednesday 1 July · goes straight on the grid</span>
          </span>
          <button className="ov-x" onClick={onClose} aria-label="Close"><Icon name="plus" size={16} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>
        <div className="ov-body">
          <label className="fld"><span className="fld-lab">What is it</span>
            <input className="ap-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kareem Mohammed — fact find" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && valid) onCreate({ title: title.trim(), type, startHour, duration }); }} />
          </label>
          <div className="ne-grid">
            <label className="fld"><span className="fld-lab">Activity</span>
              <select className="ap-in" value={type} onChange={(e) => setType(e.target.value)}>
                {Object.keys(ACTIVITY_METADATA).filter(k => k !== 'SUGGESTION').map(k => <option key={k} value={k}>{k} — {ACTIVITY_METADATA[k].label}</option>)}
              </select>
            </label>
            <label className="fld"><span className="fld-lab">Starts</span>
              <select className="ap-in" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
                {slots.map(h => <option key={h} value={h}>{formatTime(h)}</option>)}
              </select>
            </label>
            <label className="fld"><span className="fld-lab">For</span>
              <select className="ap-in" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {[0.5, 1, 1.5, 2, 3].map(d => <option key={d} value={d}>{d >= 1 ? d + 'h' : '30m'}</option>)}
              </select>
            </label>
          </div>
          <p className={'ov-note' + (clash.length ? ' ov-note-warn' : '')}>
            {clash.length
              ? formatTime(startHour) + '–' + formatTime(endHour) + ' overlaps ' + clash.map(c => c.title).join(' and ') + '. It will book alongside — the grid lays overlaps side by side rather than hiding one.'
              : formatTime(startHour) + '–' + formatTime(endHour) + ' is clear.'}
          </p>
        </div>
        <div className="ov-foot">
          <button className="pb pb-sec" onClick={onClose}>Cancel</button>
          <button className="pb pb-pri" disabled={!valid} onClick={() => onCreate({ title: title.trim(), type, startHour, duration })}>
            <Icon name="plus" size={15} /> Book it
          </button>
        </div>
      </div>
    </div>
  );
}

// ── shell ───────────────────────────────────────────────────────────────────
function AgencyTrackApp() {
  const store = useSyncStore();
  const { prefs, set: setPref, reset: resetPrefs, changed: prefsChanged } = usePrefs();
  const [role, setRole] = useState('agent');
  const TABS = role === 'manager' ? MANAGER_TABS : role === 'pmanager' ? PMANAGER_TABS : AGENT_TABS;
  const [screen, setScreen] = useState('Planner');
  const [openLeadId, setOpenLeadId] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem('at-app-dark') === '1');
  const [navCollapsed, setNavCollapsed] = useState(prefs.navCollapsed);
  const [railOpen, setRailOpen] = useState(prefs.railOpen);
  const [focus, setFocus] = useState(false);
  const [scale, setScale] = useState(prefs.view === 'week' ? 'week' : 'day');
  const [smart, setSmart] = useState(prefs.view === 'smart' || !!prefs.smart);
  const [modal, setModal] = useState(null);
  const [showMobile, setShowMobile] = useState(false);
  const [month, setMonth] = useState(new Date(2026, 6, 1));  const [showPlay, setShowPlay] = useState(prefs.showPlay);
  const [autoAdvance, setAutoAdvance] = useState(prefs.autoAdvance);
  const [currentHour, setCurrentHour] = useState(11.33);
  const [dragging, setDragging] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);
  const [hoveredHour, setHoveredHour] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => { localStorage.setItem('at-app-dark', dark ? '1' : '0'); }, [dark]);
  useEffect(() => {
    if (!autoAdvance) return;
    const t = setInterval(() => setCurrentHour(h => (h >= 17 ? 8 : Math.round((h + 0.25) * 100) / 100)), 8000);
    return () => clearInterval(t);
  }, [autoAdvance]);

  const toggleFocus = useCallback(() => {
    setFocus(f => {
      const n = !f, el = frameRef.current;
      if (n && el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (!n && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      return n;
    });
  }, []);
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setFocus(false); };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'd' && screen === 'Planner') setScale('day');
      else if (e.key === 'w' && screen === 'Planner') setScale('week');
      else if (e.key === 's' && screen === 'Planner') setSmart(s => !s);
      else if (e.key === 'f') { e.preventDefault(); toggleFocus(); }
      else if (e.key === 'n' && screen === 'Planner') { e.preventDefault(); setModal({ kind: 'new' }); }
      else if (e.key === '[') setNavCollapsed(c => !c);
      else if (e.key === ']') setRailOpen(o => !o);
      else if (e.key === '1') setScreen(TABS[0]);
      else if (e.key === '2') setScreen(TABS[1]);
      else if (e.key === '3') setScreen(TABS[2]);
      else if (e.key === '4') setScreen(TABS[3]);
      else if (e.key === '5' && TABS[4]) setScreen(TABS[4]);
      else if (e.key === '6' && TABS[5]) setScreen(TABS[5]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, toggleFocus, TABS]);

  // drag-to-schedule (planner only)
  const onDragStart = (e, task) => { try { e.dataTransfer.setData('taskId', task.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} setDraggedTask(task); setDragging(true); };
  const onDragEnd = () => { setDraggedTask(null); setDragging(false); setHoveredHour(null); setHoveredDay(null); };
  const onDragOver = (e, day) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (x) {}
    const r = e.currentTarget.getBoundingClientRect();
    let hour = 8 + ((e.clientY - r.top) / ROW_HEIGHT);
    hour = Math.max(8, Math.min(17, Math.floor(hour * 2) / 2));
    if (hour !== hoveredHour || day !== hoveredDay) { setHoveredHour(hour); setHoveredDay(day); }
  };
  const onDragLeave = (e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setHoveredHour(null); setHoveredDay(null); };
  const onDrop = (e, day) => {
    e.preventDefault();
    if (hoveredHour !== null && draggedTask && day === TODAY_KEY) store.scheduleTask(draggedTask, hoveredHour);
    onDragEnd();
  };

  const openEvent = useCallback((ev) => setModal({ kind: 'event', ev }), []);
  const goto = useCallback((s) => { setScreen(s); setModal(null); }, []);
  const switchRole = (r) => { setRole(r); setScreen(r === 'manager' ? 'Unit Desk' : r === 'pmanager' ? 'Pipeline' : 'Planner'); setModal(null); };

  const live = store.events.filter(e => e.type !== 'SUGGESTION');
  const kept = live.filter(e => e.isPast || e.isCompleted).length;
  const plannedH = live.filter(e => !['cancelled', 'postponed'].includes(e.status)).reduce((s, e) => s + (e.endHour - e.startHour), 0);
  const showRail = screen === 'Planner';

  return (
    <div className="stage">
      <div className="hz">
        <span className="hz-lab">AgencyTrack · linked prototype</span>
        <div className="seg">
          {[['agent', 'Agent'], ['pmanager', 'Producing mgr'], ['manager', 'Manager']].map(([v, l]) => <button key={v} className={role === v ? 'is-on' : ''} onClick={() => switchRole(v)}>{l}</button>)}
        </div>
        <div className="seg">
          {TABS.map(s => <button key={s} className={screen === s ? 'is-on' : ''} onClick={() => goto(s)}>{s}</button>)}
        </div>
        <button className={'sync sync-' + (!store.online ? 'offline' : store.syncing ? 'syncing' : 'synced')}
          onClick={() => store.goOnline(!store.online)} title="Toggle the network to see writes queue">
          <Icon name={store.online ? (store.syncing ? 'repeat' : 'check') : 'alert'} size={13} />
          {!store.online ? 'Offline · ' + store.queued.length + ' queued' : store.syncing ? 'Syncing' : 'Synced'}
        </button>
        <span className="hz-hint">1–{TABS.length} screens · d/w scale · s smart · n new · f focus · [ nav · ] plan</span>
        <button className="hz-btn" onClick={() => setShowMobile(m => !m)} aria-pressed={showMobile}><Icon name="users" size={14} /> {showMobile ? 'Desktop' : 'Phone'}</button>
        <button className="hz-btn" onClick={() => setModal({ kind: 'prefs' })}><Icon name="settings" size={14} /> Customise</button>
        <button className="hz-btn" onClick={() => setDark(d => !d)}><Icon name={dark ? 'sun' : 'moon'} size={14} /> {dark ? 'Light' : 'Dark'}</button>
      </div>

      {showMobile && <MobileApp store={store} prefs={prefs} currentHour={currentHour} dark={dark} onToggleDark={() => setDark(d => !d)} />}
      <div className={'nexus' + (dark ? ' dark' : '') + (focus ? ' is-focus' : '')} ref={frameRef}
        style={{ position: 'relative', width: focus ? '100vw' : 1280, height: focus ? '100vh' : 900, background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)', borderRadius: focus ? 0 : 14, border: focus ? 'none' : '1px solid var(--ruleStrong)', overflow: 'hidden' }}>
        <a className="skip" href="#at-main">Skip to content</a>
        <div className="shell" style={{ height: '100%', minHeight: 0 }}>
          <nav className={'side' + (navCollapsed ? ' is-collapsed' : '')} aria-label="Primary">
            <div className="side-brand"><span className="side-mark">A</span><span>AgencyTrack</span></div>
            <div className="side-role">{role === 'manager' ? 'Manager · South unit' : role === 'pmanager' ? 'Producing manager · sells and manages' : 'Agent · My book'}</div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              <SideNavSections sections={role === 'manager' ? MANAGER_NAV : role === 'pmanager' ? PMANAGER_NAV : AGENT_NAV} active={screen} onNav={goto} />
            </div>
            <div className="side-foot">
              <Avatar initials="MS" size={30} />
              {!navCollapsed && <div className="side-who"><b>Marsha Singh</b><span>{role === 'manager' ? 'Unit manager' : role === 'pmanager' ? 'Producing manager' : 'Senior associate'}</span></div>}
            </div>
            <button className="side-chev" onClick={() => setNavCollapsed(c => !c)}
              aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!navCollapsed}>
              <IconChevD size={14} style={{ transform: navCollapsed ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
            </button>
          </nav>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <Topbar title={screen} subtitle={META[screen] || 'AgencyTrack'} dark={dark} onToggleMode={() => setDark(d => !d)} />
            <div className="pl-body">
              <main id="at-main" className="pl-main">
                {screen === 'Planner' && (
                  <>
                    <div className="pl-tool">
                      <div className="ph-nav">
                        <button aria-label="Previous"><Icon name="arrow" size={15} style={{ transform: 'rotate(180deg)' }} /></button>
                        <span>{scale === 'week' ? 'WK 27' : 'WED 01'}</span>
                        <button aria-label="Next"><Icon name="arrow" size={15} /></button>
                      </div>
                      <div className="seg-sm">
                        {[['Day', 'day'], ['Week', 'week']].map(([l, v]) => <button key={v} className={scale === v ? 'is-on' : ''} onClick={() => setScale(v)}>{l}</button>)}
                      </div>
                      <button className="pl-icbtn" onClick={() => setSmart(s => !s)} aria-pressed={smart}
                        title={'Smart · collapse gaps over ' + prefs.gapThreshold + ' minutes (s)'}>
                        <IconBulb size={14} /> Smart
                      </button>
                      <span className="pl-stat">{live.length} booked · {kept} kept · {plannedH.toFixed(1)}h</span>
                      <button className="pl-icbtn pl-icbtn-pri" onClick={() => setModal({ kind: 'new' })} title="Book an event (n)">
                        <Icon name="plus" size={14} /> Add event
                      </button>
                      <button className="pl-icbtn" onClick={toggleFocus} aria-pressed={focus} title="Focus mode (f)">
                        <Icon name={focus ? 'plus' : 'grid'} size={14} style={focus ? { transform: 'rotate(45deg)' } : undefined} /> {focus ? 'Exit focus' : 'Focus'}
                      </button>
                      <button className="pl-icbtn" onClick={() => setRailOpen(o => !o)} aria-pressed={railOpen} aria-controls="at-rail" title="Action plan (])">
                        <IconChevD size={14} style={{ transform: railOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }} /> Plan
                      </button>
                    </div>
                    {scale === 'day'
                      ? (smart
                        ? <SmartView events={store.events} gapThreshold={prefs.gapThreshold} dragging={dragging}
                            onDrop={(hour) => { if (draggedTask) store.scheduleTask(draggedTask, hour); onDragEnd(); }}
                            showPlay={showPlay} onTogglePlay={store.togglePlay} onEventClick={openEvent} />
                        : <DayGrid events={store.events} currentHour={prefs.nowLine ? currentHour : -1} dragging={dragging} draggedTask={draggedTask}
                            hoveredHour={hoveredDay === TODAY_KEY || hoveredDay === null ? hoveredHour : null}
                            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                            showPlay={showPlay} onTogglePlay={store.togglePlay} onEventClick={openEvent} />)
                      : (smart
                        ? <SmartWeek todayEvents={store.events} gapThreshold={prefs.gapThreshold}
                            currentHour={prefs.nowLine ? currentHour : -1} dragging={dragging} draggedTask={draggedTask}
                            onDrop={(hour, day) => { if (draggedTask && day === TODAY_KEY) store.scheduleTask(draggedTask, hour); onDragEnd(); }}
                            showPlay={showPlay} onTogglePlay={store.togglePlay} onEventClick={openEvent} />
                        : <WeekGrid todayEvents={store.events} currentHour={prefs.nowLine ? currentHour : -1} dragging={dragging} draggedTask={draggedTask}
                            hoveredHour={hoveredHour} hoveredDay={hoveredDay}
                            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                            showPlay={showPlay} onTogglePlay={store.togglePlay} onEventClick={openEvent} />)}
                  </>
                )}
                {screen === 'Unit Desk' && <ManagerScreen store={store} onGoto={goto} />}
                {screen === 'Bulk Import' && <BulkImportScreen store={store} onGoto={goto} />}
                {screen === 'Activities' && <ActivitiesScreen store={store} onGoto={goto} onOpenLead={setOpenLeadId} currentHour={currentHour} />}
                {screen === 'Weekly Numbers' && <WeeklyNumbersScreen store={store} onGoto={goto} />}
                {screen === 'Who Sees What' && <VisibilityScreen store={store} onGoto={goto} role={role} />}
                {screen === 'Game Plan' && <GamePlanScreen store={store} onGoto={goto} />}
                {screen === 'Pipeline' && <PipelineScreen store={store} onGoto={goto} role={role} prefs={prefs} />}
                {screen === 'The Book' && <BookScreen store={store} onGoto={goto} />}
                {screen === 'Commission' && <CommissionScreen store={store} onGoto={goto} />}
                {screen === 'Recruiting' && <RecruitScreen store={store} onGoto={goto} role="manager" />}
                {screen === 'My Referrals' && <RecruitScreen store={store} onGoto={goto} role="agent" />}
                {screen === 'Dialer' && <DialerScreen store={store} onGoto={goto} openLeadId={openLeadId} prefs={prefs} currentHour={currentHour} />}
                {screen === 'Lead Entry' && <LeadEntryScreen store={store} onGoto={goto} />}
                {screen === 'Activity' && <ActivityScreen store={store} />}
                {!ROUTED.includes(screen) && <StubScreen label={screen} onGoto={goto} />}
              </main>
              {showRail && (
                <div className={'pl-rail' + (railOpen ? '' : ' is-collapsed')} id="at-rail">
                  {railOpen
                    ? <ActionPlan tasks={store.tasks} onDragStart={onDragStart} onDragEnd={onDragEnd} onComplete={store.completeTask}
                        onAdd={store.addTask} month={month} onMonth={setMonth} completed={store.activities.filter(a => a.type === 'task_completed').length + 2}
                        autoAdvance={autoAdvance} setAutoAdvance={setAutoAdvance} showPlay={showPlay} setShowPlay={setShowPlay} counters={COUNTERS} />
                    : <button className="rail-stub" onClick={() => setRailOpen(true)} aria-label="Open the action plan">
                        <IconChevD size={15} style={{ transform: 'rotate(90deg)' }} />
                        <span className="rail-stub-lab">Action plan</span>
                        <span className="rail-stub-n">{store.tasks.length}</span>
                      </button>}
                </div>
              )}
            </div>
          </div>
        </div>

        {modal && modal.kind === 'event' && (() => {
          // Read the LIVE event, not the snapshot captured when the block was clicked —
          // otherwise toggling prep updates the store and the open overlay keeps showing
          // the stale copy.
          const live = store.events.find(e => e.id === modal.ev.id) || modal.ev;
          return <EventOverlay event={live} onClose={() => setModal(null)}
            onAction={(id, action) => store.setEventStatus(id, action)}
            onPrepToggle={store.togglePrep}
            onPrep={(id) => setModal({ kind: 'prep', id, from: live })} />;
        })()}
        {modal && modal.kind === 'prep' && <PrepOverlay id={modal.id} onClose={() => setModal(null)} onBack={() => setModal({ kind: 'event', ev: modal.from })} />}
        {modal && modal.kind === 'prefs' && <PrefsOverlay prefs={prefs} set={setPref} reset={resetPrefs} changed={prefsChanged} onClose={() => setModal(null)} />}
        {modal && modal.kind === 'new' && <NewEventOverlay events={store.events} onClose={() => setModal(null)}
          onCreate={(d) => { store.addEvent(d); setModal(null); }} />}
      </div>
    </div>
  );
}

Object.assign(window, { AgencyTrackApp, ActivityScreen });
