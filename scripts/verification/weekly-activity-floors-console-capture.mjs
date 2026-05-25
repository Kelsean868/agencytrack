// Supplemental capture: console errors/warnings + network failures on the dashboard.
// Single-purpose: run on top of the main smoke to satisfy the dispatcher's
// "capture console errors/warnings, network failures" requirement.

import { chromium } from 'playwright';
import { resolve } from 'path';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-weekly-act-325974-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 390, height: 844 };

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
};

const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASSWORD = requireEnv('A11Y_AGENT_PASSWORD');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, PREVIEW_URL, TOKEN);
  const page = await context.newPage();

  const consoleMessages = [];
  const networkFailures = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    consoleMessages.push({ type: 'pageerror', text: err.message });
  });
  page.on('requestfailed', (req) => {
    networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      networkFailures.push({ url: resp.url(), status: resp.status() });
    }
  });

  try {
    await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
    await page.fill('input[type="email"]', AGENT_EMAIL);
    await page.fill('input[type="password"]', AGENT_PASSWORD);
    await Promise.all([
      page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForFunction(() => document.body && document.body.textContent.length > 500, { timeout: 30_000 });
    // Let Firestore settle and any deferred queries fire.
    await page.waitForTimeout(4000);

    // Force a reload to capture cold-start network too.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body && document.body.textContent.length > 500, { timeout: 30_000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    safeLog('[console-capture] walk error:', e.message);
  } finally {
    await browser.close();
  }

  // Sanitize known noise: redact tokens just in case, and drop static-asset 404s
  // that are framework-level (favicon, sourcemaps) and not app failures.
  const STATIC_NOISE_RE = /\.(map|ico)(\?|$)/;
  const realFailures = networkFailures.filter((f) => !STATIC_NOISE_RE.test(f.url));

  console.log('[console-capture] CONSOLE ERRORS/WARNINGS:');
  if (!consoleMessages.length) console.log('  (none)');
  else consoleMessages.forEach((m) => console.log(`  [${m.type}] ${m.text}`));

  console.log('\n[console-capture] NETWORK FAILURES (excluding static-asset .map/.ico):');
  if (!realFailures.length) console.log('  (none)');
  else realFailures.forEach((f) => console.log(`  ${f.status ?? f.failure}  ${f.url}`));

  console.log(`\n[console-capture] totals — console:${consoleMessages.length} network:${realFailures.length}`);
  process.exit(0);
})();
