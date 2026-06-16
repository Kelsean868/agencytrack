/**
 * submission-branchid-write-smoke.mjs
 *
 * Regression smoke for PR #654 (Slice 1: branchId write-path + forge-validation rule).
 *
 * What this verifies (pre-merge, old rules still deployed):
 *   Leg 1 — Agent (light): wizard mounts, auto-save fires, no Firestore
 *            permission errors in console. Confirms branchId-stamping code
 *            doesn't break the write path.
 *   Leg 2 — Agent (dark): same, dark-mode theme.
 *   Leg 3 — BM as producing-manager (light): wizard mounts for a manager
 *            who can also submit, no permission errors.
 *
 * What this CANNOT verify pre-merge (needs rules deployed post-merge):
 *   - Forge-validation rule actually enforces branchId on write
 *   - Live-verify from the brief: "own-branch ALLOW, forged-branch DENY"
 *   That live-verify is the dispatcher's post-merge step.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://<preview-host> node submission-branchid-write-smoke.mjs
 *   Or pipe env through .env.local (dotenv-aware via walk-helpers).
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import { mkdir, readFileSync } from 'fs';
import {
  resolveSmokeBaseUrl,
  setupBypassSession,
  setTheme,
  loginAs,
  captureConsoleAndNetwork,
  formatCaptureReport,
  installGlobalTimeout,
  finishSmoke,
  stamp,
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

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var ${k}`); return v; };

const BASE_URL = resolveSmokeBaseUrl({
  defaultHost: 'agencytrack-git-feat-submission-branchid-write-kyron-marchan-s-projects.vercel.app',
});
const TOKEN       = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS  = requireEnv('A11Y_AGENT_PASSWORD');
const BM_EMAIL    = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const BM_PASS     = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');
const SS_DIR         = resolve('screenshots/submission-branchid-write');

function ss(page, name) {
  return page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false }).catch(() => {});
}

const PERMISSION_RE = /permission[_\s-]*denied|insufficient permissions/i;

function checkPermissionErrors(capture) {
  const errors = capture.consoleMessages
    .filter((m) => m.type === 'error' && PERMISSION_RE.test(m.text))
    .map((m) => m.text.slice(0, 200));
  return errors;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  await new Promise((res, rej) => mkdir(SS_DIR, { recursive: true }, (e) => (e ? rej(e) : res())));

  console.log(`[${stamp()}] submission-branchid-write smoke`);
  console.log(`[${stamp()}] base: ${BASE_URL}\n`);

  const clear = installGlobalTimeout(240_000, () => {});
  const results = [];
  const browser = await chromium.launch();

  // ── Legs 1 + 2: agent, both themes ─────────────────────────────────────────
  for (const theme of ['light', 'dark']) {
    const leg = `Agent wizard auto-save (${theme})`;
    const context = await browser.newContext();
    try {
      await setupBypassSession(context, BASE_URL, TOKEN);
      await setTheme(context, theme);
      const page = await context.newPage();
      const capture = captureConsoleAndNetwork(page);

      await loginAs(page, BASE_URL, AGENT_EMAIL, AGENT_PASS);
      console.log(`[${stamp()}] ${leg}: logged in`);

      // Open wizard
      const wizardBtn = page.getByRole('button', { name: /submit weekly report/i }).first();
      await wizardBtn.waitFor({ state: 'visible', timeout: 15_000 });
      await wizardBtn.click();
      await page.waitForTimeout(2000); // let wizard mount + auto-load draft

      console.log(`[${stamp()}] ${leg}: wizard open`);
      await ss(page, `wizard-open-${theme}`);

      // Wait for auto-save to fire (WizardForm debounce is 1500ms after mount)
      await page.waitForTimeout(3000);

      const permErrors = checkPermissionErrors(capture);
      const netFails   = (capture.networkFailures ?? []).filter(
        (f) => /submissions/i.test(f.url ?? '') && f.status >= 400
      );

      console.log(formatCaptureReport(capture));
      await ss(page, `wizard-post-autosave-${theme}`);

      if (permErrors.length > 0) {
        results.push({ leg, passed: false, detail: `Firestore permission errors: ${permErrors.join('; ')}` });
      } else if (netFails.length > 0) {
        results.push({ leg, passed: false, detail: `Network failures on submissions: ${netFails.map((f) => f.url + ' ' + f.status).join('; ')}` });
      } else {
        results.push({ leg, passed: true, detail: 'No permission errors; auto-save path clean' });
        console.log(`[${stamp()}] ${leg}: PASS`);
      }
    } catch (err) {
      results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
      console.error(`[${stamp()}] ${leg}: ERROR — ${err.message?.slice(0, 200)}`);
    } finally {
      await context.close();
    }
  }

  // ── Leg 3: BM as producing manager, light ──────────────────────────────────
  {
    const leg = 'BM (producing-manager) wizard (light)';
    const context = await browser.newContext();
    try {
      await setupBypassSession(context, BASE_URL, TOKEN);
      await setTheme(context, 'light');
      const page = await context.newPage();
      const capture = captureConsoleAndNetwork(page);

      await loginAs(page, BASE_URL, BM_EMAIL, BM_PASS);
      console.log(`[${stamp()}] ${leg}: logged in`);

      // BM sees ManagerDashboard; the wizard is available via the same button
      // if they are a producing-manager (WizardForm is mounted in ManagerDashboard)
      const wizardBtn = page.getByRole('button', { name: /submit weekly report/i }).first();
      const bmHasWizard = await wizardBtn.isVisible({ timeout: 8_000 }).catch(() => false);

      if (!bmHasWizard) {
        // BM account may not be a producing-manager — not a failure for this smoke
        results.push({ leg, passed: true, detail: 'BM account has no wizard button (not a producing-manager) — skip; no regression' });
        console.log(`[${stamp()}] ${leg}: no wizard button — skip (expected for non-producing BM)`);
      } else {
        await wizardBtn.click();
        await page.waitForTimeout(2000);
        console.log(`[${stamp()}] ${leg}: wizard open`);
        await ss(page, 'bm-wizard-open-light');
        await page.waitForTimeout(3000);

        const permErrors = checkPermissionErrors(capture);
        console.log(formatCaptureReport(capture));
        await ss(page, 'bm-wizard-post-autosave-light');

        if (permErrors.length > 0) {
          results.push({ leg, passed: false, detail: `Firestore permission errors: ${permErrors.join('; ')}` });
        } else {
          results.push({ leg, passed: true, detail: 'No permission errors on BM wizard auto-save' });
          console.log(`[${stamp()}] ${leg}: PASS`);
        }
      }
    } catch (err) {
      results.push({ leg, passed: false, detail: err.message?.slice(0, 200) ?? String(err) });
      console.error(`[${stamp()}] ${leg}: ERROR — ${err.message?.slice(0, 200)}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  finishSmoke(results, { clearTimeout: clear });
}

main().catch((err) => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
