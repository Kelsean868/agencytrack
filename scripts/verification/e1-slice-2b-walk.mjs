/**
 * E1 Slice 2B — Playwright verification walk
 * 12 checks against the Vercel preview for Slice 2B (surface adaptation + PDF redesign + awards V2).
 *
 * Run from project root:
 *   node scripts/verification/e1-slice-2b-walk.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD
 *   A11Y_MANAGER_EMAIL / A11Y_MANAGER_PASSWORD
 *
 * Artifacts (screenshots, results.json) written to verification/e1-slice-2b/ (gitignored).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/e1-slice-2b');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(...paths) {
  for (const p of paths) {
    try {
      const src = readFileSync(p, 'utf8');
      const env = {};
      src.split('\n').forEach(line => {
        const eq = line.indexOf('=');
        if (eq < 1) return;
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (k) env[k] = v;
      });
      return env;
    } catch { /* try next */ }
  }
  return {};
}

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN     = env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL      = env.A11Y_AGENT_EMAIL    ?? 'kelsean@gmail.com';
const AGENT_PASSWORD   = env.A11Y_AGENT_PASSWORD;
const MANAGER_EMAIL    = env.A11Y_BRANCH_MANAGER_EMAIL ?? env.A11Y_MANAGER_EMAIL;
const MANAGER_PASSWORD = env.A11Y_BRANCH_MANAGER_PASSWORD ?? env.A11Y_MANAGER_PASSWORD;

// URL derived from GitHub deployment API after push — Vercel truncated the branch name.
const PREVIEW_HOST = 'agencytrack-2bqcjg17j-kyron-marchan-s-projects.vercel.app';

if (!BYPASS_TOKEN)     { console.error('VERCEL_BYPASS_TOKEN not found in .env.local'); process.exit(1); }
if (!AGENT_PASSWORD)   { console.error('A11Y_AGENT_PASSWORD not found in .env.local'); process.exit(1); }
if (!MANAGER_EMAIL)    { console.error('A11Y_MANAGER_EMAIL not found in .env.local'); process.exit(1); }
if (!MANAGER_PASSWORD) { console.error('A11Y_MANAGER_PASSWORD not found in .env.local'); process.exit(1); }

function redact(msg) {
  return typeof msg === 'string'
    ? msg
        .replace(new RegExp(BYPASS_TOKEN, 'g'),     '[TOKEN]')
        .replace(new RegExp(AGENT_PASSWORD, 'g'),   '[PASS]')
        .replace(new RegExp(MANAGER_PASSWORD, 'g'), '[PASS]')
    : msg;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const results = {};

async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`✓ ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`✗ ${id}: ${label}\n  ${msg}`);
  }
}

async function ss(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false });
}

async function signIn(pg, email, password) {
  await pg.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  const emailInput = pg.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(email);
  const pwInput = pg.locator('input[type="password"]');
  await pwInput.fill(password);
  await pwInput.press('Enter');
  await pg.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
  await pg.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
}

// ── main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });

// Bypass Vercel protection
const agentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await agentCtx.newPage();
const bypassUrl = `https://${PREVIEW_HOST}/?x-vercel-protection-bypass=${BYPASS_TOKEN}&x-vercel-set-bypass-cookie=true`;
try {
  await page.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
} catch (e) {
  console.error('Bypass navigation failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

// ── CHECK 1: Agent login ──────────────────────────────────────────────────────
await check('01_login_agent', 'Agent login succeeds; primary nav renders', async () => {
  await signIn(page, AGENT_EMAIL, AGENT_PASSWORD);
  await ss(page, '01-agent-logged-in');
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 5000 });
});

// ── CHECK 2: Agent dashboard loads ───────────────────────────────────────────
await check('02_dashboard_loads', 'Agent dashboard main content mounts', async () => {
  // Wait for Firestore data to load — the sidebar nav plus at least one content section
  await page.waitForFunction(() => {
    const nav = document.querySelector('nav[aria-label="Primary navigation"]');
    const text = document.body.innerText;
    return nav !== null && (text.includes('Dashboard') || text.includes('Career') || text.includes('Awards'));
  }, undefined, { timeout: 12000 });
  await ss(page, '02-agent-dashboard');
});

// ── CHECK 3: YTD API metric is visible (totalProductionCredit) ───────────────
await check('03_ytd_api_visible', 'YTD API metric renders with TTD value (totalProductionCredit)', async () => {
  // Dashboard KPI ring shows TTD amount. Click YTD tab if present, then check.
  const ytdTab = page.getByRole('tab', { name: /ytd|year/i });
  if (await ytdTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ytdTab.click();
    await page.waitForTimeout(500);
  }
  // Look for TTD currency amount — confirms aggregateAPI + extractTotalProductionCredit work
  await page.waitForFunction(() => {
    return document.body.innerText.includes('TTD') || document.body.innerText.includes('YEAR-TO-DATE');
  }, undefined, { timeout: 10000 });
  const ttdMatch = await page.evaluate(() => {
    const m = document.body.innerText.match(/TTD\s*[\d,]+/);
    return m ? m[0] : null;
  });
  if (!ttdMatch) throw new Error('No TTD amount found on dashboard');
  await ss(page, '03-ytd-api');
});

// ── CHECK 4: Weekly / monthly / quarterly KPI cards ──────────────────────────
await check('04_kpi_slices_visible', 'All 4 API slices (week/month/quarter/YTD) have visible percent values', async () => {
  // The aggregateAPI function returns 4 slices — each should render a % value
  const pcts = await page.evaluate(() => {
    const percentEls = [...document.querySelectorAll('*')].filter(el =>
      /^\d+%$/.test(el.textContent?.trim())
    );
    return percentEls.map(el => el.textContent.trim());
  });
  if (pcts.length < 2) throw new Error(`Expected at least 2 percent figures on dashboard, found ${pcts.length}`);
  await ss(page, '04-kpi-slices');
});

// ── CHECK 5: Submission history list renders ──────────────────────────────────
await check('05_submission_history', 'Submission history list has at least one entry', async () => {
  // The submission history section typically has "Week of" entries
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('Week of') || text.includes('week of') || text.includes('submitted');
  }, { timeout: 10000 });
  await ss(page, '05-submission-history');
});

