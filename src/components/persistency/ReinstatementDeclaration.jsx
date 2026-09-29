import React, { useEffect, useId, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  REINSTATEMENT_NOTE_MAX,
  REINSTATEMENT_UNCONFIRMED_DAYS,
  declarationDateLabel,
} from '../../lib/persistency/reinstatementDeclaration';

/**
 * FR-6 "Mark reinstated" (Option A) — the declare / withdraw control, shared by
 * the Policy ledger drawer and the FR-3 reinstatement planner rows.
 *
 * A declaration says "the client has paid; head office still shows it lapsed".
 * It is shown BESIDE the evidenced figure, never inside it, and never feeds
 * money. PURE: props only; the caller does the write
 * (policiesService.declareReinstatement / withdrawReinstatement).
 *
 * @param {{
 *   declaration: null | { on: string|null, note: string|null, unconfirmed: boolean },
 *   onDeclare: (note: string) => void,
 *   onWithdraw: () => void,
 *   busy?: boolean,
 *   error?: string|null,
 *   testIdPrefix?: string,
 * }} props
 */
export default function ReinstatementDeclarationControl({
  declaration, onDeclare, onWithdraw, busy = false, error = null, testIdPrefix = 'reinstatement',
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const noteId = useId();
  const helpId = useId();
  const declared = Boolean(declaration);

  // A landed declaration closes the form, so a later withdraw shows the button
  // again, not a stale open form.
  useEffect(() => {
    if (declared) { setOpen(false); setNote(''); }
  }, [declared]);

  if (declaration) {
    return (
      <div className="flex min-w-0 flex-col gap-2" data-testid={`${testIdPrefix}-declared`}>
        <p className="text-[13px] font-semibold text-ink">
          Reinstated — waiting for head office (declared {declarationDateLabel(declaration.on)})
        </p>
        {declaration.note ? (
          <p className="min-w-0 break-words text-[12px] text-ink-muted">Note: {declaration.note}</p>
        ) : null}
        {declaration.unconfirmed ? (
          <p className="flex items-start gap-1.5 text-[12px] font-semibold text-warning-ink" data-testid={`${testIdPrefix}-unconfirmed`}>
            <AlertTriangle size={14} aria-hidden="true" className="mt-px shrink-0" />
            Not confirmed by head office after {REINSTATEMENT_UNCONFIRMED_DAYS} days
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onWithdraw}
            disabled={busy}
            className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            data-testid={`${testIdPrefix}-withdraw`}
          >
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            Withdraw
          </button>
        </div>
        {error ? <p role="alert" className="text-[12px] font-semibold text-danger-ink">{error}</p> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            data-testid={`${testIdPrefix}-mark`}
          >
            Mark reinstated
          </button>
        </div>
        {error ? <p role="alert" className="text-[12px] font-semibold text-danger-ink">{error}</p> : null}
      </div>
    );
  }

  function submit(e) {
    e.preventDefault();
    onDeclare(note.trim());
  }

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-2" data-testid={`${testIdPrefix}-form`}>
      <p id={helpId} className="text-[12px] text-ink-muted">
        Head office still shows this policy lapsed. Your declaration shows beside your persistency, never inside it, until the next export confirms it.
      </p>
      <label htmlFor={noteId} className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Receipt or reference (optional)
      </label>
      <input
        id={noteId}
        type="text"
        value={note}
        maxLength={REINSTATEMENT_NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        aria-describedby={helpId}
        className="h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        data-testid={`${testIdPrefix}-note`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 dark:bg-primary-dark dark:hover:bg-primary-dark/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          data-testid={`${testIdPrefix}-confirm`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          Confirm — mark reinstated
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setNote(''); }}
          disabled={busy}
          className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          data-testid={`${testIdPrefix}-cancel`}
        >
          Cancel
        </button>
      </div>
      {error ? <p role="alert" className="text-[12px] font-semibold text-danger-ink">{error}</p> : null}
    </form>
  );
}

/** Ledger-row chip for a policy with a live declaration (recon § 3: "Declared reinstated"). */
export function DeclaredReinstatedChip({ className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-primary-tint px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-primary ${className}`}
      title="Declared reinstated — waiting for head office"
      data-testid="declared-reinstated-chip"
    >
      Declared reinstated
    </span>
  );
}
