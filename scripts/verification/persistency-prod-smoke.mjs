/**
 * Prod smoke for PR #395 — AgentPersistencyTab visual port.
 * Both themes: navigate to Persistency tab, confirm render, no console errors.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL  = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS   = requireEnv('A11Y_AGENT_PASSWORD');
const PROD_URL     = `https://${process.env.PREVIEW_HOST ?? 'agencytrack.vercel.app'}`;

const log = (msg) => console.log(`[prod-smoke] ${msg}`);
const RESULTS = [];

async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1500);
}

async function runTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors  = [];

  await setupBypassSession(context, PROD_URL, BYPASS_TOKEN);
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded' });
    await loginAndWait(page);

    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
      await page.waitForTimeout(400);
    }

    // Navigate to Persistency tab
    await page.click('[data-testid="agent-tab-persistency"]');
    await page.waitForTimeout(2000);

    // Assert tab + summary card
    const tabOk     = !!(await page.$('[data-testid="agent-persistency-tab"]'));
    const summaryOk = !!(await page.$('[data-testid="agent-persistency-summary"]'));
    const valueEl   = await page.$('[data-testid="agent-persistency-value"]');
    const valueText = valueEl ? (await valueEl.textContent()).trim() : '—';

    // Verify tint classes present (not legacy opacity modifiers)
    const badgeClass = valueEl ? await valueEl.evaluate(el => el.className) : '';
    const hasLegacyOpacity = /bg-success\/15|bg-warning\/15|bg-danger\/15|bg-border\/40/.test(badgeClass);
    const hasTintClass = /bg-success-tint|bg-warning-tint|bg-danger-tint|bg-surface-muted/.test(badgeClass);

    const pass = tabOk && summaryOk && errors.length === 0 && !hasLegacyOpacity;
    RESULTS.push({ theme, tabOk, summaryOk, valueText, hasTintClass, hasLegacyOpacity, errors, pass });
    log(`[${theme}] tab=${tabOk} summary=${summaryOk} value="${valueText}" tint=${hasTintClass} legacyOpacity=${hasLegacyOpacity} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
    if (errors.length) errors.slice(0, 3).forEach(e => log(`  console.error: ${e}`));
  } finally {
    await browser.close();
  }
}

await runTheme('light');
await runTheme('dark');

const allPass = RESULTS.every(r => r.pass);
log(`\nProd smoke: ${allPass ? '✓ 2/2 PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);
