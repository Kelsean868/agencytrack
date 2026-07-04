/**
 * live-b3-post-deploy.mjs — PR-B3 POST-DEPLOY live suggest-back cycle
 * (FOLLOW_UPS.md "PR-B3 deferred verification"), plus the B2 Rule 22
 * check-3 (not-over-committed) hand-pin closure.
 *
 * PURPOSE: live post-deploy verification of the planSuggestions rules
 * (write-read-ack cycle + foil denies) against production.
 *
 * OPERATOR-RUN-ONLY: requires Admin SDK credentials (service-account-key.json)
 * and writes/cleans real production docs in tatillife_smoke. NEVER wire this
 * into CI. Run only after a rules deploy touching planSuggestions, with
 * dispatcher authorization.
 *
 * CLEANUP CONTRACT: every doc this script creates must be deleted by its own
 * teardown (the `finally` block) — exit non-zero if any orphan remains.
 *
 * Real production writes against tatillife_smoke. Runs:
 *   0. Fetch the agent's REAL yearPlan/moneyNeeds (as the agent) to compute
 *      the expected checkNotOverCommitted() verdict locally.
 *   1. Flip moneyNeeds visibility to 'shared' (restored in finally).
 *   2. UM logs in via the real drawer → Year tab → hand-pin assert
 *      tpd-health-commit's data-ok against the locally-computed expectation
 *      (closes the B2 Rule 22 gap).
 *   3. UM sends a suggestion via the real Send card (L1) → REST-verify the
 *      landed doc (raisedByUid pinned, status open, seenAt null).
 *   4. L3 denials while the doc is still 'open': out-of-unit UM foil create,
 *      agent self-create, manager ack — all expect permission-denied.
 *   5. Agent opens the Game Plan hub (L2) → card renders unread → the card's
 *      own fire-and-forget ack flips it to 'seen' → REST-verify.
 *   6. L4 cleanup via Admin SDK (delete:false blocks token deletes) → 0 orphans.
 *   7. Restore moneyNeeds visibility to its original value.
 *
 * Run: node scripts/verification/live-b3-post-deploy.mjs <https-preview-or-prod-url>
 */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
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

const TARGET_URL = (process.argv[2] || '').replace(/\/$/, '');
if (!TARGET_URL.startsWith('https://')) {
  console.error('Usage: node scripts/verification/live-b3-post-deploy.mjs <https-url>');
  process.exit(2);
}

const FIREBASE_PROJECT = 'agencytrack-2a610';
const SMOKE_TENANT     = 'tatillife_smoke';
const YEAR             = new Date().getFullYear();
const LINE_KEYS        = ['life', 'ah', 'general'];

