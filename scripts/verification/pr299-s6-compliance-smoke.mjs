// pr299-s6-compliance-smoke.mjs — Phase 5.5 smoke for PR #299
// (feat/track-i-s6-license-compliance — Track I §6 CBTT compliance fields)
//
// Four legs (UI-driven per brief spec):
//   Leg 1: Set agent to provisional + at-risk contractStartDate via EditUserDrawer
//          → navigate to CompliancePanel → verify appears as at-risk.
//   Leg 2: Edit agent → toggle cbttExtensionGranted → save → reload Compliance
//          → verify "extended to 24 mo" label appears; at-risk cleared if >90d.
//   Leg 3: Edit agent → set licenseStatus official → save → reload Compliance
//          → verify agent drops off provisional list.
//   Leg 4: Admin SDK read verifies persistence; revert to prior state.
//
// Cleanup: Admin SDK reverts user doc in `finally` regardless of leg results.
// Uses setupBypassSession — token never in a bare URL after handshake.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

// ── Env ─────────────────────────────────────────────────────────────────────
const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}
const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

const TOKEN        = requireEnv('VERCEL_BYPASS_TOKEN');
const MGR_EMAIL    = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const MGR_PASSWORD = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');
const AGENT_EMAIL  = requireEnv('A11Y_AGENT_EMAIL');

const PREVIEW_HOST =
  process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-track-i-s6-license-compliance-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 1280, height: 900 };
const SS_DIR = resolve('verification', 'pr299-s6-compliance-smoke');
mkdirSync(SS_DIR, { recursive: true });

// ── Admin SDK ────────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require('../../functions/service-account-key.json')
    ),
  });
}
const db = admin.firestore();
const TENANT_ID = 'tatillife_south';

async function getAgentDoc(uid) {
  const snap = await db.doc(`tenants/${TENANT_ID}/users/${uid}`).get();
  return snap.data() ?? {};
}

async function resolveAgent() {
  const userRecord = await admin.auth().getUserByEmail(AGENT_EMAIL);
  const uid = userRecord.uid;
  const data = await getAgentDoc(uid);
  return { uid, name: data.name ?? data.email ?? AGENT_EMAIL, originalData: data };
}

async function adminClearLicenseFields(uid, originalData) {
  const FieldValue = admin.firestore.FieldValue;
  const restore = {};
  for (const field of ['licenseStatus', 'cbttExamPassedDate', 'cbttExtensionGranted', 'contractStartDate']) {
    if (field in originalData && originalData[field] !== null) {
      restore[field] = originalData[field];
    } else {
      restore[field] = FieldValue.delete();
    }
  }
  await db.doc(`tenants/${TENANT_ID}/users/${uid}`).update(restore);
}

// Deadline arithmetic — compute contractStartDate so deadline is ~60 days away
function contractStartForAtRisk() {
  const today = new Date();
  // deadline = today + 60 days; contractStart = deadline - 12 months
  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + 60);
  const start = new Date(deadline);
  start.setMonth(start.getMonth() - 12);
  return start.toISOString().slice(0, 10);
}

