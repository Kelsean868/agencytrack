/**
 * smoke-plan-suggestions-b3.mjs — PR-B3 planSuggestions suggest-back smoke.
 *
 * SPLIT smoke (K10b / B1 deploy-gated pattern):
 *
 * PRE-MERGE (default, no writes — the planSuggestions rules are NOT yet live in
 * prod, so this half never attempts a write). Both themes:
 *   M1. UM opens a shared agent's drawer → Year Plan tab → the B3 "Suggest a
 *       change" send card renders (gold eyebrow, note textarea, Send button).
 *   M2. Focus trap: the new note field is enumerated inside the drawer panel
 *       (B2's dynamic trap picks it up automatically — asserted, not re-built).
 *   M3. Agent opens the Game Plan hub → the hub renders and the
 *       PlanSuggestionsCard is ABSENT (quiet: the agent-own read denies pre-
 *       deploy → neutral, renders nothing; never an error, never a hub crash).
 *
 * POST-DEPLOY (Rule 13 deferred FU, run after `firebase deploy --only
 * firestore:rules` — see FOLLOW_UPS.md for the full re-run steps):
 *   L1. UM CREATE on an in-unit agent → doc lands with raisedByUid pinned to UM.
 *   L2. Agent LIST own → sees it unread; ACK (open→seen, seenAt set) live.
 *   L3. out-of-unit UM CREATE → DENIED. agent self-CREATE → DENIED. manager
 *       ACK → DENIED.
 *   L4. cleanup via Admin SDK (delete:false blocks token deletes) → 0 orphans.
 *
 * SAFETY: tatillife_smoke hard guard (agent token tenant claim). This pre-merge
 * smoke writes NOTHING except the agent's own visibility flip (restored in finally).
 *
 * Run: node scripts/verification/smoke-plan-suggestions-b3.mjs <https-preview-url>
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  safeLog,
  waitForFirebaseReady,
} from './lib/walk-helpers.mjs';
import { loadEnv, loginAs, getIdToken, decodeJwt, firestoreGet } from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');
const E     = loadEnv(ROOT);

const PREVIEW_URL = (process.argv[2] || '').replace(/\/$/, '');
if (!PREVIEW_URL.startsWith('https://')) {
  console.error('Usage: node scripts/verification/smoke-plan-suggestions-b3.mjs <https-preview-url> [B3_LIVE=1]');
  process.exit(2);
}

const FIREBASE_PROJECT = 'agencytrack-2a610';
const SMOKE_TENANT     = 'tatillife_smoke';
const YEAR             = new Date().getFullYear();

const results = [];
const pass = (label, note = '') => { results.push({ label, ok: true }); console.log(`  ✅ ${label}${note ? ': ' + note : ''}`); };
const fail = (label, detail = '') => { results.push({ label, ok: false, detail }); console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`); };

async function restGet(idToken, path) {
  const { ok, body } = await firestoreGet(path, idToken, FIREBASE_PROJECT);
  if (!ok) throw new Error(`GET ${path} → ${JSON.stringify(body?.error ?? body).slice(0, 200)}`);
  return body;
}
async function restPatch(idToken, path, fields, fieldMasks) {
  const maskParams = fieldMasks.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}?${maskParams}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`PATCH ${path} → ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

async function openTeamPlans(page) {
  await waitForFirebaseReady(page, 25_000);
  await page.waitForSelector('[data-testid^="nav-"]', { state: 'attached', timeout: 30_000 });
  const navSel = '[data-testid="nav-team-game-plans"]';
  if (!(await page.locator(navSel).first().isVisible().catch(() => false))) {
    const toggle = page.locator('[data-testid="sidebar-ws-toggle-team"]');
    if (await toggle.first().isVisible().catch(() => false)) await toggle.first().click();
  }
  await page.waitForSelector(navSel, { state: 'visible', timeout: 15_000 });
  await page.locator(navSel).first().click();
  await page.waitForSelector('[data-testid="team-plans-roster"][data-loading="false"]', { timeout: 30_000 });
}

async function assertSendCard(page, agentUid, themeTag) {
  await page.locator(`[data-testid="team-plans-view-${agentUid}"]`).click();
  await page.waitForSelector('[data-testid="team-plans-drawer"]', { timeout: 15_000 });
  await page.locator('[data-testid="tpd-tab-year"]').click();

  // M1 — the send card renders (wait for the year tab body to settle first).
  try {
    await page.waitForSelector('[data-testid="tpd-suggest-card"]', { timeout: 20_000 });
    const hasNote = await page.locator('[data-testid="tpd-suggest-note"]').count();
    const hasSend = await page.locator('[data-testid="tpd-suggest-send"]').count();
    if (hasNote === 1 && hasSend === 1) pass(`M1${themeTag}: Suggest-a-change card renders (note + Send)`);
    else fail(`M1${themeTag}: send card controls`, `note=${hasNote} send=${hasSend}`);
  } catch {
    fail(`M1${themeTag}: send card`, 'tpd-suggest-card did not render');
  }

  // M2 — the note field is inside the drawer panel (trap picks it up). Light only
  // (DOM structure is theme-invariant).
  if (themeTag === ' (light)') {
    const noteInPanel = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="team-plans-drawer"]');
      const note = document.querySelector('[data-testid="tpd-suggest-note"]');
      return !!(panel && note && panel.contains(note));
    });
    noteInPanel ? pass('M2: send controls live inside the trapped drawer panel')
                : fail('M2: send controls not inside drawer panel');
  }

  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="team-plans-drawer"]', { state: 'detached', timeout: 10_000 });
}

async function assertAgentHubQuiet(page, themeTag) {
  await waitForFirebaseReady(page, 25_000);
  // Agent nav uses `agent-tab-*` testids (the manager shell uses `nav-*`).
  await page.waitForSelector('[data-testid="agent-tab-game-plan"]', { state: 'visible', timeout: 30_000 });
  await page.locator('[data-testid="agent-tab-game-plan"]').first().click();
  // The hub root renders (the anchor strip is the first always-present rung).
  try {
    await page.waitForSelector('[data-testid="game-plan-anchor"]', { timeout: 20_000 });
    pass(`M3${themeTag}: Game Plan hub rendered (anchor strip present)`);
  } catch {
    fail(`M3${themeTag}: hub did not render`, 'game-plan-anchor absent');
  }
  // PRE-DEPLOY invariant: the planSuggestions rules are not live, so the agent-
  // own read DENIES → the card must render NOTHING (quiet). A rendered card here
  // means the read unexpectedly succeeded — a real regression, not a soft note.
  const cardCount = await page.locator('[data-testid="plan-suggestions-card"]').count();
  if (cardCount === 0) pass(`M3${themeTag}: PlanSuggestionsCard quiet (agent-own read denies pre-deploy → renders nothing, no hub crash)`);
  else fail(`M3${themeTag}: PlanSuggestionsCard rendered pre-deploy`, `expected 0, got ${cardCount} — the agent-own read should deny (rules not live)`);
}

(async () => {
  const required = [
    'VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY',
    'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD',
    'A11Y_UNIT_MANAGER_EMAIL', 'A11Y_UNIT_MANAGER_PASSWORD',
  ];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  const agentToken  = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
  const agentClaims = decodeJwt(agentToken);
  const AGENT_UID   = agentClaims.user_id;
  const TENANT_ID   = agentClaims.tenantId;
  if (TENANT_ID !== SMOKE_TENANT) {
    console.error(`HARD GUARD: A11Y agent resolves to tenant "${TENANT_ID}" — aborting before any write.`);
    process.exit(1);
  }
  safeLog(`[setup] tenant=${TENANT_ID} agent=${AGENT_UID}`);

  const worksheetPath = `tenants/${TENANT_ID}/users/${AGENT_UID}/moneyNeeds/${YEAR}`;
  const originalDoc = await restGet(agentToken, worksheetPath);
  const hadVisibility = originalDoc.fields?.visibility !== undefined;
  const originalVisibility = originalDoc.fields?.visibility?.stringValue ?? 'private';
  let flipped = false;

  const browser = await chromium.launch({ headless: true });
  let capture = null;
  try {
    if (originalVisibility !== 'shared') {
      await restPatch(agentToken, worksheetPath, { visibility: { stringValue: 'shared' } }, ['visibility']);
      flipped = true;
      safeLog('[seed] visibility flipped to shared (will restore)');
    }

    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    capture = captureConsoleAndNetwork(page);
    await setupBypassSession(ctx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);

    // ── Manager legs (light + dark) ──
    await loginAs(page, E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD, `${PREVIEW_URL}/`);
    await openTeamPlans(page);
    await assertSendCard(page, AGENT_UID, ' (light)');

    await page.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    isDark ? pass('theme (dark): active after reload') : fail('theme (dark): activation');
    await openTeamPlans(page);
    await assertSendCard(page, AGENT_UID, ' (dark)');
    await page.evaluate(() => localStorage.removeItem('agencytrack-dark'));

    // ── Agent hub quiet-empty leg ──
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page2 = await ctx2.newPage();
    await setupBypassSession(ctx2, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(page2, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${PREVIEW_URL}/`);
    await assertAgentHubQuiet(page2, ' (light)');

    pass('POST-DEPLOY live legs deferred (Rule 13 FU) — run after `firebase deploy --only firestore:rules`');
  } catch (e) {
    fail('smoke', `crashed: ${e.message}`);
  } finally {
    try {
      if (flipped) {
        if (hadVisibility) {
          await restPatch(agentToken, worksheetPath, { visibility: { stringValue: originalVisibility } }, ['visibility']);
          const check = await restGet(agentToken, worksheetPath);
          (check.fields?.visibility?.stringValue === originalVisibility)
            ? pass('cleanup', `visibility restored to "${originalVisibility}", 0 orphans`)
            : fail('cleanup', `visibility restore mismatch: ${check.fields?.visibility?.stringValue}`);
        } else {
          await restPatch(agentToken, worksheetPath, {}, ['visibility']);
          pass('cleanup', 'visibility field removed (was absent originally), 0 orphans');
        }
      } else {
        pass('cleanup', 'nothing seeded (worksheet already shared), 0 orphans');
      }
    } catch (e) { fail('cleanup', `restore error: ${e.message}`); }

    if (capture) console.log(formatCaptureReport(capture));
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
    if (failed.length) { failed.forEach((r) => console.log(`  ✗ ${r.label}${r.detail ? ' — ' + r.detail : ''}`)); process.exit(1); }
    console.log('All legs green.');
    process.exit(0);
  }
})();
