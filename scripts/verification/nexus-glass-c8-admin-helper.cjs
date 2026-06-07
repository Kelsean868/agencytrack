/**
 * nexus-glass-c8-admin-helper.cjs
 *
 * Admin SDK helper for the C8 seeded visual leg of the Nexus Glass S3 smoke.
 *
 * Accepts line-delimited JSON ops via stdin, emits JSON responses via stdout.
 *
 * Operations:
 *   { op: 'seedPolicy', mgrEmail }
 *       Looks up the branch manager by email, extracts tenantId + branchId,
 *       creates one settled policy in June 2026 (current month/year as of
 *       2026-06-07), and returns the doc path for cleanup.
 *       Response: { ok: true, docPath, tenantId, branchId }
 *
 *   { op: 'deletePolicy', docPath }
 *       Deletes the seeded policy doc (creator-cleanup discipline).
 *       Response: { ok: true }
 *
 * Requires:
 *   functions/service-account-key.json  (gitignored; present locally only)
 *
 * Why CJS: smoke scripts are .mjs; firebase-admin in functions/node_modules is CJS.
 * The smoke spawns this helper once and round-trips JSON over stdio.
 */

const admin = require('../../functions/node_modules/firebase-admin');
const path  = require('path');

// ─── Init ─────────────────────────────────────────────────────────────────────
const keyPath = path.resolve(__dirname, '..', '..', 'functions', 'service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});
const db   = admin.firestore();
const auth = admin.auth();

// ─── Operations ──────────────────────────────────────────────────────────────

async function seedPolicy(mgrEmail) {
  // 1. Resolve uid and claims to get tenantId.
  const user = await auth.getUserByEmail(mgrEmail);
  const uid  = user.uid;
  const claims = user.customClaims ?? {};
  const tenantId = claims.tenantId;
  if (!tenantId) throw new Error(`No tenantId claim on ${mgrEmail}`);

  // 2. Get Firestore user doc for branchId.
  const userDoc = await db.doc(`tenants/${tenantId}/users/${uid}`).get();
  if (!userDoc.exists) throw new Error(`User doc not found: tenants/${tenantId}/users/${uid}`);
  const branchId = userDoc.data().branchId;
  if (!branchId) throw new Error(`No branchId on user doc for ${mgrEmail}`);

  // 3. Create the seeded policy.
  //    - status: 'settled' (triggers toReconcile in PolicyReconciliationPanel)
  //    - dateIssued: June 1 2026 (matches current month default picker)
  //    - no confirmedAt → appears in toReconcile queue → renders pending-hero
  const ref = db.collection(`tenants/${tenantId}/policies`);
  const docRef = await ref.add({
    tenantId,
    branchId,
    agentId: uid,
    ownerName:        'Seed Policy — S3 Visual (delete me)',
    insuredName:      'Test Insured',
    status:           'settled',
    settledAPI:       5000,
    proposedAPI:      5000,
    dateIssued:       admin.firestore.Timestamp.fromDate(new Date(2026, 5, 1)), // June 1 2026
    dateWritten:      admin.firestore.Timestamp.fromDate(new Date(2026, 5, 1)),
    dateSubmitted:    admin.firestore.Timestamp.fromDate(new Date(2026, 5, 1)),
    createdAt:        admin.firestore.Timestamp.now(),
    productLine:      'life',
    newBusinessType:  'nb_ordinary',
    policyClass:      'whole_life',
    proposedFrequency:'A',
    sourceOfProspect: 'referral',
    _nexusGlassS3Seed: true, // cleanup marker
  });
  return { ok: true, docPath: docRef.path, tenantId, branchId };
}

async function deletePolicy(docPath) {
  await db.doc(docPath).delete();
  return { ok: true };
}

// ─── Stdio protocol ──────────────────────────────────────────────────────────
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    let req;
    try { req = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ ok: false, error: 'JSON parse error' }) + '\n'); continue; }
    handle(req).then((res) => process.stdout.write(JSON.stringify(res) + '\n')).catch((err) => process.stdout.write(JSON.stringify({ ok: false, error: err.message ?? String(err) }) + '\n'));
  }
});
process.stdin.on('end', () => process.exit(0));

async function handle(req) {
  if (req.op === 'seedPolicy')  return seedPolicy(req.mgrEmail);
  if (req.op === 'deletePolicy') return deletePolicy(req.docPath);
  return { ok: false, error: `Unknown op: ${req.op}` };
}
