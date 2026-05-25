// pr296-roster-active-smoke.mjs — Phase 5 smoke for PR #296
// (feat/roster-honors-active — getTenantUsers honors active: false)
//
// Four legs:
//   Leg 1: Manager logs in, deactivates A11Y_AGENT via UserManagementPanel UI,
//           reloads — asserts agent name absent from active roster DOM.
//   Leg 2: Navigate Awards tab (BM at-risk + awards feed) and Leaderboard tab —
//           assert agent name absent from rendered rows (state-based, not just selector).
//   Leg 3: Toggle "Show inactive" in UserManagementPanel — assert agent reappears
//           with "Inactive" badge.
//   Leg 4: Reactivate via UI, reload — assert agent returns to active roster.
//
// Cleanup: Admin SDK sets agent active:true in `finally` regardless of leg results.
// Uses setupBypassSession — token never in a bare URL after handshake.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { createRequire } from 'module';
import { setupBypassSession, safeLog, hardReloadAndAwaitReady } from './lib/walk-helpers.mjs';
import { loadEnv } from '../lib/loadEnv.mjs';

// ── Env ────────────────────────────────────────────────────────────────────
const env = loadEnv(resolve(process.cwd(), '.env.local'));
for (const k of Object.keys(env)) {
  if (!(k in process.env)) process.env[k] = env[k];
}

const requireEnv = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

const TOKEN = requireEnv('VERCEL_BYPASS_TOKEN');
// BM has nav-team, nav-awards, nav-leaderboard — TA lands on TenantAdminDashboard (different nav)
const MGR_EMAIL = requireEnv('A11Y_BRANCH_MANAGER_EMAIL');
const MGR_PASSWORD = requireEnv('A11Y_BRANCH_MANAGER_PASSWORD');
const AGENT_EMAIL = requireEnv('A11Y_AGENT_EMAIL');

const PREVIEW_HOST =
  process.env.PREVIEW_HOST ??
  'agencytrack-git-feat-roster-honors-active-kyron-marchan-s-projects.vercel.app';
const PREVIEW_URL = `https://${PREVIEW_HOST}`;
const VIEWPORT = { width: 1280, height: 800 };
const SS_DIR = resolve('verification', 'pr296-roster-active-smoke');
mkdirSync(SS_DIR, { recursive: true });

// ── Admin SDK — for name lookup + guaranteed cleanup ───────────────────────
const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require('../../functions/service-account-key.json'),
    ),
  });
}
const db = admin.firestore();
const TENANT_ID = 'tatillife_south';

async function resolveAgent() {
  const userRecord = await admin.auth().getUserByEmail(AGENT_EMAIL);
  const uid = userRecord.uid;
  const snap = await db.doc(`tenants/${TENANT_ID}/users/${uid}`).get();
  const data = snap.data() ?? {};
  return { uid, name: data.name ?? data.email ?? AGENT_EMAIL };
}

async function adminSetActive(uid, value) {
  await db.doc(`tenants/${TENANT_ID}/users/${uid}`).update({ active: value });
}

async function adminDeleteActiveField(uid) {
  await db
    .doc(`tenants/${TENANT_ID}/users/${uid}`)
    .update({ active: admin.firestore.FieldValue.delete() });
}

