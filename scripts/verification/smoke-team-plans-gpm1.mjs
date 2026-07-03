/**
 * smoke-team-plans-gpm1.mjs — PR-GPM1 Team Plans reader smoke (subject-consent
 * round-trip, NON-WAIVABLE). Value-level, both themes, against a Vercel preview.
 *
 * Legs (brief Phase 5):
 *  5.1 CONSENT ON  — agent sets visibility='shared' (REST, agent's own token) on a
 *      seeded worksheet → UM roster shows the row with the EXACT seeded derived
 *      figures → drawer opens → PRIVATE ABSENCE (seeded rent/medical values in NO
 *      DOM anywhere). Asserted in BOTH themes.
 *  5.2 CONSENT OFF — agent flips visibility='private' → UM reload → "Not shared",
 *      figures gone (the honesty proof: live in both directions).
 *  5.3 BM leg      — BM sees the shared row (G5 BM arm exercised by UI).
 *  5.4 Foil        — out-of-unit agent absent from the UM roster entirely.
 *  5.5 Coach       — UM writes a note from the drawer → reload → persisted.
 *  Cleanup: restore the worksheet's original field values + visibility, delete
 *  the smoke coaching note (Admin SDK), verify 0 orphans.
 *
 * SAFETY: hard tenant guard — refuses to run unless the A11Y agent resolves to
 * tatillife_smoke (any other tenant, especially tatillife_south, aborts before
 * any write). Seeding writes go through the agent's OWN client token (rules
 * enforced); only the coaching-note cleanup uses the Admin SDK.
 *
 * Run: node scripts/verification/smoke-team-plans-gpm1.mjs <preview-url>
 */

import { createRequire } from 'module';
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
  console.error('Usage: node scripts/verification/smoke-team-plans-gpm1.mjs <https-preview-url>');
  process.exit(2);
}

const FIREBASE_PROJECT = 'agencytrack-2a610';
const SMOKE_TENANT     = 'tatillife_smoke'; // HARD GUARD — the only tenant this smoke may touch
const YEAR             = new Date().getFullYear();
const NOTE_MARKER      = `GPM1-SMOKE-NOTE-${Date.now()}`;

// Seeded derived figures — unique values so DOM matches are unambiguous.
const SEED = {
  totalAnnualAfterTax: 187456,
  totalAnnualPreTax: 208977,
  computedPAYE: 21521,
  estimatedRenewalIncome: { life: 11017, ah: 2203, property: 991, motor: 443, total: 14654 },
  firstYearCommissionsRequired: 85417,
  firstYearCommissionsTargets: { life: 51250, ah: 17083, property: 8542, motor: 8543, total: 85418 },
  expenseGroups: {
    fixedExpenses: {
      lineItems: [{ id: 'seed-fe-1', label: 'Rent / Mortgage', frequency: 'M', amount: 2013, annualizedAmount: 24156 }],
      subCalculatorRefs: [],
      groupAnnualTotal: 24156,
    },
    livingExpenses: {
      lineItems: [{ id: 'seed-le-3', label: 'Medical & pharmacy', frequency: 'M', amount: 627, annualizedAmount: 7519 }],
      subCalculatorRefs: [],
      groupAnnualTotal: 7519,
    },
  },
};
// SHOWN values that must appear (TTD-formatted) and PRIVATE markers that must not.
const SHOWN_FYC = 'TTD 85,417';
const PRIVATE_MARKERS = ['Rent / Mortgage', '24,156', '24156', '7,519', '7519', 'Medical & pharmacy'];

// Fields this smoke patches (and must restore verbatim from the captured original).
const PATCH_FIELDS = [
  'totalAnnualAfterTax', 'totalAnnualPreTax', 'computedPAYE',
  'estimatedRenewalIncome', 'firstYearCommissionsRequired',
  'firstYearCommissionsTargets', 'expenseGroups', 'visibility',
];

// ── Firestore REST helpers (client tokens — rules enforced) ─────────────────

function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFsValue(x)])) } };
}

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

