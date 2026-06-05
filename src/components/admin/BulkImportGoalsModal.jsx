import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, AlertTriangle, Loader2, FileText, Download, CheckCircle2, XCircle,
  AlertCircle, Upload, Info,
} from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import {
  parseCSV, prepareImport, runImport,
  buildErrorCSV, buildTemplateCSV, downloadCSV, generateBatchId,
  usingDefaultMinimums, LIMITS,
} from '../../services/goalsImportService';

/**
 * BulkImportGoalsModal — Track C C3.
 *
 * Multi-step wizard: file picker → preview → progress → summary.
 * Mirrors BulkImportUsersModal.jsx (copy-from-precedent — third-consumer
 * threshold for extracting CsvImportModalShell not yet met; deferred
 * follow-up filed in docs/FOLLOW_UPS.md).
 *
 * Tenant_admin and platform_admin only — gated upstream in
 * UserManagementPanel.
 *
 * Step 1 — file picker, "Download template" CTA, defaults-warn banner
 *          (Q3 — companyMinimums not explicitly set), zero-eligible-
 *          agents empty state (Q5 — every active agent already has 2026
 *          commitment).
 * Step 2 — full preview table with status pills, filter toggles, agent-
 *          name resolved from email lookup. "Confirm import" CTA
 *          disabled when no valid rows.
 * Step 3 — indeterminate spinner with row count. Escape mid-flight
 *          opens a confirmation dialog explaining that goals already
 *          written will not be reverted.
 * Step 4 — summary (set / skipped / failed counts + per-row error
 *          details + "Download error report" CSV CTA).
 */

function StatusPill({ status }) {
  if (status === 'valid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success-ink text-[10px] font-bold uppercase tracking-wide">
        <CheckCircle2 size={10} aria-hidden="true" /> Valid
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning-ink text-[10px] font-bold uppercase tracking-wide">
        <AlertTriangle size={10} aria-hidden="true" /> Skip
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/15 text-danger-ink text-[10px] font-bold uppercase tracking-wide">
      <XCircle size={10} aria-hidden="true" /> Error
    </span>
  );
}

