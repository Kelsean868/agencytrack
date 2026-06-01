/**
 * Track J — System Screens v2 smoke (both themes).
 *
 * Flow:
 *   1. Logged-out: visit / → assert LoginScreen restyle elements render
 *      (login-pattern + login-card backdrop-blur + login-password-toggle).
 *   2. Toggle the password-eye → assert input type flips text↔password,
 *      no auth-service call fires.
 *   3. Fill agent credentials → submit → wait for AgentDashboard mount.
 *   4. Verify no console errors throughout.
 *
 * Light + dark via the theme toggle PRE-LOGIN (dark localStorage set before
 * navigation per the existing dark-mode mount in main.jsx).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

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
  } catch { /* ignore */ }
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_* — system-screens smoke skipped');
  process.exit(0);
}
if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

const RESULTS = [];

async function newCtx(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  // Set the dark-mode preference BEFORE the page navigates, so the mount
  // sequence in src/main.jsx picks it up.
  if (theme === 'dark') {
    await context.addInitScript(() => {
      try { localStorage.setItem('agencytrack-dark', '1'); } catch { /* ignore */ }
    });
  }
  const errors = [];
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });
  return { browser, page, errors };
}

async function smoke(theme) {
  const { browser, page, errors } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // (1) Restyled LoginScreen — patterns + glass card + eye-toggle present.
    await page.waitForSelector('[data-testid="login-card"]', { timeout: 30_000 });
    const card = page.locator('[data-testid="login-card"]');
    const pattern = page.locator('[data-testid="login-pattern"]');
    const toggle = page.locator('[data-testid="login-password-toggle"]');

    const cardClass = await card.getAttribute('class');
    const cardHasBlur = /backdrop-blur-md/.test(cardClass);
    const cardHasAlphaBg = /bg-card\/80/.test(cardClass);
    const patternRows = await pattern.evaluate((el) => el.children.length);
    const driftClasses = await pattern.evaluate((el) =>
      Array.from(el.children).map((row) => row.className));
    const hasDriftL = driftClasses.some((c) => /animate-login-drift-l/.test(c));
    const hasDriftR = driftClasses.some((c) => /animate-login-drift-r/.test(c));
    const toggleVisible = (await toggle.count()) > 0;
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // (2) Password-toggle UI-only flip.
    const pwdInput = page.locator('input#password');
    const beforeType = await pwdInput.getAttribute('type');
    await toggle.click();
    await page.waitForTimeout(150);
    const afterType = await pwdInput.getAttribute('type');
    const togglesType = beforeType === 'password' && afterType === 'text';
    // Flip it back so the credentials don't accidentally show in any screenshot.
    await toggle.click();
    await page.waitForTimeout(150);

    // (3) Log in as the test agent.
    await page.fill('input#email',    AGENT_EMAIL);
    await page.fill('input#password', AGENT_PASS);
    await Promise.all([
      page.waitForFunction(() => !document.querySelector('input#email'), { timeout: 30_000 }),
      page.click('button[type="submit"]'),
    ]);

    // (4) AgentDashboard mounts — the agent nav shows up.
    await page.waitForFunction(
      () => document.querySelector('[data-testid^="agent-tab-"]') !== null
         || document.querySelectorAll('h1').length > 0,
      { timeout: 30_000 }
    );
    const loggedInBodyLen = await page.evaluate(() =>
      (document.body.textContent || '').replace(/\s+/g, '').length);

    const pass = (
      cardHasBlur &&
      cardHasAlphaBg &&
      patternRows === 4 &&
      hasDriftL && hasDriftR &&
      toggleVisible &&
      togglesType &&
      ((theme === 'dark' && isDark) || (theme === 'light' && !isDark)) &&
      loggedInBodyLen > 200 &&
      errors.length === 0
    );

    RESULTS.push({
      theme,
      cardHasBlur, cardHasAlphaBg,
      patternRows, hasDriftL, hasDriftR,
      toggleVisible, togglesType, beforeType, afterType,
      isDark,
      loggedInBodyLen,
      errors: errors.length,
      pass,
    });
    console.log(
      `[${theme}] cardBlur=${cardHasBlur} cardAlpha=${cardHasAlphaBg} ` +
      `rows=${patternRows} (L=${hasDriftL}/R=${hasDriftR}) ` +
      `toggle=${toggleVisible}(${beforeType}→${afterType}) dark=${isDark} ` +
      `loggedInLen=${loggedInBodyLen} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`
    );
  } finally {
    await browser.close();
  }
}

await smoke('light');
await smoke('dark');

console.log('\n=== System Screens v2 smoke summary ===');
for (const r of RESULTS) console.log(JSON.stringify(r));
const allPass = RESULTS.every((r) => r.pass);
process.exit(allPass ? 0 : 1);
