/**
 * mgr-mobile-audit.cjs
 *
 * Programmatic mobile audit of all manager screens at 390×844.
 * Runs against production (no bypass needed) as branch_manager.
 *
 * Usage:
 *   node scripts/mgr-mobile-audit.cjs
 *   node scripts/mgr-mobile-audit.cjs --url=https://agencytrack.vercel.app
 *
 * Outputs:
 *   - Screenshots to verification/mgr-mobile-audit/
 *   - Structured report to verification/mgr-mobile-audit/report.json
 *   - Console summary
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// ── Load .env.local ─────────────────────────────────────────────────────────
(function loadEnv() {
  const p = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line) => {
    const l = line.trim();
    if (!l || l.startsWith('#')) return;
    const eq = l.indexOf('=');
    if (eq === -1) return;
    const k = l.slice(0, eq).trim();
    let v   = l.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  });
})();

function arg(name, fallback) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.replace(`--${name}=`, '') : fallback;
}

const BASE_URL = arg('url', process.env.A11Y_BASE_URL || 'https://agencytrack.vercel.app');
const BYPASS   = process.env.VERCEL_BYPASS_TOKEN || '';
const EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD in .env.local');
  process.exit(1);
}

const VIEWPORT = { width: 390, height: 844 };
const OUT_DIR  = path.resolve(process.cwd(), 'verification', 'mgr-mobile-audit');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Bypass detection (mirrors exploration-walk.cjs pattern)
function needsBypass(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'agencytrack.vercel.app') return false;
    if (u.hostname.endsWith('.vercel.app'))      return !!BYPASS;
    return false;
  } catch { return false; }
}
const USE_BYPASS = needsBypass(BASE_URL);

// ── Screen definitions ───────────────────────────────────────────────────────
// reachable: how to navigate on mobile
//   'bottomnav' — click the BOTTOM_NAV button (visible at <768px)
//   'sidebar'   — sidebar link only, hidden at <768px (nav gap finding)
const SCREENS = [
  { id: 'overview',           label: 'Overview / Manager Dashboard', reachable: 'bottomnav', bottomNavLabel: 'Dashboard' },
  { id: 'team',               label: 'Team',                         reachable: 'bottomnav', bottomNavLabel: 'Team'      },
  { id: 'campaigns',          label: 'Campaigns',                    reachable: 'bottomnav', bottomNavLabel: 'Campaigns' },
  { id: 'mastersheet',        label: 'Master Sheet',                 reachable: 'bottomnav', bottomNavLabel: 'Reports'   },
  { id: 'profile',            label: 'Profile',                      reachable: 'bottomnav', bottomNavLabel: 'Profile'   },
  // Sidebar-only screens — unreachable from mobile bottom-nav
  { id: 'production-report',  label: 'Production Report',            reachable: 'sidebar', sidebarText: 'Production Report' },
  { id: 'awards',             label: 'Awards',                       reachable: 'sidebar', sidebarText: 'Awards'            },
  { id: 'compliance',         label: 'Compliance',                   reachable: 'sidebar', sidebarText: 'Compliance'        },
  { id: 'persistency',        label: 'Persistency',                  reachable: 'sidebar', sidebarText: 'Persistency'       },
  { id: 'goals',              label: 'Goals',                        reachable: 'sidebar', sidebarText: 'Goals'             },
  { id: 'settlements',        label: 'Settlements',                  reachable: 'sidebar', sidebarText: 'Settlements'       },
  { id: 'leaderboard',        label: 'Leaderboard',                  reachable: 'sidebar', sidebarText: 'Leaderboard'       },
  { id: 'agent-of-month',     label: 'Agent of Month',               reachable: 'sidebar', sidebarText: 'Agent of Month'    },
  { id: 'kiosk',              label: 'Kiosk',                        reachable: 'sidebar', sidebarText: 'Kiosk'             },
];

// ── Programmatic audit checks ────────────────────────────────────────────────
const AUDIT_SCRIPT = `
(() => {
  const W = window.innerWidth;
  const H = window.innerHeight;

  // 1. Horizontal scroll
  const hScrollPx = Math.max(0, document.documentElement.scrollWidth - W);

  // 2. Touch targets < 44px (buttons, links, role=button/tab/link, summary)
  const selectors = ['button', 'a[href]', '[role="button"]', '[role="tab"]', '[role="link"]', 'summary'];
  const smallTargets = [];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return; // not rendered
      if (r.width < 44 || r.height < 44) {
        const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.tagName;
        smallTargets.push({
          tag: el.tagName,
          label,
          w: Math.round(r.width),
          h: Math.round(r.height),
          x: Math.round(r.left),
          y: Math.round(r.top),
        });
      }
    });
  });

  // 3. Off-screen elements (right > W + 2px tolerance, not inside overflow-x container)
  const offScreen = [];
  function hasHScrollAncestor(el) {
    let p = el.parentElement;
    while (p) {
      const s = window.getComputedStyle(p).overflowX;
      if (s === 'auto' || s === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  }
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > W + 2 && r.width > 0 && r.height > 0 && !hasHScrollAncestor(el)) {
      const cls = el.className?.toString?.()?.slice(0, 60) || '';
      offScreen.push({ tag: el.tagName, cls, right: Math.round(r.right), w: Math.round(r.width) });
    }
  });

  // 4. Input font-size check (iOS zoom trigger < 16px)
  const smallInputs = [];
  document.querySelectorAll('input, textarea, select').forEach(el => {
    const fs = parseFloat(window.getComputedStyle(el).fontSize);
    if (fs < 16) {
      smallInputs.push({ tag: el.tagName, type: el.type || '', fs: Math.round(fs * 10) / 10 });
    }
  });

  // 5. Tap-blocked: interactive elements with pointer-events: none
  const tapBlocked = [];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const s = window.getComputedStyle(el);
      if (s.pointerEvents === 'none') {
        const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || el.tagName;
        tapBlocked.push({ tag: el.tagName, label });
      }
    });
  });

  // 6. Count interactive elements total (sanity check the screen actually loaded)
  const interactiveCount = document.querySelectorAll(selectors.join(',')).length;

  return {
    hScrollPx,
    smallTargets,
    offScreen: offScreen.slice(0, 20), // cap to avoid huge output
    smallInputs,
    tapBlocked,
    interactiveCount,
    viewportW: W,
    bodyScrollW: document.documentElement.scrollWidth,
  };
})()
`;

async function waitForContent(page, timeout = 8000) {
  // Wait for any loading skeleton/spinner to disappear and real content to render
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200); // allow React render + data fetches
}

async function auditScreen(page, screen, consoleErrors) {
  const result = {
    id: screen.id,
    label: screen.label,
    reachable: screen.reachable,
    navigated: false,
    navMethod: null,
    hScrollPx: 0,
    smallTargets: [],
    offScreen: [],
    smallInputs: [],
    tapBlocked: [],
    interactiveCount: 0,
    consoleErrors: [],
    screenshot: null,
    notes: [],
  };

  // Snapshot console errors that appeared during this screen
  const errsBefore = consoleErrors.length;

  try {
    if (screen.reachable === 'bottomnav') {
      // Click via the mobile bottom-nav button (visible at <768px)
      const btn = page.locator(`.bottom-nav-item`).filter({ hasText: screen.bottomNavLabel });
      await btn.waitFor({ timeout: 5000 });
      await btn.click();
      result.navigated = true;
      result.navMethod = 'bottom-nav';
    } else {
      // Sidebar-only — dispatch click directly to bypass display:none on parent
      // The sidebar is display:none at <768px; Playwright force-click still
      // refuses hidden parent containers, so we use DOM .click() via evaluate.
      const clicked = await page.evaluate((text) => {
        const btns = document.querySelectorAll('[data-testid^="nav-"], .sidebar-link');
        for (const btn of btns) {
          if (btn.textContent?.trim().includes(text)) {
            btn.click();
            return true;
          }
        }
        return false;
      }, screen.sidebarText);

      if (clicked) {
        result.navigated = true;
        result.navMethod = 'sidebar-eval';
        result.notes.push('NAV_GAP: Reached via JS eval on hidden sidebar (display:none at <768px). Mobile users cannot navigate here via the UI.');
      } else {
        result.notes.push('NAV_GAP: Sidebar button not found via text match — screen may be role-restricted or label differs.');
        result.navigated = false;
      }
    }

    await waitForContent(page);

    // Capture console errors for this screen
    result.consoleErrors = consoleErrors.slice(errsBefore);

    // Run programmatic checks
    const checks = await page.evaluate(AUDIT_SCRIPT);
    Object.assign(result, checks);

    // Screenshot
    const fname = `${screen.id}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, fname), fullPage: false });
    result.screenshot = fname;

  } catch (e) {
    result.notes.push(`ERROR: ${e.message?.slice(0, 200)}`);
  }

  return result;
}

(async () => {
  console.log(`[mgr-mobile-audit] url=${BASE_URL} viewport=${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`[mgr-mobile-audit] role=branch_manager bypass=${USE_BYPASS ? 'on' : 'off'}`);

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: VIEWPORT });
  const page    = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${String(err)}`));

  try {
    // ── Apply bypass cookie if needed ──────────────────────────────────────
    if (USE_BYPASS) {
      const u = new URL(BASE_URL);
      u.searchParams.set('x-vercel-protection-bypass', BYPASS);
      u.searchParams.set('x-vercel-set-bypass-cookie', 'samesitenone');
      await page.goto(u.toString(), { waitUntil: 'domcontentloaded' });
    }

    // ── Navigate to app ────────────────────────────────────────────────────
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });

    // ── Log in ─────────────────────────────────────────────────────────────
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for manager dashboard to load (look for bottom-nav which appears at <768px)
    await page.waitForSelector('.bottom-nav', { timeout: 15000 });
    await page.waitForTimeout(1500); // allow data fetches on initial load

    console.log('[mgr-mobile-audit] Logged in — bottom-nav visible. Starting screen audit...\n');

    // ── Audit each screen ──────────────────────────────────────────────────
    const results = [];
    for (const screen of SCREENS) {
      process.stdout.write(`  Auditing: ${screen.label.padEnd(30)} `);
      const r = await auditScreen(page, screen, consoleErrors);
      results.push(r);

      const flags = [];
      if (r.hScrollPx > 0)           flags.push(`hScroll=${r.hScrollPx}px`);
      if (r.smallTargets.length > 0)  flags.push(`smallTargets=${r.smallTargets.length}`);
      if (r.offScreen.length > 0)     flags.push(`offScreen=${r.offScreen.length}`);
      if (r.smallInputs.length > 0)   flags.push(`smallInputs=${r.smallInputs.length}`);
      if (r.consoleErrors.length > 0) flags.push(`consoleErrors=${r.consoleErrors.length}`);
      if (r.notes.length > 0)         flags.push(`notes=${r.notes.length}`);

      const status = flags.length > 0 ? `⚠ ${flags.join(' | ')}` : '✓ clean';
      console.log(`[${r.navMethod || 'FAIL'}] ${status}`);
    }

    // ── Save report ────────────────────────────────────────────────────────
    const report = {
      auditedAt:  new Date().toISOString(),
      url:        BASE_URL,
      viewport:   VIEWPORT,
      role:       'branch_manager',
      screens:    results,
    };
    const reportPath = path.join(OUT_DIR, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n[mgr-mobile-audit] Report saved → ${reportPath}`);
    console.log(`[mgr-mobile-audit] Screenshots  → ${OUT_DIR}`);

  } finally {
    await browser.close();
  }
})();
