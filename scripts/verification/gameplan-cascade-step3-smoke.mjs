/**
 * gameplan-cascade-step3-smoke.mjs
 *
 * Verifies PR #677: Step 3 of the "The plan so far" cascade shows the
 * per-month figure (annual ÷ 12), not the annual total.
 *
 * Gates:
 *   S3-a: Cascade card renders after login + game-plan nav.
 *   S3-b: Step 3 subtitle is "Per-month target" (not "Annual target split into 12 months").
 *   S3-c: When monthly plan is filled, Step 3 figure ≠ Step 2 figure AND
 *         Step 3 ≈ Step 2 / 12 (within ±1 TTD rounding).
 *   S3-d: When monthly plan is filled, YTD badge ("behind" / "ahead" / "on pace") still shows.
 *   S3-e: Dark mode — cascade renders without overflow/contrast regression (visual check
 *         via screenshot; cascade card is still in the DOM).
 *
 * Run:
 *   SMOKE_PREVIEW_URL=https://agencytrack-git-gameplan-step3-dc7185-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/gameplan-cascade-step3-smoke.mjs
 */

import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
  safeLog,
  waitForFirebaseReady,
} from './lib/walk-helpers.mjs';
import {
  loadEnv,
  createRunTracker,
  loginAs,
} from './lib/smoke-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');
const E     = loadEnv(ROOT);

const PREVIEW_HOST = process.env.SMOKE_PREVIEW_URL
  ?? 'https://agencytrack-git-gameplan-step3-dc7185-kyron-marchan-s-projects.vercel.app';

const SS_DIR = join(ROOT, 'screenshots', 'gameplan-cascade-step3-smoke');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const t = createRunTracker({ ssDir: SS_DIR });