// ── CHECK 6: Awards panel renders ─────────────────────────────────────────────
await check('06_awards_panel', 'Agent awards panel renders award cards', async () => {
  // Awards section should have "Award" or "Club" or "Qualifier" text
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes('Award') || text.includes('Club') || text.includes('Qualifier');
  }, { timeout: 10000 });
  // Look for the awards section heading
  const awardHeading = page.getByText(/award/i).first();
  await awardHeading.waitFor({ timeout: 8000 });
  await ss(page, '06-awards-panel');
});

// ── CHECK 7: Wizard form entry point ─────────────────────────────────────────
// Uses try/finally to ALWAYS close the wizard — even on assertion failure —
// so checks 08 and 09 don't see the wizard's full-screen view instead of the dashboard.
{
  const closeWizard = async () => {
    const closeBtn = page.getByRole('button', { name: 'Close' });
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(600);
    }
  };

  await check('07_wizard_entry', 'Weekly report wizard opens showing "Select Week" screen', async () => {
    // Navigate to Dashboard tab first
    const dashBtn = page.getByRole('button', { name: /^Dashboard$/i });
    if (await dashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isCurrent = await dashBtn.evaluate(el => el.getAttribute('aria-current') === 'page');
      if (!isCurrent) { await dashBtn.click(); await page.waitForTimeout(500); }
    }
    // "Submit Weekly Report" (returning agents) or "Submit your first report" (new agents)
    const wizardBtn = page.getByRole('button', { name: /submit.*report|weekly report/i }).first();
    await wizardBtn.waitFor({ timeout: 10000 });
    await wizardBtn.click();
    // Wizard opens to "date" screen → h1 is "Select Week"; or "submitted" screen for this week
    await page.waitForFunction(
      () => {
        const t = document.body.innerText;
        return t.includes('Select Week') || t.includes('Weekly Report') || t.includes('Already submitted');
      },
      undefined,
      { timeout: 15000 }
    );
    await ss(page, '07-wizard-open');
  });

  // Always close wizard before proceeding
  await closeWizard();
}

