/**
 * settings-smoke.mjs — item 2.4 live check on staging.
 * Agent role: sidebar-foot gear opens Settings → theme Dark applies to
 * documentElement → survives reload → back to Light. Read-only except the
 * theme pref (device-local localStorage; reset at the end).
 *
 * Usage: node --env-file=.env.staging out/settings-smoke.mjs
 */
import { chromium } from 'playwright';
import {
  setupBypassSession, captureConsoleAndNetwork, formatCaptureReport, stamp, installGlobalTimeout,
} from '../scripts/verification/lib/walk-helpers.mjs';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';

const BASE = 'https://agencytrack-git-staging-kyron-marchan-s-projects.vercel.app';
const TOKEN = process.env.VERCEL_BYPASS_TOKEN;
if (!TOKEN) { console.error('MISSING ENV: VERCEL_BYPASS_TOKEN'); process.exit(2); }
const AGENT = { email: 'staging-agent-1@agencytrack-staging.test', password: 'ChangeMe-Staging-2026!' };
const SS_DIR = resolve('out/settings-smoke', stamp().replace(/:/g, '-'));
mkdirSync(SS_DIR, { recursive: true });

const results = [];
const record = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`[${stamp()}] ${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`);
};
const clearTimer = installGlobalTimeout(6 * 60 * 1000, () => {});

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  await setupBypassSession(context, BASE, TOKEN);
  const page = await context.newPage();
  const cap = captureConsoleAndNetwork(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });
  await page.fill('input[type="email"]', AGENT.email);
  await page.fill('input[type="password"]', AGENT.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
  await page.waitForTimeout(1500);

  // gear in the sidebar foot
  const gear = page.getByRole('button', { name: /settings/i }).first();
  const gearVisible = await gear.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
  record('gear-visible', gearVisible, gearVisible ? 'sidebar-foot Settings gear present' : 'no Settings gear found');
  if (!gearVisible) throw new Error('cannot continue without the gear');
  await gear.click();
  await page.waitForTimeout(1200);
  const heading = await page.getByText(/my preferences/i).first()
    .waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
  record('settings-opens', heading, heading ? 'Settings surface rendered (My Preferences visible)' : 'Settings surface did not render');
  await page.screenshot({ path: join(SS_DIR, '1-settings.png') });

  // theme: Dark
  const darkBtn = page.getByRole('button', { name: /^dark$/i }).first();
  const radioDark = page.getByRole('radio', { name: /dark/i }).first();
  const target = (await darkBtn.isVisible().catch(() => false)) ? darkBtn
               : (await radioDark.isVisible().catch(() => false)) ? radioDark : null;
  if (target) {
    await target.click();
    await page.waitForTimeout(600);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    record('dark-applies', isDark, isDark ? 'documentElement carries .dark after selecting Dark' : '.dark class missing after selecting Dark');
    await page.screenshot({ path: join(SS_DIR, '2-dark.png') });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
    const stillDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    record('dark-persists', stillDark, stillDark ? 'dark theme survived a hard reload (no-FOUC restore path)' : 'theme lost on reload');

    // restore Light
    const gear2 = page.getByRole('button', { name: /settings/i }).first();
    await gear2.click();
    await page.waitForTimeout(1000);
    const lightBtn = page.getByRole('button', { name: /^light$/i }).first();
    const radioLight = page.getByRole('radio', { name: /light/i }).first();
    const lt = (await lightBtn.isVisible().catch(() => false)) ? lightBtn
             : (await radioLight.isVisible().catch(() => false)) ? radioLight : null;
    if (lt) {
      await lt.click();
      await page.waitForTimeout(500);
      const back = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
      record('light-restored', back, back ? 'theme reset to Light (cleanup)' : 'could not restore Light');
    } else {
      record('light-restored', false, 'no Light control found for cleanup');
    }
  } else {
    record('dark-applies', false, 'no Dark theme control found on Settings');
  }

  const errs = cap.consoleMessages.filter((m) => /error/i.test(m.type ?? '') || /FirebaseError|permission/i.test(m.text ?? ''));
  record('console-clean', errs.length === 0, errs.length === 0 ? 'no console errors' : `${errs.length} console error(s): ${errs.map((m) => (m.text ?? '').slice(0, 100)).join(' | ')}`);

  console.log(formatCaptureReport(cap));
  await context.close();
} finally {
  await browser.close();
  clearTimer();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n── settings smoke: ${results.length - fails} PASS / ${fails} FAIL — shots: ${SS_DIR}`);
process.exit(fails ? 1 : 0);
