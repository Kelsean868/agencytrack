/**
 * backfill-branchid-p2b.mjs
 *
 * P2b (audit 2026-09-24 SEC-08): stamps `branchId` and `unitId` onto every
 * policies / financingTerms / financing / financingReconciliation doc that is
 * missing either, from the owning agent's user doc (`tenants/{t}/users/{agentId}`).
 *
 * This is the prerequisite for the P2b rules: they scope a branch manager to
 * `resource.data.branchId` and a unit manager to `resource.data.unitId` on these
 * collections. A doc without the field becomes invisible to its manager the
 * moment the rules deploy — so this runs, clean, BEFORE the rules deploy.
 *
 * Pattern: scripts/maintenance/backfill-submission-branchid.mjs (Admin SDK from
 * functions/node_modules, ambient credentials, dry-run by default).
 *
 * Usage:
 *   node scripts/maintenance/backfill-branchid-p2b.mjs --tenant <tenantId>          # dry run
 *   node scripts/maintenance/backfill-branchid-p2b.mjs --tenant <tenantId> --apply  # write
 *
 * Rules the script keeps:
 *   - Dry run unless --apply. --tenant is required.
 *   - Only MISSING fields are written; the write is a batched update() of just
 *     those fields. Idempotent — a re-run finds nothing left to do.
 *   - An existing branchId/unitId that DIFFERS from the agent's current value is
 *     never overwritten: the doc is listed under "conflicts" and not written.
 *   - A doc whose agent cannot be resolved (no agentId, no user doc, user doc has
 *     no branchId, or an agent/unit_manager with no unitId) is listed under
 *     "cannot resolve" and not written.
 *   - Owners whose role has no unit (branch_manager, sales_manager, tenant_admin,
 *     platform_admin, cro) get branchId only. That is correct, not a failure —
 *     they are listed under "branch only (no unit by role)" for visibility.
 *
 * Attribution: the agent's CURRENT branch/unit (same model as the submission
 * backfill). New writes are stamped at write time by the services.
 */

import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

export const P2B_COLLECTIONS = Object.freeze(['policies', 'financingTerms', 'financing', 'financingReconciliation']);

/** Roles that legitimately have no unit — their docs get branchId only. */
export const NO_UNIT_ROLES = Object.freeze(['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin', 'cro']);

const BATCH_LIMIT = 400;

const isBlank = (v) => v === undefined || v === null || v === '';

/**
 * Decide what to do with one doc. Pure — no I/O.
 *
 * @param {string} collection  one of P2B_COLLECTIONS
 * @param {string} docId
 * @param {object} data        the doc's data
 * @param {Map<string, object>} usersById  uid → user doc data
 * @returns {{ outcome: 'ok'|'update'|'unresolvable'|'conflict', patch?: object,
 *             reason?: string, agentId?: string|null, branchOnly?: boolean }}
 */
export function planDocUpdate(collection, docId, data, usersById) {
  const d = data ?? {};
  // financingTerms is keyed by the agent uid; every other doc stores agentId.
  const agentId = d.agentId ?? (collection === 'financingTerms' ? docId : null);

  const needsBranch = isBlank(d.branchId);
  const needsUnit = isBlank(d.unitId);
  if (!needsBranch && !needsUnit) return { outcome: 'ok', agentId };

  if (!agentId) return { outcome: 'unresolvable', agentId: null, reason: 'doc has no agentId' };
  const agent = usersById.get(agentId);
  if (!agent) return { outcome: 'unresolvable', agentId, reason: 'agent user doc not found' };
  if (isBlank(agent.branchId)) return { outcome: 'unresolvable', agentId, reason: 'agent user doc has no branchId' };

  const noUnitByRole = NO_UNIT_ROLES.includes(agent.role);
  if (needsUnit && isBlank(agent.unitId) && !noUnitByRole) {
    return { outcome: 'unresolvable', agentId, reason: `agent user doc has no unitId (role ${agent.role ?? 'unknown'})` };
  }

  // Never overwrite a value that is already there and differs.
  const conflicts = [];
  if (!needsBranch && d.branchId !== agent.branchId) {
    conflicts.push(`branchId doc=${d.branchId} agent=${agent.branchId}`);
  }
  if (!needsUnit && !isBlank(agent.unitId) && d.unitId !== agent.unitId) {
    conflicts.push(`unitId doc=${d.unitId} agent=${agent.unitId}`);
  }
  if (conflicts.length) return { outcome: 'conflict', agentId, reason: conflicts.join('; ') };

  const patch = {};
  if (needsBranch) patch.branchId = agent.branchId;
  if (needsUnit && !isBlank(agent.unitId)) patch.unitId = agent.unitId;
  const branchOnly = needsUnit && isBlank(agent.unitId) && noUnitByRole;

  if (Object.keys(patch).length === 0) {
    // Only the unit was missing and this role has none: nothing to write.
    return { outcome: 'ok', agentId, branchOnly };
  }
  return { outcome: 'update', agentId, patch, branchOnly };
}

/**
 * Plan a whole run. Pure — no I/O.
 *
 * @param {Object<string, Array<{id: string, data: object}>>} docsByCollection
 * @param {Array<{id: string, data: object}>} users
 */