// ── Results tracker ──────────────────────────────────────────────────────────

const results = [];
const pass = (label, note = '') => { results.push({ label, ok: true }); console.log(`  ✅ ${label}${note ? ': ' + note : ''}`); };
const fail = (label, detail = '') => { results.push({ label, ok: false, detail }); console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`); };

// ── UI helpers ───────────────────────────────────────────────────────────────

async function openTeamPlans(page) {
  await waitForFirebaseReady(page, 25_000);
  // Deterministic settle: manager sidebar mounted.
  await page.waitForSelector('[data-testid^="nav-"]', { state: 'attached', timeout: 30_000 });
  const navSel = '[data-testid="nav-team-game-plans"]';
  if (!(await page.locator(navSel).first().isVisible().catch(() => false))) {
    // Workspace layout: the item lives in the My Team workspace.
    const toggle = page.locator('[data-testid="sidebar-ws-toggle-team"]');
    if (await toggle.first().isVisible().catch(() => false)) await toggle.first().click();
  }
  await page.waitForSelector(navSel, { state: 'visible', timeout: 15_000 });
  await page.locator(navSel).first().click();
  await page.waitForSelector('[data-testid="team-plans-roster"][data-loading="false"]', { timeout: 30_000 });
}

const textOf = (page, testid) => page.locator(`[data-testid="${testid}"]`).first().textContent();

async function assertRosterAndDrawer(page, agentUid, themeTag) {
  const rowFyc = await textOf(page, `team-plans-fyc-${agentUid}`);
  if (rowFyc?.includes(SHOWN_FYC)) pass(`5.1${themeTag}: roster row shows seeded FYC ${SHOWN_FYC}`);
  else fail(`5.1${themeTag}: roster row seeded FYC`, `got "${rowFyc}"`);

  await page.locator(`[data-testid="team-plans-view-${agentUid}"]`).click();
  await page.waitForSelector('[data-testid="team-plans-drawer"]', { timeout: 15_000 });

  const checks = [
    ['tpd-fyc-required', 'TTD 85,417'], ['tpd-target-life', 'TTD 51,250'],
    ['tpd-target-ah', 'TTD 17,083'], ['tpd-target-property', 'TTD 8,542'],
    ['tpd-target-motor', 'TTD 8,543'], ['tpd-renewal-total', 'TTD 14,654'],
    ['tpd-after-tax', 'TTD 187,456'], ['tpd-paye', 'TTD 21,521'], ['tpd-pre-tax', 'TTD 208,977'],
  ];
  let allOk = true;
  for (const [tid, expected] of checks) {
    const got = await textOf(page, tid);
    if (!got?.includes(expected)) { allOk = false; fail(`5.1${themeTag}: drawer ${tid}`, `expected "${expected}", got "${got}"`); }
  }
  if (allOk) pass(`5.1${themeTag}: drawer shows all 9 seeded SHOWN figures exactly`);

  // Targets `total` (85,418) is contract-excluded — must not render.
  const html = await page.evaluate(() => document.body.innerHTML);
  if (!html.includes('85,418')) pass(`5.1${themeTag}: contract-excluded targets.total absent`);
  else fail(`5.1${themeTag}: targets.total leaked`, '85,418 found in DOM');

  const leaked = PRIVATE_MARKERS.filter((m) => html.includes(m));
  if (leaked.length === 0) pass(`5.1${themeTag}: PRIVATE ABSENCE — no seeded expense value/label in DOM`);
  else fail(`5.1${themeTag}: PRIVATE LEAK`, leaked.join(', '));

  // Close the drawer.
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="team-plans-drawer"]', { state: 'detached', timeout: 10_000 });
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const required = [
    'VERCEL_BYPASS_TOKEN', 'VITE_FIREBASE_API_KEY',
    'A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD',
    'A11Y_UNIT_MANAGER_EMAIL', 'A11Y_UNIT_MANAGER_PASSWORD',
    'A11Y_BRANCH_MANAGER_EMAIL', 'A11Y_BRANCH_MANAGER_PASSWORD',
  ];
  const missing = required.filter((k) => !E[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  // ── Runtime fixture + HARD tenant guard ────────────────────────────────────
  const agentToken  = await getIdToken(E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, E.VITE_FIREBASE_API_KEY);
  const agentClaims = decodeJwt(agentToken);
  const AGENT_UID   = agentClaims.user_id;
  const TENANT_ID   = agentClaims.tenantId;
  if (TENANT_ID !== SMOKE_TENANT) {
    console.error(`HARD GUARD: A11Y agent resolves to tenant "${TENANT_ID}" — this smoke only runs against ${SMOKE_TENANT}. Aborting before any write.`);
    process.exit(1);
  }
  const umToken  = await getIdToken(E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD, E.VITE_FIREBASE_API_KEY);
  const UM_UID   = decodeJwt(umToken).user_id;
  safeLog(`[setup] tenant=${TENANT_ID} agent=${AGENT_UID} um=${UM_UID}`);

  const worksheetPath = `tenants/${TENANT_ID}/users/${AGENT_UID}/moneyNeeds/${YEAR}`;

  // ── Capture original doc state (restore target) ────────────────────────────
  const originalDoc = await restGet(agentToken, worksheetPath);
  const originalFields = {};
  for (const f of PATCH_FIELDS) {
    if (originalDoc.fields?.[f] !== undefined) originalFields[f] = originalDoc.fields[f];
  }
  const hadOriginalVisibility = originalDoc.fields?.visibility !== undefined;
  const originalVisibility = originalDoc.fields?.visibility?.stringValue ?? 'private';
  safeLog(`[setup] original visibility=${originalVisibility}; captured ${Object.keys(originalFields).length}/${PATCH_FIELDS.length} restorable fields`);

  // Admin SDK (coaching-note cleanup + 5.4 foil enumeration only — read + targeted delete).
  const require_ = createRequire(import.meta.url);
  const admin = require_(join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
  admin.initializeApp({ projectId: FIREBASE_PROJECT });
  const adb = admin.firestore();

  const browser = await chromium.launch({ headless: true });
  let seeded = false;
  let noteCreated = false;

  try {
    // ── SEED (as the agent, rules-enforced) ──────────────────────────────────
    const seedFields = Object.fromEntries(Object.entries(SEED).map(([k, v]) => [k, toFsValue(v)]));
    seedFields.visibility = { stringValue: 'shared' };
    await restPatch(agentToken, worksheetPath, seedFields, PATCH_FIELDS);
    seeded = true;
    safeLog('[seed] worksheet patched with seeded figures + visibility=shared');

    // ── UM context ───────────────────────────────────────────────────────────
    const umCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const umPage = await umCtx.newPage();
    const umCapture = captureConsoleAndNetwork(umPage);
    await setupBypassSession(umCtx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(umPage, E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD, `${PREVIEW_URL}/`);

    // 5.1 — light theme
    await openTeamPlans(umPage);
    await assertRosterAndDrawer(umPage, AGENT_UID, ' (light)');

    // 5.4 — foil: out-of-unit agent absent from the UM roster entirely.
    const usersSnap = await adb.collection(`tenants/${TENANT_ID}/users`).get();
    const outOfUnit = [];
    usersSnap.forEach((d) => {
      const u = d.data();
      if (u.role === 'agent' && u.unitId && u.unitId !== UM_UID) outOfUnit.push(d.id);
    });
    if (outOfUnit.length === 0) {
      console.log('[5.4] SKIP-NOT-FAIL: no out-of-unit agent exists in the smoke tenant.');
    } else {
      const present = [];
      for (const uid of outOfUnit) {
        if (await umPage.locator(`[data-testid="team-plans-row-${uid}"]`).count() > 0) present.push(uid);
      }
      if (present.length === 0) pass(`5.4: all ${outOfUnit.length} out-of-unit agents absent from UM roster`);
      else fail('5.4: out-of-unit agent leaked into UM roster', present.join(', '));
    }

    // 5.1 — dark theme (same assertions)
    await umPage.evaluate(() => localStorage.setItem('agencytrack-dark', '1'));
    await umPage.reload({ waitUntil: 'domcontentloaded' });
    const isDark = await umPage.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) pass('5.1 (dark): dark theme active after reload');
    else fail('5.1 (dark): dark theme activation');
    await openTeamPlans(umPage);
    await assertRosterAndDrawer(umPage, AGENT_UID, ' (dark)');
    await umPage.evaluate(() => localStorage.removeItem('agencytrack-dark'));

    // 5.5 — Coach write-read from the drawer (light chrome not required).
    await umPage.locator(`[data-testid="team-plans-view-${AGENT_UID}"]`).click();
    await umPage.waitForSelector('[data-testid="team-plans-drawer-coach"]', { timeout: 15_000 });
    await umPage.locator('[data-testid="team-plans-drawer-coach"]').click();
    await umPage.waitForSelector('textarea[aria-label="Coaching note body"]', { timeout: 15_000 });
    await umPage.fill('textarea[aria-label="Coaching note body"]', `Team Plans smoke note ${NOTE_MARKER}`);
    await umPage.getByRole('button', { name: /add note/i }).click();
    noteCreated = true;
    await umPage.waitForFunction(
      (marker) => document.body.textContent.includes(marker),
      NOTE_MARKER,
      { timeout: 15_000 },
    );
    // Reload → reopen → persisted (write-read).
    await umPage.reload({ waitUntil: 'domcontentloaded' });
    await openTeamPlans(umPage);
    await umPage.locator(`[data-testid="team-plans-view-${AGENT_UID}"]`).click();
    await umPage.waitForSelector('[data-testid="team-plans-drawer-coach"]', { timeout: 15_000 });
    await umPage.locator('[data-testid="team-plans-drawer-coach"]').click();
    try {
      await umPage.waitForFunction(
        (marker) => document.body.textContent.includes(marker),
        NOTE_MARKER,
        { timeout: 20_000 },
      );
      pass('5.5: coaching note persisted across reload (write-read)');
    } catch {
      fail('5.5: coaching note persisted across reload', 'marker not found after reload');
    }

    // 5.2 — CONSENT OFF round-trip: agent flips private → UM reload → figures gone.
    await restPatch(agentToken, worksheetPath, { visibility: { stringValue: 'private' } }, ['visibility']);
    safeLog('[5.2] agent flipped visibility=private');
    await umPage.reload({ waitUntil: 'domcontentloaded' });
    await openTeamPlans(umPage);
    const notSharedVisible = await umPage.locator(`[data-testid="team-plans-notshared-${AGENT_UID}"]`).isVisible().catch(() => false);
    const bodyAfterOff = await umPage.evaluate(() => document.body.innerHTML);
    // EVERY seeded shared figure must be gone — not just the headline
    // (CodeRabbit PR #785 review).
    const SHOWN_MARKERS = [
      '85,417', '51,250', '17,083', '8,542', '8,543',
      '14,654', '187,456', '21,521', '208,977',
    ];
    const remainingShown = SHOWN_MARKERS.filter((m) => bodyAfterOff.includes(m));
    if (notSharedVisible && remainingShown.length === 0) {
      pass('5.2: consent-off round-trip — row shows "Not shared", all 9 seeded figures gone');
    } else {
      fail('5.2: consent-off round-trip', `notShared=${notSharedVisible}, remainingShown=[${remainingShown.join(', ')}]`);
    }

    const umErrors = umCapture.consoleMessages.filter((m) => m.type === 'error').length;
    if (umErrors === 0) pass('UM legs: 0 console errors');
    else { fail('UM legs: 0 console errors', `${umErrors} error(s)`); console.log(formatCaptureReport(umCapture)); }
    await umCtx.close();

    // ── 5.3 — BM leg (re-share first) ────────────────────────────────────────
    await restPatch(agentToken, worksheetPath, { visibility: { stringValue: 'shared' } }, ['visibility']);
    const bmCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const bmPage = await bmCtx.newPage();
    const bmCapture = captureConsoleAndNetwork(bmPage);
    await setupBypassSession(bmCtx, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(bmPage, E.A11Y_BRANCH_MANAGER_EMAIL, E.A11Y_BRANCH_MANAGER_PASSWORD, `${PREVIEW_URL}/`);
    await openTeamPlans(bmPage);
    const bmFyc = await textOf(bmPage, `team-plans-fyc-${AGENT_UID}`).catch(() => null);
    if (bmFyc?.includes(SHOWN_FYC)) pass('5.3: BM branch roster shows the shared row with seeded FYC (G5 BM arm via UI)');
    else fail('5.3: BM branch roster shared row', `got "${bmFyc}"`);
    const bmHtml = await bmPage.evaluate(() => document.body.innerHTML);
    const bmLeaks = PRIVATE_MARKERS.filter((m) => bmHtml.includes(m));
    if (bmLeaks.length === 0) pass('5.3: PRIVATE ABSENCE on the BM surface');
    else fail('5.3: PRIVATE LEAK on BM surface', bmLeaks.join(', '));
    const bmErrors = bmCapture.consoleMessages.filter((m) => m.type === 'error').length;
    if (bmErrors === 0) pass('BM leg: 0 console errors');
    else { fail('BM leg: 0 console errors', `${bmErrors} error(s)`); console.log(formatCaptureReport(bmCapture)); }
    await bmCtx.close();
  } finally {
    // ── CLEANUP (non-negotiable) ─────────────────────────────────────────────
    try {
      if (seeded) {
        // Restore verbatim: fields absent from the original are DELETED by the
        // mask (an originally-absent visibility is restored as absent, not
        // defaulted to 'private' — CodeRabbit PR #785 review).
        await restPatch(agentToken, worksheetPath, { ...originalFields }, PATCH_FIELDS);
        // Verify restoration: visibility + one seeded figure reverted.
        const after = await restGet(agentToken, worksheetPath);
        const visNow = after.fields?.visibility?.stringValue;
        const visOk = hadOriginalVisibility ? visNow === originalVisibility : visNow === undefined;
        const fycNow = after.fields?.firstYearCommissionsRequired;
        const fycSeededStill = JSON.stringify(fycNow ?? null).includes('85417');
        if (visOk && !fycSeededStill) {
          pass(`cleanup: worksheet restored (visibility=${visNow ?? '(absent, as original)'}, seeded figures reverted)`);
        } else {
          fail('cleanup: worksheet restore', `visibility=${visNow} (want ${hadOriginalVisibility ? originalVisibility : '(absent)'}), seededFycStill=${fycSeededStill}`);
        }
      }
      // Delete the smoke coaching note (Admin) + orphan check.
      const notesRef = adb.collection(`tenants/${SMOKE_TENANT}/users/${AGENT_UID}/coachingNotes`);
      const notesSnap = await notesRef.get();
      let deleted = 0;
      for (const d of notesSnap.docs) {
        if ((d.data().body || '').includes(NOTE_MARKER)) { await d.ref.delete(); deleted++; }
      }
      const verifySnap = await notesRef.get();
      const orphans = verifySnap.docs.filter((d) => (d.data().body || '').includes(NOTE_MARKER)).length;
      if ((noteCreated ? deleted >= 1 : true) && orphans === 0) {
        pass(`cleanup: coaching note removed (deleted=${deleted}), 0 orphans`);
      } else {
        fail('cleanup: coaching note removal', `deleted=${deleted}, orphans=${orphans}, noteCreated=${noteCreated}`);
      }
    } catch (e) {
      fail('cleanup', e.message);
    }
    await browser.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════');
  console.log('SMOKE SUMMARY — PR-GPM1 Team Plans');
  console.log('══════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  for (const r of results) console.log(`  ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ': ' + r.detail : ''}`);
  console.log(`\n${passed}/${results.length} pass${failed > 0 ? ` (${failed} FAILED)` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
})();
