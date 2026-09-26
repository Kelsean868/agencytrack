/**
 * ledger-autorun-prod-smoke.mjs — post-merge production smoke for the
 * 26 Sep 2026 Policy Ledger autorun (docs/briefs/autorun-2026-09-26-ledger.md, rule 5).
 *
 * READ-ONLY: logs in as the A11Y test agent on production, opens Home, the
 * Awards tab (Campaign screen if present) and the Policy Ledger, screenshots
 * each at 390x844 and 1440x900 in light theme, and records console errors.
 * No clicks that save anything.
 *
 * Usage: node scripts/verification/ledger-autorun-prod-smoke.mjs <label>
 *   <label> names the output folder, e.g. l0 → docs/reports/screenshots/ledger-2026-09-26/prod-l0/
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  setTheme, loginAs, captureConsoleAndNetwork, mobileDispatchClick,
} from './lib/walk-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const LABEL = process.argv[2] ?? 'run';
const OUT_DIR = resolve(ROOT, `docs/reports/screenshots/ledger-2026-09-26/prod-${LABEL}`);
mkdirSync(OUT_DIR, { recursive: true });
const BASE = 'https://portal.agencytrack.app';

function loadEnv() {
  try {
    readFileSync(resolve(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* env may already be set */ }
}
loadEnv();
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS = process.env.A11Y_AGENT_PASSWORD;
if (!EMAIL || !PASS) throw new Error('Missing A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD');

const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const vp of [{ name: '390', width: 390, height: 844 }, { name: '1440', width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await setTheme(context, 'light');
    const page = await context.newPage();
    const capture = captureConsoleAndNetwork(page);
    await loginAs(page, BASE, EMAIL, PASS);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: resolve(OUT_DIR, `home-${vp.name}.png`), fullPage: true });
    results.push({ vp: vp.name, step: 'home', ok: true });

    for (const [step, testid] of [['awards', 'agent-tab-awards'], ['policy-ledger', 'agent-tab-policy-ledger']]) {
      const sel = `[data-testid="${testid}"]`;
      if (await page.locator(sel).count() === 0) {
        results.push({ vp: vp.name, step, ok: false, note: 'nav item not found' });
        continue;
      }
      await mobileDispatchClick(page, sel);
      await page.waitForTimeout(3500);
      const campaign = step === 'awards' ? await page.locator('[data-testid="campaign-screen"]').count() : null;
      await page.screenshot({ path: resolve(OUT_DIR, `${step}-${vp.name}.png`), fullPage: true });
      const scrollX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      results.push({ vp: vp.name, step, ok: true, campaignScreen: campaign, sideScroll: scrollX });
    }
    const errors = capture.consoleMessages.filter((m) => m.type === 'error').map((m) => String(m.text).slice(0, 200));
    results.push({ vp: vp.name, step: 'console', ok: errors.length === 0, errors });
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
console.log(`Screenshots: ${OUT_DIR}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
