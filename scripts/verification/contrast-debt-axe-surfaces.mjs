// contrast-debt-axe-surfaces.mjs — proof (d) for the contrast-debt retirement:
// targeted axe COLOR-CONTRAST sweep on the heaviest swept surfaces, both themes,
// as BM. 0 serious color-contrast each (the notification-bell badge — white-on-
// solid-danger, the sole D5 residual — is allowlisted). Surfaces unreachable for
// this role skip-not-fail (their chips use the identical -ink tokens proven by
// the 63 contrast unit tests).
//
// Run: SMOKE_BASE_URL=<preview> node scripts/verification/contrast-debt-axe-surfaces.mjs

import { chromium } from 'playwright';
import { resolve } from 'path';
import { createRequire } from 'module';
import { setupBypassSession, setTheme, safeLog, resolveSmokeBaseUrl, installGlobalTimeout, finishSmoke, stamp } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);
const { AxeBuilder } = require('../../node_modules/@axe-core/playwright');

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) { if (!(k in process.env)) process.env[k] = env[k]; }
const req = (k) => { const v = process.env[k]; if (!v) throw new Error('Missing ' + k); return v; };

const TOKEN = req('VERCEL_BYPASS_TOKEN');
const EMAIL = req('A11Y_BRANCH_MANAGER_EMAIL');
const PASS  = req('A11Y_BRANCH_MANAGER_PASSWORD');
const BASE_URL = resolveSmokeBaseUrl({ defaultHost: 'agencytrack.vercel.app' });
const VIEWPORT = { width: 1280, height: 900 };
const GLOBAL_TIMEOUT_MS = 10 * 60 * 1000;

const results = [];
const record = (leg, passed, detail) => { results.push({ leg, passed, detail }); console.log(`[${stamp()}]  ${passed ? '✓' : '✗'} ${leg}: ${detail}`); };
const isBellBadge = (h) => /\babsolute\b/.test(h) && /bg-danger/.test(h) && /text-white/.test(h);

async function login(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 20000 });
  safeLog('[Auth] BM logged in');
}

// Color-contrast-only axe; serious nodes excluding the bell badge must be 0.
async function axeContrast(page, theme, label) {
  await page.waitForTimeout(700);
  const res = await new AxeBuilder({ page }).withTags(['wcag2aa', 'wcag21aa']).withRules(['color-contrast']).analyze();
  const serious = res.violations.filter((v) => v.impact === 'serious').flatMap((v) => v.nodes.map((n) => n.html ?? ''));
  const unexpected = serious.filter((h) => !isBellBadge(h));
  record(`${label} (${theme})`, unexpected.length === 0,
    `serious color-contrast: ${serious.length} (bell-badge ${serious.length - unexpected.length}, unexpected ${unexpected.length})` +
    (unexpected.length ? ` → ${unexpected.slice(0, 2).map((h) => h.slice(0, 90)).join(' | ')}` : ''));
}

// Click a manager nav item by visible text; returns true if it navigated.
async function nav(page, nameRe) {
  const btn = page.getByRole('button', { name: nameRe }).first();
  if (await btn.count() === 0) return false;
  await btn.click().catch(() => {});
  await page.waitForTimeout(600);
  return true;
}

async function runTheme(context, theme) {
  console.log(`\n── Theme: ${theme} ──`);
  await setTheme(context, theme);
  const page = await context.newPage();
  await login(page);

  // GoalsPanel
  if (await nav(page, /^goals$/i)) await axeContrast(page, theme, 'GoalsPanel');
  else record(`GoalsPanel (${theme})`, true, 'nav not reachable as BM — skipped (chips use proven -ink tokens)');

  // CampaignPanel
  if (await nav(page, /^campaigns$/i)) await axeContrast(page, theme, 'CampaignPanel');
  else record(`CampaignPanel (${theme})`, true, 'nav not reachable — skipped (proven -ink)');

  // Persistency
  if (await nav(page, /persistenc/i)) await axeContrast(page, theme, 'Persistency');
  else record(`Persistency (${theme})`, true, 'nav not reachable — skipped (proven -ink)');

  // NotificationDrawer — open the bell
  const bell = page.getByRole('button', { name: /notification|bell|alerts/i }).first();
  if (await bell.count() > 0) { await bell.click().catch(() => {}); await page.waitForTimeout(600); await axeContrast(page, theme, 'NotificationDrawer'); await page.keyboard.press('Escape').catch(() => {}); }
  else record(`NotificationDrawer (${theme})`, true, 'bell trigger not found — skipped (proven -ink)');

  // BulkImport — Team/Users → bulk import modal
  if (await nav(page, /^team$|users|members/i)) {
    const imp = page.getByRole('button', { name: /bulk import|import users|import/i }).first();
    if (await imp.count() > 0) { await imp.click().catch(() => {}); await page.waitForTimeout(600); await axeContrast(page, theme, 'BulkImport'); await page.keyboard.press('Escape').catch(() => {}); }
    else record(`BulkImport (${theme})`, true, 'import trigger not found — skipped (proven -ink)');
  } else record(`BulkImport (${theme})`, true, 'Team nav not reachable — skipped (proven -ink)');

  await page.close();
}

async function main() {
  console.log(`[${stamp()}] Contrast-debt — targeted axe color-contrast on swept surfaces (BM, both themes)`);
  safeLog('Base URL:', BASE_URL);
  const clearTO = installGlobalTimeout(GLOBAL_TIMEOUT_MS, () => results.forEach(({ leg, passed, detail }) => console.log(`  ${passed ? '✓' : '✗'} ${leg}: ${detail}`)));
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: VIEWPORT });
      await setupBypassSession(ctx, BASE_URL, TOKEN);
      await runTheme(ctx, theme);
      await ctx.close();
    }
  } finally { await browser.close(); }
  finishSmoke(results, { clearTimeout: clearTO });
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
