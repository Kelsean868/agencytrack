import React, { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { undoLastPortfolioImport, describeImportError } from '../../../../services/portfolioImportService';
import { COPY } from './importCopy';

function ResultTile({ value, label, testId }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 bg-surface-muted border border-border rounded-lg" data-testid={testId}>
      <span className="font-display font-extrabold text-lg text-ink">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted text-center">{label}</span>
    </div>
  );
}

/**
 * ImportResultStep — created/updated/unchanged from `applyPortfolioImport`,
 * plus an "Undo this import" flow scoped to that run only:
 *
 *   idle → checking (dry run) → confirm (states the COUNT) → deleting → done
 *                              \→ refused (plain-words refusal, no delete call)
 *
 * The dry run is always called first and its result is never blended with a
 * guess — the confirm panel states exactly the count the dry run reported,
 * and the delete call echoes back exactly what the dry run returned
 * (`runId` when `via === 'runRecord'`, `exportDate` otherwise), matching the
 * undoLastPortfolioImport contract (undoImport.js).
 */
export default function ImportResultStep({ result, onClose, onChanged }) {
  const [undoStep, setUndoStep] = useState('idle'); // idle | checking | confirm | deleting | done | refused | error
  const [undoDryRun, setUndoDryRun] = useState(null);
  const [undoFinal, setUndoFinal] = useState(null);
  const [undoError, setUndoError] = useState(null);

  async function startUndo() {
    setUndoStep('checking');
    setUndoError(null);
    try {
      const dry = await undoLastPortfolioImport({});

      // THE BUTTON SAYS "THIS IMPORT", SO IT MUST BE THIS IMPORT.
      //
      // `undoLastPortfolioImport` does not take a run to undo — it always acts
      // on the agent's most recent un-undone run (undoImport.js → findLatestRun),
      // and the `runId` in the payload is only a confirmation token, compared
      // against the run the server already chose. So echoing back whatever the
      // dry run returned ALWAYS matches, and the delete always lands on the
      // newest run whether or not that is the one on this screen.
      //
      // That diverges the moment a second import happens while this result is
      // still open — another tab, another device, or simply an agent who came
      // back later. The confirm panel would state the other import's count, and
      // the delete would remove the other import, with nothing erroring.
      //
      // So the two ids are compared and a mismatch REFUSES. Undo can only ever
      // reach the newest import, which is a real limit of the endpoint, not
      // something this screen can work around — and saying so is better than
      // quietly undoing something else.
      if (dry.runId !== result.runId) {
        setUndoError({
          title: COPY.undoNotThisRunTitle,
          detail: COPY.undoNotThisRunDetail,
          canRetry: false,
        });
        setUndoStep('refused');
        return;
      }

      setUndoDryRun(dry);
      setUndoStep('confirm');
    } catch (err) {
      // A refusal (nothing to undo, or an update-only import that cannot be
      // undone) arrives here as a thrown error whose message is already
      // written in plain words by undoImport.js — never a code.
      setUndoError(describeImportError(err));
      setUndoStep('refused');
    }
  }

  async function confirmUndo() {
    if (!undoDryRun) return;
    setUndoStep('deleting');
    setUndoError(null);
    try {
      const payload = { confirm: true };
      if (undoDryRun.via === 'runRecord') payload.runId = undoDryRun.runId;
      else payload.exportDate = undoDryRun.exportDate;
      const final = await undoLastPortfolioImport(payload);
      setUndoFinal(final);
      setUndoStep('done');
      onChanged?.();
    } catch (err) {
      setUndoError(describeImportError(err));
      setUndoStep('error');
    }
  }

  function resetUndo() {
    setUndoStep('idle');
    setUndoDryRun(null);
    setUndoFinal(null);
    setUndoError(null);
  }

  return (
    <div className="p-5 flex flex-col gap-4" data-testid="import-step-result">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-success-ink" aria-hidden="true" />
        <p className="font-display font-extrabold text-[15px] text-ink">{COPY.importCompleteTitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5" data-testid="import-result-counts">
        <ResultTile value={result.created ?? 0} label={COPY.createdLabel} testId="import-result-created" />
        <ResultTile value={result.updated ?? 0} label={COPY.updatedLabel} testId="import-result-updated" />
        <ResultTile value={result.unchanged ?? 0} label={COPY.unchangedLabel} testId="import-result-unchanged" />
      </div>

      <p className="text-xs text-ink-muted" data-testid="import-result-export-date">
        {COPY.exportDateLabel}: {result.exportDate}
      </p>

      {(result.refused ?? 0) > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-danger-tint text-danger-ink text-xs" data-testid="import-result-refused">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <p>{COPY.refusedNotice(result.refused)} {result.refusedPolicyNumbers?.join(', ')}</p>
        </div>
      )}

      <div className="border-t border-border pt-4 flex flex-col gap-3">
        {undoStep === 'idle' && (
          <button
            type="button"
            onClick={startUndo}
            className="self-start h-11 px-4 rounded-lg border border-danger/40 text-danger-ink text-sm font-semibold hover:bg-danger/10 transition-colors"
            data-testid="undo-import-button"
          >
            {COPY.undoButton}
          </button>
        )}

        {undoStep === 'checking' && (
          <div className="flex items-center gap-2 text-sm text-ink-muted" data-testid="undo-checking">
            <Loader2 size={16} className="animate-spin" /> {COPY.undoChecking}
          </div>
        )}

        {undoStep === 'confirm' && undoDryRun && (
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-danger-tint" data-testid="undo-confirm-panel">
            <p className="text-sm font-semibold text-ink" data-testid="undo-confirm-count">
              {COPY.undoConfirmCount(undoDryRun.found)}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetUndo}
                className="flex-1 h-11 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-surface/70 transition-colors"
                data-testid="undo-cancel-button"
              >
                {COPY.undoCancelButton}
              </button>
              <button
                type="button"
                onClick={confirmUndo}
                className="flex-1 h-11 rounded-lg border border-danger/40 text-danger-ink text-sm font-semibold hover:bg-danger/10 transition-colors"
                data-testid="undo-confirm-button"
              >
                {COPY.undoConfirmButton}
              </button>
            </div>
          </div>
        )}

        {undoStep === 'deleting' && (
          <div className="flex items-center gap-2 text-sm text-ink-muted" data-testid="undo-deleting">
            <Loader2 size={16} className="animate-spin" /> {COPY.undoDeleting}
          </div>
        )}

        {undoStep === 'done' && undoFinal && (
          <p className="text-sm text-ink" data-testid="undo-result-success">
            {COPY.undoSuccess(undoFinal.deleted)}
          </p>
        )}

        {(undoStep === 'refused' || undoStep === 'error') && undoError && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-tint text-danger-ink text-sm" data-testid="undo-result-error">
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">{undoError.title}</p>
              <p>{undoError.detail}</p>
            </div>
          </div>
        )}

        {(undoStep === 'refused' || undoStep === 'error') && (
          <button
            type="button"
            onClick={resetUndo}
            className="self-start text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
            data-testid="undo-try-again"
          >
            {COPY.undoTryAgain}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="h-11 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
        data-testid="import-close-button"
      >
        {COPY.done}
      </button>
    </div>
  );
}
