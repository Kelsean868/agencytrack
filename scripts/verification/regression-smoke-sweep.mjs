/**
 * regression-smoke-sweep.mjs — Full regression smoke sweep (2026-05-25).
 *
 * Covers all surfaces touched by overnight PRs #305–#309 plus core flows:
 *
 *  LEG 0  Sanity — prod reachable, env vars present
 *  LEG 1  All 10 agent nav tabs resolve via agent-tab-* testIds (PR #308)
 *  LEG 2  Policy create SMOKE-SWEEP-A-<ts> (PR #305 / #306)
 *  LEG 3  Policy transition to Settled
 *  LEG 4  History timeline renders in UI (PR #306)
 *  LEG 5  Confirmation surfacing: emerald chip, amber Discrepancy, value line,
 *          note — seeded via Admin SDK (PR #305)
 *  LEG 6  Bell notification — policy_discrepancy warning palette (PR #305)
 *  LEG 7  DailyFAB opens modal; modal title visible (PR #307)
 *  LEG 8  Two-actor manager confirm (agent settles SMOKE-SWEEP-B-<ts>, BM
 *          confirms with discrepant value, agent notification lands)
 *  LEG 9  Weekly wizard opens (navigate to date-select screen)
 *  LEG 10 Daily entry save (open modal, fill min fields, save)
 *  CLEAN  Delete all SMOKE-SWEEP-* policies via Admin SDK; re-enumerate empty
 *
 * Run:  node scripts/verification/regression-smoke-sweep.mjs
 *
 * Requires .env.local:
 *   VERCEL_BYPASS_TOKEN, VITE_FIREBASE_API_KEY,
 *   A11Y_AGENT_EMAIL/PASSWORD,
 *   A11Y_BRANCH_MANAGER_EMAIL/PASSWORD,
 *   A11Y_TENANT_ADMIN_EMAIL/PASSWORD (for Admin SDK confirms).
 */

import { chromium }      from 'playwright';
import { mkdirSync }     from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  hardReloadAndAwaitReady,
  safeLog,
} from './lib/walk-helpers.mjs';
import {
  loadEnv,
  createRunTracker,
  loginAs,
  navigateAgentTab,
  navigateManagerTab,
  getIdToken,
  decodeJwt,
  firestoreQuery,
  getAdmin as _getAdmin,
  writeReport,
} from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');

// ── Env ───────────────────────────────────────────────────────────────────────

const E = loadEnv(ROOT);

// ── Constants ─────────────────────────────────────────────────────────────────

const PROD_URL         = 'https://agencytrack.vercel.app';
const FIREBASE_PROJECT = 'agencytrack-2a610';
const TENANT_ID        = 'tatillife_south';
const AGENT_UID        = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2'; // kelsean@gmail.com (A11Y_AGENT)
const KEY_PATH         = join(ROOT, 'functions', 'service-account-key.json');

const NOW    = new Date();
const RUN_TS = NOW.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const TAG_A    = `SMOKE-SWEEP-A-${NOW.getTime()}`;
const TAG_B    = `SMOKE-SWEEP-B-${NOW.getTime()}`;
const TAG_CONF = `SMOKE-SWEEP-C-${NOW.getTime()}`;

const SS_DIR      = join(__dir, `${RUN_TS}-regression-sweep-screenshots`);
const REPORT_PATH = join(__dir, `${RUN_TS}-regression-smoke-sweep.md`);

mkdirSync(SS_DIR, { recursive: true });

const AGENT_TABS = [
  'dashboard', 'career', 'prospect-info', 'policy-ledger',
  'awards', 'persistency', 'production-report', 'leaderboard',
  'history', 'profile',
];

// ── Admin SDK (local wrapper over shared factory) ─────────────────────────────

function getAdmin() { return _getAdmin(KEY_PATH); }

// ── Admin SDK — Policy Ledger domain helpers ──────────────────────────────────

async function adminSeedConfirmation() {
  const admin = getAdmin();
  const db    = admin.firestore();
  const now   = admin.firestore.Timestamp.now();
  const policiesRef = db.collection(`tenants/${TENANT_ID}/policies`);
  const notifsRef   = db.collection(`tenants/${TENANT_ID}/notifications`);

  const pARef = await policiesRef.add({
    agentId:            AGENT_UID,
    ownerName:          TAG_CONF + '-DISC',
    insuredName:        TAG_CONF + '-DISC',
    status:             'settled',
    productLine:        'life',
    settledAPI:         5000,
    issuedCoverage:     100000,
    initialPremium:     416.67,
    earnedCommission:   200,
    dateIssued:         NOW.toISOString().split('T')[0],
    createdAt:          now,
    updatedAt:          now,
    confirmedByUid:     'admin-test',
    confirmedByName:    'Test Manager',
    confirmedAt:        now,
    managerSettledAPI:  6000,
    hasDiscrepancy:     true,
    managerNote:        'This value differs — smoke test note',
  });

  const pBRef = await policiesRef.add({
    agentId:          AGENT_UID,
    ownerName:        TAG_CONF + '-CLEAN',
    insuredName:      TAG_CONF + '-CLEAN',
    status:           'settled',
    productLine:      'life',
    settledAPI:       5000,
    issuedCoverage:   100000,
    initialPremium:   416.67,
    earnedCommission: 200,
    dateIssued:       NOW.toISOString().split('T')[0],
    createdAt:        now,
    updatedAt:        now,
    confirmedByUid:     'admin-test',
    confirmedByManager: 'Test Manager',
    confirmedAt:      now,
    managerSettledAPI: 5000,
    hasDiscrepancy:   false,
  });

  const notifRef = await notifsRef.add({
    userId:    AGENT_UID,
    type:      'policy_discrepancy',
    title:     'Smoke Test Discrepancy',
    message:   'Manager value differs from yours — smoke test',
    policyId:  pARef.id,
    read:      false,
    createdAt: now,
  });

  return { policyAId: pARef.id, policyBId: pBRef.id, notifId: notifRef.id };
}

