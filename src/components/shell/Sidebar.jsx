import React, { Fragment, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { LogOut, ChevronLeft, ChevronRight, Star, Settings } from 'lucide-react';
import WorkspaceToggle from './WorkspaceToggle';

/**
 * Desktop primary navigation (Design System v2 — B4).
 *
 * Mock parity: lifts the .sidebar / .sidebar-link / .sidebar-foot markup
 * from mocks/concept-4-complete.html. Renders a `<nav>` landmark labelled
 * "Primary navigation" so the walkthrough's a11y assertions pass.
 *
 * Nav items are grouped by `sectionLabel` — items without a label inherit
 * the previous section. Active highlight is driven by `activeTab`; tabId
 * items call `setActiveTab(item.tabId)`, action items call
 * `onAction(item.action)` (used for non-tab triggers like the agent's
 * Submit Report → wizard).
 *
 * ★ Pinned zone (Nav redesign PR-2): when pinning is enabled (the dashboard
 * passes `pinnedItems` + `isPinned`/`onPin`/`onUnpin`), a ★ Pinned section
 * renders above the first group (hidden when empty), and every row gets a star
 * pin/unpin toggle. Roles that pass no pinning props render exactly as before.
 *
 * ★ Drag-reorder (Fable Tier 1 · 1.4): when `onReorder` is passed, regular
 * (non-pinned-zone) rows become drag-reorderable WITHIN their section — pointer
 * drag on desktop, long-press-armed drag on touch. On drop the new flat id order
 * (all sections, only the dragged section reordered) is handed to `onReorder`;
 * `navItems` are pre-ordered by the caller via `applyNavOrder`, so the Sidebar
 * only reports the new order — it never reorders `navItems` itself. Cross-section
 * moves are impossible (insertion index is clamped to the dragged item's section;
 * leaving the section bounds snaps back). A click without movement past the
 * threshold still navigates. The Pinned zone is NOT reorderable here (pins have
 * their own model).
 *
 * ★ Keyboard reorder (Fable VH · D2): the same draggable rows also reorder from
 * the keyboard. With a row focused, Alt+ArrowUp / Alt+ArrowDown moves it one slot
 * WITHIN its section (clamped at the section edges — never wraps, never crosses
 * sections), committing atomically through the SAME `onReorder` path the pointer
 * machine uses. There is no transient/uncommitted mode: each keystroke is a
 * committed, `aria-live`-announced, persisted move (chosen over a mode+Enter model
 * because it maps 1:1 onto the existing single-callback contract with zero
 * divergent transient render state). Plain Arrow keys keep their default focus
 * behavior; only Alt+Arrow reorders. Reduced-motion safe by construction — the
 * move is an instant re-render, no animation.
 *
 * The collapse toggle only changes layout at >=1024px (the tablet
 * breakpoint forces 72px regardless). At <768px the whole sidebar
 * disappears — the bottom-nav owns mobile navigation.
 */

// Movement (px) a press must exceed before it becomes a drag rather than a click.
const DRAG_THRESHOLD = 5;
// Movement (px) during the pre-long-press window that cancels the timer (the
// user is scrolling, not arming a drag).
const SCROLL_CANCEL = 10;
// Long-press duration (ms) that arms drag mode on touch — prevents scroll hijack.
const LONG_PRESS_MS = 450;

function arrayMove(arr, from, to) {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function Sidebar({
  navItems,
  activeTab,
  setActiveTab,
  onAction,
  userProfile,
  roleLabel,
  onSignOut,
  collapsed,
  toggleCollapse,
  pinnedItems = [],
  isPinned,
  onPin,
  onUnpin,
  onReorder,
  showPinnedZone = true,
  showWorkspaceToggle = false,
  workspace,
  onWorkspaceChange,
}) {
  const sections = useMemo(() => groupBySection(navItems), [navItems]);
  const canPin = typeof onPin === 'function' && typeof onUnpin === 'function';
  const canReorder = typeof onReorder === 'function';
  // ★ Pinned zone shows for `pinned` + `both` layouts (PR-2 behavior); the
  // `workspace` layout passes showPinnedZone={false} to hide it (decision #5).
  const renderPinnedZone = canPin && pinnedItems.length > 0 && showPinnedZone;

  const initials = getInitials(userProfile);
  const displayName = userProfile?.name ?? userProfile?.email ?? 'AgencyTrack User';
  const photoURL = userProfile?.photoURL ?? null;

  // ── ★ Drag-reorder state ────────────────────────────────────────────────────
  // dragUI drives render (ghost + drop line + live translate); gestureRef holds
  // the live, mutable gesture across pointer events without re-render churn.
  const [dragUI, setDragUI] = useState(null); // { id, sectionIdx, overIdx, dy } | null
  const gestureRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const rowElRef = useRef(new Map()); // item.id → row element (geometry source)
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Insertion index within the dragged section from the pointer Y. Clamped to the
  // section (never crosses into another section); returns the origin index when
  // the pointer leaves the section's vertical bounds → visual snap-back.
  const computeOverIdx = useCallback((clientY, sectionItems, fromIdx) => {
    const rects = [];
    sectionItems.forEach((it, idx) => {
      const el = rowElRef.current.get(it.id);
      if (el) rects.push({ idx, rect: el.getBoundingClientRect() });
    });
    if (rects.length === 0) return fromIdx;
    if (clientY < rects[0].rect.top || clientY > rects[rects.length - 1].rect.bottom) {
      return fromIdx; // outside section bounds → snap back to origin
    }
    for (const { idx, rect } of rects) {
      if (clientY < rect.top + rect.height / 2) return idx;
    }
    return rects[rects.length - 1].idx;
  }, []);

  const computeNewFlatIds = useCallback((sectionIdx, fromIdx, toIdx) => {
    const secs = sectionsRef.current;
    if (!secs || !secs[sectionIdx]) return null;
    const moved = arrayMove(secs[sectionIdx].items, fromIdx, toIdx);
    const flat = [];
    secs.forEach((s, i) => {
      (i === sectionIdx ? moved : s.items).forEach((it) => flat.push(it.id));
    });
    return flat;
  }, []);

  const onRowPointerDown = useCallback((e, item, sectionIdx, fromIdx, sectionItems) => {
    if (!canReorder) return;
    // Ignore presses that start on the star toggle (it owns its own click).
    if (e.target?.closest?.('.sidebar-nav-star')) return;
    // Mouse: left button only.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearLongPress();
    gestureRef.current = {
      pointerId: e.pointerId,
      id: item.id,
      sectionIdx,
      fromIdx,
      sectionItems,
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
      armed: e.pointerType !== 'touch', // touch waits for long-press
      dragging: false,
      overIdx: fromIdx,
    };
    if (e.pointerType === 'touch') {
      longPressTimerRef.current = setTimeout(() => {
        const g = gestureRef.current;
        if (g && g.pointerId === e.pointerId) g.armed = true;
      }, LONG_PRESS_MS);
    }
    // Deliberately NO setPointerCapture here. Capturing on the row div at
    // pointerdown retargets the whole gesture — including the eventual `click`
    // — to the div, so the inner button's onClick never fires and a plain
    // sidebar click stops navigating in real browsers (caught by the 1.4 live
    // smoke; invisible to jsdom, whose setPointerCapture is a no-op and whose
    // fireEvent.click dispatches straight to the button). onRowPointerMove
    // captures at the moment the drag actually arms (past DRAG_THRESHOLD) —
    // the only time capture is needed.
  }, [canReorder]);

  const onRowPointerMove = useCallback((e) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const dist = Math.hypot(dx, dy);

    // Touch, not yet armed: any real movement is a scroll → cancel the gesture.
    if (g.pointerType === 'touch' && !g.armed) {
      if (dist > SCROLL_CANCEL) {
        clearLongPress();
        gestureRef.current = null;
      }
      return;
    }

    if (!g.dragging) {
      if (dist <= DRAG_THRESHOLD) return; // below threshold → still a potential click
      g.dragging = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom / unsupported */ }
    }

    const overIdx = computeOverIdx(e.clientY, g.sectionItems, g.fromIdx);
    g.overIdx = overIdx;
    setDragUI({ id: g.id, sectionIdx: g.sectionIdx, overIdx, dy });
    if (e.cancelable) e.preventDefault(); // best-effort scroll suppression on touch
  }, [computeOverIdx]);

  const onRowPointerUp = useCallback((e) => {
    const g = gestureRef.current;
    clearLongPress();
    if (!g || g.pointerId !== e.pointerId) { setDragUI(null); return; }
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* jsdom / unsupported */ }
    if (g.dragging) {
      if (g.overIdx !== g.fromIdx) {
        const newFlat = computeNewFlatIds(g.sectionIdx, g.fromIdx, g.overIdx);
        if (newFlat) onReorder(newFlat);
      }
      // A completed drag (even in place) must not also fire the row's click.
      // The native trailing click — when the gesture's down+up land on the SAME
      // element — fires synchronously right after pointerup, before a 0ms
      // timeout. When the drag ends over a DIFFERENT row, no trailing click
      // ever fires; without this timed clear the armed flag would silently
      // swallow the user's NEXT legitimate sidebar click (caught by the 1.4
      // live smoke: post-drag click on another row did not navigate).
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    gestureRef.current = null;
    setDragUI(null);
  }, [computeNewFlatIds, onReorder]);

  const onRowPointerCancel = useCallback(() => {
    clearLongPress();
    gestureRef.current = null;
    setDragUI(null); // snap back — no reorder
  }, []);

  // ── ★ Keyboard reorder state (Fable VH · D2) ────────────────────────────────
  // A polite live region announces each committed move; after a keyboard move the
  // parent re-orders `navItems`, so focus is explicitly returned to the moved row
  // (React preserves the DOM node across the reorder, but we refocus deterministically
  // so the interaction never drops focus in any engine).
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const pendingFocusIdRef = useRef(null);

  const onRowKeyDown = useCallback((e, item, sectionIdx, fromIdx, sectionItems, sectionLabel) => {
    if (!canReorder) return;
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    // Own the gesture: stop the browser from also scrolling / moving focus.
    e.preventDefault();
    const dir = e.key === 'ArrowUp' ? -1 : 1;
    const toIdx = fromIdx + dir;
    const count = sectionItems.length;
    const where = sectionLabel || 'this section';
    if (toIdx < 0 || toIdx >= count) {
      setReorderAnnouncement(`${item.label} is already ${dir < 0 ? 'first' : 'last'} in ${where}.`);
      return;
    }
    const newFlat = computeNewFlatIds(sectionIdx, fromIdx, toIdx);
    if (!newFlat) return;
    pendingFocusIdRef.current = item.id;
    setReorderAnnouncement(`${item.label} moved to position ${toIdx + 1} of ${count} in ${where}. Order saved.`);
    onReorder(newFlat);
  }, [canReorder, computeNewFlatIds, onReorder]);

  // Return focus to the moved row after the parent re-orders `navItems`. Only a
  // keyboard move sets pendingFocusId, so pointer reorders and initial mount are
  // untouched (the ref is null → early return).
  useLayoutEffect(() => {
    const id = pendingFocusIdRef.current;
    if (!id) return;
    pendingFocusIdRef.current = null;
    const btn = rowElRef.current.get(id)?.querySelector?.('.sidebar-link');
    if (btn) btn.focus();
  }, [navItems]);

  const handleRowClick = (item, isDisabled) => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    if (isDisabled) return;
    if (item.tabId != null) setActiveTab(item.tabId);
    else if (item.action != null) onAction?.(item.action);
  };

  const renderRow = (item, opts = {}) => {
    const { inPinnedZone = false, sectionIdx = -1, indexInSection = -1, sectionItems = null, sectionLabel = null } = opts;
    const Icon = item.Icon;
    const isActive = item.tabId != null && activeTab === item.tabId;
    const isDisabled = item.disabled === true;
    const isChild = item.child === true;
    const pinned = canPin && typeof isPinned === 'function' ? isPinned(item.id) : false;
    const draggable = canReorder && !inPinnedZone;
    const isDragging = draggable && dragUI?.id === item.id;
    // Pinned-zone rows get a distinct testid so a seeded item that ALSO appears
    // in its group doesn't render the same data-testid twice (Playwright strict
    // mode + tooling). Group rows keep the canonical nav testid.
    const testId = inPinnedZone ? `pinned-${item.id}` : (item.testId ?? `nav-${item.id}`);

    const rowClass = `sidebar-link-row${draggable ? ' sidebar-link-row-draggable' : ''}${isDragging ? ' sidebar-link-row-dragging' : ''}`;
    const rowStyle = isDragging && dragUI?.dy ? { transform: `translateY(${dragUI.dy}px)` } : undefined;

    return (
      <div
        className={rowClass}
        key={inPinnedZone ? `pin-${item.id}` : item.id}
        style={rowStyle}
        ref={draggable
          ? (el) => { if (el) rowElRef.current.set(item.id, el); else rowElRef.current.delete(item.id); }
          : undefined}
        onPointerDown={draggable ? (e) => onRowPointerDown(e, item, sectionIdx, indexInSection, sectionItems) : undefined}
        onPointerMove={draggable ? onRowPointerMove : undefined}
        onPointerUp={draggable ? onRowPointerUp : undefined}
        onPointerCancel={draggable ? onRowPointerCancel : undefined}
      >
        <button
          type="button"
          className={`sidebar-link${isChild ? ' sidebar-link-child' : ''}${isActive ? ' active' : ''}${isDisabled ? ' sidebar-link-disabled' : ''}`}
          onClick={() => handleRowClick(item, isDisabled)}
          onKeyDown={draggable ? (e) => onRowKeyDown(e, item, sectionIdx, indexInSection, sectionItems, sectionLabel) : undefined}
          aria-current={isActive ? 'page' : undefined}
          aria-disabled={isDisabled || undefined}
          tabIndex={isDisabled ? -1 : undefined}
          title={isDisabled ? `${item.label} · Coming soon` : item.label}
          data-testid={testId}
        >
          {isChild && <span className="sidebar-link-child-connector" aria-hidden="true" />}
          <Icon size={isChild ? 15 : 17} />
          <span className="sidebar-link-label">{item.label}</span>
          {item.scope && (
            <span className="sidebar-link-scope" data-scope={item.scope}>
              {item.scope}
            </span>
          )}
          {isDisabled && (
            <span className="badge badge-soon" aria-label="Coming soon">Soon</span>
          )}
          {!isDisabled && item.badgeNew && (
            <span className="badge badge-new" aria-label="New">New</span>
          )}
          {!isDisabled && item.badgeCount != null && item.badgeCount > 0 && (
            <span
              className={`badge${item.badgeVariant === 'warning' ? ' badge-warning' : ''}`}
              aria-label={`${item.badgeCount} ${item.badgeCountLabel ?? 'pending'}`}
            >
              {item.badgeCount}
            </span>
          )}
        </button>
        {canPin && (
          <button
            type="button"
            className={`sidebar-nav-star${pinned ? ' sidebar-nav-star-on' : ''}`}
            aria-pressed={pinned}
            aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.label}`}
            onClick={() => (pinned ? onUnpin(item.id) : onPin(item.id))}
          >
            {/* ★ De-emphasis (Run3 F8): the pin star on a PINNED row renders one
                step smaller (14→12) and drops from the brand-teal accent to the
                muted ink token (CSS below) — cognitive-load reduction on the menu.
                The 44px button hit target (index.css) is unchanged: this control
                is also the pin/unpin toggle, so it stays fully operable. Unpinned
                rows keep size 14. */}
            <Star size={pinned ? 12 : 14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <nav aria-label="Primary navigation" className="sidebar">
      {/* ★ Keyboard-reorder announcements (Fable VH · D2) — visually hidden,
          polite live region. Reuses the app's `sr-only` utility. */}
      <div className="sr-only" role="status" aria-live="polite" data-testid="nav-reorder-live">
        {reorderAnnouncement}
      </div>
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark" aria-hidden="true">
          <img
            src="/icons.svg"
            alt=""
            width="28"
            height="28"
            style={{ display: 'block', borderRadius: 7, flexShrink: 0 }}
          />
        </div>
        <div className="sidebar-brand-name">AgencyTrack</div>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ★ Pinned zone — above the toggle/first group; hidden when empty or for
          the workspace layout (showPinnedZone=false). For `both` it renders
          above the My Work ⇄ My Team toggle (decision #5). Pinned rows are NOT
          drag-reorderable (pins own their order model). */}
      {renderPinnedZone && (
        <Fragment>
          <div className="sidebar-section">★ Pinned</div>
          {pinnedItems.map((item) => renderRow(item, { inPinnedZone: true }))}
        </Fragment>
      )}

      {/* My Work ⇄ My Team toggle — workspace + both layouts (producing managers). */}
      {showWorkspaceToggle && typeof onWorkspaceChange === 'function' && (
        <WorkspaceToggle workspace={workspace} onChange={onWorkspaceChange} idPrefix="sidebar-ws" />
      )}

      {sections.map((section, idx) => {
        const showDropInSection = dragUI != null && dragUI.sectionIdx === idx;
        return (
          <Fragment key={section.label ?? `s${idx}`}>
            {section.label && (
              <div className="sidebar-section">{section.label}</div>
            )}
            {section.items.map((item, itemIdx) => (
              <Fragment key={item.id}>
                {showDropInSection && dragUI.overIdx === itemIdx && dragUI.id !== item.id && (
                  <div className="sidebar-drop-line" aria-hidden="true" />
                )}
                {renderRow(item, {
                  sectionIdx: idx,
                  indexInSection: itemIdx,
                  sectionItems: section.items,
                  sectionLabel: section.label,
                })}
              </Fragment>
            ))}
          </Fragment>
        );
      })}

      <div className="sidebar-foot">
        <button
          type="button"
          className="sidebar-foot-avatar"
          onClick={() => setActiveTab('profile')}
          aria-label="Open profile"
        >
          {photoURL ? <img src={photoURL} alt="" /> : initials}
        </button>
        <div className="sidebar-foot-info">
          <div className="sidebar-foot-name">{displayName}</div>
          {roleLabel && <div className="sidebar-foot-role">{roleLabel}</div>}
        </div>
        {/* Settings v2 (Tier 2 · 2.4) — off the avatar menu per the mockup IA.
            Shared across all three dashboards (they each render an `activeTab
            === 'settings'` block). Mobile reaches Settings via the More drawer. */}
        <button
          type="button"
          className="sidebar-foot-action is-settings"
          onClick={() => setActiveTab('settings')}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <button
          type="button"
          className="sidebar-foot-action"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}

function groupBySection(items) {
  const sections = [];
  let current = null;
  for (const item of items) {
    if (item.sectionLabel || current == null) {
      current = { label: item.sectionLabel ?? null, items: [] };
      sections.push(current);
    }
    current.items.push(item);
  }
  return sections;
}

function getInitials(profile) {
  const source = profile?.name ?? profile?.email ?? '';
  if (!source) return 'A';
  const parts = source.trim().split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
