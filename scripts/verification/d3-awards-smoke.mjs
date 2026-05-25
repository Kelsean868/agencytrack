// d3-awards-smoke.mjs — Phase 5.5 smoke for PR #297
// (feat/d3-agent-awards-enhancements)
//
// Seed → Verify → Cleanup in one pass.  No data left behind.
//
// Seed plan:
//   4 V2 submissions for J0j4uBqzTPcfm1IlGCPyDzo27RP2 (kelsean) in 2026-05
//     — passes the !submissions.length early-exit guard
//   1 confirmed settlement for 2026-05:
//     settledAPI=280_000, settledApps=50, persistency=88
//     — 280K puts agent in Bronze Club L3 band (250K–350K), 70K below L2 (350K)
//     — persistency=88 fails club gate (90), silver gate (92), gold gate (95)
//     — both API+apps criteria met → isPersistencyOnlyBlock fires on every affected award
//
// Legs:
//   Leg 1a  — Club tab: distance-to-tier badge showing TTD gap to Bronze L2
//   Leg 1b  — Monthly tab: criterion "% to go" gap badge on persistency row
//   Leg 2   — Any tab: pace pill (Achieved/On Track/At Risk/Far Off) rendered
//   Leg 3+  — Any tab: "only persistency" amber banner present (confirmed + sole unmet)
//             "Confirmed" badge present; no "Estimated" badge
//   Leg 3−  — delete settlement, reload: "Estimated" badge present, banner absent
//   Cleanup — delete submissions, reload: empty state returns
//
// Usage:
//   node scripts/verification/d3-awards-smoke.mjs
//   PREVIEW_HOST=<host> node scripts/verification/d3-awards-smoke.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import { setupBypassSession, safeLog, hardReloadAndAwaitReady } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

// ── Env ────────────────────────────────────────────────────────────────────
const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

const TOKEN          = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL    = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASSWORD = requireEnv('A11Y_AGENT_PASSWORD');

const PREVIEW_HOST =
  process.env.PREVIEW_HOST ??
  'agencytrack-gig63ck7h-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT    = { width: 1280, height: 800 };
const SS_DIR      = resolve('verification', 'd3-awards-smoke');
mkdirSync(SS_DIR, { recursive: true });

// ── Agent constants ────────────────────────────────────────────────────────
const AGENT_UID  = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
const TENANT_ID  = 'tatillife_south';
const YEAR       = 2026;
const PERIOD_KEY = '2026-05';

// 4 Sunday dates in May 2026 — stay within the confirmed-period month so
// annual calculation remains 'confirmed' (the engine skips months already
// covered by a confirmed settlement)
const WEEK_DATES = ['2026-05-03', '2026-05-10', '2026-05-17', '2026-05-24'];

// ── Admin SDK ──────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require('../../functions/service-account-key.json'),
    ),
  });
}
const db = admin.firestore();

// ── Seed helpers ───────────────────────────────────────────────────────────

function buildV2Submission(weekStarting) {
  return {
    agentId:   AGENT_UID,
    userId:    AGENT_UID,
    agentName: 'Kelsean',
    tenantId:  TENANT_ID,
    weekStarting,
    status:    'submitted',
    version:   2,

    newBusiness:  { apps: 2, api: 8000 },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
    totalProductionCredit: 8000,
    totalCommission:       2800,

    // V1 aliases for engine backwards compat
    applicationsSold: 2,
    apiSold:          8000,
    estimatedCommissions: 2800,

    // Activity (non-zero to populate ratio trends section)
    referralCalls:       5,
    coldCalls:           30,
    followUpCalls:       5,
    seminarTradeshowCalls: 0,
    serviceCalls:        0,
    qualifiedApproaches: 8,
    ffisScheduled:       3,
    ffiConducted:        3,
    solutionPresentations: 2,
    newCIBooked:         2,
    oldCIBooked:         0,
    ciConducted:         2,
    appointmentsSet:     3,
    livesSold:           2,

    prospectingLettersSent: 0,
    f2fAttempts: 0, f2fContacts: 0,
    referralsObtained: 1,
    namesFromColdCanvass: 3,
    namesFromSeminarsConducted: 0, namesFromSeminarsAttended: 0,
    namesFromTradeshowsConducted: 0, namesFromTradeshowsAttended: 0,
    namesFromOther: 0,

    hasServiceWork: false,
    serviceContacts: 0,
    premiumCollectionMeetings: 0,
    policiesReceived: 0, policiesDelivered: 0, policiesOutstanding: 0,
    withdrawalsLoans: 0, surrenders: 0, policyChanges: 0,
    annualReviews: 0, orphanReviews: 0, orphansAdopted: 0,
    reinstatementsSubmitted: 0, reinstatementAPI: 0,
    renewalPremiumsCollected: 0,

    officeHours: 10,
    fieldHours:  25,
    ratingPlanning:         4,
    ratingTimeManagement:   4,
    ratingSalesPerformance: 4,
    ratingProspecting:      4,
    ratingOverall:          4,
    notes: '',

    targetAPI:      9000,
    targetAppsSold: 2,
    targetDials: 0, targetTelContacts: 0, targetF2FAttempts: 0,
    targetFFI: 0, targetCI: 0,
    goalNotes: '',

    // persistencyRate intentionally 0 — dead field on all real docs
    persistencyRate: 0,

    submittedAt: new Date(weekStarting + 'T17:00:00.000Z').toISOString(),
    updatedAt:   new Date(weekStarting + 'T17:00:00.000Z').toISOString(),

    _smokeFixture: true,
    _smokePr:      'd3-awards',
  };
}

