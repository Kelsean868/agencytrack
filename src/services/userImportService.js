import Papa from 'papaparse';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { isValidEmail } from '../utils/validators';
import { listBranches } from './branchService';
import { getAllUsers } from './agentManagementService';

/**
 * userImportService — Track C C2.
 *
 * CSV-driven bulk user provisioning. Pure service layer:
 *   - parseCSV(file)                       → { rows, parseErrors }
 *   - prepareImport(rows, tenantId)        → preview model (validated rows + summary)
 *   - runImport(preview, csvImportBatchId) → invokes bulkImportUsers Callable
 *   - dispatchResetEmails(results, rows)   → fires sendPasswordResetEmail per success
 *   - buildErrorCSV(preview, results)      → re-importable error CSV string
 *   - buildTemplateCSV()                   → header row + one example row
 *
 * Validation discipline:
 *   - Client validation surfaces errors in the preview UI for fast feedback.
 *   - Server (bulkImportUsers Callable) re-validates everything as defense-
 *     in-depth — see functions/index.js. Both layers run.
 *
 * Reset-email dispatch:
 *   - The Callable creates Auth users + Firestore docs, but cannot dispatch
 *     password-reset emails (Admin SDK has no equivalent of
 *     sendPasswordResetEmail). Mirrors HIGH#1 single-user path: client
 *     dispatches per-row after the Callable returns. Best-effort — failures
 *     are surfaced in the summary so the admin can re-send via the existing
 *     single-user Retry path.
 */

const REQUIRED_HEADERS = ['email', 'name', 'role', 'branchname', 'agentnumber'];
const KNOWN_HEADERS = new Set([
  ...REQUIRED_HEADERS,
  'unitid',
  'contractstartdate',
  'phone',
  'bio',
  'careerlevel',
]);

const ALLOWED_ROLES = new Set(['agent', 'unit_manager', 'branch_manager', 'sales_manager']);
const FORBIDDEN_ROLES = new Set(['tenant_admin', 'platform_admin']);

const MAX_NAME_LENGTH        = 100;
const MAX_AGENT_NUMBER       = 20;
const MAX_PHONE_LENGTH       = 20;
const MAX_BIO_LENGTH         = 500;
const MAX_CAREER_LEVEL       = 50;
const MAX_BULK_ROWS_CLIENT   = 500;
const SOFT_WARN_ROWS         = 100;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * parseCSV(file)
 *
 * Parses a CSV File using Papaparse with case-insensitive headers, BOM
 * tolerance, CRLF tolerance, and `skipEmptyLines: true`. Returns the raw
 * row objects (keys lowercased per `transformHeader`) plus any
 * parse-level errors Papaparse reports.
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

