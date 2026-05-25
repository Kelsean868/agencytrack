/**
 * h2-agent-conf-surfacing-smoke.mjs — Track H PR #305 pre-merge smoke.
 *
 * Verifies:
 *  A. Agent sees Policy A (confirmed+discrepancy): emerald chip, amber chip,
 *     value line (Your value · Manager), and manager note.
 *  B. Agent sees Policy B (confirmed+clean): emerald chip, Settled label, NO
 *     Discrepancy chip, NO Note line.
 *  C. Bell drawer: policy_discrepancy notification renders with warning palette
 *     (bg-warning on icon wrapper class), NOT the Bell/primary fallback.
 *
 * Seeds via Admin SDK (bypasses Firestore rules — test-only).
 * Deletes via Admin SDK. Re-enumerates to confirm empty.
 *
 * Run: node scripts/verification/h2-agent-conf-surfacing-smoke.mjs
 */

import { chromium } from 'playwright';
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  safeLog,
} from './lib/walk-helpers.mjs';

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dir, '..', '..');
const require = createRequire(import.meta.url);

// ── Env ───────────────────────────────────────────────────────────────────────

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

// ── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID    = 'tatillife_south';
const AGENT_UID    = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
const PREVIEW_HOST = 'agencytrack-pz03pmh48-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;

const NOW       = new Date();
const RUN_TS    = NOW.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SMOKE_TAG = `SMOKE-AGENT-CONF-${NOW.getTime()}`;

const SS_DIR      = join(__dir, `${RUN_TS}-h2-agent-conf-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-h2-agent-conf-surfacing-smoke.md`);
const KEY_PATH    = join(ROOT, 'functions', 'service-account-key.json');

// ── Results tracking ──────────────────────────────────────────────────────────

const results = [];
let seededPolicyAId = null;
let seededPolicyBId = null;
let seededNotifId   = null;

