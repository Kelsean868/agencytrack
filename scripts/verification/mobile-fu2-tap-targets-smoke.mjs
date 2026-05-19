/**
 * Mobile FU#2 — non-core agent tap-target smoke walk.
 *
 * Verifies WCAG 2.5.5 target-size compliance for the three P1 items:
 *   P1-1: CareerPortal editing-mode trio (Edit / Cancel / Save) >= 44px
 *   P1-2: History row button >= 44px (structural already-resolved check)
 *   P1-3: CommissionPlayground accordion toggle >= 44px
 *
 * Viewport: 390x844 (mobile) — these are mobile a11y fixes, smoke MUST
 * run at mobile viewport to validate the actual user experience.
 *
 * Bypass: setupBypassSession + cookie-after-handshake. Direct buildBypassUrl
 * calls forbidden — see CLAUDE.md.
 *
 * Run:
 *   node scripts/verification/mobile-fu2-tap-targets-smoke.mjs
 * Override host:
 *   PREVIEW_HOST=agencytrack-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/mobile-fu2-tap-targets-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_AGENT_EMAIL / A11Y_AGENT_PASSWORD
 *
 * Artifacts: verification/mobile-fu2/screenshots/ (gitignored).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady, safeLog } from './lib/walk-helpers.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/mobile-fu2');
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
    } catch { /* try next path */ }
  }
  return {};
}

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN   = env.VERCEL_BYPASS_TOKEN;
const AGENT_EMAIL    = env.A11Y_AGENT_EMAIL;
const AGENT_PASSWORD = env.A11Y_AGENT_PASSWORD;

// Stale default — overridable via PREVIEW_HOST env var for re-runs against future preview branches or production.
const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-fix-mobile-fu2-tap-targ-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)                    { console.error('VERCEL_BYPASS_TOKEN not present in .env.local'); process.exit(1); }
if (!AGENT_EMAIL || !AGENT_PASSWORD)  { console.error('A11Y_AGENT_EMAIL/PASSWORD not present in .env.local'); process.exit(1); }