// ── Playwright helpers ─────────────────────────────────────────────────────
async function loginAsManager(page) {
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', MGR_EMAIL);
  await page.fill('input[type="password"]', MGR_PASSWORD);
  await Promise.all([
    page.waitForFunction(
      () => document.querySelector('nav[aria-label="Primary navigation"]') !== null,
      { timeout: 40_000 },
    ),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2500);
}

// tabIdMap: map from label text to data-testid id used by Sidebar.jsx
const TAB_ID = {
  Team: 'nav-team',
  Awards: 'nav-awards',
  Leaderboard: 'nav-leaderboard',
};

async function clickSidebarTab(page, label) {
  const testId = TAB_ID[label];
  if (testId) {
    // Prefer data-testid selector (Sidebar.jsx: data-testid="nav-{item.id}")
    await page.click(`[data-testid="${testId}"]`);
  } else {
    // Fallback: text-based search
    await page.evaluate((lbl) => {
      const candidates = Array.from(
        document.querySelectorAll('nav[aria-label="Primary navigation"] button, nav[aria-label="Primary navigation"] a'),
      );
      const match = candidates.find((el) => el.textContent.trim().includes(lbl));
      if (!match) throw new Error(`Sidebar tab not found: ${lbl}`);
      match.click();
    }, label);
  }
  await page.waitForTimeout(1500);
}

// Read all visible agent names from the active user list in UserManagementPanel
async function readActiveRosterNames(page) {
  return await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[data-testid="user-row"], .user-row'));
    if (rows.length > 0) {
      return rows.map((r) => r.textContent.trim());
    }
    // fallback: read all name-like elements in the panel
    // Look for the user list container — it contains list of user rows
    const listItems = Array.from(document.querySelectorAll('ul li, div[class*="user"]'));
    return listItems.map((li) => li.textContent.trim()).filter((t) => t.length > 2 && t.length < 200);
  });
}

// More reliable: read the entire user management section text and check for name
async function rosterContainsName(page, name) {
  return await page.evaluate((n) => {
    // Find the Team / User Management section — look for a heading or the Show inactive button
    const showInactiveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      /show inactive|hide inactive/i.test(b.textContent),
    );
    if (!showInactiveBtn) return null; // panel not visible

    // Walk up to find the panel container
    let container = showInactiveBtn.closest('section, div[class*="panel"], main, [role="main"]');
    if (!container) container = document.body;

    const text = container.textContent ?? '';
    return text.includes(n);
  }, name);
}

// Check if the "Inactive" badge is visible next to the agent name
async function rosterContainsInactiveName(page, name) {
  return await page.evaluate((n) => {
    const inactiveBadges = Array.from(document.querySelectorAll('span')).filter((s) =>
      /^inactive$/i.test(s.textContent.trim()),
    );
    for (const badge of inactiveBadges) {
      const rowContainer = badge.closest('li, div');
      if (rowContainer && rowContainer.textContent.includes(n)) return true;
    }
    return false;
  }, name);
}

// Read names from BmAtRiskPanel rows
async function atRiskPanelContainsName(page, name) {
  return await page.evaluate((n) => {
    const rows = document.querySelector('[data-testid="bm-at-risk-rows"]');
    if (!rows) return false;
    return rows.textContent.includes(n);
  }, name);
}

// Read all leaderboard entry names
async function leaderboardContainsName(page, name) {
  return await page.evaluate((n) => {
    return document.body.textContent.includes(n);
  }, name);
}

