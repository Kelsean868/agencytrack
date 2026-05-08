import Papa from 'papaparse';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isValidEmail } from '../utils/validators';
import { setGoals, getCompanyMinimums } from './goalsService';
import { getAllUsers } from './agentManagementService';

/**
 * goalsImportService — Track C C3.
 *
 * CSV-driven bulk 2026 personal-commitment provisioning. Pure service
 * layer modeled on C2's userImportService.js:
 *   - parseCSV(file)                                  → { rows, parseErrors }
 *   - prepareImport(rows, tenantId)                   → preview model
 *   - runImport(preview, csvImportBatchId, setBy, setByName, tenantId)
 *                                                      → per-row results
 *   - buildErrorCSV(preview, results)                 → re-importable error CSV
 *   - buildTemplateCSV()                              → header row + example
 *   - downloadCSV(filename, csvText)
 *   - generateBatchId()                               → UUID v4
 *
 * Validation discipline:
 *   - Client validation surfaces obvious errors in the preview UI for
 *     fast feedback (missing email, malformed email, missing target
 *     fields, agent not found in tenant, agent already has commitment).
 *   - Floor validation is DELEGATED to the existing setGoals service.
 *     setGoals reads companyMinimums and throws below-floor errors that
 *     surface verbatim as the row's failure message. Single source of
 *     truth for floor logic — no parallel implementation here.
 *
 * Write coordination:
 *   - No Cloud Function. Goal writes are simple Firestore ops gated by
 *     match /goals/{goalId} canManage(tenantId), which tenant_admin
 *     satisfies.
 *   - Per-row try/catch around setGoals — a failure in row N does not
 *     affect row N+1.
 *   - merge: true semantics in setGoals preserve manager-set targets on
 *     the same doc.
 *
 * Test-cleanup discipline:
 *   - Each imported goal carries csvImportBatchId. The verification
 *     script's cleanup phase MUST verify this field matches the test
 *     batch's UUID before any deleteDoc — defensive guard against race
 *     wiping a real agent's commitment.
 */

const REQUIRED_HEADERS = ['agentemail', 'annualapitarget', 'annualappstarget'];
const KNOWN_HEADERS = new Set([...REQUIRED_HEADERS]);

const MAX_BULK_ROWS_CLIENT = 500;
const SOFT_WARN_ROWS = 100;

/**
 * parseCSV(file)
 *
 * Parses a CSV File using Papaparse with case-insensitive headers, BOM
 * tolerance, CRLF tolerance, and `skipEmptyLines: true`.
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => String(h ?? '').trim().toLowerCase(),
      complete: (results) => {
        resolve({
          rows: Array.isArray(results.data) ? results.data : [],
          parseErrors: Array.isArray(results.errors) ? results.errors : [],
          headers: Array.isArray(results.meta?.fields) ? results.meta.fields : [],
        });
      },
      error: (err) => reject(err),
    });
  });
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPositiveNumber(raw) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0;
}

/**
 * Validate one CSV row against tenant context.
 *
 * Returns a "validated row" with status, errors, warnings, the original
 * raw row, and a `resolved` payload ready for setGoals. status is:
 *   - 'valid'   — will be sent to setGoals
 *   - 'warning' — skipped intentionally (existing commitment); not sent
 *   - 'error'   — invalid; not sent
 *
 * Floor validation is NOT performed here — setGoals does it at write
 * time and throws below-floor errors that surface as the row's failure
 * message. Doing it twice would split the source of truth.
 */
function validateRow(rawRow, rowIndex, { agentByEmail, existingCommitments }) {
  const errors = [];
  const warnings = [];
  const resolved = {};

  const emailRaw = trim(rawRow.agentemail).toLowerCase();
  if (!emailRaw) {
    errors.push('agentEmail is required.');
  } else if (!isValidEmail(emailRaw)) {
    errors.push('Invalid email format.');
  } else {
    const agent = agentByEmail.get(emailRaw);
    if (!agent) {
      errors.push(`No active agent with email "${emailRaw}".`);
    } else {
      resolved.agentUid = agent.uid;
      resolved.agentEmail = agent.email;
      resolved.agentName = agent.name ?? agent.email ?? '(unknown)';
      if (existingCommitments.has(agent.uid)) {
        warnings.push('Agent already has 2026 commitment set.');
      }
    }
  }

  const apiRaw = trim(rawRow.annualapitarget);
  if (!apiRaw) {
    errors.push('annualApiTarget is required.');
  } else if (!isPositiveNumber(apiRaw)) {
    errors.push('annualApiTarget must be a positive number.');
  } else {
    resolved.personalAnnualAPI = parseFloat(apiRaw);
  }

  const appsRaw = trim(rawRow.annualappstarget);
  if (!appsRaw) {
    errors.push('annualAppsTarget is required.');
  } else if (!isPositiveNumber(appsRaw)) {
    errors.push('annualAppsTarget must be a positive number.');
  } else {
    resolved.personalAnnualApps = parseFloat(appsRaw);
  }

  let status = 'valid';
  if (errors.length > 0) status = 'error';
  else if (warnings.length > 0) status = 'warning';

  return { rowIndex, raw: rawRow, resolved, status, errors, warnings };
}

