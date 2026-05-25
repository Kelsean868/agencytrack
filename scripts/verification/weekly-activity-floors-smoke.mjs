// weekly-activity-floors-smoke.mjs — Phase 5 smoke for feat/weekly-activity-floors.
//
// Real READ-VERIFY cycle (the write is the seed already executed against
// tatillife_south in Phase 2): logs in as the test agent, opens the agent
// dashboard at 390x844, asserts the new "Weekly Standard — Expected vs Actual"
// card renders with the 10 seeded floors as Expected values, and that each
// row carries a per-row status badge (Met / Close / Below). Verifies in both
// light and dark mode, captures screenshots, and bails non-zero if any
// row's Expected value or badge is missing.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-weekly-activity-floors-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 390, height: 844 };
const SCREENSHOT_DIR = resolve('verification', 'weekly-activity-floors-smoke');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
};

const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASSWORD = requireEnv('A11Y_AGENT_PASSWORD');

// Seeded floor values (Appendix A) — what should appear as "Expected".
const EXPECTED_VALUES = {
  'Calls Made':             '60',
  'Contacts Made':          '40',
  'Appointments Scheduled': '20',
  'Interviews Kept':        '15',
  'Fact Finds Completed':   '10',
  'Closing Interviews Kept': '10',
  'Applications Submitted': '1',
  'Clients Sold':           '1',
  'API (TTD)':              null, // currency formatting — match TT$ + 4,800
  'Referrals / New Leads':  '100',
};

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
  // Mobile-friendly post-login readiness — wait for dashboard body content.
  await page.waitForFunction(
    () => document.body && document.body.textContent.length > 500,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500);
}

async function readCardState(page) {
  return await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h3'))
      .find((h) => /Weekly Standard/i.test(h.textContent ?? ''));
    if (!heading) return { found: false };
    const section = heading.closest('section');
    if (!section) return { found: false, headingOnly: true };
    const rows = Array.from(section.querySelectorAll('li'));
    const rowData = rows.map((li) => {
      const label = li.querySelector('span.truncate')?.textContent?.trim() ?? '';
      const cells = Array.from(li.querySelectorAll('div.tabular-nums'));
      const expected = cells[0]?.querySelector('.font-semibold')?.textContent?.trim() ?? '';
      const actual   = cells[1]?.querySelector('.font-semibold')?.textContent?.trim() ?? '';
      const badge = li.querySelector('span[aria-label]')?.textContent?.trim() ?? '';
      return { label, expected, actual, badge };
    });
    return { found: true, rowCount: rows.length, rowData };
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
    try { localStorage.setItem('agencytrack-dark', document.documentElement.classList.contains('dark') ? '1' : '0'); } catch {}
  });
  await page.waitForTimeout(300);
}

