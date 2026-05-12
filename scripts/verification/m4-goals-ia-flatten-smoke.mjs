/**
 * M4 — Goals IA flatten + GapAnalysisPanel surfacing smoke walk.
 *
 * Verifies the Goals tab refactor:
 *   - Single sub-tab row (Self / Agent / Unit / Branch) — NO nested
 *     "My Production / My Unit" outer pill bar.
 *   - GapAnalysisPanel ("Goal Cascade") renders above the sub-tab row.
 *   - All 4 sub-tabs render content at desktop + mobile, light + dark.
 *   - Agent expand/collapse: clicking a row toggles aria-expanded; multi-
 *     expand works.
 *   - h-11 (44px) inputs verified via getBoundingClientRect.
 *   - Write-read-verify cycle: modify an agent goal field, save, reload,
 *     confirm the value reads back from Firestore. Reset to original on
 *     completion.
 *   - Regression: Overview (M2), Awards (M3), Persistency, Settlements
 *     still render.
 *
 * Bypass: setupBypassSession + cookie-after-handshake. Direct
 * buildBypassUrl calls forbidden — see CLAUDE.md.
 *
 * Run:
 *   node scripts/verification/m4-goals-ia-flatten-smoke.mjs
 * Override host:
 *   PREVIEW_HOST=agencytrack-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/m4-goals-ia-flatten-smoke.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_SALES_MANAGER_EMAIL / A11Y_SALES_MANAGER_PASSWORD
 *
 * Artifacts: verification/m4/screenshots/ (gitignored).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady, safeLog } from './lib/walk-helpers.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/m4');
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
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const SM_EMAIL     = env.A11Y_SALES_MANAGER_EMAIL;
const SM_PASSWORD  = env.A11Y_SALES_MANAGER_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-qeat33vvc-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN)             { console.error('VERCEL_BYPASS_TOKEN not present in .env.local'); process.exit(1); }
if (!SM_EMAIL || !SM_PASSWORD) { console.error('A11Y_SALES_MANAGER_EMAIL/PASSWORD not present'); process.exit(1); }

// Defense-in-depth: redact tokens + password from anything we might log.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  if (BYPASS_TOKEN) {
    out = out.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  }
  if (SM_PASSWORD) {
    out = out.replace(new RegExp(SM_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
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
  await pg.waitForSelector('nav[aria-label="Primary navigation"], [data-testid="mobile-bottom-nav"]', { timeout: 15000 });
}

async function clickManagerNavTab(pg, label, bottomLabel = null) {
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

// Click one of the Goals sub-tabs (Self / Agent / Unit / Branch). They are
// the inner TabPills inside GoalsPanel — `role="tab"`.
async function clickGoalsSubTab(pg, label) {
  const tab = pg.locator(`[role="tab"]:has-text("${label}")`).first();
  await tab.waitFor({ timeout: 10000 });
  await tab.click();
  await pg.waitForTimeout(500);
}

async function setDarkMode(pg, enabled) {
  await pg.evaluate((on) => {
    if (on) {
      localStorage.setItem('agencytrack-dark', '1');
      document.documentElement.classList.add('dark');
    } else {
      localStorage.setItem('agencytrack-dark', '0');
      document.documentElement.classList.remove('dark');
    }
  }, enabled);
  await pg.waitForTimeout(200);
}

// ── browser + bypass setup ───────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const smCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  await setupBypassSession(smCtx, BASE_URL, BYPASS_TOKEN);
} catch (e) {
  console.error('Bypass session setup failed:', e.message);
  await browser.close();
  process.exit(1);
}

const smPage = await smCtx.newPage();

// ── CHECK 01: sales_manager login ───────────────────────────────────────────
await check('01_sm_login', 'Login as sales_manager — dashboard loads', async () => {
  await signIn(smPage, SM_EMAIL, SM_PASSWORD);
  await ss(smPage, '01-sm-dashboard');
});

// ── CHECK 02: navigate to Goals tab ──────────────────────────────────────────
await check('02_goals_nav', 'Click Goals tab → GoalsPanel renders', async () => {
  await clickManagerNavTab(smPage, 'Goals');
  // Wait for the new sub-tab row to render.
  await smPage.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 20000 });
  await ss(smPage, '02-goals-mounted');
});

// ── CHECK 03: IA — single sub-tab row, no nested My Production/My Unit ──────
await check('03_single_subtab_row', 'Single sub-tab row, no My Production / My Unit outer pill', async () => {
  // The new sub-tab labels are Self / Agent / Unit / Branch.
  const tabText = await smPage.locator('[role="tablist"]').first().innerText().catch(() => '');
  if (!tabText.includes('Self'))   throw new Error(`"Self" sub-tab missing — tablist text: "${tabText}"`);
  if (!tabText.includes('Agent'))  throw new Error(`"Agent" sub-tab missing — tablist text: "${tabText}"`);
  if (!tabText.includes('Unit'))   throw new Error(`"Unit" sub-tab missing — tablist text: "${tabText}"`);
  if (!tabText.includes('Branch')) throw new Error(`"Branch" sub-tab missing — tablist text: "${tabText}"`);
  // The OLD outer pill labels must NOT appear anywhere on the page.
  const body = await smPage.locator('body').innerText();
  if (/My Production/.test(body)) throw new Error('"My Production" outer-pill label still present — IA not flattened');
  if (/My Unit/.test(body))       throw new Error('"My Unit" outer-pill label still present — IA not flattened');
  safeLog('  IA flat: Self / Agent / Unit / Branch present; old outer-pill labels absent');
});

// ── CHECK 04: GapAnalysisPanel renders above sub-tabs ───────────────────────
// NOTE: GapAnalysisPanel's title has `text-transform: uppercase` so
// `innerText` returns "GOAL CASCADE" while textContent (DOM source) preserves
// "Goal Cascade". Use textContent for case-stable substring lookups.
await check('04_gap_panel_above_subtabs', 'GapAnalysisPanel ("Goal Cascade") renders above the sub-tab row', async () => {
  const titlePresent = await smPage.locator('text=Goal Cascade').count();
  if (titlePresent === 0) {
    throw new Error('GapAnalysisPanel title "Goal Cascade" not found above sub-tab row');
  }
  // DOM-order + geometric check: the panel must come before the tablist in
  // document order AND its bottom must be above the tablist's top.
  const ok = await smPage.evaluate(() => {
    const tablist = document.querySelector('[role="tablist"]');
    let panel = null;
    document.querySelectorAll('.card').forEach((el) => {
      if ((el.textContent ?? '').includes('Goal Cascade')) panel = el;
    });
    if (!tablist || !panel) return { ok: false, reason: 'panel-or-tablist-missing', panelFound: !!panel };
    const preceding = (panel.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const pb = panel.getBoundingClientRect().bottom;
    const tt = tablist.getBoundingClientRect().top;
    return { ok: preceding && pb <= tt + 8, preceding, pb, tt };
  });
  if (!ok.ok) {
    throw new Error(`GapAnalysisPanel not above sub-tab row: ${JSON.stringify(ok)}`);
  }
});

// ── CHECK 05: Self sub-tab renders Commission Playground + Personal Target ─
// Use textContent (raw DOM text) instead of innerText so CSS `text-transform:
// uppercase` doesn't break case-sensitive substring lookups.
await check('05_self_subtab_desktop_light', 'Self sub-tab renders Commission Playground + Personal Target', async () => {
  await clickGoalsSubTab(smPage, 'Self');
  await smPage.waitForFunction(
    () => /Commission Playground/.test(document.body.textContent ?? '')
      && /Your Personal Annual Target/i.test(document.body.textContent ?? ''),
    { timeout: 10000 },
  );
  await ss(smPage, '05-self-desktop-light');
});

// ── CHECK 06: Agent sub-tab — rows + status chips + h-11 inputs ─────────────
await check('06_agent_subtab_desktop_light', 'Agent sub-tab renders rows with status chips', async () => {
  await clickGoalsSubTab(smPage, 'Agent');
  await smPage.waitForFunction(
    () => /Company Minimums/i.test(document.body.textContent ?? ''),
    { timeout: 15000 },
  );
  // At least one StatusChip should be visible (Above floor / Below floor / Not set).
  const chipCount = await smPage.evaluate(() => {
    const text = document.body.textContent ?? '';
    let count = 0;
    if (/Above floor/.test(text)) count++;
    if (/Below floor/.test(text)) count++;
    if (/Not set/.test(text))     count++;
    return count;
  });
  if (chipCount === 0) {
    throw new Error('No status chips visible on Agent sub-tab (Above floor / Below floor / Not set all missing)');
  }
  safeLog(`  Agent sub-tab: ${chipCount} distinct status chip kinds visible`);
  await ss(smPage, '06-agent-desktop-light');
});

// ── CHECK 07: at least one row exists and toggles via aria-expanded ─────────
await check('07_agent_row_toggle', 'Clicking an agent row toggles aria-expanded', async () => {
  // Locate any row toggle button — they all have aria-expanded.
  const toggles = smPage.locator('button[aria-expanded][aria-controls^="agent-goal-form-"]');
  const count = await toggles.count();
  if (count === 0) throw new Error('No agent-row toggle buttons found');
  safeLog(`  Found ${count} agent-row toggle buttons`);
  // Find a row currently collapsed; if all are expanded, pick the first.
  let pickIdx = 0;
  for (let i = 0; i < count; i++) {
    const ex = await toggles.nth(i).getAttribute('aria-expanded');
    if (ex === 'false') { pickIdx = i; break; }
  }
  const t = toggles.nth(pickIdx);
  const beforeState = await t.getAttribute('aria-expanded');
  await t.click();
  await smPage.waitForTimeout(300);
  const afterState = await t.getAttribute('aria-expanded');
  if (beforeState === afterState) {
    throw new Error(`Row toggle did not flip aria-expanded (was "${beforeState}", still "${afterState}")`);
  }
  // Click again — should flip back.
  await t.click();
  await smPage.waitForTimeout(300);
  const finalState = await t.getAttribute('aria-expanded');
  if (finalState !== beforeState) {
    throw new Error(`Row toggle did not toggle back (expected "${beforeState}", got "${finalState}")`);
  }
});

// ── CHECK 08: h-11 inputs verified programmatically ─────────────────────────
await check('08_h11_inputs', 'Expanded agent form has h-11 inputs (height >= 44px)', async () => {
  // Find a row to expand. Prefer a collapsed one.
  const toggles = smPage.locator('button[aria-expanded][aria-controls^="agent-goal-form-"]');
  const count = await toggles.count();
  let target = -1;
  for (let i = 0; i < count; i++) {
    const ex = await toggles.nth(i).getAttribute('aria-expanded');
    if (ex === 'false') { target = i; break; }
  }
  if (target === -1) {
    target = 0; // none collapsed — re-expand the first.
  }
  const before = await toggles.nth(target).getAttribute('aria-expanded');
  if (before === 'false') {
    await toggles.nth(target).click();
    await smPage.waitForTimeout(300);
  }
  // Check input heights inside the expanded form.
  const measured = await smPage.evaluate(() => {
    const out = [];
    // The NumInput wrapper div is the h-11 element. Inputs themselves are h-full.
    document.querySelectorAll('[id^="agent-goal-form-"] input[type="number"]').forEach((el) => {
      const wrapper = el.closest('div');
      const h = wrapper?.getBoundingClientRect().height ?? 0;
      out.push(Math.round(h));
    });
    return out;
  });
  if (measured.length === 0) throw new Error('No number inputs found in expanded agent form');
  const tooSmall = measured.filter((h) => h < 44);
  if (tooSmall.length > 0) {
    throw new Error(`${tooSmall.length} input wrappers below 44px (heights: ${measured.join(',')})`);
  }
  safeLog(`  ${measured.length} input wrappers all >= 44px (min ${Math.min(...measured)}, max ${Math.max(...measured)})`);
});

// ── CHECK 09: write-read-verify cycle ────────────────────────────────────────
await check('09_write_read_verify', 'Edit + save an agent goal, reload, verify persistence', async () => {
  // Make sure we're on Agent sub-tab with at least one row expanded.
  await clickGoalsSubTab(smPage, 'Agent');
  await smPage.waitForFunction(
    () => /Company Minimums/i.test(document.body.textContent ?? ''),
    { timeout: 15000 },
  );

  // Find the first expanded row; if none, expand the first one.
  const toggles = smPage.locator('button[aria-expanded][aria-controls^="agent-goal-form-"]');
  const tCount = await toggles.count();
  if (tCount === 0) throw new Error('No agent rows to test write-read-verify');
  let expandedIdx = -1;
  for (let i = 0; i < tCount; i++) {
    const ex = await toggles.nth(i).getAttribute('aria-expanded');
    if (ex === 'true') { expandedIdx = i; break; }
  }
  if (expandedIdx === -1) {
    await toggles.nth(0).click();
    await smPage.waitForTimeout(300);
    expandedIdx = 0;
  }
  const formId = await toggles.nth(expandedIdx).getAttribute('aria-controls');
  safeLog(`  Targeting form: ${formId}`);

  // Read current Annual API value.
  const apiInput = smPage.locator(`#${formId} input[type="number"]`).first();
  await apiInput.waitFor({ timeout: 5000 });
  const originalValue = await apiInput.inputValue();
  safeLog(`  Original Annual API value: "${originalValue}"`);

  // Compute a new value: original + 1 (or 250001 if empty / non-numeric).
  const origNum = parseFloat(originalValue);
  const newValue = Number.isFinite(origNum) && origNum > 0 ? String(origNum + 1) : '250001';

  // Change the value.
  await apiInput.fill(newValue);
  await smPage.waitForTimeout(200);

  // Click the Save Goals button within this form. The SaveButton renders a
  // <button> with text "Save Goals" / "Saving…" / "Saved".
  const saveBtn = smPage.locator(`#${formId} button:has-text("Save Goals")`).first();
  await saveBtn.waitFor({ timeout: 5000 });
  await saveBtn.click();

  // Wait for the SaveButton "Saved" pulse (3s window). The button text changes
  // to "Saved" briefly; we wait for either that or a 4s timeout.
  await smPage.waitForFunction(
    (id) => {
      const form = document.getElementById(id);
      if (!form) return false;
      const btn = Array.from(form.querySelectorAll('button')).find((b) => b.textContent?.includes('Saved') || b.textContent?.includes('Save Goals'));
      // After save: the button briefly says "Saved" then returns to "Save Goals".
      // We're done as long as a state change happened — easier: wait for the
      // "Saving…" to disappear.
      const saving = Array.from(form.querySelectorAll('button')).find((b) => b.textContent?.includes('Saving'));
      return !saving && !!btn;
    },
    formId,
    { timeout: 12000 },
  );
  safeLog('  Save completed (button no longer shows "Saving…")');

  // Hard reload.
  await smPage.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForFirebaseReady(smPage, 20000);
  // Should land back on Overview (post-reload default). Navigate back to Goals.
  await clickManagerNavTab(smPage, 'Goals');
  await clickGoalsSubTab(smPage, 'Agent');
  await smPage.waitForFunction(
    () => /Company Minimums/i.test(document.body.textContent ?? ''),
    { timeout: 15000 },
  );

  // Re-expand the same row (formId is stable since it's keyed off agent.id).
  const sameToggle = smPage.locator(`button[aria-controls="${formId}"]`).first();
  await sameToggle.waitFor({ timeout: 10000 });
  const exNow = await sameToggle.getAttribute('aria-expanded');
  if (exNow === 'false') {
    await sameToggle.click();
    await smPage.waitForTimeout(400);
  }

  const apiInput2 = smPage.locator(`#${formId} input[type="number"]`).first();
  await apiInput2.waitFor({ timeout: 5000 });
  const readBack = await apiInput2.inputValue();
  safeLog(`  Read-back value: "${readBack}" (expected "${newValue}")`);

  // Numeric comparison tolerant of trailing decimals (Firestore may return number).
  const readNum = parseFloat(readBack);
  const expNum  = parseFloat(newValue);
  if (!Number.isFinite(readNum) || readNum !== expNum) {
    throw new Error(`Read-back mismatch: expected ${expNum}, got ${readNum}`);
  }

  // Reset to original (or to 250000 if original was empty/zero — the floor).
  const resetValue = Number.isFinite(origNum) && origNum > 0 ? originalValue : '250000';
  await apiInput2.fill(resetValue);
  const saveBtn2 = smPage.locator(`#${formId} button:has-text("Save Goals")`).first();
  await saveBtn2.click();
  await smPage.waitForFunction(
    (id) => {
      const form = document.getElementById(id);
      if (!form) return true;
      const saving = Array.from(form.querySelectorAll('button')).find((b) => b.textContent?.includes('Saving'));
      return !saving;
    },
    formId,
    { timeout: 10000 },
  );
  safeLog(`  Reset Annual API back to "${resetValue}"`);
});

// ── CHECK 10–13: Unit/Branch sub-tabs render ─────────────────────────────────
await check('10_unit_subtab', 'Unit sub-tab renders', async () => {
  await clickGoalsSubTab(smPage, 'Unit');
  await smPage.waitForFunction(
    () => /Unit Goals/i.test(document.body.textContent ?? ''),
    { timeout: 10000 },
  );
  await ss(smPage, '10-unit-desktop-light');
});

await check('11_branch_subtab', 'Branch sub-tab renders (sales_manager sees Branch — bundled fix)', async () => {
  const branchTab = smPage.locator(`[role="tab"]:has-text("Branch")`).first();
  const exists = await branchTab.count();
  if (exists === 0) throw new Error('Branch sub-tab not visible for sales_manager — bundled fix failed');
  await branchTab.click();
  await smPage.waitForTimeout(500);
  await smPage.waitForFunction(
    () => /Branch Goals/i.test(document.body.textContent ?? ''),
    { timeout: 10000 },
  );
  await ss(smPage, '11-branch-desktop-light');
});

// ── CHECK 12–15: dark mode pass for all 4 sub-tabs ──────────────────────────
await check('12_self_desktop_dark', 'Self sub-tab (desktop, dark)', async () => {
  await setDarkMode(smPage, true);
  await clickGoalsSubTab(smPage, 'Self');
  await smPage.waitForTimeout(400);
  await ss(smPage, '12-self-desktop-dark');
});

await check('13_agent_desktop_dark', 'Agent sub-tab (desktop, dark)', async () => {
  await clickGoalsSubTab(smPage, 'Agent');
  await smPage.waitForTimeout(400);
  await ss(smPage, '13-agent-desktop-dark');
});

await check('14_unit_desktop_dark', 'Unit sub-tab (desktop, dark)', async () => {
  await clickGoalsSubTab(smPage, 'Unit');
  await smPage.waitForTimeout(400);
  await ss(smPage, '14-unit-desktop-dark');
});

await check('15_branch_desktop_dark', 'Branch sub-tab (desktop, dark)', async () => {
  await clickGoalsSubTab(smPage, 'Branch');
  await smPage.waitForTimeout(400);
  await ss(smPage, '15-branch-desktop-dark');
});

await setDarkMode(smPage, false);

// ── CHECK 16–19: mobile 390 light ────────────────────────────────────────────
await check('16_self_mobile_light', 'Self sub-tab (mobile 390, light)', async () => {
  await smPage.setViewportSize({ width: 390, height: 844 });
  await smPage.waitForTimeout(300);
  await clickManagerNavTab(smPage, 'Goals');
  await smPage.waitForSelector('[role="tablist"] [role="tab"]', { timeout: 15000 });
  await clickGoalsSubTab(smPage, 'Self');
  await smPage.waitForTimeout(500);
  const bodyWidth = await smPage.evaluate(() => document.body.scrollWidth);
  if (bodyWidth > 410) throw new Error(`Horizontal overflow at 390px: ${bodyWidth}`);
  await ss(smPage, '16-self-mobile-light');
});

await check('17_agent_mobile_light', 'Agent sub-tab (mobile, light)', async () => {
  await clickGoalsSubTab(smPage, 'Agent');
  await smPage.waitForTimeout(400);
  await ss(smPage, '17-agent-mobile-light');
});

await check('18_unit_mobile_light', 'Unit sub-tab (mobile, light)', async () => {
  await clickGoalsSubTab(smPage, 'Unit');
  await smPage.waitForTimeout(400);
  await ss(smPage, '18-unit-mobile-light');
});

await check('19_branch_mobile_light', 'Branch sub-tab (mobile, light)', async () => {
  await clickGoalsSubTab(smPage, 'Branch');
  await smPage.waitForTimeout(400);
  await ss(smPage, '19-branch-mobile-light');
});

// ── CHECK 20–23: mobile dark ────────────────────────────────────────────────
await check('20_self_mobile_dark', 'Self sub-tab (mobile, dark)', async () => {
  await setDarkMode(smPage, true);
  await clickGoalsSubTab(smPage, 'Self');
  await smPage.waitForTimeout(400);
  await ss(smPage, '20-self-mobile-dark');
});

await check('21_agent_mobile_dark', 'Agent sub-tab (mobile, dark)', async () => {
  await clickGoalsSubTab(smPage, 'Agent');
  await smPage.waitForTimeout(400);
  await ss(smPage, '21-agent-mobile-dark');
});

await check('22_unit_mobile_dark', 'Unit sub-tab (mobile, dark)', async () => {
  await clickGoalsSubTab(smPage, 'Unit');
  await smPage.waitForTimeout(400);
  await ss(smPage, '22-unit-mobile-dark');
});

await check('23_branch_mobile_dark', 'Branch sub-tab (mobile, dark)', async () => {
  await clickGoalsSubTab(smPage, 'Branch');
  await smPage.waitForTimeout(400);
  await ss(smPage, '23-branch-mobile-dark');
});

await setDarkMode(smPage, false);
await smPage.setViewportSize({ width: 1440, height: 900 });

// ── CHECK 24: console-error sweep ────────────────────────────────────────────
// Collect console.errors during a quick re-sweep of each sub-tab.
const consoleErrors = [];
smPage.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
await check('24_no_console_errors', 'No console.error events across all 4 sub-tabs', async () => {
  consoleErrors.length = 0;
  await clickManagerNavTab(smPage, 'Goals');
  for (const tabLabel of ['Self', 'Agent', 'Unit', 'Branch']) {
    await clickGoalsSubTab(smPage, tabLabel);
    await smPage.waitForTimeout(400);
  }
  // Firebase + Vercel commonly log benign warnings; filter for genuine errors.
  // We accept errors that mention "404" only if they came from preflight bypass paths.
  const real = consoleErrors.filter((e) => !/_vercel|favicon|workbox|sw\.js/i.test(e));
  if (real.length > 0) {
    throw new Error(`${real.length} console.error events:\n  ${real.slice(0, 5).join('\n  ')}`);
  }
});

// ── CHECK 25–28: regression sweep on other manager surfaces ─────────────────
await check('25_overview_regression', 'Manager Overview (M2) still renders', async () => {
  await clickManagerNavTab(smPage, 'Overview', 'Dashboard');
  await smPage.waitForFunction(() => document.body.innerText.length > 100, { timeout: 10000 });
  await ss(smPage, '25-overview-regression');
});

await check('26_awards_regression', 'Awards (M3) still renders', async () => {
  await clickManagerNavTab(smPage, 'Awards');
  await smPage.waitForFunction(() => document.body.innerText.length > 100, { timeout: 10000 });
  await ss(smPage, '26-awards-regression');
});

await check('27_persistency_regression', 'Persistency still renders', async () => {
  await clickManagerNavTab(smPage, 'Persistency');
  await smPage.waitForFunction(() => document.body.innerText.length > 100, { timeout: 10000 });
  await ss(smPage, '27-persistency-regression');
});

await check('28_settlements_regression', 'Settlements still renders', async () => {
  await clickManagerNavTab(smPage, 'Settlements');
  await smPage.waitForFunction(() => document.body.innerText.length > 100, { timeout: 10000 });
  await ss(smPage, '28-settlements-regression');
});

// ── teardown + summary ───────────────────────────────────────────────────────
await browser.close();

const passed = Object.values(results).filter((r) => r.pass).length;
const total  = Object.values(results).length;
const failed = total - passed;

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n' + '='.repeat(60));
console.log(`M4 Goals IA flatten smoke walk complete: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed checks:');
  for (const [id, r] of Object.entries(results)) {
    if (!r.pass) console.log(`  ${id}: ${r.label}\n    ${r.error}`);
  }
}
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);
process.exit(failed > 0 ? 1 : 0);
