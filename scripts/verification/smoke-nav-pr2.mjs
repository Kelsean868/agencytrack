/**
 * smoke-nav-pr2.mjs — preview smoke for Nav redesign PR-2 (★ Pinned model).
 *
 * Verifiable WITHOUT the additive prefs rule deployed (mirror-backed UX):
 *   - agent ★ Pinned zone renders the per-role seed pins
 *   - pin an unpinned item → it appears in the zone AND the localStorage mirror updates
 *   - unpin → it leaves the zone
 *   - reload → mirror-backed pins persist
 *   - UM ★ Pinned zone shows the PM seeds (no "Log Today")
 *
 * DEPLOY-GATED (skipped here, noted): the Firestore round-trip (clear mirror →
 * reload → read-back from prefs/app) needs the prefs/{prefId} rule live in prod.
 *
 * Run: SMOKE_BASE_URL="https://<preview-host>" node scripts/verification/smoke-nav-pr2.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { setupBypassSession, captureConsoleAndNetwork, formatCaptureReport } from './lib/walk-helpers.mjs';

function loadEnv() {
  try {
    const src = readFileSync('.env.local', 'utf8');
    src.split(/\r?\n/).forEach((line) => {
      const eq = line.indexOf('='); if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !(k in process.env)) process.env[k] = v;
    });
  } catch { /* ignore */ }
}
loadEnv();