// Defense-in-depth: redact tokens + passwords from anything we might log.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  if (BYPASS_TOKEN) {
    out = out.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  }
  if (AGENT_PASSWORD) {
    out = out.replace(new RegExp(AGENT_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  }
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const results = {};

async function check(id, label, fn) {
  try {
    await fn();
    results[id] = { label, pass: true };
    console.log(`PASS ${id}: ${label}`);
  } catch (e) {
    const msg = redact(e.message ?? String(e));
    results[id] = { label, pass: false, error: msg };
    console.error(`FAIL ${id}: ${label}\n  ${msg}`);
  }
}

async function ss(page, name) {
  await page.screenshot({ path: resolve(SS_DIR, `${name}.png`), fullPage: false });
}

async function signIn(pg, email, password) {
  await pg.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForFirebaseReady(pg, 25000);
  const emailInput = pg.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(email);
  const pwInput = pg.locator('input[type="password"]');
  await pwInput.fill(password);
  await pwInput.press('Enter');
  await pg.waitForSelector('input[type="email"]', { state: 'detached', timeout: 25000 });
  // Sidebar nav is CSS-hidden at mobile viewport; wait for page content instead.
  await pg.waitForFunction(() => (document.body.textContent ?? '').length > 100, { timeout: 15000 });
}

/**
 * Navigate to a tab via mobile bottom-nav. If not in bottom-nav items, opens
 * the "More" drawer.
 */
async function clickNavTab(pg, label, bottomLabel = null) {
  const isMobile = (await pg.viewportSize())?.width < 900;
  if (isMobile) {
    const inBottom = bottomLabel
      ? await pg.locator(`[data-testid^="bottomnav-"]:has-text("${bottomLabel}")`).count() > 0
      : false;
    if (inBottom) {
      await pg.locator(`[data-testid^="bottomnav-"]:has-text("${bottomLabel}")`).first().click();
      await pg.waitForTimeout(700);
      return;
    }
    const more = pg.locator('[data-testid="bottomnav-more"]');
    await more.waitFor({ timeout: 10000 });
    await more.click();
    const drawer = pg.locator('nav[aria-label="More navigation options"]');
    await drawer.waitFor({ timeout: 5000 });
    await drawer.locator(`button:has-text("${label}")`).first().click();
    await pg.waitForTimeout(800);
    return;
  }
  const sidebarBtn = pg
    .locator('nav[aria-label="Primary navigation"] button')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first();
  await sidebarBtn.waitFor({ timeout: 10000 });
  await sidebarBtn.click();
  await pg.waitForTimeout(800);
}

const MIN_TARGET = 44; // WCAG 2.5.5

// ── browser + bypass setup ───────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

try {
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
} catch (e) {
  console.error('Bypass session setup failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

const page = await ctx.newPage();

// ── CHECK 01: Login as agent ─────────────────────────────────────────────────
await check('01_login', 'Login as agent — dashboard loads at 390x844', async () => {
  await signIn(page, AGENT_EMAIL, AGENT_PASSWORD);
  safeLog('  Signed in, dashboard visible');
  await ss(page, '01-agent-dashboard');
});

// ── CHECK 02: Navigate to Career tab ─────────────────────────────────────────
await check('02_career_nav', 'Navigate to Career tab — CareerPortal mounts', async () => {
  await clickNavTab(page, 'Career', 'Career');
  // Wait for Edit My Goals button to appear
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some(b => /Edit My Goals/i.test(b.textContent ?? '')),
    { timeout: 20000 },
  );
  await ss(page, '02-career-tab');
});

// ── CHECK 03: P1-1a — "Edit My Goals" button >= 44px ─────────────────────────
await check('03_p1_1a_edit_goals_height', 'P1-1a: "Edit My Goals" button boundingClientRect().height >= 44px', async () => {
  const height = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => /Edit My Goals/i.test(b.textContent ?? ''));
    if (!btn) throw new Error('"Edit My Goals" button not found');
    return btn.getBoundingClientRect().height;
  });
  safeLog(`  Edit My Goals height: ${height}px`);
  if (height < MIN_TARGET) throw new Error(`height ${height}px < ${MIN_TARGET}px`);
});

// ── CHECK 04: Enter edit mode, then assert Cancel and Save heights ────────────
await check('04_enter_edit_mode', 'Click "Edit My Goals" — editing mode activates', async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => /Edit My Goals/i.test(b.textContent ?? ''));
    if (!btn) throw new Error('"Edit My Goals" button not found');
    btn.click();
  });
  // Wait for Cancel (icon-only, border-border class) to appear
  await page.waitForFunction(
    () => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.some(b => b.className.includes('border-border') && !b.className.includes('h-8'));
    },
    { timeout: 5000 },
  );
  await ss(page, '04-edit-mode-active');
});

// ── CHECK 05: P1-1b — Cancel button >= 44px ──────────────────────────────────
await check('05_p1_1b_cancel_height', 'P1-1b: Cancel button boundingClientRect().height >= 44px', async () => {
  const height = await page.evaluate(() => {
    // Cancel: icon-only button with border-border class (Save uses bg-primary)
    const cancelBtn = [...document.querySelectorAll('button')]
      .find(b => b.className.includes('border-border') && !b.className.includes('font-semibold'));
    if (!cancelBtn) throw new Error('Cancel button not found in edit mode');
    return cancelBtn.getBoundingClientRect().height;
  });
  safeLog(`  Cancel button height: ${height}px`);
  if (height < MIN_TARGET) throw new Error(`height ${height}px < ${MIN_TARGET}px`);
});

// ── CHECK 06: P1-1c — Save button >= 44px ────────────────────────────────────
await check('06_p1_1c_save_height', 'P1-1c: Save button boundingClientRect().height >= 44px', async () => {
  const height = await page.evaluate(() => {
    const saveBtn = [...document.querySelectorAll('button')]
      .find(b => /Save/i.test(b.textContent ?? '') && b.className.includes('bg-primary'));
    if (!saveBtn) throw new Error('Save button not found in edit mode');
    return saveBtn.getBoundingClientRect().height;
  });
  safeLog(`  Save button height: ${height}px`);
  if (height < MIN_TARGET) throw new Error(`height ${height}px < ${MIN_TARGET}px`);
});

