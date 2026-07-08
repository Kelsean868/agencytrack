import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { COMING_SOON_TABS } from '../../config/comingSoonTabs';

/**
 * Command palette (Fable Tier 1 · item 1.1) — a fresh build per redesign-addendum
 * §3, NOT a port of the `_ds` / `ui_kits/nexus` ⌘K authoring demo (those are
 * reference-only per DESIGN-FOLDER-CATALOG).
 *
 * Cmd/Ctrl-K (or clicking the TopBar search) opens it. It searches over the
 * role's own nav + create actions — the SAME data the sidebar and Quick-Add ＋
 * menu are built from — so it is role-scoped by construction (only what the
 * current dashboard already exposes appears):
 *   • "Go to"   — nav items with a `tabId` → run `setActiveTab(tabId)`
 *   • "Actions" — nav items with an `action` + the Quick-Add create actions
 *                 → run `onAction(key)` (the exact dispatch QuickAddMenu uses,
 *                 so the palette fires the real handler, not a re-implementation)
 *
 * `soon` / COMING_SOON_TABS entries are omitted — a palette lists things you can
 * actually do right now. Duplicate action keys are de-duped (nav "Weekly Report"
 * vs Quick-Add "Weekly report" collapse to one command).
 *
 * Interaction is arrow-key driven with a single DOM focus target (the input),
 * the combobox/listbox + aria-activedescendant pattern — so Tab is a no-op and
 * ↑/↓ move a visible highlight the input announces. Dialog contract per §4:
 * role="dialog" + aria-modal, Escape closes, focus returns to the opener.
 */
export default function CommandPalette({
  onClose,
  navItems,
  quickAddActions = [],
  setActiveTab,
  onAction,
}) {
  const inputRef = useRef(null);
  const prevFocusRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  // Build the command set from the role's own nav + create actions. Both come
  // pre-filtered to the role by the dashboard, so nothing here needs a role check.
  const { go, actions } = useMemo(() => {
    const seen = new Set();
    const goCmds = [];
    const actionCmds = [];
    const isSoon = (key) => key != null && COMING_SOON_TABS.has(key);

    (navItems ?? []).forEach((it) => {
      if (!it || it.soon || it.disabled) return;
      if (it.tabId) {
        if (isSoon(it.tabId)) return;
        const key = `nav:${it.tabId}`;
        if (seen.has(key)) return;
        seen.add(key);
        goCmds.push({
          key, label: it.label, Icon: it.Icon, section: it.sectionLabel ?? null,
          run: () => setActiveTab?.(it.tabId),
        });
      } else if (it.action) {
        if (isSoon(it.action)) return;
        const key = `act:${it.action}`;
        if (seen.has(key)) return;
        seen.add(key);
        actionCmds.push({ key, label: it.label, Icon: it.Icon, run: () => onAction?.(it.action) });
      }
    });

    (quickAddActions ?? []).forEach((a) => {
      if (!a || a.soon || a.key === 'quick-add' || isSoon(a.key)) return;
      const key = `act:${a.key}`;
      if (seen.has(key)) return;
      seen.add(key);
      actionCmds.push({ key, label: a.label, Icon: a.Icon, run: () => onAction?.(a.key) });
    });

    return { go: goCmds, actions: actionCmds };
  }, [navItems, quickAddActions, setActiveTab, onAction]);

  // Filter by case-insensitive substring over label (+ section, so "recognition"
  // surfaces Leaderboard/Awards). Empty query shows everything.
  const { goF, actF, flat } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c) =>
      !q || c.label.toLowerCase().includes(q) || (c.section && c.section.toLowerCase().includes(q));
    const g = go.filter(match);
    const a = actions.filter(match);
    return { goF: g, actF: a, flat: [...g, ...a] };
  }, [query, go, actions]);

  // Reset highlight to the top whenever the filtered set changes.
  useEffect(() => { setActive(0); }, [query]);

  // Focus the input on open; restore focus to the opener on close. Guards
  // focusability + retries after paint, mirroring useFocusTrap's hardened
  // restore (the opener — the TopBar search button — is always still mounted).
  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      const t = prevFocusRef.current;
      const focusable = (el) => el && el.isConnected && !el.disabled && typeof el.focus === 'function';
      if (focusable(t)) {
        t.focus();
        if (document.activeElement === t) return;
      }
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => { if (focusable(t)) t.focus(); });
      }
    };
  }, []);

  // Keep the highlighted option scrolled into view as the selection moves.
  // (scrollIntoView is absent in jsdom and older engines — guard it.)
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmd-idx="${active}"]`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runAt = (idx) => {
    const cmd = flat[idx];
    if (!cmd) return;
    cmd.run();
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') { e.preventDefault(); runAt(active); return; }
    if (e.key === 'Tab') { e.preventDefault(); return; } // single focus target — trap on the input
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (flat.length) setActive(flat.length - 1);
    }
  };

  const optionId = (idx) => `cmdk-option-${idx}`;

  const renderOption = (cmd, idx) => {
    const Icon = cmd.Icon;
    const isActive = idx === active;
    return (
      <button
        key={cmd.key}
        type="button"
        role="option"
        id={optionId(idx)}
        data-cmd-idx={idx}
        data-testid={`cmdk-option-${cmd.key}`}
        aria-selected={isActive}
        tabIndex={-1}
        onClick={() => runAt(idx)}
        onMouseMove={() => setActive(idx)}
        className={[
          'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left min-h-[44px] transition-colors',
          isActive ? 'bg-primary/10 text-primary dark:bg-primary-dark/15' : 'text-ink hover:bg-surface-raised',
        ].join(' ')}
      >
        {Icon && <Icon size={16} className="flex-shrink-0" aria-hidden="true" />}
        <span className="flex-1 text-sm truncate">{cmd.label}</span>
        {cmd.section && <span className="text-[11px] text-ink-muted flex-shrink-0">{cmd.section}</span>}
        {isActive && <CornerDownLeft size={13} className="flex-shrink-0 text-ink-muted" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-x-0 top-[12vh] z-[70] flex justify-center px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="w-full max-w-lg bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[70vh]"
        >
          <div className="flex items-center gap-2 px-3 border-b border-border">
            <Search size={16} className="text-ink-muted flex-shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-listbox"
              aria-activedescendant={flat.length ? optionId(active) : undefined}
              aria-label="Search commands"
              placeholder="Search screens and actions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className="flex-1 bg-transparent py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>

          <div ref={listRef} id="cmdk-listbox" role="listbox" aria-label="Commands" className="overflow-y-auto p-2">
            {flat.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-ink-muted" data-testid="cmdk-empty">
                No commands match “{query.trim()}”
              </div>
            )}
            {goF.length > 0 && (
              <div role="group" aria-label="Go to">
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted" aria-hidden="true">
                  Go to
                </div>
                {goF.map((cmd, i) => renderOption(cmd, i))}
              </div>
            )}
            {actF.length > 0 && (
              <div role="group" aria-label="Actions">
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted" aria-hidden="true">
                  Actions
                </div>
                {actF.map((cmd, i) => renderOption(cmd, goF.length + i))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
