/* ============================================================================
   nexus-nav.jsx — the navigation & cognitive-load layer (2026 redesign)
   ----------------------------------------------------------------------------
   The full nav system proven in the app: desktop sectioned sidebar with
   drag-reorder, mobile bottom bar with adaptive More + center create FAB, the
   More sheet (pinned + frequent + sectioned), the create sheet, and the command
   palette. Styles: nexus-nav.css. Tokens: canonical .nexus set.

   Depends on your DS <Icon> and <Eyebrow>, and (from nexus-patterns.jsx)
   useFocusTrap. React 18 hooks.

   ── Drag-reorder DOM protocol (shared by sidebar + mobile bar) ──────────────
   Reorderable buttons carry data-rid (item id) + data-rgroup (which list).
   Mouse uses native HTML5 drag events; touch uses useTouchReorder (long-press
   → pointermove hit-test → drop). The hook stamps [data-rdrag] on the dragged
   node and [data-rover] on the hover target (styled in nexus-nav.css), and sets
   el.__reorderJustDragged so the trailing click is suppressed. onReorder(from,to)
   is called with the two item ids; you persist the new order.

   ── State the host must own & persist (per role) ────────────────────────────
     navOrder      sidebar section item order      pinned    More-sheet pins
     tabOrder      mobile bottom-bar order          frequent  visit counts → top N
   ============================================================================ */
const { useState, useEffect, useRef } = React;

