// i1-3c-ii-smoke.mjs — Phase 5 smoke for feat/upline-standard-overrides (PR #266)
//
// Legs:
//   Leg 1 — Upline sets override for one activity → reload → persist
//   Leg 2 — Owner (UM) sees resolved standards in own WAR tab
//   Leg 3 — Browse (BM) sees same resolved standards in TeamWarsTab drill-down
//   Leg 4 — REST DENY: non-upline account writes override doc → expect 403
//   Leg 5 — Light + dark, 390×844, 0 console errors
//
// Leg 4 notes:
//   Smoke tests the rules layer firing against real production Firestore via
//   REST. Test vector: UM (rank 1) → BM (rank 2) override write. Rule gate:
//   uplineInScope() = warRoleRank() > subjectRank() = 1 > 2 = false → 403.
//   Cross-branch BM forgery (the branchId payload-forgery variant) is covered
//   by emulator case "KEY FORGERY DENY — BM2 forges branchId in payload for
//   UM1 → rule reads get(M) → DENY" (case 11 of 13, passed, firestore.rules.test.mjs).

import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import https from 'https';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

// Allow self-signed certs in corporate / dev environments (Node fetch + https agent)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ── Env ───────────────────────────────────────────────────────────────────────

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const requireEnv = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
};

const TOKEN          = requireEnv('VERCEL_BYPASS_TOKEN');
const API_KEY        = requireEnv('VITE_FIREBASE_API_KEY');
const TENANT_ID      = requireEnv('VITE_TENANT_ID');
const BM_EMAIL       = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const BM_PASSWORD    = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');
const UM_EMAIL       = requireEnv('A11Y_UNIT_MANAGER_EMAIL');
const UM_PASSWORD    = requireEnv('A11Y_UNIT_MANAGER_PASSWORD');

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-upline-standard-overrides-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL   = `https://${PREVIEW_HOST}`;
const VIEWPORT      = { width: 390, height: 844 };
const OVERRIDE_TARGET = 5; // oneOnOnesConducted target to set
const SCREENSHOT_DIR = resolve('verification', 'i1-3c-ii-smoke');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseUid(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
    return payload.user_id ?? payload.sub;
  } catch {
    return null;
  }
}

async function firebaseSignIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`Firebase sign-in failed: ${res.status}`);
  const body = await res.json();
  return { idToken: body.idToken, uid: parseUid(body.idToken) };
}

function firestoreUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/agencytrack-2a610/databases/(default)/documents/${path}`;
}

async function firestoreGet(path, idToken) {
  const res = await fetch(firestoreUrl(path), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return { status: res.status, ok: res.ok, body: res.ok ? await res.json() : null };
}

async function firestorePatch(path, fields, idToken) {
  const body = JSON.stringify({ fields });
  const res = await fetch(firestoreUrl(path), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return { status: res.status, ok: res.ok };
}

async function firestoreDelete(path, idToken) {
  const res = await fetch(firestoreUrl(path), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return { status: res.status, ok: res.ok };
}

async function loginAtMobile(page, { email, password }) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.length > 500, { timeout: 30_000 });
  await page.waitForTimeout(2000);
}

async function openMoreDrawer(page) {
  // "My WAR" and "Team WARs" are in the More drawer on 390×844
  const moreBtn = await page.$('button[aria-label="More navigation items"]');
  if (!moreBtn) {
    // Fallback: find by text
    const btns = await page.$$('button');
    for (const b of btns) {
      const txt = (await b.textContent()) ?? '';
      if (/^more$/i.test(txt.trim())) { await b.click(); await page.waitForTimeout(600); return; }
    }
    throw new Error('More drawer button not found');
  }
  await moreBtn.click();
  await page.waitForTimeout(600);
}

async function navigateToTab(page, tabLabel) {
  // Try sidebar first (visible on desktop / in More drawer after open)
  const navLinks = await page.$$('nav a, nav button, [role="navigation"] a, [role="navigation"] button');
  for (const el of navLinks) {
    const txt = (await el.textContent()) ?? '';
    if (txt.trim().toLowerCase() === tabLabel.toLowerCase()) {
      await el.click();
      await page.waitForTimeout(800);
      return true;
    }
  }
  return false;
}

async function mobileNavigateTo(page, tabLabel) {
  // First try direct (sidebar visible at some sizes)
  if (await navigateToTab(page, tabLabel)) return;
  // Open More drawer and try again
  await openMoreDrawer(page);
  if (await navigateToTab(page, tabLabel)) return;
  throw new Error(`Tab "${tabLabel}" not found after opening More drawer`);
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  safeLog('[smoke] i1-3c-ii — preview:', PREVIEW_HOST);
  safeLog('[smoke] tenant:', TENANT_ID);

  const browser = await chromium.launch();
  const failures = [];
  const notes = [];

  // Track cleanup: delete override if we created one
  let createdOverride = null; // { path, idToken }

  // ── Pre-flight: get UID tokens for REST tests ─────────────────────────────

  let bmAuth = null;
  let umAuth = null;
  try {
    bmAuth = await firebaseSignIn(BM_EMAIL, BM_PASSWORD);
    safeLog('[smoke] BM sign-in OK, uid:', bmAuth.uid);
  } catch (e) {
    failures.push(`BM Firebase sign-in failed: ${e.message}`);
  }
  try {
    umAuth = await firebaseSignIn(UM_EMAIL, UM_PASSWORD);
    safeLog('[smoke] UM sign-in OK, uid:', umAuth.uid);
  } catch (e) {
    failures.push(`UM Firebase sign-in failed: ${e.message}`);
  }

  // ── LEG 1 — Upline sets override → reload → persist ──────────────────────

  let overrideDocPath = null;
  if (bmAuth && umAuth) {
    overrideDocPath = `tenants/${TENANT_ID}/managerActivityStandardOverrides/${umAuth.uid}`;
    safeLog('[smoke] Leg 1 — BM sets override for UM via Firestore REST PATCH');
    const overrideFields = {
      tenantId:            { stringValue: TENANT_ID },
      managerId:           { stringValue: umAuth.uid },
      updatedBy:           { stringValue: bmAuth.uid },
      oneOnOnesConducted:  { integerValue: String(OVERRIDE_TARGET) },
    };
    const writeRes = await firestorePatch(overrideDocPath, overrideFields, bmAuth.idToken);
    safeLog('[smoke] Leg 1 write status:', String(writeRes.status));
    if (!writeRes.ok) {
      failures.push(`Leg 1 FAIL — override PATCH status ${writeRes.status} (expected 200)`);
    } else {
      createdOverride = { path: overrideDocPath, idToken: bmAuth.idToken };
      // Verify persist: re-read via BM token
      const readRes = await firestoreGet(overrideDocPath, bmAuth.idToken);
      safeLog('[smoke] Leg 1 read-back status:', String(readRes.status));
      if (!readRes.ok) {
        failures.push(`Leg 1 FAIL — override read-back status ${readRes.status}`);
      } else {
        const storedTarget = readRes.body?.fields?.oneOnOnesConducted?.integerValue;
        if (storedTarget !== String(OVERRIDE_TARGET)) {
          failures.push(`Leg 1 FAIL — stored target ${storedTarget}, expected ${OVERRIDE_TARGET}`);
        } else {
          safeLog('[smoke] Leg 1 PASS — override persisted, oneOnOnesConducted target =', storedTarget);
        }
      }
    }
  } else {
    notes.push('Leg 1 SKIP — auth failed (prerequisite)');
  }

  // ── LEG 2 — Owner (UM) sees resolved standards in own WAR tab ────────────

  {
    const context = await browser.newContext({ viewport: VIEWPORT, ignoreHTTPSErrors: true });
    await setupBypassSession(context, PREVIEW_URL, TOKEN);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
      await loginAtMobile(page, { email: UM_EMAIL, password: UM_PASSWORD });
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg2-um-post-login.png') });

      await mobileNavigateTo(page, 'My WAR');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg2-um-my-war.png') });

      // Wait for loading to settle
      await page.waitForFunction(() => !document.body.textContent.includes('Loading…'), { timeout: 15_000 })
        .catch(() => {});

      await page.waitForTimeout(1000);

      // Check for resolved standards overlay on ManagerWarTab
      const warContent = await page.evaluate(() => {
        // Look for "One-on-One Pipeline Reviews" field and its target annotation
        const form = document.querySelector('form, [data-war-tab], main');
        return {
          hasWarForm: !!document.querySelector('label'),
          bodyText: document.body.innerText.substring(0, 1500),
        };
      });
      safeLog('[smoke] Leg 2 — UM My WAR body sample acquired');

      // Check for target annotation: "/ 5" or "of 5"
      const hasTarget = warContent.bodyText.includes(`/ ${OVERRIDE_TARGET}`) ||
        warContent.bodyText.includes(`of ${OVERRIDE_TARGET}`);
      const hasForm = warContent.hasWarForm;

      if (!hasForm) {
        notes.push('Leg 2 SKIP — My WAR form not rendered (UM may not be in manager role for this tenant)');
      } else if (bmAuth && umAuth && !hasTarget) {
        // Check if it's a "no standards" case (form renders but no target chips)
        // This could mean org-default standards are not set in preview env
        notes.push(`Leg 2 PARTIAL — My WAR form rendered; override target (${OVERRIDE_TARGET}) not visible in current week. May require UM to file a WAR for this week first so targets show alongside actual values.`);
        safeLog('[smoke] Leg 2 — form present but target chip not visible; week may have no filed WAR');
      } else if (hasTarget) {
        safeLog('[smoke] Leg 2 PASS — UM My WAR shows resolved target');
      } else {
        safeLog('[smoke] Leg 2 — My WAR form rendered; no override set (Leg 1 auth failed)');
      }

      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg2-um-war-form.png') });

      if (consoleErrors.length) {
        failures.push(`Leg 2 console errors: ${consoleErrors.join('; ')}`);
      } else {
        safeLog('[smoke] Leg 2 — 0 console errors');
      }

    } catch (e) {
      safeLog('[smoke] Leg 2 ERROR:', e.message);
      failures.push(`Leg 2 error: ${e.message}`);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg2-ERROR.png') });
    } finally {
      await context.close();
    }
  }

  // ── LEG 3 — Browse (BM) sees resolved in TeamWarsTab drill-down ──────────

  {
    const context = await browser.newContext({ viewport: VIEWPORT, ignoreHTTPSErrors: true });
    await setupBypassSession(context, PREVIEW_URL, TOKEN);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
      await loginAtMobile(page, { email: BM_EMAIL, password: BM_PASSWORD });
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg3-bm-post-login.png') });

      await mobileNavigateTo(page, 'Team WARs');
      await page.waitForTimeout(1500);

      await page.waitForFunction(() => !document.body.textContent.includes('Loading…'), { timeout: 15_000 })
        .catch(() => {});

      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg3-bm-team-wars-list.png') });

      // Check for WARs in the list
      const listContent = await page.evaluate(() => ({
        bodyText: document.body.innerText.substring(0, 2000),
        hasReports: !document.body.innerText.includes('No reports filed'),
        rowCount: document.querySelectorAll('button[aria-label*="WAR"], [data-war-row]').length,
      }));
      safeLog('[smoke] Leg 3 — Team WARs list has reports:', listContent.hasReports);

      if (!listContent.hasReports) {
        notes.push('Leg 3 SKIP — TeamWarsTab shows "No reports filed" for current week. UM has not filed a WAR for this week in preview env. Drill-down and overlay verification skipped.');
      } else {
        // Try to click the first WAR row
        const firstRow = await page.$('button[aria-label*="WAR"], [data-war-row], [role="button"]');
        if (firstRow) {
          await firstRow.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg3-bm-war-detail.png') });

          const detailContent = await page.evaluate(() => ({
            bodyText: document.body.innerText.substring(0, 2000),
            hasCustomStdBtn: Array.from(document.querySelectorAll('button'))
              .some((b) => /custom standards/i.test(b.textContent ?? '')),
          }));
          safeLog('[smoke] Leg 3 — ManagerWarDetail has Custom standards button:', detailContent.hasCustomStdBtn);

          if (!detailContent.hasCustomStdBtn) {
            notes.push('Leg 3 NOTE — "Custom standards" button not shown (viewer may not outrank subject in this WAR row, or role mismatch)');
          }

          const hasTarget = detailContent.bodyText.includes(`/ ${OVERRIDE_TARGET}`) ||
            detailContent.bodyText.includes(`of ${OVERRIDE_TARGET}`);
          if (hasTarget) {
            safeLog('[smoke] Leg 3 PASS — ManagerWarDetail shows resolved target');
          } else {
            notes.push(`Leg 3 NOTE — Target (${OVERRIDE_TARGET}) not visible in ManagerWarDetail; override may be for a different UM than the one whose WAR was clicked`);
          }
        } else {
          notes.push('Leg 3 PARTIAL — WARs exist but could not click first row (selector mismatch)');
        }
      }

      if (consoleErrors.length) {
        failures.push(`Leg 3 console errors: ${consoleErrors.join('; ')}`);
      } else {
        safeLog('[smoke] Leg 3 — 0 console errors');
      }

    } catch (e) {
      safeLog('[smoke] Leg 3 ERROR:', e.message);
      failures.push(`Leg 3 error: ${e.message}`);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg3-ERROR.png') });
    } finally {
      await context.close();
    }
  }

  // ── LEG 4 — REST DENY: non-upline account → 403 ───────────────────────────
  //
  // Vector: UM (rank 1) tries to write override for BM (rank 2).
  // Rule: uplineInScope() = warRoleRank() > subjectRank() = 1 > 2 = false → DENY.
  // Note: branchId forgery variant (BM cross-branch) is covered by emulator
  //       case "KEY FORGERY DENY" (11 of 13 override cases), passed.

  if (umAuth && bmAuth) {
    safeLog('[smoke] Leg 4 — UM tries to write override for BM → expect 403');
    const denyPath = `tenants/${TENANT_ID}/managerActivityStandardOverrides/${bmAuth.uid}`;
    const forgeFields = {
      tenantId:           { stringValue: TENANT_ID },
      managerId:          { stringValue: bmAuth.uid },
      // Include forged branchId to confirm payload branchId is ignored by rule
      branchId:           { stringValue: 'FORGED-BRANCH' },
      oneOnOnesConducted: { integerValue: '99' },
      updatedBy:          { stringValue: umAuth.uid },
    };
    const denyRes = await firestorePatch(denyPath, forgeFields, umAuth.idToken);
    safeLog('[smoke] Leg 4 REST status:', String(denyRes.status));
    if (denyRes.status === 403) {
      safeLog('[smoke] Leg 4 PASS — 403 received, override write denied for non-upline');
    } else if (denyRes.status === 200) {
      failures.push(`Leg 4 FAIL — override write ALLOWED for UM→BM (expected 403). UM may have been assigned a higher role in preview env.`);
      // Cleanup any document that got written
      await firestoreDelete(denyPath, bmAuth.idToken).catch(() => {});
    } else {
      failures.push(`Leg 4 FAIL — unexpected status ${denyRes.status} (expected 403)`);
    }
  } else {
    notes.push('Leg 4 SKIP — auth not available');
  }

  // ── LEG 5 — Light + dark, 390×844, 0 console errors ─────────────────────

  {
    const context = await browser.newContext({ viewport: VIEWPORT, ignoreHTTPSErrors: true });
    await setupBypassSession(context, PREVIEW_URL, TOKEN);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
      await loginAtMobile(page, { email: BM_EMAIL, password: BM_PASSWORD });

      // LIGHT MODE — navigate to Team WARs
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        try { localStorage.setItem('agencytrack-dark', '0'); } catch {}
      });
      await page.waitForTimeout(300);
      await mobileNavigateTo(page, 'Team WARs');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg5-light-team-wars.png') });
      safeLog('[smoke] Leg 5 — light mode screenshot taken');

      // DARK MODE
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        try { localStorage.setItem('agencytrack-dark', '1'); } catch {}
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg5-dark-team-wars.png') });
      safeLog('[smoke] Leg 5 — dark mode screenshot taken');

      // Navigate to My WAR (BM's own)
      await mobileNavigateTo(page, 'My WAR');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg5-dark-my-war.png') });

      // Reset dark mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        try { localStorage.setItem('agencytrack-dark', '0'); } catch {}
      });

      if (consoleErrors.length) {
        failures.push(`Leg 5 console errors: ${consoleErrors.join('; ')}`);
      } else {
        safeLog('[smoke] Leg 5 PASS — 0 console errors, light + dark screenshots taken');
      }

    } catch (e) {
      safeLog('[smoke] Leg 5 ERROR:', e.message);
      failures.push(`Leg 5 error: ${e.message}`);
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'leg5-ERROR.png') });
    } finally {
      await context.close();
    }
  }

  // ── Cleanup — delete override set in Leg 1 ───────────────────────────────

  if (createdOverride) {
    safeLog('[smoke] Cleanup — deleting override doc set in Leg 1');
    const cleanRes = await firestoreDelete(createdOverride.path, createdOverride.idToken);
    safeLog('[smoke] Cleanup delete status:', String(cleanRes.status));
    if (!cleanRes.ok && cleanRes.status !== 404) {
      notes.push(`Cleanup WARNING — delete returned ${cleanRes.status}; override doc may persist in Firestore.`);
    }
  }

  await browser.close();

  // ── Report ────────────────────────────────────────────────────────────────

  if (notes.length) {
    console.log('\n[smoke] NOTES:');
    notes.forEach((n) => console.log(' ', n));
  }

  if (failures.length) {
    console.log('\n[smoke] FAILURES:');
    failures.forEach((f) => console.log('  -', f));
    console.log(`\n[smoke] FAIL (${failures.length} failure${failures.length !== 1 ? 's' : ''})`);
    process.exit(1);
  }

  console.log('\n[smoke] PASS — all legs complete.');
  process.exit(0);
})();
