/**
 * Synthetic Weekly Reports Seeder
 * Generates realistic V1-shape weekly reports for tatillife_south.
 * Run migration script afterward to test V1→V2 transform in a real tenant.
 *
 * USAGE
 *   # Preview only (default — no writes)
 *   node scripts/seed/synthetic-weekly-reports.mjs
 *
 *   # Write to Firestore
 *   node scripts/seed/synthetic-weekly-reports.mjs --apply --confirm-tenant=tatillife_south
 *
 * REQUIREMENTS
 *   functions/service-account-key.json
 *   firebase-admin in functions/node_modules/
 *
 * DATA SHAPE
 *   Generates 40 V1 reports (5 agents × 8 weeks) seeded with realistic
 *   Trinidad insurance production figures (TTD). Mix: 60% average, 25%
 *   strong, 15% slow weeks. All reports use V1 flat schema (apiSold) so
 *   the E1 migration script can be validated against them.
 *
 * AGENT IDs
 *   Uses synthetic IDs by default (synth-agent-001 → synth-agent-005).
 *   To use real test users, pass --agent-ids=uid1,uid2,uid3,uid4,uid5
 */

import { createRequire }    from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { existsSync }       from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const DRY_RUN      = !args.includes('--apply');
const CONFIRM_FLAG = args.find((a) => a.startsWith('--confirm-tenant='));
const CONFIRM_TENANT = CONFIRM_FLAG ? CONFIRM_FLAG.split('=')[1] : null;
const AGENT_FLAG   = args.find((a) => a.startsWith('--agent-ids='));

if (args.includes('--apply') && !CONFIRM_TENANT) {
  console.error('ERROR: --apply requires --confirm-tenant=<tenantId>');
  process.exit(1);
}

// ── Pseudo-random helpers (deterministic seeded RNG) ──────────────────────────

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0xdeadbeef);

function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randBool(prob = 0.5) {
  return rng() < prob;
}

// Round to nearest 100 (currency realism).
function roundCurrency(v) {
  return Math.round(v / 100) * 100;
}

// ── Week generation ───────────────────────────────────────────────────────────

// Generate Sunday dates starting 2026-03-01 forward.
function getSundayDates(count, startStr = '2026-03-01') {
  const dates = [];
  const start = new Date(startStr + 'T00:00:00.000Z');
  // Advance to the nearest Sunday on or after start.
  const day = start.getUTCDay(); // 0 = Sunday
  if (day !== 0) start.setUTCDate(start.getUTCDate() + (7 - day));
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * 7);
    dates.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
  }
  return dates;
}

// ── Report generators ─────────────────────────────────────────────────────────

function makeStrongWeek(agentId, agentName, weekStarting, tenantId) {
  const apps   = randInt(2, 5);
  const apiSold = roundCurrency(randInt(15000, 30000));
  const hasPPP  = randBool(0.3);
  const hasLMPS = randBool(0.2);
  return buildReport(agentId, agentName, weekStarting, tenantId, {
    apps, apiSold, hasPPP, hasLMPS,
    calls: randInt(70, 100), ffis: randInt(3, 5), cis: randInt(2, 3),
  });
}

function makeAverageWeek(agentId, agentName, weekStarting, tenantId) {
  const apps   = randInt(1, 3);
  const apiSold = roundCurrency(randInt(5000, 15000));
  return buildReport(agentId, agentName, weekStarting, tenantId, {
    apps, apiSold, hasPPP: false, hasLMPS: false,
    calls: randInt(40, 70), ffis: randInt(1, 3), cis: randInt(1, 2),
  });
}

function makeSlowWeek(agentId, agentName, weekStarting, tenantId) {
  const apps   = randBool(0.4) ? 1 : 0;
  const apiSold = apps ? roundCurrency(randInt(2000, 5000)) : 0;
  return buildReport(agentId, agentName, weekStarting, tenantId, {
    apps, apiSold, hasPPP: false, hasLMPS: false,
    calls: randInt(20, 40), ffis: randInt(0, 1), cis: 0,
  });
}