// ── Helper: extract numeric value from a TTD currency string ──────────────────
// e.g. "TTD 98,809.52" → 98809.52; "TTD 1,185,714.29" → 1185714.29
function parseCurrency(text) {
  const m = text.replace(/,/g, '').match(/[\d.]+/);
  return m ? parseFloat(m[0]) : NaN;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await setupBypassSession(context, PREVIEW_HOST, E.VERCEL_BYPASS_TOKEN);

  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    // ── Login as A11Y agent ───────────────────────────────────────────────────
    safeLog('\n[S3] Logging in as A11Y agent...');
    await loginAs(page, E.A11Y_AGENT_EMAIL, E.A11Y_AGENT_PASSWORD, PREVIEW_HOST);

    // ── Navigate to Game Plan tab ─────────────────────────────────────────────
    safeLog('[S3] Navigating to Game Plan tab...');
    // Wait for sidebar to fully hydrate before clicking (timing issue post-login)
    await page.waitForSelector('[data-testid="agent-tab-game-plan"]', { timeout: 20_000 });
    await page.locator('[data-testid="agent-tab-game-plan"]').first().click({ force: true });
    await page.waitForTimeout(2000);

    // ── S3-a: Cascade card renders ────────────────────────────────────────────
    const cascade = page.locator('[data-testid="game-plan-cascade"]');
    const cascadeVisible = await cascade.isVisible({ timeout: 15_000 }).catch(() => false);
    if (cascadeVisible) {
      t.pass('S3-a', 'cascade card rendered');
    } else {
      t.fail('S3-a', 'cascade card not found — game plan may not be enabled for this account');
      await t.ss(page, 'S3-a-fail');
      return;
    }

    await t.ss(page, 'S3-light-cascade');

    // ── S3-b: Subtitle is "Per-month target" ─────────────────────────────────
    const cascadeText = await cascade.textContent();
    if (cascadeText.includes('Per-month target')) {
      t.pass('S3-b', 'subtitle is "Per-month target"');
    } else if (cascadeText.includes('Annual target split into 12 months')) {
      t.fail('S3-b', 'OLD subtitle still present — fix not applied');
    } else {
      t.fail('S3-b', `unexpected subtitle in cascade: ${cascadeText.slice(0, 120)}`);
    }

    // ── S3-c + S3-d: Figure validation when monthly plan is filled ────────────
    // Detect whether the monthly plan is filled (not "Set in your plan")
    const step3Section = cascade.locator(':scope >> text=Step 3 · Monthly Plan').locator('..');
    const step3Text = await step3Section.textContent().catch(() => '');
    const monthlyFilled = !step3Text.includes('Set in your plan');

    if (monthlyFilled) {
      safeLog('[S3] Monthly plan is filled — extracting figures for ratio check...');

      // Extract Step 2 annual figure
      const step2Section = cascade.locator(':scope >> text=Step 2 · Year Plan').locator('..');
      const step2Text = await step2Section.textContent().catch(() => '');
      const step2Amount = parseCurrency(step2Text);

      // Extract Step 3 per-month figure (the large bold number in step 3 area)
      const step3Amount = parseCurrency(step3Text);

      safeLog('[S3] Step 2 figure extracted (annual)');
      safeLog('[S3] Step 3 figure extracted (per-month)');

      if (!isNaN(step2Amount) && !isNaN(step3Amount) && step2Amount > 0) {
        const expected = step2Amount / 12;
        const diff = Math.abs(step3Amount - expected);
        if (step3Amount !== step2Amount) {
          t.pass('S3-c-distinct', `step 3 figure (${step3Amount.toFixed(2)}) ≠ step 2 figure (${step2Amount.toFixed(2)})`);
        } else {
          t.fail('S3-c-distinct', 'step 3 and step 2 show the same figure — duplicate not fixed');
        }
        if (diff <= 1.0) {
          t.pass('S3-c-ratio', `step 3 ≈ step 2 / 12 (diff ${diff.toFixed(2)} ≤ 1.00 TTD)`);
        } else {
          t.fail('S3-c-ratio', `step 3 (${step3Amount.toFixed(2)}) ≠ step 2/12 (${expected.toFixed(2)}), diff ${diff.toFixed(2)}`);
        }
      } else {
        t.skip('S3-c-ratio', 'could not parse figure values for ratio check');
      }

      // S3-d: YTD badge still present
      const ytdBadge = page.locator('[data-testid="monthly-ytd-badge"]');
      const ytdVisible = await ytdBadge.isVisible({ timeout: 3000 }).catch(() => false);
      if (ytdVisible) {
        const ytdText = (await ytdBadge.textContent()).trim();
        t.pass('S3-d', `YTD badge shows: "${ytdText}"`);
      } else {
        t.fail('S3-d', 'YTD badge not visible — "behind/ahead/on pace" indicator missing');
      }
    } else {
      // The smoke tenant is seeded (functions/scripts/seed-smoke-data.cjs) with a
      // COMMITTED monthly plan for this agent — a "not filled" reading here means
      // the data seed did not take. These assert now instead of silently skipping.
      t.fail('S3-c-distinct', 'monthly plan not filled — run seed-smoke-data.cjs --apply for the smoke agent');
      t.fail('S3-c-ratio',    'monthly plan not filled — run seed-smoke-data.cjs --apply for the smoke agent');
      t.fail('S3-d',          'monthly plan not filled — YTD badge not rendered (expected seeded monthly plan)');
    }

    // ── S3-e: Dark mode — cascade still renders ───────────────────────────────
    safeLog('[S3] Toggling dark mode...');
    const darkBtn = page.getByRole('button', { name: /toggle dark mode/i });
    if (await darkBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await darkBtn.click();
      await page.waitForTimeout(800);
      const cascadeDark = await page.locator('[data-testid="game-plan-cascade"]').isVisible({ timeout: 5000 }).catch(() => false);
      if (cascadeDark) {
        t.pass('S3-e', 'cascade renders in dark mode');
      } else {
        t.fail('S3-e', 'cascade not visible after dark mode toggle');
      }
      await t.ss(page, 'S3-dark-cascade');
      // Restore light mode
      await darkBtn.click();
      await page.waitForTimeout(400);
    } else {
      t.skip('S3-e', 'dark mode toggle button not found — skip');
    }

  } finally {
    safeLog('\n' + formatCaptureReport(capture));
    await browser.close();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const { totalPass, totalFail, totalSkip } = t;
  console.log(`\n── gameplan-cascade-step3-smoke ──────────────────────────────────`);
  console.log(`   ${totalPass} PASS  ${totalFail} FAIL  ${totalSkip} SKIP`);
  for (const r of t.results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '~';
    console.log(`   ${icon} ${r.step}${r.note ? ' — ' + r.note : ''}`);
  }
  console.log(`──────────────────────────────────────────────────────────────────`);

  if (totalFail > 0) process.exit(1);
}

run().catch(err => { console.error(err); process.exit(1); });
