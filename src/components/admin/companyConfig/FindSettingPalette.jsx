import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

/**
 * "Find a setting" command palette (design handoff README §Find a setting).
 * This is NOT the app's global ⌘K command palette — the `aria-label`
 * deliberately differs ("Find a setting" vs the app's own palette label) so
 * assistive tech and future audits never conflate the two. This component
 * does not bind the ⌘F/⌘K keyboard shortcut itself — the parent screen owns
 * that binding and controls `open`.
 *
 * Pure/presentational: searches the `items` array supplied by the caller
 * (typically the full flattened settings registry) and reports the chosen
 * result via `onJump(item)`. It does not scroll the content column itself —
 * per the README, the section-switch + row-scroll-with-offset + flash
 * behavior belongs to the parent that owns the content column and the
 * `ConfigRow`/`flash` state.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {Array<{id: string, label: string, desc?: string, sectionLabel: string, group?: string, lock?: 'platform'|'soon'}>} props.items flattened registry items to search across (label + section + description + group)
 * @param {(item: object) => string} props.valuePreview caller-bound preview formatter — receives the item and returns its current-value preview string (handles HARDCODED/PLATFORM internally)
 * @param {(item: object) => void} props.onJump called with the chosen item; palette closes itself afterward
 */
export default function FindSettingPalette({ open, onClose, items, valuePreview, onJump }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setSel(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return (items || [])
      .filter(
        (it) =>
          it.label?.toLowerCase().includes(s) ||
          it.sectionLabel?.toLowerCase().includes(s) ||
          (it.desc || '').toLowerCase().includes(s) ||
          (it.group || '').toLowerCase().includes(s)
      )
      .slice(0, 8);
  }, [q, items]);

  useEffect(() => { setSel(0); }, [results.length]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  const jump = (item) => {
    if (!item) return;
    onJump(item);
    onClose();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- scrim-click-to-close on a non-interactive backdrop; the dialog itself carries the interactive semantics
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh] bg-[rgba(14,11,7,.4)]"
    >
      <div
        role="dialog"
        aria-label="Find a setting"
        data-testid="ccfg-palette"
        className="w-[min(560px,92vw)] bg-card border border-border rounded-2xl shadow-lg overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
          <Search size={16} className="text-ink-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a setting — try “mdrt”, “streak”, “kiosk”…"
            aria-label="Find a setting"
            data-testid="ccfg-palette-input"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(x + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(x - 1, 0)); }
              if (e.key === 'Enter') jump(results[sel]);
              if (e.key === 'Escape') onClose();
            }}
            className="flex-1 border-none outline-none bg-transparent text-[14px] font-semibold text-ink placeholder:text-ink-muted"
          />
          <kbd className="font-mono text-[10px] font-bold text-ink-muted bg-surface-muted border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {q.trim() !== '' && (
          <div ref={listRef} className="p-1.5 max-h-[380px] overflow-y-auto">
            {results.length === 0 && (
              <div className="px-3.5 py-4.5 text-[12.5px] text-ink-muted">No settings match &ldquo;{q}&rdquo;.</div>
            )}
            {results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                data-testid="ccfg-palette-result"
                data-active={i === sel ? 'true' : 'false'}
                onClick={() => jump(r)}
                onMouseEnter={() => setSel(i)}
                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg ${
                  i === sel ? 'bg-primary-tint' : 'bg-transparent'
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className={`block font-mono text-[9.5px] font-bold uppercase tracking-[.12em] ${i === sel ? 'text-primary' : 'text-ink-muted'}`}>
                    {r.sectionLabel}
                  </span>
                  <span className="block text-[13px] font-semibold text-ink mt-0.5">{r.label}</span>
                </span>
                <span className="font-mono text-[11px] text-ink-muted shrink-0">{valuePreview(r)}</span>
              </button>
            ))}
            {results.length > 0 && (
              <div className="flex gap-3.5 px-3 pt-2 pb-1.5 border-t border-border mt-1">
                {['↑↓ MOVE', '↵ JUMP TO SETTING', 'ESC CLOSE'].map((s) => (
                  <span key={s} className="font-mono text-[10px] text-ink-muted">{s}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