export function planBackfill(docsByCollection, users) {
  const usersById = new Map((users ?? []).map((u) => [u.id, u.data ?? {}]));
  const perCollection = {};
  const updates = [];
  const unresolvable = [];
  const conflicts = [];
  const branchOnly = [];

  for (const collection of P2B_COLLECTIONS) {
    const docs = docsByCollection?.[collection] ?? [];
    const counts = { scanned: docs.length, ok: 0, update: 0, unresolvable: 0, conflict: 0 };
    for (const { id, data } of docs) {
      const plan = planDocUpdate(collection, id, data, usersById);
      counts[plan.outcome] += 1;
      if (plan.outcome === 'update') updates.push({ collection, id, patch: plan.patch });
      if (plan.outcome === 'unresolvable') unresolvable.push({ collection, id, agentId: plan.agentId, reason: plan.reason });
      if (plan.outcome === 'conflict') conflicts.push({ collection, id, agentId: plan.agentId, reason: plan.reason });
      if (plan.branchOnly) branchOnly.push({ collection, id, agentId: plan.agentId, role: usersById.get(plan.agentId)?.role });
    }
    perCollection[collection] = counts;
  }

  const totals = Object.values(perCollection).reduce(
    (t, c) => ({
      scanned: t.scanned + c.scanned,
      ok: t.ok + c.ok,
      update: t.update + c.update,
      unresolvable: t.unresolvable + c.unresolvable,
      conflict: t.conflict + c.conflict,
    }),
    { scanned: 0, ok: 0, update: 0, unresolvable: 0, conflict: 0 },
  );

  return { perCollection, totals, updates, unresolvable, conflicts, branchOnly };
}

export function formatSummary(plan, { tenantId, apply }) {
  const lines = [];
  const pad = (s, n) => String(s).padEnd(n);
  lines.push(`backfill-branchid-p2b  tenant=${tenantId}  mode=${apply ? 'APPLY' : 'DRY-RUN'}`);
  lines.push('');
  lines.push(`${pad('collection', 26)}${pad('scanned', 9)}${pad('ok', 6)}${pad(apply ? 'updated' : 'would upd', 11)}${pad('cannot', 8)}conflicts`);
  for (const [c, n] of Object.entries(plan.perCollection)) {
    lines.push(`${pad(c, 26)}${pad(n.scanned, 9)}${pad(n.ok, 6)}${pad(n.update, 11)}${pad(n.unresolvable, 8)}${n.conflict}`);
  }
  const t = plan.totals;
  lines.push(`${pad('TOTAL', 26)}${pad(t.scanned, 9)}${pad(t.ok, 6)}${pad(t.update, 11)}${pad(t.unresolvable, 8)}${t.conflict}`);
  lines.push('');
  lines.push(`Summary: scanned ${t.scanned} · already OK ${t.ok} · ${apply ? 'updated' : 'would update'} ${t.update} · cannot resolve ${t.unresolvable} · conflicts ${t.conflict}`);

  if (plan.unresolvable.length) {
    lines.push('');
    lines.push(`Cannot resolve (${plan.unresolvable.length}) — NOT written:`);
    plan.unresolvable.forEach((u) => lines.push(`  ${u.collection}/${u.id}  agentId=${u.agentId ?? '(none)'}  reason: ${u.reason}`));
  }
  if (plan.conflicts.length) {
    lines.push('');
    lines.push(`Conflicts (${plan.conflicts.length}) — existing value differs from the agent's; NOT written:`);
    plan.conflicts.forEach((c) => lines.push(`  ${c.collection}/${c.id}  agentId=${c.agentId}  ${c.reason}`));
  }
  if (plan.branchOnly.length) {
    lines.push('');
    lines.push(`Branch only — owner's role has no unit (${plan.branchOnly.length}), informational:`);
    plan.branchOnly.forEach((b) => lines.push(`  ${b.collection}/${b.id}  agentId=${b.agentId}  role=${b.role}`));
  }
  lines.push('');
  if (!apply) {
    lines.push(t.unresolvable === 0 && t.conflict === 0
      ? 'DRY RUN — nothing written. "cannot resolve" and "conflicts" are both 0: safe to re-run with --apply.'
      : 'DRY RUN — nothing written. Fix the "cannot resolve" / "conflicts" rows before --apply.');
  }
  return lines.join('\n');
}

export function parseArgs(argv) {
  const out = { apply: false, tenant: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--tenant') out.tenant = argv[++i] ?? null;
    else if (a.startsWith('--tenant=')) out.tenant = a.slice('--tenant='.length);
    else throw new Error(`unknown argument: ${a}`);
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
    console.error('usage: node scripts/maintenance/backfill-branchid-p2b.mjs --tenant <tenantId> [--apply]');
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
  const refs = {};
  for (const c of P2B_COLLECTIONS) {
    const snap = await db.collection(`${base}/${c}`).get();
    docsByCollection[c] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    refs[c] = new Map(snap.docs.map((d) => [d.id, d.ref]));
  }

  const plan = planBackfill(docsByCollection, users);

  if (opts.apply && plan.updates.length) {
    for (let i = 0; i < plan.updates.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const u of plan.updates.slice(i, i + BATCH_LIMIT)) {
        batch.update(refs[u.collection].get(u.id), u.patch);
      }
      await batch.commit();
      console.log(`  committed ${Math.min(i + BATCH_LIMIT, plan.updates.length)}/${plan.updates.length}`);
    }
  }

  console.log(formatSummary(plan, { tenantId: opts.tenant, apply: opts.apply }));
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
