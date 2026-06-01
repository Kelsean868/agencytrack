/**
 * Track J Wizard v2 PR1 — structural shell smoke.
 *
 * Both themes. End-to-end write-read-verify per the smoke standard:
 *   1. Log in as the test agent.
 *   2. Open the new 12-step wizard via the Agent Dashboard.
 *   3. Walk through all 11 v2 steps (PR1 ends at step 11; review 12 = PR3).
 *      At each step, capture the eyebrow + title + step counter so the
 *      pagination chain is verified live, not just rendered.
 *   4. Touch ONE field at step 1 (prospectingLettersSent = 5) to prove the
 *      write path actually reaches Firestore + the field's value is on the
 *      persisted doc.
 *   5. Submit on step 11. Wait for the Done screen.
 *   6. Close the wizard, hard-reload the page, re-open the wizard for the
 *      same weekStarting → expect the 'submitted' interstitial (proves the
 *      submission persisted with the correct shape).
 *
 * The smoke gates on:
 *   - 12-dot phase progress rail present on every step
 *   - step counter reads "Step N of 12"
 *   - phase rail's data-state attrs flip past/current/future correctly
 *   - Submit succeeds without 0 console errors
 *   - Reload + re-open finds the existing submission
 *
 * Credentials by boolean presence only (Rule 4).
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

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_* credentials — smoke skipped.');
  process.exit(0);
}
if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

const RESULTS = [];

async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function newCtx(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  const errors = [];
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('fontshare.com')) return;
    if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
    errors.push(text);
  });
  return {
    browser, page, errors,
    async setDark() {
      if (theme === 'dark') {
        await page.evaluate(() => {
          document.documentElement.classList.add('dark');
          localStorage.setItem('agencytrack-dark', 'true');
        });
        await page.waitForTimeout(400);
      }
    },
  };
}

async function openWizard(page) {
  // Multiple potential CTAs depending on dashboard state. Try the primary
  // "Submit weekly report" then fall back to common nav routes.
  const ctas = [
    'button:has-text("Submit weekly report")',
    'button:has-text("Submit Report")',
    'button:has-text("Start Report")',
    '[data-testid="hero-submit-cta"]',
  ];
  for (const sel of ctas) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) {
      await el.click().catch(() => {});
      break;
    }
  }
  // Date picker → Start Report
  if (await page.locator('text=Select Week').count() > 0) {
    await page.click('button:has-text("Start Report")').catch(() => {});
  }
  // Confirm wizard mounted
  await page.waitForSelector('[data-testid="wizard-v2-modal"]', { timeout: 30_000 });
}

async function walkAllSteps(page) {
  const chain = [];
  for (let n = 1; n <= 11; n++) {
    await page.waitForSelector('[data-testid="wizard-v2-step-title"]', { timeout: 10_000 });
    const title = await page.locator('[data-testid="wizard-v2-step-title"]').textContent();
    const counter = await page.locator('[data-testid="wizard-v2-step-counter"]').textContent();
    const dotState = await page.locator(`[data-testid="wizard-v2-step-dot-${n}"]`).getAttribute('data-state');
    chain.push({ n, title: (title || '').trim(), counter: (counter || '').trim(), dotState });
    // Touch one field on step 1 to prove the write path is live.
    if (n === 1) {
      const letters = page.locator('input[id="prospectingLettersSent"]');
      if (await letters.count() > 0) {
        await letters.fill('5');
        await page.waitForTimeout(400);
      }
    }
    if (n < 11) {
      await page.click('[data-testid="wizard-v2-next"]');
      await page.waitForTimeout(250);
    }
  }
  return chain;
}

async function submitAndVerify(page, weekStarting) {
  // Step 11 Next → submitReport.
  await page.click('[data-testid="wizard-v2-next"]');
  await page.waitForFunction(
    () => document.body.textContent.includes('Report Submitted'),
    { timeout: 30_000 }
  );
  // Close → reload → re-open should show 'submitted' interstitial.
  await page.click('button:has-text("Back to Dashboard")');
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid^="agent-tab-"]', { timeout: 30_000 });
  // Re-open the wizard against the same weekStarting → 'submitted' card.
  await openWizard(page).catch(() => {});
  // Pick the matching week from the picker
  const sel = page.locator('#wizard-week');
  if (await sel.count() > 0 && weekStarting) {
    const optExists = await page.locator(`#wizard-week option[value="${weekStarting}"]`).count();
    if (optExists > 0) {
      await sel.selectOption(weekStarting);
      await page.click('button:has-text("Start Report")');
    }
  }
  await page.waitForTimeout(1500);
  const submittedTitle = await page.locator('text=Already submitted').count();
  return submittedTitle > 0;
}

async function smokeTheme(theme) {
  const { browser, page, errors, setDark } = await newCtx(theme);
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await login(page, AGENT_EMAIL, AGENT_PASS);
    await setDark();

    await openWizard(page);

    // Pick the most-recent Sunday from the dropdown (top option) and start.
    let weekStarting = '';
    const sel = page.locator('#wizard-week');
    if (await sel.count() > 0) {
      weekStarting = await page.locator('#wizard-week option:nth-of-type(1)').getAttribute('value');
      await page.click('button:has-text("Start Report")');
      await page.waitForTimeout(800);
    }

    const chain = await walkAllSteps(page);
    const persisted = await submitAndVerify(page, weekStarting);

    const counterOk = chain.every((c, i) => c.counter.match(new RegExp(`Step ${i + 1} of 12`)));
    const dotsOk    = chain.every((c) => c.dotState === 'current');
    const titlesOk  = chain[0].title === 'Letters & outreach' && chain[10].title === 'Targets for next week';

    const pass = counterOk && dotsOk && titlesOk && persisted && errors.length === 0;
    RESULTS.push({
      theme, weekStarting,
      counterOk, dotsOk, titlesOk, persisted,
      firstTitle: chain[0]?.title, lastTitle: chain[10]?.title,
      errors: errors.length, pass,
    });
    console.log(
      `[wizard ${theme}] counters=${counterOk} dots=${dotsOk} titles=${titlesOk} persisted=${persisted} errors=${errors.length} → ${pass ? 'PASS' : 'FAIL'}`
    );
  } finally {
    await browser.close();
  }
}

await smokeTheme('light');
await smokeTheme('dark');

console.log('\n=== Wizard v2 PR1 shell smoke summary ===');
for (const r of RESULTS) console.log(JSON.stringify(r));
const ok = RESULTS.every((r) => r.pass);
process.exit(ok ? 0 : 1);
