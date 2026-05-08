import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, AlertTriangle, Loader2, FileText, Download, CheckCircle2, XCircle,
  AlertCircle, Upload, Building2,
} from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import {
  parseCSV, prepareImport, runImport, dispatchResetEmails,
  buildErrorCSV, buildTemplateCSV, downloadCSV, generateBatchId, LIMITS,
} from '../../services/userImportService';
import { listBranches } from '../../services/branchService';

/**
 * BulkImportUsersModal — Track C C2.
 *
 * Multi-step wizard: file picker → preview → progress → summary. Lifts
 * BranchEditorModal scaffolding via the new useFocusTrap hook. Tenant_admin
 * and platform_admin only — gated upstream in UserManagementPanel.
 *
 * Step 1 — file picker, "Download template" CTA, zero-active-branches empty
 *          state (Q10 client guard; server has a `failed-precondition`
 *          backstop).
 * Step 2 — full preview table with status pills, filter toggles
 *          (All / Errors / Warnings / Valid), "Confirm import" CTA disabled
 *          when no valid rows.
 * Step 3 — indeterminate spinner with row count (Q4). Escape mid-flight
 *          opens a confirmation dialog explaining that the import is already
 *          underway server-side and partially-imported users will not be
 *          reverted.
 * Step 4 — summary (success / skipped / failed counts + per-row error
 *          details + "Download error report" CSV CTA, Q8). On Close,
 *          parent reloads the user list.
 */

const ROLE_DISPLAY = {
  agent:          'Agent',
  unit_manager:   'Unit Manager',
  branch_manager: 'Branch Manager',
  sales_manager:  'Sales Manager',
};

