/**
 * Quick both-themes smoke: navigate to Persistency tab in light+dark,
 * assert no console errors, confirm the card renders.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

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

const URL   = 'http://127.0.0.1:4173';
const EMAIL = process.env.A11Y_AGENT_EMAIL;
const PASS  = process.env.A11Y_AGENT_PASSWORD;
if (!EMAIL || !PASS) { console.error('Missing A11Y credentials'); process.exit(1); }

const RESULTS = [];

async function smokeTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // Login
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body.textContent.replace(/\s+/g, '').length > 400, { timeout: 30000 });
  await page.waitForTimeout(1500);

  if (theme === 'dark') {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agencytrack-dark', 'true');
    });
    await page.waitForTimeout(400);
  }

  // Navigate to Persistency tab via sidebar testId
  await page.click('[data-testid="agent-tab-persistency"]');
  await page.waitForTimeout(1500);

  // Assert the tab container renders
  const tabEl = await page.$('[data-testid="agent-persistency-tab"]');
  const tabOk = !!tabEl;

  // Assert summary card
  const summaryEl = await page.$('[data-testid="agent-persistency-summary"]');
  const summaryOk = !!summaryEl;

  const pass = tabOk && summaryOk && errors.length === 0;
  RESULTS.push({ theme, tabOk, summaryOk, errors, pass });
  console.log(`[${theme}] tab=${tabOk} summary=${summaryOk} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`);
  if (errors.length) errors.forEach(e => console.log(`  console.error: ${e}`));

  await browser.close();
}

await smokeTheme('light');
await smokeTheme('dark');

const allPass = RESULTS.every(r => r.pass);
console.log(`\nBoth-themes smoke: ${allPass ? '✓ PASS' : '✗ FAIL'}`);
process.exit(allPass ? 0 : 1);
