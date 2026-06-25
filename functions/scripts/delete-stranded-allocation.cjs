/**
 * delete-stranded-allocation.cjs — PR-U2 residue cleanup. Deletes the stranded
 * `.allocation` FIELD from `moneyNeeds/{year}` docs, leaving the rest of the
 * worksheet (real agent data) intact.
 *
 * Context: PR-U1 cut the `moneyNeeds/{year}.allocation` writer (the merged
 * surface now writes the canonical `yearPlan/{year}` store). A small number of
 * docs still carry a residual `.allocation` sub-object from the flag-gated
 * period. This script removes ONLY that field, ONLY where the agent already has
 * a `yearPlan/{year}` doc (so the loop data is safely the canonical source).
 *
 * SAFETY:
 *   • DRY-RUN by default — prints what WOULD delete, writes nothing.
 *   • `--apply` is required to actually delete.
 *   • Field-level delete (FieldValue.delete()) — never deletes the doc.
 *   • Per-doc re-verification: the corresponding yearPlan/{year} doc must exist.
 *   • Explicit <projectId> arg required — no ambient resolution, no running blind.
 *
 * RUN (from repo root, with admin creds that can read+write the named project):
 *   node functions/scripts/delete-stranded-allocation.cjs agencytrack-2a610            # dry-run
 *   node functions/scripts/delete-stranded-allocation.cjs agencytrack-2a610 --apply    # delete
 *
 * Verify after --apply with:
 *   node functions/scripts/probe-yearplan-prod-state.cjs agencytrack-2a610   # expect B=0
 */

'use strict';

// ── Pure predicate (exported for unit test) ──────────────────────────────────
// A moneyNeeds/{year} doc's `.allocation` is safe to delete iff the field is
// present AND the agent already has a yearPlan/{year} doc (canonical loop data).
function shouldDeleteAllocation({ hasAllocation, yearPlanExists }) {
  return !!hasAllocation && !!yearPlanExists;
}

module.exports = { shouldDeleteAllocation };

// ── Operator entrypoint (firebase-admin) — guarded so the predicate above can
// be required without initializing the Admin SDK. ────────────────────────────
async function main() {
  const admin = require('firebase-admin');
  const fs = require('fs');

  const APPLY = process.argv.includes('--apply');
  const mode = APPLY ? 'APPLY (deleting fields)' : 'DRY-RUN (no writes)';

  // Require an explicit project. No ambient resolution, no running blind.
  const arg = process.argv.slice(2).find((a) => a && !a.startsWith('-')) ||
    (process.argv.find((a) => a.startsWith('--project=')) || '').split('=')[1];
  const project = (arg || '').trim();

  if (!project) {
    console.error('');
    console.error('ERROR: project is required. Refusing to run against an unconfirmed project.');
    console.error('  Usage: node functions/scripts/delete-stranded-allocation.cjs <projectId> [--apply]');
    console.error('  Prod:  node functions/scripts/delete-stranded-allocation.cjs agencytrack-2a610');
    console.error('');
    process.exit(2);
  }

  // Cross-check: if a service-account key file is set, surface its project_id so
  // the operator can see whether the creds match the project they named.
  let credProject = null;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    try { credProject = JSON.parse(fs.readFileSync(keyPath, 'utf8')).project_id || null; }
    catch (_) { /* ignore — ADC may not be a file */ }
  }

  admin.initializeApp({ projectId: project });
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;

  console.log('──────────────────────────────────────────────────────────────');
  console.log(` delete-stranded-allocation · ${mode}`);
  console.log(` Querying project : ${project}`);
  if (credProject) {
    console.log(` Creds project_id : ${credProject}` +
      (credProject !== project ? '   ⚠ DOES NOT MATCH the project named above' : '  ✓ matches'));
  }
  console.log('   ⚠  Confirm "Querying project" is PROD (agencytrack-2a610) before --apply.');
  console.log('──────────────────────────────────────────────────────────────');

  let scanned = 0; let withAllocation = 0; let deleted = 0; let skipped = 0;
  const mnSnap = await db.collectionGroup('moneyNeeds').get();
  for (const doc of mnSnap.docs) {
    scanned += 1;
    const data = doc.data() || {};
    const hasAllocation = data.allocation != null;
    if (!hasAllocation) continue;
    withAllocation += 1;

    // Path: tenants/{tid}/users/{uid}/moneyNeeds/{year}
    const parts = doc.ref.path.split('/');
    const tid = parts[1]; const uid = parts[3]; const year = parts[5];
    const ypRef = db.doc(`tenants/${tid}/users/${uid}/yearPlan/${year}`);
    const ypSnap = await ypRef.get();
    const yearPlanExists = ypSnap.exists;

    if (!shouldDeleteAllocation({ hasAllocation, yearPlanExists })) {
      skipped += 1;
      console.log(`  · skip ${doc.ref.path} — has .allocation but NO yearPlan/${year} (canonical loop data absent; left untouched)`);
      continue;
    }

    deleted += 1;
    console.log(`  ${APPLY ? '✓ delete .allocation' : '· would delete .allocation'} ${doc.ref.path} — yearPlan/${year} exists (status=${ypSnap.data().status ?? 'n/a'})`);
    if (APPLY) {
      await doc.ref.update({
        allocation: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'delete-stranded-allocation',
      });
    }
  }

  console.log('');
  console.log(` moneyNeeds docs scanned    : ${scanned}`);
  console.log(` carrying .allocation       : ${withAllocation}`);
  console.log(` ${APPLY ? 'deleted .allocation' : 'would delete .allocation'}        : ${deleted}`);
  console.log(` skipped (no yearPlan)      : ${skipped}`);
  console.log('──────────────────────────────────────────────────────────────');
  console.log(APPLY
    ? ' Done. Re-run probe-yearplan-prod-state.cjs to confirm B=0.'
    : ' DRY-RUN only — no data modified. Re-run with --apply to delete.');
  console.log('──────────────────────────────────────────────────────────────');
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('delete-stranded-allocation FAILED:', err && err.message ? err.message : err);
    process.exit(1);
  });
}