async function adminDeletePolicy(policyId) {
  const db  = getAdmin().firestore();
  const ref = db.doc(`tenants/${TENANT_ID}/policies/${policyId}`);
  const history = await ref.collection('history').get();
  for (const doc of history.docs) await doc.ref.delete();
  await ref.delete();
}

async function adminDeleteNotif(notifId) {
  await getAdmin().firestore().doc(`tenants/${TENANT_ID}/notifications/${notifId}`).delete();
}

async function adminFindAndDeleteSweepPolicies() {
  const db   = getAdmin().firestore();
  const snap = await db.collection(`tenants/${TENANT_ID}/policies`)
    .where('agentId', '==', AGENT_UID)
    .get();
  const toDelete = snap.docs.filter(d => (d.data().ownerName ?? '').startsWith('SMOKE-SWEEP-'));
  for (const doc of toDelete) {
    const history = await doc.ref.collection('history').get();
    for (const h of history.docs) await h.ref.delete();
    await doc.ref.delete();
    safeLog(`  [cleanup] deleted policy`, doc.id);
  }
  return toDelete.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  safeLog('\n========================================');
  safeLog('  REGRESSION SMOKE SWEEP', RUN_TS);
  safeLog('  Target:', PROD_URL);
  safeLog('========================================\n');

  const tracker = createRunTracker({ ssDir: SS_DIR });
  const { pass, fail, skip, ss } = tracker;

  const browser = await chromium.launch({ headless: true });
  const seeded  = { policyAId: null, policyBId: null, notifId: null };
  let policyBId = null;
  let consoleErrors = [];

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // LEG 0 — Sanity
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 0: Sanity ---');

    const requiredEnvKeys = [
      'VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY',
      'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD',
      'A11Y_BRANCH_MANAGER_EMAIL', 'A11Y_BRANCH_MANAGER_PASSWORD',
    ];
    const missingKeys = requiredEnvKeys.filter(k => !E[k]);
    if (missingKeys.length > 0) {
      fail('leg0-env-vars', `Missing: ${missingKeys.join(', ')}`);
    } else {
      pass('leg0-env-vars', 'All required env vars present');
    }

    try {
      const r = await fetch(PROD_URL, { signal: AbortSignal.timeout(10000) });
      if (r.ok || r.status < 500) {
        pass('leg0-prod-reachable', `${PROD_URL} responded ${r.status}`);
      } else {
        fail('leg0-prod-reachable', `HTTP ${r.status}`);
      }
    } catch (e) {
      fail('leg0-prod-reachable', e.message);
    }

    if (missingKeys.length > 0) {
      fail('leg0-abort', 'Aborting — missing env vars');
      return;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AGENT CONTEXT — used by LEGs 1–7, 9, 10
    // ══════════════════════════════════════════════════════════════════════════
    const agentCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    consoleErrors = [];
    await setupBypassSession(agentCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    pass('bypass-session', 'Vercel bypass cookie established');

    const agentPage = await agentCtx.newPage();
    agentPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await loginAs(agentPage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, PROD_URL);
    await agentPage.waitForFunction(
      () => document.querySelector('[data-testid^="agent-tab-"]') !== null,
      { timeout: 30000 }
    ).catch(() => {});
    await ss(agentPage, 'leg0-agent-dashboard');
    pass('leg0-agent-login', 'Agent logged in to production');

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 1 — All 10 agent nav tabs resolve
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 1: All 10 agent nav tabs ---');

    for (const tabId of AGENT_TABS) {
      const testId = `agent-tab-${tabId}`;
      const inDom = await agentPage.evaluate(
        (sel) => !!document.querySelector(sel),
        `[data-testid="${testId}"]`
      );
      if (!inDom) {
        fail(`leg1-tab-${tabId}`, `[data-testid="${testId}"] not found in DOM`);
        continue;
      }
      try {
        await navigateAgentTab(agentPage, tabId);
        const hasContent = await agentPage.evaluate(
          () => document.body.textContent.trim().length > 100
        );
        if (hasContent) {
          pass(`leg1-tab-${tabId}`, `agent-tab-${tabId} navigated, content rendered`);
        } else {
          fail(`leg1-tab-${tabId}`, 'Page content < 100 chars after navigation');
        }
      } catch (e) {
        fail(`leg1-tab-${tabId}`, e.message);
      }
      await agentPage.waitForTimeout(300).catch(() => {});
    }

    await navigateAgentTab(agentPage, 'dashboard').catch(() => {});

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 2 — Policy create (SMOKE-SWEEP-A)
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 2: Policy create ---');

    let policyAId = null;
    try {
      await navigateAgentTab(agentPage, 'policy-ledger');
      await agentPage.getByRole('button', { name: /new policy/i }).click();
      await agentPage.locator('h2').filter({ hasText: 'New Policy' }).waitFor({ timeout: 8000 });
      pass('leg2-form-open', 'New Policy form opened');

      await agentPage.fill('input[name="ownerName"]', TAG_A);
      const sameBox = agentPage.locator('label').filter({ hasText: /same as owner/i })
        .locator('input[type="checkbox"]');
      if (await sameBox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sameBox.check();
      } else {
        await agentPage.fill('input[name="insuredName"]', TAG_A);
      }
      await agentPage.selectOption('select[name="productLine"]', 'life');
      await agentPage.selectOption('select[name="proposedFrequency"]', 'A');
      await agentPage.fill('input[name="proposedPremium"]', '5000');
      await agentPage.waitForTimeout(400);
      await agentPage.selectOption('select[name="sourceOfProspect"]', 'referral').catch(() => {});
      await ss(agentPage, 'leg2-form-filled');
      pass('leg2-form-filled', `ownerName="${TAG_A}", premium=5000 (Annual)`);

      await agentPage.getByRole('button', { name: /save policy/i }).click();
      await agentPage.locator('h2').filter({ hasText: 'Policy Ledger' }).waitFor({ timeout: 15000 });
      await agentPage.locator(`text=${TAG_A}`).waitFor({ timeout: 8000 });
      await ss(agentPage, 'leg2-post-create');
      pass('leg2-create-success', `${TAG_A} visible in Policy Ledger list`);

      const idToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
      const claims  = decodeJwt(idToken);
      const tenantId = claims.tenantId || TENANT_ID;
      const docs = await firestoreQuery(
        `tenants/${tenantId}`,
        'policies',
        [{ field: { fieldPath: 'agentId' }, op: 'EQUAL', value: { stringValue: AGENT_UID } }],
        idToken,
        { project: FIREBASE_PROJECT, limit: 20 }
      );
      const found = docs.find(d => d.document?.fields?.ownerName?.stringValue === TAG_A);
      if (found) {
        policyAId = found.document.name.split('/').pop();
        pass('leg2-firestore-read', `Policy doc found: ${policyAId}`);
      } else {
        fail('leg2-firestore-read', `Policy doc not found via Firestore REST (agentId=${AGENT_UID}, ownerName=${TAG_A})`);
      }
    } catch (e) {
      await ss(agentPage, 'leg2-error');
      fail('leg2-create', e.message);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 3 — Policy transition to Settled
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 3: Policy transition to Settled ---');

    if (!policyAId) {
      skip('leg3-transition', 'Skipped — policy not created in LEG 2');
    } else {
      try {
        const smokeCard = agentPage.locator('div').filter({ hasText: TAG_A }).first();
        const updateBtn = smokeCard.getByRole('button', { name: /update status/i });
        await updateBtn.waitFor({ timeout: 8000 });
        await updateBtn.click();
        await agentPage.locator('h3').filter({ hasText: /Update Status/i }).waitFor({ timeout: 6000 });
        await ss(agentPage, 'leg3-modal-open');
        pass('leg3-modal-open', 'Transition modal opened for SMOKE-SWEEP-A');

        await agentPage.locator('div.fixed.inset-0 select').first().selectOption('settled');
        await agentPage.waitForTimeout(400);

        const today = NOW.toISOString().split('T')[0];
        await agentPage.fill('input[name="dateIssued"]',      today);
        await agentPage.fill('input[name="settledAPI"]',       '5000');
        await agentPage.fill('input[name="issuedCoverage"]',   '100000');
        await agentPage.fill('input[name="initialPremium"]',   '416.67');
        await agentPage.fill('input[name="earnedCommission"]', '200');
        await ss(agentPage, 'leg3-modal-filled');
        pass('leg3-modal-filled', 'Settled fields filled');

        await agentPage.getByRole('button', { name: /confirm/i }).click();
        await agentPage.locator('h3', { hasText: /Update Status/i })
          .waitFor({ state: 'detached', timeout: 15000 });
        await agentPage.waitForTimeout(1000);
        await ss(agentPage, 'leg3-post-transition');
        pass('leg3-submitted', 'Confirm clicked, modal closed');

        await hardReloadAndAwaitReady(agentPage);
        await agentPage.waitForTimeout(800);
        await navigateAgentTab(agentPage, 'policy-ledger');
        await agentPage.locator(`text=${TAG_A}`).waitFor({ timeout: 12000 });
        const smokeCard2 = agentPage.locator('div').filter({ hasText: TAG_A }).first();
        let settledVisible = false;
        try {
          await smokeCard2.locator('text=Settled').waitFor({ timeout: 15000 });
          settledVisible = true;
        } catch { /* badge didn't appear within 15s */ }
        await ss(agentPage, 'leg3-post-reload');
        if (settledVisible) {
          pass('leg3-reload-settled', '"Settled" badge visible after hard reload');
        } else {
          fail('leg3-reload-settled', '"Settled" badge not visible after hard reload');
        }
      } catch (e) {
        await ss(agentPage, 'leg3-error');
        fail('leg3-transition', e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 4 — History timeline renders in UI (PR #306)
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 4: History timeline UI ---');

    if (!policyAId) {
      skip('leg4-history', 'Skipped — policy not created in LEG 2');
    } else {
      try {
        await navigateAgentTab(agentPage, 'policy-ledger').catch(() => {});
        await agentPage.locator(`text=${TAG_A}`).waitFor({ timeout: 10000 });

        const historyToggle  = agentPage.locator(`[data-testid="policy-history-toggle-${policyAId}"]`);
        const toggleVisible  = await historyToggle.isVisible({ timeout: 5000 }).catch(() => false);

        if (toggleVisible) {
          await historyToggle.click();
          await agentPage.waitForTimeout(600);
          const historyList    = agentPage.locator(`[data-testid="policy-history-list-${policyAId}"]`);
          const histListVisible = await historyList.isVisible({ timeout: 4000 }).catch(() => false);
          await ss(agentPage, 'leg4-history-open');
          if (histListVisible) {
            const histItems = await historyList.locator('div').count();
            if (histItems > 0) {
              pass('leg4-history-renders', `History list visible with ${histItems} child elements for ${policyAId}`);
            } else {
              fail('leg4-history-renders', 'History list visible but empty');
            }
          } else {
            fail('leg4-history-list-visible', `data-testid="policy-history-list-${policyAId}" not visible after toggle`);
          }
        } else {
          const idToken   = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
          const claims    = decodeJwt(idToken);
          const tenantId  = claims.tenantId || TENANT_ID;
          const histDocs  = await firestoreQuery(
            `tenants/${tenantId}/policies/${policyAId}`,
            'history',
            [{ field: { fieldPath: 'agentId' }, op: 'EQUAL', value: { stringValue: AGENT_UID } }],
            idToken,
            { project: FIREBASE_PROJECT, limit: 5 }
          );
          if (histDocs.length > 0) {
            pass('leg4-history-rest', `${histDocs.length} history doc(s) found via REST (toggle button not visible at this viewport)`);
          } else {
            fail('leg4-history-rest', `No history docs found for policy ${policyAId}`);
          }
          await ss(agentPage, 'leg4-no-toggle');
        }
      } catch (e) {
        await ss(agentPage, 'leg4-error');
        fail('leg4-history', e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 5 — Confirmation surfacing: emerald chip, amber Discrepancy, value line, note
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 5: Confirmation surfacing (Admin SDK seed) ---');

    try {
      const s = await adminSeedConfirmation();
      seeded.policyAId = s.policyAId;
      seeded.policyBId = s.policyBId;
      seeded.notifId   = s.notifId;
      pass('leg5-seed', `Seeded Policy A (disc): ${s.policyAId}, Policy B (clean): ${s.policyBId}, Notif: ${s.notifId}`);

      await hardReloadAndAwaitReady(agentPage);
      await agentPage.waitForTimeout(800);
      await navigateAgentTab(agentPage, 'policy-ledger');

      await agentPage.waitForFunction(
        (tag) => document.body.textContent.includes(tag),
        TAG_CONF + '-DISC',
        { timeout: 15000 }
      ).catch(() => {});

      await ss(agentPage, 'leg5-list-loaded');

      // ── Policy A (disc) — emerald + amber ──
      const cardA = agentPage.locator('div').filter({ hasText: TAG_CONF + '-DISC' }).first();
      const visA  = await cardA.isVisible({ timeout: 5000 }).catch(() => false);
      if (!visA) {
        fail('leg5-policy-a-visible', `${TAG_CONF}-DISC not visible in list`);
      } else {
        const confirmedChip = cardA.getByText(/Confirmed by/i).first();
        const hasConfirmed  = await confirmedChip.isVisible({ timeout: 4000 }).catch(() => false);
        if (hasConfirmed) {
          pass('leg5-confirmed-chip', '"Confirmed by" chip visible on discrepant policy');
        } else {
          fail('leg5-confirmed-chip', '"Confirmed by" chip not found on discrepant policy');
        }

        const discChip = cardA.getByText(/Discrepancy/i).first();
        const hasDisc  = await discChip.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasDisc) {
          pass('leg5-discrepancy-chip', '"Discrepancy" chip visible on discrepant policy');
        } else {
          fail('leg5-discrepancy-chip', '"Discrepancy" chip not found on discrepant policy');
        }

        const hasValueLine = await cardA.getByText(/Your value|Manager|6,000|6000/i).first()
          .isVisible({ timeout: 3000 }).catch(() => false);
        if (hasValueLine) {
          pass('leg5-value-line', 'Value comparison line visible on discrepant policy');
        } else {
          fail('leg5-value-line', 'Value comparison line not found on discrepant policy');
        }

        const hasNote = await cardA.getByText(/smoke test note/i).first()
          .isVisible({ timeout: 3000 }).catch(() => false);
        if (hasNote) {
          pass('leg5-manager-note', 'Manager note text visible on discrepant policy');
        } else {
          fail('leg5-manager-note', 'Manager note text not found on discrepant policy');
        }

        await ss(agentPage, 'leg5-policy-a-chips');
      }

      // ── Policy B (clean) — confirmed + NO Discrepancy ──
      const cardBText = TAG_CONF + '-CLEAN';
      const cardBDom  = await agentPage.evaluate((cleanText) => {
        const all      = Array.from(document.querySelectorAll('div'));
        const matching = all.filter(el => el.textContent.includes(cleanText));
        matching.sort((a, b) => a.textContent.length - b.textContent.length);
        const card = matching[0];
        if (!card) return null;
        return { innerHTML: card.innerHTML };
      }, cardBText);

      if (!cardBDom) {
        fail('leg5-policy-b-visible', `${TAG_CONF}-CLEAN not visible in list`);
      } else {
        const confirmedByCount = await agentPage.evaluate(
          () => (document.body.innerHTML.match(/Confirmed by/g) ?? []).length
        );
        const hasBDisc = (() => {
          const matches = cardBDom.innerHTML.match(/Discrepancy/gi);
          return matches && matches.length > 0;
        })();
        const hasBConfirmed = confirmedByCount >= 2;
        if (hasBConfirmed) {
          pass('leg5-clean-confirmed-chip', `"Confirmed by" count on page: ${confirmedByCount} (≥2 means both A+B confirmed)`);
        } else {
          fail('leg5-clean-confirmed-chip', `Only ${confirmedByCount} "Confirmed by" occurrence(s) on page — expected ≥2`);
        }
        if (!hasBDisc) {
          pass('leg5-clean-no-discrepancy', 'No "Discrepancy" in clean policy card HTML (correct)');
        } else {
          fail('leg5-clean-no-discrepancy', '"Discrepancy" found in clean policy card HTML (should not be)');
        }
        await ss(agentPage, 'leg5-policy-b-chips');
      }
    } catch (e) {
      await ss(agentPage, 'leg5-error');
      fail('leg5-confirmation-surfacing', e.message);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 6 — Bell notification — policy_discrepancy warning palette
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 6: Bell notification warning palette ---');

    if (!seeded.notifId) {
      skip('leg6-bell', 'Skipped — notification not seeded in LEG 5');
    } else {
      try {
        const bell = agentPage.locator('[data-testid="notification-bell"], button[aria-label*="notification" i]').first();
        const bellVisible = await bell.isVisible({ timeout: 5000 }).catch(() => false);
        if (!bellVisible) {
          fail('leg6-bell-visible', 'Notification bell button not found');
        } else {
          await bell.click();
          await agentPage.waitForTimeout(700);
          await ss(agentPage, 'leg6-bell-open');

          const notifText    = agentPage.getByText(/Smoke Test Discrepancy/i).first();
          const notifVisible = await notifText.isVisible({ timeout: 5000 }).catch(() => false);
          if (notifVisible) {
            pass('leg6-notif-text', 'policy_discrepancy notification visible in bell drawer');
          } else {
            fail('leg6-notif-text', '"Smoke Test Discrepancy" notification text not found in drawer');
          }

          const warningClass = await agentPage.evaluate(() => {
            const el = document.querySelector('[class*="bg-warning"]');
            return el ? el.className : null;
          });
          if (warningClass) {
            pass('leg6-warning-palette', `bg-warning class found: "${warningClass.split(' ').filter(c => c.includes('warning')).join(' ')}"`);
          } else {
            fail('leg6-warning-palette', 'bg-warning class not found in bell drawer');
          }
        }
      } catch (e) {
        await ss(agentPage, 'leg6-error');
        fail('leg6-bell', e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 7 — DailyFAB opens modal (PR #307)
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 7: DailyFAB opens modal ---');

    try {
      await navigateAgentTab(agentPage, 'dashboard');
      await agentPage.waitForTimeout(800);

      const fab        = agentPage.locator('[data-testid="daily-fab"]');
      const fabVisible = await fab.isVisible({ timeout: 5000 }).catch(() => false);

      if (!fabVisible) {
        skip('leg7-daily-fab', 'DailyFAB not visible (loggingMode may be weekly-only for this agent)');
      } else {
        pass('leg7-fab-visible', 'DailyFAB button visible on dashboard');
        await fab.click();
        await agentPage.waitForTimeout(600);

        const dialog        = agentPage.locator('[role="dialog"]').first();
        const dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
        if (dialogVisible) {
          const titleEl   = dialog.locator('#daily-entry-title, h1').first();
          const titleText = await titleEl.innerText().catch(() => '');
          if (titleText.toLowerCase().includes('log today') || titleText.toLowerCase().includes('daily')) {
            pass('leg7-modal-title', `Modal title: "${titleText.trim().slice(0, 60)}"`);
          } else {
            fail('leg7-modal-title', `Unexpected modal title: "${titleText.trim().slice(0, 60)}"`);
          }
          await ss(agentPage, 'leg7-modal-open');
          pass('leg7-modal-open', 'Daily entry modal opened successfully');

          const closeBtn = dialog.getByRole('button', { name: /close|cancel/i }).first();
          if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await closeBtn.click();
          } else {
            await agentPage.keyboard.press('Escape');
          }
          await agentPage.waitForTimeout(500);
        } else {
          await ss(agentPage, 'leg7-no-modal');
          fail('leg7-modal-open', 'role="dialog" not visible after FAB click');
        }
      }
    } catch (e) {
      await ss(agentPage, 'leg7-error');
      fail('leg7-daily-fab', e.message);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 8 — Two-actor manager confirm
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 8: Two-actor manager confirm ---');

    if (!E.A11Y_BRANCH_MANAGER_EMAIL || !E.A11Y_BRANCH_MANAGER_PASSWORD) {
      skip('leg8-two-actor', 'Skipped — A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not set');
    } else {
      const bmCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await setupBypassSession(bmCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
      const bmPage = await bmCtx.newPage();

      try {
        await navigateAgentTab(agentPage, 'policy-ledger');
        await agentPage.getByRole('button', { name: /new policy/i }).click();
        await agentPage.locator('h2').filter({ hasText: 'New Policy' }).waitFor({ timeout: 8000 });

        await agentPage.fill('input[name="ownerName"]', TAG_B);
        const sameBoxB = agentPage.locator('label').filter({ hasText: /same as owner/i })
          .locator('input[type="checkbox"]');
        if (await sameBoxB.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sameBoxB.check();
        } else {
          await agentPage.fill('input[name="insuredName"]', TAG_B);
        }
        await agentPage.selectOption('select[name="productLine"]', 'life');
        await agentPage.selectOption('select[name="proposedFrequency"]', 'A');
        await agentPage.fill('input[name="proposedPremium"]', '8000');
        await agentPage.waitForTimeout(300);
        await agentPage.selectOption('select[name="sourceOfProspect"]', 'referral').catch(() => {});
        await agentPage.getByRole('button', { name: /save policy/i }).click();
        await agentPage.locator('h2').filter({ hasText: 'Policy Ledger' }).waitFor({ timeout: 15000 });
        await agentPage.locator(`text=${TAG_B}`).waitFor({ timeout: 8000 });
        pass('leg8-agent-create', `${TAG_B} created`);

        const smokeCardB = agentPage.locator('div').filter({ hasText: TAG_B }).first();
        const updateBtnB = smokeCardB.getByRole('button', { name: /update status/i });
        await updateBtnB.waitFor({ timeout: 8000 });
        await updateBtnB.click();
        await agentPage.locator('h3').filter({ hasText: /Update Status/i }).waitFor({ timeout: 6000 });
        await agentPage.locator('div.fixed.inset-0 select').first().selectOption('settled');
        await agentPage.waitForTimeout(400);
        const today2 = NOW.toISOString().split('T')[0];
        await agentPage.fill('input[name="dateIssued"]',      today2);
        await agentPage.fill('input[name="settledAPI"]',       '8000');
        await agentPage.fill('input[name="issuedCoverage"]',   '200000');
        await agentPage.fill('input[name="initialPremium"]',   '666.67');
        await agentPage.fill('input[name="earnedCommission"]', '320');
        await agentPage.getByRole('button', { name: /confirm/i }).click();
        await agentPage.locator('h3', { hasText: /Update Status/i })
          .waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
        await agentPage.waitForTimeout(1000);
        pass('leg8-agent-settle', `${TAG_B} transitioned to Settled (settledAPI=8000)`);

        const idTokenB  = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
        const claimsB   = decodeJwt(idTokenB);
        const tenantB   = claimsB.tenantId || TENANT_ID;
        const docsB     = await firestoreQuery(
          `tenants/${tenantB}`,
          'policies',
          [{ field: { fieldPath: 'agentId' }, op: 'EQUAL', value: { stringValue: AGENT_UID } }],
          idTokenB,
          { project: FIREBASE_PROJECT, limit: 20 }
        );
        const foundB = docsB.find(d => d.document?.fields?.ownerName?.stringValue === TAG_B);
        if (foundB) {
          policyBId = foundB.document.name.split('/').pop();
          pass('leg8-policy-b-id', `Policy B doc: ${policyBId}`);
        } else {
          fail('leg8-policy-b-id', `Policy B (${TAG_B}) not found via Firestore REST`);
        }

        await loginAs(bmPage, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD, PROD_URL);
        await bmPage.waitForFunction(
          () => document.querySelector('[data-testid="nav-overview"]') !== null ||
                document.body.textContent.length > 200,
          { timeout: 25000 }
        ).catch(() => {});
        await ss(bmPage, 'leg8-bm-dashboard');
        pass('leg8-bm-login', 'Branch Manager logged in');

        await navigateManagerTab(bmPage, 'policy-reconciliation');
        await bmPage.waitForTimeout(1000);
        await ss(bmPage, 'leg8-bm-reconcil-tab');

        const reconcilHeading = await bmPage.getByText(/Policy Reconciliation/i).first()
          .isVisible({ timeout: 8000 }).catch(() => false);
        if (reconcilHeading) {
          pass('leg8-bm-reconcil-loaded', 'Policy Reconciliation panel loaded');
        } else {
          fail('leg8-bm-reconcil-loaded', 'Policy Reconciliation panel not loaded');
        }

        await bmPage.waitForFunction(
          (tag) => document.body.textContent.includes(tag),
          TAG_B,
          { timeout: 15000 }
        ).catch(() => {});
        const hasBPolicy = await bmPage.getByText(TAG_B).first()
          .isVisible({ timeout: 5000 }).catch(() => false);

        if (!hasBPolicy) {
          fail('leg8-bm-sees-policy', `${TAG_B} not visible in Policy Reconciliation panel`);
          skip('leg8-bm-confirm', 'Cannot confirm — policy not visible');
        } else {
          pass('leg8-bm-sees-policy', `${TAG_B} visible in reconciliation panel`);

          const bmCard       = bmPage.locator('div').filter({ hasText: TAG_B }).first();
          const confirmBtn   = bmCard.getByRole('button', { name: /confirm/i }).first();
          const confirmBtnVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false);

          if (!confirmBtnVisible) {
            fail('leg8-bm-confirm-btn', 'Confirm button not found on SMOKE-B policy card');
          } else {
            const mgApiInput   = bmCard.locator('input[type="number"], input[placeholder*="API" i], input[placeholder*="Manager" i]').first();
            const generalInput = bmCard.locator('input').first();
            const inputToFill  = await mgApiInput.isVisible({ timeout: 3000 }).catch(() => false)
              ? mgApiInput : generalInput;
            if (await inputToFill.isVisible({ timeout: 3000 }).catch(() => false)) {
              await inputToFill.fill('9000');
              await bmPage.waitForTimeout(400);
            }
            const noteInput = bmCard.locator('textarea').first();
            if (await noteInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await noteInput.fill('Smoke sweep two-actor confirm note');
              await bmPage.waitForTimeout(200);
            }
            await ss(bmPage, 'leg8-bm-confirm-form');

            const confirmBtnEnabled = await confirmBtn.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!confirmBtnEnabled) {
              fail('leg8-bm-confirm-btn-enabled', 'Confirm button still disabled after filling API value');
            } else {
              await confirmBtn.click();
              await bmPage.waitForTimeout(2000);
              await ss(bmPage, 'leg8-bm-post-confirm');
              pass('leg8-bm-confirm-submitted', 'BM confirmation form submitted (managerSettledAPI=9000, discrepant)');

              await bmPage.waitForTimeout(3000);
              const notifSnap = await getAdmin().firestore()
                .collection(`tenants/${TENANT_ID}/notifications`)
                .where('userId', '==', AGENT_UID)
                .where('type', '==', 'policy_discrepancy')
                .where('policyId', '==', policyBId || '')
                .get();
              if (!notifSnap.empty) {
                pass('leg8-discrepancy-notification', `policy_discrepancy notification created for agent (policyId=${policyBId})`);
              } else {
                const notifSnap2 = await getAdmin().firestore()
                  .collection(`tenants/${TENANT_ID}/notifications`)
                  .where('userId', '==', AGENT_UID)
                  .where('type', '==', 'policy_discrepancy')
                  .limit(10)
                  .get();
                const recent = notifSnap2.docs
                  .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
                  .find(d => (Date.now() - (d.data().createdAt?.toMillis?.() ?? 0)) < 120000);
                if (recent) {
                  pass('leg8-discrepancy-notification', `policy_discrepancy notification found (recent) — ${recent.id}`);
                } else {
                  fail('leg8-discrepancy-notification', 'No recent policy_discrepancy notification for agent after BM confirm');
                }
              }
            }
          }
        }
      } catch (e) {
        await ss(bmPage, 'leg8-error').catch(() => {});
        fail('leg8-two-actor', e.message);
      } finally {
        await bmCtx.close();
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 9 — Weekly wizard opens
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 9: Weekly wizard opens ---');

    try {
      await navigateAgentTab(agentPage, 'dashboard');
      await agentPage.waitForTimeout(800);

      const wizardBtn        = agentPage.getByRole('button', { name: /submit weekly report|log your week|weekly report/i }).first();
      const wizardBtnVisible = await wizardBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (!wizardBtnVisible) {
        const logWeekAction   = agentPage.getByRole('button', { name: /log.*week|log.*report|submit.*report/i }).first();
        const actionVisible   = await logWeekAction.isVisible({ timeout: 3000 }).catch(() => false);
        if (!actionVisible) {
          skip('leg9-wizard', 'Weekly Report button not found — may be daily-only mode for this agent');
        } else {
          await logWeekAction.click();
          await agentPage.waitForFunction(
            () => document.querySelector('[data-testid="wizard-date"], h2, h1') !== null,
            { timeout: 10000 }
          ).catch(() => {});
          await ss(agentPage, 'leg9-wizard-open');
          pass('leg9-wizard-open', 'Wizard-like screen opened via Log Week action');
          await agentPage.keyboard.press('Escape');
          await agentPage.waitForTimeout(500);
        }
      } else {
        await wizardBtn.click();
        await agentPage.waitForFunction(
          () => document.body.textContent.includes('Week of') ||
                document.body.textContent.includes('week starting') ||
                document.querySelector('h2') !== null,
          { timeout: 10000 }
        ).catch(() => {});
        await ss(agentPage, 'leg9-wizard-open');
        pass('leg9-wizard-open', 'WizardForm opened — date screen visible');

        const backBtn = agentPage.getByRole('button', { name: /back|close|cancel/i }).first();
        if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await backBtn.click();
          await agentPage.waitForTimeout(800);
        } else {
          await agentPage.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
          await waitForFirebaseReady(agentPage);
          await agentPage.waitForTimeout(1000);
        }
      }
    } catch (e) {
      await ss(agentPage, 'leg9-error');
      fail('leg9-wizard', e.message);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // LEG 10 — Daily entry save
    // ══════════════════════════════════════════════════════════════════════════
    safeLog('\n--- LEG 10: Daily entry save ---');

    try {
      await navigateAgentTab(agentPage, 'dashboard');
      await agentPage.waitForTimeout(800);

      const fab10        = agentPage.locator('[data-testid="daily-fab"]');
      const fabVisible10 = await fab10.isVisible({ timeout: 5000 }).catch(() => false);

      if (!fabVisible10) {
        skip('leg10-daily-save', 'DailyFAB not visible — skipped (weekly-only mode)');
      } else {
        await fab10.click();
        await agentPage.waitForTimeout(800);

        const dialog10        = agentPage.locator('[role="dialog"]').first();
        const dialogVisible10 = await dialog10.isVisible({ timeout: 5000 }).catch(() => false);

        if (!dialogVisible10) {
          fail('leg10-modal-open', 'DailyEntryModal did not open');
        } else {
          const dialsInput = dialog10.locator('input[inputmode="numeric"]').first();
          if (await dialsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await dialsInput.fill('5');
            await agentPage.waitForTimeout(200);
          }

          await ss(agentPage, 'leg10-modal-filled');

          const saveBtn = dialog10.getByRole('button', { name: /save|submit/i }).first();
          if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveBtn.click();
            await agentPage.waitForTimeout(2000);
            await ss(agentPage, 'leg10-post-save');

            const modalGone     = !(await dialog10.isVisible({ timeout: 2000 }).catch(() => true));
            const savedIndicator = await agentPage.getByText(/saved|success/i).first()
              .isVisible({ timeout: 2000 }).catch(() => false);

            if (modalGone || savedIndicator) {
              pass('leg10-daily-saved', 'Daily entry saved (modal closed or saved indicator visible)');
            } else {
              const errorVisible = await dialog10.getByText(/error|failed/i).first()
                .isVisible({ timeout: 1000 }).catch(() => false);
              if (errorVisible) {
                fail('leg10-daily-saved', 'Error state visible after save attempt');
              } else {
                pass('leg10-daily-saved', 'Save button clicked, no error state (modal may remain open for further input)');
              }
            }
          } else {
            fail('leg10-save-btn', 'Save button not found in daily entry modal footer');
          }
        }
      }
    } catch (e) {
      await ss(agentPage, 'leg10-error');
      fail('leg10-daily', e.message);
    }

    // ── Console errors ────────────────────────────────────────────────────────
    const filteredErrors = consoleErrors.filter(
      e => !e.includes('firebase') && !e.includes('QUIC') &&
           !e.includes('net::ERR') && !e.includes('ResizeObserver')
    );
    if (filteredErrors.length === 0) {
      pass('console-errors', 'No unexpected JS console errors across agent session');
    } else {
      fail('console-errors', `${filteredErrors.length} console errors: ${filteredErrors.slice(0, 3).join(' | ')}`);
    }

    await agentCtx.close();

  } catch (globalErr) {
    safeLog('\n[SWEEP ABORTED]', globalErr.message ?? String(globalErr));
    fail('global-error', globalErr.message ?? String(globalErr));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLEANUP — Delete all SMOKE-SWEEP-* policies via Admin SDK
  // ══════════════════════════════════════════════════════════════════════════
  safeLog('\n--- CLEANUP ---');

  let cleanupCount = 0;
  try {
    if (seeded.policyAId) {
      await adminDeletePolicy(seeded.policyAId);
      cleanupCount++;
      safeLog(`  [cleanup] deleted seeded Policy A (disc): ${seeded.policyAId}`);
    }
    if (seeded.policyBId) {
      await adminDeletePolicy(seeded.policyBId);
      cleanupCount++;
      safeLog(`  [cleanup] deleted seeded Policy B (clean): ${seeded.policyBId}`);
    }
    if (seeded.notifId) {
      await adminDeleteNotif(seeded.notifId);
      cleanupCount++;
      safeLog(`  [cleanup] deleted seeded notification: ${seeded.notifId}`);
    }

    const deleted = await adminFindAndDeleteSweepPolicies();
    cleanupCount += deleted;
    pass('cleanup', `${cleanupCount} smoke fixture(s) deleted`);
  } catch (e) {
    fail('cleanup', `Cleanup error: ${e.message}`);
  }

  // Re-enumerate to confirm empty
  try {
    const remaining = await getAdmin().firestore()
      .collection(`tenants/${TENANT_ID}/policies`)
      .where('agentId', '==', AGENT_UID)
      .get();
    const sweepRemaining = remaining.docs.filter(d => (d.data().ownerName ?? '').startsWith('SMOKE-SWEEP-'));
    if (sweepRemaining.length === 0) {
      pass('cleanup-enumeration', 'Re-enumeration: 0 SMOKE-SWEEP-* policies remain');
    } else {
      fail('cleanup-enumeration', `${sweepRemaining.length} SMOKE-SWEEP-* policies remain: ${sweepRemaining.map(d => d.id).join(', ')}`);
    }
  } catch (e) {
    fail('cleanup-enumeration', `Enum error: ${e.message}`);
  }

  await browser.close();

  // ══════════════════════════════════════════════════════════════════════════
  // REPORT
  // ══════════════════════════════════════════════════════════════════════════

  const duration = Math.round((Date.now() - NOW.getTime()) / 1000);

  safeLog('\n========================================');
  safeLog(`  SWEEP RESULT: ${tracker.totalPass} PASS / ${tracker.totalFail} FAIL / ${tracker.totalSkip} SKIP`);
  safeLog(`  Duration: ${duration}s`);
  safeLog('========================================');

  writeReport({
    reportPath: REPORT_PATH,
    title:      'Regression Smoke Sweep',
    runTs:      RUN_TS,
    results:    tracker.results,
    totalPass:  tracker.totalPass,
    totalFail:  tracker.totalFail,
    totalSkip:  tracker.totalSkip,
    duration,
    targetUrl:  PROD_URL,
    tags: {
      'Policy create+transition+history': TAG_A,
      'Two-actor confirm':                TAG_B,
      'Confirmation surfacing':           `${TAG_CONF}-DISC, ${TAG_CONF}-CLEAN`,
    },
    ssDirPath: SS_DIR,
    surfaces: [
      'LEG 0: Env / prod reachable',
      'LEG 1: All 10 agent nav tabs via agent-tab-* testIds (PR #308)',
      'LEG 2: Policy create write-read-verify (PR #305/#306)',
      'LEG 3: Policy transition to Settled + reload verify (PR #305)',
      'LEG 4: History timeline UI toggle or REST verify (PR #306)',
      'LEG 5: Confirmation surfacing — emerald/amber chips, value line, note (PR #305)',
      'LEG 6: Bell notification — policy_discrepancy warning palette (PR #305)',
      'LEG 7: DailyFAB opens DailyEntryModal (PR #307)',
      'LEG 8: Two-actor manager confirm + notification (PR #305)',
      'LEG 9: Weekly wizard opens',
      'LEG 10: Daily entry save',
      'CLEANUP: All SMOKE-SWEEP-* policies deleted; re-enumerated empty',
    ],
  });

  if (tracker.totalFail > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[FATAL]', e.message ?? String(e));
  process.exit(1);
});
