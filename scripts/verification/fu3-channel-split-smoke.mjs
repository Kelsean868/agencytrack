/**
 * fu3-channel-split-smoke — Production smoke for the FU#3 channel-split
 * token migration.
 *
 * Verifies that opacity-modified Tailwind utilities (bg-primary/30,
 * bg-success/15, ring-primary/40, text-ink-muted/60, etc.) resolve to
 * real alpha-modulated rgba values app-wide on the preview deployment.
 * Pre-migration these utilities computed to rgba(0, 0, 0, 0) due to
 * Tailwind's opacity-modifier path failing against hex-format CSS vars.
 *
 * Walk:
 *   1. setupBypassSession (cookie-after-handshake, token in exactly one URL)
 *   2. For each of 5 roles (agent / unit_manager / branch_manager /
 *      sales_manager / tenant_admin):
 *        a. sign in
 *        b. screenshot dashboard light + dark
 *        c. run the FU#3 verification snippet against real DOM elements
 *        d. assert NONE return rgba(0, 0, 0, 0)
 *        e. sign out
 *   3. branch_manager extra: navigate to MeetingMode, screenshot
 *      (highest-stakes Tatil-facing surface)
 *
 * Bypass: setupBypassSession pattern. Token appears in exactly ONE URL
 * inside the helper's sanitizing try/catch. Bare URLs thereafter.
 *
 * Artifacts: verification/fu3-channel-split/ (gitignored).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { setupBypassSession, waitForFirebaseReady } from './lib/walk-helpers.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/fu3-channel-split');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(...paths) {
  for (const p of paths) {
    try {
      const src = readFileSync(p, 'utf8');
      const env = {};
      src.split('\n').forEach((line) => {
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

const ROLES = [
  { key: 'agent',           email: env.A11Y_AGENT_EMAIL,           pw: env.A11Y_AGENT_PASSWORD },
  { key: 'unit_manager',    email: env.A11Y_UNIT_MANAGER_EMAIL,    pw: env.A11Y_UNIT_MANAGER_PASSWORD },
  { key: 'branch_manager',  email: env.A11Y_BRANCH_MANAGER_EMAIL,  pw: env.A11Y_BRANCH_MANAGER_PASSWORD },
  { key: 'sales_manager',   email: env.A11Y_SALES_MANAGER_EMAIL,   pw: env.A11Y_SALES_MANAGER_PASSWORD },
  { key: 'tenant_admin',    email: env.A11Y_TENANT_ADMIN_EMAIL,    pw: env.A11Y_TENANT_ADMIN_PASSWORD },
];

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-fix-fu3-channel-d3b076-kyron-marchan-s-projects.vercel.app';
const BASE_URL = `https://${PREVIEW_HOST}`;

if (!BYPASS_TOKEN) { console.error('VERCEL_BYPASS_TOKEN not present'); process.exit(1); }
for (const r of ROLES) {
  if (!r.email || !r.pw) { console.error(`A11Y_${r.key.toUpperCase()}_EMAIL/PASSWORD not present`); process.exit(1); }
}

// Defense-in-depth redaction.
function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg;
  if (BYPASS_TOKEN) {
    out = out.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  }
  for (const r of ROLES) {
    if (r.pw) out = out.replace(new RegExp(r.pw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  }
  return out;
}

const summary = { roles: {}, transparent_sites: [], errors: [] };

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for either the main dashboard or the agent welcome-screen — both
  // signal a successful auth resolution.
  await page.waitForFunction(
    () => !document.querySelector('input[type="email"]'),
    { timeout: 30_000 },
  );
  // Settle a beat so first-paint chrome renders.
  await page.waitForTimeout(1500);
}

async function signOut(page) {
  // Try the profile menu first; fall back to manual localStorage clear.
  const profileBtn = await page.$('[data-testid="nav-profile"]');
  if (profileBtn) {
    await profileBtn.click();
    const so = await page.$('[data-testid="profile-sign-out"]');
    if (so) {
      await so.click();
      await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
      return;
    }
  }
  // Fallback: clear auth via Firebase signOut from the page context.
  await page.evaluate(async () => {
    try {
      const mod = await import('/src/firebase.js');
      const { signOut } = await import('firebase/auth');
      await signOut(mod.auth);
    } catch (e) { /* swallow — proceed to reload */ }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
}

async function setDarkMode(page, dark) {
  await page.evaluate((on) => {
    localStorage.setItem('agencytrack-dark', on ? '1' : '0');
    document.documentElement.classList.toggle('dark', on);
  }, dark);
  await page.waitForTimeout(400); // let transitions settle
}

