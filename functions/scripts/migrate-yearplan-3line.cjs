#!/usr/bin/env node
/**
 * migrate-yearplan-3line.cjs — PR-U1 (Direction 1.5) operator migration.
 *
 * Migrates production yearPlan data to the canonical 3-line taxonomy
 * (`['life','ah','general']`) introduced by PR-U1. Two arms:
 *
 *   ARM A — fold every 4-key `yearPlan/{year}` doc (carrying `property`/`motor`
 *           lines) to 3-key: `general` absorbs `property`+`motor`. Carries
 *           `life`/`ah` unchanged; preserves `status`. **Award-neutral**
 *           (only the Life line drives award tiers; property+motor were
 *           award-neutral and general is award-neutral) and **total-preserving**
 *           (Σ enabled `targetAPI` is byte-identical before/after — the fold
 *           sums only the ENABLED property/motor contributions, and `general`
 *           is enabled iff either source line was).
 *
 *   ARM B — seed `yearPlan` from any stranded `moneyNeeds/{year}.allocation`
 *           doc (commission-canonical) via the same shape mapping the live
 *           merged surface uses (`allocationToYearPlan`). Seeds ONLY when NO
 *           `yearPlan/{year}` doc exists for that agent (Arm A owns existing
 *           docs; never clobbers a committed plan).
 *
 * IDEMPOTENT: Arm A skips docs already 3-key; Arm B skips agents that already
 * have a yearPlan doc. Safe to re-run.
 *
 * DRY-RUN by default — pass `--apply` to write. Per-doc log either way.
 *
 *   node functions/scripts/migrate-yearplan-3line.cjs            # dry-run
 *   node functions/scripts/migrate-yearplan-3line.cjs --apply    # write
 *
 * Operator-run with admin creds (service-account-key.json), post-merge,
 * pre-cutover (human/deploy-class — CC never runs the apply path).
 *
 * ── RUN ORDER (SAFETY-CRITICAL) ──────────────────────────────────────────────
 * Run this AFTER PR-U1 (#744) is merged. The merge repoints the live merged
 * surface to write `yearPlan` directly; only then is this a history cleanup
 * rather than a writer racing live agents.
 *
 *   - If `VITE_MONEY_NEEDS_MERGED_ENABLED` is/was ON in prod, the old code path
 *     was writing `moneyNeeds.allocation` for live agents. Migrating WHILE that
 *     writer is still live (i.e. before merge) re-creates the exact stranding
 *     this fixes: an agent who allocates between `--apply` and the merge lands
 *     a fresh `.allocation` with no `yearPlan`. So: merge first (preferred), or
 *     flip the flag OFF first.
 *   - Merge-first is structurally safe regardless of the flag: post-merge the
 *     live writer creates a `yearPlan` doc, and ARM B SKIPS any agent that has a
 *     `yearPlan` doc — so it cannot re-strand a live allocator. It only seeds
 *     agents who never got a `yearPlan` doc (true stranded history).
 *   - If the flag is currently OFF, the `.allocation` docs are static history
 *     and there is no race; run whenever (merge-first still cleaner).
 *
 * ── ROLLBACK ─────────────────────────────────────────────────────────────────
 * ARM A is LOSSY in one direction: once `property`+`motor` fold into `general`,
 * the per-line split is NOT recoverable from the 3-key doc (it is deliberately
 * collapsed — Direction 1.5). The dry-run per-doc log is the backstop; for
 * belt-and-suspenders on committed money data, export the affected `yearPlan`
 * docs (or take a Firestore backup) BEFORE `--apply`. ARM A is total-preserving
 * and award-neutral, so a forward re-run is safe; reversing a fold is not.
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// Pure transforms — no firebase, exported for tests (functions/__tests__).
// ─────────────────────────────────────────────────────────────────────────────

const LINE_KEYS_3 = ['life', 'ah', 'general'];
const PRODUCT_LINE_KEYS = ['life', 'general'];
const num = (v) => parseFloat(v) || 0;
const isEnabled = (line) => !line || line.enabled !== false;

// Bring a folded/seeded line to the canonical 3-line shape (additive rate/products).
function normLine(line, key) {
  return {
    targetAPI: num(line.targetAPI),
    pct: num(line.pct),
    derivedApps: num(line.derivedApps),
    derivedCommission: num(line.derivedCommission),
    enabled: line.enabled !== false,
    rate: num(line.rate),
    products: PRODUCT_LINE_KEYS.includes(key) && Array.isArray(line.products)
      ? line.products.slice(0, 4).map((p) => ({ name: typeof p.name === 'string' ? p.name : '', api: num(p.api), rate: num(p.rate) }))
      : [],
  };
}

/**
 * ARM A — fold a 4-key yearPlan `lines` map to 3-key. Returns
 * { lines, changed }. `changed` is false (and `lines` returned unchanged) when
 * the doc is already 3-key — the idempotency guard.
 *
 * Total-preservation: `general.targetAPI` sums only ENABLED property/motor
 * targetAPI, and `general.enabled` is true iff either source was enabled, so
 * Σ(enabled targetAPI) is identical pre/post. Cosmetic fields (pct/derivedApps/
 * derivedCommission) sum the same enabled contributions.
 */
