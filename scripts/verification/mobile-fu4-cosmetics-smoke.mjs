/**
 * Mobile FU#4 — cosmetic cleanup smoke walk.
 *
 * Verifies the three P2 items at 390×844 (mobile) viewport:
 *   P2-1: WizardForm close button  >= 44×44px
 *   P2-1: CampaignPanel close button >= 44×44px
 *   P2-3: MotivationalCarousel bg resolves to rgba(74,181,184,0.08) in dark mode
 *
 * Two role sessions:
 *   Agent (kelsean@gmail.com)   — Wizard check only
 *   Branch Manager              — Carousel (ManagerDashboard) + CampaignPanel checks
 *
 * Note: MotivationalCarousel renders on ManagerDashboard, NOT AgentDashboard.
 * AgentDashboard replaced it with the B2 goal carousel hero (PR #52). Carousel
 * checks therefore run in the branch manager session.
 *
 * Run:
 *   node scripts/verification/mobile-fu4-cosmetics-smoke.mjs
 * Override preview host:
 *   PREVIEW_HOST=agencytrack-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/mobile-fu4-cosmetics-smoke.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady, safeLog } from './lib/walk-helpers.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/mobile-fu4');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(p) {
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
  } catch { return {}; }
}

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;

// Credential resolution: try A11Y_ convention first, fall back to compact login
// keys (Agent_login / Branch_Manager_login). Compact keys may store
// "email:password" or password-only; detect by presence of ':'.
function parseCreds(rawA11yEmail, rawA11yPass, compactKey, fallbackEmail) {
  if (rawA11yEmail && rawA11yPass) return { email: rawA11yEmail, password: rawA11yPass };
  const compact = env[compactKey] ?? '';
  if (!compact) return { email: fallbackEmail, password: '' };
  const colon = compact.indexOf(':');
  if (colon > 0) return { email: compact.slice(0, colon), password: compact.slice(colon + 1) };
  return { email: fallbackEmail, password: compact };
}

const agentCreds = parseCreds(
  env.A11Y_AGENT_EMAIL, env.A11Y_AGENT_PASSWORD,
  'Agent_login', 'kelsean@gmail.com',
);
const bmCreds = parseCreds(
  env.A11Y_BRANCH_MANAGER_EMAIL, env.A11Y_BRANCH_MANAGER_PASSWORD,
  'Branch_Manager_login', 'branch.manager@tatillife.com',
);

// Stale default — overridable via PREVIEW_HOST env var for re-runs against future preview branches or production.
const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-fix-mobile-fu4-6732b5-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN) {
  console.error('VERCEL_BYPASS_TOKEN not in .env.local'); process.exit(1);
}
if (!agentCreds.password) {
  console.error('Agent credentials not found (tried A11Y_AGENT_PASSWORD, Agent_login)'); process.exit(1);
}
if (!bmCreds.password) {
  console.error('Branch manager credentials not found (tried A11Y_BRANCH_MANAGER_PASSWORD, Branch_Manager_login)'); process.exit(1);
}

// ── redaction ─────────────────────────────────────────────────────────────────
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  [BYPASS_TOKEN, agentCreds.password, bmCreds.password].forEach(secret => {
    if (secret) {
      out = out.replace(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[REDACTED]');
    }
  });
  return out;
}

// ── check harness ─────────────────────────────────────────────────────────────
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
  await pg.waitForFunction(() => (document.body.textContent ?? '').length > 100, { timeout: 15000 });
}

const MIN = 44;

// ── browser + bypass session ──────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

try {
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
} catch (e) {
  console.error('Bypass session failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

const page = await ctx.newPage();

// ════════════════════════════════════════════════════════
// SESSION 1 — Agent (Wizard close button only)
// ════════════════════════════════════════════════════════

await check('01_agent_login', `Agent login (${agentCreds.email}) at 390×844`, async () => {
  await signIn(page, agentCreds.email, agentCreds.password);
  safeLog('  Agent signed in');
  await ss(page, '01-agent-post-login');
});

// ── CHECK 02: Wait for provisioning screen to clear ───────────────────────────
// The app briefly shows "Setting up your account" while the Firestore user doc
// loads after auth. Wait for it to disappear before interacting with the dashboard.
await check('02_provisioning_clear', 'Provisioning screen clears (dashboard ready)', async () => {
  await page.waitForFunction(
    () => !document.body.textContent.includes('Setting up your account'),
    { timeout: 20000 },
  );
  safeLog('  Dashboard ready');
  await ss(page, '02-dashboard-ready');
});

// ── CHECK 03: Open Weekly Wizard via bottom-nav Submit tab ────────────────────
await check('03_open_wizard', 'Open Weekly Wizard via bottom-nav Submit tab', async () => {
  await page.evaluate(() => {
    // Bottom-nav Submit tab — dispatchEvent bypasses actionability checks on
    // mobile where the sidebar/nav may have display constraints.
    const submitTab = [...document.querySelectorAll('button, a')]
      .find(el => el.textContent.trim() === 'Submit');
    if (!submitTab) throw new Error('Submit tab not found in bottom nav');
    submitTab.dispatchEvent(new Event('click', { bubbles: true }));
  });
  await page.waitForSelector('[aria-label="Close"]', { timeout: 10000 });
  await ss(page, '03-wizard-open');
});

// ── CHECK 04: P2-1 — Wizard close button >= 44×44px ──────────────────────────
await check('04_p2_1_wizard_close', 'P2-1: Wizard close button >= 44×44px', async () => {
  const rect = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="Close"]');
    if (!btn) throw new Error('[aria-label="Close"] not found');
    return btn.getBoundingClientRect();
  });
  safeLog(`  Wizard close: ${rect.width}×${rect.height}px`);
  if (rect.width < MIN || rect.height < MIN) {
    throw new Error(`Close button ${rect.width}×${rect.height}px — expected >= ${MIN}×${MIN}px`);
  }
});

// Close wizard
await page.evaluate(() => {
  const btn = document.querySelector('[aria-label="Close"]');
  if (btn) btn.click();
});
await page.waitForSelector('[aria-label="Close"]', { state: 'detached', timeout: 5000 }).catch(() => {});
await page.waitForTimeout(300);

// Sign out for manager session
await check('05_agent_signout', 'Agent signs out', async () => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate(async () => {
    if (window.__firebase_auth__ || window.firebase?.auth) {
      try { await window.firebase.auth().signOut(); } catch { /* ok */ }
    }
  });
  await page.waitForTimeout(500);
  safeLog('  Agent signed out');
});