function buildSettlement() {
  return {
    agentId:         AGENT_UID,
    tenantId:        TENANT_ID,
    year:            YEAR,
    periodKey:       PERIOD_KEY,
    periodType:      'monthly',
    // 280K puts agent inside Bronze L3 band (250K–350K), 70K below L2 (350K).
    // Apps=50 meets both Club floor (50) and Persistency Silver floor (45).
    // Persistency=88 fails the 90% club gate, 92% silver gate, 95% gold gate.
    settledAPI:      280000,
    settledApps:     50,
    persistency:     88,
    notes:           'd3-awards smoke fixture',
    confirmedBy:     'smoke_script',
    confirmedByName: 'D3 Smoke Script',
    confirmedAt:     admin.firestore.FieldValue.serverTimestamp(),
    _smokeFixture:   true,
    _smokePr:        'd3-awards',
  };
}

async function seedAll() {
  const batch = db.batch();
  // Submissions
  for (const ws of WEEK_DATES) {
    const docId = `${AGENT_UID}_${ws}`;
    const ref = db.doc(`tenants/${TENANT_ID}/submissions/${docId}`);
    batch.set(ref, buildV2Submission(ws));
    safeLog('Queue submission', docId);
  }
  // Settlement
  const settlementId = `${AGENT_UID}_${YEAR}_${PERIOD_KEY}`;
  const settlementRef = db.doc(`tenants/${TENANT_ID}/settlements/${settlementId}`);
  batch.set(settlementRef, buildSettlement());
  safeLog('Queue settlement', settlementId);

  await batch.commit();
  safeLog('Seed batch committed (5 docs)');
  return settlementId;
}

async function deleteSettlement(settlementId) {
  await db.doc(`tenants/${TENANT_ID}/settlements/${settlementId}`).delete();
  safeLog('Deleted settlement', settlementId);
}

async function deleteSubmissions() {
  const batch = db.batch();
  for (const ws of WEEK_DATES) {
    batch.delete(db.doc(`tenants/${TENANT_ID}/submissions/${AGENT_UID}_${ws}`));
  }
  await batch.commit();
  safeLog('Deleted 4 submissions');
}

// ── Playwright helpers ─────────────────────────────────────────────────────

async function login(page) {
  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 25_000 });
  safeLog('Login OK');
}

async function navigateAwards(page) {
  await page.click('button:has-text("Awards"), a:has-text("Awards")', { timeout: 10_000 });
  await page.waitForTimeout(1_200);
}

async function clickTab(page, label) {
  await page.click(`button:has-text("${label}")`, { timeout: 8_000 });
  await page.waitForTimeout(600);
}

async function pageText(page) {
  return page.evaluate(() => document.body.textContent);
}

async function screenshot(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false });
  safeLog(`Screenshot: ${name}`);
}