function foldYearPlanLinesTo3Key(lines) {
  if (!lines || typeof lines !== 'object') return { lines, changed: false };
  if (!('property' in lines) && !('motor' in lines)) return { lines, changed: false };

  const life = lines.life ?? { targetAPI: 0, enabled: true };
  const ah = lines.ah ?? { targetAPI: 0, enabled: true };
  const property = lines.property ?? {};
  const motor = lines.motor ?? {};
  const priorGeneral = lines.general ?? {};

  // Enabled-aware contribution: a disabled source adds nothing to the total.
  const contrib = (line, field) => (isEnabled(line) ? num(line[field]) : 0);
  const generalEnabled = isEnabled(property) || isEnabled(motor)
    || (lines.general !== undefined && priorGeneral.enabled !== false);

  const general = {
    targetAPI: contrib(priorGeneral, 'targetAPI') + contrib(property, 'targetAPI') + contrib(motor, 'targetAPI'),
    pct: contrib(priorGeneral, 'pct') + contrib(property, 'pct') + contrib(motor, 'pct'),
    derivedApps: contrib(priorGeneral, 'derivedApps') + contrib(property, 'derivedApps') + contrib(motor, 'derivedApps'),
    derivedCommission: contrib(priorGeneral, 'derivedCommission') + contrib(property, 'derivedCommission') + contrib(motor, 'derivedCommission'),
    enabled: generalEnabled,
    rate: num(priorGeneral.rate),
    products: Array.isArray(priorGeneral.products) ? priorGeneral.products : [],
  };

  return {
    lines: {
      life: normLine(life, 'life'),
      ah: normLine(ah, 'ah'),
      general: normLine(general, 'general'),
    },
    changed: true,
  };
}

// ── ARM B — commission-canonical allocation → yearPlan lines (mirrors the live
// `allocationToYearPlan` adapter in src/lib/moneyNeedsAllocation.js; reimplemented
// here because the operator script is CJS and self-contained). Drift is guarded
// by functions/__tests__/migrate-yearplan-3line.test.js. ──────────────────────
const ALLOC_GATING = {
  composite: { life: true, ah: true, general: true },
  life_only: { life: true, ah: true, general: false },
  general_only: { life: false, ah: true, general: true },
};
const visibleKeys = (lc) => {
  const g = ALLOC_GATING[lc] ?? ALLOC_GATING.composite;
  return LINE_KEYS_3.filter((k) => g[k]);
};
const allocIsDrilled = (line) => !!line?.drilled && Array.isArray(line?.products) && line.products.length > 0;
const allocProductAPI = (p) => { const r = num(p?.rate); return r > 0 ? num(p?.commission) / r : 0; };
const allocLineCommission = (line) => (allocIsDrilled(line)
  ? line.products.reduce((s, p) => s + num(p.commission), 0)
  : num(line?.commission));
const allocLineAPI = (line) => {
  if (allocIsDrilled(line)) return line.products.reduce((s, p) => s + allocProductAPI(p), 0);
  const r = num(line?.rate);
  return r > 0 ? num(line?.commission) / r : 0;
};
const allocEffRate = (line) => {
  if (allocIsDrilled(line)) { const api = allocLineAPI(line); return api > 0 ? allocLineCommission(line) / api : 0; }
  return num(line?.rate);
};
const allocApps = (api) => (api > 0 ? Math.round(api / 12000) : 0);

function allocationToYearPlanLines(allocation) {
  const lc = ALLOC_GATING[allocation?.licenseClass] ? allocation.licenseClass : 'composite';
  const visible = new Set(visibleKeys(lc));
  const lines = {};
  for (const key of LINE_KEYS_3) {
    const line = allocation?.lines?.[key] ?? {};
    const enabled = visible.has(key);
    const api = enabled ? allocLineAPI(line) : 0;
    const commission = enabled ? allocLineCommission(line) : 0;
    const drilled = enabled && allocIsDrilled(line);
    const products = drilled
      ? line.products.slice(0, 4).map((p) => ({ name: p.name ?? '', api: allocProductAPI(p), rate: num(p.rate) }))
      : [];
    lines[key] = normLine({
      targetAPI: api,
      pct: 0,
      derivedApps: allocApps(api),
      derivedCommission: commission,
      enabled,
      rate: allocEffRate(line),
      products,
    }, key);
  }
  const totalAPI = LINE_KEYS_3.reduce((s, k) => s + (lines[k].enabled ? lines[k].targetAPI : 0), 0);
  if (totalAPI > 0) {
    for (const k of LINE_KEYS_3) {
      if (lines[k].enabled) lines[k].pct = parseFloat(((lines[k].targetAPI / totalAPI) * 100).toFixed(2));
    }
  }
  return lines;
}

