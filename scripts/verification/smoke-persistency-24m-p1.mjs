/**
 * smoke-persistency-24m-p1.mjs — PR #937 (slice P1, Tatil 24-month persistency
 * model, memo of 29 Aug 2026).
 *
 * ⚠ READ-ONLY BY DESIGN, AND IT HAS TO BE. A feature-branch Vercel preview
 * builds against PRODUCTION Firebase (agencytrack-2a610), so signing in here
 * authenticates against the live tenant and reads live data. The surface this
 * PR changes is a WRITE surface — the persistency entry drawer — so this walk
 * opens it, reads it, and closes it with Escape. It NEVER submits. Do not add
 * a save; a save here would write a real persistency figure for a real agent.
 *
 * What it proves that the unit tests cannot: that in a real browser, against
 * real data, the entry form asks for the input set the SELECTED MONTH's model
 * requires — and that the month-dating did not regress the legacy path.
 *
 * The assertion is a cross-check, not a hardcoded expectation: the walk reads
 * the month the app selected, decides for itself which model that month is on
 * (>= 2026-09 is the 24-month model), and then requires the rendered drawer to
 * agree — model marker, field count, and the presence or absence of the
 * `decreases` input. So it passes on whichever month production happens to
 * hold, and fails if the form and the month disagree.
 *
 * SKIP-NOT-FAIL: if the agent's month is manager-locked, or no month is
 * selectable, the drawer legs skip with an explicit note rather than passing.
 * A missing-data step must never read as a pass.
 *
 * Usage:
 *   node scripts/verification/smoke-persistency-24m-p1.mjs <preview-url>
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  loginAs,
  waitForFirebaseReady,
  captureConsoleAndNetwork,
  formatCaptureReport,
  setTheme,
  waitForTheme,
  stamp,
  installGlobalTimeout,
  finishSmoke,
} from './lib/walk-helpers.mjs';

const BASE_URL = process.argv[2];
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASSWORD = process.env.A11Y_AGENT_PASSWORD;
const MGR_EMAIL = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const MGR_PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const SHOT_DIR = process.env.SMOKE_SHOT_DIR || '.';

const MODEL_EFFECTIVE_FROM = '2026-09';
const LEGACY_INPUTS = ['businessPlaced', 'notTakens', 'incPPPs', 'lumpsums100', 'lapses', 'reinstatements'];

if (!BASE_URL) {
  console.error('usage: node scripts/verification/smoke-persistency-24m-p1.mjs <preview-url>');
  process.exit(2);
}
for (const [name, value] of [
  ['VERCEL_BYPASS_TOKEN', TOKEN],
  ['A11Y_AGENT_EMAIL', EMAIL],
  ['A11Y_AGENT_PASSWORD', PASSWORD],
]) {
  if (!value) {
    console.error(`missing ${name} — set it in .env.local and re-run from the main worktree`);
    process.exit(2);
  }
}

const results = [];
const record = (leg, passed, detail = '') => {
  results.push({ leg, passed, detail });
  console.log(`${stamp()} ${passed ? 'PASS' : 'FAIL'}  ${leg}${detail ? ' — ' + detail : ''}`);
};

// Teardown noise, not regressions. Closing a context while Firestore's
// long-poll listener is open aborts that channel, and the browser aborts
// in-flight font fetches on navigation. Both are ERR_ABORTED and both happen
// on main too, so they are excluded from the "no failed requests" leg — but
// they are PRINTED, so an excluded failure is still visible rather than hidden.
const isTeardownNoise = (f) => {
  const url = f.url ?? String(f);
  const err = f.failure ?? f.errorText ?? JSON.stringify(f);
  if (!/ERR_ABORTED/.test(err)) return false;
  return /\.woff2(\?|$)/.test(url)
    || /firestore\.googleapis\.com\/.*\/Listen\/channel/.test(url);
};
const skip = (name, why) => {
  console.log(`${stamp()} SKIP  ${name} — ${why}`);
};

const clear = installGlobalTimeout(420_000, () => {
  console.error('global timeout — smoke aborted');
  process.exit(1);
});

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(context, BASE_URL, TOKEN);
    const page = await context.newPage();
    const capture = captureConsoleAndNetwork(page);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    record(`[${theme}] app boots and Firebase initialises`, true);

    await loginAs(page, BASE_URL, EMAIL, PASSWORD);
    await waitForFirebaseReady(page);
    const signedIn = !(await page.locator('input[type="password"]').first().isVisible().catch(() => false));
    record(`[${theme}] signs in and leaves the login screen`, signedIn);

    await setTheme(context, theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    const themeOk = await waitForTheme(page, theme).then(() => true).catch(() => false);
    record(`[${theme}] renders in the ${theme} theme`, themeOk);

    // ── Persistency tab ─────────────────────────────────────────────────────
    const tab = page.locator('[data-testid="agent-tab-persistency"]');
    const tabThere = await tab.isVisible().catch(() => false);
    record(`[${theme}] persistency tab is reachable`, tabThere);

    if (!tabThere) {
      skip(`[${theme}] entry drawer legs`, 'persistency tab not reachable for this account');
      await context.close();
      continue;
    }

    await tab.click();
    await page.waitForTimeout(1500);

    // Which month did the app select? The walk derives the expected model from
    // this rather than assuming one, so it works against whatever prod holds.
    const monthKey = await page.locator('select').first().inputValue().catch(() => '');
    const monthOk = /^\d{4}-\d{2}$/.test(monthKey);
    record(`[${theme}] a report month is selected`, monthOk, monthOk ? monthKey : `got "${monthKey}"`);

    if (!monthOk) {
      skip(`[${theme}] entry drawer legs`, 'no selectable report month in this tenant');
      await context.close();
      continue;
    }

    const expect24 = monthKey >= MODEL_EFFECTIVE_FROM;
    const expectedModel = expect24 ? 'tatil24' : 'legacy12';
    const expectedCount = expect24 ? 7 : 6;

    const editBtn = page.locator('[data-testid="agent-persistency-edit-button"]');
    const locked = await editBtn.isDisabled().catch(() => true);
    if (locked) {
      skip(`[${theme}] entry drawer legs`, `month ${monthKey} is manager-locked or unavailable for self-entry`);
      const errsEarly = capture.consoleMessages.filter((m) => m.type === 'error');
      record(`[${theme}] no console errors`, errsEarly.length === 0,
        errsEarly.length ? errsEarly.slice(0, 3).map((e) => e.text).join(' | ') : 'clean');
      await context.close();
      continue;
    }

    await editBtn.click();
    // NB: the role="dialog" wrapper holds only position:fixed children, so it
    // has no layout box of its own and reads as hidden. Anchor on a real input.
    await page.waitForSelector('[data-testid="persistency-input-businessPlaced"]',
      { state: 'visible', timeout: 15_000 });
    record(`[${theme}] entry drawer opens for ${monthKey}`, true);

    // The model marker the component rendered.
    const markerOk = await page.locator(`[data-testid="persistency-inputs-${expectedModel}"]`)
      .isVisible().catch(() => false);
    record(`[${theme}] drawer renders the ${expectedModel} model for ${monthKey}`, markerOk);

    // Field count must match the model the month is on.
    const fieldCount = await page.locator('[data-testid^="persistency-input-"]').count();
    record(`[${theme}] drawer shows ${expectedCount} inputs for ${monthKey}`,
      fieldCount === expectedCount, `rendered ${fieldCount}`);

    // `decreases` present exactly when the month is on the 24-month model.
    const hasDecreases = await page.locator('[data-testid="persistency-input-decreases"]')
      .isVisible().catch(() => false);
    record(`[${theme}] decreases input ${expect24 ? 'present' : 'absent'} for ${monthKey}`,
      hasDecreases === expect24);

    // Every legacy input survives on both models — the memo adds a term, it
    // removes none. A regression here would silently drop a money field.
    let allLegacy = true;
    for (const f of LEGACY_INPUTS) {
      const there = await page.locator(`[data-testid="persistency-input-${f}"]`)
        .isVisible().catch(() => false);
      if (!there) allLegacy = false;
    }
    record(`[${theme}] all six legacy inputs still render`, allLegacy);

    // Denominator label follows the model's vocabulary.
    const previewText = await page.locator('[data-testid="persistency-derived-preview"]')
      .innerText().catch(() => '');
    const labelOk = expect24
      ? previewText.includes('Net Gross Settled')
      : previewText.includes('Gross Settled') && !previewText.includes('Net Gross Settled');
    record(`[${theme}] derived denominator uses the ${expectedModel} label`, labelOk,
      previewText.replace(/\s+/g, ' ').slice(0, 80));

    // No retired "12-month" copy on a 24-month month.
    if (expect24) {
      const drawerText = await page.locator('[data-testid="persistency-entry-form"] form').innerText();
      record(`[${theme}] no "12-month" copy on a 24-month month`, !/12[- ]?month/i.test(drawerText));
    }

    await page.screenshot({
      path: `${SHOT_DIR}/persistency-24m-${expectedModel}-${monthKey}-${theme}.png`,
      fullPage: false,
    });

    // Close WITHOUT saving. This is the whole read-only contract.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // Same reason: assert the drawer is GONE from the DOM, not merely "hidden".
    const closed = (await page.locator('[data-testid="persistency-entry-form"]').count()) === 0;
    record(`[${theme}] drawer closes on Escape with no write`, closed);

    const errors = capture.consoleMessages.filter((m) => m.type === 'error');
    record(`[${theme}] no console errors`, errors.length === 0,
      errors.length ? errors.slice(0, 3).map((e) => e.text).join(' | ') : 'clean');
    const noisy = capture.networkFailures.filter(isTeardownNoise);
    const real  = capture.networkFailures.filter((f) => !isTeardownNoise(f));
    if (noisy.length) {
      console.log(`${stamp()} NOTE  [${theme}] ${noisy.length} ERR_ABORTED excluded as teardown noise (fonts / Firestore Listen channel)`);
    }
    record(`[${theme}] no failed network requests`, real.length === 0,
      real.length ? formatCaptureReport({ ...capture, networkFailures: real }) : `clean (${noisy.length} teardown aborts excluded)`);

    await context.close();
  }

  // ── Manager leg: the LEGACY side of the boundary ────────────────────────────
  //
  // The agent account carries no persistency documents, so its selector falls
  // back to the current month (2026-09) and only ever exercises the 24-month
  // model. A manager sees every month the tenant actually has, which is where a
  // pre-September month can be opened and the six-field form proven unchanged.
  // Still strictly read-only: open, read, Escape.
  if (MGR_EMAIL && MGR_PASSWORD) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(context, BASE_URL, TOKEN);
    const page = await context.newPage();
    const capture = captureConsoleAndNetwork(page);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    await loginAs(page, BASE_URL, MGR_EMAIL, MGR_PASSWORD);
    await waitForFirebaseReady(page);
    record('[manager] signs in', true);

    const nav = page.getByRole('button', { name: /persistency/i }).first()
      .or(page.getByRole('link', { name: /persistency/i }).first());
    const navThere = await nav.isVisible().catch(() => false);
    if (!navThere) {
      skip('[manager] legacy-month legs', 'no Persistency nav reachable for this manager account');
    } else {
      await nav.click();
      await page.waitForSelector('[data-testid="pers-roster"]', { timeout: 20_000 }).catch(() => {});

      const monthSelect = page.locator('select').first();
      const options = await monthSelect.locator('option').evaluateAll(
        (els) => els.map((e) => e.value).filter((v) => /^\d{4}-\d{2}$/.test(v)),
      ).catch(() => []);
      // P1b evidence line (brief §4): printed unconditionally so a paste-back
      // always has it, regardless of which branch below executes.
      console.log(`${stamp()} INFO  [manager] month select options: ${options.join(', ') || 'none'}`);
      const legacyMonth = options.filter((m) => m < MODEL_EFFECTIVE_FROM).sort().reverse()[0];
      record('[manager] tenant has a pre-September month to open',
        Boolean(legacyMonth), legacyMonth ? legacyMonth : `months seen: ${options.join(', ') || 'none'}`);

      if (!legacyMonth) {
        skip('[manager] legacy-month legs', 'tenant holds no month before 2026-09');
      } else {
        await monthSelect.selectOption(legacyMonth);
        await page.waitForTimeout(2500);

        const editBtn = page.locator('[data-testid^="pers-roster-edit-"]').first();
        const rowThere = await editBtn.isVisible().catch(() => false);
        if (!rowThere) {
          skip('[manager] legacy-month legs', `no roster row to open for ${legacyMonth}`);
        } else {
          await editBtn.click();
          await page.waitForSelector('[data-testid="persistency-input-businessPlaced"]',
            { state: 'visible', timeout: 15_000 });
          record(`[manager] entry drawer opens for ${legacyMonth}`, true);

          const legacyMarker = await page.locator('[data-testid="persistency-inputs-legacy12"]')
            .isVisible().catch(() => false);
          record(`[manager] drawer renders the legacy12 model for ${legacyMonth}`, legacyMarker);

          const count = await page.locator('[data-testid^="persistency-input-"]').count();
          record(`[manager] drawer shows 6 inputs for ${legacyMonth}`, count === 6, `rendered ${count}`);

          const hasDec = await page.locator('[data-testid="persistency-input-decreases"]')
            .isVisible().catch(() => false);
          record(`[manager] decreases input absent for ${legacyMonth}`, hasDec === false);

          const prev = await page.locator('[data-testid="persistency-derived-preview"]').innerText();
          record(`[manager] denominator keeps the legacy "Gross Settled" label`,
            prev.includes('Gross Settled') && !prev.includes('Net Gross Settled'),
            prev.replace(/\s+/g, ' ').slice(0, 80));

          await page.screenshot({
            path: `${SHOT_DIR}/persistency-24m-legacy12-${legacyMonth}-light.png`,
            fullPage: false,
          });

          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          record('[manager] drawer closes on Escape with no write',
            (await page.locator('[data-testid="persistency-entry-form"]').count()) === 0);
        }
      }
    }

    const mErrors = capture.consoleMessages.filter((m) => m.type === 'error');
    record('[manager] no console errors', mErrors.length === 0,
      mErrors.length ? mErrors.slice(0, 3).map((e) => e.text).join(' | ') : 'clean');
    await context.close();
  } else {
    skip('[manager] legacy-month legs', 'A11Y_BRANCH_MANAGER_EMAIL / _PASSWORD not set');
  }
} finally {
  await browser.close();
}

finishSmoke(results, { clearTimeout: clear });