/* ── useTouchReorder: long-press pointer-drag fallback for touch ──────────── */
function useTouchReorder() {
  const ref = useRef(null);
  useEffect(() => {
    const clearOver = () => document.querySelectorAll('[data-rover]').forEach(el => el.removeAttribute('data-rover'));
    const move = e => {
      const s = ref.current; if (!s || !s.dragging) return;
      e.preventDefault();
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const tgt = t && t.closest('[data-rid]');
      clearOver();
      if (tgt && tgt.getAttribute('data-rgroup') === s.group && tgt.getAttribute('data-rid') !== s.id) {
        tgt.setAttribute('data-rover', '1'); s.overId = tgt.getAttribute('data-rid');
      } else s.overId = null;
    };
    const end = () => {
      const s = ref.current; if (!s) return;
      clearTimeout(s.timer);
      if (s.dragging) {
        clearOver();
        document.body.style.userSelect = '';
        if (s.el) s.el.removeAttribute('data-rdrag');
        if (s.overId && s.onReorder) s.onReorder(s.id, s.overId);
        s.el && (s.el.__reorderJustDragged = Date.now());
      }
      ref.current = null;
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, []);
  return (id, group, onReorder) => e => {
    if (e.pointerType !== 'touch') return;
    const el = e.currentTarget;
    const timer = setTimeout(() => {
      const s = ref.current; if (!s) return;
      s.dragging = true; el.setAttribute('data-rdrag', '1');
      try { navigator.vibrate && navigator.vibrate(8); } catch (x) {}
      document.body.style.userSelect = 'none';
    }, 300);
    ref.current = { id, group, el, timer, dragging: false, onReorder, overId: null };
  };
}

/* ── SideNavSections: desktop sidebar, sectioned + drag-reorderable ────────── */
function SideNavSections({ sections, active, onNav, onReorder }) {
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const onTouch = useTouchReorder();
  const guardClick = (el, fn) => { if (el && el.__reorderJustDragged && Date.now() - el.__reorderJustDragged < 400) return; fn(); };
  return sections.map(sec => (
    <div key={sec.g} className="side-sec">
      <Eyebrow tone="faint">{sec.g}</Eyebrow>
      {sec.items.map(([ic, label]) => (
        <button key={label}
          data-rid={label} data-rgroup={'nav-' + sec.g}
          className={'nav-item' + (active === label ? ' is-active' : '') + (over === sec.g + '|' + label ? ' is-drop' : '')}
          aria-current={active === label ? 'page' : undefined}
          draggable={!!onReorder}
          onPointerDown={onReorder ? onTouch(label, 'nav-' + sec.g, (from, to) => onReorder(sec.g, sec.items.map(i => i[1]), from, to)) : undefined}
          onDragStart={e => { drag.current = { g: sec.g, label, labels: sec.items.map(i => i[1]) }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', label); } catch (x) {} }}
          onDragOver={e => { const d = drag.current; if (d && d.g === sec.g) { e.preventDefault(); if (d.label !== label) setOver(sec.g + '|' + label); } }}
          onDragLeave={() => setOver(o => o === sec.g + '|' + label ? null : o)}
          onDrop={e => { e.preventDefault(); const d = drag.current; if (d && d.g === sec.g && d.label !== label && onReorder) onReorder(sec.g, d.labels, d.label, label); drag.current = null; setOver(null); }}
          onDragEnd={() => { drag.current = null; setOver(null); }}
          onClick={e => guardClick(e.currentTarget, () => onNav && onNav(label))} title={label}>
          {onReorder && <span className="nav-grip" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>}
          <Icon name={ic} size={17} /><span>{label}</span>
        </button>
      ))}
    </div>
  ));
}

/* ── MobileTab: fixed 5-slot bottom bar ──────────────────────────────────────
   Slot 5 is ALWAYS More — position never moves. On a deep screen it adaptively
   shows the current screen's name but keeps a ⋮ affordance (so it still reads as
   a menu). `primary` adds the center raised create FAB. Tabs are drag-reorderable
   when onReorder is supplied. */
function MobileTab({ tabs, screen, go, onMore, primary, onCreate, current, onReorder }) {
  const inTabs = tabs.some(t => t[2] === screen);
  const deep = !inTabs;
  const moreItem = { more: true, on: deep, ic: deep && current ? current.ic : 'grid', lab: deep && current ? current.label : 'More' };
  const items = [...tabs.map(([ic, lab, id]) => ({ ic, lab, id, on: screen === id })), moreItem];
  const drag = useRef(null);
  const [over, setOver] = useState(null);
  const onTouch = useTouchReorder();
  const btn = (it) => it.more
    ? <button key="more" className={'mtab mtab-more' + (it.on ? ' is-on' : '')} onClick={onMore} aria-current={it.on ? 'page' : undefined} aria-haspopup="dialog" aria-label={it.on ? (it.lab + ' \u2014 open menu') : 'More \u2014 open menu'}>
        <span className="mtab-more-ic"><Icon name={it.ic} size={20} /><span className="mtab-dots" aria-hidden="true"><i></i><i></i><i></i></span></span>
        <span>{it.lab}</span>
      </button>
    : <button key={it.id} data-rid={it.id} data-rgroup="mtab" className={'mtab' + (it.on ? ' is-on' : '') + (over === it.id ? ' is-drop' : '')}
        aria-current={it.on ? 'page' : undefined}
        draggable={!!onReorder}
        onPointerDown={onReorder ? onTouch(it.id, 'mtab', (from, to) => onReorder(from, to)) : undefined}
        onDragStart={e => { drag.current = it.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', it.id); } catch (x) {} }}
        onDragOver={e => { if (drag.current) { e.preventDefault(); if (drag.current !== it.id) setOver(it.id); } }}
        onDragLeave={() => setOver(o => o === it.id ? null : o)}
        onDrop={e => { e.preventDefault(); if (drag.current && drag.current !== it.id && onReorder) onReorder(drag.current, it.id); drag.current = null; setOver(null); }}
        onDragEnd={() => { drag.current = null; setOver(null); }}
        onClick={e => { if (drag.current) return; const el = e.currentTarget; if (el.__reorderJustDragged && Date.now() - el.__reorderJustDragged < 400) return; go(it.id); }}><Icon name={it.ic} size={20} /><span>{it.lab}</span></button>;
  if (!primary) return <nav className="mobile-tab" aria-label="Primary">{items.map(btn)}</nav>;
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid), right = items.slice(mid);
  return (
    <nav className="mobile-tab has-fab" aria-label="Primary">
      {left.map(btn)}
      <button className="mtab-fab" onClick={onCreate} aria-label={primary.label}><Icon name="plus" size={26} /></button>
      {right.map(btn)}
      <span className="mtab-fab-label">{primary.label}</span>
    </nav>
  );
}

/* ── MobileMore: full navigation sheet — Pinned + Frequent + sections ──────── */
function MobileMore({ open, title, sections, active, onNav, onClose, lens, onLens, pinnedItems, frequentItems, pinnedSet, onTogglePin }) {
  const trapRef = useFocusTrap(open);
  const cell = ([ic, label]) => (
    <div key={label} className="m-sheet-cell">
      <button className={'m-sheet-item' + (active === label ? ' is-active' : '')} onClick={() => onNav(label)} aria-current={active === label ? 'page' : undefined}>
        <Icon name={ic} size={18} /><span>{label}</span>
      </button>
      <button className={'m-sheet-pin' + (pinnedSet && pinnedSet.has(label) ? ' is-pinned' : '')}
        onClick={e => { e.stopPropagation(); onTogglePin && onTogglePin(label); }}
        aria-label={pinnedSet && pinnedSet.has(label) ? 'Unpin' : 'Pin'} title={pinnedSet && pinnedSet.has(label) ? 'Unpin' : 'Pin to top'}>
        <Icon name="pin" size={13} />
      </button>
    </div>
  );
  return (
    <div className={'m-sheet' + (open ? ' is-open' : '')} onClick={onClose} role="dialog" aria-modal="true" aria-label={title || 'Navigation menu'} aria-hidden={!open}>
      <div className="m-sheet-panel" ref={trapRef} onClick={e => e.stopPropagation()}>
        <button className="m-sheet-grip" onClick={onClose} aria-label="Close menu" />
        <div className="m-sheet-head"><span>{title || 'All screens'}</span></div>
        {onLens && (
          <div className="m-lens m-lens--insheet">
            <button className={'m-lens-btn' + (lens === 'book' ? ' is-on' : '')} onClick={() => onLens('book')}><Icon name="home" size={15} /> My Book</button>
            <button className={'m-lens-btn' + (lens === 'team' ? ' is-on' : '')} onClick={() => onLens('team')}><Icon name="users" size={15} /> My Team</button>
          </div>
        )}
        <div className="m-sheet-scroll">
          {pinnedItems && pinnedItems.length > 0 && (
            <div className="m-sheet-sec">
              <Eyebrow tone="faint"><Icon name="pin" size={11} style={{ marginRight: 5, verticalAlign: '-1px' }} />Pinned</Eyebrow>
              <div className="m-sheet-grid">{pinnedItems.map(cell)}</div>
            </div>
          )}
          {frequentItems && frequentItems.length > 0 && (
            <div className="m-sheet-sec">
              <Eyebrow tone="faint">Frequent</Eyebrow>
              <div className="m-sheet-grid">{frequentItems.map(cell)}</div>
            </div>
          )}
          {sections.map(sec => (
            <div key={sec.g} className="m-sheet-sec">
              <Eyebrow tone="faint">{sec.g}</Eyebrow>
              <div className="m-sheet-grid">{sec.items.map(cell)}</div>
            </div>
          ))}
        </div>
        <button className="m-sheet-close is-done" onClick={onClose}><Icon name="check" size={18} /> Done</button>
      </div>
    </div>
  );
}

/* ── MobileCreateSheet: role-scoped quick-create ─────────────────────────────
   `actions` = [icon, label, screenId] rows pre-filtered to the role's creates. */
function MobileCreateSheet({ open, actions, onGo, onClose }) {
  const trapRef = useFocusTrap(open);
  return (
    <div className={'m-sheet' + (open ? ' is-open' : '')} onClick={onClose} role="dialog" aria-modal="true" aria-label="Create" aria-hidden={!open}>
      <div className="m-sheet-panel" ref={trapRef} onClick={e => e.stopPropagation()}>
        <button className="m-sheet-grip" onClick={onClose} aria-label="Close" />
        <div className="m-sheet-head"><span>Create</span></div>
        <div className="m-sheet-scroll">
          <div className="m-create-list">
            {actions.map(([ic, label, id]) => (
              <button key={label} className="m-create-item" onClick={() => onGo(id)}>
                <span className="m-create-ic"><Icon name={ic} size={17} /></span>
                <span className="m-create-lab">{label}</span>
                <Icon name="arrow" size={15} style={{ color: 'var(--inkFaint)' }} />
              </button>
            ))}
          </div>
        </div>
        <button className="m-sheet-close is-done" onClick={onClose}><Icon name="check" size={18} /> Done</button>
      </div>
    </div>
  );
}

/* ── CommandPalette: global search + role-scoped quick create (⌘K / "/") ───── */
function CommandPalette({ open, mode, screens, roles, onGo, onClose, quickActions }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const trapRef = useFocusTrap(open);
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open, mode]);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const roleSet = roles && roles.length ? roles : ['agent'];
  const quick = (quickActions || []).filter(x => x[3].some(r => roleSet.includes(r)));
  const ql = q.trim().toLowerCase();
  const results = screens.filter(s => s.shell !== 'bare' && s.label.trim().toLowerCase().includes(ql));
  const quickF = quick.filter(x => x[1].toLowerCase().includes(ql));
  const showCreate = mode === 'create' || ql;
  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd" ref={trapRef} role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Quick create' : 'Search and jump to'} onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Icon name="target" size={18} style={{ color: 'var(--inkFaint)' }} />
          <input ref={inputRef} className="cmd-input" value={q} onChange={e => setQ(e.target.value)}
            placeholder={mode === 'create' ? 'What do you want to create?' : 'Search screens, agents, policies\u2026'} />
          <kbd className="cmd-esc">ESC</kbd>
        </div>
        <div className="cmd-body">
          {showCreate && quickF.length > 0 && (
            <div className="cmd-sec">
              <Eyebrow tone="faint">Quick create</Eyebrow>
              {quickF.map(([ic, label, id]) => (
                <button key={label} className="cmd-item" onClick={() => onGo(id)}>
                  <span className="cmd-ic cmd-ic--create"><Icon name={ic} size={15} /></span>
                  <span>{label}</span><Icon name="arrow" size={14} style={{ marginLeft: 'auto', color: 'var(--inkFaint)' }} />
                </button>
              ))}
            </div>
          )}
          {mode !== 'create' && (
            <div className="cmd-sec">
              <Eyebrow tone="faint">{ql ? 'Screens' : 'Jump to'}</Eyebrow>
              {results.length ? results.slice(0, 8).map(s => (
                <button key={s.id} className="cmd-item" onClick={() => onGo(s.id)}>
                  <span className="cmd-ic"><Icon name={s.ic} size={15} /></span>
                  <span>{s.label.trim()}</span><span className="cmd-grp">{s.grp}</span>
                </button>
              )) : <div className="cmd-empty">No matches for \u201c{q}\u201d</div>}
            </div>
          )}
        </div>
        <div className="cmd-foot"><span>\u2191\u2193 to move</span><span>\u21b5 to open</span><span>Global search &amp; create \u2014 from anywhere</span></div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') {
  Object.assign(window, { useTouchReorder, SideNavSections, MobileTab, MobileMore, MobileCreateSheet, CommandPalette });
}
