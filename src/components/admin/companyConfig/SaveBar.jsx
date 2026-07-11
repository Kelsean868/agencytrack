import React from 'react';

/**
 * Floating draft save-bar (design handoff README §Draft → Save lifecycle).
 * Bottom-center, absolutely positioned within the (relatively-positioned)
 * content surface the caller renders this inside.
 *
 * Token note: the prototype's inverse pill (`--ink` bg / `--bg` text) maps
 * directly onto this app's EXISTING `bg-ink` / `text-surface` Tailwind
 * utilities — `ink.DEFAULT` resolves to `--text-channels` (page ink) and
 * `surface.DEFAULT` resolves to `--bg-channels` (page background), so
 * `bg-ink text-surface` reproduces the prototype's dark-pill-on-any-theme
 * look with real token-backed utility classes (no arbitrary `var()` needed).
 *
 * Renders nothing when `count` is 0 or falsy — no draft, no bar.
 *
 * @param {object} props
 * @param {number} props.count number of unsaved draft changes
 * @param {Function} props.onSave
 * @param {Function} props.onDiscard
 */
export default function SaveBar({ count, onSave, onDiscard }) {
  if (!count) return null;

  return (
    <div
      data-testid="ccfg-savebar"
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-3 rounded-[14px] bg-ink text-surface shadow-lg"
    >
      <span className="text-[13px] font-semibold whitespace-nowrap">
        {count} unsaved change{count === 1 ? '' : 's'}
      </span>
      <button
        type="button"
        onClick={onDiscard}
        data-testid="ccfg-savebar-discard"
        className="text-[12.5px] font-bold underline opacity-80 hover:opacity-100 focus-visible:outline-none"
      >
        Discard
      </button>
      <button
        type="button"
        onClick={onSave}
        data-testid="ccfg-savebar-save"
        className="min-h-[40px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-[13px] font-bold hover:bg-primary-dark dark:hover:bg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        Save changes
      </button>
    </div>
  );
}
