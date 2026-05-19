// border-border-smoke.mjs — verifies the .border-border utility resolves
// to the warm theme tokens (light: rgb(229,226,219) / dark: rgb(58,53,48))
// instead of Tailwind Preflight's rgb(229,231,235) fallback, on real app
// surfaces at mobile viewport (390x844). One-off smoke for PR #156.
//
// Run from repo root with `.env.local` present (VERCEL_BYPASS_TOKEN +
// A11Y_AGENT_*  + A11Y_BRANCH_MANAGER_* keys required).

import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { setupBypassSession, safeLog } from './lib/walk-helpers.mjs';

function loadEnvLocal(path) {
  try {
    const src = readFileSync(path, 'utf8');
    const env = {};
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
      if (k) env[k] = v;
    });
    return env;
  } catch {
    return {};
  }
}

loadEnvLocal(resolve(process.cwd(), '.env.local'));

const PREVIEW_HOST = process.env.PREVIEW_HOST ??
  'agencytrack-git-fix-border-bord-704d1c-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 390, height: 844 };
const SCREENSHOT_DIR = resolve('verification', 'border-border-smoke');

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
};

const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');

const ROLES = {
  agent: {
    email: requireEnv('A11Y_AGENT_EMAIL'),
    password: requireEnv('A11Y_AGENT_PASSWORD'),
  },
  branchManager: {
    email: requireEnv('A11Y_BRANCH_MANAGER_EMAIL'),
    password: requireEnv('A11Y_BRANCH_MANAGER_PASSWORD'),
  },
};

const EXPECTED = {
  light: 'rgb(229, 226, 219)',
  dark: 'rgb(58, 53, 48)',
  reject: 'rgb(229, 231, 235)',
};

async function waitForLoginForm(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
}

async function loginAtMobile(page, { email, password }) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(
      () => document.querySelector('input[type="email"]') === null,
      { timeout: 30_000 },
    ),
    page.click('button[type="submit"]'),
  ]);
  // Mobile-friendly post-login readiness: wait until either a border-border
  // element shows up, or non-trivial app body content settles. The dashboard
  // pulls Firestore data after first paint so we give it some time.
  await page.waitForFunction(
    () =>
      document.querySelector('[class*="border-border"]') !== null ||
      (document.body &&
        document.body.textContent.replace(/\s+/g, '').length > 400),
    { timeout: 30_000 },
  );
  // Settle micro-tasks for any post-mount render passes.
  await page.waitForTimeout(1500);
}

async function getDarkModeState(page) {
  return await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
}

async function setDarkMode(page, wantDark) {
  const isDark = await getDarkModeState(page);
  if (isDark === wantDark) return;
  // Use the user-facing toggle button (header). Fall back to direct class
  // toggle if the button isn't reachable (some surfaces hide the header).
  const toggled = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button'));
    const btn = candidates.find((b) => {
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      return label.includes('dark') || label.includes('light') || label.includes('theme');
    });
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (!toggled) {
    await page.evaluate((dark) => {
      const root = document.documentElement;
      if (dark) root.classList.add('dark');
      else root.classList.remove('dark');
      try {
        localStorage.setItem('agencytrack-dark', dark ? 'true' : 'false');
      } catch (_e) {
        // localStorage may be blocked in iframe — fall back silently
      }
    }, wantDark);
  }
  await page.waitForFunction(
    (dark) => document.documentElement.classList.contains('dark') === dark,
    wantDark,
    { timeout: 5000 },
  );
}

async function measureBorderColor(page) {
  return await page.evaluate(() => {
    // Prefer an element that has BOTH a border width utility AND border-border
    // (Pattern A — visible border, color-binding actually drives rendered color).
    const all = Array.from(document.querySelectorAll('[class*="border-border"]'));
    const patternA = all.find((el) => {
      const cls = el.className?.toString() ?? '';
      return /\bborder\b/.test(cls);
    });
    const el = patternA ?? all[0] ?? null;
    if (!el) return { found: false, allCount: all.length };
    const style = getComputedStyle(el);
    return {
      found: true,
      allCount: all.length,
      patternA: !!patternA,
      borderColor: style.borderColor,
      borderTopColor: style.borderTopColor,
      borderTopWidth: style.borderTopWidth,
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.toString() ?? '').slice(0, 120),
    };
  });
}