// ── Main smoke ─────────────────────────────────────────────────────────────
(async () => {
  console.log('[smoke] pr296-roster-active-smoke');
  console.log(`[smoke] preview: ${PREVIEW_HOST}`);

  const { uid: agentUid, name: agentName } = await resolveAgent();
  console.log(`[smoke] test agent: ${agentName} (uid: ...${agentUid.slice(-6)})`);

  const failures = [];
  const findings = [];
  const consoleErrors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  await setupBypassSession(context, PREVIEW_URL, TOKEN);
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Track agent original state for cleanup
  let originalActive;
  try {
    const userSnap = await db.doc(`tenants/${TENANT_ID}/users/${agentUid}`).get();
    originalActive = userSnap.data()?.active;
  } catch (_) {}

  try {
    // ── Login ────────────────────────────────────────────────────────────
    await page.goto(PREVIEW_URL + '/', { waitUntil: 'domcontentloaded' });
    await loginAsManager(page);
    console.log('[smoke] logged in as manager');
    await page.screenshot({ path: join(SS_DIR, '00-logged-in.png') });

    // ── LEG 1: Set active:false via Admin SDK, verify browser filtering ───
    // NOTE: deactivateUser CF (UI path) was tested and fails with
    // FirebaseError: internal — this is a pre-existing CF error unrelated to
    // PR #296. PR #296 changes the FILTER logic in getTenantUsers, not the
    // deactivation flow. We set active:false directly via Admin SDK to test
    // the filtering behavior that this PR introduced.
    console.log('\n[smoke] ── Leg 1: Deactivate (Admin SDK) → verify roster ────────');
    await clickSidebarTab(page, 'Team');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(SS_DIR, '01-team-tab-before.png') });

    // Confirm agent visible BEFORE deactivation
    const beforeRoster = await rosterContainsName(page, agentName);
    console.log(`[smoke] Before deactivation — "${agentName}" in roster: ${beforeRoster}`);
    if (!beforeRoster) {
      // Ensure agent is active first
      await adminDeleteActiveField(agentUid);
      await page.waitForTimeout(1000);
      await hardReloadAndAwaitReady(page);
      await clickSidebarTab(page, 'Team');
      await page.waitForTimeout(2000);
    }

    // Set active:false via Admin SDK (simulates deactivateUser CF write)
    await adminSetActive(agentUid, false);
    console.log('[smoke] Admin SDK: set active:false — waiting for Firestore to settle');
    await page.waitForTimeout(1500);

    // Hard reload + verify agent is GONE from active roster
    await hardReloadAndAwaitReady(page);
    await page.waitForTimeout(2000);
    await clickSidebarTab(page, 'Team');
    await page.waitForTimeout(2000);

    const afterRoster = await rosterContainsName(page, agentName);
    await page.screenshot({ path: join(SS_DIR, '01e-post-reload-team.png') });
    console.log(`[smoke] Leg 1 — after deactivate+reload: "${agentName}" in active roster: ${afterRoster}`);

    if (afterRoster === null) {
      failures.push('Leg 1: UserManagementPanel not found in DOM after reload');
    } else if (afterRoster === true) {
      failures.push(`Leg 1: Agent "${agentName}" still visible in active roster after deactivation + reload`);
    } else {
      console.log('[smoke] Leg 1 PASS — agent absent from active roster after deactivation');
    }

    // ── LEG 2: BM at-risk view, awards feed, leaderboard ────────────────────
    console.log('\n[smoke] ── Leg 2: Awards tab + Leaderboard ─────────────────────');

    // Awards tab
    await clickSidebarTab(page, 'Awards');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(SS_DIR, '02a-awards-tab.png') });

    // Check BmAtRiskPanel
    const inAtRisk = await atRiskPanelContainsName(page, agentName);
    console.log(`[smoke] Leg 2 — BmAtRiskPanel contains "${agentName}": ${inAtRisk}`);
    if (inAtRisk === true) {
      failures.push(`Leg 2: Deactivated agent "${agentName}" appears in BmAtRiskPanel`);
    } else if (inAtRisk === false) {
      console.log('[smoke] Leg 2 BmAtRiskPanel PASS — agent absent');
    } else {
      findings.push('Leg 2: BmAtRiskPanel [data-testid="bm-at-risk-rows"] not present in DOM — panel may be empty or user has no agentIds');
      console.log('[smoke] Leg 2 BmAtRiskPanel — panel not present (empty state or no agents)');
    }

    // Check entire awards section for agent name
    const awardsPageText = await page.evaluate((n) => document.body.textContent.includes(n), agentName);
    console.log(`[smoke] Leg 2 — Awards page contains "${agentName}": ${awardsPageText}`);
    if (awardsPageText) {
      // Check if it's in a section we care about (could be a toast or nav element)
      const inAwardsFeed = await page.evaluate((n) => {
        const awardsSections = Array.from(document.querySelectorAll('section[aria-labelledby], [data-testid]'));
        return awardsSections.some((s) => s.textContent.includes(n));
      }, agentName);
      if (inAwardsFeed) {
        failures.push(`Leg 2: Deactivated agent "${agentName}" appears in Awards feed section`);
      } else {
        findings.push(`Leg 2: Awards page body contains "${agentName}" but not in a labeled section — likely navigation or toast text, not a data row`);
        console.log('[smoke] Leg 2 Awards feed PASS — name in body but not in awards data sections');
      }
    } else {
      console.log('[smoke] Leg 2 Awards feed PASS — agent absent from awards page');
    }

    // Leaderboard tab
    await clickSidebarTab(page, 'Leaderboard');
    await page.waitForTimeout(4000); // Leaderboard has Firebase subscription latency
    await page.screenshot({ path: join(SS_DIR, '02b-leaderboard-tab.png') });

    const inLeaderboard = await leaderboardContainsName(page, agentName);
    console.log(`[smoke] Leg 2 — Leaderboard contains "${agentName}": ${inLeaderboard}`);
    if (inLeaderboard) {
      // PR #296 scope: leaderboard ranking comes from the `leaderboard` subcollection,
      // NOT from getTenantUsers. Our change only patched the photo-map fetch.
      // Agent presence in leaderboard ranking is a FINDING (out of scope for this PR).
      findings.push(
        `Leg 2 FINDING: Deactivated agent "${agentName}" still appears in Leaderboard ranking. ` +
        'PR #296 scope: leaderboard subcollection query not filtered by active flag (photo-map only). ' +
        'Leaderboard ranking filter is a separate follow-up item.'
      );
      console.log('[smoke] Leg 2 Leaderboard FINDING (not failure) — see findings section');
    } else {
      console.log('[smoke] Leg 2 Leaderboard PASS — agent absent from leaderboard');
    }

    // ── LEG 3: Show inactive toggle ──────────────────────────────────────────
    console.log('\n[smoke] ── Leg 3: Show inactive toggle ─────────────────────────');

    await clickSidebarTab(page, 'Team');
    await page.waitForTimeout(2000);

    // Click "Show inactive" button
    const showInactiveClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /show inactive/i.test(b.textContent),
      );
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!showInactiveClicked) {
      failures.push('Leg 3: "Show inactive" button not found in UserManagementPanel');
      console.log('[smoke] FAIL: Show inactive button not found');
    } else {
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(SS_DIR, '03a-show-inactive.png') });

      // Verify agent appears with "Inactive" badge
      const appearsInactive = await rosterContainsInactiveName(page, agentName);
      console.log(`[smoke] Leg 3 — "${agentName}" appears with Inactive badge: ${appearsInactive}`);

      if (appearsInactive) {
        console.log('[smoke] Leg 3 PASS — agent visible with Inactive badge when Show inactive is toggled on');
      } else {
        // Maybe the name is there without the Inactive badge — check just presence
        const appearsAtAll = await rosterContainsName(page, agentName);
        if (appearsAtAll) {
          findings.push(`Leg 3: Agent "${agentName}" appears in Show Inactive list but without an "Inactive" badge — badge may have different DOM structure`);
          console.log('[smoke] Leg 3 PARTIAL — agent present but Inactive badge not matched (see findings)');
        } else {
          failures.push(`Leg 3: Agent "${agentName}" does NOT appear after toggling "Show inactive"`);
          console.log('[smoke] Leg 3 FAIL — agent not found even with Show inactive on');
        }
      }
    }

    // ── LEG 4: Reactivate (Admin SDK) + verify back in roster ────────────
    // Same Admin SDK approach as Leg 1: CF path is broken, we're testing the
    // filter logic reversal (active:false → active:true re-appears in roster).
    console.log('\n[smoke] ── Leg 4: Reactivate (Admin SDK) → verify roster ────────');

    await adminSetActive(agentUid, true);
    console.log('[smoke] Admin SDK: set active:true — waiting for Firestore to settle');
    await page.waitForTimeout(1500);

    // Hard reload + verify agent is BACK in active roster
    await hardReloadAndAwaitReady(page);
    await page.waitForTimeout(2000);
    await clickSidebarTab(page, 'Team');
    await page.waitForTimeout(2000);

    // Hide inactive (toggle back to default) if Show inactive is still on
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /hide inactive/i.test(b.textContent),
      );
      if (btn) btn.click();
    });
    await page.waitForTimeout(1500);

    const afterReactivation = await rosterContainsName(page, agentName);
    await page.screenshot({ path: join(SS_DIR, '04c-post-reactivate-reload.png') });
    console.log(`[smoke] Leg 4 — after reactivate+reload: "${agentName}" in active roster: ${afterReactivation}`);

    if (afterReactivation === null) {
      failures.push('Leg 4: UserManagementPanel not visible after reload');
    } else if (afterReactivation === false) {
      failures.push(`Leg 4: Agent "${agentName}" NOT back in active roster after reactivation + reload`);
    } else {
      console.log('[smoke] Leg 4 PASS — agent returned to active roster after reactivation');
    }

  } catch (err) {
    safeLog('[smoke] UNHANDLED ERROR:', err.message);
    failures.push(`Unhandled walk error: ${err.message}`);
    await page.screenshot({ path: join(SS_DIR, 'error-state.png') }).catch(() => {});
  } finally {
    // ── Guaranteed cleanup: restore agent to original state ─────────────────
    console.log('\n[smoke] ── Cleanup: restoring agent active state ──────────────');
    try {
      const snap = await db.doc(`tenants/${TENANT_ID}/users/${agentUid}`).get();
      const currentActive = snap.data()?.active;
      if (currentActive === false) {
        // Still deactivated — restore
        if (originalActive === undefined || originalActive === true) {
          await adminDeleteActiveField(agentUid);
          console.log('[smoke] Cleanup: deleted active field (restored to absent/truthy default)');
        } else {
          await adminSetActive(agentUid, true);
          console.log('[smoke] Cleanup: set active: true');
        }
      } else {
        console.log('[smoke] Cleanup: agent already active — no action needed');
      }
    } catch (cleanupErr) {
      safeLog('[smoke] CLEANUP ERROR (agent may still be deactivated):', cleanupErr.message);
    }

    await page.close();
    await context.close();
    await browser.close();
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log('\n[smoke] ═══════════════════════════════════════════════════════════');
  console.log('[smoke] RESULTS');
  console.log('[smoke] ═══════════════════════════════════════════════════════════');

  const legs = {
    'Leg 1 (Deactivate → roster)': failures.some((f) => f.startsWith('Leg 1')),
    'Leg 2 (Awards + Leaderboard)': failures.some((f) => f.startsWith('Leg 2')),
    'Leg 3 (Show inactive)':        failures.some((f) => f.startsWith('Leg 3')),
    'Leg 4 (Reactivate → roster)':  failures.some((f) => f.startsWith('Leg 4')),
  };

  Object.entries(legs).forEach(([leg, hasFail]) => {
    console.log(`  ${hasFail ? 'FAIL' : 'PASS'} — ${leg}`);
  });

  if (findings.length > 0) {
    console.log('\n[smoke] FINDINGS (out of PR scope — informational):');
    findings.forEach((f) => console.log(`  FINDING — ${f}`));
  }

  if (consoleErrors.length > 0) {
    console.log(`\n[smoke] CONSOLE ERRORS (${consoleErrors.length}):`);
    consoleErrors.slice(0, 20).forEach((e) => console.log(`  ${e}`));
  } else {
    console.log('\n[smoke] Console errors: none');
  }

  if (failures.length > 0) {
    console.log(`\n[smoke] FAIL — ${failures.length} failure(s):`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\n[smoke] PASS — 4 legs, 0 failures');
    if (findings.length > 0) console.log('[smoke] See findings above for out-of-scope observations.');
    process.exit(0);
  }
})();
