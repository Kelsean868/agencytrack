import React from 'react';
import { Info, AlertCircle } from 'lucide-react';
import { COPY } from './importCopy';

function StatTile({ value, label, testId }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 bg-surface-muted border border-border rounded-lg" data-testid={testId}>
      <span className="font-display font-extrabold text-lg text-ink">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted text-center">{label}</span>
    </div>
  );
}

/**
 * ImportReviewStep — plain-words review of the plan `previewPortfolioImport`
 * returned. Never shows internal field names to the agent. Import is NOT
 * called from here — the parent only calls it when `onImport` fires from the
 * button below, so nothing is written while this step is on screen.
 */
export default function ImportReviewStep({ previewData, fileName, error, onCancel, onImport }) {
  const {
    counts = {},
    planClassPending = [],
    overridesApplied = [],
    importConfigApplied,
    exportDate,
    sheetName,
  } = previewData;

  const noPersonalConfig =
    !!importConfigApplied &&
    (importConfigApplied.overrides?.length ?? 0) === 0 &&
    (importConfigApplied.selfOrFamily?.length ?? 0) === 0 &&
    (importConfigApplied.testPolicyNumbers?.length ?? 0) === 0;

  return (
    <div className="p-5 flex flex-col gap-4" data-testid="import-step-review">
      <div className="text-xs text-ink-muted flex flex-col gap-0.5" data-testid="import-review-meta">
        <p><span className="font-semibold text-ink">{COPY.exportDateLabel}:</span> {exportDate}</p>
        <p><span className="font-semibold text-ink">{COPY.sheetLabel}:</span> {sheetName}</p>
        {fileName && (
          <p className="truncate"><span className="font-semibold text-ink">{COPY.fileLabel}:</span> {fileName}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5" data-testid="import-review-counts">
        <StatTile value={counts.creates ?? 0} label={COPY.newLabel} testId="import-count-new" />
        <StatTile value={counts.updates ?? 0} label={COPY.updatedLabel} testId="import-count-updated" />
        <StatTile value={counts.unchanged ?? 0} label={COPY.unchangedLabel} testId="import-count-unchanged" />
      </div>

      {(counts.skippedNotYours ?? 0) > 0 && (
        <div className="text-xs text-ink-muted" data-testid="import-count-skipped-not-yours">
          <span className="font-semibold text-ink">{counts.skippedNotYours} {COPY.notYoursSuffix}</span>
          {' — '}{COPY.notYoursExplain}
        </div>
      )}

      {(counts.testRecords ?? 0) > 0 && (
        <div className="text-xs text-ink-muted" data-testid="import-count-test-records">
          <span className="font-semibold text-ink">{counts.testRecords} {COPY.testRecordsSuffix}</span>
        </div>
      )}

      {planClassPending.length > 0 && (
        <div className="p-3 rounded-xl bg-gold-tint border border-gold/30 text-xs" data-testid="import-plan-class-pending">
          <p className="font-semibold text-ink">{COPY.planClassPendingTitle(planClassPending.length)}</p>
          <p className="text-ink-muted mt-1">{COPY.planClassPendingExplain}</p>
          <p className="mt-1.5 font-mono text-[11px] text-ink-muted break-words">{planClassPending.join(', ')}</p>
        </div>
      )}

      {overridesApplied.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="import-overrides-applied">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{COPY.overridesTitle}</p>
          {overridesApplied.map((o, i) => (
            <div key={o.policyNumber ?? i} className="p-2.5 rounded-lg bg-surface-muted border border-border text-xs">
              <p className="font-semibold text-ink">#{o.policyNumber}</p>
              <p className="text-ink-muted mt-0.5">{o.note}</p>
            </div>
          ))}
        </div>
      )}

      {noPersonalConfig && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-tint text-xs text-ink" data-testid="import-no-config-notice">
          <Info size={14} className="shrink-0 mt-0.5 text-primary" aria-hidden="true" />
          <p>{COPY.noConfigNotice}</p>
        </div>
      )}

      <p className="text-xs font-semibold text-ink" data-testid="import-nothing-written-notice">{COPY.nothingWrittenYet}</p>

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-tint text-danger-ink text-sm" data-testid="import-apply-error">
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">{error.title}</p>
            <p>{error.detail}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-lg border border-border text-sm font-semibold text-ink-muted hover:bg-surface/70 transition-colors"
          data-testid="import-cancel-button"
        >
          {COPY.cancel}
        </button>
        <button
          type="button"
          onClick={onImport}
          className="flex-1 h-11 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
          data-testid="import-confirm-button"
        >
          {COPY.importLabel}
        </button>
      </div>
    </div>
  );
}