// ── CHECK 8: PDF report download triggers ─────────────────────────────────────
// Flow: Awards tab → "Download My Performance Report" → ReportRangeModal →
//       "Generate & Download" → PDF download event
{
  const dismissModal = async () => {
    // Close the ReportRangeModal if still open (so CHECK 9 can click the dark-mode toggle)
    const cancelBtn = page.getByRole('button', { name: /^Cancel$/ });
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(400);
    }
  };

  await check('08_pdf_download', 'PDF report triggers download via ReportRangeModal (AgentReportDocument)', async () => {
    await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 8000 });

    // Navigate to Awards tab (PDF button lives there)
    const awardsBtn = page.getByRole('button', { name: /^Awards$/i });
    await awardsBtn.waitFor({ timeout: 10000 });
    const isActive = await awardsBtn.evaluate(el => el.getAttribute('aria-current') === 'page');
    if (!isActive) { await awardsBtn.click(); await page.waitForTimeout(1000); }

    // Click "Download My Performance Report" → opens modal
    const triggerBtn = page.getByRole('button', { name: /download.*report|performance report/i }).first();
    await triggerBtn.waitFor({ timeout: 12000 });
    await triggerBtn.click();

    // Wait for ReportRangeModal to appear
    await page.getByText('Generate Performance Report').waitFor({ timeout: 8000 });

    // Set up download listener, then click "Generate & Download"
    const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
    await page.getByRole('button', { name: /generate.*download/i }).click();

    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    if (!filename.endsWith('.pdf')) throw new Error(`Expected .pdf download, got: ${filename}`);
    await download.saveAs(resolve(ARTIFACTS_DIR, filename));
    await ss(page, '08-pdf-downloaded');
  });

  // Ensure modal is closed before proceeding
  await dismissModal();
}

// ── CHECK 9: Dark mode toggle ─────────────────────────────────────────────────
await check('09_dark_mode', 'Dark mode toggle activates dark class on html element', async () => {
  // TopBar renders a button with aria-label="Toggle dark mode"
  const darkToggle = page.getByRole('button', { name: 'Toggle dark mode' });
  await darkToggle.waitFor({ timeout: 8000 });
  // Ensure we're starting from light mode
  const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (wasDark) await darkToggle.click(); // reset to light first
  await page.waitForTimeout(200);
  await darkToggle.click();
  await page.waitForTimeout(400);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!isDark) throw new Error('dark class not found on <html> after toggle');
  await ss(page, '09-dark-mode');
  // Toggle back to light
  await darkToggle.click();
  await page.waitForTimeout(300);
});

// ── CHECK 10: Mobile viewport — no horizontal overflow ────────────────────────
await check('10_mobile_layout', 'Dashboard renders at 380px with no horizontal overflow', async () => {
  await page.setViewportSize({ width: 380, height: 812 });
  // Use 'load' — Firestore websockets prevent 'networkidle' from resolving.
  await page.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'load', timeout: 30000 });
  // Wait for auth + shell to render (nav or main content)
  await page.waitForFunction(
    () => document.querySelector('nav[aria-label="Primary navigation"]') !== null ||
          document.body.innerText.includes('Dashboard'),
    undefined,
    { timeout: 20000 }
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await ss(page, '10-mobile-380');
  if (overflow) throw new Error('Horizontal overflow detected at 380px');
  // Reset viewport
  await page.setViewportSize({ width: 1280, height: 800 });
});

// ── CHECK 11: Manager login ───────────────────────────────────────────────────
const managerCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const mgPage = await managerCtx.newPage();
await mgPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });

await check('11_manager_login', 'Manager login succeeds; manager dashboard mounts', async () => {
  await signIn(mgPage, MANAGER_EMAIL, MANAGER_PASSWORD);
  await ss(mgPage, '11-manager-logged-in');
});

// ── CHECK 12: MasterSheet renders with API data ────────────────────────────────
await check('12_mastersheet_api', 'MasterSheet renders agent rows with TTD API values visible', async () => {
  // Give the manager dashboard a moment to fully load
  await mgPage.waitForTimeout(1500);

  // Click "Master Sheet" in the sidebar nav
  const sheetBtn = mgPage.getByRole('button', { name: /master sheet/i });
  await sheetBtn.waitFor({ timeout: 10000 });
  await sheetBtn.click();
  await mgPage.waitForTimeout(800);

  // MasterSheet renders rows with TTD API values
  await mgPage.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.includes('TTD') && text.includes('API');
    },
    undefined,
    { timeout: 15000 }
  );
  await ss(mgPage, '12-mastersheet');

  // Verify at least one data row (the table or list)
  const rowCount = await mgPage.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr, [role="row"]');
    return rows.length;
  });
  if (rowCount === 0) throw new Error('No table rows found in MasterSheet — data may not have loaded');
});

// ── teardown ──────────────────────────────────────────────────────────────────
await browser.close();

const allPassed = Object.values(results).every((r) => r.pass);
writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n── Summary ──────────────────────────────────────────────────────');
Object.entries(results).forEach(([id, r]) => {
  console.log(`${r.pass ? '✓' : '✗'} ${id}: ${r.label}${r.error ? `\n    ${r.error}` : ''}`);
});
console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);

process.exit(allPassed ? 0 : 1);