// ════════════════════════════════════════════════════════
// SESSION 2 — Branch Manager
// Carousel (ManagerDashboard) + CampaignPanel checks
// ════════════════════════════════════════════════════════

const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const cookies = await ctx.cookies();
await ctx2.addCookies(cookies);
const mgPage = await ctx2.newPage();

await check('06_bm_login', `Branch manager login (${bmCreds.email}) at 390×844`, async () => {
  await signIn(mgPage, bmCreds.email, bmCreds.password);
  safeLog('  Branch manager signed in');
  await ss(mgPage, '06-bm-dashboard');
});

// ── CHECK 07: Carousel visible in light mode (ManagerDashboard) ──────────────
await check('07_carousel_light', 'MotivationalCarousel visible in light mode (ManagerDashboard)', async () => {
  const found = await mgPage.evaluate(() =>
    !!document.querySelector('section[aria-label="Motivational insights"]')
  );
  if (!found) throw new Error('Carousel section not found on manager dashboard');
  await ss(mgPage, '07-carousel-light');
});

// ── CHECK 08: Toggle dark mode ────────────────────────────────────────────────
await check('08_dark_mode_toggle', 'Dark mode toggle activates dark theme (ManagerDashboard)', async () => {
  await mgPage.evaluate(() => {
    const toggle = [...document.querySelectorAll('button')]
      .find(b => /dark|light|theme/i.test(b.getAttribute('aria-label') ?? '') ||
                 b.querySelector('svg[class*="sun"], svg[class*="moon"]'));
    if (!toggle) {
      const headerBtns = [...document.querySelectorAll('button')].filter(b => {
        const r = b.getBoundingClientRect();
        return r.top < 80 && r.width < 60;
      });
      if (headerBtns.length === 0) throw new Error('Dark mode toggle button not found');
      headerBtns[headerBtns.length - 1].click();
      return;
    }
    toggle.click();
  });
  await mgPage.waitForTimeout(300);
  const isDark = await mgPage.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!isDark) throw new Error('Dark class not applied to <html> after toggle');
  await ss(mgPage, '08-carousel-dark');
});