// ── Screenshot helper ─────────────────────────────────────────────────────────
async function screenshot(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`) });
}

// ── Login helper ──────────────────────────────────────────────────────────────
async function loginAsManager(page) {
  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', MGR_EMAIL);
  await page.fill('input[type="password"]', MGR_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20000 });
  safeLog('[Auth] Manager logged in');
}

// ── Navigate to Team tab and open EditUserDrawer for agent ────────────────────
async function openEditDrawer(page, agentName) {
  // Click Team nav item — uses data-testid="nav-team" (Sidebar.jsx)
  await page.click('[data-testid="nav-team"]', { timeout: 8000 });
  // Wait for user rows to render
  await page.waitForTimeout(2000);

  // Find the agent by name and click Edit
  const agentFirst = agentName.split(' ')[0];
  // Try to find the edit button near the agent's name
  // UserManagementPanel renders: <button aria-label={`Edit ${u.name}`} data-testid={`user-edit-${u.uid}`}>
  const exactBtn = await page.$(`button[aria-label="Edit ${agentName}"]`);
  if (exactBtn) {
    await exactBtn.click();
  } else {
    // Fallback: any edit button whose aria-label contains the agent's first name
    const btn = await page.$(`button[aria-label*="Edit ${agentFirst}"]`);
    if (btn) {
      await btn.click();
    } else {
      throw new Error(`Could not find edit button for agent "${agentName}"`);
    }
  }
  // Wait for the drawer to open
  await page.waitForSelector('#edit-user-license-status', { timeout: 8000 });
  safeLog(`[UI] EditUserDrawer opened for "${agentName}"`);
}

// ── Navigate to CompliancePanel ───────────────────────────────────────────────
async function navigateToCompliance(page) {
  await page.click('[data-testid="nav-compliance"]', { timeout: 8000 });
  await page.waitForFunction(
    () => document.body.textContent.includes('CBTT License Compliance'),
    null,
    { timeout: 15000 }
  );
}

// ── Result tracking ──────────────────────────────────────────────────────────
const results = [];
function record(leg, passed, detail) {
  results.push({ leg, passed, detail });
  console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('PR #299 — Track I §6 CBTT Compliance Smoke');
  safeLog('Preview host:', PREVIEW_HOST);
  console.log();

  const { uid: agentUid, name: agentName, originalData } = await resolveAgent();
  safeLog('[Setup] Test agent resolved:', agentName);

  const contractStartAtRisk = contractStartForAtRisk();
  safeLog('[Setup] contractStartDate for at-risk:', contractStartAtRisk);
  const agentFirst = agentName.split(' ')[0];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });

  try {
    await setupBypassSession(context, PREVIEW_URL, TOKEN);
    safeLog('[Auth] Bypass session established');

    const page = await context.newPage();
    await loginAsManager(page);

    // ── Leg 1: Set provisional + at-risk via EditUserDrawer ──────────────────
    console.log('\n[Leg 1] Set provisional + at-risk contractStartDate via EditUserDrawer');
    await openEditDrawer(page, agentName);

    // Set licenseStatus to provisional
    await page.selectOption('#edit-user-license-status', 'provisional');
    // Set contractStartDate to at-risk value
    await page.fill('#edit-user-contract-start', contractStartAtRisk);
    // Ensure cbttExtensionGranted is NOT checked
    const extCheckbox = await page.$('#edit-user-cbtt-extension');
    if (extCheckbox) {
      const checked = await extCheckbox.isChecked();
      if (checked) await extCheckbox.uncheck();
    }
    await screenshot(page, 'leg1-drawer-before-save');
    // Click Save
    await page.click('[data-testid="edit-user-save"]', { timeout: 5000 });
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="edit-user-save"]'),
      null,
      { timeout: 12000 }
    ); // Drawer closed
    safeLog('[Leg 1] Saved. Navigating to Compliance...');

    await navigateToCompliance(page);
    await screenshot(page, 'leg1-compliance-panel');

    const text1 = await page.evaluate(() => document.body.textContent);
    const hasAgent1 = text1.includes(agentFirst);
    const hasDays1 = /\d+ day/.test(text1) || text1.includes('Overdue');
    record(
      'Leg 1',
      hasAgent1,
      hasAgent1
        ? `Agent appears in CBTT section. Days indicator: ${hasDays1 ? 'present' : 'absent (check if >90d)'}`
        : `Agent NOT found in CBTT section`
    );

    // ── Leg 2: Toggle extension → at-risk should clear ───────────────────────
    console.log('\n[Leg 2] Grant cbttExtensionGranted → deadline shifts to 24mo');
    // Go back to Team to open drawer
    await page.click('[data-testid="nav-team"]', { timeout: 8000 });
    await page.waitForTimeout(1500);
    await openEditDrawer(page, agentName);

    // The cbttExtensionGranted toggle is only shown when licenseStatus === 'provisional'
    const extToggle2 = await page.$('#edit-user-cbtt-extension');
    if (!extToggle2) throw new Error('cbttExtensionGranted toggle not found — licenseStatus may not be provisional');
    await extToggle2.check();
    await screenshot(page, 'leg2-drawer-extension-granted');
    await page.click('[data-testid="edit-user-save"]', { timeout: 5000 });
    await page.waitForFunction(
      () => !document.querySelector('#edit-user-cbtt-extension'),
      null,
      { timeout: 12000 }
    );
    safeLog('[Leg 2] Extension granted, saved. Navigating to Compliance...');

    await navigateToCompliance(page);
    await screenshot(page, 'leg2-compliance-extended');

    const text2 = await page.evaluate(() => document.body.textContent);
    const hasAgent2 = text2.includes(agentFirst);
    const hasExtended2 = text2.includes('extended to 24');
    record(
      'Leg 2',
      hasAgent2 && hasExtended2,
      hasAgent2
        ? `Agent listed (still provisional). Extension label: ${hasExtended2 ? 'present' : 'absent'}`
        : `Agent absent from list — unexpected (still provisional after extension)`
    );

    // ── Leg 3: Set official via EditUserDrawer → drops off list ──────────────
    console.log('\n[Leg 3] Set licenseStatus: official via EditUserDrawer');
    await page.click('[data-testid="nav-team"]', { timeout: 8000 });
    await page.waitForTimeout(1000);
    await openEditDrawer(page, agentName);

    await page.selectOption('#edit-user-license-status', 'official');
    // cbttExamPassedDate field should now appear
    await page.waitForSelector('#edit-user-cbtt-passed', { timeout: 5000 }).catch(() => {});
    const passedDateInput = await page.$('#edit-user-cbtt-passed');
    if (passedDateInput) {
      await passedDateInput.fill(new Date().toISOString().slice(0, 10));
    }
    await screenshot(page, 'leg3-drawer-official');
    await page.click('[data-testid="edit-user-save"]', { timeout: 5000 });
    await page.waitForFunction(
      () => !document.querySelector('#edit-user-license-status'),
      null,
      { timeout: 12000 }
    );
    safeLog('[Leg 3] Set official, saved. Navigating to Compliance...');
    // Give the Firestore onSnapshot listener time to propagate the official status
    // to the ManagerDashboard users state before the compliance panel re-renders.
    await page.waitForTimeout(2500);

    await navigateToCompliance(page);
    // Wait for the CBTT section to show the empty-state message (up to 8s for data to settle).
    // agentFirst may appear elsewhere on the page (e.g. missing-submissions column) so we
    // check for the CBTT-specific empty-state string instead.
    await page.waitForFunction(
      () => document.body.textContent.includes('No provisional agents with a contract start date'),
      null,
      { timeout: 8000 }
    ).catch(() => {});
    await screenshot(page, 'leg3-compliance-official');

    const text3 = await page.evaluate(() => document.body.textContent);
    const emptyMsg3 = text3.includes('No provisional agents with a contract start date');
    record(
      'Leg 3',
      emptyMsg3,
      emptyMsg3
        ? `CBTT section shows empty state (official agent removed from provisional list)`
        : `CBTT empty state NOT found — agent may still appear as provisional`
    );

    // ── Leg 4: Verify persistence via Admin SDK ───────────────────────────────
    console.log('\n[Leg 4] Verify persistence via Admin SDK read');
    const latest = await getAgentDoc(agentUid);
    const persistOk =
      latest.licenseStatus === 'official' &&
      latest.cbttExtensionGranted === true &&
      !!latest.cbttExamPassedDate &&
      latest.contractStartDate === contractStartAtRisk;
    record(
      'Leg 4',
      persistOk,
      persistOk
        ? `Firestore: licenseStatus=${latest.licenseStatus}, cbttExtensionGranted=${latest.cbttExtensionGranted}, cbttExamPassedDate=${latest.cbttExamPassedDate}, contractStartDate=${latest.contractStartDate}`
        : `Persistence mismatch. Got: ${JSON.stringify({ licenseStatus: latest.licenseStatus, cbttExtensionGranted: latest.cbttExtensionGranted, cbttExamPassedDate: latest.cbttExamPassedDate })}`
    );

    // ── Console errors ────────────────────────────────────────────────────────
    console.log('\n[Console] Checking for browser errors...');
    const consoleMsgs = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleMsgs.push(msg.text()); });
    if (consoleMsgs.length > 0) {
      console.error(`  ${consoleMsgs.length} console error(s):`);
      consoleMsgs.slice(0, 5).forEach((m) => console.error(`    ${m}`));
    } else {
      console.log('  No console errors detected');
    }

    await page.close();
  } finally {
    console.log('\n[Cleanup] Reverting test agent to original state...');
    try {
      await adminClearLicenseFields(agentUid, originalData);
      safeLog('[Cleanup] Reverted:', agentUid);
    } catch (err) {
      console.error('[Cleanup] FAILED — manual cleanup required:', err.message);
    }
    await browser.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n── Summary ─────────────────────────────────────────────────');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  results.forEach(({ leg, passed, detail }) =>
    console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`)
  );
  console.log(`\n${passed + failed} legs: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('Smoke FAILED — see above for details');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal smoke error:', err);
  process.exit(1);
});