function buildReport(agentId, agentName, weekStarting, tenantId, opts) {
  const { apps, apiSold, hasPPP, hasLMPS, calls, ffis, cis } = opts;

  const pppApiIncrease = hasPPP ? roundCurrency(randInt(2400, 8000)) : 0;
  const lmpsGross      = hasLMPS ? roundCurrency(randInt(10000, 50000)) : 0;

  // V1 flat shape — apiSold is the single production number.
  // (PPP and LMPS are not recorded in V1 — that is the point of E1.)
  return {
    // Identity
    agentId,
    userId: agentId,
    agentName,
    tenantId,
    weekStarting,
    status: 'submitted',

    // Step 4 — Production (V1 flat — only NB captured)
    applicationsSold:     apps,
    livesSold:            apps,
    ciConducted:          cis,
    apiSold:              apiSold,
    estimatedCommissions: roundCurrency(apiSold * 0.35),

    // Prospecting activity
    referralCalls:        randInt(5, 20),
    coldCalls:            Math.max(0, calls - randInt(5, 20) - ffis - cis),
    followUpCalls:        randInt(3, 10),
    qualifiedApproaches:  randInt(ffis + 1, ffis + 5),
    ffisScheduled:        ffis + randInt(0, 2),
    ffiConducted:         ffis,
    solutionPresentations: Math.max(0, cis - 1),
    newCIBooked:          cis,
    oldCIBooked:          0,

    // Activity totals
    officeHours:  randInt(10, 20),
    fieldHours:   randInt(20, 35),

    // Self evaluation
    ratingPlanning:          randInt(3, 5),
    ratingTimeManagement:    randInt(3, 5),
    ratingSalesPerformance:  randInt(3, 5),
    ratingProspecting:       randInt(3, 5),
    ratingOverall:           randInt(3, 5),

    // Next-week goals
    targetAPI:      roundCurrency(apiSold * 1.1),
    targetAppsSold: Math.max(apps, 2),

    // Metadata
    submittedAt: new Date(weekStarting + 'T17:00:00.000Z').toISOString(),
    updatedAt:   new Date(weekStarting + 'T17:00:00.000Z').toISOString(),

    // Note: PPP ($pppApiIncrease) and LMPS ($lmpsGross) exist in reality
    // this week but are NOT recorded in V1. That's the gap E1 closes.
    _synthetic: true,
    _syntheticMeta: {
      weekType:        hasPPP || hasLMPS ? 'strong' : (apps >= 2 ? 'average' : 'slow'),
      unrecodedPPP:    pppApiIncrease,
      unrecodedLMPS:   lmpsGross,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const TENANT_ID  = CONFIRM_TENANT || 'tatillife_south';
  const WEEKS      = 8;
  const WEEK_DATES = getSundayDates(WEEKS);

  // Synthetic agent roster.
  let AGENTS;
  if (AGENT_FLAG) {
    const ids = AGENT_FLAG.split('=')[1].split(',');
    AGENTS = ids.map((id, i) => ({ id, name: `Agent ${i + 1}` }));
  } else {
    AGENTS = [
      { id: 'synth-agent-001', name: 'Asha Ramkissoon' },
      { id: 'synth-agent-002', name: 'Marcus Phillip' },
      { id: 'synth-agent-003', name: 'Priya Maharaj' },
      { id: 'synth-agent-004', name: 'Devon Charles' },
      { id: 'synth-agent-005', name: 'Kezia Mohammed' },
    ];
  }

  // Generate reports.
  const reports = [];
  for (const agent of AGENTS) {
    for (let w = 0; w < WEEKS; w++) {
      const roll = rng();
      let report;
      if (roll < 0.25) {
        report = makeStrongWeek(agent.id, agent.name, WEEK_DATES[w], TENANT_ID);
      } else if (roll < 0.85) {
        report = makeAverageWeek(agent.id, agent.name, WEEK_DATES[w], TENANT_ID);
      } else {
        report = makeSlowWeek(agent.id, agent.name, WEEK_DATES[w], TENANT_ID);
      }
      reports.push({ agent, weekStarting: WEEK_DATES[w], report });
    }
  }

  console.log(`\nSynthetic Weekly Reports Seeder — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Tenant:  ${TENANT_ID}`);
  console.log(`Agents:  ${AGENTS.length} (${AGENTS.map((a) => a.name).join(', ')})`);
  console.log(`Weeks:   ${WEEKS} (${WEEK_DATES[0]} → ${WEEK_DATES[WEEKS - 1]})`);
  console.log(`Reports: ${reports.length}`);

  // Distribution summary.
  const strong  = reports.filter((r) => r.report._syntheticMeta?.weekType === 'strong').length;
  const slow    = reports.filter((r) => r.report._syntheticMeta?.weekType === 'slow').length;
  const average = reports.length - strong - slow;
  console.log(`Mix:     ${strong} strong / ${average} average / ${slow} slow`);

  // Sample doc.
  const sample = reports[0].report;
  console.log('\nSample report (first doc):');
  console.log(JSON.stringify({ ...sample, agentId: '[redacted]', userId: '[redacted]' }, null, 2)
    .split('\n').map((l) => '  ' + l).join('\n'));

  if (DRY_RUN) {
    console.log('\n(Dry run — no writes. Add --apply --confirm-tenant=<id> to seed.)');
    process.exit(0);
  }

  // ── Firestore write ──
  const KEY_PATH = resolve(ROOT, 'functions/service-account-key.json');
  if (!existsSync(KEY_PATH)) {
    console.error(`ERROR: service account key not found at ${KEY_PATH}`);
    process.exit(1);
  }

  const require = createRequire(import.meta.url);
  const admin   = require('../../functions/node_modules/firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
  }
  const db = admin.firestore();

  let written = 0;
  const batchSize = 400;

  for (let i = 0; i < reports.length; i += batchSize) {
    const batch = db.batch();
    const chunk = reports.slice(i, i + batchSize);
    for (const { agent, weekStarting, report } of chunk) {
      const docId = `${agent.id}_${weekStarting}`;
      batch.set(
        db.collection(`tenants/${TENANT_ID}/submissions`).doc(docId),
        report,
      );
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  Written ${written}/${reports.length}…`);
  }

  console.log(`\n✓ ${written} synthetic V1 reports written to tenants/${TENANT_ID}/submissions`);
  console.log('  Run migration script next: node scripts/migrations/2026-05-e1-schema-split.mjs --dry-run');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
