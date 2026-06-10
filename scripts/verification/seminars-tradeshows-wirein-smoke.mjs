/**
 * seminars-tradeshows-wirein smoke
 *
 * Verifies the 8→4 field collapse on StepSeminarsTradeshows and the
 * prospectingTouches / totalNewNames wire-in via the live NAMES scorecard.
 *
 * Legs:
 *   1. Navigate to Wizard v2 → Seminars step (step 2).
 *   2. Shape check: 4 surviving field labels present; 4 dropped labels absent.
 *   3. Fill namesFromSeminarsConducted=4 + namesFromTradeshowsAttended=5
 *      → assert NAMES scorecard shows 9 (proves 5-channel formula live).
 *   4. 0 console errors.
 *
 * Both light + dark themes.
 */
import { chromium } from 'playwright';
import {
  setupBypassSession,
  resolveSmokeBaseUrl,
  captureConsoleAndNetwork,
  formatCaptureReport,
  finishSmoke,
  installGlobalTimeout,
} from './lib/walk-helpers.mjs';
import { readFileSync } from 'fs';

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
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.join('=')];
}));

const BASE_URL     = args.url ?? resolveSmokeBaseUrl({ defaultHost: 'http://127.0.0.1:5173' });
const IS_PROD      = BASE_URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;

const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
const AGENT_PASS  = process.env.A11Y_AGENT_PASSWORD;

if (!AGENT_EMAIL || !AGENT_PASS) {
  console.error('Missing A11Y_AGENT_* credentials — smoke skipped (Rule 13).');
  process.exit(0);
}
if (IS_PROD && !BYPASS_TOKEN) {
  console.error('Missing VERCEL_BYPASS_TOKEN for prod URL');
  process.exit(1);
}

// Fields that MUST be present after collapse
const PRESENT_LABELS = [
  'Seminars Conducted',
  'Names from Seminars Conducted',
  'Tradeshows Attended',
  'Names from Tradeshows Attended',
];

// Fields that MUST be absent after collapse
const ABSENT_LABELS = [
  'Seminars Attended',
  'Names from Seminars Attended',
  'Tradeshows Conducted',
  'Names from Tradeshows Conducted',
];

