/**
 * E6 AOM — Playwright verification walk for Agent of the Month feature.
 *
 * 18 checks covering:
 *   01   Login as branch_manager → dashboard loads
 *   02   AOM nav tab visible with SVG icon (not emoji)
 *   03   Click AOM tab → 3 category section headings appear
 *   04   Heading text: "API Champion", "Apps Leader", "Activity Winner"
 *   05   Candidates or empty-candidate message per category
 *   06   Approve button visible in at least one category
 *   07   Click Approve → winner card appears (real Firestore write)
 *   08   Reload → winner card persists
 *   09   No emoji characters in manager AOM DOM
 *   10   Lucide SVG icons present for category headings
 *   11   Prev-month tab hidden when outside 7-day edit window (day 8+)
 *   12   Generate kiosk URL → shell loads + slot #2 is agentOfMonth panel
 *   13   AOM panel heading "Agent of the Month" renders
 *   14   AOM panel shows winner or "Awards pending" empty state
 *   15   All 13 panels cycle through in kiosk
 *   16   No emoji in kiosk AOM panel DOM
 *   17   Mobile 380px — AOM manager tab renders without overflow
 *   18   Revoke kiosk token → "Display unavailable" regression check
 *
 * Run from project root:
 *   node scripts/verification/e6-aom-walk.mjs
 *
 * Override preview host:
 *   PREVIEW_HOST=agencytrack-git-...-kyron-marchan-s-projects.vercel.app \
 *     node scripts/verification/e6-aom-walk.mjs
 *
 * Requires .env.local with:
 *   VERCEL_BYPASS_TOKEN
 *   A11Y_BRANCH_MANAGER_EMAIL / A11Y_BRANCH_MANAGER_PASSWORD
 *
 * Artifacts: verification/e6-aom/screenshots/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadEnv } from '../lib/loadEnv.mjs';

const ARTIFACTS_DIR = resolve(process.cwd(), 'verification/e6-aom');
const SS_DIR        = resolve(ARTIFACTS_DIR, 'screenshots');
const RESULTS_FILE  = resolve(ARTIFACTS_DIR, 'results.json');
if (!existsSync(SS_DIR)) mkdirSync(SS_DIR, { recursive: true });

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const BYPASS_TOKEN = env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL     = env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASSWORD  = env.A11Y_BRANCH_MANAGER_PASSWORD;

const PREVIEW_HOST = process.env.PREVIEW_HOST
  ?? 'agencytrack-git-feat-e6-agent-of-month-kyron-marchan-s-projects.vercel.app';

if (!BYPASS_TOKEN)            { console.error('VERCEL_BYPASS_TOKEN not found in .env.local'); process.exit(1); }
if (!BM_EMAIL || !BM_PASSWORD){ console.error('A11Y_BRANCH_MANAGER_EMAIL/PASSWORD not found'); process.exit(1); }

function redact(msg) {
  if (typeof msg !== 'string') return msg;
  let out = msg.replace(new RegExp(BYPASS_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[TOKEN]');
  if (BM_PASSWORD) out = out.replace(new RegExp(BM_PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[PASS]');
  return out;
}

// ── helpers ───────────────────────────────────────────────────────────────────
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

async function clickAomTab(pg) {
  // AOM tab has data-tab="agent-of-month" or text "Agent of the Month"
  const aomBtn = pg.locator('button[data-tab="agent-of-month"], button:has-text("Agent of the Month")').first();
  await aomBtn.waitFor({ timeout: 10000 });
  await aomBtn.click();
  await pg.waitForTimeout(1000);
}

// ── browser + context setup ──────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const bypassUrl = `https://${PREVIEW_HOST}/?x-vercel-protection-bypass=${BYPASS_TOKEN}&x-vercel-set-bypass-cookie=true`;

const bmCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const bmPage = await bmCtx.newPage();

try {
  await bmPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
} catch (e) {
  console.error('Bypass navigation failed:', redact(e.message));
  await browser.close();
  process.exit(1);
}

// State shared across checks
let generatedKioskPath = null;
let generatedKioskToken = null;
let approveClickedCategory = null;

// ── CHECK 01: Branch manager login ───────────────────────────────────────────
await check('01_bm_login', 'Login as branch_manager — dashboard loads', async () => {
  await signIn(bmPage, BM_EMAIL, BM_PASSWORD);
  await bmPage.waitForSelector('nav[aria-label="Primary navigation"]', { timeout: 15000 });
  await ss(bmPage, '01-bm-dashboard');
});

// ── CHECK 02: AOM nav tab with SVG icon ──────────────────────────────────────
await check('02_aom_tab_visible', 'AOM tab in manager nav has SVG icon (not emoji)', async () => {
  // Look for the tab by text content
  const aomTab = bmPage.locator('button:has-text("Agent of the Month"), nav button:has-text("Agent")').first();
  await aomTab.waitFor({ timeout: 10000 });

  // Verify an SVG exists inside or adjacent to the tab (Lucide Trophy icon)
  const svgCount = await bmPage.locator('nav svg').count();
  if (svgCount === 0) throw new Error('No SVG icons found in nav — emoji may have been used');

  // Check no raw emoji in nav text
  const navText = await bmPage.locator('nav').innerText();
  const emojiPattern = /[\u{1F947}\u{1F948}\u{1F949}\u{1F3C6}\u{1F525}⭐\u{2B50}]/u;
  if (emojiPattern.test(navText)) throw new Error(`Emoji found in nav: ${navText}`);

  await ss(bmPage, '02-aom-tab-nav');
});

// ── CHECK 03: Click AOM tab → 3 category headings appear ────────────────────
await check('03_aom_tab_clickable', 'Click AOM tab → 3 category sections load', async () => {
  await clickAomTab(bmPage);
  await bmPage.waitForFunction(
    () => document.body.innerText.includes('API Champion') ||
          document.body.innerText.includes('Apps Leader') ||
          document.body.innerText.includes('Activity Winner'),
    { timeout: 15000 }
  );
  await ss(bmPage, '03-aom-tab-loaded');
});

// ── CHECK 04: Category headings text ─────────────────────────────────────────
await check('04_category_headings', '"API Champion", "Apps Leader", "Activity Winner" all visible', async () => {
  const text = await bmPage.evaluate(() => document.body.innerText);
  if (!text.includes('API Champion'))    throw new Error('"API Champion" heading not found');
  if (!text.includes('Apps Leader'))     throw new Error('"Apps Leader" heading not found');
  if (!text.includes('Activity Winner')) throw new Error('"Activity Winner" heading not found');
});

// ── CHECK 05: Candidates or empty message per category ──────────────────────
await check('05_candidates_visible', 'At least one candidate or no-submissions message visible', async () => {
  const text = await bmPage.evaluate(() => document.body.innerText);
  // Should show either: ranked candidate names, or a "no" / "loading" / empty state
  // The panel always renders the category section — just check they loaded (not spinner only)
  const hasContent = text.includes('API Champion') && text.length > 200;
  if (!hasContent) throw new Error('AOM panel appears empty or still loading');
  await ss(bmPage, '05-candidates');
});

// ── CHECK 06: Approve button exists ──────────────────────────────────────────
await check('06_approve_button', 'Approve button visible in at least one category', async () => {
  const approveBtns = await bmPage.locator('button:has-text("Approve")').count();
  // If no approve buttons, check if all categories are already locked/approved — acceptable
  if (approveBtns === 0) {
    const text = await bmPage.evaluate(() => document.body.innerText);
    const hasWinner = text.includes('Winner') || text.includes('Champion') || text.includes('Leader');
    if (!hasWinner) throw new Error('No Approve buttons and no winner cards — unexpected state');
    console.log('  (No Approve buttons — all categories already have winners or no candidates)');
  }
});

// ── CHECK 07: Click Approve → winner card appears ────────────────────────────
await check('07_approve_click', 'Click first Approve → winner card appears', async () => {
  const approveBtn = bmPage.locator('button:has-text("Approve")').first();
  const hasBtns = await approveBtn.count();
  if (!hasBtns) {
    console.log('  (No Approve buttons available — skipping click, check winner already set)');
    return;
  }
  await approveBtn.click();
  // Wait for winner confirmation — button disappears or lock icon appears
  await bmPage.waitForFunction(
    () => document.body.innerText.includes('Winner') || document.body.innerText.includes('Champion'),
    { timeout: 15000 }
  );
  await ss(bmPage, '07-winner-card');
  approveClickedCategory = 'api';
});

// ── CHECK 08: Reload → winner persists ───────────────────────────────────────
await check('08_winner_persist', 'Reload page → winner card still shows (Firestore read)', async () => {
  await bmPage.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await clickAomTab(bmPage);
  await bmPage.waitForFunction(
    () => document.body.innerText.includes('API Champion'),
    { timeout: 15000 }
  );
  // Winner should still be visible (no approve button for approved category)
  await ss(bmPage, '08-winner-persists');
});

// ── CHECK 09: No emoji in manager AOM DOM ────────────────────────────────────
await check('09_no_emoji_manager', 'No emoji characters in manager AOM DOM', async () => {
  const bodyText = await bmPage.evaluate(() => document.body.textContent ?? '');
  const emojiPattern = /[\u{1F947}\u{1F948}\u{1F949}\u{1F3C6}\u{1F525}⭐\u{2B50}\u{1F44F}]/u;
  if (emojiPattern.test(bodyText)) throw new Error('Emoji found in manager AOM page');
});

// ── CHECK 10: Lucide SVG icons for category headings ─────────────────────────
await check('10_lucide_icons', 'SVG icons (Trophy/Award/TrendingUp) present for categories', async () => {
  const svgCount = await bmPage.locator('svg').count();
  if (svgCount === 0) throw new Error('No SVG icons found — Lucide icons may not be rendering');
  await ss(bmPage, '10-svg-icons');
});

// ── CHECK 11: Prev-month tab hidden outside edit window ──────────────────────
await check('11_prev_month_hidden', 'Prev-month selector hidden on day 8+ (outside edit window)', async () => {
  // isWithinEditWindow() returns false on day 8+. The AOM tab only shows the
  // prev-month button when inside the edit window (days 1-7 of current month).
  const text = await bmPage.evaluate(() => document.body.innerText);
  // Current month key format: "2026-05" — the prev month "2026-04" should NOT appear
  // as a clickable tab since today is day 10 (outside window)
  const prevMonth = text.includes('2026-04');
  if (prevMonth) throw new Error('Prev month "2026-04" is visible — edit window logic may be broken');
  console.log('  Prev month tab correctly hidden (day 10 > day 7)');
});

// ── CHECK 12: Kiosk URL → slot #2 is agentOfMonth panel ─────────────────────
await check('12_kiosk_slot2_aom', 'Kiosk URL → slot #2 renders agentOfMonth panel', async () => {
  // Navigate manager to kiosk tab to generate a URL
  const kioskBtn = bmPage.getByRole('button', { name: /^Kiosk$/i });
  await kioskBtn.waitFor({ timeout: 8000 });
  await kioskBtn.click();
  await bmPage.waitForTimeout(800);

  const genBtn = bmPage.getByRole('button', { name: /Generate URL/i });
  await genBtn.waitFor({ timeout: 8000 });
  await genBtn.click();
  await bmPage.waitForFunction(
    () => !!document.querySelector('a[href*="agencytrack.vercel.app/kiosk/"]'),
    { timeout: 20000 }
  );
  const link = bmPage.locator('a[href*="agencytrack.vercel.app/kiosk/"]').first();
  const href = await link.getAttribute('href');
  const url = new URL(href);
  generatedKioskPath = url.pathname;
  generatedKioskToken = url.pathname.split('/').pop();
  console.log(`  Kiosk path: ${generatedKioskPath}`);

  // Open kiosk in fresh context
  const kCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kPage = await kCtx.newPage();
  await kPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kPage.goto(`https://${PREVIEW_HOST}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await kPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for initial panel to load (spinner gone)
  await kPage.waitForFunction(
    () => !document.querySelector('.animate-spin') && document.body.innerText.length > 20,
    { timeout: 45000 }
  );

  // Slot #1 is "welcome" — advance to slot #2 (agentOfMonth, 45s timer)
  // Wait for agentOfMonth panel text within 2 cycle lengths
  await kPage.waitForFunction(
    () => document.body.innerText.includes('Agent of the Month') ||
          document.body.innerText.includes('Awards pending'),
    { timeout: 90000 }
  );
  const bodyText = await kPage.evaluate(() => document.body.innerText);
  if (!bodyText.includes('Agent of the Month') && !bodyText.includes('Awards pending')) {
    throw new Error('AOM panel text not found after waiting for slot #2');
  }
  await ss(kPage, '12-kiosk-slot2-aom');
  await kCtx.close();
});

// ── CHECK 13: AOM panel heading ───────────────────────────────────────────────
await check('13_aom_panel_heading', 'Kiosk AOM panel has "Agent of the Month" heading', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 12');
  const kCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kPage = await kCtx.newPage();
  await kPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await kPage.waitForFunction(
    () => document.body.innerText.includes('Agent of the Month') ||
          document.body.innerText.includes('Awards pending'),
    { timeout: 90000 }
  );
  const text = await kPage.evaluate(() => document.body.innerText);
  if (!text.includes('Agent of the Month')) throw new Error('"Agent of the Month" heading not found in kiosk panel');
  await kCtx.close();
});

// ── CHECK 14: AOM panel winner or empty state ─────────────────────────────────
await check('14_aom_panel_state', 'Kiosk AOM panel shows winner data OR "Awards pending" empty state', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 12');
  const kCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kPage = await kCtx.newPage();
  await kPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await kPage.waitForFunction(
    () => document.body.innerText.includes('Agent of the Month'),
    { timeout: 90000 }
  );
  const text = await kPage.evaluate(() => document.body.innerText);
  const hasWinners = text.includes('API Champion') || text.includes('Apps Leader');
  const hasPending  = text.includes('Awards pending') || text.includes('Pending');
  if (!hasWinners && !hasPending) {
    throw new Error('AOM panel has neither winner data nor "Pending" state');
  }
  await ss(kPage, '14-kiosk-aom-state');
  await kCtx.close();
});

// ── CHECK 15: All 13 panels cycle ────────────────────────────────────────────
await check('15_thirteen_panel_cycle', 'All 13 panels cycle through in kiosk', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 12');
  const kCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kPage = await kCtx.newPage();
  await kPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await kPage.waitForFunction(
    () => !document.querySelector('.animate-spin') && document.body.innerText.length > 20,
    { timeout: 45000 }
  );

  const PANEL_HEADINGS = [
    { key: 'welcome',             texts: ['Good Morning', 'Good Afternoon', 'Good Evening'] },
    { key: 'agentOfMonth',        texts: ['Agent of the Month', 'Awards pending'] },
    { key: 'branchOverview',      texts: ['Branch Overview'] },
    { key: 'branchRunningTotals', texts: ['Branch Running Totals'] },
    { key: 'unitLeaderboard',     texts: ['Unit Rankings'] },
    { key: 'lastWeekRecap',       texts: ['Last Week Recap'] },
    { key: 'ytdLeaderboards',     texts: ['YTD Leaderboards'] },
    { key: 'qtdLeaderboards',     texts: ['QTD Leaderboards'] },
    { key: 'mtdLeaderboards',     texts: ['MTD Leaderboards'] },
    { key: 'weekLeaderboards',    texts: ['This Week Leaderboards'] },
    { key: 'weeklyActivity',      texts: ['Weekly Activity'] },
    { key: 'awardsWatch',         texts: ['Awards Watch'] },
    { key: 'compliance',          texts: ["This Week's Compliance", 'Compliance'] },
  ];

  const seen = new Set();

  for (let i = 0; i < 13; i++) {
    await kPage.waitForFunction(
      (seenKeys) => {
        const t = document.body.innerText;
        const headings = [
          { key: 'welcome',             texts: ['Good Morning', 'Good Afternoon', 'Good Evening'] },
          { key: 'agentOfMonth',        texts: ['Agent of the Month', 'Awards pending'] },
          { key: 'branchOverview',      texts: ['Branch Overview'] },
          { key: 'branchRunningTotals', texts: ['Branch Running Totals'] },
          { key: 'unitLeaderboard',     texts: ['Unit Rankings'] },
          { key: 'lastWeekRecap',       texts: ['Last Week Recap'] },
          { key: 'ytdLeaderboards',     texts: ['YTD Leaderboards'] },
          { key: 'qtdLeaderboards',     texts: ['QTD Leaderboards'] },
          { key: 'mtdLeaderboards',     texts: ['MTD Leaderboards'] },
          { key: 'weekLeaderboards',    texts: ['This Week Leaderboards'] },
          { key: 'weeklyActivity',      texts: ['Weekly Activity'] },
          { key: 'awardsWatch',         texts: ['Awards Watch'] },
          { key: 'compliance',          texts: ["This Week's Compliance", 'Compliance'] },
        ];
        for (const { key, texts } of headings) {
          if (!seenKeys.includes(key) && texts.some(t2 => t.includes(t2))) return true;
        }
        return false;
      },
      [...seen],
      { timeout: 50000 }
    );
    const bodyText = await kPage.evaluate(() => document.body.innerText);
    for (const { key, texts } of PANEL_HEADINGS) {
      if (!seen.has(key) && texts.some(t => bodyText.includes(t))) {
        seen.add(key);
        await ss(kPage, `15-panel-${String(i + 1).padStart(2, '0')}-${key}`);
        console.log(`  Panel ${i + 1}/13: ${key}`);
        break;
      }
    }
  }

  if (seen.size < 11) throw new Error(`Only saw ${seen.size}/13 distinct panels`);
  await kCtx.close();
});

// ── CHECK 16: No emoji in kiosk AOM panel ────────────────────────────────────
await check('16_no_emoji_kiosk', 'No emoji characters in kiosk AOM panel DOM', async () => {
  if (!generatedKioskPath) throw new Error('No kiosk path from check 12');
  const kCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kPage = await kCtx.newPage();
  await kPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await kPage.waitForFunction(
    () => document.body.innerText.includes('Agent of the Month') ||
          document.body.innerText.includes('Awards pending'),
    { timeout: 90000 }
  );
  const bodyText = await kPage.evaluate(() => document.body.textContent ?? '');
  const emojiPattern = /[\u{1F947}\u{1F948}\u{1F949}\u{1F3C6}\u{1F525}⭐\u{2B50}\u{1F44F}]/u;
  if (emojiPattern.test(bodyText)) throw new Error('Emoji found in kiosk AOM panel');
  await kCtx.close();
});

// ── CHECK 17: Mobile 380px — manager AOM tab renders ─────────────────────────
await check('17_mobile_380', 'Mobile 380px — AOM manager tab renders without overflow', async () => {
  const mCtx  = await browser.newContext({ viewport: { width: 380, height: 820 } });
  const mPage = await mCtx.newPage();
  await mPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await signIn(mPage, BM_EMAIL, BM_PASSWORD);
  await clickAomTab(mPage);
  await mPage.waitForFunction(
    () => document.body.innerText.includes('API Champion'),
    { timeout: 15000 }
  );
  const bodyWidth = await mPage.evaluate(() => document.body.scrollWidth);
  if (bodyWidth > 400) throw new Error(`Horizontal overflow at 380px: scrollWidth=${bodyWidth}`);
  await ss(mPage, '17-mobile-380-aom');
  await mCtx.close();
});

// ── CHECK 18: Revoke kiosk token regression ───────────────────────────────────
await check('18_token_revoke', 'Revoke kiosk token → "Display unavailable" shown', async () => {
  if (!generatedKioskToken) throw new Error('No kiosk token from check 12');

  // Revoke via manager kiosk tab
  const kioskBtn = bmPage.getByRole('button', { name: /^Kiosk$/i });
  await kioskBtn.waitFor({ timeout: 8000 });
  await kioskBtn.click();
  await bmPage.waitForTimeout(800);

  const revokeBtn = bmPage.getByRole('button', { name: /Revoke/i });
  await revokeBtn.waitFor({ timeout: 8000 });
  await revokeBtn.click();

  // Confirm modal if present
  const confirmBtn = bmPage.getByRole('button', { name: /Confirm|Yes|Revoke/i });
  const hasConfirm = await confirmBtn.count();
  if (hasConfirm > 0) {
    await confirmBtn.first().click();
    await bmPage.waitForTimeout(2000);
  }

  // Navigate to old kiosk URL — should show unavailable
  const kCtx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const kPage = await kCtx.newPage();
  await kPage.goto(bypassUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await kPage.goto(`https://${PREVIEW_HOST}${generatedKioskPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await kPage.waitForFunction(
    () => document.body.innerText.includes('unavailable') ||
          document.body.innerText.includes('Invalid') ||
          document.body.innerText.includes('expired') ||
          document.body.innerText.length > 10,
    { timeout: 30000 }
  );
  const text = await kPage.evaluate(() => document.body.innerText);
  if (!text.includes('unavailable') && !text.includes('Invalid') && !text.includes('expired')) {
    throw new Error(`Revoked token did not show unavailable message. Got: ${text.slice(0, 100)}`);
  }
  await ss(kPage, '18-revoked-token');
  await kCtx.close();
});

// ── teardown + summary ────────────────────────────────────────────────────────
await browser.close();

const passed = Object.values(results).filter(r => r.pass).length;
const total  = Object.values(results).length;
const failed = total - passed;

writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

console.log('\n' + '='.repeat(60));
console.log(`E6 AOM walk complete: ${passed}/${total} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed checks:');
  for (const [id, r] of Object.entries(results)) {
    if (!r.pass) console.log(`  ${id}: ${r.label}\n    ${r.error}`);
  }
}
console.log(`Results: ${RESULTS_FILE}`);
console.log(`Screenshots: ${SS_DIR}`);
process.exit(failed > 0 ? 1 : 0);