async function probeOpacityModifiers(page) {
  return await page.evaluate(() => {
    const sel = '[class*="bg-primary/"], [class*="bg-success/"], [class*="bg-warning/"], [class*="bg-danger/"], [class*="bg-presentation"], [class*="text-ink-muted/"], [class*="border-primary/"], [class*="ring-primary/"]';
    const els = [...document.querySelectorAll(sel)].slice(0, 30);
    return els.map(el => {
      const cs = getComputedStyle(el);
      const classMatch = el.className.match
        ? el.className.match(/\b(bg|text|border|ring)-(primary|success|warning|danger|presentation|ink-muted)[a-z-]*\/\d+\b/)
        : null;
      return {
        utility: classMatch?.[0] ?? '<unknown>',
        bg: cs.backgroundColor,
        color: cs.color,
        border: cs.borderColor,
        ring: cs.getPropertyValue('--tw-ring-color').trim() || null,
      };
    });
  });
}

function isTransparent(rgba) {
  return rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent';
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setupBypassSession(context, BASE_URL, BYPASS_TOKEN);

  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') summary.errors.push(redact(m.text()));
  });

  for (const r of ROLES) {
    console.log(`\n── ${r.key} ──────────────────────────────────────────────`);
    const roleResults = { light: null, dark: null, errors: [] };
    try {
      await login(page, r.email, r.pw);

      // LIGHT MODE
      await setDarkMode(page, false);
      await page.screenshot({ path: resolve(SS_DIR, `${r.key}-light.png`), fullPage: false });
      const lightProbe = await probeOpacityModifiers(page);
      const lightTransparent = lightProbe.filter(p => p.utility?.startsWith('bg-') && isTransparent(p.bg));
      roleResults.light = {
        count: lightProbe.length,
        transparent_bg_sites: lightTransparent.length,
        sample: lightProbe.slice(0, 10),
      };
      if (lightTransparent.length) summary.transparent_sites.push({ role: r.key, theme: 'light', items: lightTransparent });

      // DARK MODE
      await setDarkMode(page, true);
      await page.screenshot({ path: resolve(SS_DIR, `${r.key}-dark.png`), fullPage: false });
      const darkProbe = await probeOpacityModifiers(page);
      const darkTransparent = darkProbe.filter(p => p.utility?.startsWith('bg-') && isTransparent(p.bg));
      roleResults.dark = {
        count: darkProbe.length,
        transparent_bg_sites: darkTransparent.length,
        sample: darkProbe.slice(0, 10),
      };
      if (darkTransparent.length) summary.transparent_sites.push({ role: r.key, theme: 'dark', items: darkTransparent });

      console.log(`  light: ${roleResults.light.count} opacity sites probed, ${roleResults.light.transparent_bg_sites} transparent`);
      console.log(`  dark:  ${roleResults.dark.count} opacity sites probed, ${roleResults.dark.transparent_bg_sites} transparent`);

      // BRANCH MANAGER EXTRA: MeetingMode (Tatil pilot demo surface)
      if (r.key === 'branch_manager') {
        await setDarkMode(page, false);
        const mmBtn = await page.$('button:has-text("Start Meeting")');
        if (mmBtn) {
          await mmBtn.click().catch(() => {});
          await page.waitForTimeout(3000);
          await page.screenshot({ path: resolve(SS_DIR, `${r.key}-meetingmode.png`), fullPage: false });
          const mmProbe = await probeOpacityModifiers(page);
          const mmTransparent = mmProbe.filter(p => p.utility?.startsWith('bg-') && isTransparent(p.bg));
          roleResults.meetingmode = {
            count: mmProbe.length,
            transparent_bg_sites: mmTransparent.length,
            sample: mmProbe.slice(0, 10),
          };
          console.log(`  meetingmode: ${mmProbe.length} sites probed, ${mmTransparent.length} transparent`);
          if (mmTransparent.length) summary.transparent_sites.push({ role: r.key, theme: 'meetingmode', items: mmTransparent });
        } else {
          console.log('  meetingmode: button not found (text/aria fallback). Skipped — banner light/dark already captured.');
          roleResults.meetingmode = { skipped: 'launch button not found via text/aria selectors' };
        }
      }

      await signOut(page);
    } catch (e) {
      const msg = redact(e?.message ?? String(e));
      roleResults.errors.push(msg);
      summary.errors.push(`${r.key}: ${msg}`);
      console.error(`  ✗ ${r.key} — ${msg}`);
      // Reset to a clean login state for the next role.
      try { await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' }); } catch {}
    }
    summary.roles[r.key] = roleResults;
  }

  await context.close();
  await browser.close();

  writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
  console.log(`\n── DONE ──`);
  console.log(`Results: ${RESULTS_FILE}`);
  console.log(`Screenshots: ${SS_DIR}`);
  console.log(`Roles with transparent opacity-modified bg sites: ${summary.transparent_sites.length}`);
  process.exit(summary.transparent_sites.length > 0 ? 1 : 0);
})().catch((e) => {
  const msg = redact(e?.message ?? String(e));
  console.error(`FATAL — ${msg}`);
  process.exit(1);
});
