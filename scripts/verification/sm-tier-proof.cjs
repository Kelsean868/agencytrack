'use strict';
/**
 * SM tier proof — write-read-verify for PR #699.
 *
 * Resolves the real SM uid using the same query the CF does (tenants/{tid}/users
 * where role == 'sales_manager'). Seeds a SM goal doc under that real uid,
 * verifies GapAnalysisPanel renders the SM tier, then deletes the seeded goal.
 * Does NOT seed a fake SM user — real SM users already exist in tatillife_smoke.
 *
 * Run: node --env-file=.env.local scripts/verification/sm-tier-proof.cjs
 *      node --env-file=.env.local scripts/verification/sm-tier-proof.cjs --dry-run
 */
const path        = require('path');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright-core'));
const admin       = require(path.resolve(__dirname, '../../functions/node_modules/firebase-admin'));

const isDryRun = process.argv.includes('--dry-run');
const BASE_URL = process.env.A11Y_BASE_URL || 'https://portal.agencytrack.app';
const TENANT   = process.env.A11Y_TENANT_ID;
const EMAIL    = process.env.A11Y_AGENT_EMAIL;
const PASSWORD = process.env.A11Y_AGENT_PASSWORD;
const YEAR     = new Date().getFullYear();

if (!TENANT || !EMAIL || !PASSWORD) {
  console.error('Missing A11Y_TENANT_ID / A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');
  process.exit(1);
}

const keyPath = path.resolve(__dirname, '../../functions/service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();

// Resolve the real SM uid using the same query as the CF (resolveSalesManagerUid)
async function resolveRealSmUid() {
  const snap = await db.collection(`tenants/${TENANT}/users`)
    .where('role', '==', 'sales_manager').limit(2).get();
  if (snap.empty) return null;
  if (snap.size > 1) {
    console.log(`[setup] ${snap.size} SM users in tenant; CF will use first: ${snap.docs[0].id}`);
  }
  return snap.docs[0].id;
}

// Seed the SM goal doc for the resolved SM uid.
// Returns the goalRef if we wrote it (cleanup needed), null if pre-existing (no cleanup).
async function seed(smUid) {
  const goalRef = db.doc(`tenants/${TENANT}/salesManagerGoals/${smUid}_${YEAR}`);
  console.log(`[seed] tenants/${TENANT}/salesManagerGoals/${smUid}_${YEAR} — api: 1200000`);
  if (isDryRun) { console.log('[dry-run] skipping write'); return null; }

  const existing = await goalRef.get();
  if (existing.exists) {
    console.log('[seed] goal doc already exists — skipping write, no cleanup needed');
    return null;
  }
  await goalRef.set({ smUid, year: YEAR, tenantId: TENANT, api: 1200000, apps: 96 });
  console.log('[seed] done');
  return goalRef;
}

async function verify() {
  console.log(`[verify] opening agent dashboard at ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console errors from the very start (before page.goto)
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20000 });

    // Navigate to Goals tab — GapAnalysisPanel only renders at activeTab==='goals'
    const goalsBtn = page.locator('[data-testid="agent-tab-goals"]');
    const goalsBtnCount = await goalsBtn.count();
    console.log(`[verify] goals btn found: ${goalsBtnCount}`);
    if (goalsBtnCount) {
      await goalsBtn.click();
      await page.waitForTimeout(6000);  // allow CF round-trip + hierarchy fetch
    }

    // Check for SM tier — OrgContextStrip renders data-testid="org-context-strip"
    // and label 'SM' only when salesManagerTarget.api is non-null
    const orgStripCount = await page.locator('[data-testid="org-context-strip"]').count();
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasSMTier = /\bSM\b/.test(bodyText);
    console.log(`[verify] org-context-strip present: ${orgStripCount}`);
    console.log(`[verify] SM tier present (pre-reload): ${hasSMTier}`);

    // Hard-reload to confirm CF re-resolves the uid (not a cache hit)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20000 });

    // Re-navigate to Goals tab after reload
    const goalsBtnAfterReload = page.locator('[data-testid="agent-tab-goals"]');
    if (await goalsBtnAfterReload.count()) {
      await goalsBtnAfterReload.click();
      await page.waitForTimeout(6000);
    }

    const orgStripCountAfterReload = await page.locator('[data-testid="org-context-strip"]').count();
    const bodyTextAfterReload = await page.evaluate(() => document.body.innerText);
    const hasSMTierAfterReload = /\bSM\b/.test(bodyTextAfterReload);

    console.log(`[verify] org-context-strip present (post-reload): ${orgStripCountAfterReload}`);
    console.log(`[verify] SM tier present (post-reload): ${hasSMTierAfterReload}`);
    console.log(`[verify] console errors captured: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) consoleErrors.forEach(e => console.log(`  [error] ${e}`));

    const pass = hasSMTierAfterReload && consoleErrors.filter(e => /Missing or insufficient permissions/i.test(e)).length === 0;
    console.log(`[verify] RESULT: ${pass ? 'PASS' : 'FAIL'}`);
    return pass;
  } finally {
    await browser.close();
  }
}

(async () => {
  let pass = false;
  let goalRef = null;
  try {
    const smUid = await resolveRealSmUid();
    if (!smUid) {
      console.error('[setup] No SM user found in tenant — cannot run proof. Seed an SM user first.');
      process.exit(1);
    }
    console.log(`[setup] resolved SM uid: ${smUid}`);
    goalRef = await seed(smUid);
    if (!isDryRun) {
      pass = await verify();
    }
  } finally {
    if (goalRef) {
      console.log('[cleanup] deleting seeded goal doc');
      await goalRef.delete();
      console.log('[cleanup] done');
    } else {
      console.log('[cleanup] no goal doc to delete (pre-existing or dry-run)');
    }
    await admin.app().delete();
  }
  process.exit(pass || isDryRun ? 0 : 1);
})();
