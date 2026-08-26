/**
 * smoke-service-calls-guard-retirement.mjs — slice B, the half that ships at merge.
 *
 * ── WHAT THIS SMOKE IS, AND WHAT IT DELIBERATELY IS NOT ─────────────────────
 * Slice B's brief names a staging smoke that POSTs a real call through the
 * DEPLOYED `ingestCallActivity` endpoint. That smoke CANNOT run yet: merging a
 * PR ships code, not Cloud Functions, and `firebase deploy --only functions` is
 * a dispatcher action under Rule 19. The endpoint exists in no Firebase project
 * today. It is banked HIGH in docs/FOLLOW_UPS.md and is still owed.
 *
 * This smoke covers the OTHER half of the same PR — the half that is NOT
 * deploy-gated, and therefore changes production behaviour the moment the PR
 * merges and Vercel redeploys.
 *
 * `src/lib/schema/dailyActivity.aggregator.js` is not merely the ESM twin of the
 * cron aggregator. `src/services/loggingModeService.js:80` imports it, and
 * `DailyCaptureV2.jsx:788` runs it on the SAVE HOT PATH, merging the derived
 * rollup into the weekly draft. So the `serviceCalls` omit-when-zero retirement
 * takes effect CLIENT-SIDE at merge with no deploy involved — which makes it
 * exactly the surface that should be smoked BEFORE merge rather than after.
 *
 * ── THE ASSERTION IS A PAIR, AND THE PAIR IS THE POINT ──────────────────────
 * Before this PR, a week with zero daily service calls made the aggregator OMIT
 * `serviceCalls`, so the merge:true write left a stale agent-typed weekly value
 * standing. That survival is the defect the retirement fixes.
 *
 * The retirement is deliberately HALF: `serviceCalls` loses its guard because
 * slice B gives it a daily writer; `referralsObtained` KEEPS its guard because
 * nothing writes it daily. A smoke that only checked `serviceCalls` would pass
 * just as happily against a careless full retirement that also destroyed typed
 * `referralsObtained` values. So the smoke stages BOTH and asserts they diverge:
 *
 *   1. write serviceCalls = 7 AND referralsObtained = 3 into the weekly draft
 *   2. save a day in Daily Capture carrying NEITHER  (triggers the rollup)
 *   3. serviceCalls must be CORRECTED to 0   — the guard is retired
 *      referralsObtained must STILL read 3   — the guard is intact
 *
 * On `main` today, step 3's first assertion still reads 7. That is what makes
 * this a real assertion and not a screenshot.
 *
 * ── WHY IT TALKS TO FIRESTORE OVER REST RATHER THAN DRIVING THE WIZARD ──────
 * The weekly wizard gates its service fields behind a "Did you carry out any
 * service work?" Yes/No, and renders steppers rather than named inputs. Driving
 * that to read one number would make the smoke's own navigation the most
 * fragile thing in it — and a smoke that fails for its own reasons teaches
 * nothing about the code. So the staging write and the verifying read go
 * straight at the document, using the AGENT'S OWN ID TOKEN, which means both
 * still pass through the real Firestore rules layer rather than around it.
 * The write under test — the daily save and its rollup — is still performed by
 * the real app, through the real UI.
 *
 * ── WHY IT RUNS LOCALLY AND NOT ON THE VERCEL PREVIEW ───────────────────────
 * A feature-branch Vercel preview builds against PRODUCTION Firebase — Vercel's
 * staging env vars are bound to the `staging` BRANCH, not the Preview
 * environment. This smoke MUTATES, and a mutating smoke on a feature-branch
 * preview would touch the live tenant. Forbidden. So it follows the documented
 * alternative:
 *
 *   npm run build -- --mode staging
 *   confirm the bundle carries agencytrack-staging and ZERO agencytrack-2a610
 *   npx vite preview --port 4174
 *
 * The binding is re-asserted at RUNTIME below and the smoke REFUSES TO RUN if
 * the app resolves to production. A build-time check alone would not survive
 * someone serving a stale dist/.
 *
 * Usage:  node scripts/verification/smoke-service-calls-guard-retirement.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4174';
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const STAGED_SERVICE_CALLS = 7;
const STAGED_REFERRALS = 3;
const TT_OFFSET_MS = 4 * 60 * 60 * 1000;

function loadEnvFile(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* file absent — fall through to process.env */ }
  return out;
}
// The A11Y_* pair in .env.local is a PRODUCTION account and fails against
// staging Firebase. Staging fixtures are seeded by scripts/staging/seed-staging.mjs
// with the synthetic address below plus STAGING_SEED_PASSWORD from .env.staging.
// Same convention as smoke-daily-call-fields.mjs — do not "fix" this back to
// A11Y_AGENT_EMAIL.
const E = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env.staging'), ...process.env };
const STAGING_AGENT_EMAIL = 'staging-agent-1@agencytrack-staging.test';

