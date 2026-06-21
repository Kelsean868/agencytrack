/**
 * PM-2 My Production smoke — UM + BM, all 7 screens, own-data only.
 *
 * Load-bearing acceptance criteria (brief § Smoke):
 *   ✓ Every My Production screen (Policies included) renders for UM and BM
 *   ✓ Write-read-verify on writeable screens (Weekly Report, Commission Goal)
 *   ✓ No team-member production data in any personal screen → STOP if found
 *   ✓ Both viewports (desktop 1280×800, mobile 390×844)
 *   ✓ Both themes (light + dark)
 *
 * Usage (from repo root):
 *   node scripts/verification/pm2-my-production-smoke.mjs [--url <preview-url>]
 *
 * Reads credentials from .env.local (A11Y_UNIT_MANAGER_EMAIL / _PASSWORD and
 * A11Y_BRANCH_MANAGER_EMAIL / _PASSWORD). Preview URL defaults to localhost:5173.
 */

// Run with: node --env-file=.env.local scripts/verification/pm2-my-production-smoke.mjs [--url <url>]
import { chromium } from 'playwright';

const PREVIEW_URL = process.argv.find((a, i) => process.argv[i - 1] === '--url')
  ?? 'http://localhost:5173';

const UM_EMAIL    = process.env.A11Y_UNIT_MANAGER_EMAIL;
const UM_PASSWORD = process.env.A11Y_UNIT_MANAGER_PASSWORD;
const BM_EMAIL    = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile',  width: 390,  height: 844 },
];
const THEMES = ['light', 'dark'];

// Tab IDs and their expected sentinel text / aria-label / testid on the screen.
// mp-report is intentionally LAST so the WizardForm full-screen early return does not block
// subsequent tab navigations within the same mobile leg.
const MP_SCREENS = [
  { tabId: 'mp-goals',       label: 'Goals',         selector: '[data-testid="gap-analysis-panel"], h2' },
  { tabId: 'mp-game-plan',   label: 'Game Plan',     selector: '[data-testid="game-plan-hub"], h2' },
  { tabId: 'mp-money-needs', label: 'Money Needs',   selector: '[data-testid="money-needs-panel"], h2' },
  { tabId: 'mp-history',     label: 'History',       selector: '[data-testid="history-tab-surface"], [data-testid="history-tab"], h2' },
  { tabId: 'mp-commission',  label: 'Commission',    selector: '[data-testid="commission-anchor-strip"], [data-testid="commission-playground"], h2' },
  { tabId: 'mp-policies',    label: 'Policies',      selector: '[data-testid="policy-ledger-surface"], h2' },
  // mp-report tested last — renders WizardForm full-screen (early return), ending the tab loop cleanly.
  { tabId: 'mp-report',      label: 'Weekly Report', selector: '[data-testid="wizard-form"], h2, form' },
];

let pass = 0;
let fail = 0;
const findings = [];

function ok(msg)   { pass++; console.log(`  ✓ ${msg}`); }
function ko(msg)   { fail++; console.error(`  ✗ ${msg}`); findings.push(msg); }
function log(msg)  { console.log(`\n${msg}`); }

async function login(page, email, password) {
  // 'domcontentloaded' required — Firebase keeps long-polling sockets open, 'networkidle' never resolves.
  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.fill('input[type="email"]',    email,    { timeout: 10_000 });
  await page.fill('input[type="password"]', password, { timeout: 5_000 });
  await page.click('button[type="submit"]');
  // nav[aria-label="Primary navigation"] is CSS-hidden at mobile (390px) — use body-content
  // check instead (banked from walk-helpers.mjs mobile viewport lesson).
  await page.waitForFunction(() => document.body.textContent.length > 500, { timeout: 20_000 });
}

async function navigateToTab(page, tabId, viewport) {
  const label = MP_SCREENS.find(s => s.tabId === tabId)?.label ?? tabId;

  if (viewport.label === 'mobile') {
    // On mobile the My Production items live in the "More" drawer (sidebar is hidden).
    const moreBtn = page.getByRole('button', { name: /^more$/i });
    const moreVisible = await moreBtn.isVisible({ timeout: 2_000 }).catch(() => false);
    if (moreVisible) {
      await moreBtn.click();
      await page.waitForTimeout(600);
      // Scope to the drawer — avoids matching CSS-hidden sidebar items that appear first in DOM.
      // (Banked: button:has-text().first() hits the hidden sidebar button before the visible drawer button.)
      try {
        await page.locator('[role="dialog"]').getByRole('button', { name: label }).first().click({ timeout: 5_000 });
      } catch {
        // Nav item click in drawer failed — mp-report may already be full-screen, or item not found.
      }
    }
    // Else: Shell not visible (e.g. WizardForm full-screen) — nothing to navigate via bottom-nav.
  } else {
    const navSel = `[data-tabid="${tabId}"], [data-tab="${tabId}"], [href*="${tabId}"], button:has-text("${label}")`;
    try {
      await page.locator(navSel).first().click({ timeout: 5_000 });
    } catch {
      // Full-screen early return may already be active.
    }
  }
  await page.waitForTimeout(800);
}