function findActiveBranchByName(branches, name) {
  const target = String(name ?? '').trim().toLowerCase();
  if (!target) return null;
  for (const b of branches) {
    if ((b.name ?? '').trim().toLowerCase() === target) return b;
  }
  return null;
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validate one CSV row against tenant context.
 *
 * Returns a "validated row" with status, errors, warnings, the original raw
 * row, and a `resolved` payload ready for the Callable. status is:
 *   - 'valid'   — will be sent to the Callable
 *   - 'warning' — skipped intentionally (duplicate email); not sent
 *   - 'error'   — invalid; not sent
 */
function validateRow(rawRow, rowIndex, { activeBranches, existingEmails }) {
  const errors = [];
  const warnings = [];
  const resolved = {};

  const email = trim(rawRow.email).toLowerCase();
  if (!email) {
    errors.push('Email is required.');
  } else if (!isValidEmail(email)) {
    errors.push('Invalid email format.');
  } else if (existingEmails.has(email)) {
    warnings.push('Email already in tenant.');
  }
  resolved.email = email;

  const name = trim(rawRow.name);
  if (!name) {
    errors.push('Name is required.');
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Name must be ≤ ${MAX_NAME_LENGTH} characters.`);
  }
  resolved.name = name;

  const role = trim(rawRow.role).toLowerCase();
  if (!role) {
    errors.push('Role is required.');
  } else if (FORBIDDEN_ROLES.has(role)) {
    errors.push(`Role '${role}' cannot be imported via CSV. Provision manually.`);
  } else if (!ALLOWED_ROLES.has(role)) {
    errors.push(`Role '${role}' is not recognized. Allowed: agent, unit_manager, branch_manager, sales_manager.`);
  }
  resolved.role = role;

  const branchName = trim(rawRow.branchname);
  if (!branchName) {
    errors.push('branchName is required.');
  } else {
    const branch = findActiveBranchByName(activeBranches, branchName);
    if (!branch) {
      errors.push(`Branch "${branchName}" not found in active branches.`);
    } else {
      resolved.branchId = branch.id;
      resolved.branchName = branch.name; // for display only; not sent to CF
    }
  }

  const agentNumber = trim(rawRow.agentnumber);
  if (role === 'agent' && !agentNumber) {
    errors.push('agentNumber is required for agent role.');
  } else if (agentNumber.length > MAX_AGENT_NUMBER) {
    errors.push(`agentNumber must be ≤ ${MAX_AGENT_NUMBER} characters.`);
  }
  resolved.agentNumber = agentNumber;

  // Optional fields
  const unitId = trim(rawRow.unitid);
  if (unitId && role !== 'agent') {
    warnings.push("unitId is ignored for non-agent roles.");
  } else if (unitId) {
    resolved.unitId = unitId;
  } else if (role === 'agent') {
    resolved.unitId = null;
  }

  const contractStartDate = trim(rawRow.contractstartdate);
  if (contractStartDate) {
    if (!ISO_DATE_RE.test(contractStartDate)) {
      errors.push('contractStartDate must be ISO YYYY-MM-DD.');
    } else {
      resolved.contractStartDate = contractStartDate;
    }
  }

  const phone = trim(rawRow.phone);
  if (phone) {
    if (phone.length > MAX_PHONE_LENGTH) {
      errors.push(`phone must be ≤ ${MAX_PHONE_LENGTH} characters.`);
    } else {
      resolved.phone = phone;
    }
  }

  const bio = trim(rawRow.bio);
  if (bio) {
    if (bio.length > MAX_BIO_LENGTH) {
      errors.push(`bio must be ≤ ${MAX_BIO_LENGTH} characters.`);
    } else {
      resolved.bio = bio;
    }
  }

  const careerLevel = trim(rawRow.careerlevel);
  if (careerLevel) {
    if (careerLevel.length > MAX_CAREER_LEVEL) {
      errors.push(`careerLevel must be ≤ ${MAX_CAREER_LEVEL} characters.`);
    } else {
      resolved.careerLevel = careerLevel;
    }
  }

  let status = 'valid';
  if (errors.length > 0) status = 'error';
  else if (warnings.length > 0) status = 'warning';

  return { rowIndex, raw: rawRow, resolved, status, errors, warnings };
}

/**
 * prepareImport(rows, tenantId)
 *
 * Loads active branches + existing tenant emails (active + deactivated),
 * validates every row, returns a preview model. Caller renders this in
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

  // Load active branches once (reused per row, no per-row Firestore round-trip).
  const allBranches = await listBranches(tenantId);
  const activeBranches = allBranches.filter((b) => b.isActive === true);

  // Load all tenant users (including deactivated) for the duplicate-email
  // check. Sub-500 user tenants — no pagination needed for pilot scope.
  const existingUsers = await getAllUsers({ includeInactive: true });
  const existingEmails = new Set(
    existingUsers
      .map((u) => trim(u.email).toLowerCase())
      .filter(Boolean)
  );

  const validatedRows = rows.map((raw, i) =>
    validateRow(raw, i, { activeBranches, existingEmails })
  );

  const summary = {
    total: validatedRows.length,
    valid: validatedRows.filter((r) => r.status === 'valid').length,
    warnings: validatedRows.filter((r) => r.status === 'warning').length,
    errors: validatedRows.filter((r) => r.status === 'error').length,
    softWarn: validatedRows.length > SOFT_WARN_ROWS,
    activeBranchCount: activeBranches.length,
  };

  return { validatedRows, summary, activeBranches };
}

/**
 * runImport(preview, csvImportBatchId)
 *
 * Sends the valid rows to bulkImportUsers Callable. csvImportBatchId is a
 * full UUID v4 (caller generates via crypto.randomUUID()) — stamped on
 * every imported user doc.
 */
export async function runImport(preview, csvImportBatchId) {
  if (!preview?.validatedRows) throw new Error('Invalid preview.');
  if (!csvImportBatchId) throw new Error('csvImportBatchId required.');

  const validRows = preview.validatedRows.filter((r) => r.status === 'valid');
  if (validRows.length === 0) {
    throw new Error('No valid rows to import.');
  }

  const payload = {
    csvImportBatchId,
    users: validRows.map((r) => r.resolved),
  };

  const fn = httpsCallable(getFunctions(), 'bulkImportUsers');
  const result = await fn(payload);
  return result?.data ?? { results: [] };
}

/**
 * dispatchResetEmails(callableResults, validatedRows)
 *
 * After the Callable returns successful UIDs, fire sendPasswordResetEmail
 * client-side per success — mirrors the HIGH#1 single-user path. Returns
 * an array of { email, sent, error? } per success row. Failures are
 * surfaced in the summary, NOT silently absorbed.
 *
 * Uses Promise.allSettled so one failure doesn't block the others.
 */
export async function dispatchResetEmails(callableResults) {
  if (!Array.isArray(callableResults)) return [];
  const successes = callableResults.filter((r) => r.success && r.email);
  const settled = await Promise.allSettled(
    successes.map((r) =>
      sendPasswordResetEmail(auth, r.email).then(
        () => ({ email: r.email, sent: true }),
        (err) => ({ email: r.email, sent: false, error: err?.code ?? err?.message ?? String(err) })
      )
    )
  );
  return settled.map((s) =>
    s.status === 'fulfilled'
      ? s.value
      : { email: '(unknown)', sent: false, error: String(s.reason) }
  );
}

/**
 * buildErrorCSV(validatedRows, callableResults)
 *
 * Re-importable error CSV. Includes original input rows for any row that
 * either failed client-side validation OR failed during the Callable run,
 * with an appended `error` column. Admin fixes the offending fields and
 * re-uploads.
 *
 * Skipped (duplicate-email warning) rows are NOT included — they're
 * intentional skips, not errors to fix.
 */
export function buildErrorCSV(validatedRows, callableResults = []) {
  const callableByEmail = new Map();
  for (const r of callableResults) {
    if (r?.email) callableByEmail.set(trim(r.email).toLowerCase(), r);
  }

  const errorRows = [];
  for (const v of validatedRows) {
    if (v.status === 'error') {
      errorRows.push({
        email: v.raw.email ?? '',
        name: v.raw.name ?? '',
        role: v.raw.role ?? '',
        branchName: v.raw.branchname ?? '',
        agentNumber: v.raw.agentnumber ?? '',
        unitId: v.raw.unitid ?? '',
        contractStartDate: v.raw.contractstartdate ?? '',
        phone: v.raw.phone ?? '',
        bio: v.raw.bio ?? '',
        careerLevel: v.raw.careerlevel ?? '',
        error: v.errors.join(' | '),
      });
      continue;
    }
    if (v.status === 'valid') {
      const cr = callableByEmail.get(trim(v.resolved.email).toLowerCase());
      if (cr && cr.success === false) {
        errorRows.push({
          email: v.raw.email ?? '',
          name: v.raw.name ?? '',
          role: v.raw.role ?? '',
          branchName: v.raw.branchname ?? '',
          agentNumber: v.raw.agentnumber ?? '',
          unitId: v.raw.unitid ?? '',
          contractStartDate: v.raw.contractstartdate ?? '',
          phone: v.raw.phone ?? '',
          bio: v.raw.bio ?? '',
          careerLevel: v.raw.careerlevel ?? '',
          error: cr.error ?? 'Server-side import failed.',
        });
      }
    }
  }

  if (errorRows.length === 0) return null;

  return Papa.unparse(errorRows, {
    columns: [
      'email', 'name', 'role', 'branchName', 'agentNumber',
      'unitId', 'contractStartDate', 'phone', 'bio', 'careerLevel',
      'error',
    ],
  });
}

/**
 * buildTemplateCSV()
 *
 * Header row + one example row. Step 1 of the modal exposes this via
 * "Download template" so admins know the exact column shape (Q7).
 */
export function buildTemplateCSV() {
  return Papa.unparse(
    [
      {
        email: 'jordan.smith@tatil.example',
        name: 'Jordan Smith',
        role: 'agent',
        branchName: 'Port of Spain',
        agentNumber: 'A1234',
        unitId: '',
        contractStartDate: '2026-01-15',
        phone: '868-555-0100',
        bio: '',
        careerLevel: 'Associate',
      },
    ],
    {
      columns: [
        'email', 'name', 'role', 'branchName', 'agentNumber',
        'unitId', 'contractStartDate', 'phone', 'bio', 'careerLevel',
      ],
    }
  );
}

/**
 * downloadCSV(filename, csvText)
 *
 * Creates a downloadable Blob and triggers the browser download. Used by
 * Step 1's "Download template" CTA and Step 4's "Download error report" CTA.
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
 * Full UUID v4 via crypto.randomUUID() — stamped on every imported user
 * doc as csvImportBatchId (Q9). Used by the modal at Step 1 (set once per
 * upload session, persists into Step 4 summary).
 */
export function generateBatchId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — not expected in pilot environment.
  return 'csv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

export const LIMITS = {
  MAX_BULK_ROWS: MAX_BULK_ROWS_CLIENT,
  SOFT_WARN_ROWS,
  KNOWN_HEADERS,
  REQUIRED_HEADERS,
};
