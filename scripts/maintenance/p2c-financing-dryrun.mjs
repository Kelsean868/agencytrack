/**
 * p2c-financing-dryrun.mjs — READ-ONLY. Writes nothing, ever.
 *
 * P2c (audit 2026-09-24 SEC-09 + P2b leftovers): before the P2c rules deploy, count
 * the existing docs the new rules would REJECT on their next client write:
 *
 *   financingTerms          a key outside the allowlist · a financingStatus that is
 *                           missing or not one of the five states
 *   financing               a key outside the allowlist · adjustmentPct not a number
 *                           in [-1, 1] · runningBalance present but not a number
 *   financingReconciliation a key outside the allowlist
 *   users (policy creators) an agent / unit_manager / branch_manager with no branchId
 *                           — the new policies create arm needs the creator's branchId
 *
 * Reads never change: an affected doc stays readable. Only its NEXT client write is
 * refused, until the doc is fixed. A clean run (all zero) means nothing breaks.
 *
 * The allowlists below MIRROR firestore.rules (termsKeysAllowed / monthKeysAllowed /
 * reconKeysAllowed). They are copied, not shared — rules cannot import JS — so a
 * change to either must change both.
 *
 * Pattern: scripts/maintenance/backfill-branchid-p2b.mjs (Admin SDK from
 * functions/node_modules, ambient credentials, never a key file).
 *
 * Usage:
 *   node scripts/maintenance/p2c-financing-dryrun.mjs --tenant <tenantId>
 */

import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

export const ALLOWED_KEYS = Object.freeze({
  financingTerms: Object.freeze([
    'agentId', 'tenantId', 'branchId', 'unitId',
    'agreedMonthlyFinancing', 'currentMonthlyFinancing', 'validatingAPI', 'effectiveDate',
    'financingStatus', 'statusHistory',
    'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
  ]),
  financing: Object.freeze([
    'agentId', 'tenantId', 'branchId', 'unitId', 'month',
    'runningBalance', 'financingPaid', 'netCommission', 'bonusOffset', 'notes', 'source',
    'enteredBy', 'enteredByName', 'enteredAt', 'updatedAt',
    'validatingAPI', 'actualAPI', 'suggestedFinancing', 'basisSource',
    'managerFinancing', 'adjustmentPct',
    'prorationUpdatedAt', 'prorationUpdatedBy',
    'prorationEnteredBy', 'prorationEnteredByName', 'prorationEnteredAt',
  ]),
  financingReconciliation: Object.freeze([
    'agentId', 'tenantId', 'branchId', 'unitId', 'year',
    'totalFinancingDrawn', 'totalOffsets', 'closingBalance', 'waiverApplied',
    'serviceMet', 'serviceMonths', 'reconciledPosition', 'outcome',
    'surplusPaid', 'garnishStarted', 'triggeredBy',
    'updatedAt', 'updatedBy',
    'reconciledBy', 'reconciledByName', 'reconciledAt', 'createdAt',
  ]),
});

export const FINANCING_COLLECTIONS = Object.freeze(Object.keys(ALLOWED_KEYS));

