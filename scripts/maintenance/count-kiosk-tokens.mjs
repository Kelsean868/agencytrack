/**
 * count-kiosk-tokens.mjs — READ-ONLY. Writes nothing, ever.
 *
 * P2e (audit 2026-09-24 SEC-04): how many kiosk links exist and what state each
 * is in, per tenant and branch. Run it before and after the P2e functions deploy.
 *
 *   live      not revoked, expiresAt in the future — the URL works today
 *   expired   expiresAt passed (or missing — SEC-03 treats that as expired)
 *   revoked   a manager revoked it
 *   paired    live and bound to a device (P2e) — only that screen can use it
 *   unpaired  live, not bound yet — the NEXT device to open it takes it
 *   rolling   minted since P2e; renewed to +90 days on every use
 *   legacy    minted before P2e; keeps its original expiry, then needs a new link
 *
 * The code path has no cap: createKioskToken mints a new token on every call and
 * only expiry or revoke retires one. So "live" can grow without bound — watch the
 * unpaired count in particular (a live, unpaired link is a spare bearer credential).
 *
 * Pattern: scripts/maintenance/p2c-financing-dryrun.mjs (Admin SDK from
 * functions/node_modules, ambient credentials, never a key file).
 *
 * Usage:
 *   node scripts/maintenance/count-kiosk-tokens.mjs                  # every tenant
 *   node scripts/maintenance/count-kiosk-tokens.mjs --tenant <tenantId>
 */

import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

function toDate(v) {
  if (!v) return null;
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** One token doc → its buckets. Pure. */
export function classifyToken(data, now) {
  const revoked = Boolean(data?.revokedAt);
  const expiry = toDate(data?.expiresAt);
  const expired = !revoked && (!expiry || expiry < now);
  const live = !revoked && !expired;
  return {
    live,
    expired,
    revoked,
    paired: live && Boolean(data?.deviceSecretHash),
    unpaired: live && !data?.deviceSecretHash,
    rolling: live && data?.rolling === true,
    legacy: live && data?.rolling !== true,
  };
}

const BUCKETS = ['live', 'expired', 'revoked', 'paired', 'unpaired', 'rolling', 'legacy'];

/** [{ tenantId, data }] → { total, byScope: { 'tenant / branch': counts } }. Pure. */
export function summarize(tokens, now) {
  const empty = () => Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  const total = { ...empty(), all: 0 };
  const byScope = {};
  for (const { tenantId, data } of tokens) {
    const scope = `${tenantId} / ${data?.branchId ?? '(no branch)'}`;
    byScope[scope] ??= { ...empty(), all: 0 };
    const c = classifyToken(data, now);
    for (const b of BUCKETS) {
      if (c[b]) { total[b] += 1; byScope[scope][b] += 1; }
    }
    total.all += 1;
    byScope[scope].all += 1;
  }
  return { total, byScope };
}

export function formatSummary({ total, byScope }) {
  const row = (label, c) =>
    `${label.padEnd(40)} all ${String(c.all).padStart(3)} · live ${String(c.live).padStart(3)}`
    + ` (paired ${c.paired}, unpaired ${c.unpaired}; rolling ${c.rolling}, legacy ${c.legacy})`
    + ` · expired ${c.expired} · revoked ${c.revoked}`;
  const lines = ['Kiosk tokens (read-only)', ''];
  for (const scope of Object.keys(byScope).sort()) lines.push(row(scope, byScope[scope]));
  lines.push('', row('TOTAL', total));
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
    return 2;
  }

  const require = createRequire(import.meta.url);
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const admin = require(path.join(HERE, '../../functions/node_modules/firebase-admin'));
  admin.initializeApp(); // ambient credentials, never a key file
  const db = admin.firestore();

  const snap = opts.tenant
    ? await db.collection(`tenants/${opts.tenant}/kioskTokens`).get()
    : await db.collectionGroup('kioskTokens').get();
  // The tenant is the path segment after `tenants/`, not the stored field — a
  // mismatch between the two is itself worth seeing.
  const tokens = snap.docs.map((d) => ({ tenantId: d.ref.path.split('/')[1], data: d.data() }));

  console.log(formatSummary(summarize(tokens, new Date())));
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