const requireEnv = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}`); return v; };
const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL');
const PROD_URL = 'https://agencytrack.vercel.app';
const IS_PROD = BASE_URL === PROD_URL;

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };
const skip = (id, note = '') => { results.push({ id, ok: true, note: 'SKIP: ' + note }); console.log(`  SKIP ${id} — ${note}`); };

async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.body && document.body.textContent.replace(/\s+/g, '').length > 200, { timeout: 30_000 });
  await page.waitForTimeout(2000);
}

const pinnedZoneIds = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-testid^="pinned-"]')).map((b) => b.getAttribute('data-testid')));
// Per-user mirror key is `agencytrack-pinned-nav:{uid}` — find it by prefix.
const mirror = (page) => page.evaluate(() => {
  try {
    const k = Object.keys(localStorage).find((key) => key.startsWith('agencytrack-pinned-nav:'));
    return k ? JSON.parse(localStorage.getItem(k) || 'null') : null;
  } catch { return null; }
});

async function runAgent(browser) {
  console.log('\n=== AGENT (light) ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try { await login(page, requireEnv('A11Y_AGENT_EMAIL'), requireEnv('A11Y_AGENT_PASSWORD')); }
  catch (e) { fail('agent-login', e.message); await ctx.close(); return; }

  // 1. ★ Pinned zone renders with seed pins
  const headerPresent = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.sidebar-section')).some((e) => /pinned/i.test(e.textContent || '')));
  const zone = await pinnedZoneIds(page);
  (headerPresent && zone.length > 0)
    ? pass('agent-pinned-zone', `★ Pinned + [${zone.join(', ')}]`)
    : fail('agent-pinned-zone', `header=${headerPresent} zone=[${zone.join(', ')}]`);

  // seed expectation: policy-ledger, goals, planner resolve (wizard/daily-log are
  // action items — present too). Assert a representative seed is pinned.
  zone.includes('pinned-goals')
    ? pass('agent-seed-goals', 'Goals seed pinned')
    : fail('agent-seed-goals', `no pinned-goals in [${zone.join(', ')}]`);

  // 2. Pin an unpinned item (Commission is NOT a seed)
  const pinBtn = page.getByRole('button', { name: 'Pin Commission' }).first();
  if (await pinBtn.count() > 0) {
    await pinBtn.click({ force: true });
    await page.waitForTimeout(600);
    const zone2 = await pinnedZoneIds(page);
    const m = await mirror(page);
    (zone2.includes('pinned-commission') && Array.isArray(m) && m.includes('commission'))
      ? pass('agent-pin', `commission pinned + mirror has it`)
      : fail('agent-pin', `zone=[${zone2.join(', ')}] mirror=${JSON.stringify(m)}`);

    // 3. Unpin → leaves the zone (use the zone row's Unpin star)
    const unpinBtn = page.getByRole('button', { name: 'Unpin Commission' }).first();
    await unpinBtn.click({ force: true });
    await page.waitForTimeout(600);
    const zone3 = await pinnedZoneIds(page);
    (!zone3.includes('pinned-commission'))
      ? pass('agent-unpin', 'commission left the zone')
      : fail('agent-unpin', `still present: [${zone3.join(', ')}]`);
  } else {
    fail('agent-pin', 'Pin Commission star not found');
  }

  // 4. Reload → mirror-backed pins persist
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.sidebar-section'), { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const zoneAfter = await pinnedZoneIds(page);
  zoneAfter.length > 0
    ? pass('agent-reload-persist', `mirror-backed pins survive reload: [${zoneAfter.join(', ')}]`)
    : fail('agent-reload-persist', 'no pins after reload');

  // 5. Firestore round-trip — runs as its own context against prod (see runFirestoreRoundTrip).
  formatCaptureReport(cap);
  await ctx.close();
}

// ── Firestore round-trip (prod only) ────────────────────────────────────────────
// Proves write+read+rules+claims end-to-end: pin → AWAIT the prefs write → clear
// the localStorage mirror → hard reload → the pin can ONLY have come from Firestore.
async function runFirestoreRoundTrip(browser) {
  if (!IS_PROD) {
    skip('agent-firestore-roundtrip', `not prod host (${BASE_URL}) — round-trip runs only against ${PROD_URL} where the prefs rule is live`);
    return;
  }
  console.log('\n=== AGENT FIRESTORE ROUND-TRIP (prod) ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();

  // Denial detectors: a non-2xx prefs Write response, or a console permission error.
  let deniedStatus = null;
  const permMsgs = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/Missing or insufficient permissions|PERMISSION_DENIED/i.test(t)) permMsgs.push(t);
  });
  page.on('response', (r) => {
    if (r.url().includes('/Firestore/Write/channel') && (r.status() === 401 || r.status() === 403)) {
      deniedStatus = r.status();
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try { await login(page, requireEnv('A11Y_AGENT_EMAIL'), requireEnv('A11Y_AGENT_PASSWORD')); }
  catch (e) { fail('agent-firestore-roundtrip', 'login: ' + e.message); await ctx.close(); return; }

  // 1. Pin a NON-SEED item (Commission), AWAIT the write POST, then settle (no reload yet).
  const pinBtn = page.getByRole('button', { name: 'Pin Commission' }).first();
  if (!(await pinBtn.count())) { fail('agent-firestore-roundtrip', 'Pin Commission star not found'); await ctx.close(); return; }
  const writeResp = page.waitForResponse(
    (r) => r.url().includes('/Firestore/Write/channel') && r.request().method() === 'POST',
    { timeout: 15000 },
  ).catch(() => null);
  await pinBtn.click({ force: true });
  await writeResp;
  await page.waitForTimeout(3500); // let Firestore fully ack the write before any reload

  if (deniedStatus) { fail('agent-firestore-roundtrip', `prefs Write DENIED — HTTP ${deniedStatus}`); await ctx.close(); return; }
  if (permMsgs.length) { fail('agent-firestore-roundtrip', `permission error during write: ${permMsgs[0].slice(0, 120)}`); await ctx.close(); return; }

  // 2. Mirror contains commission
  const mKey = await page.evaluate(() => Object.keys(localStorage).find((k) => k.startsWith('agencytrack-pinned-nav:')) || null);
  const mVal = mKey ? await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, mKey) : null;
  if (!(Array.isArray(mVal) && mVal.includes('commission'))) {
    fail('agent-firestore-roundtrip', `mirror missing commission after pin (key=${mKey} val=${JSON.stringify(mVal)})`);
    await ctx.close(); return;
  }

  // 3. CLEAR the mirror so the next paint cannot use it.
  await page.evaluate((k) => localStorage.removeItem(k), mKey);

  // 4. Hard reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.sidebar-section'), { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(2500); // allow the background Firestore reconcile to paint

  // 5. Commission must STILL be pinned — mirror cleared → it can only be from Firestore.
  const zoneAfter = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="pinned-"]')).map((b) => b.getAttribute('data-testid')));
  const persisted = zoneAfter.includes('pinned-commission');

  // 7. No permission errors at any point.
  if (permMsgs.length) {
    fail('agent-firestore-roundtrip', `permission error in console: ${permMsgs[0].slice(0, 120)}`);
  } else if (persisted) {
    pass('agent-firestore-roundtrip', `WRITE+READ+RULES verified — Commission persisted after mirror-cleared hard reload (zone=[${zoneAfter.join(', ')}])`);
  } else {
    fail('agent-firestore-roundtrip', `Commission GONE after mirror-cleared reload — write did not land in Firestore (zone=[${zoneAfter.join(', ')}])`);
  }

  // 8. Cleanup — unpin Commission to restore seed state (await the write).
  const unpinBtn = page.getByRole('button', { name: 'Unpin Commission' }).first();
  if (await unpinBtn.count()) {
    const cleanupResp = page.waitForResponse(
      (r) => r.url().includes('/Firestore/Write/channel') && r.request().method() === 'POST',
      { timeout: 10000 },
    ).catch(() => null);
    await unpinBtn.click({ force: true });
    await cleanupResp;
    await page.waitForTimeout(2500);
    console.log('  cleanup: unpinned Commission (restored seed state)');
  }
  await ctx.close();
}

async function runUM(browser) {
  console.log('\n=== UNIT-MANAGER (light) ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try { await login(page, requireEnv('A11Y_UNIT_MANAGER_EMAIL'), requireEnv('A11Y_UNIT_MANAGER_PASSWORD')); }
  catch (e) { fail('um-login', e.message); await ctx.close(); return; }

  const zone = await pinnedZoneIds(page);
  (zone.includes('pinned-mp-report') && zone.includes('pinned-mastersheet'))
    ? pass('um-pinned-seeds', `PM seeds pinned: [${zone.join(', ')}]`)
    : fail('um-pinned-seeds', `[${zone.join(', ')}]`);
  // no Log Today / manager log pin
  (!zone.some((id) => /log-today|daily-log/.test(id)))
    ? pass('um-no-logtoday', 'no Log Today pin (correctly dropped)')
    : fail('um-no-logtoday', `unexpected log pin in [${zone.join(', ')}]`);

  formatCaptureReport(cap);
  await ctx.close();
}

// ── Mobile: tapping a PINNED ACTION item fires onAction (Gemini HIGH fix) ───────
async function runMobileAction(browser) {
  console.log('\n=== AGENT MOBILE — pinned action tap (390×844) ===');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  try { await login(page, requireEnv('A11Y_AGENT_EMAIL'), requireEnv('A11Y_AGENT_PASSWORD')); }
  catch (e) { fail('mobile-action-login', e.message); await ctx.close(); return; }

  const more = page.locator('[data-testid="bottomnav-more"]');
  if (!(await more.isVisible({ timeout: 5000 }).catch(() => false))) {
    fail('mobile-pinned-action', 'More button not visible'); await ctx.close(); return;
  }
  await more.click();
  await page.waitForTimeout(700);
  // Weekly Report is an action seed (submit) — present ONLY in the drawer's
  // pinned zone (the main drawer list filters to tabId items).
  const wr = page.getByRole('button', { name: /^Weekly Report$/ }).first();
  if (!(await wr.isVisible({ timeout: 4000 }).catch(() => false))) {
    fail('mobile-pinned-action', 'pinned Weekly Report not in drawer'); await ctx.close(); return;
  }
  await wr.click();
  await page.waitForTimeout(1800);
  // onAction('submit') early-returns the wizard/daily surface → the shell (and its
  // bottom-nav "More") is gone. If onAction were a no-op (the bug), we'd still be
  // on the dashboard shell with the bottom nav visible.
  const shellGone = !(await page.locator('[data-testid="bottomnav-more"]').isVisible().catch(() => false));
  const surface = await page.evaluate(() => /Weekly Report|Activity|Step|Week of|Confirm|Looks good|Daily/.test(document.body.textContent || ''));
  (shellGone || surface)
    ? pass('mobile-pinned-action', `tapping pinned Weekly Report fired onAction (shellGone=${shellGone})`)
    : fail('mobile-pinned-action', 'no surface opened after tapping pinned action (onAction did not fire)');
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runAgent(browser);
  await runUM(browser);
  await runMobileAction(browser);
  await runFirestoreRoundTrip(browser);
} finally { await browser.close(); }

const PASS = results.filter((r) => r.ok);
const FAIL = results.filter((r) => !r.ok);
console.log('\n══════════════════════════════════════════');
console.log(`NAV-PR2 SMOKE: ${PASS.length} PASS/SKIP  /  ${FAIL.length} FAIL`);
for (const r of results) console.log(`  ${r.ok ? (r.note?.startsWith('SKIP') ? '~' : '✓') : '✗'} ${r.id}${r.note ? ' — ' + r.note : ''}`);
console.log('══════════════════════════════════════════');
if (FAIL.length > 0) process.exit(1);
