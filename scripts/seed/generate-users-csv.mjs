/**
 * Generate Users CSV for BulkImportUsersModal (Track C C2).
 *
 * Outputs a CSV whose column shape matches buildTemplateCSV() from
 * src/services/userImportService.js:
 *   email, name, role, branchName, agentNumber, unitId,
 *   contractStartDate, phone, bio, careerLevel
 *
 * IMPORTANT — unitId is intentionally blank for agent rows.
 * The unit_manager's Firebase UID is not known until after UMs are
 * created in a prior import run. See runbook § Import order.
 *
 * USAGE
 *   node scripts/seed/generate-users-csv.mjs
 *   node scripts/seed/generate-users-csv.mjs --out verification/
 *   node scripts/seed/generate-users-csv.mjs --out verification/ --batch-id <uuid>
 *
 * STDOUT
 *   Prints the session batch ID on the first line so the operator can
 *   capture it for subsequent seeder calls:
 *     BATCH_ID=<uuid>
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname }         from 'path';
import { fileURLToPath }            from 'url';
import { randomUUID }               from 'crypto';

import {
  BRANCH_NAME,
  BRANCH_MANAGER,
  UNIT_MANAGERS,
  AGENTS,
} from './test-roster.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function argValue(args, flag) {
  // Supports --flag=value and --flag value
  const eqForm = args.find((a) => a.startsWith(`--${flag}=`));
  if (eqForm) return eqForm.slice(flag.length + 3);
  const idx = args.indexOf(`--${flag}`);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return null;
}

const args    = process.argv.slice(2);
const outDir  = argValue(args, 'out')      ?? resolve(ROOT, 'verification');
const batchId = argValue(args, 'batch-id') ?? randomUUID();

// ── CSV helpers ───────────────────────────────────────────────────────────────

const HEADERS = [
  'email', 'name', 'role', 'branchName', 'agentNumber',
  'unitId', 'contractStartDate', 'phone', 'bio', 'careerLevel',
];

function csvRow(user, unitId = '') {
  // Field order must match HEADERS exactly.
  return [
    user.email,
    user.name,
    user.role,
    BRANCH_NAME,
    user.agentNumber ?? '',
    unitId,
    user.contractStartDate ?? '',
    '',   // phone — omitted for test users
    '',   // bio   — omitted for test users
    '',   // careerLevel — omitted for test users
  ].join(',');
}

// ── Build CSV ─────────────────────────────────────────────────────────────────

const rows = [
  HEADERS.join(','),
  csvRow(BRANCH_MANAGER),
  ...UNIT_MANAGERS.map((u) => csvRow(u)),
  ...AGENTS.map((a) => csvRow(a, '')), // unitId blank — fill in after UM import
];

const csv = rows.join('\r\n') + '\r\n';

// ── Write ─────────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'test-users.csv');
writeFileSync(outPath, csv, 'utf-8');

// ── Report ────────────────────────────────────────────────────────────────────

console.log(`BATCH_ID=${batchId}`);
console.log(`wrote:    ${outPath}`);
console.log(`rows:     ${rows.length - 1}  (1 BM + 2 UMs + 7 agents)`);
console.log('');
console.log('NOTE: agent unitId cells are blank.');
console.log('  Step 1 — import BM + UMs using this CSV.');
console.log('  Step 2 — get UM UIDs from Firebase console / UserManagementPanel.');
console.log('  Step 3 — re-run with a second CSV containing agent rows + filled unitIds,');
console.log('           OR update the unitId cells directly and re-import agent rows only.');
