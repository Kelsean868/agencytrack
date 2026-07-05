/**
 * smoke-bug101-wizard-draft-gate.mjs
 *
 * BUG-101 regression smoke: the wizard STEP screen must not render editable
 * inputs until the async getDraft() check resolves (mirrors the Confirm
 * screen's existing draftLoaded gate). Two symptoms are proven closed:
 *
 *   1. Merge-clobber (unsubmitted/draft week): the step body must appear only
 *      AFTER the "Loading your week…" spinner — never coexisting with it — so a
 *      value typed by the user cannot be overwritten by the late draft merge
 *      (setFormData spread, WizardForm.jsx:297). Proven via a high-frequency DOM
 *      state recorder under CDP network throttle (the throttle widens the
 *      getDraft round-trip so the loading window is deterministically sampled).
 *
 *   2. Accept-then-discard (already-submitted week): the step body must NEVER
 *      render for a submitted week — the wizard transitions loading →
 *      "Already submitted" interstitial with no editable-input window.
 *
 * Plus a behavioral value-survival check (type into a field post-load, confirm
 * it does not revert) and a restore so the smoke tenant draft is net-zero.
 *
 * Coverage: desktop light + desktop dark + 380px mobile light.
 * READ/ASSERT + one restored write. Does NOT submit. Credentials via .env.local
 * → process.env only (never in a tool param). Bypass via setupBypassSession.
 *
 * Usage:
 *   SMOKE_PREVIEW_URL="https://<immutable-deployment>.vercel.app" \
 *     node scripts/verification/smoke-bug101-wizard-draft-gate.mjs
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  loginAs,
  setTheme,
  captureConsoleAndNetwork,
  formatCaptureReport,
  stamp,
} from './lib/walk-helpers.mjs';

// Env is loaded via `node --env-file=.env.local` (see the usage header) — no
// dotenv dependency at repo root. Credentials are read by name only, never echoed.

const BASE = (process.env.SMOKE_PREVIEW_URL || process.env.SMOKE_BASE_URL || '')
  .replace(/\/+$/, '');
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS = process.env.A11Y_AGENT_PASSWORD;

if (!BASE || !TOKEN || !EMAIL || !PASS) {
  console.error('MISSING ENV: need SMOKE_PREVIEW_URL, VERCEL_BYPASS_TOKEN, A11Y_AGENT_EMAIL, A11Y_AGENT_PASSWORD');
  process.exit(2);
}

const results = [];
const pass = (id, msg) => { results.push({ id, ok: true, msg }); console.log(`[${stamp()}] ✅ ${id} — ${msg}`); };
const fail = (id, msg) => { results.push({ id, ok: false, msg }); console.log(`[${stamp()}] ❌ ${id} — ${msg}`); };

// CDP throttle: widen the getDraft round-trip so the loading window is sampled.
async function throttle(page, on) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: on ? 800 : 0,
    downloadThroughput: on ? (1.5 * 1024 * 1024) / 8 : -1,
    uploadThroughput: on ? (750 * 1024) / 8 : -1,
  });
  return cdp;
}

// Open the wizard date-picker via the Weekly Report action. Handles desktop
// (visible sidebar link) + mobile 380px (QuickAdd ＋ menu, else the More drawer).
async function openWizardDatePicker(page) {
  const sidebar = page.locator('[data-testid="agent-tab-wizard"]').first();
  if (await sidebar.isVisible({ timeout: 1500 }).catch(() => false)) {
    await sidebar.click();
  } else {
    // Mobile: open the center ＋ QuickAdd menu, then pick the Weekly Report item.
    const fab = page.locator('[data-testid="bottomnav-create"]').first();
    if (await fab.isVisible({ timeout: 2500 }).catch(() => false)) {
      await fab.click();
      await page.waitForTimeout(400);
    }
    const qa = page.locator('[data-testid="quickadd-submit"], [data-testid="quickadd-wizard"]').first();
    if (await qa.isVisible({ timeout: 2500 }).catch(() => false)) {
      await qa.click();
    } else {
      // Fallback: the More drawer surfaces the sidebar item on mobile.
      const more = page.locator('[data-testid="bottomnav-more"]').first();
      if (await more.isVisible({ timeout: 2500 }).catch(() => false)) {
        await more.click();
        await page.waitForTimeout(400);
        await page.locator('[data-testid="agent-tab-wizard"]').first().click({ timeout: 4000 });
      }
    }
  }
  // The wizard opens at the date-picker (screen='date') for non-daily agents.
  await page.waitForSelector('#wizard-week', { timeout: 8000 });
}

const fmt = (ms) => (ms === null ? 'n/a' : Math.round(ms) + 'ms');

// Open week `i`, record the open sequence, classify, and assert inline (single
// open per week — avoids a cache-warm re-open showing a different state).
// Returns 'submitted' | 'unsubmitted' | 'inconclusive'.
async function assertWeek(page, i, { label, doBehavioral }) {
  await openWizardDatePicker(page);
  await selectWeekAndStart(page, i);
  const seq = await recordOpenSequence(page);

  // Submitted week: step body must NEVER render → loading → interstitial.
  // The recorder (which terminates ON the interstitial) is the deterministic
  // proof: an <h2>"Already submitted" was seen while no step body ever mounted.
  // (Do NOT re-query getByRole('heading',{name:'Already submitted'}) — it matches
  // BOTH the header <h1> and the interstitial <h2>, a strict-mode multiple.)
  if (seq.interstitialAt !== null && seq.stepBodyAt === null) {
    pass(`${label}:submitted-gate`, `week[${i}] loading@${fmt(seq.loadingAt)} → interstitial@${fmt(seq.interstitialAt)}, step body NEVER rendered (no type-then-lose window)`);
    await closeWizard(page);
    return 'submitted';
  }

  // Unsubmitted week: step body must appear only AFTER the loading gate, never
  // coexisting. On the OLD (ungated) code there is no step-loading spinner at
  // all, so loadingAt===null — this is the fix's discriminator.
  if (seq.stepBodyAt !== null && seq.interstitialAt === null) {
    const gateOk =
      seq.coexist === false &&
      seq.loadingAt !== null &&
      seq.loadingAt <= seq.stepBodyAt;
    if (gateOk) {
      pass(`${label}:unsubmitted-gate`, `week[${i}] loading@${fmt(seq.loadingAt)} → step@${fmt(seq.stepBodyAt)}, never coexisting (pre-resolve typing is impossible)`);
    } else {
      fail(`${label}:unsubmitted-gate`, `week[${i}] coexist=${seq.coexist} loadingAt=${fmt(seq.loadingAt)} stepBodyAt=${fmt(seq.stepBodyAt)} — the fix's loading→step ordering did not hold`);
    }

    if (doBehavioral && gateOk) {
      const stepBody = page.locator('[data-testid="wizard-v2-step-1"]').first();
      const input = stepBody.locator('input').first();
      if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
        const original = await input.inputValue().catch(() => '');
        const testVal = original === '9' ? '8' : '9';
        await input.click();
        await input.fill(testVal);
        await page.waitForTimeout(3200); // past the old ~2s revert window + autosave
        const after = await input.inputValue().catch(() => '');
        if (after === testVal) {
          pass(`${label}:value-survives`, `typed "${testVal}" into the first step field, stable after 3.2s (no revert; original="${original}")`);
        } else {
          fail(`${label}:value-survives`, `typed "${testVal}" but field read back "${after}" — value reverted`);
        }
        // Restore so the smoke tenant draft is net-zero. Wait for the restore's
        // autosave to actually cycle (saving → saved) rather than a fixed sleep:
        // the 1500ms debounce + throttled round-trip can exceed any fixed wait, and
        // closing early would leave the draft at the test value. (CodeRabbit #794.)
        await input.click();
        await input.fill(original);
        const chip = '[data-testid="wizard-v2-autosave-chip"]';
        await page.locator(`${chip}[data-state="saving"]`).waitFor({ timeout: 6000 }).catch(() => {});
        await page.locator(`${chip}[data-state="saved"], ${chip}[data-state="saved-offline"]`).waitFor({ timeout: 10000 }).catch(() => {});
      } else {
        fail(`${label}:value-survives`, 'no editable input found in the rendered step body');
      }
    }
    await closeWizard(page);
    return 'unsubmitted';
  }

  await closeWizard(page);
  return 'inconclusive';
}

// High-frequency DOM recorder: from the moment "Start Report" is clicked, sample
// the loading spinner, the step body, and the interstitial. Terminal on
// interstitial, or settled step (stepBody && !loading), or timeout.
async function recordOpenSequence(page, maxMs = 6000) {
  return page.evaluate(async (maxMs) => {
    const STEP_SEL = Array.from({ length: 12 }, (_, i) => `[data-testid="wizard-v2-step-${i + 1}"]`).join(',');
    const t0 = performance.now();
    const seen = { loadingAt: null, stepBodyAt: null, interstitialAt: null, coexist: false };
    const sample = () => {
      const loading = !!document.querySelector('[data-testid="wizard-v2-step-loading"]');
      const stepBody = !!document.querySelector(STEP_SEL);
      const interstitial = Array.from(document.querySelectorAll('h2'))
        .some((h) => (h.textContent || '').includes('Already submitted'));
      const now = performance.now() - t0;
      if (loading && seen.loadingAt === null) seen.loadingAt = now;
      if (stepBody && seen.stepBodyAt === null) seen.stepBodyAt = now;
      if (interstitial && seen.interstitialAt === null) seen.interstitialAt = now;
      if (loading && stepBody) seen.coexist = true;
      return { loading, stepBody, interstitial };
    };
    return new Promise((resolve) => {
      const iv = setInterval(() => {
        const s = sample();
        const elapsed = performance.now() - t0;
        if (s.interstitial || (s.stepBody && !s.loading) || elapsed > maxMs) {
          clearInterval(iv);
          sample();
          resolve(seen);
        }
      }, 16);
    });
  }, maxMs);
}

// Select the Nth date option and click Start Report.
async function selectWeekAndStart(page, index) {
  const opts = await page.$$eval('#wizard-week option', (os) => os.map((o) => o.value));
  if (index >= opts.length) return false;
  await page.selectOption('#wizard-week', opts[index]);
  await page.getByRole('button', { name: /start report/i }).click();
  return true;
}

// Close the wizard back to the dashboard.
async function closeWizard(page) {
  const close = page.locator('[data-testid="wizard-v2-close"]').first();
  if (await close.isVisible({ timeout: 2000 }).catch(() => false)) {
    await close.click();
    await page.waitForTimeout(400);
  }
}

async function runLeg({ browser, theme, viewport, label, findIndices, doBehavioral }) {
  console.log(`\n──────── LEG: ${label} ────────`);
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  await setTheme(context, theme);
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    await loginAs(page, BASE, EMAIL, PASS);
    await throttle(page, true);

    let submittedIdx = findIndices?.submittedIdx ?? null;
    let unsubmittedIdx = findIndices?.unsubmittedIdx ?? null;

    if (submittedIdx !== null && unsubmittedIdx !== null) {
      // Known indices (later legs): assert each in a fresh, cache-cold context.
      await assertWeek(page, submittedIdx, { label, doBehavioral: false });
      await assertWeek(page, unsubmittedIdx, { label, doBehavioral });
    } else {
      // First leg: probe up to 6 weeks, asserting inline, until one submitted +
      // one unsubmitted week are found.
      await openWizardDatePicker(page);
      const optCount = await page.$$eval('#wizard-week option', (os) => os.length);
      await closeWizard(page);
      for (let i = 0; i < optCount && (submittedIdx === null || unsubmittedIdx === null); i++) {
        const kind = await assertWeek(page, i, {
          label,
          doBehavioral: doBehavioral && unsubmittedIdx === null,
        });
        if (kind === 'submitted' && submittedIdx === null) submittedIdx = i;
        else if (kind === 'unsubmitted' && unsubmittedIdx === null) unsubmittedIdx = i;
        else console.log(`[${stamp()}]   week[${i}] → ${kind}`);
      }
      if (submittedIdx === null) fail(`${label}:submitted-gate`, 'SKIP — no submitted week among the 6 date options (env data gap; every recent week is a draft/empty)');
      if (unsubmittedIdx === null) fail(`${label}:unsubmitted-gate`, 'SKIP — no unsubmitted week among the 6 date options (env data gap)');
    }

    // Console/network hygiene.
    const errs = capture.consoleMessages.filter((m) => {
      const t = typeof m.type === 'function' ? m.type() : m.type;
      return t === 'error';
    });
    if (errs.length === 0) pass(`${label}:console`, '0 console errors');
    else fail(`${label}:console`, `${errs.length} console errors: ${errs.map((m) => (typeof m.text === 'function' ? m.text() : m.text)).join(' | ').slice(0, 300)}`);

    return { submittedIdx, unsubmittedIdx };
  } finally {
    console.log(formatCaptureReport(capture));
    await context.close();
  }
}

(async () => {
  console.log(`[${stamp()}] BUG-101 wizard draft-gate smoke → ${BASE}`);
  const browser = await chromium.launch();
  const hardTimeout = setTimeout(() => {
    console.error('\n⏱️  GLOBAL TIMEOUT — dumping partial results');
    console.error(JSON.stringify(results, null, 2));
    process.exit(1);
  }, 9 * 60 * 1000);

  let indices = {};
  try {
    indices = await runLeg({
      browser, theme: 'light', viewport: { width: 1440, height: 900 },
      label: 'desktop-light', findIndices: null, doBehavioral: true,
    });
    await runLeg({
      browser, theme: 'dark', viewport: { width: 1440, height: 900 },
      label: 'desktop-dark', findIndices: indices, doBehavioral: false,
    });
    await runLeg({
      browser, theme: 'light', viewport: { width: 380, height: 820 },
      label: 'mobile-light', findIndices: indices, doBehavioral: false,
    });
  } catch (err) {
    fail('harness', `${err.name}: ${err.message}`);
  } finally {
    await browser.close();
    clearTimeout(hardTimeout);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n════════ SUMMARY ════════');
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.id} — ${r.msg}`);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  process.exit(failed.length === 0 ? 0 : 1);
})();
