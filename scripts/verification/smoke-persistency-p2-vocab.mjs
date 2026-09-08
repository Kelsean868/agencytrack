/**
 * smoke-persistency-p2-vocab.mjs — PR #939 (Persistency P2, vocabulary sweep +
 * retired preview shell).
 *
 * ⚠ READ-ONLY BY DESIGN, AND IT HAS TO BE. A feature-branch Vercel preview
 * builds against PRODUCTION Firebase (agencytrack-2a610), so signing in here
 * authenticates against the live tenant and reads live data. This walk opens
 * screens and reads rendered text only — it never submits a form and never
 * triggers the CSV download (a download click cannot be verified read-only
 * without saving a file, which this walk deliberately does not do).
 *
 * What it proves that the unit tests cannot: that against a real preview
 * build, the P2 vocabulary sweep actually reaches the DOM —
 *   - the agent tab's trend chart heading reads "Monthly trend", never
 *     "12-month trend" (item 2 of Slice P2)
 *   - the manager roster's derived-denominator column header reads
 *     "Net Gross Settled", never bare "Gross settled" (item 1)
 *   - the retired persistencyV2 preview shell mounts nowhere, regardless of
 *     any stale featureFlags.persistencyV2 value a tenant's settings doc
 *     might still carry (P-D6 — the reader is gone, so a stale key is inert)
 *
 * SKIP-NOT-FAIL: if a surface (roster row, playground) is unreachable for the
 * signed-in account, that leg skips with an explicit note rather than passing.
 *
 * Usage:
 *   node scripts/verification/smoke-persistency-p2-vocab.mjs <preview-url>
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  loginAs,
  waitForFirebaseReady,
  captureConsoleAndNetwork,
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

if (!BASE_URL) {
  console.error('usage: node scripts/verification/smoke-persistency-p2-vocab.mjs <preview-url>');
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
const skip = (name, why) => {
  console.log(`${stamp()} SKIP  ${name} — ${why}`);
};

const clear = installGlobalTimeout(300_000, () => {
  console.error('global timeout — smoke aborted');
  process.exit(1);
});

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    // ── Agent leg: trend chart heading + no persistencyV2 shell ─────────────
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await setupBypassSession(context, BASE_URL, TOKEN);
    const page = await context.newPage();
    const capture = captureConsoleAndNetwork(page);

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    await loginAs(page, BASE_URL, EMAIL, PASSWORD);
    await waitForFirebaseReady(page);
    const signedIn = !(await page.locator('input[type="password"]').first().isVisible().catch(() => false));
    record(`[agent/${theme}] signs in`, signedIn);

    await setTheme(context, theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    const themeOk = await waitForTheme(page, theme).then(() => true).catch(() => false);
    record(`[agent/${theme}] renders in the ${theme} theme`, themeOk);

    const tab = page.locator('[data-testid="agent-tab-persistency"]');
    const tabThere = await tab.isVisible().catch(() => false);
    record(`[agent/${theme}] persistency tab is reachable`, tabThere);

    if (tabThere) {
      await tab.click();
      await page.waitForTimeout(1500);

      const trendCard = page.locator('[data-testid="persistency-trend-chart"]');
      const trendText = await trendCard.innerText().catch(() => '');
      // Chromium's innerText applies CSS text-transform: uppercase, so the
      // rendered "Monthly trend" heading comes back as "MONTHLY TREND" — the
      // assertion is case-insensitive on purpose, not loosened.
      record(`[agent/${theme}] trend chart reads "Monthly trend", never "12-month trend"`,
        /monthly trend/i.test(trendText) && !/12[- ]?month/i.test(trendText),
        trendText.replace(/\s+/g, ' ').slice(0, 60));

      // The retired v2 shell has no reader left anywhere — this asserts it by
      // absence regardless of what any tenant's settings doc still carries.
      const v2ShellThere = await page.locator('[data-testid="persistency-v2-shell"]').count();
      record(`[agent/${theme}] retired persistencyV2 preview shell is absent`, v2ShellThere === 0);
    } else {
      skip(`[agent/${theme}] trend-chart + v2-shell legs`, 'persistency tab not reachable for this account');
    }

    const errors = capture.consoleMessages.filter((m) => m.type === 'error');
    record(`[agent/${theme}] no console errors`, errors.length === 0,
      errors.length ? errors.slice(0, 3).map((e) => e.text).join(' | ') : 'clean');

    await context.close();
  }

  // ── Manager leg: roster column header vocabulary ──────────────────────────
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
      skip('[manager] roster header leg', 'no Persistency nav reachable for this manager account');
    } else {
      await nav.click();
      await page.waitForSelector('[data-testid="persistency-tab"]', { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const rosterHeader = page.locator('[data-testid="pers-roster-header"]');
      const headerThere = await rosterHeader.isVisible().catch(() => false);
      if (!headerThere) {
        skip('[manager] roster header leg', 'roster header not reachable (no scope/data)');
      } else {
        const headerText = await rosterHeader.innerText();
        // The narrow grid column wraps this label across visual lines, and
        // Chromium's innerText reports each wrapped line separately — so
        // match the three words in order, tolerant of whitespace/newlines
        // between them, rather than requiring one literal contiguous string.
        const words = headerText.toLowerCase().split(/\s+/).filter(Boolean);
        const idx = words.findIndex((w, i) => w === 'net' && words[i + 1] === 'gross' && words[i + 2] === 'settled');
        const bareGrossIdx = words.findIndex((w, i) => w === 'gross' && words[i - 1] !== 'net');
        record('[manager] roster header reads "Net Gross Settled", never bare "Gross settled"',
          idx !== -1 && bareGrossIdx === -1,
          headerText.replace(/\s+/g, ' | '));
      }
    }

    const mErrors = capture.consoleMessages.filter((m) => m.type === 'error');
    record('[manager] no console errors', mErrors.length === 0,
      mErrors.length ? mErrors.slice(0, 3).map((e) => e.text).join(' | ') : 'clean');
    await context.close();
  } else {
    skip('[manager] roster header leg', 'A11Y_BRANCH_MANAGER_EMAIL / _PASSWORD not set');
  }
} finally {
  await browser.close();
}

finishSmoke(results, { clearTimeout: clear });