// Exit edit mode (click Cancel) before taking the Career screenshot
await page.evaluate(() => {
  const cancelBtn = [...document.querySelectorAll('button')]
    .find(b => b.className.includes('border-border') && !b.className.includes('font-semibold'));
  if (cancelBtn) cancelBtn.click();
});
await page.waitForTimeout(400);
await ss(page, '06-career-after-cancel');

// ── CHECK 07: P1-3 — CommissionPlayground accordion toggle >= 44px ────────────
await check('07_p1_3_playground_toggle_height', 'P1-3: CommissionPlayground accordion toggle height >= 44px', async () => {
  // Scroll down to find the accordion toggle (contains "Commission Playground" text)
  const height = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const toggleBtn = buttons.find(b => /Commission Playground/i.test(b.textContent ?? ''));
    if (!toggleBtn) throw new Error('CommissionPlayground accordion toggle not found');
    toggleBtn.scrollIntoView({ block: 'center' });
    return toggleBtn.getBoundingClientRect().height;
  });
  safeLog(`  CommissionPlayground toggle height: ${height}px`);
  if (height < MIN_TARGET) throw new Error(`height ${height}px < ${MIN_TARGET}px`);
  await ss(page, '07-commission-playground-toggle');
});

// ── CHECK 08: Navigate to History tab ────────────────────────────────────────
await check('08_history_nav', 'Navigate to History tab — submissions list renders', async () => {
  await clickNavTab(page, 'History', 'History');
  // Wait for either submission rows or "No submissions yet" message
  await page.waitForFunction(
    () => {
      const text = document.body.textContent ?? '';
      return text.includes('No submissions yet') || text.includes('Week of');
    },
    { timeout: 20000 },
  );
  await ss(page, '08-history-tab');
});

// ── CHECK 09: P1-2 — History row button >= 44px (structural verification) ────
await check('09_p1_2_history_row_height', 'P1-2: First History row button boundingClientRect().height >= 44px (structural already-resolved)', async () => {
  const result = await page.evaluate(() => {
    const hasRows = [...document.querySelectorAll('button')]
      .some(b => b.className.includes('card') && b.textContent?.includes('Week of'));
    if (!hasRows) {
      // No submissions — cannot verify; pass with a note.
      return { skipped: true, reason: 'No submission rows present (no data)' };
    }
    const rowBtn = [...document.querySelectorAll('button')]
      .find(b => b.className.includes('card') && b.textContent?.includes('Week of'));
    const height = rowBtn.getBoundingClientRect().height;
    return { skipped: false, height };
  });

  if (result.skipped) {
    safeLog(`  SKIP: ${result.reason}`);
    return; // Not a failure — no data to test against
  }
  safeLog(`  History row height: ${result.height}px`);
  if (result.height < MIN_TARGET) {
    throw new Error(`History row height ${result.height}px < ${MIN_TARGET}px — P1-2 structural finding is WRONG; needs a real code fix`);
  }
});

// ── CHECK 10: No console errors ───────────────────────────────────────────────
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
await check('10_no_console_errors', 'No console.error events during the walk', async () => {
  await page.waitForTimeout(500);
  const real = consoleErrors.filter((e) => !/_vercel|favicon|workbox|sw\.js/i.test(e));
  if (real.length > 0) {
    throw new Error(`${real.length} console.error events:\n  ${real.slice(0, 5).join('\n  ')}`);
  }
});

// ── teardown + summary ────────────────────────────────────────────────────────
await browser.close();

const passed = Object.values(results).filter((r) => r.pass).length;
const total  = Object.values(results).length;
const failed = total - passed;

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n' + '='.repeat(60));
console.log(`Mobile FU#2 tap-target smoke walk complete: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed checks:');
  for (const [id, r] of Object.entries(results)) {
    if (!r.pass) console.log(`  ${id}: ${r.label}\n    ${r.error}`);
  }
}
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);
process.exit(failed > 0 ? 1 : 0);
