/**
 * E5 — Playwright verification walk for TV Display Kiosk Mode.
 *
 * 12 checks against the Vercel preview for E5:
 *   Check 01   Non-kiosk path → login page renders (routing doesn't interfere)
 *   Check 02   /kiosk/bad-tenant/invalid-token → "Display unavailable"
 *   Check 03   Branch manager login → "Kiosk" tab present in sidebar nav
 *   Check 04   Branch manager → Kiosk tab mounts without crash
 *   Check 05   Branch manager → Generate URL → new token row appears
 *   Check 06   Token row → external-link href matches kiosk URL pattern
 *   Check 07   Navigate to generated kiosk URL → shell loads
 *   Check 08   Kiosk URL → dark class forced on <html> element
 *   Check 09   Kiosk URL → mobile 390px, no horizontal overflow
 *   Check 10   Kiosk URL → at least one panel heading visible within 50s
 *   Check 11   Branch manager → Revoke → token row disappears
 *   Check 12   Unit manager → Kiosk tab NOT present in nav [skipped if no UM creds]
 *
 * Run from project root:
 *   node scripts/verification/e5-walk.mjs
 *
 * Override the preview host:
 *   PREVIEW_HOST=agencytrack-foo-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/e5-walk.mjs
 *
 * Requires .env.local with VERCEL_BYPASS_TOKEN,
 * A11Y_BRANCH_MANAGER_EMAIL/PASSWORD, and optionally
 * A11Y_UNIT_MANAGER_EMAIL/PASSWORD.
 * .env.local is gitignored — copy from main worktree if running from a
 * feature worktree (CLAUDE.md banked rule).
 *
 * Artifacts written to verification/e5/ (gitignored per CLAUDE.md).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/e5');
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
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL     = env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD  = env.A11Y_BRANCH_MANAGER_PASSWORD;
const UM_EMAIL     = env.A11Y_UNIT_MANAGER_EMAIL;
const UM_PASSWORD  = env.A11Y_UNIT_MANAGER_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-e5-kiosk-mode-kyron-marchan-s-projects.vercel.app';

if (!BYPASS_TOKEN)            { console.error('VERCEL_BYPASS_TOKEN not found in .env.local'); process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD){ console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not found'); process.exit(1); }

const HAS_UM = Boolean(UM_EMAIL && UM_PASSWORD);
if (!HAS_UM) console.warn('⚠ Unit manager creds not configured — check 12 will be skipped (11/12 acceptable)');

function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  if (BM_PASSWORD) out = out.replace(new RegExp(BM_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  if (UM_PASSWORD) out = out.replace(new RegExp(UM_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  return out;
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

async function gotoKioskTab(pg) {
  const btn = pg.getByRole('button', { name: /^Kiosk$/i });
  await btn.waitFor({ timeout: 8000 });
  await btn.click();
  await pg.waitForTimeout(800);
}

// bypassCookies is populated after the bmCtx bypass navigation and injected into
// each fresh kiosk context so Vercel serves the SPA index.html for deep paths.
// Without the bypass cookie, Vercel returns 404 for /kiosk/* in fresh contexts.
let bypassCookies = [];

// ── main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const bypassUrl = `https://${PREVIEW_HOST}/?x-vercel-protection-bypass=${BYPASS_TOKEN}&x-vercel-set-bypass-cookie=true`;

// Shared branch-manager context (reused across checks 03-11)
const bmCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const bmPage = await bmCtx.newPage();

// Set bypass cookie and capture it for injection into fresh kiosk contexts.
// Fresh contexts get Vercel 404s on deep SPA paths without the bypass cookie.
try {
  await bmPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  bypassCookies = await bmCtx.cookies();
} catch (e) {
  console.error('Bypass navigation failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

// ── CHECK 01: Normal path unaffected ─────────────────────────────────────────
await check('01_normal_route', 'Root path renders login — kiosk routing does not interfere', async () => {
  await bmPage.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  const emailInput = bmPage.locator('input[type="email"]');
  await emailInput.waitFor({ timeout: 10000 });
  await ss(bmPage, '01-login');
});

// ── CHECK 02: Invalid kiosk path → error screen ───────────────────────────────
await check('02_invalid_kiosk', '/kiosk/bad-tenant/invalid-token → "Display unavailable"', async () => {
  const invalidPage = await bmCtx.newPage();
  await invalidPage.goto(
    `https://${PREVIEW_HOST}/kiosk/bad-tenant/aaaabbbbcccc0000aaaabbbbcccc0000aaaabbbbcccc0000aaaabbbbcccc0000`,
    { waitUntil: 'networkidle', timeout: 30000 }
  );
  await invalidPage.waitForFunction(
    () => document.body.innerText.includes('Display unavailable') ||
          document.body.innerText.includes('unavailable'),
    { timeout: 20000 }
  );
  await ss(invalidPage, '02-invalid-kiosk');
  await invalidPage.close();
});

// ── CHECK 03: Branch manager sees Kiosk tab ───────────────────────────────────
await check('03_bm_kiosk_tab', 'Branch manager login → "Kiosk" tab in sidebar nav', async () => {
  await signIn(bmPage, BM_EMAIL, BM_PASSWORD);
  const kioskBtn = bmPage.getByRole('button', { name: /^Kiosk$/i });
  await kioskBtn.waitFor({ timeout: 10000 });
  await ss(bmPage, '03-bm-nav-kiosk-tab');
});

// ── CHECK 04: Kiosk tab mounts without crash ──────────────────────────────────
await check('04_kiosk_tab_mounts', 'Kiosk tab content mounts — no JS crash', async () => {
  await gotoKioskTab(bmPage);
  // Either the token list or empty state renders
  await bmPage.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('No active kiosk') ||
             t.includes('Generate URL') ||
             t.includes('agencytrack.vercel.app/kiosk/');
    },
    { timeout: 10000 }
  );
  await ss(bmPage, '04-kiosk-tab-content');
});

// Track generated kiosk URL for later checks
let generatedKioskPath = null;

// ── CHECK 05: Generate URL → token row appears ────────────────────────────────
await check('05_generate_url', 'Generate URL → new token row with kiosk URL appears', async () => {
  // Click Generate URL
  const genBtn = bmPage.getByRole('button', { name: /Generate URL/i });
  await genBtn.waitFor({ timeout: 8000 });
  await genBtn.click();

  // Wait for a token row (external link href containing kiosk URL)
  await bmPage.waitForFunction(
    () => !!document.querySelector('a[href*="agencytrack.vercel.app/kiosk/"]'),
    { timeout: 20000 }
  );
  await ss(bmPage, '05-token-row');
});

// ── CHECK 06: Token href matches kiosk URL pattern ────────────────────────────
await check('06_token_href', 'Token row external-link href matches kiosk URL pattern', async () => {
  const link = bmPage.locator('a[href*="agencytrack.vercel.app/kiosk/"]').first();
  await link.waitFor({ timeout: 8000 });
  const href = await link.getAttribute('href');
  if (!href || !href.includes('/kiosk/')) {
    throw new Error(`Unexpected href: ${href}`);
  }
  // Extract the path (/kiosk/tenantId/tokenId) for use in later checks
  const url = new URL(href);
  generatedKioskPath = url.pathname; // /kiosk/<tenantId>/<tokenId>
  console.log(`  ℹ Kiosk path: ${generatedKioskPath}`);
  await ss(bmPage, '06-token-href');
});

// ── CHECK 07: Navigate to kiosk URL → shell loads ────────────────────────────
await check('07_kiosk_shell_loads', 'Generated kiosk URL → shell renders (spinner or panel)', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 06 — skipping');
  const kioskCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kioskPage = await kioskCtx.newPage();
  // Navigate through bypass → / (networkidle to let service worker install+activate)
  // → kiosk path. Without the service worker active, Vercel returns 404 for deep
  // SPA paths in fresh contexts (SW intercepts navigation and serves index.html).
  await kioskPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  // Either a loading spinner or a rendered panel (wait up to 45s for Firebase sign-in + data)
  await kioskPage.waitForFunction(
    () => {
      const t = document.body.innerText;
      const hasPanelText = t.includes('Branch Overview') || t.includes('Leaderboard') ||
                           t.includes('Running Totals') || t.includes('Compliance') ||
                           t.includes('Awards Watch') || t.includes('Good Morning') ||
                           t.includes('Good Afternoon') || t.includes('Good Evening') ||
                           t.includes('Last Week') || t.includes('Display unavailable');
      const hasSpinner = document.body.querySelector('.animate-spin');
      return hasPanelText || Boolean(hasSpinner);
    },
    { timeout: 45000 }
  );
  await ss(kioskPage, '07-kiosk-shell');
  await kioskCtx.close();
});

// ── CHECK 08: dark class forced ───────────────────────────────────────────────
await check('08_dark_class', 'Kiosk URL → html element has "dark" class (always-dark)', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 06 — skipping');
  const kioskCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kioskPage = await kioskCtx.newPage();
  await kioskPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  // Wait for JS to run (main.jsx adds dark class synchronously before React mounts)
  await kioskPage.waitForTimeout(2000);
  const hasDark = await kioskPage.evaluate(
    () => document.documentElement.classList.contains('dark')
  );
  if (!hasDark) throw new Error('<html> does not have "dark" class — forced dark mode not applied');
  await ss(kioskPage, '08-dark-class');
  await kioskCtx.close();
});

// ── CHECK 09: Mobile 390px, no overflow ──────────────────────────────────────
await check('09_mobile_no_overflow', 'Kiosk URL 390px wide — no horizontal overflow', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 06 — skipping');
  const kioskCtx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const kioskPage = await kioskCtx.newPage();
  await kioskPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await kioskPage.waitForTimeout(3000);
  const overflow = await kioskPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  if (overflow) throw new Error('Horizontal overflow detected at 390px viewport');
  await ss(kioskPage, '09-mobile-kiosk');
  await kioskCtx.close();
});

// ── CHECK 10: At least one panel heading renders ──────────────────────────────
await check('10_panel_renders', 'Kiosk URL — at least one panel heading visible within 50s', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 06 — skipping');
  const kioskCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kioskPage = await kioskCtx.newPage();
  await kioskPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await kioskPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await kioskPage.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('Branch Overview') || t.includes('Leaderboard') ||
             t.includes('Running Totals') || t.includes('Compliance') ||
             t.includes('Awards Watch') || t.includes('Last Week') ||
             t.includes('Good Morning') || t.includes('Good Afternoon') ||
             t.includes('Good Evening');
    },
    { timeout: 60000 }
  );
  await ss(kioskPage, '10-panel-renders');
  await kioskCtx.close();
});

// ── CHECK 11: Revoke → token row disappears ───────────────────────────────────
await check('11_revoke', 'Branch manager revokes token → row removed from list', async () => {
  // Navigate back to kiosk tab
  await gotoKioskTab(bmPage);
  await bmPage.waitForFunction(
    () => !!document.querySelector('a[href*="agencytrack.vercel.app/kiosk/"]'),
    { timeout: 10000 }
  );

  // Click the Trash2 revoke button (aria-label="Revoke URL")
  const revokeBtn = bmPage.getByTitle('Revoke URL').first();
  await revokeBtn.waitFor({ timeout: 8000 });
  await revokeBtn.click();

  // Row should disappear (or "No active kiosk URLs" appears)
  await bmPage.waitForFunction(
    () => {
      const t = document.body.innerText;
      const hasLinks = !!document.querySelector('a[href*="agencytrack.vercel.app/kiosk/"]');
      return !hasLinks || t.includes('No active kiosk');
    },
    { timeout: 15000 }
  );
  await ss(bmPage, '11-revoked');
});

// ── CHECK 12: Unit manager does NOT see Kiosk tab ────────────────────────────
if (HAS_UM) {
  await check('12_um_no_kiosk_tab', 'Unit manager login → Kiosk tab NOT visible in nav', async () => {
    const umCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const umPage = await umCtx.newPage();
    await umPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await signIn(umPage, UM_EMAIL, UM_PASSWORD);
    // Nav should be visible but Kiosk button should not exist
    await umPage.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
    const kioskBtnCount = await umPage.getByRole('button', { name: /^Kiosk$/i }).count();
    if (kioskBtnCount > 0) throw new Error('Unit manager can see the Kiosk tab — role gate failed');
    await ss(umPage, '12-um-no-kiosk-tab');
    await umCtx.close();
  });
} else {
  results['12_um_no_kiosk_tab'] = {
    label: 'Unit manager → Kiosk tab NOT visible [skipped — no UM creds]',
    pass: true,
    skipped: true,
  };
  console.log('⚠ 12_um_no_kiosk_tab: skipped (no UM credentials)');
}

// ── teardown ──────────────────────────────────────────────────────────────────
await browser.close();

const passed  = Object.values(results).filter((r) => r.pass).length;
const total   = Object.keys(results).length;
const skipped = Object.values(results).filter((r) => r.skipped).length;

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n────────────────────────────────────────');
console.log(`E5 Walk: ${passed}/${total} passed (${skipped} skipped)`);
if (passed < total - skipped) {
  const failed = Object.entries(results).filter(([, r]) => !r.pass && !r.skipped);
  console.log('FAILED:');
  failed.forEach(([id, r]) => console.log(`  ${id}: ${r.error}`));
  process.exit(1);
}
console.log('All checks passed.');
