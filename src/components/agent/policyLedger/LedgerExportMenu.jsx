/**
 * LedgerExportMenu — L2 item 4 (docs/briefs/ledger-lens-build.md § L2).
 * Excel / CSV / PDF export of the FILTERED row set. Libraries are lazy-loaded
 * inside `ledgerExportService` on click, never in the main bundle.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportLedgerCsv, exportLedgerPdf } from '../../../services/ledgerExportService';

// NO Excel (.xlsx) option here — see ledgerExportService.js header: `xlsx`
// cannot enter the client bundle (Ruling 1's guard test), banked as a
// FOLLOW_UPS for the dispatcher. CSV covers "open in any spreadsheet".
const OPTIONS = [
  { key: 'csv', title: 'CSV', desc: () => 'For any spreadsheet — all columns' },
  { key: 'pdf', title: 'PDF — head-office check sheet', desc: () => 'One page to compare with HO records' },
];

export default function LedgerExportMenu({ rows, label }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function run(key) {
    setBusy(key);
    try {
      if (key === 'csv') exportLedgerCsv(rows, label);
      else if (key === 'pdf') await exportLedgerPdf(rows, label);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  }

  const n = rows.length;

  return (
    <div className="relative" ref={ref} data-testid="ledger-export-menu">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-xl bg-primary dark:bg-primary-dark px-4 text-sm font-bold text-white hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
        data-testid="ledger-export-trigger"
      >
        <Download size={16} aria-hidden="true" /> Export {n}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[52px] z-20 flex w-[300px] flex-col gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-lg"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              role="menuitem"
              type="button"
              onClick={() => run(o.key)}
              disabled={busy != null}
              className="flex min-h-[52px] flex-col justify-center rounded-xl px-3 py-2 text-left hover:bg-surface disabled:opacity-60"
              data-testid={`ledger-export-${o.key}`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                {busy === o.key && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {o.title}
              </span>
              <span className="text-xs text-ink-muted">{o.desc(n)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