function StatusPill({ status }) {
  if (status === 'valid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold uppercase tracking-wide">
        <CheckCircle2 size={10} aria-hidden="true" /> Valid
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px] font-bold uppercase tracking-wide">
        <AlertTriangle size={10} aria-hidden="true" /> Skip
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/15 text-danger text-[10px] font-bold uppercase tracking-wide">
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
                    ? 'bg-success/20 text-success'
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

export default function BulkImportUsersModal({ tenantId, currentUid, onClose, onImported }) {
  // — Step state
  const [step, setStep] = useState(1);

  // — Pre-Step-1: branch availability (Q10 guard)
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [activeBranchCount, setActiveBranchCount] = useState(0);
  const [branchLoadError, setBranchLoadError] = useState(null);

  // — Step 1: file selection + parse
  const [file, setFile] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef(null);

  // — Step 2: preview
  const [preview, setPreview] = useState(null); // { validatedRows, summary, activeBranches }
  const [filter, setFilter] = useState('all');  // 'all' | 'valid' | 'warning' | 'error'

  // — Step 3: in-flight import
  const [importing, setImporting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const abandonedRef = useRef(false);

  // — Step 4: summary
  const [importResults, setImportResults] = useState(null); // { results: [...] }
  const [emailDispatch, setEmailDispatch] = useState(null); // [{ email, sent, error? }]
  const [serverError, setServerError] = useState(null);

  // Cancel mid-flight: confirmation opens while step === 3 and importing.
  // Otherwise Escape just closes the modal.
  function handleEscape() {
    if (step === 3 && importing) {
      setShowCancelConfirm(true);
      return;
    }
    onClose();
  }

  const modalRef = useFocusTrap({
    onEscape: handleEscape,
    escapeDisabled: showCancelConfirm, // confirmation sub-dialog owns Escape when open
  });

  // Branch availability check on mount (Q10 client guard).
  useEffect(() => {
    let cancelled = false;
    setBranchesLoading(true);
    listBranches(tenantId)
      .then((all) => {
        if (cancelled) return;
        const active = (all ?? []).filter((b) => b.isActive === true);
        setActiveBranchCount(active.length);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[BulkImportUsersModal] listBranches failed:', err);
        setBranchLoadError("Couldn't load branches. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenantId]);

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
      console.error('[BulkImportUsersModal] continueToPreview:', err);
      setParseError(err?.message ?? 'Failed to parse CSV.');
    } finally {
      setParsing(false);
    }
  }

  function handleDownloadTemplate() {
    const csv = buildTemplateCSV();
    downloadCSV('agencytrack-import-template.csv', csv);
  }

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

    try {
      const callableResult = await runImport(preview, batchId);
      if (abandonedRef.current) return; // user closed modal mid-flight
      setImportResults({ ...callableResult, batchId });
      // Dispatch reset emails per success row.
      const emails = await dispatchResetEmails(callableResult?.results ?? []);
      if (abandonedRef.current) return;
      setEmailDispatch(emails);
      setStep(4);
    } catch (err) {
      console.error('[BulkImportUsersModal] runImport:', err);
      if (abandonedRef.current) return;
      const code = err?.code ?? '';
      if (code === 'failed-precondition' || /No active branches/i.test(err?.message ?? '')) {
        setServerError('No active branches in this tenant. Create at least one branch first.');
      } else if (code === 'permission-denied') {
        setServerError("You don't have permission to bulk import users.");
      } else if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') {
        setServerError("Couldn't reach the server. Some rows may have been imported — refresh the user list to check.");
      } else {
        setServerError(err?.message ?? 'Bulk import failed.');
      }
      setImporting(false);
      // Stay on step 3 so the user can read the error; provide Close to exit.
    } finally {
      setImporting(false);
    }
  }

  // — Step 4 handlers
  function handleDownloadErrorReport() {
    if (!preview || !importResults) return;
    const csv = buildErrorCSV(preview.validatedRows, importResults.results ?? []);
    if (!csv) return;
    downloadCSV(`agencytrack-import-errors-${importResults.batchId ?? 'unknown'}.csv`, csv);
  }

  function handleClose() {
    if (step === 4) onImported?.();
    onClose();
  }

  // Mid-flight cancel confirmation
  function confirmCancelMidFlight() {
    abandonedRef.current = true;
    setShowCancelConfirm(false);
    onImported?.(); // refresh roster — partially-imported users now visible
    onClose();
  }

  // — Filtered preview rows for Step 2 table
  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (filter === 'all') return preview.validatedRows;
    return preview.validatedRows.filter((r) => r.status === filter);
  }, [preview, filter]);

  // — Render
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6 overflow-y-auto motion-reduce:backdrop-blur-none"
      role="presentation"
      onClick={(e) => {
        // Click on backdrop closes (only outside step 3 in-flight)
        if (e.target === e.currentTarget) handleEscape();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-heading"
        className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-3xl border border-border my-auto motion-reduce:transition-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div className="flex-1 min-w-0">
            <h2 id="bulk-import-heading" className="text-lg font-bold text-ink">
              Bulk import users
            </h2>
            <p className="text-sm text-ink-muted mt-1">
              Upload a CSV to create multiple accounts at once. Each user receives a password-reset email.
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

          {/* — Step 1: file picker (or zero-branches empty state) */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              {branchesLoading && (
                <div className="flex items-center gap-2 text-sm text-ink-muted py-6">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Loading branches…
                </div>
              )}

              {!branchesLoading && branchLoadError && (
                <div role="alert" aria-live="polite" className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{branchLoadError}</span>
                </div>
              )}

              {!branchesLoading && !branchLoadError && activeBranchCount === 0 && (
                <div className="flex flex-col items-center text-center py-6 gap-3">
                  <div className="p-3 rounded-full bg-warning/15 text-warning">
                    <Building2 size={28} aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-ink">
                    No active branches in this tenant
                  </h3>
                  <p className="text-sm text-ink-muted max-w-md">
                    Bulk import requires at least one active branch — every imported user
                    gets placed into a branch by name. Create a branch first, then come
                    back to upload your CSV.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-primary mt-2"
                  >
                    Open Branches panel
                  </button>
                </div>
              )}

              {!branchesLoading && !branchLoadError && activeBranchCount > 0 && (
                <>
                  <div className="flex flex-col gap-2 p-4 border border-dashed border-border rounded-xl bg-card text-center">
                    <Upload size={28} className="text-ink-muted mx-auto" aria-hidden="true" />
                    <label htmlFor="bulk-csv-input" className="text-sm font-semibold text-ink">
                      Choose CSV file
                    </label>
                    <input
                      ref={fileInputRef}
                      id="bulk-csv-input"
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
                      Required columns: <code className="px-1 rounded bg-border/40 text-ink">email, name, role, branchName, agentNumber</code>.
                      Optional: <code className="px-1 rounded bg-border/40 text-ink">unitId, contractStartDate, phone, bio, careerLevel</code>.
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
                    <div role="alert" aria-live="polite" className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
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
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-warning" aria-hidden="true" />
                  <span>
                    Importing {preview.summary.total} rows. The Cloud Function timeout is
                    9 minutes; large imports may take a while. The maximum per import is {LIMITS.MAX_BULK_ROWS}.
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
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1.5fr_auto] gap-2 px-3 py-2 bg-card text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                  <span>Email</span>
                  <span>Name</span>
                  <span>Role</span>
                  <span>Branch</span>
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
                      return (
                        <div
                          key={row.rowIndex}
                          aria-invalid={row.status === 'error' ? true : undefined}
                          className={`grid grid-cols-[2fr_1.5fr_1fr_1.5fr_auto] gap-2 px-3 py-2 items-start border-t border-border text-xs ${
                            row.status === 'error'
                              ? 'bg-danger/5'
                              : row.status === 'warning'
                                ? 'bg-warning/5'
                                : ''
                          }`}
                        >
                          <span className="text-ink truncate">
                            {row.raw.email || <span className="italic text-ink-muted">(missing)</span>}
                          </span>
                          <span className="text-ink truncate">
                            {row.raw.name || <span className="italic text-ink-muted">(missing)</span>}
                          </span>
                          <span className="text-ink-muted">
                            {ROLE_DISPLAY[row.resolved.role] ?? row.raw.role ?? '—'}
                          </span>
                          <span className="text-ink-muted truncate">
                            {row.resolved.branchName ?? row.raw.branchname ?? '—'}
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
                    Importing {preview?.summary.valid ?? 0}{' '}
                    {(preview?.summary.valid ?? 0) === 1 ? 'user' : 'users'}…
                  </div>
                  <p className="text-xs text-ink-muted max-w-md">
                    Each user is being created server-side and a password-reset email is on its way. Don&apos;t close this window — closing won&apos;t roll back any users already created.
                  </p>
                </>
              )}
              {serverError && (
                <>
                  <div role="alert" aria-live="polite" className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2 text-left max-w-lg w-full">
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
              <SummaryStats results={importResults.results ?? []} emailDispatch={emailDispatch ?? []} preview={preview} />

              {(importResults.results ?? []).some((r) => !r.success) && (
                <FailureList results={importResults.results ?? []} preview={preview} />
              )}

              {emailDispatch && emailDispatch.some((e) => !e.sent) && (
                <EmailFailureList dispatch={emailDispatch} />
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

        {/* Mid-flight cancel confirmation */}
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

function SummaryStats({ results, emailDispatch, preview }) {
  const success = results.filter((r) => r.success).length;
  const failure = results.filter((r) => !r.success).length;
  const skipped = (preview?.summary?.warnings ?? 0);
  const emailFailed = (emailDispatch ?? []).filter((e) => !e.sent).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div className="card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Created</p>
        <p className="text-2xl font-bold text-success">{success}</p>
      </div>
      <div className="card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Skipped</p>
        <p className="text-2xl font-bold text-warning">{skipped}</p>
        <p className="text-[10px] text-ink-muted">duplicate emails</p>
      </div>
      <div className="card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Failed</p>
        <p className="text-2xl font-bold text-danger">{failure}</p>
      </div>
      <div className="card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Email failed</p>
        <p className="text-2xl font-bold text-warning">{emailFailed}</p>
        <p className="text-[10px] text-ink-muted">{success > 0 ? `${success - emailFailed} sent` : ''}</p>
      </div>
    </div>
  );
}

function FailureList({ results, preview }) {
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
          <li key={`${f.rowIndex}-${f.email}`} className="px-3 py-2 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink truncate">
                Row {(f.rowIndex ?? 0) + 1}: {f.email || '(no email)'}
              </p>
              <p className="text-ink-muted">{f.error ?? 'Unknown error.'}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmailFailureList({ dispatch }) {
  const failed = dispatch.filter((e) => !e.sent);
  if (failed.length === 0) return null;
  return (
    <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-ink flex items-start gap-2">
      <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="font-semibold mb-1">
          {failed.length} password-reset email{failed.length === 1 ? '' : 's'} failed to dispatch
        </p>
        <p className="text-ink-muted">
          Affected accounts were created server-side. Use the per-user Retry button on the user list, or trigger a fresh reset from the Firebase console.
        </p>
      </div>
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
        aria-labelledby="cancel-confirm-heading"
        className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-sm p-6 border border-border"
      >
        <h3 id="cancel-confirm-heading" className="text-base font-bold text-ink mb-2">
          Stop watching the import?
        </h3>
        <p className="text-sm text-ink-muted mb-5">
          The import is already underway server-side and can&apos;t be aborted. Users created so far will not be reverted, and password-reset emails for those rows have already started dispatching. You can refresh the user list afterwards to see the final result.
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