const results = [];
const pass = (n, d = '') => { results.push({ name: n, ok: true, detail: d }); console.log(`  PASS  ${n}${d ? ` — ${d}` : ''}`); };
const fail = (n, d = '') => { results.push({ name: n, ok: false, detail: d }); console.log(`  FAIL  ${n}${d ? ` — ${d}` : ''}`); };
const skip = (n, w) => { results.push({ name: n, ok: true, skipped: true, detail: w }); console.log(`  SKIP  ${n} — ${w} (skip, NOT a pass)`); };

/** TT date, then its Sunday — the same two conversions loggingModeService makes. */
function ttWeekStarting(now = new Date()) {
  const tt = new Date(now.getTime() - TT_OFFSET_MS);
  const anchor = new Date(Date.UTC(tt.getUTCFullYear(), tt.getUTCMonth(), tt.getUTCDate(), 12));
  anchor.setUTCDate(anchor.getUTCDate() - anchor.getUTCDay());
  const yyyy = anchor.getUTCFullYear();
  const mm = String(anchor.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(anchor.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function settle(page, selector, quietMs = 600) {
  const floor = Date.now() + 2_000;
  let last = null;
  let stable = 0;
  for (let i = 0; i < 60; i += 1) {
    const now = await page.locator(selector).innerText().catch(() => null);
    stable = (now !== null && now === last) ? stable + 1 : 0;
    last = now;
    if (stable >= 3 && Date.now() >= floor) return;
    await page.waitForTimeout(quietMs / 2);
  }
}

/** The FAB opens Quick Add; the named action opens the real surface. Two clicks. */
async function openViaQuickAdd(page, actionTestId, landingSelector) {
  await page.locator('[data-testid="daily-fab"]').dispatchEvent('click');
  const action = page.locator(`[data-testid="${actionTestId}"]`);
  await action.waitFor({ state: 'visible', timeout: 15_000 });
  // The sheet's full-bleed scrim sits ON TOP of its buttons during the
  // screen-enter transition, so Playwright's actionability check never clears.
  await action.dispatchEvent('click');
  await page.waitForSelector(landingSelector, { timeout: 25_000 });
}

/**
 * The signed-in agent's own credentials, lifted from Firebase Auth's IndexedDB.
 * `tenantId` comes from the ID token's custom claims rather than from any local
 * guess, so the smoke reads exactly the tenant the app itself is scoped to.
 */
async function readSession(page) {
  return page.evaluate(async () => {
    const records = await new Promise((res) => {
      const r = indexedDB.open('firebaseLocalStorageDb');
      r.onsuccess = () => {
        const tx = r.result.transaction('firebaseLocalStorage', 'readonly');
        const all = tx.objectStore('firebaseLocalStorage').getAll();
        all.onsuccess = () => res(all.result);
        all.onerror = () => res(null);
      };
      r.onerror = () => res(null);
    });
    if (!records) return null;
    const rec = records.map((t) => t.value).find((v) => v && v.stsTokenManager);
    if (!rec) return null;
    const token = rec.stsTokenManager.accessToken;
    // base64url -> base64 before atob, which does not accept the URL alphabet.
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { token, uid: rec.uid, tenantId: claims.tenantId };
  });
}

const docUrl = (tenantId, uid, week) =>
  `https://firestore.googleapis.com/v1/projects/agencytrack-staging/databases/(default)/documents/tenants/${tenantId}/submissions/${uid}_${week}`;

/** Read through the rules layer, as the agent. Returns { ok, fields } */
async function readDraft(page, s, week) {
  return page.evaluate(async ([url, token]) => {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 404) return { ok: true, missing: true, fields: {} };
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text()).slice(0, 200) };
    const j = await r.json();
    return { ok: true, fields: j.fields || {} };
  }, [docUrl(s.tenantId, s.uid, week), s.token]);
}