const sumEnabledTargetAPI = (lines) => LINE_KEYS_3
  .concat(['property', 'motor'])
  .reduce((s, k) => { const l = lines?.[k]; return s + (l && isEnabled(l) ? num(l.targetAPI) : 0); }, 0);

module.exports = {
  foldYearPlanLinesTo3Key,
  allocationToYearPlanLines,
  sumEnabledTargetAPI,
  normLine,
};

// ─────────────────────────────────────────────────────────────────────────────
// Operator entrypoint (firebase-admin) — guarded so tests can require the pure
// transforms above without initializing the Admin SDK.
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const APPLY = process.argv.includes('--apply');
  const mode = APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)';

  const isEmulator = !!(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (isEmulator) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610' });
  } else {
    const keyPath = path.join(__dirname, '..', 'service-account-key.json');
    if (!fs.existsSync(keyPath)) {
      console.error('[migrate-yearplan-3line] Missing service-account-key.json at', keyPath);
      process.exit(1);
    }
    admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
  }
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;

  console.log(`\n=== migrate-yearplan-3line · ${mode} ===\n`);

  // ── ARM A — fold 4-key yearPlan docs → 3-key ───────────────────────────────
  console.log('— ARM A: fold 4-key yearPlan → 3-key —');
  const yearPlanSnap = await db.collectionGroup('yearPlan').get();
  let aScanned = 0; let aMigrated = 0; let aSkipped = 0;
  for (const doc of yearPlanSnap.docs) {
    aScanned += 1;
    const data = doc.data();
    const { lines: folded, changed } = foldYearPlanLinesTo3Key(data.lines);
    if (!changed) { aSkipped += 1; continue; }

    const before = sumEnabledTargetAPI(data.lines);
    const after = sumEnabledTargetAPI(folded);
    const preserved = Math.abs(before - after) < 0.0001;
    if (!preserved) {
      console.error(`  ✗ TOTAL MISMATCH ${doc.ref.path} — before=${before} after=${after} (SKIPPING, not total-preserving)`);
      aSkipped += 1;
      continue;
    }
    aMigrated += 1;
    console.log(`  ${APPLY ? '✓ migrate' : '· would migrate'} ${doc.ref.path} — status=${data.status ?? 'n/a'} · ΣtargetAPI ${before} (preserved)`);
    if (APPLY) {
      await doc.ref.update({ lines: folded, lineTaxonomy: '3line', updatedAt: FieldValue.serverTimestamp(), updatedBy: 'migrate-yearplan-3line' });
    }
  }
  console.log(`  ARM A: scanned ${aScanned} · ${APPLY ? 'migrated' : 'would migrate'} ${aMigrated} · skipped ${aSkipped} (already 3-key / preserved-fail)\n`);

  // ── ARM B — seed yearPlan from stranded moneyNeeds.allocation ───────────────
  console.log('— ARM B: seed stranded moneyNeeds.allocation → yearPlan —');
  const mnSnap = await db.collectionGroup('moneyNeeds').get();
  let bScanned = 0; let bSeeded = 0; let bSkipped = 0;
  for (const doc of mnSnap.docs) {
    const data = doc.data();
    if (!data.allocation || typeof data.allocation !== 'object') continue;
    bScanned += 1;

    // Path: tenants/{tid}/users/{uid}/moneyNeeds/{year}
    const parts = doc.ref.path.split('/');
    const tid = parts[1]; const uid = parts[3]; const year = parts[5];
    const ypRef = db.doc(`tenants/${tid}/users/${uid}/yearPlan/${year}`);
    const ypSnap = await ypRef.get();
    if (ypSnap.exists) {
      // Arm A owns existing docs; never clobber (incl. committed).
      bSkipped += 1;
      console.log(`  · skip ${doc.ref.path} — yearPlan already exists (status=${ypSnap.data().status ?? 'n/a'})`);
      continue;
    }

    const lines = allocationToYearPlanLines(data.allocation);
    const total = sumEnabledTargetAPI(lines);
    bSeeded += 1;
    console.log(`  ${APPLY ? '✓ seed' : '· would seed'} ${ypRef.path} — from .allocation · ΣtargetAPI ${total}`);
    if (APPLY) {
      await ypRef.set({
        year: parseInt(year, 10),
        tenantId: tid,
        uid,
        licenseProfile: ALLOC_GATING[data.allocation.licenseClass] ? data.allocation.licenseClass : 'composite',
        status: 'draft',
        lines,
        lineTaxonomy: '3line',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'migrate-yearplan-3line',
      });
    }
  }
  console.log(`  ARM B: scanned ${bScanned} .allocation docs · ${APPLY ? 'seeded' : 'would seed'} ${bSeeded} · skipped ${bSkipped} (yearPlan exists)\n`);

  console.log(`=== done (${mode}) ===`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => { console.error('[migrate-yearplan-3line] FAILED:', err); process.exit(1); });
}