/**
 * prepareImport(rows, tenantId)
 *
 * Loads:
 *   - Active-agent map keyed by lowercase email (filtered from
 *     getAllUsers — role==='agent', active!==false).
 *   - Existing-commitment Set keyed by agent UID — pre-flight reads of
 *     each agent's goal doc to detect existing personalAnnualAPI.
 *   - companyMinimums (so the modal can render the defaults-banner if
 *     the explicit doc is missing).
 *
 * Validates every row, returns a preview model. Caller renders this in
 * the Step 2 preview table, then passes it to runImport when admin
 * confirms.
 */
export async function prepareImport(rows, tenantId) {
  if (!Array.isArray(rows)) {
    throw new Error('Rows must be an array.');
  }
  if (rows.length === 0) {
    throw new Error('No rows to import.');
  }
  if (rows.length > MAX_BULK_ROWS_CLIENT) {
    throw new Error(`Maximum ${MAX_BULK_ROWS_CLIENT} rows per import (received ${rows.length}).`);
  }

  // Active-agent index. Single getAllUsers fetch — sub-500-user tenants
  // for the pilot, no pagination needed.
  const allUsers = await getAllUsers({ includeInactive: true });
  const activeAgents = allUsers.filter(
    (u) => u.role === 'agent' && u.active !== false && trim(u.email)
  );
  const agentByEmail = new Map();
  for (const a of activeAgents) {
    agentByEmail.set(trim(a.email).toLowerCase(), a);
  }

  // Existing-commitment Set. Pre-flight read of every active agent's
  // goal doc; populates agents whose personalAnnualAPI is already set
  // to a positive number. Per-row warning then triggers the skip.
  const existingCommitments = new Set();
  await Promise.all(
    activeAgents.map(async (a) => {
      try {
        const ref = doc(db, `tenants/${tenantId}/goals/${a.uid}`);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : null;
        if (existing && parseFloat(existing.personalAnnualAPI) > 0) {
          existingCommitments.add(a.uid);
        }
      } catch (err) {
        // Read failure is non-fatal — fall through and let setGoals
        // overwrite if the agent's row validates. We surface the
        // overall load error elsewhere if it's systemic.
        console.warn('[goalsImportService] pre-flight goal read failed for', a.uid, err);
      }
    })
  );

  // companyMinimums — used by the modal's defaults-banner UX (Q3).
  // Returns built-in defaults if the explicit doc is missing.
  const minimums = await getCompanyMinimums(tenantId);

  const eligibleAgentCount = activeAgents.length - existingCommitments.size;

  const validatedRows = rows.map((raw, i) =>
    validateRow(raw, i, { agentByEmail, existingCommitments })
  );

  const summary = {
    total: validatedRows.length,
    valid: validatedRows.filter((r) => r.status === 'valid').length,
    warnings: validatedRows.filter((r) => r.status === 'warning').length,
    errors: validatedRows.filter((r) => r.status === 'error').length,
    softWarn: validatedRows.length > SOFT_WARN_ROWS,
    activeAgentCount: activeAgents.length,
    eligibleAgentCount,
  };

  return { validatedRows, summary, minimums };
}

/**
 * runImport(preview, csvImportBatchId, setBy, setByName, tenantId)
 *
 * Iterates valid rows; calls existing setGoals per row inside try/catch.
 * setGoals enforces companyMinimums floors and throws below-floor errors
 * that surface verbatim as the row's failure message.
 *
 * csvImportBatchId is a full UUID v4 (caller generates via
 * crypto.randomUUID()) — stamped on every imported goal doc via the
 * setGoals extension.
 */