// ── Results ────────────────────────────────────────────────────────────────
const results = [];
function pass(leg, msg) { results.push({ leg, status: 'PASS', msg }); console.log(`  ✓ [${leg}] ${msg}`); }
function fail(leg, msg) { results.push({ leg, status: 'FAIL', msg }); console.error(`  ✗ [${leg}] ${msg}`); }

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  safeLog('Preview host', PREVIEW_HOST);
  const browser  = await chromium.launch({ headless: true });
  const context  = await browser.newContext({ viewport: VIEWPORT });
  let settlementId = null;

  try {
    // ── SEED ─────────────────────────────────────────────────────────────
    console.log('\n── Seeding fixtures ──');
    settlementId = await seedAll();
    // Brief pause for Firestore write propagation before app reads
    await new Promise((r) => setTimeout(r, 1_500));

    // ── BROWSER SESSION ───────────────────────────────────────────────────
    await setupBypassSession(context, PREVIEW_URL, TOKEN);
    safeLog('Bypass session established');
    const page = await context.newPage();
    await login(page);

    // ── PHASE A: confirmed path ───────────────────────────────────────────
    console.log('\n── Phase A: confirmed path ──');
    await navigateAwards(page);
    await screenshot(page, 'A-awards-landing');

    // Verify awards panel is active (not empty state)
    const bodyAfterSeed = await pageText(page);
    if (bodyAfterSeed.includes('Start submitting weekly reports')) {
      // Firestore might be slow — give it 3 more seconds and try once more
      await page.waitForTimeout(3_000);
      await hardReloadAndAwaitReady(page);
      await navigateAwards(page);
    }
    const bodyCheck = await pageText(page);
    if (bodyCheck.includes('Start submitting weekly reports')) {
      fail('Seed', 'Awards panel still shows empty state after seeding — Firestore latency or rules block');
      throw new Error('Seed check failed — aborting smoke');
    }
    pass('Seed', 'Awards panel rendered after seeding');

    // ── LEG 1a: Club tab — distance-to-tier badge ─────────────────────────
    console.log('\n── Leg 1a: Club tab distance badge ──');
    await clickTab(page, 'Club');
    await screenshot(page, 'A-leg1a-club');
    const clubText = await pageText(page);

    // Expect "to go" or "to Bronze" (distance badge text)
    if (/to Bronze|to Silver|to Gold/i.test(clubText)) {
      pass('Leg1a', 'Club tab: distance-to-tier badge found ("to Bronze/Silver/Gold")');
    } else if (/to go/i.test(clubText)) {
      pass('Leg1a', 'Club tab: distance badge "to go" found');
    } else if (/Qualified/i.test(clubText)) {
      pass('Leg1a', 'Club tab: Qualified — already at top tier, no gap badge expected');
    } else {
      fail('Leg1a', `Club tab: no distance badge found. Club card text (first 300): ${clubText.slice(0, 300)}`);
    }

    // ── LEG 1b: Monthly tab — criterion gap badge ─────────────────────────
    console.log('\n── Leg 1b: Monthly tab gap badges ──');
    await clickTab(page, 'Monthly');
    await screenshot(page, 'A-leg1b-monthly');
    const monthlyText = await pageText(page);

    if (/to go/i.test(monthlyText)) {
      pass('Leg1b', 'Monthly tab: "to go" criterion gap badge found');
    } else if (/Qualified/i.test(monthlyText)) {
      pass('Leg1b', 'Monthly tab: all criteria met (Qualified), no gap badges expected');
    } else {
      fail('Leg1b', `Monthly tab: no "to go" badge. Monthly text sample: ${monthlyText.slice(0, 300)}`);
    }

    // ── LEG 2: pace pill ──────────────────────────────────────────────────
    console.log('\n── Leg 2: pace pill ──');
    const pacePillLabels = ['Achieved', 'On Track', 'At Risk', 'Far Off'];
    let pacePillFoundIn = null;

    for (const tab of ['Monthly', 'Quarterly', 'Annual', 'Club']) {
      await clickTab(page, tab);
      const t = await pageText(page);
      if (pacePillLabels.some((l) => t.includes(l))) {
        pacePillFoundIn = tab;
        break;
      }
    }

    if (pacePillFoundIn) {
      pass('Leg2', `Pace pill found in ${pacePillFoundIn} tab`);
    } else {
      fail('Leg2', 'No pace pill found in any tab');
    }
    await screenshot(page, 'A-leg2-pace');

    // ── LEG 3+: amber banner present, confirmed data ──────────────────────
    console.log('\n── Leg 3+: persistency banner + Confirmed badge ──');
    // Check all tabs — banner should appear on at least one award
    let bannerFoundIn = null;
    let confirmedBadgeFound = false;

    for (const tab of ['Monthly', 'Quarterly', 'Annual', 'Club']) {
      await clickTab(page, tab);
      const t = await pageText(page);
      if (t.includes('Confirmed')) confirmedBadgeFound = true;
      if (t.includes('only persistency') && !bannerFoundIn) bannerFoundIn = tab;
    }

    if (confirmedBadgeFound) {
      pass('Leg3+', '"Confirmed" badge visible on at least one award card');
    } else {
      fail('Leg3+', '"Confirmed" badge not found — settlement may not have been read');
    }

    if (bannerFoundIn) {
      pass('Leg3+', `Amber persistency banner ("only persistency") found in ${bannerFoundIn} tab`);
    } else {
      fail('Leg3+', 'Amber persistency banner not found in any tab (confirmed + sole-persistency-unmet expected)');
    }

    await screenshot(page, 'A-leg3pos-banner');

    // Also verify no "Estimated" badge while settlement is present
    await clickTab(page, 'Annual');
    const annualText = await pageText(page);
    if (!annualText.includes('Estimated')) {
      pass('Leg3+', 'No "Estimated" badge on Annual tab while confirmed settlement is present');
    } else {
      fail('Leg3+', '"Estimated" badge found on Annual tab despite confirmed settlement — data source mismatch');
    }

    // ── PHASE B: estimated path (negative check) ──────────────────────────
    console.log('\n── Phase B: estimated path (negative check) ──');
    await deleteSettlement(settlementId);
    settlementId = null; // prevent double-delete in finally

    // Reload so app re-fetches without the settlement
    await page.waitForTimeout(1_500);
    await hardReloadAndAwaitReady(page);
    await navigateAwards(page);
    await page.waitForTimeout(1_000);
    await screenshot(page, 'B-estimated-landing');

    // Check across tabs
    let estimatedBadgeFound = false;
    let bannerFoundAfterDelete = false;

    for (const tab of ['Monthly', 'Quarterly', 'Annual', 'Club']) {
      await clickTab(page, tab);
      const t = await pageText(page);
      if (t.includes('Estimated')) estimatedBadgeFound = true;
      if (t.includes('only persistency')) bannerFoundAfterDelete = true;
    }

    if (estimatedBadgeFound) {
      pass('Leg3−', '"Estimated" badge visible after settlement deleted — estimated path active');
    } else {
      fail('Leg3−', '"Estimated" badge not found after settlement deleted — Firestore may be stale');
    }

    if (!bannerFoundAfterDelete) {
      pass('Leg3−', 'Amber persistency banner absent on estimated data — correct (isPersistencyOnlyBlock returns false)');
    } else {
      fail('Leg3−', 'Amber persistency banner appeared on estimated data — Leg 3 guard broken');
    }

    await screenshot(page, 'B-leg3neg');

    // ── PHASE C: cleanup + empty-state verification ───────────────────────
    console.log('\n── Phase C: cleanup ──');
    await deleteSubmissions();

    await page.waitForTimeout(1_500);
    await hardReloadAndAwaitReady(page);
    await navigateAwards(page);
    await page.waitForTimeout(800);
    await screenshot(page, 'C-post-cleanup');

    const cleanText = await pageText(page);
    if (cleanText.includes('Start submitting weekly reports')) {
      pass('Cleanup', 'Awards panel returned to empty state after submission cleanup');
    } else {
      fail('Cleanup', 'Awards panel did not return to empty state — stale data or incomplete cleanup');
    }

  } finally {
    // Guaranteed cleanup regardless of outcome
    try {
      if (settlementId) {
        await deleteSettlement(settlementId);
        safeLog('Finally: settlement deleted');
      }
    } catch (e) { safeLog('Finally cleanup warning (settlement)', e.message); }

    try {
      await deleteSubmissions();
      safeLog('Finally: submissions deleted');
    } catch (e) { safeLog('Finally cleanup warning (submissions)', e.message); }

    await context.close();
    await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n══ D3 Awards Smoke Results ══');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} [${r.status}] ${r.leg}: ${r.msg}`);
  }

  const failures = results.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    console.error(`\n${failures.length} leg(s) FAILED`);
    process.exit(1);
  } else {
    console.log(`\nAll ${results.length} assertions PASS — smoke complete.`);
  }
}

main().catch((err) => {
  console.error('Smoke script error:', err.message);
  process.exit(1);
});
