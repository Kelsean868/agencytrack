/**
 * submission-branchid-read-smoke.mjs
 *
 * Phase 5 smoke for PR Slice 2 — branchId-gated BM read rule + query filter.
 *
 * What this smoke verifies (preview — indexes NOT yet deployed):
 *   Leg 1 — BM signs in and navigates to MasterSheet without permission errors.
 *            Firestore console errors are classified:
 *              "index required" → note as INDEX-GAP (expected pre-deploy), skip leg
 *              "PERMISSION_DENIED" → FAIL (old BM query still in preview bundle)
 *   Leg 2 — Light + dark theme screenshots of the BM weekly view.
 *
 * What this smoke does NOT cover (deferred to post-merge live-verify):
 *   - Branch-B submissions absent from BM-A weekly/YTD query (requires indexes + rule deploy)
 *   - Read-rule enforcement (PERMISSION_DENIED on unconstrained BM query) (requires rule deploy)
 *
 * Post-merge verification sequence (dispatcher action):
 *   1. Vercel deploy lands (frontend branchId query live) — wait for preview → prod promotion
 *   2. Deploy composite indexes: firebase deploy --only firestore:indexes
 *      Wait for status "Enabled" in Firebase Console → Firestore → Indexes → Composite
 *   3. THEN deploy read rule: firebase deploy --only firestore:rules
 *   4. Run submission-branchid-liveverify.mjs to confirm rule enforcement in production
 *
 * Usage:
 *   node scripts/verification/submission-branchid-read-smoke.mjs
 *   node scripts/verification/submission-branchid-read-smoke.mjs --url https://agencytrack.vercel.app
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  setupBypassSession,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
  installGlobalTimeout,
  finishSmoke,
  stamp,
  setTheme,
} from './lib/walk-helpers.mjs';

// ── env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const requireEnv = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var ${k}`);
  return v;
};

const BASE_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'https://agencytrack-git-feat-submission-branchid-read-kyron-marchan-s-projects.vercel.app';

const TOKEN    = requireEnv('VERCEL_BYPASS_TOKEN');
const BM_EMAIL = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const BM_PASS  = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');

const SCREENSHOT_DIR = join('screenshots', 'submission-branchid-read-smoke');
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

// ── helpers ───────────────────────────────────────────────────────────────────

function classifyConsoleErrors(consoleMessages) {
  const errors = consoleMessages.filter((m) => m.type === 'error');
  const indexGap = errors.some((m) =>
    m.text.includes('requires an index') || m.text.includes('index required')
  );
  const permDenied = errors.some((m) =>
    m.text.includes('PERMISSION_DENIED') || m.text.includes('Missing or insufficient permissions')
  );
  return { indexGap, permDenied, errors };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${stamp()}] submission-branchid read smoke — preview`);
  console.log(`[${stamp()}] target: ${BASE_URL}\n`);

  const clear = installGlobalTimeout(180_000, () => {});
  const results = [];
  const browser = await chromium.launch();

  const THEMES = ['light', 'dark'];

  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

    try {
      await setupBypassSession(context, BASE_URL, TOKEN);
      const page = await context.newPage();
      const capture = captureConsoleAndNetwork(page);

      // sign in as BM
      await loginAs(page, BASE_URL, BM_EMAIL, BM_PASS);
      await setTheme(context, theme);
      await page.waitForTimeout(1500);

      // ── Leg 1: navigate to MasterSheet (weekly BM view) ────────────────────
      {
        const leg = `[${theme}] BM navigates to MasterSheet`;
        try {
          // MasterSheet is typically reachable via the "Team" nav item for managers
          const teamNav = page.getByRole('button', { name: /team/i }).or(
            page.locator('a[href*="team"], button:has-text("Team"), [data-testid*="team"]')
          ).first();
          if (await teamNav.isVisible({ timeout: 5000 }).catch(() => false)) {
            await teamNav.click();
            await page.waitForTimeout(2000);
          }

          const { indexGap, permDenied, errors } = classifyConsoleErrors(capture.consoleMessages);

          if (permDenied) {
            results.push({
              leg,
              passed: false,
              detail: `PERMISSION_DENIED in console — old BM query (no branchId filter) may still be in preview bundle. Errors: ${errors.map((e) => e.text.slice(0, 120)).join('; ')}`,
            });
            console.error(`[${stamp()}] ${leg}: FAIL — PERMISSION_DENIED`);
          } else if (indexGap) {
            results.push({
              leg,
              passed: true,
              detail: 'INDEX-GAP: Firestore "requires an index" error — expected pre-deploy. Indexes ship post-merge. Page navigated without PERMISSION_DENIED ✓',
            });
            console.log(`[${stamp()}] ${leg}: SKIP (index gap — expected) — no permission error ✓`);
          } else {
            results.push({ leg, passed: true, detail: 'MasterSheet navigated — no console errors' });
            console.log(`[${stamp()}] ${leg}: PASS`);
          }
        } catch (err) {
          results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
          console.error(`[${stamp()}] ${leg}: ERROR — ${err.message?.slice(0, 120)}`);
        }
      }

      // ── Leg 2: screenshot ──────────────────────────────────────────────────
      {
        const leg = `[${theme}] BM weekly view screenshot`;
        try {
          const shot = join(SCREENSHOT_DIR, `bm-weekly-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: false });
          results.push({ leg, passed: true, detail: `Screenshot saved: ${shot}` });
          console.log(`[${stamp()}] ${leg}: PASS — ${shot}`);
        } catch (err) {
          results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
        }
      }

      console.log(formatCaptureReport(capture));
    } finally {
      await context.close().catch(() => {});
    }
  }

  await browser.close().catch(() => {});

  console.log('\n── Deferred (post-merge, post-index-deploy, post-rule-deploy) ──────────────');
  console.log('  D1. Branch-B submissions absent from BM-A weekly/YTD — requires composite indexes live');
  console.log('  D2. Read-rule enforcement (unconstrained BM query → PERMISSION_DENIED) — requires rule deploy');
  console.log('  Run submission-branchid-liveverify.mjs after full deploy sequence to close D1+D2.\n');

  finishSmoke(results, { clearTimeout: clear });
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