export async function runImport(preview, csvImportBatchId, setBy, setByName, tenantId) {
  if (!preview?.validatedRows) throw new Error('Invalid preview.');
  if (!csvImportBatchId) throw new Error('csvImportBatchId required.');
  if (!setBy) throw new Error('setBy required.');
  if (!tenantId) throw new Error('tenantId required.');

  const validRows = preview.validatedRows.filter((r) => r.status === 'valid');
  if (validRows.length === 0) {
    throw new Error('No valid rows to import.');
  }

  const results = [];
  for (const row of validRows) {
    const { agentUid, agentEmail, agentName, personalAnnualAPI, personalAnnualApps } = row.resolved;
    try {
      await setGoals(
        tenantId,
        agentUid,
        {
          personalAnnualAPI,
          personalAnnualApps,
          csvImportBatchId,
          importedFromCsv: true,
        },
        setBy,
        setByName ?? '(unknown)'
      );
      results.push({
        rowIndex: row.rowIndex,
        agentUid,
        agentEmail,
        agentName,
        success: true,
      });
    } catch (err) {
      results.push({
        rowIndex: row.rowIndex,
        agentUid,
        agentEmail,
        agentName,
        success: false,
        error: err?.message ?? String(err),
        code: err?.code ?? null,
      });
    }
  }

  return { results, batchId: csvImportBatchId };
}

/**
 * buildErrorCSV(validatedRows, results)
 *
 * Re-importable error CSV. Includes original input rows for any row
 * that either failed client-side validation OR failed during runImport,
 * with an appended `error` column. Admin fixes the offending fields
 * and re-uploads.
 *
 * Skipped (existing-commitment) rows are NOT included — they're
 * intentional skips, not errors to fix.
 */
export function buildErrorCSV(validatedRows, results = []) {
  const resultByRowIndex = new Map();
  for (const r of results) {
    if (typeof r.rowIndex === 'number') resultByRowIndex.set(r.rowIndex, r);
  }

  const errorRows = [];
  for (const v of validatedRows) {
    if (v.status === 'error') {
      errorRows.push({
        agentEmail: v.raw.agentemail ?? '',
        annualApiTarget: v.raw.annualapitarget ?? '',
        annualAppsTarget: v.raw.annualappstarget ?? '',
        error: v.errors.join(' | '),
      });
      continue;
    }
    if (v.status === 'valid') {
      const r = resultByRowIndex.get(v.rowIndex);
      if (r && r.success === false) {
        errorRows.push({
          agentEmail: v.raw.agentemail ?? '',
          annualApiTarget: v.raw.annualapitarget ?? '',
          annualAppsTarget: v.raw.annualappstarget ?? '',
          error: r.error ?? 'Import failed.',
        });
      }
    }
  }

  if (errorRows.length === 0) return null;

  return Papa.unparse(errorRows, {
    columns: ['agentEmail', 'annualApiTarget', 'annualAppsTarget', 'error'],
  });
}

/**
 * buildTemplateCSV()
 *
 * Header row + one example row. Step 1 of the modal exposes this via
 * "Download template" so admins know the exact column shape.
 *
 * Note: no `year` column. The personal-commitment doc has no year field;
 * "2026" is editorial framing only — the template's filename
 * communicates the year scope.
 */
export function buildTemplateCSV() {
  return Papa.unparse(
    [
      {
        agentEmail: 'jordan.smith@tatil.example',
        annualApiTarget: 250000,
        annualAppsTarget: 50,
      },
    ],
    {
      columns: ['agentEmail', 'annualApiTarget', 'annualAppsTarget'],
    }
  );
}

/**
 * downloadCSV(filename, csvText)
 *
 * Creates a downloadable Blob and triggers the browser download.
 */
export function downloadCSV(filename, csvText) {
  if (typeof window === 'undefined' || !csvText) return;
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * generateBatchId()
 *
 * Full UUID v4 via crypto.randomUUID() — stamped on every imported
 * goal doc. Used by the modal at Step 1 (set once per upload session,
 * persists into Step 4 summary).
 */
export function generateBatchId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — not expected in pilot environment.
  return 'csv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

/**
 * usingDefaultMinimums(minimums)
 *
 * True when getCompanyMinimums returned the built-in defaults (no
 * explicit companyMinimums doc for this tenant). Triggers the Q3 warn
 * banner at Step 1.
 *
 * Heuristic: an explicit doc carries `updatedBy` and `updatedAt`. The
 * defaults from goalsService.js do not. Reading either field is a
 * sufficient signal.
 */
export function usingDefaultMinimums(minimums) {
  if (!minimums) return true;
  return !minimums.updatedBy && !minimums.updatedAt;
}

export const LIMITS = {
  MAX_BULK_ROWS: MAX_BULK_ROWS_CLIENT,
  SOFT_WARN_ROWS,
  KNOWN_HEADERS,
  REQUIRED_HEADERS,
};