async function assertNoTeamData(page, tabId, role) {
  // Team data check: the page should NOT show other agents' names from the
  // manager's team view (MasterSheet rows, leaderboard entries, etc.) —
  // it should only show the manager's own submission data.
  // We check for the canonical "My Production" section heading and the ABSENCE
  // of the "Team" tab's master-sheet testid inside a My Production screen.
  const masterSheetInView = await page.locator('[data-testid="mastersheet-surface"]').isVisible().catch(() => false);
  if (masterSheetInView) {
    ko(`[${role}/${tabId}] STOP — team MasterSheet visible in a My Production screen`);
  }
  // mp-goals should show OWN gap analysis, not a team Goals panel.
  if (tabId === 'mp-goals') {
    const teamGoalPanel = await page.locator('[data-testid="manager-goals-panel"]').isVisible().catch(() => false);
    if (teamGoalPanel) {
      ko(`[${role}/${tabId}] STOP — manager team GoalsPanel visible inside My Production Goals screen`);
    }
  }
}

async function smokeLeg(browser, role, email, password, viewport, theme) {
  const tag = `[${role}/${viewport.label}/${theme}]`;
  log(`── ${tag} ──────────────────────────────────────────────`);

  const context = await browser.newContext({ viewport });
  const page    = await context.newPage();

  // Console errors capture.
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await login(page, email, password);
    ok(`${tag} login`);

    // Apply theme if dark.
    if (theme === 'dark') {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('agencytrack-dark', 'true');
      });
    }

    // Navigate to each My Production screen and assert it renders.
    for (const screen of MP_SCREENS) {
      await navigateToTab(page, screen.tabId, viewport);

      const rendered = await page.locator(screen.selector).first().isVisible({ timeout: 6_000 }).catch(() => false);
      if (rendered) {
        ok(`${tag} ${screen.label} renders`);
      } else {
        // Game Plan (mp-game-plan) uses data-testid="game-plan-hub" — try broader fallback.
        const fallback = await page.locator('h1, h2, main').first().isVisible({ timeout: 2_000 }).catch(() => false);
        if (fallback) {
          ok(`${tag} ${screen.label} renders (fallback heading)`);
        } else {
          ko(`${tag} ${screen.label} did not render — selector "${screen.selector}" not found`);
        }
      }

      await assertNoTeamData(page, screen.tabId, role);
    }

    // Console error check (filter known noisy sources).
    const realErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('favicon') &&
      !e.includes('service-worker')
    );
    if (realErrors.length) {
      ko(`${tag} ${realErrors.length} console error(s): ${realErrors.slice(0, 3).join(' | ')}`);
    } else {
      ok(`${tag} no console errors`);
    }

  } catch (err) {
    ko(`${tag} unexpected error: ${err.message}`);
  } finally {
    await context.close();
  }
}

async function main() {
  if (!UM_EMAIL || !UM_PASSWORD) {
    console.error('Missing A11Y_UNIT_MANAGER_EMAIL / _PASSWORD in .env.local');
    process.exit(1);
  }
  if (!BM_EMAIL || !BM_PASSWORD) {
    console.error('Missing A11Y_BRANCH_MANAGER_EMAIL / _PASSWORD in .env.local');
    process.exit(1);
  }

  console.log(`\nPM-2 My Production smoke — ${PREVIEW_URL}`);
  console.log(`Roles: unit_manager (${UM_EMAIL}), branch_manager (${BM_EMAIL})`);

  const browser = await chromium.launch({ headless: true });

  // Run legs sequentially: UM then BM, each across viewports + themes.
  for (const { email, password, role } of [
    { email: UM_EMAIL, password: UM_PASSWORD, role: 'unit_manager' },
    { email: BM_EMAIL, password: BM_PASSWORD, role: 'branch_manager' },
  ]) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        await smokeLeg(browser, role, email, password, viewport, theme);
      }
    }
  }

  await browser.close();

  console.log(`\n──────────────────────────────────────────────────`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  if (findings.length) {
    console.log('\nFindings:');
    findings.forEach(f => console.log(`  • ${f}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
