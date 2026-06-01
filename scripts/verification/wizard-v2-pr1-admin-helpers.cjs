/**
 * Track J Wizard v2 PR1 — Admin SDK helpers for the path-A smoke.
 *
 * Three helpers exposed by stdin protocol (line-delimited JSON):
 *   { op: 'resolveUid', email }      → { uid }
 *   { op: 'readSubmission', uid, weekStarting }
 *                                    → { exists, data }
 *   { op: 'deleteSubmission', uid, weekStarting, status }
 *                                    → { deletedCount }
 *       status filter ('draft' | 'submitted' | 'any')
 *
 * Operates against the production Firebase project agencytrack-2a610 via
 * the locally-available service-account-key.json. Tenant is hardcoded to
 * `tatillife_south` (the test agent's tenant; matches the PR #410 / #411
 * seed convention). No prod-write outside the test agent's own
 * submissions for the specified weekStarting.
 *
 * Why a stdin/stdout protocol: the smoke is a .mjs file; this helper is
 * .cjs so it can require('firebase-admin') from functions/node_modules.
 * The smoke spawns this script once per smoke run and round-trips JSON.
 */

const admin = require('../../functions/node_modules/firebase-admin');
const path = require('path');

// ─── Init ──────────────────────────────────────────────────────────────────
const keyPath = path.resolve(__dirname, '..', '..', 'functions', 'service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});
const db   = admin.firestore();
const auth = admin.auth();
const TENANT_ID = 'tatillife_south';

// ─── Operations ────────────────────────────────────────────────────────────
async function resolveUid(email) {
  const user = await auth.getUserByEmail(email);
  return { uid: user.uid };
}

async function readSubmission(uid, weekStarting) {
  const docId = `${uid}_${weekStarting}`;
  const ref = db.collection(`tenants/${TENANT_ID}/submissions`).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return { exists: false, data: null };
  const raw = snap.data();
  // Convert any Timestamp → ISO string so JSON.stringify is safe.
  const serializable = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === 'object' && typeof v.toDate === 'function') {
      serializable[k] = v.toDate().toISOString();
    } else {
      serializable[k] = v;
    }
  }
  return { exists: true, data: serializable };
}

async function deleteSubmission(uid, weekStarting, statusFilter = 'any') {
  const docId = `${uid}_${weekStarting}`;
  const ref = db.collection(`tenants/${TENANT_ID}/submissions`).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return { deletedCount: 0 };
  const status = snap.data().status;
  if (statusFilter !== 'any' && status !== statusFilter) {
    return { deletedCount: 0 };
  }
  await ref.delete();
  return { deletedCount: 1 };
}

// ─── Stdin protocol ────────────────────────────────────────────────────────
process.stdin.setEncoding('utf8');

let buffer = '';
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const req = JSON.parse(line);
      let res;
      switch (req.op) {
        case 'resolveUid':
          res = await resolveUid(req.email);
          break;
        case 'readSubmission':
          res = await readSubmission(req.uid, req.weekStarting);
          break;
        case 'deleteSubmission':
          res = await deleteSubmission(req.uid, req.weekStarting, req.status);
          break;
        case 'exit':
          process.exit(0);
          // eslint-disable-next-line no-unreachable
          break;
        default:
          res = { error: 'unknown op' };
      }
      process.stdout.write(JSON.stringify({ id: req.id, ok: true, res }) + '\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({
        ok: false, error: String(err?.message ?? err),
      }) + '\n');
    }
  }
});
