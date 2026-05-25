// tenure-prod-render.mjs — light Part B production render check after the
// preview smoke already passed multi-band write-read-verify. No seeding,
// no mutations, no restoration. Logs in as the test agent on
// https://agencytrack.vercel.app and asserts the Weekly Standard API row
// + Career Portal Annual API "Minimum" both render with the fallback
// values (test agent has no contractStartDate → 200K / 4,800).
// Light + dark, 390x844, 0 console errors.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const PREVIEW_HOST = process.env.PREVIEW_HOST ?? 'agencytrack.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 390, height: 844 };
const SCREENSHOT_DIR = resolve('verification', 'tenure-prod-render');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
};

const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASSWORD = requireEnv('A11Y_AGENT_PASSWORD');

// Expected fallback values (test agent has no contractStartDate).
const EXPECTED_ANNUAL_SUBSTR = '200,000';
const EXPECTED_WEEKLY_SUBSTR = '4,800';

async function loginAtMobile(page, { email, password }) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(
      () => document.querySelector('input[type="email"]') === null,
      { timeout: 30_000 },
    ),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.length > 500,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500);
}

async function readWeeklyApiExpected(page) {
  return await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h3'))
      .find((h) => /Weekly Standard/i.test(h.textContent ?? ''));
    if (!heading) return { found: false, reason: 'heading missing' };
    const section = heading.closest('section');
    if (!section) return { found: false, reason: 'section missing' };
    const apiRow = Array.from(section.querySelectorAll('li')).find((li) =>
      /API \(TTD\)/i.test(li.querySelector('span.truncate')?.textContent ?? '')
    );
    if (!apiRow) return { found: false, reason: 'API row missing' };
    const cells = Array.from(apiRow.querySelectorAll('div.tabular-nums'));
    const expected = cells[0]?.querySelector('.font-semibold')?.textContent?.trim() ?? '';
    return { found: true, expected };
  });
}

async function readCareerPortalAnnualMin(page) {
  return await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('p, span, td, th, div'));
    const annualApiLabel = all.find((el) => /^Annual API \(TTD\)$/i.test(el.textContent?.trim() ?? ''));
    if (!annualApiLabel) return { found: false, reason: 'Annual API label not found' };
    let parent = annualApiLabel.parentElement;
    while (parent && parent !== document.body) {
      const ttd = Array.from(parent.querySelectorAll('*'))
        .find((el) => /^TTD[\s\d,.]+$/.test(el.textContent?.trim() ?? ''));
      if (ttd) return { found: true, minimum: ttd.textContent.trim() };
      parent = parent.parentElement;
    }
    return { found: false, reason: 'currency sibling not found' };
  });
}

async function getThemeState(page) {
  return await page.evaluate(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
}

async function toggleDarkMode(page) {
  await page.evaluate(() => {
    document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem(
        'agencytrack-dark',
        document.documentElement.classList.contains('dark') ? '1' : '0'
      );
    } catch { /* ignore */ }
  });
  await page.waitForTimeout(300);
}

(async () => {
  console.log('[render] tenure prod — host:', PREVIEW_HOST);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, PREVIEW_URL, TOKEN);
  const page = await context.newPage();

  const failures = [];
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
    await loginAtMobile(page, { email: AGENT_EMAIL, password: AGENT_PASSWORD });

    // LIGHT
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('agencytrack-dark', '0'); } catch { /* ignore */ }
    });
    await page.waitForTimeout(600);

    const lightWeekly = await readWeeklyApiExpected(page);
    console.log(`[render] LIGHT theme=${await getThemeState(page)} → API row Expected="${lightWeekly.expected ?? lightWeekly.reason}"`);
    if (!lightWeekly.found) {
      failures.push(`LIGHT: Weekly Standard API row not found (${lightWeekly.reason})`);
    } else if (!lightWeekly.expected.includes(EXPECTED_WEEKLY_SUBSTR)) {
      failures.push(`LIGHT: weekly API Expected="${lightWeekly.expected}", want substring "${EXPECTED_WEEKLY_SUBSTR}"`);
    }
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'light-dashboard.png'), fullPage: true });

    // Navigate to Career Portal
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"]'));
      const careerEl = candidates.find((el) => /career/i.test(el.textContent ?? ''));
      if (careerEl) careerEl.dispatchEvent(new Event('click', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
    const onCareerPortal = await page.waitForFunction(
      () => /Goals Overview/i.test(document.body.textContent ?? ''),
      { timeout: 15_000 },
    ).then(() => true).catch(() => false);

    if (!onCareerPortal) {
      failures.push('LIGHT: Goals Overview not reached on Career Portal');
    } else {
      const cp = await readCareerPortalAnnualMin(page);
      console.log(`[render] LIGHT Career Portal Annual API min="${cp.minimum ?? cp.reason}"`);
      if (!cp.found) {
        failures.push(`LIGHT: Career Portal Annual API Minimum not found (${cp.reason})`);
      } else if (!cp.minimum.includes(EXPECTED_ANNUAL_SUBSTR)) {
        failures.push(`LIGHT: Annual API min="${cp.minimum}", want substring "${EXPECTED_ANNUAL_SUBSTR}"`);
      }
      await page.screenshot({ path: join(SCREENSHOT_DIR, 'light-career.png'), fullPage: true });
    }

    // DARK — back to dashboard
    await toggleDarkMode(page);
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"]'));
      const dashEl = candidates.find((el) => /dashboard|home/i.test(el.textContent ?? ''));
      if (dashEl) dashEl.dispatchEvent(new Event('click', { bubbles: true }));
    });
    await page.waitForTimeout(1500);

    const darkWeekly = await readWeeklyApiExpected(page);
    console.log(`[render] DARK theme=${await getThemeState(page)} → API row Expected="${darkWeekly.expected ?? darkWeekly.reason}"`);
    if (darkWeekly.found && !darkWeekly.expected.includes(EXPECTED_WEEKLY_SUBSTR)) {
      failures.push(`DARK: weekly API Expected="${darkWeekly.expected}", want substring "${EXPECTED_WEEKLY_SUBSTR}"`);
    } else if (!darkWeekly.found) {
      failures.push(`DARK: Weekly Standard API row not found (${darkWeekly.reason})`);
    }
    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dark-dashboard.png'), fullPage: true });

    if (consoleErrors.length > 0) {
      console.log('[render] console errors:');
      consoleErrors.forEach((e) => console.log('  -', e));
      failures.push(`${consoleErrors.length} console error(s)`);
    }
  } catch (e) {
    safeLog('[render] WALK ERROR:', e.message);
    failures.push(`walk error: ${e.message}`);
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.log('\n[render] FAILURES:');
    failures.forEach((f) => console.log('  -', f));
    console.log(`\n[render] FAIL (${failures.length} issue${failures.length > 1 ? 's' : ''})`);
    process.exit(1);
  }
  console.log('\n[render] PASS — Weekly Standard API row + Career Portal Annual API min both render fallback values (200K / 4,800) on production, light + dark, 0 console errors.');
  process.exit(0);
})();
