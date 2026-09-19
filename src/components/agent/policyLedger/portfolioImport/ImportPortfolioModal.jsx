import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import useFocusTrap from '../../../../hooks/useFocusTrap';
import {
  fileToBase64,
  previewPortfolioImport,
  applyPortfolioImport,
  describeImportError,
  MAX_CLIENT_FILE_BYTES,
} from '../../../../services/portfolioImportService';
import ImportPickStep from './ImportPickStep';
import ImportReviewStep from './ImportReviewStep';
import ImportResultStep from './ImportResultStep';
import { COPY } from './importCopy';

/**
 * ImportPortfolioModal — the shell + step machine for the OIPA portfolio
 * import screen (P4c). Accessibility shape copied from PolicyDrillDrawer:
 * useFocusTrap + role="dialog" + aria-modal + a backdrop.
 *
 * Steps: pick → review → importing → result. Apply is only ever invoked from
 * `handleImport`, itself only ever called by the Import button on the review
 * step — nothing is written to the ledger before that click.
 *
 * Expiry (ruling 4): a `deadline-exceeded` on apply means the parked plan is
 * gone. Rather than dead-ending, the modal shows the expiry message and lets
 * the agent start a fresh review.
 */
export default function ImportPortfolioModal({ onClose, onImported }) {
  const [step, setStep] = useState('pick'); // 'pick' | 'review' | 'importing' | 'result'
  const [file, setFile] = useState(null);
  const [pickError, setPickError] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [expired, setExpired] = useState(false);
  const [result, setResult] = useState(null);

  function handleClose() {
    if (applying) return; // a write is in flight — do not let Escape abandon it
    onClose();
  }

  const modalRef = useFocusTrap({ onEscape: handleClose, escapeDisabled: applying });

  function handleFileChange(selected) {
    setPickError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    // COURTESY check only — not the security boundary. previewImport.js
    // re-validates the extension, the 5 MB limit, and everything else
    // server-side and refuses what it doesn't like.
    if (!/\.xlsx$/i.test(selected.name)) {
      setFile(null);
      setPickError({ title: "That file can't be used", detail: 'Choose an .xlsx file exported from OIPA.', canRetry: true });
      return;
    }
    if (selected.size > MAX_CLIENT_FILE_BYTES) {
      setFile(null);
      setPickError({ title: 'File too large', detail: 'That file is over the 5 MB limit.', canRetry: true });
      return;
    }
    setFile(selected);
  }

  async function handlePreview() {
    if (!file) return;
    setPreviewLoading(true);
    setPickError(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const data = await previewPortfolioImport({ fileBase64, fileName: file.name });
      setPreviewData(data);
      setStep('review');
    } catch (err) {
      setPickError(describeImportError(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleImport() {
    if (!previewData) return;
    setApplying(true);
    setApplyError(null);
    setStep('importing');
    try {
      const data = await applyPortfolioImport({ planId: previewData.planId });
      setResult(data);
      setStep('result');
      onImported?.();
    } catch (err) {
      const rawCode = typeof err?.code === 'string' ? err.code : '';
      const isExpired = rawCode === 'deadline-exceeded' || rawCode === 'functions/deadline-exceeded';
      if (isExpired) {
        setExpired(true);
        setFile(null);
        setPreviewData(null);
        setStep('pick');
      } else {
        setApplyError(describeImportError(err));
        setStep('review');
      }
    } finally {
      setApplying(false);
    }
  }

  function handleStartAgain() {
    setExpired(false);
    setFile(null);
    setPreviewData(null);
    setPickError(null);
    setApplyError(null);
    setStep('pick');
  }

  function handleResultClose() {
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40" data-testid="import-portfolio-backdrop">
      <div
        ref={modalRef}
        className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90vh] overflow-y-auto shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label={COPY.modalTitle}
        data-testid="import-portfolio-modal"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <p className="font-display font-extrabold text-[15px] text-ink">{COPY.modalTitle}</p>
          <button
            type="button"
            onClick={handleClose}
            disabled={applying}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-surface transition-colors disabled:opacity-50"
            aria-label="Close"
            data-testid="import-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        {expired ? (
          <div className="p-5 flex flex-col gap-4" data-testid="import-expired">
            <p className="text-sm text-ink">{COPY.expiredMessage}</p>
            <button
              type="button"
              onClick={handleStartAgain}
              className="self-start h-11 px-5 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
              data-testid="import-start-again"
            >
              {COPY.startAgain}
            </button>
          </div>
        ) : (
          <>
            {step === 'pick' && (
              <ImportPickStep
                fileName={file?.name ?? null}
                error={pickError}
                loading={previewLoading}
                onFileChange={handleFileChange}
                onContinue={handlePreview}
              />
            )}

            {step === 'review' && previewData && (
              <ImportReviewStep
                previewData={previewData}
                fileName={file?.name}
                error={applyError}
                onCancel={onClose}
                onImport={handleImport}
              />
            )}

            {step === 'importing' && (
              <div className="p-8 flex flex-col items-center gap-3" data-testid="import-step-importing">
                <Loader2 size={24} className="animate-spin text-primary" />
                <p className="text-sm text-ink-muted">{COPY.importingMessage}</p>
              </div>
            )}

            {step === 'result' && result && (
              <ImportResultStep result={result} onClose={handleResultClose} onChanged={onImported} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
