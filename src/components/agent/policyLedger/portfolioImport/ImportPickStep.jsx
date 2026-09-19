import React from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { COPY } from './importCopy';

/**
 * ImportPickStep — file picker. Client-side extension/size checks here are a
 * COURTESY, not the security boundary: `previewPortfolioImport` re-validates
 * both server-side (previewImport.js) and refuses anything it doesn't like.
 */
export default function ImportPickStep({ fileName, error, loading, onFileChange, onContinue }) {
  function handleInputChange(e) {
    const selected = e.target.files?.[0] ?? null;
    onFileChange(selected);
    // Clear the input value so re-selecting the same filename after a
    // validation failure still fires onChange.
    e.target.value = '';
  }

  return (
    <div className="p-5 flex flex-col gap-4" data-testid="import-step-pick">
      <p className="text-sm text-ink-muted">{COPY.pickIntro}</p>

      <label
        htmlFor="portfolio-import-file"
        className="flex flex-col items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed border-border bg-surface cursor-pointer hover:bg-surface-muted transition-colors"
      >
        <Upload size={20} className="text-ink-muted" aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">{fileName ?? COPY.chooseFile}</span>
        <span className="text-xs text-ink-muted">{COPY.fileHint}</span>
      </label>
      <input
        id="portfolio-import-file"
        type="file"
        accept=".xlsx"
        className="sr-only"
        onChange={handleInputChange}
        data-testid="import-file-input"
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-tint text-danger-ink text-sm" data-testid="import-pick-error">
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">{error.title}</p>
            <p>{error.detail}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={!fileName || loading}
          className="h-11 px-5 min-w-[44px] rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          data-testid="import-preview-button"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {COPY.checkingFile}
            </>
          ) : (
            COPY.continueLabel
          )}
        </button>
      </div>
    </div>
  );
}