function classifyResult(measured, mode) {
  if (!measured.found) return 'NO_ELEMENT';
  const c = measured.borderColor;
  if (c === EXPECTED[mode]) return 'PASS';
  if (c === EXPECTED.reject) return 'FAIL_PREFLIGHT_FALLBACK';
  // Tailwind opacity modifiers (e.g. border-border/50) yield rgba(...) with
  // the same channel values. Accept any rgba whose RGB triple matches the
  // expected theme token — the alpha modulation is not a defect.
  const expectedTriple = EXPECTED[mode].match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (expectedTriple) {
    const triple = `${expectedTriple[1]}, ${expectedTriple[2]}, ${expectedTriple[3]}`;
    const re = new RegExp(`^rgba\\(${triple}, [\\d.]+\\)$`);
    if (re.test(c)) return 'PASS_WITH_OPACITY_MODIFIER';
  }
  // Reject the Preflight fallback at any alpha
  if (/^rgba\(229, 231, 235,/.test(c)) return 'FAIL_PREFLIGHT_FALLBACK';
  return `UNEXPECTED:${c}`;
}

async function snapshotSurface({ page, label, mode, slug }) {
  const m = await measureBorderColor(page);
  if (!m.found) {
    // Debug: dump what classes exist on the page so we can see what's rendered.
    const debug = await page.evaluate(() => ({
      bodyTextLen: document.body?.textContent?.length ?? 0,
      url: location.pathname,
      anyBorderClass: document.querySelectorAll('[class*="border"]').length,
      classesSample: Array.from(
        document.querySelectorAll('[class*="border"]'),
      )
        .slice(0, 5)
        .map((el) => (el.className?.toString() ?? '').slice(0, 100)),
    }));
    safeLog(`[${label}/${mode}] DEBUG`, JSON.stringify(debug));
  }
  const verdict = classifyResult(m, mode);
  await page.screenshot({
    path: join(SCREENSHOT_DIR, `${slug}-${mode}.png`),
    fullPage: true,
  });
  safeLog(`[${label}/${mode}]`, JSON.stringify({ verdict, ...m }));
  return { label, mode, verdict, ...m };
}

async function visitSurface({ browser, role, label, slug, postLoginAction }) {
  // Fresh context per surface — avoids carrying auth state across roles.
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  try {
    await setupBypassSession(context, PREVIEW_URL, TOKEN);
    await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
    await waitForLoginForm(page);
    await loginAtMobile(page, role);
    if (postLoginAction) await postLoginAction(page);
    // Light first, then dark.
    await setDarkMode(page, false);
    await page.waitForTimeout(500);
    const light = await snapshotSurface({ page, label, mode: 'light', slug });
    await setDarkMode(page, true);
    await page.waitForTimeout(500);
    const dark = await snapshotSurface({ page, label, mode: 'dark', slug });
    return { light, dark };
  } finally {
    await page.close();
    await context.close();
  }
}

// Note: ManagerDashboard tab navigation lives in the sidebar, which is
// CSS-hidden at mobile (390x844). Per CLAUDE.md banked finding, mobile-viewport
// navigation into deeper panels would require mobileDispatchClick or a
// hamburger menu. For this smoke we measure the manager LANDING surface —
// the rendered border tokens are what we're verifying, not panel-specific
// behavior. Same Tailwind utility resolves the same way regardless of
// which component renders it.

(async () => {
  const browser = await chromium.launch();
  try {
    const results = [];

    // Surface 1 — Agent dashboard (mobile, post-login landing)
    results.push(
      await visitSurface({
        browser,
        role: ROLES.agent,
        label: 'AgentDashboard',
        slug: 'agent-dashboard',
      }),
    );

    // Surface 2 — Manager dashboard landing (mobile, post-login)
    results.push(
      await visitSurface({
        browser,
        role: ROLES.branchManager,
        label: 'ManagerDashboard',
        slug: 'manager-dashboard',
      }),
    );

    // Print final table
    console.log('\n=== border-border smoke results ===');
    for (const r of results) {
      console.log(
        `${r.light.label.padEnd(24)} light=${r.light.verdict.padEnd(20)} dark=${r.dark.verdict}`,
      );
      console.log(
        `  light borderColor=${r.light.borderColor ?? 'n/a'}  dark borderColor=${r.dark.borderColor ?? 'n/a'}`,
      );
    }
    const passVerdicts = new Set(['PASS', 'PASS_WITH_OPACITY_MODIFIER']);
    const allPass = results.every(
      (r) => passVerdicts.has(r.light.verdict) && passVerdicts.has(r.dark.verdict),
    );
    process.exit(allPass ? 0 : 2);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('[smoke] FAILED:', err.message);
  process.exit(1);
});
