/**
 * smoke-nav-pr4.mjs — preview/prod smoke for Nav redesign PR-4
 * (Menu-layout preference + workspace/both layouts).
 *
 * Legs (desktop 1280×900):
 *   1. UM layout switch + persistence — Settings → Workspace → assert sidebar
 *      toggle + My Work groups; toggle → My Team groups; Both → ★ Pinned ABOVE
 *      the toggle. Clear the menu-layout mirror, reload → assert the layout
 *      persisted (Firestore round-trip).
 *   2. UM no-regression spot-check — in Workspace, navigate to My WAR (My Work,
 *      folded-in) and Settlements (My Team, folded-in); assert each opens.
 *   3. Agent lock — Settings workspace/both disabled + sidebar renders pinned
 *      (no toggle), even with menuLayout:'workspace' forced into the mirror
 *      (defense-in-depth — the resolver clamps agent→pinned).
 *   4. Both coexistence — ★ Pinned zone (pinned-{id}) + toggle + group rows
 *      (nav-{id}) coexist with NO duplicate-testid collision (PR-2-class bug).
 *
 * NO unconditional SKIPs — every leg is conditional-or-fail-loud. The UM leg is
 * gated on A11Y_UNIT_MANAGER_* presence (fail-loud if absent, not silent skip).
 *
 * Run:
 *   SMOKE_BASE_URL="https://<preview-host>" \
 *     node scripts/verification/smoke-nav-pr4.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import {
  setupBypassSession,
  captureConsoleAndNetwork,
  formatCaptureReport,
} from './lib/walk-helpers.mjs';

// ── env loading ──────────────────────────────────────────────────────────────
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

const requireEnv = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
};
const optionalEnv = (k) => process.env[k] ?? null;

const BYPASS_TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
const BASE_URL = (process.env.SMOKE_BASE_URL || '').replace(/\/+$/, '');
if (!BASE_URL) throw new Error('Set SMOKE_BASE_URL to the preview (or prod) URL');

// ── result tracking ──────────────────────────────────────────────────────────
const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };

// ── helpers ──────────────────────────────────────────────────────────────────
async function login(page, email, password) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForFunction(() => document.querySelector('input[type="email"]') === null, { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500); // let hooks (useMenuLayout reconcile, etc.) settle
}

const vis = (loc, t = 5000) => loc.isVisible({ timeout: t }).catch(() => false);
async function openProfile(page) {
  await page.locator('button[aria-label="Open profile"]').first().click();
  await page.waitForTimeout(800);
}

// Best-effort uid read for the forced-mirror sub-assertion: Firebase web stores
// the signed-in user in IndexedDB (firebaseLocalStorageDb), with a localStorage
// fallback (existing agencytrack-*:{uid} mirror keys).
async function readUid(page) {
  return page.evaluate(async () => {
    const fromLs = () => {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        const m = k && k.match(/^agencytrack-(?:menu-layout|pinned-nav):(.+)$/);
        if (m) return m[1];
      }
      return null;
    };
    const fromIdb = () => new Promise((resolve) => {
      let req;
      try { req = indexedDB.open('firebaseLocalStorageDb'); } catch { resolve(null); return; }
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('firebaseLocalStorage', 'readonly');
          const all = tx.objectStore('firebaseLocalStorage').getAll();
          all.onsuccess = () => {
            const rec = (all.result || []).find((r) => r && r.value && r.value.uid);
            resolve(rec ? rec.value.uid : null);
          };
          all.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    });
    return fromLs() || (await fromIdb());
  });
}

// ── Legs 1/2/4: Unit Manager desktop ─────────────────────────────────────────
async function runUnitManager(browser) {
  console.log('\n=== UNIT MANAGER DESKTOP (1280×900) ===');
  const umEmail = optionalEnv('A11Y_UNIT_MANAGER_EMAIL');
  const umPass  = optionalEnv('A11Y_UNIT_MANAGER_PASSWORD');
  if (!umEmail || !umPass) {
    fail('um-creds', 'A11Y_UNIT_MANAGER_EMAIL / _PASSWORD not set — UM legs cannot run');
    return;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try {
    await login(page, umEmail, umPass);
  } catch (e) {
    fail('um-login', e.message);
    formatCaptureReport(cap);
    await ctx.close();
    return;
  }
  pass('um-login', 'unit manager signed in');

  // ── Leg 1: layout switch ──
  await openProfile(page);
  if (!(await vis(page.locator('[data-testid="menu-layout-workspace"]')))) {
    fail('um-settings-card', 'Menu layout cards not present in Settings');
    formatCaptureReport(cap); await ctx.close(); return;
  }
  pass('um-settings-card', 'Menu layout section present');

  // Set Workspace → toggle + My Work groups appear in the sidebar.
  await page.locator('[data-testid="menu-layout-workspace"]').click();
  await page.waitForTimeout(900);
  const toggleWork = page.locator('[data-testid="sidebar-ws-toggle-work"]');
  (await vis(toggleWork)) ? pass('um-workspace-toggle', 'My Work/My Team toggle rendered')
                          : fail('um-workspace-toggle', 'sidebar workspace toggle absent after Workspace select');
  (await vis(page.locator('[data-testid="nav-mp-report"]')))
    ? pass('um-workspace-mywork', 'My Work group rendered (nav-mp-report)')
    : fail('um-workspace-mywork', 'nav-mp-report not visible in Workspace/My Work');

  // Toggle → My Team groups; My Work item gone.
  await page.locator('[data-testid="sidebar-ws-toggle-team"]').click();
  await page.waitForTimeout(700);
  const teamVisible   = await vis(page.locator('[data-testid="nav-team"]'));
  const myworkGone    = !(await vis(page.locator('[data-testid="nav-mp-report"]'), 1500));
  (teamVisible && myworkGone)
    ? pass('um-toggle-team', 'toggle switched to My Team (nav-team in, nav-mp-report out)')
    : fail('um-toggle-team', `teamVisible=${teamVisible} myworkGone=${myworkGone}`);

  // Set Both → ★ Pinned ABOVE the toggle.
  await page.locator('[data-testid="sidebar-ws-toggle-work"]').click(); // back to a known state
  await page.waitForTimeout(400);
  await page.locator('[data-testid="menu-layout-both"]').click();
  await page.waitForTimeout(900);
  const pinnedHeaderVisible = await page.locator('text=★ Pinned').first().isVisible().catch(() => false);
  const toggleVisibleBoth   = await vis(page.locator('[data-testid="sidebar-ws-toggle-work"]'));
  let pinnedAboveToggle = false;
  if (pinnedHeaderVisible && toggleVisibleBoth) {
    pinnedAboveToggle = await page.evaluate(() => {
      const hdr = [...document.querySelectorAll('.sidebar-section')].find((e) => e.textContent.includes('★ Pinned'));
      const tog = document.querySelector('[data-testid="sidebar-ws-toggle-work"]');
      if (!hdr || !tog) return false;
      return !!(hdr.compareDocumentPosition(tog) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
  }
  pinnedAboveToggle
    ? pass('um-both-pinned-above-toggle', '★ Pinned renders above the toggle (decision #5)')
    : fail('um-both-pinned-above-toggle', `pinnedHeader=${pinnedHeaderVisible} toggle=${toggleVisibleBoth} order=${pinnedAboveToggle}`);

  // ── Leg 4: Both coexistence — pinned-{id} + nav-{id} distinct, no collision ──
  // mp-report is a seeded pin → appears as pinned-mp-report (zone) AND nav-mp-report (group).
  const pinnedRowCount = await page.locator('[data-testid="pinned-mp-report"]').count();
  const groupRowCount  = await page.locator('[data-testid="nav-mp-report"]').count();
  (pinnedRowCount === 1 && groupRowCount === 1)
    ? pass('um-both-no-collision', 'pinned-mp-report (1) + nav-mp-report (1) — distinct testids, no collision')
    : fail('um-both-no-collision', `pinned-mp-report=${pinnedRowCount} nav-mp-report=${groupRowCount} (expected 1 each)`);

  // ── Leg 1 (cont.): persistence round-trip — clear mirror, reload, expect Both ──
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('agencytrack-menu-layout:')) localStorage.removeItem(k);
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2500); // Firestore reconcile
  const togglePersisted = await vis(page.locator('[data-testid="sidebar-ws-toggle-work"]'), 8000);
  const pinnedPersisted = await page.locator('text=★ Pinned').first().isVisible().catch(() => false);
  (togglePersisted && pinnedPersisted)
    ? pass('um-persistence-roundtrip', 'Both layout restored from Firestore after mirror clear + reload')
    : fail('um-persistence-roundtrip', `toggle=${togglePersisted} pinned=${pinnedPersisted} (mirror was cleared — must come from Firestore)`);

  // ── Leg 2: no-regression spot-check (Workspace) ──
  // Switch to Workspace for a clean toggle, then navigate folded-in destinations.
  await openProfile(page);
  await page.locator('[data-testid="menu-layout-workspace"]').click();
  await page.waitForTimeout(900);
  // My Work → My WAR.
  const myWar = page.locator('[data-testid="nav-my-war"]');
  if (await vis(myWar)) {
    await myWar.click();
    await page.waitForTimeout(800);
    const opened = await myWar.getAttribute('aria-current').catch(() => null);
    opened === 'page' ? pass('um-noregress-mywar', 'My WAR opened (aria-current=page)')
                      : fail('um-noregress-mywar', `My WAR aria-current=${opened}`);
  } else {
    fail('um-noregress-mywar', 'nav-my-war not visible in Workspace/My Work');
  }
  // My Team → Settlements.
  await page.locator('[data-testid="sidebar-ws-toggle-team"]').click();
  await page.waitForTimeout(700);
  const settle = page.locator('[data-testid="nav-settlements"]');
  if (await vis(settle)) {
    await settle.click();
    await page.waitForTimeout(800);
    const opened = await settle.getAttribute('aria-current').catch(() => null);
    opened === 'page' ? pass('um-noregress-settlements', 'Settlements opened (aria-current=page)')
                      : fail('um-noregress-settlements', `Settlements aria-current=${opened}`);
  } else {
    fail('um-noregress-settlements', 'nav-settlements not visible in Workspace/My Team');
  }

  formatCaptureReport(cap);
  await ctx.close();
}

// ── Leg 3: Agent lock ─────────────────────────────────────────────────────────
async function runAgentLock(browser) {
  console.log('\n=== AGENT LOCK (1280×900) ===');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await setupBypassSession(ctx, BASE_URL, BYPASS_TOKEN);
  const page = await ctx.newPage();
  const cap = captureConsoleAndNetwork(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  try {
    await login(page, requireEnv('A11Y_AGENT_EMAIL'), requireEnv('A11Y_AGENT_PASSWORD'));
  } catch (e) {
    fail('agent-login', e.message);
    formatCaptureReport(cap); await ctx.close(); return;
  }
  pass('agent-login', 'agent signed in');

  // Base state: no workspace toggle for an agent.
  (!(await vis(page.locator('[data-testid="sidebar-ws-toggle-work"]'), 2000)))
    ? pass('agent-no-toggle-base', 'agent sidebar has no workspace toggle (base)')
    : fail('agent-no-toggle-base', 'workspace toggle unexpectedly present for agent');

  // Settings cards: workspace/both disabled, pinned enabled.
  await openProfile(page);
  if (await vis(page.locator('[data-testid="menu-layout-workspace"]'))) {
    const wsDisabled   = await page.locator('[data-testid="menu-layout-workspace"]').isDisabled().catch(() => false);
    const bothDisabled = await page.locator('[data-testid="menu-layout-both"]').isDisabled().catch(() => false);
    const pinnedOk     = !(await page.locator('[data-testid="menu-layout-pinned"]').isDisabled().catch(() => true));
    (wsDisabled && bothDisabled && pinnedOk)
      ? pass('agent-settings-locked', 'workspace+both disabled, pinned enabled')
      : fail('agent-settings-locked', `ws=${wsDisabled} both=${bothDisabled} pinnedEnabled=${pinnedOk}`);
  } else {
    fail('agent-settings-locked', 'Menu layout cards not present for agent');
  }

  // Defense-in-depth: force menuLayout='workspace' into the mirror, reload,
  // assert STILL no toggle (resolver clamps agent→pinned).
  const uid = await readUid(page);
  if (uid) {
    await page.evaluate((u) => { localStorage.setItem(`agencytrack-menu-layout:${u}`, 'workspace'); }, uid);
    const wrote = await page.evaluate((u) => localStorage.getItem(`agencytrack-menu-layout:${u}`), uid);
    if (wrote === 'workspace') {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => document.body && document.body.textContent.replace(/\s+/g, '').length > 200,
        { timeout: 30_000 },
      );
      await page.waitForTimeout(2500);
      (!(await vis(page.locator('[data-testid="sidebar-ws-toggle-work"]'), 3000)))
        ? pass('agent-clamp-forced-mirror', 'forced workspace mirror → still no toggle (clamp holds)')
        : fail('agent-clamp-forced-mirror', 'workspace toggle rendered for agent despite clamp');
    } else {
      fail('agent-clamp-forced-mirror', 'could not write forced mirror value');
    }
  } else {
    // Fail-loud, not a silent skip: the forced-mirror sub-assertion needs the uid.
    fail('agent-clamp-forced-mirror', 'could not resolve uid for forced-mirror test (IndexedDB + localStorage both empty)');
  }

  formatCaptureReport(cap);
  await ctx.close();
}

// ── main ───────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\nNav PR-4 smoke → ${BASE_URL}`);
  const browser = await chromium.launch();
  try {
    await runUnitManager(browser);
    await runAgentLock(browser);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`));
    process.exit(1);
  }
  console.log('All legs green.');
})();