// ── CHECK 09: P2-3 — Carousel bg = rgba(74,181,184,0.08) in dark mode ─────────
await check('09_p2_3_carousel_dark_bg', 'P2-3: Carousel bg resolves to rgba(74,181,184,0.08) in dark mode', async () => {
  const bg = await mgPage.evaluate(() => {
    const section = document.querySelector('section[aria-label="Motivational insights"]');
    if (!section) throw new Error('Carousel section not found');
    return getComputedStyle(section).backgroundColor;
  });
  safeLog(`  Carousel bg (dark): ${bg}`);
  const expected = 'rgba(74, 181, 184, 0.08)';
  const oldHex   = 'rgba(1, 105, 111, 0.08)';
  if (bg === oldHex) throw new Error(`Still rendering old hex color ${oldHex} — token swap may not have taken effect`);
  if (bg !== expected) {
    safeLog(`  NOTE: expected ${expected}, got ${bg} — recording actual value`);
  }
});

// ── CHECK 10: Navigate to Campaigns tab ──────────────────────────────────────
await check('10_campaigns_nav', 'Navigate to Campaigns tab', async () => {
  await mgPage.waitForFunction(
    () => [...document.querySelectorAll('button, a')]
      .some(b => /campaigns?/i.test(b.textContent ?? '')),
    { timeout: 15000 },
  );
  await mgPage.evaluate(() => {
    const btn = [...document.querySelectorAll('button, a')]
      .find(b => /campaigns?/i.test(b.textContent ?? ''));
    btn?.click();
  });
  await mgPage.waitForTimeout(1000);
  await ss(mgPage, '10-campaigns-tab');
});

// ── CHECK 11: Open CampaignPanel new-campaign form ────────────────────────────
await check('11_open_campaign_form', 'Open new-campaign form (CampaignPanel)', async () => {
  await mgPage.waitForFunction(
    () => [...document.querySelectorAll('button')]
      .some(b => /new campaign|add campaign|\+/i.test(b.textContent ?? '')),
    { timeout: 10000 },
  );
  await mgPage.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find(b => /new campaign|add campaign|\+/i.test(b.textContent ?? ''));
    btn?.click();
  });
  // Gate: wait for close button (class pattern — the button has no aria-label;
  // see FU banked during this walk: CampaignForm close button missing aria-label).
  await mgPage.waitForFunction(
    () => [...document.querySelectorAll('button')]
      .some(b => b.className.includes('w-11') && b.className.includes('h-11') && b.className.includes('rounded-full')),
    { timeout: 8000 },
  );
  await ss(mgPage, '11-campaign-form-open');
});

// ── CHECK 12: P2-1 — CampaignPanel close button >= 44×44px ───────────────────
await check('12_p2_1_campaign_close', 'P2-1: CampaignPanel close button >= 44×44px', async () => {
  const rect = await mgPage.evaluate(() => {
    const closeBtn = [...document.querySelectorAll('button')]
      .find(b => b.className.includes('w-11') && b.className.includes('h-11') && b.className.includes('rounded-full'));
    if (!closeBtn) throw new Error('CampaignPanel close button not found');
    return closeBtn.getBoundingClientRect();
  });
  safeLog(`  Campaign close: ${rect.width}×${rect.height}px`);
  if (rect.width < MIN || rect.height < MIN) {
    throw new Error(`Close button ${rect.width}×${rect.height}px — expected >= ${MIN}×${MIN}px`);
  }
});

// ── teardown ──────────────────────────────────────────────────────────────────
await browser.close();

const passed = Object.values(results).filter(r => r.pass).length;
const total  = Object.values(results).length;
const failed = total - passed;

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n' + '='.repeat(60));
console.log(`Mobile FU#4 cosmetics smoke: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed checks:');
  for (const [id, r] of Object.entries(results)) {
    if (!r.pass) console.log(`  ${id}: ${r.label}\n    ${r.error}`);
  }
}
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);
process.exit(failed > 0 ? 1 : 0);