/** Stage the defect: set the two typed values, and ONLY those two. */
async function stageTypedValues(page, s, week) {
  return page.evaluate(async ([url, token, sc, ro]) => {
    const masked = `${url}?updateMask.fieldPaths=serviceCalls&updateMask.fieldPaths=referralsObtained`;
    const r = await fetch(masked, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          serviceCalls: { integerValue: String(sc) },
          referralsObtained: { integerValue: String(ro) },
        },
      }),
    });
    return r.ok ? { ok: true } : { ok: false, status: r.status, body: (await r.text()).slice(0, 220) };
  }, [docUrl(s.tenantId, s.uid, week), s.token, STAGED_SERVICE_CALLS, STAGED_REFERRALS]);
}

const intOf = (fields, key) => {
  const f = fields[key];
  if (!f) return null; // ABSENT — which for referralsObtained is a legitimate state
  return Number(f.integerValue ?? f.doubleValue ?? NaN);
};

async function runLeg(browser, theme) {
  console.log(`\n── ${theme.toUpperCase()} leg ──`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((t) => {
    try {
      if (t === 'dark') localStorage.setItem('agencytrack-dark', '1');
      else localStorage.removeItem('agencytrack-dark');
    } catch { /* storage unavailable */ }
  }, theme);

  const page = await context.newPage();
  const failedRequests = [];
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });

  try {
    // ── GUARD: refuse to run against production Firebase ─────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    const projectId = await page.evaluate(async () => {
      const html = document.documentElement.outerHTML;
      for (const u of [...document.querySelectorAll('script[src]')].map((s) => s.src)) {
        const t = await fetch(u).then((r) => r.text()).catch(() => '');
        const m = /agencytrack-(staging|2a610)/.exec(t);
        if (m) return m[0];
      }
      return /agencytrack-(staging|2a610)/.exec(html)?.[0] ?? 'unknown';
    });
    if (projectId !== 'agencytrack-staging') {
      fail(`[${theme}] firebase target guard`, `app is pointed at "${projectId}" — refusing to run a mutating smoke`);
      return;
    }
    pass(`[${theme}] firebase target guard`, 'agencytrack-staging (NOT production)');

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark === (theme === 'dark')) pass(`[${theme}] theme booted`, `html.dark=${isDark}`);
    else { fail(`[${theme}] theme booted`, `html.dark=${isDark}, expected ${theme === 'dark'}`); return; }

    // ── login ────────────────────────────────────────────────────────────────
    if (!E.STAGING_SEED_PASSWORD) {
      skip(`[${theme}] agent login`, 'STAGING_SEED_PASSWORD not set in this worktree (.env.staging)');
      return;
    }
    await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
    await page.fill('input[type="email"]', STAGING_AGENT_EMAIL);
    await page.fill('input[type="password"]', E.STAGING_SEED_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="daily-fab"]', { timeout: 30_000 });
    pass(`[${theme}] agent login + dashboard`, 'daily-fab present');

    const session = await readSession(page);
    if (!session || !session.token || !session.tenantId) {
      skip(`[${theme}] read agent session`, 'could not lift the ID token / tenant claim');
      return;
    }
    const week = ttWeekStarting();
    pass(`[${theme}] agent session`, `tenant=${session.tenantId} week=${week}`);

    // ── 0. a SUBMITTED week would make the client skip aggregation entirely ──
    const before = await readDraft(page, session, week);
    if (!before.ok) {
      skip(`[${theme}] read weekly draft`, `Firestore ${before.status}: ${before.body}`);
      return;
    }
    if (before.fields.status?.stringValue === 'submitted') {
      skip(`[${theme}] weekly draft is a DRAFT`, 'this week is already submitted — the client skips aggregation by design');
      return;
    }

    // ── 1. STAGE THE DEFECT ─────────────────────────────────────────────────
    const staged = await stageTypedValues(page, session, week);
    if (!staged.ok) {
      skip(`[${theme}] stage typed values`, `Firestore ${staged.status}: ${staged.body}`);
      return;
    }
    const check = await readDraft(page, session, week);
    if (intOf(check.fields, 'serviceCalls') === STAGED_SERVICE_CALLS
      && intOf(check.fields, 'referralsObtained') === STAGED_REFERRALS) {
      pass(`[${theme}] staged the typed values`, `serviceCalls=${STAGED_SERVICE_CALLS} referralsObtained=${STAGED_REFERRALS}`);
    } else {
      fail(`[${theme}] staged the typed values`,
        `read back serviceCalls=${intOf(check.fields, 'serviceCalls')} referralsObtained=${intOf(check.fields, 'referralsObtained')}`);
      return;
    }

    // ── 2. SAVE A DAY CARRYING NEITHER FIELD (triggers the rollup) ───────────
    await openViaQuickAdd(page, 'quickadd-log-today', '[data-testid="daily-capture-v2"]');
    await settle(page, '[data-testid="daily-capture-v2"]');
    const dialUp = page.locator('button[aria-label="Dials (total calls) increase"]');
    if (!(await dialUp.count())) {
      skip(`[${theme}] daily dials stepper`, 'stepper not reachable in this state');
      return;
    }
    await dialUp.click();
    await settle(page, '[data-testid="daily-capture-v2"]');
    await page.click('[data-testid="dcv2-save"]');
    await page.waitForSelector('[data-testid="daily-capture-v2"]', { state: 'detached', timeout: 25_000 });
    // The rollup is awaited inside the save handler, but the merge write lands
    // a beat after the dialog closes.
    await page.waitForTimeout(4_000);
    pass(`[${theme}] daily entry saved`, 'dials +1, zero service calls — rollup merged through the real rule layer');

    // ── 3. THE PAIRED ASSERTION ─────────────────────────────────────────────
    const after = await readDraft(page, session, week);
    if (!after.ok) {
      fail(`[${theme}] re-read weekly draft`, `Firestore ${after.status}: ${after.body}`);
      return;
    }
    const sc = intOf(after.fields, 'serviceCalls');
    const ro = intOf(after.fields, 'referralsObtained');

    if (sc === 0) {
      pass(`[${theme}] serviceCalls GUARD RETIRED — derived 0 overwrote the typed value`, `${STAGED_SERVICE_CALLS} -> 0`);
    } else if (sc === STAGED_SERVICE_CALLS) {
      fail(`[${theme}] serviceCalls GUARD RETIRED — derived 0 overwrote the typed value`,
        `still reads ${sc} — the omit-when-zero guard is STILL IN FORCE on the client path`);
    } else {
      fail(`[${theme}] serviceCalls GUARD RETIRED — derived 0 overwrote the typed value`, `expected 0, read ${sc}`);
    }

    if (ro === STAGED_REFERRALS) {
      pass(`[${theme}] referralsObtained GUARD INTACT — typed value preserved`, `still ${ro}, as it must be`);
    } else {
      fail(`[${theme}] referralsObtained GUARD INTACT — typed value preserved`,
        `read ${ro} — the OTHER half of the guard was retired too, destroying a typed 3pt value`);
    }

    // The rest of the rollup must still have landed, or the two results above
    // could both be true for the boring reason that nothing was written at all.
    const dials = intOf(after.fields, 'dials');
    if (dials !== null && dials > 0) pass(`[${theme}] the rollup actually ran`, `dials=${dials} written by the aggregator`);
    else fail(`[${theme}] the rollup actually ran`, `dials=${dials} — no aggregation appears to have happened`);

    await page.screenshot({ path: `screenshots/smoke-service-calls-guard-${theme}-${TS}.png`, fullPage: false });

    const realFailures = failedRequests.filter(
      // _vercel/insights is injected by Vercel's edge and does not exist on a
      // local serve. Environment artifact, not an app defect.
      (u) => !/favicon|apple-touch-icon|manifest|sw\.js|workbox|\/pwa-|_vercel\/(speed-)?insights|identitytoolkit.*accounts:lookup/i.test(u),
    );
    if (realFailures.length === 0) pass(`[${theme}] no unexplained failed requests`, `${failedRequests.length} benign (icons/PWA)`);
    else fail(`[${theme}] no unexplained failed requests`, realFailures.slice(0, 4).join(' | '));
  } catch (err) {
    fail(`[${theme}] leg crashed`, err.message);
  } finally {
    await context.close();
  }
}

(async () => {
  console.log(`\n=== smoke-service-calls-guard-retirement ${TS} ===`);
  console.log(`base: ${BASE}  (local serve of a --mode staging build)`);
  const browser = await chromium.launch();
  try {
    await runLeg(browser, 'light');
    await runLeg(browser, 'dark');
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`\n=== ${results.length - failed.length - skipped.length} PASS / ${failed.length} FAIL / ${skipped.length} SKIP ===`);
  if (failed.length) { failed.forEach((f) => console.log(`  FAILED: ${f.name} — ${f.detail}`)); process.exit(1); }
  process.exit(0);
})();
