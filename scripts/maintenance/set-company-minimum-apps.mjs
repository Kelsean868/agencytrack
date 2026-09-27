/**
 * set-company-minimum-apps.mjs — DRY RUN by default. `--apply` writes.
 *
 * Kyron ruling, 27 Sep 2026: Tatil's company minimum is the six tenure API
 * bands (confirmed, no longer provisional) AND 40 applications a year in every
 * band. Production held `annualApps: 42`, the career-level L1 figure.
 *
 * On tenants/{tenant}/config/companyMinimums this sets exactly:
 *   annualApps                  → 40
 *   tenureApiFloorsProvisional  → false
 *   updatedBy / updatedAt       → seed sentinel + server timestamp
 * No other key is touched (Firestore `update`, not a whole-doc write). A
 * missing doc is refused rather than created — a wrong --tenant must not
 * silently mint a new config doc. Already at 40 / false → no-op, no write.
 *
 * Pattern: scripts/maintenance/count-kiosk-tokens.mjs (Admin SDK from
 * functions/node_modules, ambient credentials, never a key file).
 *
 * Usage:
 *   node scripts/maintenance/set-company-minimum-apps.mjs --tenant <tenantId>          # dry run
 *   node scripts/maintenance/set-company-minimum-apps.mjs --tenant <tenantId> --apply  # write
 */

import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

export const COMPANY_MIN_APPS = 40;
export const UPDATED_BY = 'seed:company-minimum-apps-2026-09-27';
// The only keys this script ever writes. Tests assert nothing else changes.
export const TARGET = Object.freeze({
  annualApps: COMPANY_MIN_APPS,
  tenureApiFloorsProvisional: false,
});

export function parseArgs(argv) {
  const out = { tenant: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--tenant') out.tenant = argv[++i] ?? null;
    else if (a.startsWith('--tenant=')) out.tenant = a.slice('--tenant='.length);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!out.tenant || out.tenant.startsWith('--')) {
    throw new Error('--tenant <tenantId> is required');
  }
  return out;
}

/** Keys of TARGET whose stored value differs from the target. Pure. */
export function pendingChanges(before) {
  return Object.keys(TARGET).filter((k) => before?.[k] !== TARGET[k]);
}

function show(v) {
  if (v === undefined) return '(absent)';
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
  return JSON.stringify(v);
}

/** "key: before → after" lines for the target keys and the stamp. Pure. */
export function formatDiff(before, after) {
  return [...Object.keys(TARGET), 'updatedBy', 'updatedAt']
    .map((k) => `  ${k.padEnd(28)} ${show(before?.[k])} → ${show(after?.[k])}`)
    .join('\n');
}

/**
 * Reads the doc, prints before → after, writes only with `apply`.
 * `db` is a Firestore-like handle (Admin SDK in production, a fake in tests);
 * `serverTimestamp` is the FieldValue sentinel factory.
 * Returns { status: 'missing' | 'noop' | 'dry-run' | 'applied', before, after }.
 */
export async function run({ db, tenant, apply, serverTimestamp, log = console.log }) {
  const docPath = `tenants/${tenant}/config/companyMinimums`;
  const ref = db.doc(docPath);
  log(`set-company-minimum-apps  target=${docPath}  mode=${apply ? 'APPLY' : 'DRY RUN'}`);

  const snap = await ref.get();
  if (!snap.exists) {
    log(`No doc at ${docPath}. Refusing to create one — check --tenant.`);
    return { status: 'missing', before: null, after: null };
  }
  const before = snap.data();
  const changes = pendingChanges(before);
  if (changes.length === 0) {
    log(`Already annualApps=${COMPANY_MIN_APPS}, tenureApiFloorsProvisional=false. Nothing to write.`);
    return { status: 'noop', before, after: before };
  }

  const payload = { ...TARGET, updatedBy: UPDATED_BY, updatedAt: serverTimestamp() };
  if (!apply) {
    log('Planned (before → after):');
    log(formatDiff(before, { ...before, ...TARGET, updatedBy: UPDATED_BY, updatedAt: '(server timestamp)' }));
    log('Dry run — no writes made. Re-run with --apply to write.');
    return { status: 'dry-run', before, after: before };
  }

  await ref.update(payload);
  const after = (await ref.get()).data();
  log('Written (before → after):');
  log(formatDiff(before, after));
  const bad = pendingChanges(after);
  if (bad.length) throw new Error(`verification failed — still differs: ${bad.join(', ')}`);
  return { status: 'applied', before, after };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error('Usage: node scripts/maintenance/set-company-minimum-apps.mjs --tenant <tenantId> [--apply]');
    return 2;
  }

  const require = createRequire(import.meta.url);
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const admin = require(path.join(HERE, '../../functions/node_modules/firebase-admin'));
  admin.initializeApp(); // ambient credentials, never a key file
  console.log(`project: ${admin.app().options.projectId ?? '(ambient default project)'}`);

  const { status } = await run({
    db: admin.firestore(),
    tenant: opts.tenant,
    apply: opts.apply,
    serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
  });
  return status === 'missing' ? 1 : 0;
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