async function runTheme(theme) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (IS_PROD) await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);

  const page = await context.newPage();
  const cap  = captureConsoleAndNetwork(page);

  const results = [];
  const pass = (leg, detail = 'ok') => { results.push({ leg, passed: true,  detail }); console.log(`  ✓ ${leg}`); };
  const fail = (leg, detail)        => { results.push({ leg, passed: false, detail: detail ?? leg }); console.error(`  ✗ ${leg}`); };

  try {
    // ── Set theme ──────────────────────────────────────────────────────────
    await page.goto(BASE_URL, { timeout: 30_000 });
    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
    }

    // ── Login ──────────────────────────────────────────────────────────────
    await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
    await page.fill('input[type="email"]', AGENT_EMAIL);
    await page.fill('input[type="password"]', AGENT_PASS);
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

    // ── Open wizard ────────────────────────────────────────────────────────
    const ctaSelectors = [
      'button:has-text("Submit weekly report")',
      'button:has-text("Submit Report")',
      'button:has-text("Start Report")',
      '[data-testid="hero-submit-cta"]',
    ];
    for (const sel of ctaSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) { await el.click().catch(() => {}); break; }
    }
    await page.waitForSelector('[data-testid="wizard-v2-modal"]', { timeout: 30_000 });
    await page.waitForTimeout(600);

    // ── Handle date screen if wizard opened without initialWeek ───────────
    // WizardForm opens on screen='date' when the CTA doesn't pass a week.
    // Click "Start Report" inside the modal to advance to screen='step'.
    const startReportInModal = page.locator(
      '[data-testid="wizard-v2-modal"] button:has-text("Start Report")'
    );
    if (await startReportInModal.count() > 0) {
      await startReportInModal.click({ timeout: 5_000 });
      await page.waitForTimeout(600);
    }

    // ── Step 1 → Next ─────────────────────────────────────────────────────
    // Advance past StepProspecting to reach StepSeminarsTradeshows (step 2)
    const nextBtn = page.locator('[data-testid="wizard-v2-next"]');
    await nextBtn.click({ timeout: 10_000 });
    await page.waitForTimeout(800);

    // ── Leg 1: shape check ─────────────────────────────────────────────────
    const bodyText = await page.locator('[data-testid="wizard-v2-modal"]').textContent() ?? '';

    for (const label of PRESENT_LABELS) {
      if (bodyText.includes(label)) {
        pass(`shape-present: "${label}"`);
      } else {
        fail(`shape-present: "${label}"`, `"${label}" MISSING from wizard step`);
      }
    }

    for (const label of ABSENT_LABELS) {
      if (!bodyText.includes(label)) {
        pass(`shape-absent: "${label}"`);
      } else {
        fail(`shape-absent: "${label}"`, `"${label}" should be absent but found`);
      }
    }

    // ── Leg 2: card descriptions ───────────────────────────────────────────
    const seminarsDesc  = 'Seminars you conducted and names collected.';
    const tradeshowDesc = 'Tradeshows you attended and names collected.';
    if (bodyText.includes(seminarsDesc))  pass('card-desc-seminars',   'correct');
    else                                   fail('card-desc-seminars',   'wrong desc text');
    if (bodyText.includes(tradeshowDesc)) pass('card-desc-tradeshows', 'correct');
    else                                   fail('card-desc-tradeshows', 'wrong desc text');

    // ── Leg 3: fill names fields + assert NAMES scorecard ─────────────────
    // namesFromSeminarsConducted=4 + namesFromTradeshowsAttended=5 → NAMES=9
    const fillField = async (id, value) => {
      const input = page.locator(`input[id="${id}"]`);
      await input.scrollIntoViewIfNeeded().catch(() => {});
      await input.click({ clickCount: 3 }).catch(() => {});
      await input.fill(String(value));
      await page.waitForTimeout(200);
    };

    await fillField('namesFromSeminarsConducted', 4);
    await fillField('namesFromTradeshowsAttended', 5);
    await page.waitForTimeout(600); // let live compute settle

    const namesCard = page.locator('[data-testid="wizard-v2-week-so-far-card-names-value"]');
    const namesText = (await namesCard.textContent({ timeout: 5_000 }).catch(() => null)) ?? '';
    const namesVal  = parseInt(namesText.replace(/[^0-9]/g, ''), 10);

    if (namesVal === 9) {
      pass('names-scorecard-9', '5-channel formula live: namesFromSeminarsConducted(4) + namesFromTradeshowsAttended(5) = 9');
    } else {
      fail('names-scorecard-9', `NAMES scorecard = "${namesText}" (expected 9 — 5-channel formula broken)`);
    }

    // ── Leg 4: no console errors ───────────────────────────────────────────
    // Filter: fontshare.com (CDN noise) + "Missing or insufficient permissions"
    // (pre-existing background Firestore listener on dashboard, not wizard-related)
    const consoleErrors = cap.consoleMessages.filter(
      (m) => m.type === 'error'
        && !m.text.includes('fontshare.com')
        && !m.text.includes('Missing or insufficient permissions')
    );
    if (consoleErrors.length === 0) {
      pass('no-console-errors', '0 wizard-related console errors');
    } else {
      fail('no-console-errors', `${consoleErrors.length} error(s): ${consoleErrors.map((e) => e.text).join('; ')}`);
    }

  } catch (err) {
    fail('unexpected-error', err.message);
  } finally {
    console.log(formatCaptureReport(cap));
    await browser.close();
  }

  return results;
}

async function main() {
  const { clear } = installGlobalTimeout(120_000, () => {
    console.error('Global timeout — smoke did not finish in 2 min');
    process.exit(1);
  });

  console.log(`\n=== seminars-tradeshows-wirein smoke — ${BASE_URL} ===\n`);

  const allResults = [];

  for (const theme of ['light', 'dark']) {
    console.log(`\n── ${theme} ──`);
    const r = await runTheme(theme);
    allResults.push(...r.map((x) => ({ ...x, label: `[${theme}] ${x.label}` })));
  }

  finishSmoke(allResults, { clearTimeout: clear });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
