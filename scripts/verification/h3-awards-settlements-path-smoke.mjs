/**
 * h3-awards-settlements-path-smoke.mjs
 *
 * Verifies that AgentAwardsPanel still renders via the settlements path after
 * H3 (usesPolicyLedger flag) merged. The test agent has no usesPolicyLedger
 * field (or false), so the panel MUST use the settlements path — same as pre-H3.
 *
 * Steps:
 *   1. Firestore REST — confirm test agent doc has usesPolicyLedger absent/false
 *   2. Navigate to Awards tab as test agent
 *   3. Confirm panel renders with content (no blank/error/loading-spinner-only)
 *   4. Screenshot proof
 *
 * No seed, no cleanup — read-only verification.
 *
 * Usage: node scripts/verification/h3-awards-settlements-path-smoke.mjs
 */

import { chromium }      from 'playwright';
import { mkdirSync }     from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  safeLog,
} from './lib/walk-helpers.mjs';
import {
  loadEnv,
  createRunTracker,
  loginAs,
  navigateAgentTab,
  getIdToken,
  decodeJwt,
  firestoreGet,
} from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');
const E     = loadEnv(ROOT);

const PROD_URL         = 'https://agencytrack.vercel.app';
const FIREBASE_PROJECT = 'agencytrack-2a610';
const TENANT_ID        = 'tatillife_south';
const AGENT_UID        = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';

const NOW    = new Date();
const RUN_TS = NOW.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SS_DIR = join(__dir, `${RUN_TS}-h3-awards-smoke-screenshots`);
mkdirSync(SS_DIR, { recursive: true });

async function main() {
  safeLog('\n========================================');
  safeLog('  H3 AWARDS SETTLEMENTS-PATH SMOKE', RUN_TS);
  safeLog('  Target:', PROD_URL);
  safeLog('========================================\n');

  const tracker = createRunTracker({ ssDir: SS_DIR });
  const { pass, fail, skip, ss } = tracker;

  // ── Step 0 — Env check ────────────────────────────────────────────────────
  const required = ['VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing  = required.filter(k => !E[k]);
  if (missing.length) { fail('env-check', `Missing: ${missing.join(', ')}`); process.exit(1); }
  pass('env-check', 'Required env vars present');

  // ── Step 1 — Firestore REST: confirm usesPolicyLedger absent/false ─────────
  try {
    const idToken  = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
    const claims   = decodeJwt(idToken);
    const tenantId = claims.tenantId || TENANT_ID;

    const { ok, body } = await firestoreGet(
      `tenants/${tenantId}/users/${AGENT_UID}`,
      idToken,
      FIREBASE_PROJECT
    );

    if (!ok) {
      fail('agent-doc-read', `Firestore REST returned non-OK: ${body?.error?.status ?? 'unknown'}`);
    } else {
      const fields = body.fields ?? {};
      const rawFlag = fields.usesPolicyLedger;
      let flagValue = null;
      if (rawFlag === undefined) {
        flagValue = 'absent';
      } else if (rawFlag.booleanValue !== undefined) {
        flagValue = rawFlag.booleanValue;
      } else {
        flagValue = JSON.stringify(rawFlag);
      }
      if (flagValue === 'absent' || flagValue === false) {
        pass('flag-absent-or-false', `usesPolicyLedger = ${flagValue} — settlements path will be used`);
      } else {
        fail('flag-absent-or-false', `usesPolicyLedger = ${flagValue} — expected absent/false; agent is on ledger path (unexpected for this smoke)`);
      }
    }
  } catch (e) {
    fail('agent-doc-read', e.message);
  }

  // ── Step 2 — Browser: Awards tab renders via settlements path ─────────────
  const browser  = await chromium.launch({ headless: true });
  const agentCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  try {
    await setupBypassSession(agentCtx, PROD_URL, E.VERCEL_BYPASS_TOKEN);
    pass('bypass-session', 'Vercel bypass cookie established');

    const agentPage = await agentCtx.newPage();
    await loginAs(agentPage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, PROD_URL);
    await agentPage.waitForFunction(
      () => document.querySelector('[data-testid^="agent-tab-"]') !== null,
      { timeout: 30000 }
    ).catch(() => {});
    pass('agent-login', 'Test agent logged in to production');

    await navigateAgentTab(agentPage, 'awards');
    await agentPage.waitForTimeout(2000);
    await ss(agentPage, '01-awards-tab');

    // Panel must have substantive content — check for known awards-panel text patterns
    const bodyText = await agentPage.evaluate(() => document.body.textContent.trim());

    // Should NOT be empty / loading-only
    const hasContent = bodyText.length > 200;
    if (hasContent) {
      pass('panel-has-content', `Awards panel rendered with ${bodyText.length} chars of content`);
    } else {
      fail('panel-has-content', `Awards panel content too short (${bodyText.length} chars) — may be loading/empty state`);
    }

    // Should NOT show an error banner
    const hasError = await agentPage.getByText(/something went wrong|failed to load|error/i).first()
      .isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasError) {
      pass('no-error-state', 'No error banner in awards panel');
    } else {
      fail('no-error-state', 'Error state visible in awards panel after H3 merge');
    }

    // At least one award-like element should be visible (tab buttons for Club/Monthly/etc.)
    const hasTabs = await agentPage.locator('[role="tab"], [role="tablist"]').first()
      .isVisible({ timeout: 3000 }).catch(() => false);
    if (hasTabs) {
      pass('award-tabs-visible', 'Award tabs (role=tab/tablist) visible — panel structure intact');
    } else {
      // Acceptable if awards are rendered differently — fall back to text heuristic
      const hasAwardKeywords = /club|monthly|annual|awards|bronze|silver|gold|achieved|on track/i.test(bodyText);
      if (hasAwardKeywords) {
        pass('award-keywords-visible', 'Awards content keywords present in panel body');
      } else {
        fail('award-content', 'No award tabs or keywords found — panel may be in empty/error state');
      }
    }

    // Screenshot for proof
    await ss(agentPage, '02-awards-final');
    pass('screenshot-captured', `Screenshots saved to ${SS_DIR}`);

    await agentCtx.close();
  } catch (e) {
    fail('browser-smoke', e.message);
    await agentCtx.close().catch(() => {});
  } finally {
    await browser.close();
  }

  // ── Result ────────────────────────────────────────────────────────────────
  safeLog('\n========================================');
  safeLog(`  RESULT: ${tracker.totalPass} PASS / ${tracker.totalFail} FAIL / ${tracker.totalSkip} SKIP`);
  safeLog('========================================\n');

  for (const r of tracker.results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '~';
    safeLog(`  ${icon} ${r.step}`, r.note || undefined);
  }

  if (tracker.totalFail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[FATAL]', e.message ?? String(e));
  process.exit(1);
});
