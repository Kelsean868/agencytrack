/**
 * E1 Schema Split Migration
 * Migrates tenants/{tenantId}/submissions from V1 (single apiSold) to
 * V2 (3-source: newBusiness / pppIncreases / lumpsums).
 *
 * USAGE
 *   # Scan + preview only (default — no writes)
 *   node scripts/migrations/2026-05-e1-schema-split.mjs --dry-run
 *
 *   # Actually migrate (irreversible without rollback)
 *   node scripts/migrations/2026-05-e1-schema-split.mjs --apply --confirm-tenant=tatillife_south
 *
 * REQUIREMENTS
 *   functions/service-account-key.json  — Firebase Admin service account
 *   firebase-admin in functions/node_modules/
 *
 * ROLLBACK
 *   The migration writes migrationMeta.sourceVersion = 1 on each doc.
 *   A compensating script can filter version === 2 AND migrationMeta.migratedBy === 'script'
 *   and restore apiSold / applicationsSold fields from the preserved originals.
 *   Originals are NOT deleted by --apply; they remain on the doc for recovery.
 *
 * OUTPUT
 *   Dry-run: prints per-tenant summary + first sample doc.
 *            Writes JSON to verification/e1-migration/dry-run-<timestamp>.json
 *   Apply:   prints per-doc progress + final summary.
 */

import { createRequire }    from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { readV1Api, readV1Apps } from '../../src/lib/schema/weeklyReport.computations.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const DRY_RUN      = !args.includes('--apply');
const APPLY        = args.includes('--apply');
const CONFIRM_FLAG = args.find((a) => a.startsWith('--confirm-tenant='));
const CONFIRM_TENANT = CONFIRM_FLAG ? CONFIRM_FLAG.split('=')[1] : null;

if (APPLY && !CONFIRM_TENANT) {
  console.error('ERROR: --apply requires --confirm-tenant=<tenantId>');
  console.error('  Example: --apply --confirm-tenant=tatillife_south');
  process.exit(1);
}

if (APPLY) {
  console.warn(`\n⚠️  APPLY MODE: will write to Firestore tenant "${CONFIRM_TENANT}"\n`);
}

// ── Firebase Admin init ───────────────────────────────────────────────────────
const require = createRequire(import.meta.url);

const KEY_PATH = resolve(ROOT, 'functions/service-account-key.json');
if (!existsSync(KEY_PATH)) {
  console.error(`ERROR: service account key not found at ${KEY_PATH}`);
  console.error('       Copy it from Firebase console → Project Settings → Service Accounts.');
  process.exit(1);
}

const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(KEY_PATH)),
  });
}
const db = admin.firestore();

// ── Migration helpers ─────────────────────────────────────────────────────────

const p = (v) => parseFloat(v) || 0;

/** Which V1 API alias is present — for alias distribution logging. */
function apiAlias(doc) {
  if (doc.apiSold    != null) return 'apiSold';
  if (doc.api        != null) return 'api';
  if (doc.annualPremium != null) return 'annualPremium';
  return 'none';
}

/** Which V1 apps alias is present — for alias distribution logging. */
function appsAlias(doc) {
  if (doc.applicationsSold != null) return 'applicationsSold';
  if (doc.appsSold         != null) return 'appsSold';
  return 'none';
}

/**
 * Transform a V1 submission doc into a V2 shape.
 * Preserves all existing fields; adds new 3-source fields + version.
 */
function transformDoc(docData, agentCommissionRate) {
  const nbApi  = readV1Api(docData);
  const nbApps = readV1Apps(docData);
  const rate   = p(agentCommissionRate) / 100;

  const newBusiness  = { apps: nbApps, api: nbApi };
  const pppIncreases = { apps: 0, apiIncrease: 0 };
  const lumpsums     = { grossAmount: 0, apiCredit: 0, commission: 0 };

  const totalProductionCredit = nbApi;
  const totalCommission       = nbApi * rate;

  return {
    // All existing fields preserved (spread first so new fields override only
    // legacy fields of the same name, not the preserved originals).
    ...docData,
    // V2 production-source fields
    version: 2,
    newBusiness,
    pppIncreases,
    lumpsums,
    totalProductionCredit,
    totalCommission,
    migrationMeta: {
      migratedAt:     new Date().toISOString(),
      migratedBy:     'script',
      sourceVersion:  1,
      // Preserve original values for rollback verification.
      original_apiSold:         docData.apiSold ?? null,
      original_applicationsSold: docData.applicationsSold ?? null,
      agentCommissionRateUsed:  agentCommissionRate ?? null,
    },
  };
}

/** Validate the V2 shape after transformation. */
function validateV2(doc) {
  const errors = [];
  if (doc.version !== 2)                           errors.push('version !== 2');
  if (typeof doc.newBusiness !== 'object')         errors.push('newBusiness missing');
  if (typeof doc.pppIncreases !== 'object')        errors.push('pppIncreases missing');
  if (typeof doc.lumpsums !== 'object')            errors.push('lumpsums missing');
  if (typeof doc.totalProductionCredit !== 'number') errors.push('totalProductionCredit not a number');
  if (typeof doc.totalCommission !== 'number')     errors.push('totalCommission not a number');
  if (doc.newBusiness.api < 0)                     errors.push('newBusiness.api is negative');
  return { valid: errors.length === 0, errors };
}

// ── Agent commission rate cache ───────────────────────────────────────────────

const rateCache = new Map();

async function getAgentRate(tenantId, agentId) {
  const key = `${tenantId}/${agentId}`;
  if (rateCache.has(key)) return rateCache.get(key);
  try {
    const snap = await db.doc(`tenants/${tenantId}/users/${agentId}`).get();
    const rate = snap.exists ? p(snap.data()?.commissionRate) : 0;
    rateCache.set(key, rate);
    return rate;
  } catch {
    rateCache.set(key, 0);
    return 0;
  }
}

