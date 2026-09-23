/**
 * smoke-campaign-hero-h3.mjs — READ-ONLY smoke for hero-ledger H3
 * (campaign hero card on Awards and Dashboard).
 *
 * Opens a headed Chromium at SMOKE_BASE_URL (default the local dev server).
 * The OPERATOR signs in by hand in that window if asked — this script never
 * handles a credential. It walks Home and the Awards tab in light and dark,
 * asserts the live figures, and saves screenshots to verification/campaign-hero/.
 *
 * It clicks navigation only and writes nothing to Firestore. The local dev
 * server reads PRODUCTION Firebase, which is why it must stay read-only.
 *
 * Expected figures: Kyron's live book (OIPA export 15 Sep 2026), the
 * Christmas Campaign's level in reach (Champion):
 *   API TTD 73,946.28 / TTD 275,000 · Apps 3 / 35 · 24-month persistency
 *   against the 90% gate. The old per-campaign card's weekly-submission bars
 *   ("TTD 0 / 275,000") must no longer appear anywhere on Home.
 *
 *   node scripts/verification/smoke-campaign-hero-h3.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const OUT = path.resolve('verification/campaign-hero');
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;
const STEP_TIMEOUT_MS = 30_000;

const EXPECT = {
  api: 'TTD 73,946.28',
  apiTarget: 'TTD 275,000',
  apps: '3',
  appsTarget: '35',
  gate: '90%',
  oldZeroBar: 'TTD 0 / 275,000',
};

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function text(page, testId) {
  const loc = page.getByTestId(testId).first();
  const visible = await loc.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS }).then(() => true, () => false);
  return visible ? (await loc.innerText()).replace(/\s+/g, ' ').trim() : null;
}

async function goTab(page, id) {
  await page
    .locator(`[data-testid="pinned-${id}"]:visible, [data-testid="agent-tab-${id}"]:visible`)
    .first()
    .click({ timeout: STEP_TIMEOUT_MS });
}

async function checkCampaignHero(page, theme, surface) {
  const card = await text(page, 'campaign-hero-card');
  check(`${theme} · ${surface} · campaign hero card renders`, card != null, card ?? 'not found');

  const apiRow = await text(page, 'campaign-hero-row-api');
  check(`${theme} · ${surface} · API against the level in reach`,
    apiRow?.includes(EXPECT.api) && apiRow?.includes(EXPECT.apiTarget), apiRow);

  const appsRow = await text(page, 'campaign-hero-row-apps');
  check(`${theme} · ${surface} · Apps against the level in reach`,
    appsRow != null && new RegExp(`\\b${EXPECT.apps}\\b`).test(appsRow) && appsRow.includes(EXPECT.appsTarget), appsRow);

  const persistencyRow = await text(page, 'campaign-hero-row-persistency');
  check(`${theme} · ${surface} · 24-month persistency against the ${EXPECT.gate} gate`,
    persistencyRow?.includes(EXPECT.gate), persistencyRow);
}

async function walk(page, theme) {
  await page.evaluate((t) => localStorage.setItem('agencytrack-theme', t), theme);
  await page.reload();
  await page.getByTestId('hero-settled-api').waitFor({ timeout: STEP_TIMEOUT_MS });
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  check(`${theme} · theme applied`, isDark === (theme === 'dark'));

  // ── Home ──
  await checkCampaignHero(page, theme, 'home');
  const oldBarGone = await page.locator('main').getByText(EXPECT.oldZeroBar, { exact: false })
    .first().isVisible().catch(() => false);
  check(`${theme} · home · old weekly-submission "${EXPECT.oldZeroBar}" bar is gone`, !oldBarGone);
  await page.screenshot({ path: path.join(OUT, `${theme}-home.png`) });

  // ── Awards tab ──
  await goTab(page, 'awards');
  await page.getByText(/awards tracked/i).first().waitFor({ timeout: STEP_TIMEOUT_MS });
  await checkCampaignHero(page, theme, 'awards');
  await page.screenshot({ path: path.join(OUT, `${theme}-awards.png`) });

  await goTab(page, 'dashboard');
  await page.getByTestId('hero-settled-api').waitFor({ timeout: STEP_TIMEOUT_MS });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
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
  console.log(`\n${results.length - failed.length} PASS / ${failed.length} FAIL`);
  process.exit(failed.length ? 1 : 0);
}

main();