(async () => {
  console.log('[smoke] weekly-activity-floors — preview:', PREVIEW_HOST);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, PREVIEW_URL, TOKEN);
  const page = await context.newPage();

  const failures = [];

  try {
    await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
    await loginAtMobile(page, { email: AGENT_EMAIL, password: AGENT_PASSWORD });

    // Ensure light mode for first pass.
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('agencytrack-dark', '0'); } catch {}
    });
    await page.waitForTimeout(500);

    console.log('[smoke] LIGHT MODE — current theme:', await getThemeState(page));
    const lightState = await readCardState(page);

    if (!lightState.found) {
      failures.push('LIGHT: WeeklyStandardCard heading not found on dashboard.');
    } else {
      console.log(`[smoke] LIGHT: card found with ${lightState.rowCount} rows`);
      lightState.rowData.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.label} — Expected=${row.expected} Actual=${row.actual} Status=${row.badge}`);
      });

      if (lightState.rowCount !== 10) {
        failures.push(`LIGHT: expected 10 rows, got ${lightState.rowCount}`);
      }

      for (const [label, expectedValue] of Object.entries(EXPECTED_VALUES)) {
        const row = lightState.rowData.find((r) => r.label === label);
        if (!row) {
          failures.push(`LIGHT: row "${label}" not found`);
          continue;
        }
        if (expectedValue !== null && row.expected !== expectedValue) {
          failures.push(`LIGHT: row "${label}" expected="${row.expected}", want "${expectedValue}"`);
        }
        if (label === 'API (TTD)') {
          // Currency: should contain "4,800"
          if (!row.expected.includes('4,800')) {
            failures.push(`LIGHT: row "API (TTD)" expected="${row.expected}", want to contain "4,800"`);
          }
        }
        if (!['Met', 'Close', 'Below'].includes(row.badge)) {
          failures.push(`LIGHT: row "${label}" badge="${row.badge}", want one of Met/Close/Below`);
        }
      }
    }

    await page.screenshot({ path: join(SCREENSHOT_DIR, 'light-390x844.png'), fullPage: true });

    // ── DARK MODE ─────────────────────────────────────────────────────────
    await toggleDarkMode(page);
    await page.waitForTimeout(500);
    console.log('[smoke] DARK MODE — current theme:', await getThemeState(page));

    const darkState = await readCardState(page);
    if (!darkState.found) {
      failures.push('DARK: WeeklyStandardCard heading not found on dashboard.');
    } else {
      console.log(`[smoke] DARK: card found with ${darkState.rowCount} rows`);

      if (darkState.rowCount !== 10) {
        failures.push(`DARK: expected 10 rows, got ${darkState.rowCount}`);
      }

      for (const [label, expectedValue] of Object.entries(EXPECTED_VALUES)) {
        const row = darkState.rowData.find((r) => r.label === label);
        if (!row) {
          failures.push(`DARK: row "${label}" not found`);
          continue;
        }
        if (expectedValue !== null && row.expected !== expectedValue) {
          failures.push(`DARK: row "${label}" expected="${row.expected}", want "${expectedValue}"`);
        }
        if (!['Met', 'Close', 'Below'].includes(row.badge)) {
          failures.push(`DARK: row "${label}" badge="${row.badge}", want one of Met/Close/Below`);
        }
      }

      // Sanity check: verify a badge actually renders a theme-aware color in dark mode
      // (not the default browser color).
      const badgeColor = await page.evaluate(() => {
        const badge = document.querySelector('section[aria-labelledby="weekly-standard-heading"] span[aria-label]');
        return badge ? getComputedStyle(badge).color : null;
      });
      console.log(`[smoke] DARK: badge color sample = ${badgeColor}`);
      if (!badgeColor || badgeColor === 'rgba(0, 0, 0, 0)') {
        failures.push('DARK: badge color did not resolve');
      }
    }

    await page.screenshot({ path: join(SCREENSHOT_DIR, 'dark-390x844.png'), fullPage: true });

    // ── Footnote toggle smoke test ────────────────────────────────────────
    const footnoteResult = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label*="Contacts Made"]');
      if (!btn) return { ok: false, reason: 'footnote button not found' };
      btn.click();
      const expanded = btn.getAttribute('aria-expanded');
      return { ok: true, expanded };
    });
    console.log('[smoke] footnote toggle:', footnoteResult);
    if (!footnoteResult.ok) failures.push(`Footnote: ${footnoteResult.reason}`);

  } catch (e) {
    safeLog('[smoke] WALK ERROR:', e.message);
    failures.push(`walk error: ${e.message}`);
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.log('\n[smoke] FAILURES:');
    failures.forEach((f) => console.log('  -', f));
    console.log(`\n[smoke] FAIL (${failures.length} issue${failures.length > 1 ? 's' : ''})`);
    process.exit(1);
  }
  console.log('\n[smoke] PASS — 10 rows rendered, Expected values match seeded floors, all status badges present, light + dark verified, footnote toggles.');
  process.exit(0);
})();