// ── Per-tenant migration ──────────────────────────────────────────────────────

async function migrateTenant(tenantId) {
  console.log(`\n── Tenant: ${tenantId} ──────────────────────────`);

  const subsRef = db.collection(`tenants/${tenantId}/submissions`);
  const snap    = await subsRef.get();

  const stats = {
    total:       snap.size,
    alreadyV2:   0,
    willMigrate: 0,
    migrated:    0,
    skipped:     0,
    warnings:    [],
    sampleV2:    null,
    apiAliases:  { apiSold: 0, api: 0, annualPremium: 0, none: 0 },
    appsAliases: { applicationsSold: 0, appsSold: 0, none: 0 },
  };

  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 400;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    if (data.version === 2) {
      stats.alreadyV2++;
      continue;
    }

    // Track which V1 field-name alias is present on this doc.
    stats.apiAliases[apiAlias(data)]++;
    stats.appsAliases[appsAlias(data)]++;

    // Warn on data anomalies.
    const rawApi = data.apiSold ?? data.api ?? data.annualPremium;
    if (rawApi !== undefined && rawApi !== null && (isNaN(parseFloat(rawApi)) || parseFloat(rawApi) < 0)) {
      stats.warnings.push(`${docSnap.id}: non-numeric or negative apiSold (${rawApi})`);
    }
    if (!data.weekStarting) {
      stats.warnings.push(`${docSnap.id}: missing weekStarting`);
    }

    const agentId = data.agentId || data.userId;
    if (!agentId) {
      stats.warnings.push(`${docSnap.id}: missing agentId — commission will be 0`);
    }

    const agentRate = agentId ? await getAgentRate(tenantId, agentId) : 0;
    if (agentId && agentRate === 0) {
      stats.warnings.push(`${docSnap.id}: agent ${agentId} not found or commissionRate=0`);
    }

    const transformed = transformDoc(data, agentRate);
    const validation  = validateV2(transformed);

    if (!validation.valid) {
      stats.warnings.push(`${docSnap.id}: post-transform validation failed: ${validation.errors.join(', ')}`);
      stats.skipped++;
      continue;
    }

    stats.willMigrate++;

    if (stats.sampleV2 === null) {
      // Record first sample (redact agentId for logs).
      stats.sampleV2 = { ...transformed, agentId: '[redacted]', userId: '[redacted]' };
    }

    if (APPLY) {
      batch.set(subsRef.doc(docSnap.id), transformed);
      batchCount++;

      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        stats.migrated += batchCount;
        batchCount = 0;
        console.log(`  committed ${stats.migrated} docs so far…`);
      }
    }
  }

  if (APPLY && batchCount > 0) {
    await batch.commit();
    stats.migrated += batchCount;
  }

  // ── Print summary ──
  console.log(`  Total submissions:    ${stats.total}`);
  console.log(`  Already V2 (skip):    ${stats.alreadyV2}`);
  console.log(`  Will migrate:         ${stats.willMigrate}`);
  if (APPLY) {
    console.log(`  Migrated:             ${stats.migrated}`);
  }
  if (stats.skipped > 0) {
    console.log(`  Skipped (bad data):   ${stats.skipped}`);
  }
  if (stats.warnings.length > 0) {
    console.log(`  Warnings (${stats.warnings.length}):`);
    stats.warnings.forEach((w) => console.log(`    ⚠ ${w}`));
  }

  // Alias distribution — confirms which V1 field names are actually in Firestore.
  const aa = stats.apiAliases;
  const pa = stats.appsAliases;
  console.log(`  API alias dist:  apiSold=${aa.apiSold} api=${aa.api} annualPremium=${aa.annualPremium} none=${aa.none}`);
  console.log(`  Apps alias dist: applicationsSold=${pa.applicationsSold} appsSold=${pa.appsSold} none=${pa.none}`);

  if (stats.sampleV2) {
    console.log('\n  Sample V2 doc (first doc to migrate):');
    console.log(JSON.stringify(stats.sampleV2, null, 2).split('\n').map((l) => '    ' + l).join('\n'));
  }

  return stats;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nE1 Schema Split Migration — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));

  // Determine tenants to process.
  let tenantIds = [];
  if (APPLY) {
    tenantIds = [CONFIRM_TENANT];
  } else {
    // Dry-run: scan all tenants.
    const tenantsSnap = await db.collection('tenants').listDocuments();
    tenantIds = tenantsSnap.map((d) => d.id);
    if (tenantIds.length === 0) {
      console.log('No tenants found. Verify Firestore connection and credentials.');
      process.exit(0);
    }
    console.log(`Found ${tenantIds.length} tenant(s): ${tenantIds.join(', ')}`);
  }

  const allStats = {};
  for (const tid of tenantIds) {
    allStats[tid] = await migrateTenant(tid);
  }

  // ── Write dry-run output file ──
  if (DRY_RUN) {
    const ARTIFACTS_DIR = resolve(ROOT, 'verification/e1-migration');
    if (!existsSync(ARTIFACTS_DIR)) mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = resolve(ARTIFACTS_DIR, `dry-run-${ts}.json`);
    writeFileSync(outPath, JSON.stringify({ mode: 'dry-run', ts, tenants: allStats }, null, 2));
    console.log(`\nDry-run output written to: ${outPath}`);
  }

  // ── Grand total ──
  const grandTotal  = Object.values(allStats).reduce((s, t) => s + t.total,       0);
  const grandMigrate = Object.values(allStats).reduce((s, t) => s + t.willMigrate, 0);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Grand total: ${grandTotal} submissions, ${grandMigrate} to migrate`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
