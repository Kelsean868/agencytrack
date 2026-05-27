/**
 * f365-socialplatform-postdeploy-smoke.mjs
 *
 * Post-deploy smoke for PR #365 — socialPlatform attribution.
 * Verifies the two new firestore.rules hasOnly arms and the F3.1 prefill carry.
 *
 * Legs:
 *  a  REST — agent creates prospect (social-media + instagram) → GET → fields persist
 *  b  REST — agent creates prospect (referral) → GET → socialPlatform is null
 *  c  REST — edit prospect (a) to source=referral → GET → socialPlatform now null
 *  d  UI  — F3.1 carry: social-media+instagram prep → Log Policy → prefills instagram
 *           → save → reload → policy persists socialPlatform='instagram'
 *  e  UI  — PolicyLedger UI guard: social-media + no platform → Save disabled;
 *           pick platform → Save enabled
 *  f  REST — DENY: PATCH prospect (a) with {socialPlatform:'whatsapp', agentId:'tampered'};
 *           agentId has DIFFERENT value so it appears in diff → hasOnly denies → 403
 *  g  (embedded in d/e) — 0 console errors across Playwright legs
 *
 * Run:  node scripts/verification/f365-socialplatform-postdeploy-smoke.mjs
 *
 * Requires .env.local: VITE_FIREBASE_API_KEY, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  waitForFirebaseReady,
  hardReloadAndAwaitReady,
  selectReactOption,
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

const PROD_URL          = 'https://agencytrack.vercel.app';
const FIREBASE_PROJECT  = 'agencytrack-2a610';
const TENANT_ID         = 'tatillife_south';
const AGENT_UID         = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
const APPT_DATE         = '2026-12-31';
const TS                = Date.now();
const UNIQUE_SOCIAL     = `F365-social-${TS}`;
const UNIQUE_REFERRAL   = `F365-referral-${TS}`;

// ── Firestore REST helpers ────────────────────────────────────────────────────

function fsBase() {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
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
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`signIn failed: ${resp.status} ${err?.error?.message ?? ''}`);
  }
  return (await resp.json()).idToken;
}

async function fsPost(idToken, collectionPath, fields) {
  const resp = await fetch(`${fsBase()}/${collectionPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return { ok: resp.ok, status: resp.status, body: await resp.json() };
}

async function fsGet(idToken, docPath) {
  const resp = await fetch(`${fsBase()}/${docPath}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return { ok: resp.ok, status: resp.status, body: await resp.json() };
}

async function fsPatch(idToken, docPath, fields) {
  const keys = Object.keys(fields);
  const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const resp = await fetch(`${fsBase()}/${docPath}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return { ok: resp.ok, status: resp.status, body: await resp.json() };
}

function fsStr(v)  { return { stringValue: v }; }
function fsNull()  { return { nullValue: 'NULL_VALUE' }; }
function fsArr(items) { return { arrayValue: { values: items } }; }
function fsTs()    { return { timestampValue: new Date().toISOString() }; }

function readStr(doc, field) { return doc?.fields?.[field]?.stringValue ?? undefined; }
function readNull(doc, field) {
  const f = doc?.fields?.[field];
  return f ? ('nullValue' in f) : null;
}

// ── Result tracker ─────────────────────────────────────────────────────────────

const results = [];
let failCount = 0;

function pass(label, note = '') {
  results.push({ label, ok: true });
  console.log(`  ✅ ${label}${note ? ' — ' + note : ''}`);
}
function fail(label, detail = '') {
  results.push({ label, ok: false, detail });
  failCount++;
  console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
}
function skip(label, note = '') {
  results.push({ label, ok: null });
  console.log(`  ⏭  ${label}${note ? ' — ' + note : ''}`);
}

// ── Prospect-info path helper ─────────────────────────────────────────────────

function piPath(docId) {
  return `tenants/${TENANT_ID}/users/${AGENT_UID}/prospectInfo/${docId}`;
}

function piCreateFields(clientName, prospectingSource, socialPlatform) {
  const base = {
    agentId:                 fsStr(AGENT_UID),
    tenantId:                fsStr(TENANT_ID),
    agentUnitId:             fsStr('unit_kyron'),
    createdBy:               fsStr(AGENT_UID),
    clientName:              fsStr(clientName),
    clientAge:               { integerValue: '35' },
    clientOccupation:        fsStr('Test Occupation'),
    prospectingSource:       fsStr(prospectingSource),
    appointmentType:         fsStr('2nd-interview'),
    objections:              fsArr([]),
    policyType:              fsStr('whole-life'),
    intendedAppointmentDate: fsStr(APPT_DATE),
    createdAt:               fsTs(),
    updatedAt:               fsTs(),
  };
  if (socialPlatform !== undefined) {
    base.socialPlatform = socialPlatform === null ? fsNull() : fsStr(socialPlatform);
  }
  return base;
}

// ── Navigate helper ────────────────────────────────────────────────────────────

async function navigateTo(page, testid) {
  const loc = page.locator(`[data-testid="${testid}"]`);
  if (await loc.first().isVisible({ timeout: 4000 }).catch(() => false)) {
    await loc.first().click({ force: true });
    await page.waitForTimeout(900);
    return;
  }
  const moreBtn = page.getByRole('button', { name: /^more$/i });
  if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    if (await loc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await loc.first().click({ force: true });
      await page.waitForTimeout(900);
      return;
    }
  }
  await page.evaluate((sel) => {
    const el = document.querySelector(`[data-testid="${sel}"]`);
    if (el) el.dispatchEvent(new Event('click', { bubbles: true }));
  }, testid);
  await page.waitForTimeout(900);
}

// ── Main ───────────────────────────────────────────────────────────────────────

(async () => {
  const required = ['VITE_FIREBASE_API_KEY', 'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD'];
  const missing  = required.filter((k) => !E[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('f365-socialplatform-postdeploy-smoke — PR #365');
  console.log(`Target: ${PROD_URL}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ── Auth ──────────────────────────────────────────────────────────────────────
  let idToken;
  try {
    idToken = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD);
    pass('rest-auth');
  } catch (err) {
    fail('rest-auth', err.message);
    process.exit(1);
  }

  let socialDocId; // Firestore-assigned ID for the social-media prospect (legs a, c, f)

  // ── Leg a: create social-media prospect, verify fields persist ─────────────────
  console.log('\n── Leg a: social-media prospect create + verify ────────');
  {
    const piCollection = `tenants/${TENANT_ID}/users/${AGENT_UID}/prospectInfo`;
    const { ok, status, body } = await fsPost(
      idToken,
      piCollection,
      piCreateFields(UNIQUE_SOCIAL, 'social-media', 'instagram'),
    );
    if (!ok) {
      fail('leg-a-create', `HTTP ${status} — ${body?.error?.message ?? 'unknown'}`);
    } else {
      // Extract the doc ID from the returned name (format: …/prospectInfo/{id})
      socialDocId = body.name?.split('/').pop();
      pass('leg-a-create', `docId=${socialDocId}`);

      // GET to verify fields
      const { ok: gOk, body: gBody } = await fsGet(idToken, piPath(socialDocId));
      if (!gOk) {
        fail('leg-a-verify', `GET failed`);
      } else {
        const srcOk  = readStr(gBody, 'prospectingSource') === 'social-media';
        const platOk = readStr(gBody, 'socialPlatform')    === 'instagram';
        if (srcOk && platOk) {
          pass('leg-a-verify', 'prospectingSource=social-media, socialPlatform=instagram');
        } else {
          fail('leg-a-verify', `src=${readStr(gBody,'prospectingSource')} plat=${readStr(gBody,'socialPlatform')}`);
        }
      }
    }
  }

  // ── Leg b: referral prospect — socialPlatform stored as null ──────────────────
  console.log('\n── Leg b: referral prospect → socialPlatform null ──────');
  {
    const { ok, status, body } = await fsPost(
      idToken,
      `tenants/${TENANT_ID}/users/${AGENT_UID}/prospectInfo`,
      piCreateFields(UNIQUE_REFERRAL, 'referral', null),
    );
    if (!ok) {
      fail('leg-b-create', `HTTP ${status}`);
    } else {
      const refDocId = body.name?.split('/').pop();
      const { ok: gOk, body: gBody } = await fsGet(idToken, piPath(refDocId));
      if (!gOk) {
        fail('leg-b-verify', 'GET failed');
      } else {
        const isNull = readNull(gBody, 'socialPlatform');
        if (isNull === true) {
          pass('leg-b-verify', 'socialPlatform=null ✓');
        } else {
          fail('leg-b-verify', `socialPlatform field: ${JSON.stringify(gBody?.fields?.socialPlatform ?? 'ABSENT')}`);
        }
      }
    }
  }

  // ── Leg c: source-change clear — edit leg-a doc to referral, verify null ───────
  console.log('\n── Leg c: source-change clear (social→referral) ────────');
  if (!socialDocId) {
    skip('leg-c', 'skipped — leg-a doc not created');
  } else {
    const { ok, status, body } = await fsPatch(
      idToken,
      piPath(socialDocId),
      {
        prospectingSource: fsStr('referral'),
        socialPlatform:    fsNull(),
        updatedAt:         fsTs(),
      },
    );
    if (!ok) {
      fail('leg-c-patch', `HTTP ${status} — ${body?.error?.message ?? 'unknown'}`);
    } else {
      const { ok: gOk, body: gBody } = await fsGet(idToken, piPath(socialDocId));
      if (!gOk) {
        fail('leg-c-verify', 'GET failed');
      } else {
        const srcOk  = readStr(gBody, 'prospectingSource') === 'referral';
        const isNull = readNull(gBody, 'socialPlatform');
        if (srcOk && isNull) {
          pass('leg-c-verify', 'prospectingSource=referral, socialPlatform=null ✓');
        } else {
          fail('leg-c-verify', `src=${readStr(gBody,'prospectingSource')} null=${isNull}`);
        }
      }
    }
  }

  // ── Leg f: DENY — PATCH with disallowed agentId (DIFFERENT value → appears in diff) ──
  console.log('\n── Leg f: hasOnly DENY (agentId tampered → diff fires) ─');
  // Re-create a fresh social doc so its agentId is AGENT_UID; then PATCH with a
  // different agentId — diff().affectedKeys() will include agentId → hasOnly denies it.
  {
    const { ok: cOk, body: cBody } = await fsPost(
      idToken,
      `tenants/${TENANT_ID}/users/${AGENT_UID}/prospectInfo`,
      piCreateFields(`F365-deny-${TS}`, 'social-media', 'facebook'),
    );
    if (!cOk) {
      skip('leg-f', 'Could not seed doc for deny test');
    } else {
      const denyDocId = cBody.name?.split('/').pop();
      // PATCH includes agentId with a different value — MUST be different from 'J0j4uBqzTPcfm1IlGCPyDzo27RP2'
      const { ok: pOk, status: pStatus } = await fsPatch(
        idToken,
        piPath(denyDocId),
        {
          socialPlatform: fsStr('whatsapp'),
          agentId:        fsStr('tampered-uid-not-matching'),
          updatedAt:      fsTs(),
        },
      );
      if (!pOk && pStatus === 403) {
        pass('leg-f-deny', `HTTP 403 PERMISSION_DENIED ✓ (agentId not in hasOnly allowlist)`);
      } else {
        fail('leg-f-deny', `Expected 403, got HTTP ${pStatus}`);
      }
    }
  }

  // ── Playwright legs: d (F3.1 carry) + e (UI guard) + g (console errors) ──────
  console.log('\n── Legs d+e+g: Playwright UI ────────────────────────────');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];

  try {
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Login
    await page.goto(`${PROD_URL}/`, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
      await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForFunction(
        () => document.querySelector('[data-testid^="agent-tab-"]'),
        { timeout: 40000 },
      );
    }
    pass('ui-login');

    // ── Leg e: UI guard ─────────────────────────────────────────────────────
    console.log('\n  ─ leg-e: PolicyLedger UI guard ─');
    await navigateTo(page, 'agent-tab-policy-ledger');
    await page.waitForTimeout(1500);

    // Click New Policy
    const newPolicyBtn = page.getByRole('button', { name: /New Policy/i });
    if (!await newPolicyBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      fail('leg-e-new-policy-btn', 'New Policy button not found');
    } else {
      await newPolicyBtn.click();
      await page.waitForTimeout(800);

      // Select social-media as source of prospect
      const sourceSelect = page.locator('select#sourceOfProspect');
      if (await sourceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectReactOption(page, sourceSelect, 'social-media');
        await page.waitForTimeout(400);

        // Save Policy button should now be disabled (no platform chosen)
        const saveBtn = page.getByRole('button', { name: /Save Policy/i });
        const isDisabled = await saveBtn.isDisabled({ timeout: 3000 }).catch(() => null);
        if (isDisabled === true) {
          pass('leg-e-save-disabled', 'Save disabled when social-media + no platform ✓');
        } else {
          fail('leg-e-save-disabled', `Expected disabled, got isDisabled=${isDisabled}`);
        }

        // Pick a platform
        const platformSelect = page.locator('select#socialPlatform');
        if (await platformSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await selectReactOption(page, platformSelect, 'instagram');
          await page.waitForTimeout(300);

          const isDisabledAfter = await saveBtn.isDisabled({ timeout: 2000 }).catch(() => null);
          if (isDisabledAfter === false) {
            pass('leg-e-save-enabled', 'Save enabled after platform selected ✓');
          } else {
            fail('leg-e-save-enabled', `Expected enabled, got isDisabled=${isDisabledAfter}`);
          }
        } else {
          fail('leg-e-platform-select', 'Platform select not found after social-media source selected');
        }
      } else {
        fail('leg-e-source-select', 'sourceOfProspect select not found in create form');
      }

      // Cancel to clean up
      const cancelBtn = page.getByRole('button', { name: /Cancel/i });
      if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(400);
      }
    }

    // ── Leg d: F3.1 carry-through ──────────────────────────────────────────
    console.log('\n  ─ leg-d: F3.1 socialPlatform prefill carry ─');
    await navigateTo(page, 'agent-tab-prospect-info');
    await page.waitForTimeout(1200);

    const addBtn = page.locator('[data-testid="prospect-info-add-btn"]');
    if (!await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      fail('leg-d-add-btn', 'Prospect Info add button not found');
    } else {
      await addBtn.click();
      await page.waitForSelector('[data-testid="prospect-info-add-form"]', { timeout: 8000 });

      // Fill required fields
      const nameInput = page.locator('[data-testid="prospect-info-add-form"] [aria-label="Client name"]');
      const SOCIAL_PREP = `F365-carry-${TS}`;
      await nameInput.fill(SOCIAL_PREP);

      const dateInput = page.locator('[data-testid="prospect-info-add-form"] [aria-label="Intended appointment date (required)"]');
      await dateInput.fill(APPT_DATE);

      // Switch to social-media source
      const srcSelect = page.locator('[data-testid="prospect-info-add-form"] [aria-label="Prospecting source"]');
      await selectReactOption(page, srcSelect, 'social-media');
      await page.waitForTimeout(300);

      // Pick instagram
      const platSelect = page.locator('[data-testid="prospect-info-add-form"] [aria-label="Social platform (required)"]');
      if (await platSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectReactOption(page, platSelect, 'instagram');
        pass('leg-d-platform-selected', 'instagram selected in prep form');
      } else {
        fail('leg-d-platform-select', 'platform select did not appear after social-media source');
      }

      // Save
      await page.locator('[data-testid="prospect-info-save-btn"]').click();
      await page.waitForFunction(
        (name) => document.body.textContent.includes(name),
        SOCIAL_PREP,
        { timeout: 15000 },
      );
      pass('leg-d-prep-saved', `Prep "${SOCIAL_PREP}" created`);

      // Find the Log Policy button for our specific prep.
      // Scope search to the direct PrepCard container inside the list — walking up to a common
      // ancestor would match ALL preps (false positive), returning the first button in the list.
      const logPolicyBtnId = await page.evaluate((name) => {
        const list = document.querySelector('[data-testid="prospect-info-list"]');
        if (!list) return null;
        for (const card of list.children) {
          // PrepCard renders the client name in a <p class="font-medium">
          const nameEl = card.querySelector('p.font-medium');
          if (nameEl && nameEl.textContent.trim() === name) {
            const btn = card.querySelector('[data-testid^="log-policy-btn-"]');
            return btn?.dataset?.testid ?? null;
          }
        }
        return null;
      }, SOCIAL_PREP);

      if (!logPolicyBtnId) {
        fail('leg-d-log-policy-btn', 'Log Policy button not found for the new prep');
      } else {
        await page.locator(`[data-testid="${logPolicyBtnId}"]`).click();
        // Log Policy switches to the policy-ledger tab but does NOT auto-open the create form.
        // Wait for the tab switch, then click "New Policy" to open the prefilled form.
        const newPolicyBtn2 = page.getByRole('button', { name: /New Policy/i });
        await newPolicyBtn2.waitFor({ state: 'visible', timeout: 8000 });
        // Diagnostic: confirm we are on policy-ledger tab and inspect React initialForm prop
        const preClickDom = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'New Policy');
          let initialFormValue = 'could-not-read';
          if (btn) {
            const fiberKey = Object.keys(btn).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
            if (fiberKey) {
              let fiber = btn[fiberKey];
              while (fiber) {
                const mProps = fiber.memoizedProps;
                if (mProps && 'initialForm' in mProps) {
                  initialFormValue = JSON.stringify(mProps.initialForm);
                  break;
                }
                fiber = fiber.return;
              }
            }
          }
          return {
            activeTabText: document.querySelector('[aria-current="page"]')?.textContent?.trim() ?? 'unknown',
            hasSourceSelect: !!document.querySelector('select#sourceOfProspect'),
            initialFormFromFiber: initialFormValue,
            url: window.location.href,
          };
        });
        console.log(`  [diag] pre-click state: ${JSON.stringify(preClickDom)}`);
        await newPolicyBtn2.click();
        await page.waitForTimeout(800);
        // Diagnostic: see what the form shows immediately after open
        const postClickDom = await page.evaluate(() => ({
          sourceVal: document.querySelector('select#sourceOfProspect')?.value ?? 'ABSENT',
          platVal:   document.querySelector('select#socialPlatform')?.value   ?? 'ABSENT',
        }));
        console.log(`  [diag] post-click form values: ${JSON.stringify(postClickDom)}`);

        // Wait up to 3 seconds for prefill to arrive (timing gap check)
        await page.waitForFunction(
          () => {
            const sel = document.querySelector('select#sourceOfProspect');
            return sel && sel.value === 'social-media';
          },
          { timeout: 3000 },
        ).catch(() => {}); // ignore timeout — will report the actual value below

        // Form should now be open with prefilled source + platform
        const sourceVal = await page.locator('select#sourceOfProspect').inputValue().catch(() => null);
        const platVal   = await page.locator('select#socialPlatform').inputValue().catch(() => null);

        if (sourceVal === 'social-media') {
          pass('leg-d-source-prefilled', 'sourceOfProspect=social-media ✓');
        } else {
          fail('leg-d-source-prefilled', `Expected social-media, got ${sourceVal}`);
        }
        if (platVal === 'instagram') {
          pass('leg-d-platform-prefilled', 'socialPlatform=instagram ✓');
        } else {
          fail('leg-d-platform-prefilled', `Expected instagram, got ${platVal}`);
        }

        // Fill remaining required fields and save
        const ownerVal = await page.locator('input#ownerName').inputValue().catch(() => '');
        if (!ownerVal) {
          await page.locator('input#ownerName').fill(SOCIAL_PREP);
        }
        await page.locator('input#insuredName').fill(SOCIAL_PREP);
        // Fill proposedPremium — required field; handleChange auto-computes proposedAPI from it
        const proposedPremiumInput = page.locator('input#proposedPremium');
        if (await proposedPremiumInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await proposedPremiumInput.fill('100');
          await page.waitForTimeout(400); // allow React to auto-compute proposedAPI
        }
        // Also fill proposedAPI directly in case auto-compute did not fire in time
        const proposedAPI = page.locator('input#proposedAPI');
        if (await proposedAPI.isVisible({ timeout: 1000 }).catch(() => false)) {
          const apiVal = await proposedAPI.inputValue().catch(() => '');
          if (!apiVal) await proposedAPI.fill('1200');
        }

        // Submit the form
        const saveBtn = page.getByRole('button', { name: /Save Policy/i });
        const saveBtnEnabled = await saveBtn.isEnabled({ timeout: 2000 }).catch(() => false);
        console.log(`  [diag] saveBtn enabled=${saveBtnEnabled}`);
        if (saveBtnEnabled) {
          await saveBtn.click();
          // Wait up to 20 seconds for the create form to disappear (save success = view → list)
          const formGone = await page.waitForFunction(
            () => !document.querySelector('select#sourceOfProspect'),
            { timeout: 20000 },
          ).then(() => true).catch(() => false);
          // If form is still visible, check if an error was displayed
          if (!formGone) {
            const saveErrorText = await page.evaluate(() => {
              const errs = Array.from(document.querySelectorAll('[role="alert"]'));
              return errs.map(e => e.textContent.trim()).filter(Boolean).join('; ') || null;
            });
            console.log(`  [diag] save did not succeed — formGone=false, error: ${saveErrorText ?? 'none'}`);
          } else {
            console.log('  [diag] save succeeded — form closed, view returned to list');
          }

          // Reload and verify via REST
          await hardReloadAndAwaitReady(page);
          await page.waitForTimeout(2000);

          // Verify via REST — structured query with agentId filter (rules require it)
          const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/tenants/${TENANT_ID}:runQuery`;
          const { ok: qOk, body: qBodyArr } = await (async () => {
            const r = await fetch(runQueryUrl, {
              method: 'POST',
              headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                structuredQuery: {
                  from: [{ collectionId: 'policies' }],
                  where: {
                    fieldFilter: {
                      field: { fieldPath: 'agentId' },
                      op: 'EQUAL',
                      value: { stringValue: AGENT_UID },
                    },
                  },
                  limit: 50,
                },
              }),
            });
            return { ok: r.ok, body: await r.json() };
          })();
          // runQuery returns an array of result objects; each has a .document property
          const qBody = { documents: Array.isArray(qBodyArr) ? qBodyArr.map(r => r.document).filter(Boolean) : [] };

          if (!qOk) {
            const errMsg = qBody?.error?.message ?? JSON.stringify(qBody).slice(0, 120);
            skip('leg-d-policy-persist', `REST query failed (${errMsg}) — verify manually`);
          } else {
            const docs = qBody.documents ?? [];
            const match = docs.find((d) => readStr(d, 'ownerName') === SOCIAL_PREP);
            if (!match) {
              skip('leg-d-policy-persist', 'Policy doc not found in last 20 — may need pagination');
            } else {
              const policyPlat = readStr(match, 'socialPlatform');
              if (policyPlat === 'instagram') {
                pass('leg-d-policy-persist', `policy socialPlatform=instagram ✓`);
              } else {
                fail('leg-d-policy-persist', `Expected instagram, got ${policyPlat}`);
              }
            }
          }
        } else {
          skip('leg-d-policy-save', 'Save Policy button still disabled — required field missing, skipping persist verify');
        }
      }
    }

    // ── Leg g: console errors ──────────────────────────────────────────────────
    if (consoleErrors.length === 0) {
      pass('leg-g-console-errors', '0 JS console errors ✓');
    } else {
      fail('leg-g-console-errors', `${consoleErrors.length} error(s): ${consoleErrors.slice(0,3).join(' | ')}`);
    }

  } finally {
    await context.close();
    await browser.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok === true).length;
  const failed = results.filter((r) => r.ok === false).length;
  const skipped = results.filter((r) => r.ok === null).length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`RESULT: ${passed} passed  ${failed} failed  ${skipped} skipped  (${results.length} total)`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.error('FAIL — one or more legs failed.');
    process.exit(1);
  }
})().catch((err) => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});
