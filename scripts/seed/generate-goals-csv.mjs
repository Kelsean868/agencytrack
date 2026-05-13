/**
 * Generate Goals CSV for BulkImportGoalsModal (Track C C3).
 *
 * Outputs a CSV whose column shape matches buildTemplateCSV() from
 * src/services/goalsImportService.js:
 *   agentEmail, annualApiTarget, annualAppsTarget
 *
 * Both targets are above the tatillife_south company minimums
 * (200 000 API / 42 apps — see test-roster.mjs AGENT_GOALS).
 *
 * USAGE
 *   node scripts/seed/generate-goals-csv.mjs
 *   node scripts/seed/generate-goals-csv.mjs --out verification/
 *   node scripts/seed/generate-goals-csv.mjs --out verification/ --batch-id <uuid>
 *
 * STDOUT
 *   Prints the session batch ID on the first line:
 *     BATCH_ID=<uuid>
 *
 * PREREQUISITE
 *   All 7 test agents must already exist in the tenant before this CSV
 *   is imported via the modal. The modal validates each agentEmail against
 *   the tenant's active agent list.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname }         from 'path';
import { fileURLToPath }            from 'url';
import { randomUUID }               from 'crypto';

import { AGENTS, AGENT_GOALS } from './test-roster.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function argValue(args, flag) {
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

const HEADERS = ['agentEmail', 'annualApiTarget', 'annualAppsTarget'];

function csvRow(agent) {
  return [
    agent.email,
    AGENT_GOALS.annualApiTarget,
    AGENT_GOALS.annualAppsTarget,
  ].join(',');
}

// ── Build CSV ─────────────────────────────────────────────────────────────────

const rows = [
  HEADERS.join(','),
  ...AGENTS.map(csvRow),
];

const csv = rows.join('\r\n') + '\r\n';

// ── Write ─────────────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'test-goals.csv');
writeFileSync(outPath, csv, 'utf-8');

// ── Report ────────────────────────────────────────────────────────────────────

console.log(`BATCH_ID=${batchId}`);
console.log(`wrote:    ${outPath}`);
console.log(`rows:     ${rows.length - 1}  (7 agents × 1 goal row each)`);
console.log(`targets:  API=${AGENT_GOALS.annualApiTarget} TTD / apps=${AGENT_GOALS.annualAppsTarget}`);
