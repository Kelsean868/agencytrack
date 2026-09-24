/**
 * smoke-persistency-outlook.mjs — READ-ONLY smoke for the persistency outlook
 * (brief: docs/briefs/persistency-live-estimate.md).
 *
 * Opens a headed Chromium at SMOKE_BASE_URL (default the local dev server) on
 * the saved smoke profile. The OPERATOR signs in by hand if asked — this script
 * never handles a credential. It walks Home and the Persistency tab in light and
 * dark, asserts Kyron's live figures, and saves card-cropped screenshots to
 * verification/persistency-outlook/.
 *
 * It NEVER clicks Confirm (that writes a persistency record). It only checks the
 * control is there. The info toggle it opens is local UI state. The local dev
 * server reads PRODUCTION Firebase, which is why it must stay read-only.
 *
 * Expected (OIPA export 15 Sep 2026, rule `ignore`, 4 manual inputs assumed 0):
 *   Derived Aug 2026 89.6% · Estimated today Sep 2026 86.6% · Dec 2026 85.7%
 *   gap TTD 81,549.48 / TTD 8,154.95 · campaign row "89.6% derived, Aug 2026"
 *   in warning · Home pulse chip "89.6% derived".
 *
 *   node scripts/verification/smoke-persistency-outlook.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:5173';
const OUT = path.resolve('verification/persistency-outlook');
const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;
const STEP_TIMEOUT_MS = 30_000;

const EXPECT = {
  derived: '89.6%',
  derivedLabel: 'Derived · Aug 2026',
  estimate: '86.6%',
  estimateLabel: 'Estimated today · Sep 2026',
  gate: '85.7%',
  gapApi: 'TTD 81,549.48',
  gapReinstate: 'TTD 8,154.95',
  assumedZero: 'Decreases, Increases, Lumpsums (100%), Reinstatements',
  rule: 'ignored',
  exportDate: '15 Sep 2026',
  campaignRow: '89.6% derived, Aug 2026',
  chip: '89.6% derived',
  gapTarget: 'Reaching Champion (TTD 275,000 settled) closes this gap by itself.',
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

async function shot(page, testId, file) {
  const loc = page.getByTestId(testId).first();
  await loc.scrollIntoViewIfNeeded();
  await loc.screenshot({ path: path.join(OUT, file) });
}

async function walk(page, theme) {
  await page.evaluate((t) => localStorage.setItem('agencytrack-theme', t), theme);
  await page.reload();
  await page.getByTestId('hero-settled-api').waitFor({ timeout: STEP_TIMEOUT_MS });
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  check(`${theme} · theme applied`, isDark === (theme === 'dark'));

  // ── Home: campaign row + pulse chip ──
  const row = await text(page, 'campaign-hero-row-persistency');
  check(`${theme} · home · campaign row previews the derived month`, row?.includes(EXPECT.campaignRow) && row?.includes('90%'), row);
  const fill = page.getByTestId('campaign-hero-persistency-bar-fill').first();
  const fillClass = (await fill.getAttribute('class').catch(() => '')) ?? '';
  check(`${theme} · home · campaign row bar is warning`, fillClass.includes('bg-warning'), fillClass.match(/bg-\w+/g)?.join(' '));
  await shot(page, 'campaign-hero-card', `${theme}-campaign-row.png`);

  const chip = await text(page, 'pulse-chip-persist');
  check(`${theme} · home · pulse chip matches`, chip?.includes(EXPECT.chip), chip);
  await shot(page, 'pulse-chip-persist', `${theme}-pulse-chip.png`);

  // ── Persistency tab (via the chip, which routes there) ──
  await page.getByTestId('pulse-chip-persist').first().click({ timeout: STEP_TIMEOUT_MS });
  const derived = await text(page, 'persistency-outlook-derived');
  check(`${theme} · tab · Derived Aug ${EXPECT.derived}`, derived?.includes(EXPECT.derivedLabel) && derived?.includes(EXPECT.derived), derived);
  const confirmVisible = await page.getByTestId('persistency-outlook-confirm').first().isVisible().catch(() => false);
  check(`${theme} · tab · Confirm control present (not clicked)`, confirmVisible);
  const estimate = await text(page, 'persistency-outlook-estimate');
  check(`${theme} · tab · Estimated today ${EXPECT.estimate}`, estimate?.includes(EXPECT.estimateLabel) && estimate?.includes(EXPECT.estimate), estimate);
  const gatePct = await text(page, 'persistency-outlook-gate-pct');
  check(`${theme} · tab · December ${EXPECT.gate}`, gatePct === EXPECT.gate, gatePct);
  const gap = await text(page, 'persistency-outlook-gap');
  check(`${theme} · tab · gap sentence`, gap?.includes(EXPECT.gapApi) && gap?.includes(EXPECT.gapReinstate) && gap?.includes(EXPECT.gapTarget), gap);

  await page.getByTestId('persistency-outlook-info').first().click({ timeout: STEP_TIMEOUT_MS });
  const assumed = await text(page, 'assumptions-assumed-zero');
  check(`${theme} · tab · popover lists 4 assumed-0 inputs`, assumed?.includes(EXPECT.assumedZero), assumed);
  const rule = await text(page, 'assumptions-rule');
  check(`${theme} · tab · popover names rule ignore`, rule?.includes(EXPECT.rule), rule);
  const exp = await text(page, 'assumptions-export');
  check(`${theme} · tab · popover names export 15 Sep`, exp?.includes(EXPECT.exportDate), exp);
  await shot(page, 'persistency-outlook-hero', `${theme}-persistency-hero.png`);

  await page.goto(BASE);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = process.env.SMOKE_PROFILE_DIR || path.join(process.env.TEMP || '/tmp', 'agencytrack-smoke-profile');
  const browser = await chromium.launchPersistentContext(profile, { headless: false, viewport: { width: 1440, height: 900 } });
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