function pass(step, note = '') {
  results.push({ step, status: 'PASS', note });
  console.log(`  ✓ ${step}${note ? ` — ${note}` : ''}`);
}
function fail(step, note = '') {
  results.push({ step, status: 'FAIL', note });
  console.log(`  ✗ ${step}${note ? ` — ${note}` : ''}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function check(page, selector, timeout = 6000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch { return false; }
}

async function checkText(page, text, timeout = 6000) {
  try {
    const loc = typeof text === 'string'
      ? page.getByText(text, { exact: false })
      : page.locator(`text=${text}`);
    await loc.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch { return false; }
}

async function screenshot(page, name) {
  try {
    mkdirSync(SS_DIR, { recursive: true });
    await page.screenshot({ path: join(SS_DIR, `${name}.png`) });
  } catch (_) { /* non-blocking */ }
}

// ── Admin SDK ─────────────────────────────────────────────────────────────────

function initAdmin() {
  if (!existsSync(KEY_PATH)) throw new Error(`Service account key not found: ${KEY_PATH}`);
  const admin = require('../../functions/node_modules/firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
  }
  return admin;
}

async function seedFixtures(admin) {
  const db  = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const policiesRef = db.collection(`tenants/${TENANT_ID}/policies`);
  const notifsRef   = db.collection(`tenants/${TENANT_ID}/notifications`);

  // Policy A — confirmed with discrepancy + note
  const policyARef = await policiesRef.add({
    agentId:            AGENT_UID,
    tenantId:           TENANT_ID,
    ownerName:          `${SMOKE_TAG}-A`,
    insuredName:        `${SMOKE_TAG}-A`,
    status:             'settled',
    proposedAPI:        3000,
    sourceOfProspect:   'referral',
    cashWithApp:        { collected: false, amount: '' },
    dateWritten:        now,
    createdAt:          now,
    confirmedAt:        now,
    confirmedByManager: 'Test Branch Manager',
    confirmedByUid:     'mgr-uid-smoke',
    hasDiscrepancy:     true,
    settledAPI:         5000,
    managerSettledAPI:  6000,
    managerNote:        'Adjusted per receipt.',
  });
  seededPolicyAId = policyARef.id;
  console.log(`  Policy A: ${seededPolicyAId}`);

  // Policy B — confirmed clean (no discrepancy, no note)
  const policyBRef = await policiesRef.add({
    agentId:            AGENT_UID,
    tenantId:           TENANT_ID,
    ownerName:          `${SMOKE_TAG}-B`,
    insuredName:        `${SMOKE_TAG}-B`,
    status:             'settled',
    proposedAPI:        4000,
    sourceOfProspect:   'referral',
    cashWithApp:        { collected: false, amount: '' },
    dateWritten:        now,
    createdAt:          now,
    confirmedAt:        now,
    confirmedByManager: 'Test Branch Manager',
    confirmedByUid:     'mgr-uid-smoke',
    hasDiscrepancy:     false,
    settledAPI:         4000,
    managerSettledAPI:  4000,
    managerNote:        null,
  });
  seededPolicyBId = policyBRef.id;
  console.log(`  Policy B: ${seededPolicyBId}`);

  // Notification — policy_discrepancy for agent
  const notifRef = await notifsRef.add({
    type:      'policy_discrepancy',
    userId:    AGENT_UID,
    tenantId:  TENANT_ID,
    title:     'Policy Confirmation Discrepancy',
    body:      `Your policy ${SMOKE_TAG}-A was confirmed with a discrepancy.`,
    read:      false,
    link:      null,
    createdAt: now,
  });
  seededNotifId = notifRef.id;
  console.log(`  Notification: ${seededNotifId}`);
}

async function cleanupFixtures(admin) {
  const db = admin.firestore();
  const ops = [];
  if (seededPolicyAId) ops.push(db.doc(`tenants/${TENANT_ID}/policies/${seededPolicyAId}`).delete());
  if (seededPolicyBId) ops.push(db.doc(`tenants/${TENANT_ID}/policies/${seededPolicyBId}`).delete());
  if (seededNotifId)   ops.push(db.doc(`tenants/${TENANT_ID}/notifications/${seededNotifId}`).delete());
  await Promise.all(ops);
  console.log(`  Deleted ${ops.length} fixtures.`);
}

async function reEnumerate(admin) {
  const db = admin.firestore();
  // Re-enumerate by agentId + ownerName prefix (avoid compound index requirement)
  const snap = await db.collection(`tenants/${TENANT_ID}/policies`)
    .where('agentId', '==', AGENT_UID)
    .get();
  return snap.docs
    .filter(d => d.data().ownerName?.startsWith('SMOKE-AGENT-CONF-'))
    .map(d => ({ id: d.id, ownerName: d.data().ownerName }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== h2-agent-conf-surfacing-smoke ${RUN_TS} ===`);
  console.log(`Tag: ${SMOKE_TAG}`);
  console.log(`Preview: ${PREVIEW_HOST}\n`);

  // ── Seed ───────────────────────────────────────────────────────────────────
  console.log('Phase 1 — Seed fixtures');
  const admin = initAdmin();
  await seedFixtures(admin);
  pass('seed-fixtures', 'Policy A (discrepancy) + Policy B (clean) + notification');
  await new Promise(r => setTimeout(r, 2000));

  // ── Browser verification ───────────────────────────────────────────────────
  console.log('\nPhase 2 — Browser verification');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  try {
    await setupBypassSession(context, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    pass('bypass-session');

    const page = await context.newPage();

    // Login
    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
    await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for Policy Ledger tab (confirms agent dashboard loaded)
    await page.waitForSelector('[data-testid="agent-tab-policy-ledger"]', { state: 'visible', timeout: 25000 });
    pass('agent-login');

    // Navigate to Policy Ledger
    await page.click('[data-testid="agent-tab-policy-ledger"]');
    await screenshot(page, '01-policy-ledger');

    // Wait for skeleton to clear
    await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));
    await screenshot(page, '02-policies-loaded');

    // ── Policy A assertions ───────────────────────────────────────────────────
    console.log('\n  Policy A (confirmed + discrepancy):');

    const pAVisible = await check(page, `text=${SMOKE_TAG}-A`);
    if (pAVisible) pass('pA-visible'); else fail('pA-visible', `${SMOKE_TAG}-A not found`);

    // "Confirmed by" chip — getByText with exact:false on partial text
    const confirmedBy = await page.getByText('Confirmed by', { exact: false }).first().isVisible({ timeout: 6000 }).catch(() => false);
    if (confirmedBy) pass('pA-confirmed-chip', '"Confirmed by" chip visible'); else fail('pA-confirmed-chip', '"Confirmed by" chip not visible');

    // "Test Branch Manager" appears in chip text
    const managerName = await page.getByText('Test Branch Manager', { exact: false }).first().isVisible({ timeout: 5000 }).catch(() => false);
    if (managerName) pass('pA-manager-name', '"Test Branch Manager" visible'); else fail('pA-manager-name');

    // Amber Discrepancy chip
    const discChip = await page.locator('span').filter({ hasText: 'Discrepancy' }).first().isVisible({ timeout: 5000 }).catch(() => false);
    if (discChip) pass('pA-discrepancy-chip'); else fail('pA-discrepancy-chip', '"Discrepancy" chip not visible');

    // "Your value:" label
    const yourVal = await page.getByText('Your value:', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (yourVal) pass('pA-your-value-label'); else fail('pA-your-value-label');

    // settledAPI = 5000 → shown as "5,000" (some number with comma)
    const val5k = await page.locator('text=/5[,.]000/').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (val5k) pass('pA-settled-api-5000'); else fail('pA-settled-api-5000', '5,000 not visible');

    // managerSettledAPI = 6000
    const val6k = await page.locator('text=/6[,.]000/').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (val6k) pass('pA-manager-api-6000'); else fail('pA-manager-api-6000', '6,000 not visible');

    // Manager note
    const noteText = await page.getByText('Note:', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (noteText) pass('pA-note-label'); else fail('pA-note-label', '"Note:" label not visible');

    const noteBody = await page.getByText('Adjusted per receipt.', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (noteBody) pass('pA-note-body'); else fail('pA-note-body', '"Adjusted per receipt." not visible');

    await screenshot(page, '03-policy-a');

    // ── Policy B assertions ───────────────────────────────────────────────────
    console.log('\n  Policy B (confirmed + clean):');

    const pBVisible = await check(page, `text=${SMOKE_TAG}-B`);
    if (pBVisible) pass('pB-visible'); else fail('pB-visible', `${SMOKE_TAG}-B not found`);

    // "Settled:" label (the clean arm shows "Settled: TTD X" vs "Your value: ...")
    const settledLabel = await page.getByText('Settled:', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    if (settledLabel) pass('pB-settled-label', '"Settled:" label visible'); else fail('pB-settled-label');

    // managerSettledAPI = 4000 → "4,000" somewhere
    const val4k = await page.locator('text=/4[,.]000/').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (val4k) pass('pB-settled-value-4000', '4,000 visible'); else fail('pB-settled-value-4000');

    // Only one "Discrepancy" chip on entire page (Policy A only)
    const discCount = await page.locator('span').filter({ hasText: 'Discrepancy' }).count();
    if (discCount === 1) pass('pB-no-discrepancy-chip', `Discrepancy count=${discCount} (Policy A only)`);
    else fail('pB-no-discrepancy-chip', `Discrepancy count=${discCount} expected 1`);

    // Only one "Note:" on entire page (Policy A only)
    const noteCount = await page.getByText('Note:', { exact: false }).count();
    if (noteCount === 1) pass('pB-no-note', `Note: count=${noteCount} (Policy A only)`);
    else fail('pB-no-note', `Note: count=${noteCount} expected 1`);

    await screenshot(page, '04-policy-b');

    // ── Bell drawer ───────────────────────────────────────────────────────────
    console.log('\n  Bell drawer (policy_discrepancy notification):');

    // Bell button: aria-label "Notifications — N unread" when unread > 0
    const bellBtn = page.getByRole('button', { name: /Notifications/i }).first();
    const bellVisible = await bellBtn.isVisible({ timeout: 6000 }).catch(() => false);
    if (bellVisible) {
      await bellBtn.click();
      pass('bell-open', 'Bell button clicked');
    } else {
      // Fallback: look for the bell icon button in the header area
      const bellFallback = page.locator('header button, [role="banner"] button').filter({
        has: page.locator('svg'),
      }).last();
      const fbVisible = await bellFallback.isVisible({ timeout: 3000 }).catch(() => false);
      if (fbVisible) {
        await bellFallback.click();
        pass('bell-open', 'Bell fallback clicked');
      } else {
        fail('bell-open', 'Bell button not found');
      }
    }

    await new Promise(r => setTimeout(r, 800));
    await screenshot(page, '05-bell-drawer');

    // Assert notification title present in drawer (check DOM directly — drawer may have overflow scroll)
    const notifTitle = await page.evaluate(() =>
      document.body.textContent?.includes('Policy Confirmation Discrepancy') ?? false
    );
    if (notifTitle) pass('bell-notif-title'); else fail('bell-notif-title', 'Title not found in DOM');

    // Assert icon wrapper has warning palette (not primary/Bell fallback).
    // The icon div inside the notification button has classes including bg-warning/10 for policy_discrepancy.
    // Use evaluate to check the class attribute directly.
    const warningPalette = await page.evaluate(() => {
      // Find the notification item that contains "Policy Confirmation Discrepancy"
      const allButtons = Array.from(document.querySelectorAll('button'));
      const notifBtn = allButtons.find(b => b.textContent?.includes('Policy Confirmation Discrepancy'));
      if (!notifBtn) return { found: false, cls: null };
      const iconDiv = notifBtn.querySelector('div.rounded-full');
      if (!iconDiv) return { found: true, cls: null };
      return { found: true, cls: iconDiv.className };
    });

    if (!warningPalette.found) {
      fail('bell-warning-palette', 'Notification button not found in DOM');
    } else if (!warningPalette.cls) {
      fail('bell-warning-palette', 'Icon wrapper div not found inside button');
    } else if (warningPalette.cls.includes('bg-warning')) {
      pass('bell-warning-palette', `Icon class includes bg-warning ✓ (${warningPalette.cls.substring(0, 60)})`);
    } else {
      fail('bell-warning-palette', `Icon class: ${warningPalette.cls} — expected bg-warning, got something else`);
    }

    await screenshot(page, '06-bell-warning-icon');

  } catch (err) {
    fail('browser-error', err.message.slice(0, 200));
  } finally {
    await browser.close();
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log('\nPhase 3 — Cleanup');
  try {
    await cleanupFixtures(admin);
    pass('cleanup');
  } catch (e) {
    fail('cleanup', e.message);
  }

  await new Promise(r => setTimeout(r, 1000));

  try {
    const remaining = await reEnumerate(admin);
    if (remaining.length === 0) {
      pass('re-enumerate', 'SMOKE-AGENT-CONF re-enumeration EMPTY ✓');
    } else {
      fail('re-enumerate', `Still present: ${remaining.map(d => d.ownerName).join(', ')}`);
    }
  } catch (e) {
    fail('re-enumerate', e.message);
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const total  = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const allPass = passed === total;

  console.log(`\n=== RESULT: ${passed}/${total} ${allPass ? 'passed ✓' : 'FAILED ✗'} ===\n`);

  const tableRows = results.map(r =>
    `| ${r.step} | ${r.status === 'PASS' ? '✓' : '✗'} | ${r.note} |`
  ).join('\n');

  const report = `# h2-agent-conf-surfacing Smoke — ${RUN_TS}

**Result: ${passed}/${total} ${allPass ? 'passed ✓' : 'FAILED ✗'}**

## Step results

| Step | Pass | Note |
|---|---|---|
${tableRows}

## Fixtures
- Smoke tag: \`${SMOKE_TAG}\`
- Policy A: \`${seededPolicyAId}\`
- Policy B: \`${seededPolicyBId}\`
- Notification: \`${seededNotifId}\`
- Screenshots: \`${SS_DIR}\`
`;

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report, 'utf8');
  safeLog('Report:', REPORT_PATH);

  if (!allPass) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