const results = [];
const pass = (label, note = '') => { results.push({ label, ok: true }); console.log(`  ✅ ${label}${note ? ': ' + note : ''}`); };
const fail = (label, detail = '') => { results.push({ label, ok: false, detail }); console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`); };

// ── Firestore REST value helpers ────────────────────────────────────────────
function fsToJs(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) {
    const out = {};
    for (const [k, vv] of Object.entries(v.mapValue.fields ?? {})) out[k] = fsToJs(vv);
    return out;
  }
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fsToJs);
  return null;
}
function docToJs(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc?.fields ?? {})) out[k] = fsToJs(v);
  return out;
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

async function restPost(idToken, parentPath, collectionId, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${parentPath}/${collectionId}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const body = await resp.json();
  return { ok: resp.ok, status: resp.status, body };
}
async function restPatch(idToken, path, fields, fieldMasks) {
  const maskParams = fieldMasks.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${path}?${maskParams}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const body = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, body };
}
async function restList(idToken, parentPath, collectionId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${parentPath}/${collectionId}?orderBy=createdAt%20desc`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  const body = await resp.json();
  return { ok: resp.ok, status: resp.status, docs: body.documents ?? [] };
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
  const umToken  = await getIdToken(E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD, E.VITE_FIREBASE_API_KEY);
  const umClaims = decodeJwt(umToken);
  const UM_UID   = umClaims.user_id;
  safeLog(`[setup] tenant=${TENANT_ID} agent=${AGENT_UID} um=${UM_UID}`);

  const moneyNeedsPath = `tenants/${TENANT_ID}/users/${AGENT_UID}/moneyNeeds/${YEAR}`;
  const yearPlanPath   = `tenants/${TENANT_ID}/users/${AGENT_UID}/yearPlan/${YEAR}`;
  const suggestionsColl = 'planSuggestions';
  const suggestionsParent = `tenants/${TENANT_ID}/users/${AGENT_UID}`;

  let flipped = false;
  let hadVisibility = false;
  let originalVisibility = 'private';
  let createdSuggestionName = null; // full REST resource name for cleanup

  const require_ = createRequire(import.meta.url);
  const admin = require_(join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
  admin.initializeApp({ projectId: FIREBASE_PROJECT, credential: admin.credential.cert(require_(join(ROOT, 'functions', 'service-account-key.json'))) });
  const adb = admin.firestore();

  const browser = await chromium.launch({ headless: true });
  let capture = null;

  try {
    // ── Step 0: fetch real docs, compute check-3 expectation ──────────────
    const originalMoneyNeeds = await firestoreGet(moneyNeedsPath, agentToken, FIREBASE_PROJECT).then((r) => r.body);
    hadVisibility = originalMoneyNeeds.fields?.visibility !== undefined;
    originalVisibility = originalMoneyNeeds.fields?.visibility?.stringValue ?? 'private';
    const moneyNeedsJs = docToJs(originalMoneyNeeds);
    const firstYearCommissionsRequired = num(moneyNeedsJs.firstYearCommissionsRequired);

    const yearPlanDoc = await firestoreGet(yearPlanPath, agentToken, FIREBASE_PROJECT).then((r) => r.body);
    const yearPlanJs = docToJs(yearPlanDoc);
    const lines = yearPlanJs.lines ?? {};
    const planTotalCommission = LINE_KEYS.reduce((sum, k) => sum + num(lines?.[k]?.derivedCommission), 0);
    const expectedCommitOk = planTotalCommission >= firstYearCommissionsRequired;
    safeLog(`[fixture] planTotalCommission=${planTotalCommission} required=${firstYearCommissionsRequired} expectedOk=${expectedCommitOk}`);

    // ── Step 1: flip visibility to shared (restore in finally) ────────────
    if (originalVisibility !== 'shared') {
      await restPatch(agentToken, moneyNeedsPath, { visibility: { stringValue: 'shared' } }, ['visibility']);
      flipped = true;
      safeLog('[seed] moneyNeeds visibility flipped to shared (will restore)');
    }

    // ── Discover an out-of-unit foil agent for L3a (Admin SDK, read-only) ──
    const usersSnap = await adb.collection(`tenants/${TENANT_ID}/users`).get();
    let foilAgentUid = null;
    usersSnap.forEach((d) => {
      const u = d.data();
      if (!foilAgentUid && u.role === 'agent' && u.unitId && u.unitId !== UM_UID) foilAgentUid = d.id;
    });
    if (!foilAgentUid) safeLog('[foil] SKIP-NOT-FAIL: no out-of-unit agent exists in the smoke tenant.');

    // ── Browser: UM drawer session ──────────────────────────────────────────
    const umCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const umPage = await umCtx.newPage();
    capture = captureConsoleAndNetwork(umPage);
    await setupBypassSession(umCtx, TARGET_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(umPage, E.A11Y_UNIT_MANAGER_EMAIL, E.A11Y_UNIT_MANAGER_PASSWORD, `${TARGET_URL}/`);

    await waitForFirebaseReady(umPage, 25_000);
    await umPage.waitForSelector('[data-testid^="nav-"]', { state: 'attached', timeout: 30_000 });
    const navSel = '[data-testid="nav-team-game-plans"]';
    if (!(await umPage.locator(navSel).first().isVisible().catch(() => false))) {
      const toggle = umPage.locator('[data-testid="sidebar-ws-toggle-team"]');
      if (await toggle.first().isVisible().catch(() => false)) await toggle.first().click();
    }
    await umPage.waitForSelector(navSel, { state: 'visible', timeout: 15_000 });
    await umPage.locator(navSel).first().click();
    await umPage.waitForSelector('[data-testid="team-plans-roster"][data-loading="false"]', { timeout: 30_000 });

    await umPage.locator(`[data-testid="team-plans-view-${AGENT_UID}"]`).click();
    await umPage.waitForSelector('[data-testid="team-plans-drawer"]', { timeout: 15_000 });
    await umPage.locator('[data-testid="tpd-tab-year"]').click();
    await umPage.waitForSelector('[data-testid="tpd-plan-health"]', { timeout: 20_000 });

    // ── Rule 22 hand-pin: assert tpd-health-commit against the fixture ─────
    const commitRow = umPage.locator('[data-testid="tpd-health-commit"]');
    if (await commitRow.count() === 0) {
      fail('B2-check3: tpd-health-commit rendered', 'row absent (worksheet not shared?)');
    } else {
      const renderedOk = await commitRow.getAttribute('data-ok');
      const expected = expectedCommitOk ? 'true' : 'false';
      if (renderedOk === expected) pass('B2-check3: tpd-health-commit matches fixture', `rendered=${renderedOk} expected=${expected} (planCommission=${planTotalCommission}, required=${firstYearCommissionsRequired})`);
      else fail('B2-check3: tpd-health-commit MISMATCH', `rendered=${renderedOk} expected=${expected}`);
    }

    // ── L1: UM sends a suggestion via the real Send card ───────────────────
    const noteText = `B3 live post-deploy verification — ${new Date().toISOString()}`;
    await umPage.waitForSelector('[data-testid="tpd-suggest-card"]', { timeout: 20_000 });
    await umPage.locator('[data-testid="tpd-suggest-note"]').fill(noteText);
    await umPage.locator('[data-testid="tpd-suggest-send"]').click();
    await umPage.waitForFunction(
      () => document.querySelector('[data-testid="tpd-suggest-status"]')?.textContent?.toLowerCase().includes('sent'),
      { timeout: 15_000 }
    ).catch(() => {});

    // ── REST-verify the landed doc ──────────────────────────────────────────
    const afterSend = await restList(umToken, suggestionsParent, suggestionsColl);
    const created = afterSend.docs.find((d) => docToJs(d).note === noteText);
    if (!created) {
      fail('L1: create via Send card', 'no matching doc found in list');
    } else {
      createdSuggestionName = created.name; // full path incl. project/db prefix
      const js = docToJs(created);
      const okAll = js.raisedByUid === UM_UID && js.agentId === AGENT_UID && js.tenantId === TENANT_ID
        && js.status === 'open' && js.seenAt === null;
      okAll
        ? pass('L1: create via Send card', `raisedByUid pinned=${js.raisedByUid}, status=open, seenAt=null`)
        : fail('L1: create via Send card — field mismatch', JSON.stringify(js).slice(0, 300));
    }

    const suggestionRelPath = created ? `${suggestionsParent}/${suggestionsColl}/${created.name.split('/').pop()}` : null;

    // ── L3 denials (doc still 'open') ───────────────────────────────────────
    const nowTs = new Date().toISOString();
    const baseFields = {
      tenantId: { stringValue: TENANT_ID },
      year: { integerValue: String(YEAR) },
      note: { stringValue: 'foil/self attempt' },
      raisedByName: { stringValue: 'Foil' },
      raisedByRole: { stringValue: 'unit_manager' },
      status: { stringValue: 'open' },
      createdAt: { timestampValue: nowTs },
      seenAt: { nullValue: null },
    };

    if (foilAgentUid) {
      const r = await restPost(umToken, `tenants/${TENANT_ID}/users/${foilAgentUid}`, suggestionsColl, {
        ...baseFields, agentId: { stringValue: foilAgentUid }, raisedByUid: { stringValue: UM_UID },
      });
      r.status === 403 ? pass('L3a: out-of-unit UM foil create DENIED', `status=${r.status}`)
                        : fail('L3a: out-of-unit UM foil create', `expected 403, got ${r.status}`);
    } else {
      results.push({ label: 'L3a: out-of-unit UM foil create', ok: true, skipped: true });
      console.log('  ~ L3a: SKIP-NOT-FAIL (no out-of-unit foil agent in smoke tenant)');
    }

    const selfCreate = await restPost(agentToken, `tenants/${TENANT_ID}/users/${AGENT_UID}`, suggestionsColl, {
      ...baseFields, agentId: { stringValue: AGENT_UID }, raisedByUid: { stringValue: AGENT_UID }, raisedByRole: { stringValue: 'agent' },
    });
    selfCreate.status === 403 ? pass('L3b: agent self-create DENIED', `status=${selfCreate.status}`)
                               : fail('L3b: agent self-create', `expected 403, got ${selfCreate.status}`);

    if (suggestionRelPath) {
      const ackAttempt = await restPatch(umToken, suggestionRelPath, {
        status: { stringValue: 'seen' }, seenAt: { timestampValue: nowTs },
      }, ['status', 'seenAt']);
      ackAttempt.status === 403 ? pass('L3c: manager ack DENIED', `status=${ackAttempt.status}`)
                                 : fail('L3c: manager ack', `expected 403, got ${ackAttempt.status}`);
    } else {
      fail('L3c: manager ack DENIED', 'no created doc to attempt ack against');
    }

    await umPage.keyboard.press('Escape');
    await umPage.waitForSelector('[data-testid="team-plans-drawer"]', { state: 'detached', timeout: 10_000 }).catch(() => {});

    // ── L2: agent hub — unread render + fire-and-forget ack ─────────────────
    const agentCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const agentPage = await agentCtx.newPage();
    await setupBypassSession(agentCtx, TARGET_URL, E.VERCEL_BYPASS_TOKEN);
    await loginAs(agentPage, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, `${TARGET_URL}/`);
    await waitForFirebaseReady(agentPage, 25_000);
    await agentPage.waitForSelector('[data-testid="agent-tab-game-plan"]', { state: 'visible', timeout: 30_000 });
    await agentPage.locator('[data-testid="agent-tab-game-plan"]').first().click();
    await agentPage.waitForSelector('[data-testid="game-plan-anchor"]', { timeout: 20_000 });

    await agentPage.waitForSelector('[data-testid="plan-suggestions-card"]', { timeout: 15_000 }).catch(() => {});
    const cardVisible = await agentPage.locator('[data-testid="plan-suggestions-card"]').count();
    if (cardVisible === 1) {
      const items = await agentPage.locator('[data-testid="plan-suggestion-item"]').count();
      pass('L2: agent hub renders PlanSuggestionsCard', `${items} item(s)`);
    } else {
      fail('L2: agent hub PlanSuggestionsCard', `expected 1, got ${cardVisible}`);
    }

    // The card's own effect fires markSuggestionSeen fire-and-forget on mount;
    // poll the REST doc until status flips (bounded wait).
    if (suggestionRelPath) {
      let acked = false;
      for (let i = 0; i < 10 && !acked; i++) {
        await agentPage.waitForTimeout(1000);
        const check = await firestoreGet(suggestionRelPath, agentToken, FIREBASE_PROJECT).then((r) => r.body);
        const js = docToJs(check);
        if (js.status === 'seen' && js.seenAt) acked = true;
      }
      acked ? pass('L2: card auto-ack flips open→seen', 'seenAt is a live timestamp')
            : fail('L2: card auto-ack', 'status never flipped to seen within 10s');
    }

    await agentCtx.close();
    await umCtx.close();
  } catch (e) {
    fail('live-b3-post-deploy', `crashed: ${e.message}`);
  } finally {
    // ── L4 cleanup ───────────────────────────────────────────────────────────
    try {
      if (createdSuggestionName) {
        const suggestionId = createdSuggestionName.split('/').pop();
        await adb.doc(`tenants/${TENANT_ID}/users/${AGENT_UID}/planSuggestions/${suggestionId}`).delete();
        const remaining = await adb.collection(`tenants/${TENANT_ID}/users/${AGENT_UID}/planSuggestions`).get();
        remaining.empty ? pass('L4: cleanup', '0 orphans (planSuggestions collection empty)')
                         : fail('L4: cleanup', `${remaining.size} doc(s) remain`);
      } else {
        const remaining = await adb.collection(`tenants/${TENANT_ID}/users/${AGENT_UID}/planSuggestions`).get();
        remaining.empty ? pass('L4: cleanup', '0 orphans (nothing created, collection empty)')
                         : fail('L4: cleanup', `${remaining.size} unexpected doc(s) present`);
      }
    } catch (e) { fail('L4: cleanup', `delete error: ${e.message}`); }

    try {
      if (flipped) {
        if (hadVisibility) {
          await restPatch(agentToken, moneyNeedsPath, { visibility: { stringValue: originalVisibility } }, ['visibility']);
          pass('cleanup: visibility restored', originalVisibility);
        } else {
          await restPatch(agentToken, moneyNeedsPath, {}, ['visibility']);
          pass('cleanup: visibility field removed', 'was absent originally');
        }
      } else {
        pass('cleanup: visibility unchanged', 'already shared');
      }
    } catch (e) { fail('cleanup: visibility restore', e.message); }

    if (capture) console.log(formatCaptureReport(capture));
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
    if (failed.length) { failed.forEach((r) => console.log(`  ✗ ${r.label}${r.detail ? ' — ' + r.detail : ''}`)); process.exit(1); }
    console.log('All legs green.');
    process.exit(0);
  }
})();
