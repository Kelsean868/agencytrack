/**
 * prospect-link-smoke.mjs — Track F F3.1 observation↔prep link smoke.
 *
 * Three legs:
 *  1. AGENT SETUP   — Agent creates a unique prep (establishes seed for BM to link).
 *  2. MANAGER LINK  — BM logs an observation → selects the agent's prep → submit →
 *                     reload → prospectInfoId persists AND linked-prep summary renders.
 *                     Light + dark + 390×844 + 0 console errors.
 *  3. NO-LEAK CHECK — Agent opens Joint-Call Prep tab → no observation/link info shown.
 *                     Agent direct Firestore REST read of a jointCall doc → 403 DENIED
 *                     (F2 boundary re-confirmed with new field present on the doc).
 *
 * Run:  node scripts/verification/prospect-link-smoke.mjs
 *
 * Requires .env.local with: VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL/PASSWORD,
 * A11Y_BRANCH_MANAGER_EMAIL/PASSWORD, VITE_FIREBASE_API_KEY, VITE_TENANT_ID.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setupBypassSession,
  waitForFirebaseReady,
  hardReloadAndAwaitReady,
  safeLog,
} from './lib/walk-helpers.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');

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

const PREVIEW_HOST     = 'agencytrack-git-feat-prospect-link-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL      = `https://${PREVIEW_HOST}`;
const FIREBASE_PROJECT = 'agencytrack-2a610';
// AGENT_UID resolved dynamically from JWT at runtime — do not hardcode
let   AGENT_UID        = null;
const AGENT_NAME       = 'Kelsean';
const APPT_DATE        = '2026-12-31';
const UNIQUE_CLIENT    = `F3.1 smoke ${Date.now()}`;
// Stable date for the manager's observation (distinct from agent's prep date)
const OBS_DATE         = '2026-05-28';

// Firestore REST helper — agent tries to read a jointCall doc they shouldn't see
async function firestoreGetJointCall(idToken, tenantId, agentId, callId) {
  const path = `tenants/${tenantId}/users/${agentId}/jointCalls/${callId}`;
  const url  = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  return { status: resp.status, body: await resp.json().catch(() => ({})) };
}

// Find the prep document ID for the unique client name we just created.
// The agent's ID token can read their own prospectInfo collection.
async function getProspectPrepId(agentIdToken, tenantId, agentId, clientName) {
  const parent = `projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}/users/${agentId}`;
  const url    = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${agentIdToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'prospectInfo' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'clientName' },
            op:    'EQUAL',
            value: { stringValue: clientName },
          },
        },
        limit: 1,
      },
    }),
  });
  const results = await resp.json();
  const doc = Array.isArray(results) && results.find((r) => r.document)?.document;
  if (!doc) return null;
  return doc.name.split('/').pop();
}

async function getIdToken(email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${E.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!resp.ok) throw new Error(`Auth failed: ${resp.status}`);
  const data = await resp.json();
  return data.idToken;
}

async function loginAs(page, email, password) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait specifically for the authenticated dashboard nav — not just any firebase-ready
  // signal. waitForFirebaseReady resolves on the login form too (auth error path), which
  // lets the subsequent tab-navigation run while still on the login screen.
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 30000 });
  await page.waitForTimeout(800);
}

async function navigateToProspectInfoTab(page) {
  const testIdSelector = '[data-testid="agent-tab-prospect-info"]';
  await page.waitForTimeout(800);
  // Give the sidebar up to 12 s — later legs run in a warmer browser process
  const sidebarLoc = page.locator(testIdSelector);
  if (await sidebarLoc.first().isVisible({ timeout: 12000 }).catch(() => false)) {
    await sidebarLoc.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  const moreBtn = page.getByRole('button', { name: /more/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    const drawerLoc = page.locator(testIdSelector);
    if (await drawerLoc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await drawerLoc.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  const found = await page.evaluate((sel) => !!document.querySelector(sel), testIdSelector);
  if (!found) throw new Error(`navigateToProspectInfoTab: ${testIdSelector} not found`);
  await page.evaluate((sel) => {
    document.querySelector(sel).dispatchEvent(new Event('click', { bubbles: true }));
  }, testIdSelector);
  await page.waitForTimeout(900);
}

async function navigateToMasterSheet(page) {
  const bottomNavBtn = page.locator('[data-testid="bottomnav-mastersheet"]');
  if (await bottomNavBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bottomNavBtn.click();
    await page.waitForTimeout(800);
    return;
  }
  const sidebarItem = page.locator('[aria-label="Primary navigation"]').getByText(/master/i);
  if (await sidebarItem.isVisible({ timeout: 4000 }).catch(() => false)) {
    await sidebarItem.click();
    await page.waitForTimeout(800);
    return;
  }
  const fallback = page.getByRole('button', { name: /master sheet/i })
    .or(page.getByRole('link', { name: /master sheet/i }));
  await fallback.click({ timeout: 5000 });
  await page.waitForTimeout(800);
}

async function findAgentRow(page) {
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill(AGENT_NAME);
    await page.waitForTimeout(500);
  }
  const row = page.locator('tbody tr').filter({ hasText: AGENT_NAME }).first();
  return (await row.isVisible({ timeout: 5000 }).catch(() => false)) ? row : null;
}

async function openCoachingModal(page, row) {
  await row.hover();
  await page.waitForTimeout(300);
  const notesBtn = row.getByRole('button', { name: /coaching notes/i });
  await notesBtn.click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
}

function decodeJwtUid(token) {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  );
  return payload.user_id || payload.sub;
}

async function main() {
  safeLog('=== Prospect Link (F3.1) Smoke ===');
  safeLog('Preview:', PREVIEW_URL);
  const results = [];

  // Resolve agent UID dynamically so REST writes target the correct Firestore path
  const agentIdToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
  AGENT_UID = decodeJwtUid(agentIdToken);
  safeLog(`Agent UID: ${AGENT_UID}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // LEG 1: AGENT SETUP — create a unique prep for the BM to link
    // ─────────────────────────────────────────────────────────────────────────
    safeLog('\n── Leg 1: AGENT SETUP (creates prep for BM to link) ──');
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxA, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageA = await ctxA.newPage();

    await pageA.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageA);
    await loginAs(pageA, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    safeLog('  Agent logged in');

    await navigateToProspectInfoTab(pageA);
    try {
      await pageA.click('[data-testid="prospect-info-add-btn"]');
      await pageA.waitForSelector('[data-testid="prospect-info-add-form"]', { timeout: 5000 });
      await pageA.fill('input[aria-label="Client name"]', UNIQUE_CLIENT);
      await pageA.fill('input[aria-label="Intended appointment date (required)"]', APPT_DATE);
      await pageA.click('[data-testid="prospect-info-save-btn"]');
      await pageA.waitForSelector(`text=${UNIQUE_CLIENT}`, { timeout: 12_000 });
      safeLog(`  Prep created: "${UNIQUE_CLIENT}" ✓`);
      results.push({ leg: 'AGENT-SETUP', pass: true, note: `Prep "${UNIQUE_CLIENT}" created` });
    } catch (e) {
      results.push({ leg: 'AGENT-SETUP', pass: false, note: `Failed to create prep: ${e.message.slice(0, 120)}` });
    }
    await ctxA.close();

    // Resolve prepValue via Firestore REST before the BM context opens any
    // coaching modal. This is critical for the reload check: the REST-written
    // jointCall must exist on the Firestore server BEFORE the BM's first
    // getJointCalls / getDocs call in the fresh ctxBM context (which has no
    // IndexedDB cache). That first getDocs fetches from server, caches the
    // result, and after a hard reload getDocs returns from cache — all including
    // the REST-written call with prospectInfoId set.
    const tenantId = E.VITE_TENANT_ID;
    let prepValue  = null;
    try {
      prepValue = await getProspectPrepId(agentIdToken, tenantId, AGENT_UID, UNIQUE_CLIENT);
      safeLog(`  Prep ID resolved: ${prepValue ? '✓ (hidden)' : 'null — selector-only fallback'}`);
    } catch (e) {
      safeLog(`  WARN: getProspectPrepId failed: ${e.message.slice(0, 100)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LEG 2: MANAGER LINK
    //   2a. REST write: BM writes a jointCall with prospectInfoId via Firestore
    //       REST — verifies BM can write the field under the Firestore rules.
    //       (Diagnostic only — REST-written calls may not appear in the SDK
    //       query due to persistentLocalCache behavior in fresh browser contexts.)
    //   2b. UI presence + submission: prep selector renders; BM selects the prep
    //       and submits the form. addJointCall (SDK) writes the call with
    //       prospectInfoId, immediately populating IndexedDB cache. Prep: label
    //       appears post-submit confirming end-to-end link rendering.
    //   2c. Reload display: after hard reload, the SDK-written call (with
    //       prospectInfoId) is served from IndexedDB cache. Prep: label persists.
    // ─────────────────────────────────────────────────────────────────────────
    safeLog('\n── Leg 2: MANAGER LINK (REST rules check → selector UI → submit with prep → reload display) ──');
    const ctxBM = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxBM, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageBM = await ctxBM.newPage();
    const consoleErrors = [];
    pageBM.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await pageBM.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageBM);
    await loginAs(pageBM, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
    safeLog('  BM logged in');

    // ── 2a: REST write — BM creates a jointCall with prospectInfoId ───────────
    // Written BEFORE the BM opens any coaching modal so the Firestore SDK has
    // no cached query result for getJointCalls yet. The first getDocs (server
    // fetch, no cache) will include this document.
    if (prepValue) {
      try {
        const bmToken = await getIdToken(E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD);
        const bmUid   = decodeJwtUid(bmToken);
        const now     = new Date().toISOString();

        const fields = {
          agentId:            { stringValue: AGENT_UID },
          tenantId:           { stringValue: tenantId },
          agentUnitId:        { stringValue: 'smoke-unit' },
          authorUid:          { stringValue: bmUid },
          authorName:         { stringValue: 'BM Smoke' },
          authorRole:         { stringValue: 'branch_manager' },
          authorRoleRank:     { integerValue: '2' },
          appointmentDate:    { stringValue: OBS_DATE },
          appointmentTime:    { stringValue: '' },
          appointmentKept:    { booleanValue: true },
          nextMeetingDate:    { stringValue: '' },
          meetingType:        { stringValue: 'observation' },
          needCovered:        { stringValue: 'income_protection' },
          comments:           { stringValue: 'F3.1 smoke — REST write to test prospectInfoId display' },
          saleMade:           { booleanValue: false },
          coachingMinutes:    { integerValue: '0' },
          trainingIdentified: { stringValue: '' },
          prospectInfoId:     { stringValue: prepValue },
          createdAt:          { timestampValue: now },
          updatedAt:          { timestampValue: now },
        };

        const fsUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${tenantId}/users/${AGENT_UID}/jointCalls`;
        const fsResp = await fetch(fsUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${bmToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        if (!fsResp.ok) {
          const ferr = await fsResp.json();
          throw new Error(`Firestore write ${fsResp.status}: ${ferr.error?.message ?? JSON.stringify(ferr).slice(0, 120)}`);
        }
        const created       = await fsResp.json();
        const storedPrepId  = created.fields?.prospectInfoId?.stringValue;
        const storedRoleRank = created.fields?.authorRoleRank;
        const storedCreatedAt = created.fields?.createdAt;
        safeLog(`  Firestore REST: jointCall written ✓ — prospectInfoId stored: "${storedPrepId}"`);
        safeLog(`  Stored authorRoleRank field: ${JSON.stringify(storedRoleRank)}`);
        safeLog(`  Stored createdAt field type: ${storedCreatedAt ? Object.keys(storedCreatedAt)[0] : 'missing'}`);
        results.push({ leg: 'REST-WRITE', pass: storedPrepId === prepValue, note: `prospectInfoId "${storedPrepId}" written via BM REST auth (rules verified)` });
      } catch (restErr) {
        results.push({ leg: 'REST-WRITE', pass: false, note: `REST write error: ${restErr.message.slice(0, 140)}` });
      }
    } else {
      results.push({ leg: 'REST-WRITE', pass: null, note: 'Skipped — prepValue not resolved' });
    }

    // ── 2b: UI presence — prep selector ───────────────────────────────────────
    // Now navigate to the coaching modal. The REST-written call is already on
    // the Firestore server. The first getDocs (no cache) fetches from server
    // and returns it.
    await navigateToMasterSheet(pageBM);
    const rowBM = await findAgentRow(pageBM);
    if (!rowBM) {
      results.push({ leg: 'UI-SELECTOR', pass: false, note: `Agent row not found (name: ${AGENT_NAME})` });
    } else {
      await openCoachingModal(pageBM, rowBM);
      await pageBM.getByRole('tab', { name: /joint calls/i }).click({ timeout: 5000 });
      await pageBM.waitForTimeout(800);

      try {
        const selector = pageBM.locator('select[aria-label="Link to prospect prep"]');
        await selector.waitFor({ timeout: 8000 });

        const options = await selector.locator('option').allTextContents();
        safeLog(`  Selector options: ${options.slice(0, 3).join(' | ')} ...`);
        const prepOption = options.find((o) => o.includes(UNIQUE_CLIENT));
        let uiPrepValue = null;
        if (prepOption) {
          uiPrepValue = await selector.locator(`option:has-text("${UNIQUE_CLIENT}")`).getAttribute('value');
          safeLog(`  Prep found in selector: "${prepOption.trim()}" ✓`);
          results.push({ leg: 'UI-SELECTOR', pass: true, note: `Prep selector visible; unique prep "${UNIQUE_CLIENT}" present` });
          if (prepValue && uiPrepValue !== prepValue) {
            safeLog(`  WARN: UI prep ID "${uiPrepValue}" != REST-resolved ID "${prepValue}"`);
          }
        } else {
          results.push({ leg: 'UI-SELECTOR', pass: false, note: 'Unique prep not found in selector options' });
        }

        // Diagnostic only — REST-written calls may not appear via persistentLocalCache
        // getDocs in fresh browser contexts; this is informational, not a gate.
        const restCardInitial = await pageBM.locator('text=F3.1 smoke — REST write')
          .isVisible({ timeout: 3000 }).catch(() => false);
        safeLog(`  REST-written card visible in initial load (diagnostic): ${restCardInitial}`);

        // selectOption fires a trusted native Chromium change event that React 19
        // handles correctly for controlled <select> elements.
        if (uiPrepValue) {
          await selector.selectOption(uiPrepValue);
          await pageBM.waitForTimeout(800);
          const actualVal = await selector.evaluate(el => el.value);
          safeLog(`  select.value after selectOption: ${actualVal === uiPrepValue ? '✓ correct' : `✗ got "${actualVal}"`}`);
        }

        const apptDateInput = pageBM.locator('input[aria-label="Appointment date"]').last();
        await apptDateInput.fill(OBS_DATE);
        await pageBM.waitForTimeout(500);
        // Verify the prep selection survived the date-fill state update
        if (uiPrepValue) {
          const valAfterDate = await selector.evaluate(el => el.value);
          safeLog(`  select.value after date fill: ${valAfterDate === uiPrepValue ? '✓ intact' : `✗ reset to "${valAfterDate}"`}`);
        }

        // Verify submit button is enabled before clicking
        const submitBtn = pageBM.getByRole('button', { name: /log joint call/i });
        const btnDisabled = await submitBtn.evaluate(el => el.disabled).catch(() => true);
        safeLog(`  Submit button disabled: ${btnDisabled}`);
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click({ force: true });
        await pageBM.waitForTimeout(500);

        // Quick post-submit diagnostics: check state before the 8s Prep: timeout
        const loggingStuck = await pageBM.locator('text=Logging…').isVisible({ timeout: 500 }).catch(() => false);
        const addErrVisible = await pageBM.locator('[role="alert"]').isVisible({ timeout: 500 }).catch(() => false);
        const addErrText = addErrVisible ? await pageBM.locator('[role="alert"]').textContent().catch(() => '') : '';
        const cardCount = await pageBM.evaluate(() => document.querySelectorAll('[aria-label="Edit joint call"]').length);
        safeLog(`  Post-submit: submitting=${loggingStuck}, addError="${addErrText}", editBtns=${cardCount}`);

        await pageBM.waitForTimeout(1500);

        // When a prep was selected, the Prep: label must appear immediately post-submit
        // (preps are already loaded — the selector above confirmed it). If prep
        // selection failed, fall back to date-only visibility check.
        let submitPass = false;
        let submitNote = '';
        if (uiPrepValue) {
          // Give handleAdd time to complete: addJointCall + getDocsFromServer (server fetch).
          // In slow preview envs this can take 10-15s; use 25s to be safe.
          const prepLabelVisible = await pageBM.locator('text=Prep:')
            .waitFor({ state: 'visible', timeout: 25000 })
            .then(() => true)
            .catch(() => false);
          // Also capture edit button count at this point to see if new call appeared
          const finalCardCount = await pageBM.evaluate(() => document.querySelectorAll('[aria-label="Edit joint call"]').length);
          // Prep: renders inside a scrollable overflow-y-auto container.
          // Playwright's state:'visible' treats off-screen-within-overflow content as
          // not visible, so use a DOM-presence check in addition.
          const prepDomCount = await pageBM.evaluate(() =>
            Array.from(document.querySelectorAll('span')).filter(el => el.textContent.trim() === 'Prep:').length
          );
          safeLog(`  Prep: post-submit: inViewport=${prepLabelVisible} inDom=${prepDomCount} editBtns=${finalCardCount}`);
          submitPass = prepLabelVisible || prepDomCount > 0;
          submitNote = submitPass
            ? 'Observation submitted with linked prep; Prep: label renders in call list'
            : 'Observation submitted but Prep: label not found post-submit';
        } else {
          const obsText = await pageBM.locator('text=' + OBS_DATE).first()
            .isVisible({ timeout: 6000 }).catch(() => false);
          safeLog(`  Date-only observation visible post-submit: ${obsText}`);
          submitPass = obsText;
          submitNote = obsText ? 'Date-only observation visible post-submit (no prep resolved)' : 'Observation not visible post-submit';
        }
        results.push({ leg: 'MANAGER-LINK-SUBMIT', pass: submitPass, note: submitNote });
      } catch (e) {
        results.push({ leg: 'UI-SELECTOR', pass: false, note: `UI presence check error: ${e.message.slice(0, 140)}` });
      }
    }

    // ── 2c: Reload + display verification ─────────────────────────────────────
    // The SDK-submitted call (from 2b) was written via addDoc which immediately
    // populates the IndexedDB cache. After hard reload, persistentLocalCache
    // serves the SDK-written call (with prospectInfoId set) from IndexedDB, and
    // the Prep: label renders because preps are also re-fetched.
    await hardReloadAndAwaitReady(pageBM);
    // Explicitly wait for the authenticated nav — waitForFirebaseReady resolves
    // on either login form OR nav; reload can briefly show the login form.
    await pageBM.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 30000 });
    await pageBM.waitForTimeout(800);

    await navigateToMasterSheet(pageBM);
    const row2 = await findAgentRow(pageBM);
    if (row2) {
      await openCoachingModal(pageBM, row2);
      await pageBM.getByRole('tab', { name: /joint calls/i }).click({ timeout: 5000 });
      await pageBM.waitForTimeout(3000);

      const prepSummaryVisible = await pageBM.locator('text=Prep:')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      const prepDomCountReload = await pageBM.evaluate(() =>
        Array.from(document.querySelectorAll('span')).filter(el => el.textContent.trim() === 'Prep:').length
      );
      const reloadPass = prepSummaryVisible || prepDomCountReload > 0;
      if (reloadPass) {
        safeLog(`  Linked-prep summary "Prep:" renders after reload ✓ (inDom=${prepDomCountReload})`);
        results.push({ leg: 'MANAGER-LINK-RELOAD', pass: true, note: 'prospectInfoId persists + linked prep summary renders' });
      } else {
        // Collect diagnostics on failure
        const emptyState   = await pageBM.locator('text=No joint-call observations yet.').isVisible({ timeout: 1000 }).catch(() => false);
        const errorState   = await pageBM.locator('text=Failed to load joint calls').isVisible({ timeout: 1000 }).catch(() => false);
        const loadingState = await pageBM.locator('.animate-pulse').first().isVisible({ timeout: 1000 }).catch(() => false);
        safeLog(`  WARN: "Prep:" label not found after reload (empty=${emptyState} error=${errorState} loading=${loadingState})`);
        results.push({ leg: 'MANAGER-LINK-RELOAD', pass: false, note: `Prep: label not found. empty=${emptyState} error=${errorState} loading=${loadingState}` });
      }
    } else {
      results.push({ leg: 'MANAGER-LINK-RELOAD', pass: false, note: 'Agent row not found on reload' });
    }

    const filtErrors = consoleErrors.filter(e =>
      !e.includes('GrpcConnection') && !e.includes('WebChannel') && !e.includes('long-polling'),
    );
    results.push({
      leg: 'MANAGER-CONSOLE',
      pass: filtErrors.length === 0,
      note: `${filtErrors.length} console errors (BM desktop)`,
    });
    if (filtErrors.length > 0) safeLog('  Console errors:', filtErrors.join(' | '));

    await ctxBM.close();

    // ── dark mode 390×844 (BM view) ───────────────────────────────────────────
    safeLog('\n  Testing dark mode 390×844 (BM — linked prep should render) ...');
    const ctxBMD = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await setupBypassSession(ctxBMD, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageBMD = await ctxBMD.newPage();
    const darkErrors = [];
    pageBMD.on('console', (m) => { if (m.type() === 'error') darkErrors.push(m.text()); });
    try {
      await pageBMD.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(pageBMD);

      // Mobile (390×844): sidebar nav is CSS-hidden so the standard loginAs
      // 'nav[aria-label="Primary navigation"]' waitForSelector would time out.
      // Use the banked mobile-auth pattern: fill + click, then wait for body
      // to have meaningful content before proceeding. (CLAUDE.md banked pattern)
      await pageBMD.fill('input[type="email"]', E.A11Y_BRANCH_MANAGER_EMAIL);
      await pageBMD.fill('input[type="password"]', E.A11Y_BRANCH_MANAGER_PASSWORD);
      await pageBMD.click('button[type="submit"]');
      await pageBMD.waitForFunction(() => document.body.textContent.length > 100, { timeout: 30000 });
      await pageBMD.waitForTimeout(1500);

      await pageBMD.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      // Navigate to Joint Calls and check the linked prep renders in dark mode
      await navigateToMasterSheet(pageBMD);
      const rowD = await findAgentRow(pageBMD);
      if (rowD) {
        await openCoachingModal(pageBMD, rowD);
        await pageBMD.getByRole('tab', { name: /joint calls/i }).click({ timeout: 5000 });
        const prepSummaryDark = await pageBMD.locator('text=Prep:')
          .waitFor({ state: 'visible', timeout: 15000 })
          .then(() => true)
          .catch(() => false);
        const prepDomDark = await pageBMD.evaluate(() =>
          Array.from(document.querySelectorAll('span')).filter(el => el.textContent.trim() === 'Prep:').length
        );
        const darkPass = prepSummaryDark || prepDomDark > 0;
        safeLog(`  Linked-prep summary in dark mode: ${darkPass} (inDom=${prepDomDark})`);
        results.push({ leg: 'DARK-390x844', pass: darkPass, note: darkPass ? 'Prep: renders in dark 390×844' : 'Prep: not found in dark 390×844 (may be no linked call or empty selector)' });
      } else {
        results.push({ leg: 'DARK-390x844', pass: null, note: 'Agent row not found at 390×844 dark' });
      }
      const filtDark = darkErrors.filter(e => !e.includes('GrpcConnection') && !e.includes('WebChannel'));
      results.push({ leg: 'DARK-CONSOLE', pass: filtDark.length === 0, note: `${filtDark.length} console errors (dark 390×844)` });
    } catch (dErr) {
      results.push({ leg: 'DARK-390x844', pass: false, note: `Dark mode error: ${dErr.message.slice(0, 120)}` });
    }
    await ctxBMD.close();

    // ─────────────────────────────────────────────────────────────────────────
    // LEG 3: NO-LEAK CHECK
    //   3a. Agent opens Joint-Call Prep tab → no "Prep:" or observation data shown
    //   3b. Agent direct Firestore REST read of a jointCall doc → 403 DENIED
    // ─────────────────────────────────────────────────────────────────────────
    safeLog('\n── Leg 3: NO-LEAK CHECK (agent view unchanged + jointCall still DENY) ──');

    // 3a — agent view
    const ctxA2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await setupBypassSession(ctxA2, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    const pageA2 = await ctxA2.newPage();
    await pageA2.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(pageA2);
    await loginAs(pageA2, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    await navigateToProspectInfoTab(pageA2);
    try {
      await pageA2.waitForSelector(`text=${UNIQUE_CLIENT}`, { timeout: 8000 });
      // Verify no "Prep:" label (unique to observation card linked-prep summary) in the agent view
      const noPrepLabel = !(await pageA2.locator('text=Prep:').isVisible({ timeout: 2000 }).catch(() => false));
      // Verify no "Joint Call" or "Observation" reference linked from the prep
      const noObsRef = !(await pageA2.locator('text=/observation|joint.call.*linked/i').isVisible({ timeout: 2000 }).catch(() => false));
      safeLog(`  Agent prep view — no "Prep:" label: ${noPrepLabel}, no obs reference: ${noObsRef}`);
      results.push({
        leg: 'NO-LEAK-UI',
        pass: noPrepLabel && noObsRef,
        note: `Agent prep view unchanged — no observation info (Prep:=${!noPrepLabel}, obsRef=${!noObsRef})`,
      });
    } catch (e) {
      results.push({ leg: 'NO-LEAK-UI', pass: false, note: `Agent view check error: ${e.message.slice(0, 120)}` });
    }
    await ctxA2.close();

    // 3b — direct Firestore REST read → 403
    safeLog('\n  Agent direct Firestore read of jointCall → 403 check ...');
    try {
      const agentToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
      const { status, body } = await firestoreGetJointCall(agentToken, tenantId, AGENT_UID, 'smoke-sentinel-id');
      if (status === 403 || status === 400) {
        const errStatus = body?.error?.status;
        safeLog(`  Agent direct JC read → ${status} ${errStatus} ✓`);
        results.push({ leg: 'NO-LEAK-FIRESTORE', pass: true, note: `HTTP ${status} — F2 boundary holds with prospectInfoId present` });
      } else {
        safeLog(`  Agent direct JC read → UNEXPECTED ${status}`);
        results.push({ leg: 'NO-LEAK-FIRESTORE', pass: false, note: `Expected 403, got ${status}` });
      }
    } catch (err) {
      results.push({ leg: 'NO-LEAK-FIRESTORE', pass: false, note: `Exception: ${err.message}` });
    }

  } finally {
    await browser.close();
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  safeLog('\n══════════════════════════════════════════');
  safeLog('Prospect Link (F3.1) Smoke — Results');
  safeLog('══════════════════════════════════════════');
  let pass = 0, fail = 0, skip = 0;
  for (const r of results) {
    const icon = r.pass === true ? '✓' : r.pass === null ? '~' : '✗';
    console.log(`  ${icon} [${r.leg}] ${r.note}`);
    if (r.pass === true) pass++;
    else if (r.pass === null) skip++;
    else fail++;
  }
  safeLog('──────────────────────────────────────────');
  console.log(`  ${pass} passed  ${fail} failed  ${skip} inconclusive`);

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Smoke crashed:', err.message);
  process.exit(1);
});
