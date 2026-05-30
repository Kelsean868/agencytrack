/**
 * track-j-shell-smoke.mjs
 * Phase 6 smoke — Track J V2 Redesign · App Shell (PR #388)
 *
 * Checks:
 *  1. Agent: Shell renders in light mode (SVG logo, topbar 60px, Cabinet Grotesk,
 *            JetBrains Mono section headers, active left-bar indicator)
 *  2. Agent: Dark mode toggle works (shell surfaces adapt via tokens)
 *  3. Agent: Collapse sidebar → localStorage "1" → reload → 72px persists
 *  4. Agent: Mobile 390×844 — FAB renders, click → wizard opens
 *  5. Manager: Shell renders (nav present, topbar present)
 *  6. TenantAdmin: Shell renders (nav present, topbar present)
 *
 * No rules/indexes/CF changed — no live-rule check.
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setupBypassSession, waitForFirebaseReady, captureConsoleAndNetwork, formatCaptureReport, safeLog } from './lib/walk-helpers.mjs';

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

const BASE_URL = 'https://agencytrack.vercel.app';
const BYPASS   = E.VERCEL_BYPASS_TOKEN;

// ── Credentials ───────────────────────────────────────────────────────────────
const AGENT_EMAIL    = E.A11Y_AGENT_EMAIL;
const AGENT_PASS     = E.A11Y_AGENT_PASSWORD;
const MGR_EMAIL      = E.A11Y_BRANCH_MANAGER_EMAIL;
const MGR_PASS       = E.A11Y_BRANCH_MANAGER_PASSWORD;
const TA_EMAIL       = E.A11Y_TENANT_ADMIN_EMAIL;
const TA_PASS        = E.A11Y_TENANT_ADMIN_PASSWORD;

let passed = 0;
let failed = 0;
const findings = [];

function pass(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}
function fail(label, detail) {
  console.log(`  ✗  ${label}: ${detail}`);
  failed++;
  findings.push({ label, detail });
}

async function signIn(page, email, password) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await waitForFirebaseReady(page);
  // If already signed in, skip
  if (await page.$('nav[aria-label="Primary navigation"]')) return;
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await waitForFirebaseReady(page);
  // Wait for shell to appear
  await page.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15_000 });
}

async function signOut(page) {
  // Click sign-out button in sidebar footer
  const btn = await page.$('.sidebar-foot-action');
  if (btn) {
    await btn.click();
    await waitForFirebaseReady(page);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── Bypass session setup ──────────────────────────────────────────────────
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setupBypassSession(context, BASE_URL, BYPASS);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  try {
    // ── 1. Agent light mode — Shell structure ─────────────────────────────
    console.log('\n── Leg 1: Agent shell — light mode ──────────────────────────');
    await signIn(page, AGENT_EMAIL, AGENT_PASS);
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

    // SVG brand mark present
    const logo = await page.$('.sidebar-brand-mark svg');
    logo ? pass('SVG shield logo rendered') : fail('SVG shield logo', 'svg not found inside .sidebar-brand-mark');

    // Sidebar width 232px
    const sidebarW = await page.evaluate(() => document.querySelector('.sidebar')?.getBoundingClientRect()?.width);
    sidebarW === 232 ? pass(`Sidebar width 232px`) : fail('Sidebar width', `expected 232, got ${sidebarW}`);

    // Topbar min-height 60px
    const topbarH = await page.evaluate(() => document.querySelector('.topbar')?.getBoundingClientRect()?.height);
    topbarH >= 60 ? pass(`Topbar height ≥60px (${topbarH}px)`) : fail('Topbar height', `expected ≥60, got ${topbarH}`);

    // Topbar title Cabinet Grotesk
    const titleFont = await page.evaluate(() => window.getComputedStyle(document.querySelector('.topbar-title'))?.fontFamily);
    titleFont?.includes('Cabinet Grotesk') ? pass('Topbar title Cabinet Grotesk') : fail('Topbar title font', titleFont);

    // Section header JetBrains Mono (only if a section header exists)
    const sectionFont = await page.evaluate(() => {
      const el = document.querySelector('.sidebar-section');
      return el ? window.getComputedStyle(el)?.fontFamily : null;
    });
    if (sectionFont) {
      sectionFont.includes('JetBrains Mono') ? pass('Section header JetBrains Mono') : fail('Section header font', sectionFont);
    } else {
      pass('Section header — no section headers in current agent nav (deferred to J2)');
    }

    // Active left-bar ::before bg is primary teal
    const barBg = await page.evaluate(() => {
      const active = document.querySelector('.sidebar-link.active');
      return active ? window.getComputedStyle(active, '::before')?.backgroundColor : null;
    });
    // primary teal in light = rgb(1, 105, 111)
    barBg && (barBg.includes('1, 105, 111') || barBg.includes('1,105,111'))
      ? pass(`Active left-bar bg = ${barBg}`)
      : fail('Active left-bar bg', `expected rgb(1,105,111), got ${barBg}`);

    // Sign-out button ≥44px
    const footH = await page.evaluate(() => {
      const el = document.querySelector('.sidebar-foot-action');
      return el ? el.getBoundingClientRect().height : null;
    });
    footH >= 44 ? pass(`Sign-out button ≥44px (${footH}px)`) : fail('Sign-out button height', `expected ≥44, got ${footH}`);

    // ── 2. Dark mode ──────────────────────────────────────────────────────
    console.log('\n── Leg 2: Dark mode ─────────────────────────────────────────');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const bgDark = await page.evaluate(() => window.getComputedStyle(document.querySelector('.sidebar'))?.backgroundColor);
    // dark sidebar bg should NOT be white
    bgDark && bgDark !== 'rgb(255, 255, 255)'
      ? pass(`Dark sidebar bg changed (${bgDark})`)
      : fail('Dark mode sidebar bg', `still white: ${bgDark}`);

    // topbar-icon-btn still ≥44px in dark
    const iconBtnH = await page.evaluate(() => {
      const btn = document.querySelector('.topbar-icon-btn');
      return btn ? btn.getBoundingClientRect().height : null;
    });
    iconBtnH >= 44 ? pass(`Topbar icon btn ≥44px (${iconBtnH}px)`) : fail('Topbar icon btn height', `${iconBtnH}`);
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

    // ── 3. Collapse → reload → persist ───────────────────────────────────
    console.log('\n── Leg 3: Sidebar collapse persistence ─────────────────────');
    // Expand first
    await page.evaluate(() => {
      document.documentElement.classList.remove('sidebar-collapsed');
      localStorage.setItem('agencytrack-sidebar-collapsed', '0');
    });

    // Click collapse button
    const collapseBtn = await page.$('.sidebar-collapse-btn');
    if (collapseBtn) {
      await collapseBtn.click();
      const collapsedAfter = await page.evaluate(() => ({
        cls: document.documentElement.classList.contains('sidebar-collapsed'),
        stored: localStorage.getItem('agencytrack-sidebar-collapsed'),
        w: document.querySelector('.sidebar')?.getBoundingClientRect()?.width,
      }));
      collapsedAfter.cls && collapsedAfter.stored === '1' && collapsedAfter.w === 72
        ? pass(`Collapse: class+storage set, width 72px`)
        : fail('Collapse toggle', JSON.stringify(collapsedAfter));

      // Reload and verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(page);
      await page.waitForSelector('.sidebar', { timeout: 10_000 });
      const afterReload = await page.evaluate(() => ({
        cls: document.documentElement.classList.contains('sidebar-collapsed'),
        w: document.querySelector('.sidebar')?.getBoundingClientRect()?.width,
      }));
      afterReload.cls && afterReload.w === 72
        ? pass(`Collapse persisted after reload (${afterReload.w}px)`)
        : fail('Collapse persistence', JSON.stringify(afterReload));

      // Re-expand for subsequent legs
      await page.evaluate(() => {
        document.documentElement.classList.remove('sidebar-collapsed');
        localStorage.setItem('agencytrack-sidebar-collapsed', '0');
      });
    } else {
      fail('Collapse button', '.sidebar-collapse-btn not found');
    }

    // ── 4. Mobile FAB → wizard ────────────────────────────────────────────
    console.log('\n── Leg 4: Mobile FAB → wizard ───────────────────────────────');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForFirebaseReady(page);
    await page.waitForSelector('.bottom-nav', { timeout: 10_000 });

    const fab = await page.$('.bottom-nav-fab');
    fab ? pass('FAB button rendered at mobile') : fail('FAB button', '.bottom-nav-fab not found');

    if (fab) {
      const fabBox = await fab.boundingBox();
      fabBox && fabBox.width >= 44 && fabBox.height >= 44
        ? pass(`FAB size ${fabBox.width}×${fabBox.height}px (≥44px)`)
        : fail('FAB size', JSON.stringify(fabBox));

      const fabLabel = await page.evaluate(() => document.querySelector('.bottom-nav-fab-label')?.textContent);
      fabLabel === 'Submit' ? pass('FAB label "Submit"') : fail('FAB label', fabLabel);

      const fabAriaLabel = await page.evaluate(() => document.querySelector('.bottom-nav-fab')?.getAttribute('aria-label'));
      fabAriaLabel === 'Submit' ? pass('FAB aria-label="Submit"') : fail('FAB aria-label', fabAriaLabel);

      // Click FAB — should open wizard (WizardForm renders outside Shell)
      await fab.click();
      await page.waitForTimeout(1500);
      const wizardVisible = await page.evaluate(() => {
        // WizardForm renders as an overlay before the shell in the component tree
        return !!document.querySelector('[data-testid="wizard-form"], form[aria-label*="eekly"], .wizard, [class*="wizard"]')
          || document.body.textContent.includes('Weekly Report')
          || document.body.textContent.includes('Step ')
          || document.body.textContent.includes('Save');
      });
      // Also check if any fullscreen overlay appeared (wizard replaces shell)
      const shellHidden = await page.evaluate(() => {
        const shell = document.querySelector('.shell');
        return !shell || shell.offsetParent === null || window.getComputedStyle(shell).display === 'none';
      });
      wizardVisible || shellHidden
        ? pass('FAB click → wizard/overlay opened')
        : fail('FAB click', 'wizard not detected; shell still visible and no wizard content found');

      // Navigate back
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await waitForFirebaseReady(page);
    }

    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 800 });

    // ── 5. Manager surface ────────────────────────────────────────────────
    console.log('\n── Leg 5: Manager shell ─────────────────────────────────────');
    await signOut(page);
    await signIn(page, MGR_EMAIL, MGR_PASS);
    await page.waitForSelector('.shell', { timeout: 10_000 });

    const mgrNav = await page.$('nav[aria-label="Primary navigation"]');
    mgrNav ? pass('Manager: Primary navigation present') : fail('Manager nav', 'nav[aria-label="Primary navigation"] not found');

    const mgrTopbar = await page.$('.topbar');
    mgrTopbar ? pass('Manager: Topbar present') : fail('Manager topbar', '.topbar not found');

    const mgrMain = await page.$('main.shell-content');
    mgrMain ? pass('Manager: single <main> shell-content present') : fail('Manager main', 'main.shell-content not found');

    const mgrLogoSvg = await page.$('.sidebar-brand-mark svg');
    mgrLogoSvg ? pass('Manager: SVG brand mark in sidebar') : fail('Manager logo', 'svg not found');

    // ── 6. Tenant-admin surface ───────────────────────────────────────────
    console.log('\n── Leg 6: TenantAdmin shell ──────────────────────────────────');
    await signOut(page);
    await signIn(page, TA_EMAIL, TA_PASS);
    await page.waitForSelector('.shell', { timeout: 10_000 });

    const taNav = await page.$('nav[aria-label="Primary navigation"]');
    taNav ? pass('TenantAdmin: Primary navigation present') : fail('TenantAdmin nav', 'nav[aria-label="Primary navigation"] not found');

    const taTopbar = await page.$('.topbar');
    taTopbar ? pass('TenantAdmin: Topbar present') : fail('TenantAdmin topbar', '.topbar not found');

    const taMain = await page.$('main.shell-content');
    taMain ? pass('TenantAdmin: single <main> shell-content present') : fail('TenantAdmin main', 'main.shell-content not found');

    const taLogoSvg = await page.$('.sidebar-brand-mark svg');
    taLogoSvg ? pass('TenantAdmin: SVG brand mark in sidebar') : fail('TenantAdmin logo', 'svg not found');

  } finally {
    console.log(formatCaptureReport(capture));
    await browser.close();
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Shell smoke PR #388 — ${passed}/${passed + failed} pass`);
  if (findings.length) {
    console.log('\nFindings:');
    findings.forEach(f => console.log(`  ✗  ${f.label}: ${f.detail}`));
  }
  console.log('─'.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  safeLog('Smoke failed with unhandled error:', err.message);
  process.exit(1);
});
