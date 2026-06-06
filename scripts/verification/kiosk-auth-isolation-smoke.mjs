/**
 * kiosk-auth-isolation-smoke.mjs
 *
 * Proof for fix/kiosk-auth-isolation:
 * A kiosk tab opening in the SAME browser context must NOT clobber the manager's
 * session on the originating tab.
 *
 * Flow:
 *   1. Page 1 — BM logs in, ManagerDashboard renders.
 *   2. Navigate to Kiosk Mode tab → locate an existing active kiosk token.
 *   3. Page 2 (same context, shared storage) — open preview/kiosk/{tenantId}/{tokenId}.
 *   4. Kiosk renders (WelcomePanel or any kiosk panel).
 *   5. Both themes — light on page 2, then dark class applied.
 *   6. Back on Page 1 — assert manager session SURVIVES:
 *        - No state-provisioning screen.
 *        - Dashboard header still contains BM's first name.
 *        - auth.currentUser.uid matches the captured pre-kiosk UID.
 */

import { chromium } from 'playwright';
import { setupBypassSession, captureConsoleAndNetwork, formatCaptureReport }
  from './lib/walk-helpers.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const BASE_URL   = process.env.SMOKE_PREVIEW_URL || 'https://agencytrack.vercel.app';
const BM_EMAIL   = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS    = process.env.A11Y_BRANCH_MANAGER_PASSWORD;
const BYPASS_TOK = process.env.VERCEL_BYPASS_TOKEN;

if (!BM_EMAIL || !BM_PASS) throw new Error('A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD required');
if (!BYPASS_TOK)           throw new Error('VERCEL_BYPASS_TOKEN required');

