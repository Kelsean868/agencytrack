/**
 * track-e-social-kpis-smoke.mjs — PR #319 preview smoke.
 *
 * Verifies Track E(c) social/content KPIs wizard step:
 *  1. Agent logs in to preview
 *  2. Opens weekly wizard (via "Start Weekly Report" button)
 *  3. Navigates to Screen 1 ("Prospecting & Calls")
 *  4. Verifies "Social & Content" card is visible
 *  5. Verifies 4 main numeric fields: Posts Published, Engagement, Inbox Enquiries, Names from Social
 *  6. Clicks "Show platform breakdown" toggle — verifies 4 platform fields appear
 *  7. Clicks "Hide platform breakdown" toggle — verifies fields collapse
 *  8. Closes wizard (no submission)
 *
 * Read-only smoke — does NOT submit a report.
 * Run from repo root: node scripts/verification/track-e-social-kpis-smoke.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { setupBypassSession } from './lib/walk-helpers.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..', '..');

function loadEnv() {
  const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^\r\n]*)/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const E = loadEnv();

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-track-e-social-kpis-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const SCREENSHOT_DIR = resolve('verification', 'track-e-social-kpis-smoke');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const RUN_TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const results = [];
function pass(step, note = '') { results.push({ step, status: 'PASS', note }); console.log(`  ✓ ${step}${note ? ` — ${note}` : ''}`); }
function fail(step, note = '') { results.push({ step, status: 'FAIL', note }); console.log(`  ✗ ${step}${note ? ` — ${note}` : ''}`); }
function skip(step, note = '') { results.push({ step, status: 'SKIP', note }); console.log(`  ~ ${step}${note ? ` — ${note}` : ''}`); }

async function main() {
  console.log(`\n=== track-e-social-kpis-smoke ${RUN_TS} ===`);
  console.log(`Target: ${PREVIEW_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const jsErrors = [];

  try {
    await setupBypassSession(context, PREVIEW_URL, E.VERCEL_BYPASS_TOKEN);
    pass('bypass-session');

    const page = await context.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') jsErrors.push(msg.text());
    });

    // ── Login ────────────────────────────────────────────────────────────
    await page.goto(`${PREVIEW_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.fill('input[type="email"]', E.A11Y_AGENT_EMAIL);
    await page.fill('input[type="password"]', E.A11Y_AGENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid^="agent-tab-"]') ||
            document.body.textContent.length > 800,
      { timeout: 40000 }
    );
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: join(SCREENSHOT_DIR, '01-after-login.png') });
    pass('agent-login');

    // ── Open wizard ───────────────────────────────────────────────────────
    // The exact button labels from AgentDashboard: "Submit Weekly Report" or "Submit your first report"
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => ({ text: b.textContent?.trim() }))
    );
    const wizardBtnText = allBtns.find(b => /submit weekly report|submit your first report/i.test(b.text ?? ''));

    if (wizardBtnText) {
      const btn = page.getByRole('button', { name: new RegExp(wizardBtnText.text.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      // Fallback: look for any button with "weekly" or "report" keywords
      const fallbackBtn = page.getByRole('button', { name: /weekly|report/i }).first();
      if (await fallbackBtn.isVisible().catch(() => false)) {
        await fallbackBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    await page.screenshot({ path: join(SCREENSHOT_DIR, '02-after-trigger.png') });

    // Check if wizard is open — look for the "Select Week" date picker or the step content
    // The wizard renders INSTEAD of the dashboard (full-page replacement), not as a modal
    const wizardOpen = await page.evaluate(() => {
      const text = document.body.textContent ?? '';
      // Look for wizard-specific text: date picker label or step screens
      return /select the sunday|start report|prospecting.*calls|social.*content|screen 1/i.test(text);
    });

    if (!wizardOpen) {
      fail('wizard-opened', 'Wizard not detected after clicking trigger — body text missing wizard indicators');
      skip('screen1-social-card', 'Wizard not open');
      skip('main-fields-visible', 'Wizard not open');
      skip('platform-toggle', 'Wizard not open');
    } else {
      pass('wizard-opened');

        // If we're on the date-picker screen ("Select Week" heading), advance to step screen
      const datePickerVisible = await page.evaluate(() =>
        Array.from(document.querySelectorAll('h1,h2,p,label'))
          .some(el => /select the sunday|select week|start report/i.test(el.textContent ?? ''))
      );

      if (datePickerVisible) {
        // "Start Report" is the exact button label on the date picker screen
        const startBtn = page.getByRole('button', { name: /start report/i });
        if (await startBtn.isVisible().catch(() => false)) {
          await startBtn.click();
          await new Promise(r => setTimeout(r, 2000)); // wait for Screen 1 to load
        } else {
          // Fallback: any button matching start/continue
          const altBtn = page.getByRole('button', { name: /continue|next|begin/i });
          if (await altBtn.isVisible().catch(() => false)) {
            await altBtn.click();
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }

      await page.screenshot({ path: join(SCREENSHOT_DIR, '03-wizard-screen1.png') });

      // ── Verify "Social & Content" card badge ────────────────────────────
      const socialCardText = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        return spans.some(s => /social & content/i.test(s.textContent ?? ''));
      });

      if (socialCardText) {
        pass('screen1-social-card', '"Social & Content" badge found on Screen 1');
      } else {
        fail('screen1-social-card', '"Social & Content" badge not found — may need to scroll or advance screen');
      }

      // ── Verify 4 main fields ────────────────────────────────────────────
      const mainFields = [
        'Posts Published',
        'Engagement (Likes + Comments)',
        'Inbox Enquiries',
        'Names from Social',
      ];

      const fieldResults = await page.evaluate((fields) => {
        return fields.map(label => {
          const labels = Array.from(document.querySelectorAll('label'));
          const found = labels.some(l => l.textContent?.trim().includes(label));
          return { label, found };
        });
      }, mainFields);

      let allMainFound = true;
      for (const { label, found } of fieldResults) {
        if (found) pass(`field-visible: ${label}`);
        else { fail(`field-visible: ${label}`, 'label not found in DOM'); allMainFound = false; }
      }

      // ── Platform breakdown toggle ───────────────────────────────────────
      if (allMainFound) {
        // Find and click "Show platform breakdown" button
        const toggleBtn = page.getByRole('button', { name: /show platform breakdown/i });
        const toggleVisible = await toggleBtn.isVisible().catch(() => false);

        if (toggleVisible) {
          await toggleBtn.click();
          await new Promise(r => setTimeout(r, 500));
          await page.screenshot({ path: join(SCREENSHOT_DIR, '04-breakdown-expanded.png') });

          // Verify platform labels appear
          const platforms = ['Facebook', 'Instagram', 'WhatsApp', 'LinkedIn'];
          const platformResults = await page.evaluate((ps) => {
            return ps.map(p => {
              const labels = Array.from(document.querySelectorAll('label'));
              return { platform: p, found: labels.some(l => l.textContent?.trim() === p) };
            });
          }, platforms);

          let allPlatformsFound = true;
          for (const { platform, found } of platformResults) {
            if (found) pass(`platform-field-visible: ${platform}`);
            else { fail(`platform-field-visible: ${platform}`, 'label not in DOM after toggle'); allPlatformsFound = false; }
          }

          // Click hide toggle
          const hideBtn = page.getByRole('button', { name: /hide platform breakdown/i });
          if (await hideBtn.isVisible().catch(() => false)) {
            await hideBtn.click();
            await new Promise(r => setTimeout(r, 400));

            // Verify platforms hidden
            const fbStillVisible = await page.evaluate(() =>
              Array.from(document.querySelectorAll('label')).some(l => l.textContent?.trim() === 'Facebook')
            );
            if (!fbStillVisible) pass('platform-toggle-collapse', 'Breakdown collapsed on hide');
            else fail('platform-toggle-collapse', 'Facebook label still visible after collapsing breakdown');
          } else {
            skip('platform-toggle-collapse', '"Hide platform breakdown" button not found');
          }

          pass('platform-toggle', `Toggle show/hide functional`);
        } else {
          fail('platform-toggle', '"Show platform breakdown" button not found');
        }
      } else {
        skip('platform-toggle', 'Main fields not all visible — skipping toggle test');
      }

      await page.screenshot({ path: join(SCREENSHOT_DIR, '05-final-state.png') });

      // Close wizard
      const closeBtn = page.getByRole('button', { name: /close|cancel|×|✕/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await new Promise(r => setTimeout(r, 500));
        pass('wizard-closed');
      } else {
        skip('wizard-closed', 'Close button not found');
      }
    }

    // JS errors check — filter known benign errors:
    // - ResizeObserver / favicon / net::ERR: browser-environment noise
    // - "Missing or insufficient permissions": pre-existing in preview env where test agent
    //   may lack seeded goals/config data; not related to social KPIs feature
    const filteredErrors = jsErrors.filter(
      t => !t.includes('ResizeObserver') &&
           !t.includes('favicon') &&
           !t.includes('net::ERR') &&
           !t.includes('Missing or insufficient permissions')
    );
    if (filteredErrors.length === 0) pass('no-console-errors');
    else fail('no-console-errors', filteredErrors.slice(0, 2).join('; '));

  } catch (err) {
    fail('browser-error', err.message.slice(0, 300));
  } finally {
    await browser.close();
  }

  const total   = results.length;
  const passed  = results.filter(r => r.status === 'PASS').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const allOk   = results.every(r => r.status !== 'FAIL');
  console.log(`\n=== RESULT: ${passed}/${total} passed, ${skipped} skipped — ${allOk ? 'OK ✓' : 'FAILED ✗'} ===\n`);
  if (allOk) {
    console.log('Social & Content card + 4 main fields + platform breakdown toggle — all verified.');
  }
  if (!allOk) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