const STATUSES = ['not_on_financing', 'on_financing', 'reconciling', 'post_financing_repayment', 'cleared'];
const POLICY_CREATOR_ROLES = ['agent', 'unit_manager', 'branch_manager'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Reasons the P2c rules would refuse this doc's next write. Pure — no I/O.
 * @returns {string[]} empty when the doc is fine
 */
export function financingDocProblems(collection, data) {
  const d = data ?? {};
  const allowed = new Set(ALLOWED_KEYS[collection] ?? []);
  const problems = [];
  const extra = Object.keys(d).filter((k) => !allowed.has(k)).sort();
  if (extra.length) problems.push(`unknown keys: ${extra.join(', ')}`);

  if (collection === 'financingTerms' && !STATUSES.includes(d.financingStatus)) {
    problems.push(`financingStatus ${d.financingStatus === undefined ? 'missing' : `"${d.financingStatus}"`} is not a valid state`);
  }
  if (collection === 'financing') {
    if ('adjustmentPct' in d && !(isNum(d.adjustmentPct) && d.adjustmentPct >= -1 && d.adjustmentPct <= 1)) {
      problems.push(`adjustmentPct ${JSON.stringify(d.adjustmentPct)} outside [-1, 1]`);
    }
    if ('runningBalance' in d && typeof d.runningBalance !== 'number') {
      problems.push(`runningBalance ${JSON.stringify(d.runningBalance)} is not a number`);
    }
  }
  return problems;
}

/** A policy-creating user whose doc has no branchId can no longer create a policy. */
export function userCreateProblem(data) {
  const d = data ?? {};
  if (!POLICY_CREATOR_ROLES.includes(d.role)) return null;
  if (d.active === false) return null; // deactivated accounts do not create policies
  return (d.branchId === undefined || d.branchId === null || d.branchId === '')
    ? `role ${d.role} has no branchId — policy create would be refused`
    : null;
}

/**
 * @param {Object<string, Array<{id, data}>>} docsByCollection
 * @param {Array<{id, data}>} users
 */
export function planDryRun(docsByCollection, users) {
  const perCollection = {};
  const affected = [];
  for (const c of FINANCING_COLLECTIONS) {
    const docs = docsByCollection?.[c] ?? [];
    let bad = 0;
    for (const { id, data } of docs) {
      const problems = financingDocProblems(c, data);
      if (problems.length) {
        bad += 1;
        affected.push({ collection: c, id, problems });
      }
    }
    perCollection[c] = { scanned: docs.length, wouldFail: bad };
  }
  const userProblems = [];
  for (const { id, data } of users ?? []) {
    const p = userCreateProblem(data);
    if (p) userProblems.push({ id, problem: p });
  }
  const totalWouldFail = Object.values(perCollection).reduce((n, c) => n + c.wouldFail, 0);
  return { perCollection, affected, userProblems, totalWouldFail };
}

export function formatDryRun(plan, { tenantId }) {
  const pad = (s, n) => String(s).padEnd(n);
  const lines = [`p2c-financing-dryrun  tenant=${tenantId}  mode=READ-ONLY`, ''];
  lines.push(`${pad('collection', 26)}${pad('scanned', 9)}would fail next write`);
  for (const [c, n] of Object.entries(plan.perCollection)) {
    lines.push(`${pad(c, 26)}${pad(n.scanned, 9)}${n.wouldFail}`);
  }
  lines.push(`${pad('users (policy create)', 26)}${pad('', 9)}${plan.userProblems.length}`);
  if (plan.affected.length) {
    lines.push('', `Financing docs (${plan.affected.length}):`);
    plan.affected.forEach((a) => lines.push(`  ${a.collection}/${a.id}  ${a.problems.join(' · ')}`));
  }
  if (plan.userProblems.length) {
    lines.push('', `Users (${plan.userProblems.length}):`);
    plan.userProblems.forEach((u) => lines.push(`  users/${u.id}  ${u.problem}`));
  }
  lines.push('', plan.totalWouldFail === 0 && plan.userProblems.length === 0
    ? 'CLEAN — no existing doc would fail the P2c rules. Nothing was written.'
    : 'NOT CLEAN — fix the rows above before (or right after) the rules deploy. Nothing was written.');
  return lines.join('\n');
}

export function parseArgs(argv) {
  const out = { tenant: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tenant') out.tenant = argv[++i] ?? null;
    else if (a.startsWith('--tenant=')) out.tenant = a.slice('--tenant='.length);
    else throw new Error(`unknown argument: ${a} (this script is read-only; there is no --apply)`);
  }
  return out;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    opts = null;
  }
  if (!opts?.tenant) {
    console.error('usage: node scripts/maintenance/p2c-financing-dryrun.mjs --tenant <tenantId>');
    return 2;
  }

  const require = createRequire(import.meta.url);
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const admin = require(path.join(HERE, '../../functions/node_modules/firebase-admin'));
  admin.initializeApp(); // ambient credentials, never a key file
  const db = admin.firestore();
  const base = `tenants/${opts.tenant}`;

  const usersSnap = await db.collection(`${base}/users`).get();
  const users = usersSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
  if (users.length === 0) {
    console.error(`no user docs under ${base}/users — wrong --tenant? Refusing.`);
    return 2;
  }
  const docsByCollection = {};
  for (const c of FINANCING_COLLECTIONS) {
    const snap = await db.collection(`${base}/${c}`).get();
    docsByCollection[c] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  }

  console.log(formatDryRun(planDryRun(docsByCollection, users), { tenantId: opts.tenant }));
  return 0;
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      console.error('FATAL:', err.message);
      process.exit(1);
    });
}