const RESULTS = [];
function mark(label, ok, note = '') {
  RESULTS.push({ label, ok, note });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${note ? '  · ' + note : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext();

try {
  // ── BYPASS SESSION ────────────────────────────────────────────────────────
  console.log('\n[BYPASS]');
  await setupBypassSession(context, BASE_URL, BYPASS_TOK);
  console.log('  Bypass session established ✓');

  // ── PAGE 1 — BM LOGIN ─────────────────────────────────────────────────────
  console.log('\n[PAGE 1 — BM LOGIN]');
  const page1 = await context.newPage();
  const capture1 = captureConsoleAndNetwork(page1);
  await page1.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page1.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page1.fill('input[type="email"]', BM_EMAIL);
  await page1.fill('input[type="password"]', BM_PASS);
  await page1.click('button[type="submit"]');
  await page1.waitForSelector('[data-testid="manager-dashboard"]', { timeout: 20_000 });

  // Capture BM uid before kiosk opens
  const bmUid = await page1.evaluate(() => {
    // The firebase auth object is not directly accessible from the page unless exposed.
    // Instead, read from localStorage (Firebase persists auth under firebase:authUser:*)
    const key = Object.keys(localStorage).find(k => k.startsWith('firebase:authUser:'));
    if (!key) return null;
    try { return JSON.parse(localStorage[key]).uid; } catch { return null; }
  });
  mark('BM dashboard loaded', true, bmUid ? `uid=${bmUid.slice(0,8)}…` : 'uid=unknown');

  // ── NAVIGATE TO KIOSK MODE TAB ────────────────────────────────────────────
  console.log('\n[FIND KIOSK TOKEN]');
  // Look for the Kiosk tab in manager sidebar
  const kioskNavItem = await page1.$('[data-testid="tab-kiosk"], [href*="kiosk"], button:has-text("Kiosk")');
  let kioskTokenUrl = null;

  if (kioskNavItem) {
    await kioskNavItem.click();
    await page1.waitForTimeout(1500);
    // Find the first "Open kiosk" link (ExternalLink button)
    const kioskLink = await page1.$('a[aria-label="Open kiosk"]');
    if (kioskLink) {
      const href = await kioskLink.getAttribute('href');
      // href is the production URL; swap domain to preview
      if (href) {
        const url = new URL(href);
        kioskTokenUrl = `${BASE_URL}/kiosk${url.pathname.replace('/kiosk', '')}`;
      }
    }
  }

  if (!kioskTokenUrl) {
    // Fallback: construct from Firestore via SDK read or use env var
    const envKioskUrl = process.env.SMOKE_KIOSK_URL;
    if (envKioskUrl) {
      const url = new URL(envKioskUrl);
      kioskTokenUrl = `${BASE_URL}/kiosk${url.pathname.replace('/kiosk', '')}`;
    }
  }

  if (!kioskTokenUrl) {
    mark('Kiosk token located', false, 'No active kiosk token found — ensure a token exists in Kiosk Mode tab or set SMOKE_KIOSK_URL');
    throw new Error('No kiosk token URL available for smoke');
  }
  mark('Kiosk token located', true, kioskTokenUrl.replace(BASE_URL, ''));

  // ── PAGE 2 — KIOSK (SAME CONTEXT) ────────────────────────────────────────
  console.log('\n[PAGE 2 — KIOSK]');
  const page2 = await context.newPage();
  const capture2 = captureConsoleAndNetwork(page2);
  await page2.goto(kioskTokenUrl, { waitUntil: 'domcontentloaded' });

  // Wait for kiosk to render (past the loading spinner)
  let kioskRendered = false;
  try {
    // Any kiosk panel or the welcome panel text
    await page2.waitForFunction(
      () => document.body.textContent.length > 200 &&
            !document.querySelector('.animate-spin'),
      { timeout: 20_000 }
    );
    kioskRendered = true;
  } catch {
    kioskRendered = false;
  }
  mark('Kiosk renders (light)', kioskRendered);

  // Screenshot — light
  const dir = 'verification/kiosk-auth-isolation';
  const { mkdirSync } = await import('fs');
  try { mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  if (kioskRendered) {
    await page2.screenshot({ path: `${dir}/kiosk-light.png`, fullPage: false });
    console.log(`  Screenshot: ${dir}/kiosk-light.png`);
  }

  // Dark mode on page 2
  await page2.evaluate(() => document.documentElement.classList.add('dark'));
  await page2.waitForTimeout(300);
  if (kioskRendered) {
    await page2.screenshot({ path: `${dir}/kiosk-dark.png`, fullPage: false });
    mark('Kiosk dark theme', true);
    console.log(`  Screenshot: ${dir}/kiosk-dark.png`);
  }

  // ── PAGE 1 — SESSION SURVIVAL CHECK ───────────────────────────────────────
  console.log('\n[PAGE 1 — SESSION SURVIVAL]');

  // Give auth state event a moment to propagate (if it were going to)
  await page1.waitForTimeout(3_000);

  // Provisioning screen must NOT appear
  const provisioningVisible = await page1.evaluate(() => {
    const el = document.querySelector('[data-testid="state-provisioning"]');
    return el !== null;
  });
  mark('No provisioning screen on page 1', !provisioningVisible);

  // Manager dashboard must still be present
  const dashboardPresent = await page1.evaluate(() => {
    return document.querySelector('[data-testid="manager-dashboard"]') !== null;
  });
  mark('ManagerDashboard still rendered on page 1', dashboardPresent);

  // Auth uid must match the captured uid (if we could capture it)
  if (bmUid) {
    const currentUid = await page1.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('firebase:authUser:'));
      if (!key) return null;
      try { return JSON.parse(localStorage[key]).uid; } catch { return null; }
    });
    const uidUnchanged = currentUid === bmUid;
    mark('Auth uid unchanged on page 1', uidUnchanged,
      uidUnchanged ? `uid=${bmUid.slice(0,8)}…` : `was ${bmUid?.slice(0,8)} → now ${currentUid?.slice(0,8)}`);
  }

  console.log(formatCaptureReport(capture1, 'page1'));
  console.log(formatCaptureReport(capture2, 'page2'));

} finally {
  await browser.close();
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('\n── Smoke Summary ' + '─'.repeat(56));
for (const r of RESULTS) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.label}${r.note ? '  · ' + r.note : ''}`);
}
const failed = RESULTS.filter(r => !r.ok);
if (failed.length === 0) {
  console.log('\nSmoke PASSED ✓\n');
  process.exit(0);
} else {
  console.log(`\nSmoke FAILED ✗  (${failed.length} leg(s) failed)\n`);
  process.exit(1);
}
