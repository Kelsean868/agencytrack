/**
 * SEC-012 — kiosk branch-scope smoke.
 *
 * Proves Option A did not regress the working kiosk: after branch-scoping the
 * kiosk read rules AND adding the client-side branchId filter to
 * getKioskYTDSubmissions, the kiosk still loads and DISPLAYS its own branch's
 * submissions (Branch Overview KPIs derive from allSubmissions).
 *
 * NOTE: the branch-scoped RULES are NOT deployed to the preview (rules don't
 * auto-deploy via Vercel), so on the preview the new client filter runs against
 * the still-tenant-wide production rules — the filtered query is a subset of
 * what tenant-wide rules already allow, so it succeeds. The DENY half (cross-
 * branch blocked) is proven by the emulator suite, not this smoke.
 *
 * Flow (mirrors kiosk-v2-restyle-smoke):
 *   1. BM signs in, generates a fresh kiosk URL.
 *   2. Fresh context opens the kiosk URL.
 *   3. Wait for the Branch Overview panel (welcome 15s → agentOfMonth 45s →
 *      branchOverview @ ~60s) and read its KPI cards.
 *   4. PASS = 0 console errors AND Branch Overview rendered AND "YTD API" shows
 *      a non-zero TTD figure (submissions loaded through the branch filter).
 *
 * Usage:
 *   node scripts/verification/smoke-sec012-kiosk-branch.mjs --url=<previewUrl>
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const URL          = args.url ?? 'http://127.0.0.1:4173';
const IS_PROD      = URL.startsWith('https://');
const BYPASS_TOKEN = process.env.VERCEL_BYPASS_TOKEN;
const BM_EMAIL     = process.env.A11Y_BRANCH_MANAGER_EMAIL;
const BM_PASS      = process.env.A11Y_BRANCH_MANAGER_PASSWORD;

if (!BM_EMAIL || !BM_PASS) { console.error('Missing A11Y_BRANCH_MANAGER_* — smoke skipped'); process.exit(0); }
if (IS_PROD && !BYPASS_TOKEN) { console.error('Missing VERCEL_BYPASS_TOKEN for prod URL'); process.exit(1); }

async function login(page, email, pass) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await Promise.all([
    page.waitForFunction(() => !document.querySelector('input[type="email"]'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 400,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1500);
}

async function newCtx() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (IS_PROD) await setupBypassSession(context, URL, BYPASS_TOKEN);
  return { browser, context };
}

// ── Step 1: BM logs in + generates a kiosk URL ───────────────────────────────
const { browser: mgrBrowser, context: mgrCtx } = await newCtx();
const mgrPage = await mgrCtx.newPage();
const mgrErrors = [];
mgrPage.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fontshare.com')) mgrErrors.push(m.text()); });

await mgrPage.goto(URL, { waitUntil: 'domcontentloaded' });
await login(mgrPage, BM_EMAIL, BM_PASS);
await mgrPage.waitForTimeout(800);

const kioskNav = mgrPage.locator('[data-testid="nav-kiosk"]');
if (await kioskNav.count() === 0) { console.error('Kiosk nav not visible to BM'); await mgrBrowser.close(); process.exit(1); }
await kioskNav.click();
await mgrPage.waitForFunction(() => !!document.querySelector('a[href*="/kiosk/"]'), { timeout: 30_000 }).catch(async () => {
  const gen = mgrPage.getByRole('button', { name: /generate/i });
  if (await gen.count() > 0) { await gen.first().click(); await mgrPage.waitForFunction(() => !!document.querySelector('a[href*="/kiosk/"]'), { timeout: 30_000 }); }
});

const kioskHref = await mgrPage.locator('a[href*="/kiosk/"]').first().getAttribute('href');
if (!kioskHref) { console.error('No kiosk URL generated'); await mgrBrowser.close(); process.exit(1); }
let kioskUrl = kioskHref.startsWith('http') ? kioskHref : `${URL}${kioskHref}`;
if (IS_PROD) kioskUrl = `${URL}${kioskUrl.replace(/^https?:\/\/[^/]+/, '')}`;
console.log(`[kiosk URL acquired] (length=${kioskUrl.length}; rewritten=${IS_PROD})`);

// ── Step 2: open the kiosk ───────────────────────────────────────────────────
const { browser: kBrowser, context: kCtx } = await newCtx();
const kPage = await kCtx.newPage();
const kErrors = [];
kPage.on('console', (m) => {
  if (m.type() !== 'error') return;
  const text = m.text();
  if (text.includes('fontshare.com')) return;
  if (text.includes('Failed to load resource') && text.includes('net::ERR_FAILED')) return;
  kErrors.push(text);
});

await kPage.goto(kioskUrl, { waitUntil: 'domcontentloaded' });
await kPage.waitForFunction(() => {
  const spinner = document.querySelector('.animate-spin');
  const hasContent = document.querySelectorAll('h1').length > 0
    || /Good (Morning|Afternoon|Evening)/.test(document.body.textContent || '');
  return !spinner && hasContent;
}, { timeout: 60_000 });
console.log('[kiosk shell loaded]');

// ── Step 3: wait for the submissions-driven Branch Overview panel ────────────
// branchOverview sits ~60-90s into the rotation (welcome 15s → agentOfMonth 45s
// → branchOverview 30s). Poll up to 180s, logging the visible panel so a stall
// is diagnosable.
let branchSeen = false;
const startWait = Date.now();
while (Date.now() - startWait < 180_000) {
  const state = await kPage.evaluate(() => {
    const h1 = document.querySelector('h1')?.textContent?.trim() ?? null;
    const greet = (document.body.textContent || '').match(/Good (Morning|Afternoon|Evening)/)?.[0] ?? null;
    return { h1, greet };
  });
  const elapsed = Math.round((Date.now() - startWait) / 1000);
  console.log(`[t+${elapsed}s] panel h1="${state.h1}" greet="${state.greet}"`);
  if (state.h1 === 'Branch Overview') { branchSeen = true; break; }
  await kPage.waitForTimeout(6000);
}

let kpis = null;
if (branchSeen) {
  await kPage.waitForTimeout(2000); // let the count-up animation settle
  kpis = await kPage.evaluate(() => {
    const h1 = [...document.querySelectorAll('h1')].find((h) => h.textContent.trim() === 'Branch Overview');
    if (!h1) return null;
    const panel = h1.closest('div.w-full') || h1.parentElement?.parentElement;
    const cards = [...(panel?.querySelectorAll('.bg-card') || [])];
    return cards.map((c) => {
      const spans = c.querySelectorAll('span');
      return { label: spans[0]?.textContent?.trim() ?? '', value: spans[1]?.textContent?.trim() ?? '' };
    });
  });
}

const ytdApi = kpis?.find((k) => k.label === 'YTD API')?.value ?? '';
const apiHasData = /TTD/.test(ytdApi) && ytdApi.replace(/[^0-9]/g, '').replace(/0+/g, '') !== '';

const pass = kErrors.length === 0 && mgrErrors.length === 0 && branchSeen && apiHasData;

console.log('\n=== SEC-012 kiosk branch-scope smoke summary ===');
console.log(JSON.stringify({
  kioskUrlLen: kioskUrl.length,
  branchOverviewSeen: branchSeen,
  kpis,
  ytdApi,
  apiHasData,
  kErrors: kErrors.length,
  mgrErrors: mgrErrors.length,
  kErrorSample: kErrors.slice(0, 3),
  pass,
}, null, 2));

await kBrowser.close();
await mgrBrowser.close();
process.exit(pass ? 0 : 1);
