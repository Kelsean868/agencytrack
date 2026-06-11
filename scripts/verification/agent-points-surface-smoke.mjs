/**
 * agent-points-surface-smoke.mjs
 * Pre-merge smoke for feat/agent-points-surface (PR #561).
 *
 * Acceptance criteria (both light + dark):
 *   P1. MyPointsCard is present in the agent home DOM (either empty or loaded state)
 *   P2. Info-icon button is present and has aria-label "How points work"
 *   P3. Clicking info-icon opens PointsInfoPanel (role="dialog" visible)
 *   P4. Panel body contains "Application sold" with "+25 pts"
 *   P5. Panel body contains a level title ("Rookie") and its threshold ("0")
 *   P6. Panel body contains a badge name ("First Step")
 *   P7. Closing the panel (X button) removes the dialog from the DOM
 *   P8. No unexpected console errors during the flow
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch {}
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const AGENT_EMAIL  = requireEnv('A11Y_AGENT_EMAIL');
const AGENT_PASS   = requireEnv('A11Y_AGENT_PASSWORD');
const PREVIEW_HOST = 'agencytrack-git-feat-agent-poin-28389e-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL  = `https://${PREVIEW_HOST}`;

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true,  note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };

async function loginAndWait(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', AGENT_EMAIL);
  await page.fill('input[type="password"]', AGENT_PASS);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(2500);
}

async function setDarkMode(page, wantDark) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (isDark === wantDark) return;
  await page.evaluate((d) => {
    document.documentElement.classList.toggle('dark', d);
    try { localStorage.setItem('agencytrack-dark', d ? 'true' : 'false'); } catch {}
  }, wantDark);
  await page.waitForTimeout(400);
}

async function runTheme(browser, theme) {
  console.log(`\n=== ${theme.toUpperCase()} MODE ===`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(context, PREVIEW_URL, BYPASS_TOKEN);
  const page = await context.newPage();
  const capture = captureConsoleAndNetwork(page);

  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded' });
  try {
    await loginAndWait(page);
  } catch (e) {
    fail(`${theme}-login`, e.message);
    await context.close();
    return;
  }
  console.log('  login: ok');
  await setDarkMode(page, theme === 'dark');

  // Land on dashboard Home tab
  try {
    await page.locator('[data-testid="agent-tab-dashboard"]').click();
    await page.waitForTimeout(2000);
  } catch {
    // might already be on home
    await page.waitForTimeout(1000);
  }

  // ── P1: MyPointsCard present in DOM ───────────────────────────────────────
  const cardText = await page.evaluate(() => {
    const body = document.body.textContent || '';
    // Card header label in both empty and loaded states
    return body.includes('My Points');
  });
  cardText
    ? pass(`${theme}-P1-card-present`, 'My Points label in DOM')
    : fail(`${theme}-P1-card-present`, 'My Points label not found');

  // ── P2: Info-icon button with correct aria-label ───────────────────────────
  const infoBtn = page.getByRole('button', { name: /how points work/i });
  const infoBtnVisible = await infoBtn.isVisible({ timeout: 5000 }).catch(() => false);
  infoBtnVisible
    ? pass(`${theme}-P2-info-btn`, 'aria-label "How points work" button visible')
    : fail(`${theme}-P2-info-btn`, 'info-icon button not found or not visible');

  if (!infoBtnVisible) {
    console.log(`  Skipping P3–P7 (info button not present)`);
    console.log(formatCaptureReport(capture));
    await context.close();
    return;
  }

  // ── P3: Click info-icon → panel opens ─────────────────────────────────────
  await infoBtn.click();
  await page.waitForTimeout(600);
  const dialogVisible = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && d.offsetParent !== null;
  });
  dialogVisible
    ? pass(`${theme}-P3-panel-opens`, 'role="dialog" visible after info-click')
    : fail(`${theme}-P3-panel-opens`, 'dialog not visible after info-click');

  // ── P4: Panel contains "Application sold" with 25 pts ─────────────────────
  const p4 = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return { hasLabel: false, hasPts: false };
    const text = d.textContent || '';
    return {
      hasLabel: text.includes('Application sold'),
      hasPts:   text.includes('25'),
    };
  });
  (p4.hasLabel && p4.hasPts)
    ? pass(`${theme}-P4-app-sold-pts`, 'Application sold + 25 pts in panel')
    : fail(`${theme}-P4-app-sold-pts`, `hasLabel=${p4.hasLabel} hasPts=${p4.hasPts}`);

  // ── P5: Panel contains level title "Rookie" and threshold "0" ─────────────
  const p5 = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return false;
    const text = d.textContent || '';
    return text.includes('Rookie') && text.includes('0');
  });
  p5
    ? pass(`${theme}-P5-level-entry`, '"Rookie" level with threshold in panel')
    : fail(`${theme}-P5-level-entry`, 'Level entry not found in panel');

  // ── P6: Panel contains a badge name ("First Step") ────────────────────────
  const p6 = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return false;
    const text = d.textContent || '';
    return text.includes('First Step');
  });
  p6
    ? pass(`${theme}-P6-badge-entry`, '"First Step" badge entry in panel')
    : fail(`${theme}-P6-badge-entry`, 'Badge entry not found in panel');

  // ── P7: Close button removes dialog ───────────────────────────────────────
  const closeBtn = page.getByRole('button', { name: /^close$/i });
  const closeBtnOk = await closeBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (closeBtnOk) {
    await closeBtn.click();
    await page.waitForTimeout(400);
    const dialogGone = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return !d || d.offsetParent === null;
    });
    dialogGone
      ? pass(`${theme}-P7-panel-closes`, 'Dialog gone after close-button click')
      : fail(`${theme}-P7-panel-closes`, 'Dialog still visible after close');
  } else {
    fail(`${theme}-P7-panel-closes`, 'Close button not found');
  }

  // ── P8: Console errors ────────────────────────────────────────────────────
  const filteredErrors = capture.consoleMessages.filter(m =>
    m.type === 'error' &&
    !m.text.includes('fonts.googleapis.com') &&
    !m.text.includes('fontshare') &&
    !m.text.includes('favicon')
  );
  const networkFails = capture.networkFailures.filter(f =>
    !f.url.includes('.map') && !f.url.includes('.ico')
  );
  (filteredErrors.length === 0 && networkFails.length === 0)
    ? pass(`${theme}-P8-no-errors`, '0 console errors, 0 network failures')
    : fail(`${theme}-P8-no-errors`, `${filteredErrors.length} console errors, ${networkFails.length} network failures`);

  console.log(formatCaptureReport(capture));
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await runTheme(browser, 'light');
    await runTheme(browser, 'dark');
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n━━━ SMOKE RESULT: ${passed} PASS / ${failed} FAIL ━━━`);
  results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.id}: ${r.note}`));
  process.exit(failed > 0 ? 1 : 0);
})();
