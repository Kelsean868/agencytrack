/**
 * smoke-hero-ledger-h1.mjs — READ-ONLY smoke for hero-ledger H1 (PR #968).
 *
 * Opens a headed Chromium at SMOKE_BASE_URL (default the local dev server).
 * The OPERATOR signs in by hand in that window — this script never handles a
 * credential. It then walks Home, Policy Ledger and Goals in light and dark,
 * asserts the live figures, and saves screenshots to verification/hero-ledger/.
 *
 * It clicks navigation only. It writes nothing to Firestore. The local dev
 * server reads PRODUCTION Firebase, which is why it must stay read-only
 * (CLAUDE.md § Workflow: never run a mutating smoke against a prod-bound build).
 *
 * Expected figures are Kyron's live book, OIPA export of 15 Sep 2026.
 *
 *   node scripts/verification/smoke-hero-ledger-h1.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const OUT = path.resolve('verification/hero-ledger');
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;
const STEP_TIMEOUT_MS = 30_000;

const EXPECT = {
  settledApi: 'TTD 87,146.28',
  settledApps: '5',
  submittedApi: 'TTD 123,146.28',
  submittedApps: '6',
  ledgerSettledCompact: 'TTD 87.1K',
  ledgerSubmittedCompact: 'TTD 123.1K',
  tileSettled: '117',
  tileClosed: '112',
  goalsApi: 'TTD 87,146',
  // Campaign card, unchanged by H1: 275,000 - 73,946.28 and 35 - 3.
  campaignApiLeft: '201,054',
  campaignAppsLeft: '32 more apps',
};

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function text(page, testId) {
  const loc = page.getByTestId(testId).first();
  await loc.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
  return (await loc.innerText()).replace(/\s+/g, ' ').trim();
}

/**
 * Waits until `testId`'s text satisfies `ok`, then returns it. The hero numeral
 * counts up from 0 over ~1s (useCountUp), so a single read can catch it
 * mid-flight — the first run of this smoke read TTD 72,605.52 on the way to
 * 87,146.28. Returns the last text seen if it never settles.
 */
async function settledText(page, testId, ok) {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  let last = await text(page, testId);
  while (!ok(last) && Date.now() < deadline) {
    await page.waitForTimeout(250);
    last = await text(page, testId);
  }
  return last;
}

/** Waits for `needle` anywhere in <main> (async cards land after the hero). */
async function mainHas(page, needle) {
  return page.locator('main').getByText(needle, { exact: false }).first()
    .waitFor({ timeout: STEP_TIMEOUT_MS }).then(() => true, () => false);
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

  // ── Home hero ──
  const settledApi = await settledText(page, 'hero-settled-api', (t) => t.includes(EXPECT.settledApi));
  check(`${theme} · home settled API`, settledApi.includes(EXPECT.settledApi), settledApi);
  const settledApps = await text(page, 'hero-settled-apps');
  check(`${theme} · home settled apps`, settledApps.endsWith(EXPECT.settledApps), settledApps);
  const submittedApi = await text(page, 'hero-submitted-api');
  check(`${theme} · home submitted API + dated by issue`,
    submittedApi.includes(EXPECT.submittedApi) && /dated by issue/i.test(submittedApi), submittedApi);
  const submittedApps = await text(page, 'hero-submitted-apps');
  check(`${theme} · home submitted apps`, submittedApps.endsWith(EXPECT.submittedApps), submittedApps);
  const note = await text(page, 'ledger-reconciliation');
  check(`${theme} · R4 note states both sides`,
    /Weekly reports say you submitted TTD [\d,.]+ this year \(TTD [\d,.]+ this week\)\. Your ledger shows TTD 123,146\.28\./.test(note), note);
  check(`${theme} · R4 mismatch flag + ledger link`,
    /Mismatch/.test(note) && /Add a policy to your ledger/.test(note));
  await page.screenshot({ path: path.join(OUT, `${theme}-home.png`) });
  const apiLeft = await mainHas(page, EXPECT.campaignApiLeft);
  const appsLeft = await mainHas(page, EXPECT.campaignAppsLeft);
  check(`${theme} · campaign card unchanged (TTD 73,946.28 · 3 apps)`, apiLeft && appsLeft,
    `remaining ${EXPECT.campaignApiLeft}: ${apiLeft} · ${EXPECT.campaignAppsLeft}: ${appsLeft}`);
  await page.locator('main').getByText(EXPECT.campaignAppsLeft, { exact: false }).first()
    .scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: path.join(OUT, `${theme}-home-campaign.png`) });

  // ── Policy Ledger header ──
  await goTab(page, 'policy-ledger');
  const ledSettled = await text(page, 'pipeline-settled-ytd');
  check(`${theme} · ledger settled API`, ledSettled === EXPECT.ledgerSettledCompact, ledSettled);
  const ledSubmitted = await text(page, 'pipeline-submitted-ytd');
  check(`${theme} · ledger submitted API`, ledSubmitted === EXPECT.ledgerSubmittedCompact, ledSubmitted);
  check(`${theme} · ledger dated-by-issue marker`, await page.getByTestId('pipeline-dated-by-issue').isVisible());
  check(`${theme} · WHOLE BOOK eyebrow`, (await text(page, 'pipeline-whole-book')) === 'WHOLE BOOK');
  const tileSettled = await text(page, 'pipeline-count-settled');
  check(`${theme} · tile Settled`, tileSettled === EXPECT.tileSettled, tileSettled);
  const tileClosed = await text(page, 'pipeline-count-closed');
  check(`${theme} · tile Closed`, tileClosed === EXPECT.tileClosed, tileClosed);
  // The header card ONLY. The policy list below it shows client names and
  // policy numbers, which must never be committed as a screenshot.
  await page.getByTestId('policy-pipeline-strip').screenshot({ path: path.join(OUT, `${theme}-ledger.png`) });

  // ── Goals ──
  await goTab(page, 'goals');
  check(`${theme} · goals API matches the hero`, await mainHas(page, EXPECT.goalsApi));
  await page.screenshot({ path: path.join(OUT, `${theme}-goals.png`) });

  await goTab(page, 'dashboard');
  await page.getByTestId('hero-settled-api').waitFor({ timeout: STEP_TIMEOUT_MS });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // A persistent profile OUTSIDE the repo, so a re-run keeps the operator's
  // sign-in and nothing about the session lands in git.
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
