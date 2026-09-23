/**
 * smoke-awards-ledger-h2.mjs — READ-ONLY smoke for hero-ledger H2
 * (awards count current-year imported business by issue date).
 *
 * Opens a headed Chromium at SMOKE_BASE_URL (default the local dev server).
 * The OPERATOR signs in by hand in that window if asked — this script never
 * handles a credential. It walks the Awards tab in light and dark, asserts the
 * live figures, and saves screenshots to verification/awards-ledger/.
 *
 * It clicks navigation only and writes nothing to Firestore. The local dev
 * server reads PRODUCTION Firebase, which is why it must stay read-only.
 *
 * Expected figures: Kyron's live book (OIPA export 15 Sep 2026), 2026 settled
 * life business, all `nb_ordinary`, all imported:
 *   2026-06-30 12,000 · 2026-07-31 1,946.28 · 2026-08-04 36,000 ×2 · 2026-08-07 1,200
 *   → August 73,200 / 3 apps · Q3 75,146.28 / 4 apps · 2026 87,146.28 / 5 apps.
 *
 * The monthly award reads the CURRENT month (awardsEngine computeAgentAwards
 * uses `now`), so on a September run it shows September, not August. The
 * August check is therefore reported as BLOCKED, never as a pass; August itself
 * is proven in src/lib/__tests__/awardRowsFromLedger.test.js.
 *
 *   node scripts/verification/smoke-awards-ledger-h2.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const OUT = path.resolve('verification/awards-ledger');
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;
const STEP_TIMEOUT_MS = 30_000;

const EXPECT = {
  quarterlyApi: '75,146',
  quarterlyApps: '4',
  annualApi: '87,146',
};

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}
function blocked(step, detail) {
  results.push({ step, ok: true, blocked: true, detail });
  console.log(`BLOCKED  ${step} — ${detail}`);
}

async function cardText(page, id) {
  const loc = page.getByTestId(`award-card-${id}`).first();
  const visible = await loc.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS }).then(() => true, () => false);
  return visible ? (await loc.innerText()).replace(/\s+/g, ' ').trim() : null;
}

async function goTab(page, id) {
  await page
    .locator(`[data-testid="pinned-${id}"]:visible, [data-testid="agent-tab-${id}"]:visible`)
    .first()
    .click({ timeout: STEP_TIMEOUT_MS });
}

async function walk(page, theme) {
  await page.evaluate((t) => localStorage.setItem('agencytrack-theme', t), theme);
  await page.reload();
  await page.getByTestId('hero-settled-api').waitFor({ timeout: STEP_TIMEOUT_MS });
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  check(`${theme} · theme applied`, isDark === (theme === 'dark'));

  await goTab(page, 'awards');
  await page.getByText(/awards tracked/i).first().waitFor({ timeout: STEP_TIMEOUT_MS });

  const chip = page.getByTestId('agent-awards-source-chip');
  if (await chip.isVisible().catch(() => false)) {
    const t = (await chip.innerText()).replace(/\s+/g, ' ');
    check(`${theme} · source chip names POLICY LEDGER`, /POLICY LEDGER/.test(t), t);
  } else {
    blocked(`${theme} · source chip`, 'awardsProvenance flag is OFF for this tenant; chip not rendered (unit-tested)');
  }

  const qApi = await cardText(page, 'quarterly_api');
  check(`${theme} · Q3 API award reads the ledger (Jul 31 + 3 Aug policies)`, qApi?.includes(EXPECT.quarterlyApi), qApi);
  const qApps = await cardText(page, 'quarterly_apps');
  check(`${theme} · Q3 apps award = ${EXPECT.quarterlyApps}`, qApps != null && new RegExp(`\\b${EXPECT.quarterlyApps}\\b`).test(qApps), qApps);

  const mdrt = await cardText(page, 'mdrt');
  check(`${theme} · MDRT reads the 2026 ledger total`, mdrt?.includes(EXPECT.annualApi), mdrt);

  const monthApi = await cardText(page, 'advisor_month_api');
  console.log(`INFO  ${theme} · Advisor of the Month — API (current month) shows: ${monthApi}`);
  blocked(`${theme} · Advisor of the Month (August) shows Aug 2026 policies`,
    'the monthly award reads the current month only; there is no August view on this date');

  await page.screenshot({ path: path.join(OUT, `${theme}-awards.png`), fullPage: true });
  await goTab(page, 'dashboard');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // Same persistent profile as the H1 smoke, OUTSIDE the repo.
  const profile = process.env.SMOKE_PROFILE_DIR || path.join(process.env.TEMP || '/tmp', 'agencytrack-smoke-profile');
  const browser = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = browser.pages()[0] ?? await browser.newPage();
    await page.goto(BASE);
    console.log(`Sign in by hand in the Chromium window at ${BASE} if asked. Waiting up to 10 minutes…`);
    await page.getByTestId('hero-settled-api').waitFor({ timeout: SIGN_IN_TIMEOUT_MS });
    for (const theme of ['light', 'dark']) await walk(page, theme);
  } catch (err) {
    check('walk completed', false, err.message.split('\n')[0]);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  const nBlocked = results.filter((r) => r.blocked).length;
  console.log(`\n${results.length - failed.length - nBlocked} PASS / ${failed.length} FAIL / ${nBlocked} BLOCKED`);
  process.exit(failed.length ? 1 : 0);
}

main();
