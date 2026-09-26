/**
 * LedgerExportMenu — L2 item 4 (docs/briefs/ledger-lens-build.md § L2).
 * CSV / PDF export of the FILTERED row set. LX: lives in the page header —
 * an icon button in the D1 mobile header, the "Export n" button in D3's. Libraries are lazy-loaded
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
        aria-label={`Export ${n} polic${n === 1 ? 'y' : 'ies'}`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center gap-2 rounded-full text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:w-auto lg:rounded-xl lg:bg-primary lg:px-4 lg:text-sm lg:font-bold lg:text-white lg:hover:bg-primary/90 lg:dark:bg-primary-dark lg:dark:hover:bg-primary-dark/90"
        data-testid="ledger-export-trigger"
      >
        <Download size={18} aria-hidden="true" />
        <span className="hidden lg:inline" aria-hidden="true">Export {n}</span>
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