function StepIndicator({ step }) {
  const steps = ['File', 'Preview', 'Importing', 'Done'];
  return (
    <ol className="flex items-center gap-2 mb-4" aria-label="Import progress">
      {steps.map((label, i) => {
        const idx = i + 1;
        const isCurrent = idx === step;
        const isDone = idx < step;
        return (
          <li
            key={label}
            aria-current={isCurrent ? 'step' : undefined}
            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${
              isCurrent ? 'text-primary' : isDone ? 'text-ink-muted' : 'text-ink-muted/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                isCurrent
                  ? 'bg-primary text-white'
                  : isDone
                    ? 'bg-success/20 text-success-ink'
                    : 'bg-border/60 text-ink-muted'
              }`}
              aria-hidden="true"
            >
              {idx}
            </span>
            <span>{label}</span>
            {idx < steps.length && <span className="mx-1 text-border" aria-hidden="true">·</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function BulkImportGoalsModal({ tenantId, onClose, onImported }) {
  const { user, userProfile } = useAuth();

  // — Step state
  const [step, setStep] = useState(1);

  // — Step 1: file selection + parse
  const [file, setFile] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef(null);

  // — Step 2: preview
  const [preview, setPreview] = useState(null);
  const [filter, setFilter] = useState('all');

  // — Step 3: in-flight import
  const [importing, setImporting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const abandonedRef = useRef(false);

  // — Step 4: summary
  const [importResults, setImportResults] = useState(null);
  const [serverError, setServerError] = useState(null);

  function handleEscape() {
    if (step === 3 && importing) {
      setShowCancelConfirm(true);
      return;
    }
    onClose();
  }

  const modalRef = useFocusTrap({
    onEscape: handleEscape,
    escapeDisabled: showCancelConfirm,
  });

  // — Step 1 handlers
  function handleFileSelect(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.csv') && picked.type !== 'text/csv') {
      setParseError('Selected file is not a CSV. Pick a .csv file.');
      setFile(null);
      return;
    }
    setFile(picked);
    setParseError(null);
  }

  async function handleContinueToPreview() {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    try {
      const { rows, parseErrors } = await parseCSV(file);
      if (parseErrors.length > 0) {
        const first = parseErrors[0];
        setParseError(`CSV parse error: ${first.message ?? 'Unknown'} (row ${first.row ?? '?'})`);
        return;
      }
      if (rows.length === 0) {
        setParseError('CSV is empty (header-only or all rows blank).');
        return;
      }
      if (rows.length > LIMITS.MAX_BULK_ROWS) {
        setParseError(`CSV has ${rows.length} rows; the maximum is ${LIMITS.MAX_BULK_ROWS}.`);
        return;
      }
      const built = await prepareImport(rows, tenantId);
      setPreview(built);
      setFilter('all');
      setStep(2);
    } catch (err) {
      console.error('[BulkImportGoalsModal] continueToPreview:', err);
      setParseError(err?.message ?? 'Failed to parse CSV.');
    } finally {
      setParsing(false);
    }
  }

  function handleDownloadTemplate() {
    const csv = buildTemplateCSV();
    downloadCSV('agencytrack-2026-commitments-template.csv', csv);
  }

  // — Step 1 pre-flight: load eligibility + minimums signal even before
  // file is picked, so the empty-state and warn banner render up front.
  const [preflight, setPreflight] = useState(null);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [preflightError, setPreflightError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPreflightLoading(true);
    // We invoke prepareImport with an empty header-only synthetic row
    // set to pull the eligibility counts and minimums in one round-trip.
    // But that would throw "No rows" — instead, do the same reads it
    // does: getAllUsers + per-agent goal docs + companyMinimums.
    (async () => {
      try {
        // Reuse the prepareImport machinery by constructing a sentinel
        // single empty row; it'll validate as 'error' but we discard the
        // validatedRows and only consume summary.activeAgentCount /
        // eligibleAgentCount + minimums.
        const built = await prepareImport([{ agentemail: '', annualapitarget: '', annualappstarget: '' }], tenantId);
        if (cancelled) return;
        setPreflight({
          activeAgentCount: built.summary.activeAgentCount,
          eligibleAgentCount: built.summary.eligibleAgentCount,
          minimums: built.minimums,
        });
      } catch (err) {
        if (cancelled) return;
        console.error('[BulkImportGoalsModal] preflight failed:', err);
        setPreflightError(err?.message ?? "Couldn't load tenant goal data.");
      } finally {
        if (!cancelled) setPreflightLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // — Step 2 → Step 3
  async function handleConfirmImport() {
    if (!preview) return;
    const validCount = preview.summary.valid;
    if (validCount === 0) return;

    const batchId = generateBatchId();
    setStep(3);
    setImporting(true);
    setServerError(null);
    abandonedRef.current = false;

    const setBy = user?.uid;
    const setByName = userProfile?.name ?? userProfile?.email ?? '(unknown)';

    try {
      const callableResult = await runImport(preview, batchId, setBy, setByName, tenantId);
      if (abandonedRef.current) return;
      setImportResults(callableResult);
      setStep(4);
    } catch (err) {
      console.error('[BulkImportGoalsModal] runImport:', err);
      if (abandonedRef.current) return;
      const code = err?.code ?? '';
      if (code === 'permission-denied') {
        setServerError("You don't have permission to bulk import goals.");
      } else if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled' || code === 'internal') {
        setServerError("Couldn't reach the server. Some rows may have been imported — refresh and check Career Portal.");
      } else {
        setServerError(err?.message ?? 'Bulk import failed.');
      }
      setImporting(false);
    } finally {
      setImporting(false);
    }
  }

  // — Step 4 handlers
  function handleDownloadErrorReport() {
    if (!preview || !importResults) return;
    const csv = buildErrorCSV(preview.validatedRows, importResults.results ?? []);
    if (!csv) return;
    downloadCSV(`agencytrack-goals-import-errors-${importResults.batchId ?? 'unknown'}.csv`, csv);
  }

  function handleClose() {
    if (step === 4) onImported?.();
    onClose();
  }

  function confirmCancelMidFlight() {
    abandonedRef.current = true;
    setShowCancelConfirm(false);
    onImported?.();
    onClose();
  }

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (filter === 'all') return preview.validatedRows;
    return preview.validatedRows.filter((r) => r.status === filter);
  }, [preview, filter]);

  const showDefaultsBanner = preflight && usingDefaultMinimums(preflight.minimums);
  const zeroEligible =
    preflight &&
    preflight.activeAgentCount > 0 &&
    preflight.eligibleAgentCount === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6 overflow-y-auto motion-reduce:backdrop-blur-none"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-goals-heading"
        className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-3xl border border-border my-auto motion-reduce:transition-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div className="flex-1 min-w-0">
            <h2 id="bulk-import-goals-heading" className="text-lg font-bold text-ink">
              Bulk import 2026 personal commitments
            </h2>
            <p className="text-sm text-ink-muted mt-1">
              Upload a CSV to set per-agent annual API + apps targets at once.
            </p>
          </div>
          <button
            type="button"
            onClick={handleEscape}
            disabled={importing}
            aria-label="Close"
            className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6">
          <StepIndicator step={step} />

          {/* — Step 1: file picker (or empty state / banners) */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              {preflightLoading && (
                <div className="flex items-center gap-2 text-sm text-ink-muted py-6">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Loading tenant goal data…
                </div>
              )}

              {!preflightLoading && preflightError && (
                <div role="alert" aria-live="polite" className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{preflightError}</span>
                </div>
              )}

              {!preflightLoading && !preflightError && zeroEligible && (
                <div className="flex flex-col items-center text-center py-6 gap-3">
                  <div className="p-3 rounded-full bg-warning/15 text-warning-ink">
                    <Info size={28} aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-ink">
                    All active agents already have 2026 personal commitments
                  </h3>
                  <p className="text-sm text-ink-muted max-w-md">
                    Edit individuals via Career Portal. Bulk import is only for agents
                    who don&apos;t have a 2026 commitment yet.
                  </p>
                  <button type="button" onClick={onClose} className="btn-primary mt-2">
                    Close
                  </button>
                </div>
              )}

              {!preflightLoading && !preflightError && !zeroEligible && (
                <>
                  {showDefaultsBanner && (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-ink flex items-start gap-2">
                      <Info size={14} className="shrink-0 mt-0.5 text-warning-ink" aria-hidden="true" />
                      <span>
                        Using default company minimums ({formatCurrency(200000)} API / 42 apps).
                        Set explicit minimums in Company Config if your org&apos;s floors are
                        different. Floors apply regardless.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 p-4 border border-dashed border-border rounded-xl bg-card text-center">
                    <Upload size={28} className="text-ink-muted mx-auto" aria-hidden="true" />
                    <label htmlFor="bulk-goals-csv-input" className="text-sm font-semibold text-ink">
                      Choose CSV file
                    </label>
                    <input
                      ref={fileInputRef}
                      id="bulk-goals-csv-input"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileSelect}
                      className="text-xs text-ink-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer cursor-pointer"
                    />
                    {file && (
                      <p className="text-xs text-ink-muted mt-1">
                        Selected: <span className="font-semibold text-ink">{file.name}</span>
                        {' · '}
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-2 text-xs text-ink-muted">
                    <FileText size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>
                      Required columns: <code className="px-1 rounded bg-border/40 text-ink">agentEmail, annualApiTarget, annualAppsTarget</code>.
                      Headers are case-insensitive. UTF-8 with optional BOM.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="self-start text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1"
                  >
                    <Download size={13} aria-hidden="true" /> Download template
                  </button>

                  {parseError && (
                    <div role="alert" aria-live="polite" className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink flex items-start gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                    <button type="button" onClick={onClose} className="h-11 px-4 text-sm text-ink-muted hover:text-ink rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToPreview}
                      disabled={!file || parsing}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {parsing
                        ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Validating…</>
                        : 'Continue'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* — Step 2: preview table */}
          {step === 2 && preview && (
            <div className="flex flex-col gap-3">
              {preview.summary.softWarn && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-ink flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-warning-ink" aria-hidden="true" />
                  <span>
                    Importing {preview.summary.total} rows. Maximum per import is {LIMITS.MAX_BULK_ROWS}.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter preview">
                {[
                  { key: 'all',     label: `All (${preview.summary.total})` },
                  { key: 'valid',   label: `Valid (${preview.summary.valid})` },
                  { key: 'warning', label: `Skip (${preview.summary.warnings})` },
                  { key: 'error',   label: `Errors (${preview.summary.errors})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={filter === tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`text-xs font-semibold h-8 px-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      filter === tab.key
                        ? 'bg-primary text-white'
                        : 'bg-border/30 text-ink-muted hover:bg-border/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[2fr_1.5fr_1fr_0.75fr_auto] gap-2 px-3 py-2 bg-card text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                  <span>Email</span>
                  <span>Agent</span>
                  <span>Annual API</span>
                  <span>Apps</span>
                  <span>Status</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {filteredRows.length === 0 ? (
                    <p className="text-sm text-ink-muted italic text-center py-6">
                      No rows match this filter.
                    </p>
                  ) : (
                    filteredRows.map((row) => {
                      const issues = [...row.errors, ...row.warnings];
                      const apiNum = parseFloat(row.raw.annualapitarget);
                      const appsNum = parseFloat(row.raw.annualappstarget);
                      return (
                        <div
                          key={row.rowIndex}
                          aria-invalid={row.status === 'error' ? true : undefined}
                          className={`grid grid-cols-[2fr_1.5fr_1fr_0.75fr_auto] gap-2 px-3 py-2 items-start border-t border-border text-xs ${
                            row.status === 'error'
                              ? 'bg-danger/5'
                              : row.status === 'warning'
                                ? 'bg-warning/5'
                                : ''
                          }`}
                        >
                          <span className="text-ink truncate">
                            {row.raw.agentemail || <span className="italic text-ink-muted">(missing)</span>}
                          </span>
                          <span className="text-ink truncate">
                            {row.resolved.agentName ?? <span className="italic text-ink-muted">—</span>}
                          </span>
                          <span className="text-ink-muted">
                            {Number.isFinite(apiNum) && apiNum > 0 ? formatCurrency(apiNum) : (row.raw.annualapitarget || '—')}
                          </span>
                          <span className="text-ink-muted">
                            {Number.isFinite(appsNum) && appsNum > 0 ? appsNum : (row.raw.annualappstarget || '—')}
                          </span>
                          <div className="flex flex-col items-end gap-1">
                            <StatusPill status={row.status} />
                            {issues.length > 0 && (
                              <span
                                role={row.status === 'error' ? 'alert' : undefined}
                                aria-live={row.status === 'error' ? 'polite' : undefined}
                                className="text-[10px] text-ink-muted text-right max-w-[12rem]"
                              >
                                {issues.join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                <button type="button" onClick={() => setStep(1)} className="h-11 px-4 text-sm text-ink-muted hover:text-ink rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={preview.summary.valid === 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm import ({preview.summary.valid} {preview.summary.valid === 1 ? 'row' : 'rows'})
                </button>
              </div>
            </div>
          )}

          {/* — Step 3: progress */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              {importing && !serverError && (
                <>
                  <Loader2 size={48} className="animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                  <div role="status" aria-live="polite" className="text-sm text-ink">
                    Setting commitments for {preview?.summary.valid ?? 0}{' '}
                    {(preview?.summary.valid ?? 0) === 1 ? 'agent' : 'agents'}…
                  </div>
                  <p className="text-xs text-ink-muted max-w-md">
                    Don&apos;t close this window — closing won&apos;t roll back commitments already written.
                  </p>
                </>
              )}
              {serverError && (
                <>
                  <div role="alert" aria-live="polite" className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink flex items-start gap-2 text-left max-w-lg w-full">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{serverError}</span>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { setStep(2); setServerError(null); }} className="h-11 px-4 text-sm text-ink-muted hover:text-ink rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                      Back to preview
                    </button>
                    <button type="button" onClick={onClose} className="btn-primary">
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* — Step 4: summary */}
          {step === 4 && importResults && (
            <div className="flex flex-col gap-4">
              <SummaryStats results={importResults.results ?? []} preview={preview} />

              {(importResults.results ?? []).some((r) => !r.success) && (
                <FailureList results={importResults.results ?? []} />
              )}

              <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={handleDownloadErrorReport}
                  disabled={!buildErrorCSV(preview?.validatedRows ?? [], importResults.results ?? [])}
                  className="text-sm font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed h-11 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
                >
                  <Download size={14} aria-hidden="true" /> Download error report
                </button>
                <button type="button" onClick={handleClose} className="btn-primary">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {showCancelConfirm && (
          <CancelConfirmDialog
            onCancel={() => setShowCancelConfirm(false)}
            onConfirm={confirmCancelMidFlight}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/* Step 4 sub-components                                                    */
/* ─────────────────────────────────────────────────────────────────────── */

function SummaryStats({ results, preview }) {
  const success = results.filter((r) => r.success).length;
  const failure = results.filter((r) => !r.success).length;
  const skipped = preview?.summary?.warnings ?? 0;

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Set</p>
        <p className="text-2xl font-bold text-success-ink">{success}</p>
      </div>
      <div className="card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Skipped</p>
        <p className="text-2xl font-bold text-warning-ink">{skipped}</p>
        <p className="text-[10px] text-ink-muted">existing commitments</p>
      </div>
      <div className="card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Failed</p>
        <p className="text-2xl font-bold text-danger-ink">{failure}</p>
      </div>
    </div>
  );
}

function FailureList({ results }) {
  const failures = results.filter((r) => !r.success);
  if (failures.length === 0) return null;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-card border-b border-border">
        <p className="text-xs font-bold uppercase tracking-wide text-ink">
          Failed rows ({failures.length})
        </p>
      </div>
      <ul className="divide-y divide-border max-h-48 overflow-y-auto">
        {failures.map((f) => (
          <li key={`${f.rowIndex}-${f.agentEmail}`} className="px-3 py-2 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="text-danger-ink shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink truncate">
                Row {(f.rowIndex ?? 0) + 1}: {f.agentEmail || '(no email)'}
              </p>
              <p className="text-ink-muted">{f.error ?? 'Unknown error.'}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CancelConfirmDialog({ onCancel, onConfirm }) {
  const ref = useFocusTrap({ onEscape: onCancel });
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 motion-reduce:backdrop-blur-none">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-confirm-goals-heading"
        className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm p-6 border border-border"
      >
        <h3 id="cancel-confirm-goals-heading" className="text-base font-bold text-ink mb-2">
          Stop watching the import?
        </h3>
        <p className="text-sm text-ink-muted mb-5">
          The import is already underway. Commitments written so far will not be reverted. You can refresh Career Portal afterwards to see the final result.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-11 px-4 text-sm text-ink-muted hover:text-ink rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            Keep watching
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary">
            Close anyway
          </button>
        </div>
      </div>
    </div>
  );
}
