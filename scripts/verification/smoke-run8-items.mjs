/**
 * smoke-run8-items.mjs — Run 8 per-item live smokes (staging).
 *
 * Value-level, per-item legs mirroring the VH suite hygiene contract
 * (console-clean + zero-prod-requests on every leg). Run after the staging
 * Vercel deploy that carries the item's commit is live.
 *
 * Usage:
 *   node --env-file=.env.staging scripts/verification/smoke-run8-items.mjs [--leg=<substr>]
 *
 * Legs:
 *   a7-mobile-more-adaptive — N5 vertical glyph + N6 adaptive More label (390x844)
 *   a4-campaign-proof-csv   — Export-proof CSV download: rows + meta vs seeded lens
 *   a3-all-users-roster     — stat strip values, search narrow, role-chip filter (TA)
 *   a12-team-panels         — ChampionsPanel + MyWeekPanel honest W0 empty states (BM)
 *   a5-celebration-submit   — MUTATES: submits agent1's W0 draft; medal/stat cards/CTA
 *                             (re-seed resets the submission; run before any leg that
 *                             asserts the W0 draft state, or re-seed after)
 */
import { chromium } from 'playwright';
import { installGlobalTimeout } from './lib/walk-helpers.mjs';
import {
  assertEnv, newLegContext, login, assertLegHygiene, shotFactory, escapeRe,
} from './vh/vh-helpers.mjs';

assertEnv();
installGlobalTimeout(12 * 60_000);

const legFilter = process.argv.find((a) => a.startsWith('--leg='))?.split('=')[1];
const tsel = (id) => `[data-testid="${id}"]`;

const LEGS = [
  {
    id: 'a7-mobile-more-adaptive',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser, { viewport: { width: 390, height: 844 } });
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        await p.waitForTimeout(2000); // post-login dashboard settle (probe-verified stable state)
        const more = p.locator(tsel('bottomnav-more'));
        await more.waitFor({ state: 'visible', timeout: 20_000 });

        // N5: vertical glyph (lucide renders MoreVertical as .lucide-ellipsis-vertical)
        const glyph = await more.locator('svg.lucide-ellipsis-vertical').count();
        if (glyph !== 1) throw new Error(`N5: expected vertical ⋮ glyph in More slot, found ${glyph}`);
        const idleLabel = (await more.innerText()).trim();
        if (!/^More$/i.test(idleLabel)) throw new Error(`N6: idle More label = "${idleLabel}" (expected "More")`);

        // Open the More drawer and navigate to a SHELL-PRESERVING drawer-only
        // tab (full-screen surfaces like the wizard unmount the bottom nav, so
        // "first item" is not a safe pick). Prefer known panel tabs.
        await more.click();
        await p.waitForTimeout(600);
        const drawer = p.locator('[role="dialog"], [data-testid="mobile-nav-drawer"]').first();
        await drawer.waitFor({ state: 'visible', timeout: 8_000 });
        const preferred = ['Persistency', 'Awards', 'Goals', 'Policy Ledger', 'Reports'];
        let item = null, itemLabel = null;
        for (const label of preferred) {
          const cand = drawer.getByRole('button', { name: new RegExp(`^${escapeRe(label)}$`, 'i') }).first();
          if (await cand.count()) { item = cand; itemLabel = label; break; }
        }
        if (!item) throw new Error('no preferred shell-preserving drawer item found');
        await item.click();
        await p.waitForTimeout(1200);

        // N6: More slot now shows the active drawer item's label + active state.
        const activeLabel = (await more.innerText()).trim();
        if (!new RegExp(escapeRe(itemLabel), 'i').test(activeLabel)) {
          throw new Error(`N6: after navigating to "${itemLabel}", More slot shows "${activeLabel}"`);
        }
        const ariaCurrent = await more.getAttribute('aria-current');
        if (ariaCurrent !== 'page') throw new Error(`N6: aria-current="${ariaCurrent}" (expected "page")`);
        await shot(p, 'a7-more-adaptive-active');

        // Navigate back to a primary tab → slot reverts to "More".
        const home = p.locator('[data-testid^="bottomnav-"]:not([data-testid="bottomnav-more"])').first();
        await home.click();
        await p.waitForTimeout(1000);
        const revertLabel = (await more.innerText()).trim();
        if (!/^More$/i.test(revertLabel)) throw new Error(`N6: revert label = "${revertLabel}" (expected "More")`);
        await shot(p, 'a7-more-adaptive-idle');

        assertLegHygiene(ctx);
        return `More slot: ⋮ glyph ok; adaptive label "${itemLabel}" + aria-current=page while drawer tab active; reverts to "More". hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
  {
    id: 'a4-campaign-proof-csv',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser, { acceptDownloads: true });
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        const tab = p.locator(tsel('agent-tab-policy-ledger'));
        await tab.waitFor({ state: 'visible', timeout: 20_000 });
        await tab.click();
        await p.locator(tsel('campaign-lens-panel')).waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(600);

        // Which campaign did the lens default to? (Qualify vs Placement — both active.)
        const stripName = (await p.locator(tsel('campaign-lens-strip')).innerText()).replace(/\s+/g, ' ');
        const isQualify = /Qualify/i.test(stripName);
        // Export covers ALL contribution states (counts + pending + excluded) = 6
        // rows either way (A1's 5 vhfix + Run-1 smoke leftover), per builder design.
        const expRows = 6;

        const btn = p.locator(tsel('campaign-lens-export'));
        await btn.waitFor({ state: 'visible', timeout: 8_000 });
        if (await btn.isDisabled()) throw new Error('Export-proof button is disabled with seeded contributions present');

        const [download] = await Promise.all([
          p.waitForEvent('download', { timeout: 15_000 }),
          btn.click(),
        ]);
        const fname = download.suggestedFilename();
        if (!/^campaign-proof-.+\.csv$/.test(fname)) throw new Error(`filename "${fname}" !~ campaign-proof-*.csv`);
        const path = await download.path();
        const { readFileSync } = await import('fs');
        const text = readFileSync(path, 'utf8');
        const lines = text.trim().split(/\r?\n/);
        if (!/^Campaign,/.test(lines[0])) throw new Error(`meta row missing: "${lines[0]}"`);
        if (!/^Generated,/.test(lines[1])) throw new Error(`meta row missing: "${lines[1]}"`);
        const headerIdx = lines.findIndex((l) => /^Policy Owner,/.test(l));
        if (headerIdx === -1) throw new Error('header row not found');
        const dataRows = lines.length - headerIdx - 1;
        if (dataRows !== expRows) throw new Error(`CSV data rows = ${dataRows} (expected ${expRows}); campaign=${isQualify ? 'Qualify' : 'Placement'}; head: ${lines.slice(0, 4).join(' | ')}`);
        await shot(p, 'a4-export-clicked');

        assertLegHygiene(ctx);
        return `Export proof: "${fname}" downloaded; meta rows ok; ${dataRows} data rows (${isQualify ? 'Qualify' : 'Placement'} lens). hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
  {
    id: 'a3-all-users-roster',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'tenant_admin');
        const nav = p.locator('nav[aria-label="Primary navigation"]');
        await nav.getByRole('button', { name: /users/i }).first().click();
        await p.locator(tsel('user-stat-strip')).waitFor({ state: 'visible', timeout: 20_000 });

        // Value-level stat strip vs seeded roster (5 core + cro + sales_manager
        // + vhfix-um2 2nd unit_manager [Run 8 Tier B t1-compliance-scope
        // fixture, seed-fixtures.mjs § A14] = 8).
        const statVal = async (id) => {
          const t = (await p.locator(tsel(id)).innerText()).replace(/\s+/g, ' ');
          const m = t.match(/(\d+)/);
          return m ? Number(m[1]) : NaN;
        };
        const exp = { 'user-stat-total': 8, 'user-stat-active': 8, 'user-stat-deactivated': 0, 'user-stat-role-agent': 2 };
        for (const [id, want] of Object.entries(exp)) {
          const got = await statVal(id);
          if (got !== want) throw new Error(`${id}=${got} (expected ${want})`);
        }

        // Search narrows to the two agents (write-read on the filter state).
        await p.locator(tsel('user-search-input')).fill('Staging Agent');
        await p.waitForTimeout(500);
        const rowCount = async () => p.locator('tbody tr').count();
        const afterSearch = await rowCount();
        if (afterSearch !== 2) throw new Error(`search "Staging Agent" → ${afterSearch} rows (expected 2)`);

        // Role chip composes (AND): + branch_manager chip → 0 rows, honest empty.
        await p.locator(tsel('role-filter-branch_manager')).click();
        await p.waitForTimeout(400);
        await p.locator(tsel('user-roster-empty-filtered')).waitFor({ state: 'visible', timeout: 8_000 });

        // Clear filters restores the full roster.
        await p.locator(`${tsel('user-clear-filters')}, ${tsel('user-clear-filters-empty')}`).first().click();
        await p.waitForTimeout(400);
        const restored = await rowCount();
        if (restored !== 8) throw new Error(`after clear-filters → ${restored} rows (expected 8)`);
        await shot(p, 'a3-roster-restored');

        assertLegHygiene(ctx);
        return `stat strip 8/8/0 + agents 2; search→2 rows; +BM chip→honest empty; clear→8 rows. hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
  {
    id: 'a12-team-panels',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'branch_manager');
        // Both panels live on the manager overview (Team tab area). Honest W0
        // empties are the correct value-level expectation: the only W0 sub is
        // A1's draft (rankWeeklyChampions filters to submitted), and neither
        // manager seeds a W0 own-submission.
        await p.locator(tsel('champions-panel-empty')).waitFor({ state: 'attached', timeout: 25_000 });
        await p.locator(tsel('my-week-panel-empty')).waitFor({ state: 'attached', timeout: 15_000 });
        const myWeekText = (await p.locator(tsel('my-week-panel-empty')).innerText()).replace(/\s+/g, ' ');
        if (!/no report started/i.test(myWeekText)) throw new Error(`MyWeek empty state text: "${myWeekText}" (expected /no report started/i)`);
        // Status pill (MyWeekPanel.jsx:32 'Not started') renders in the panel shell.
        const pill = await p.locator(tsel('my-week-panel')).getByText(/not started/i).count()
          .catch(() => 0);
        if (!pill) throw new Error('MyWeek "Not started" status pill absent');
        await shot(p, 'a12-team-panels-empty-states');
        assertLegHygiene(ctx);
        return `ChampionsPanel + MyWeekPanel render honest W0 empty states (draft-only week). hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
  {
    id: 'a6-kiosk-panel-toggle',
    async run({ browser, shot }) {
      // Write-read-verify: BM toggles compliance OFF → kiosk rotation total
      // 13→12 and compliance absent → toggle back ON → total 13. Safest panel
      // per builder analysis: submission-dependent (in rotation), not a
      // dynamic-splice anchor, last in PANEL_ORDER.
      const { EXPECT, BASE } = await import('./vh/expectations.mjs');
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'branch_manager');
        // BM sidebar defaults to the My Work workspace; Kiosk Mode lives in
        // My Team (tier2 header idiom: sidebar-ws-toggle-team first).
        await p.locator(tsel('sidebar-ws-toggle-team')).click({ timeout: 15_000 });
        await p.waitForTimeout(500);
        const nav = p.locator('nav[aria-label="Primary navigation"]');
        await nav.getByRole('button', { name: /kiosk/i }).first().click();
        const toggle = p.locator(tsel('kiosk-panel-toggle-compliance'));
        await toggle.waitFor({ state: 'visible', timeout: 20_000 });
        const readKioskTotal = async () => {
          const kctx = await newLegContext(browser);
          try {
            const kp = kctx.page;
            await kp.goto(`${BASE}/kiosk/${EXPECT.kiosk.tenant}/${EXPECT.kiosk.token}`, { waitUntil: 'domcontentloaded' });
            await kp.locator(tsel('kiosk-chapter-overlay')).waitFor({ state: 'attached', timeout: 30_000 });
            const txt = (await kp.locator(tsel('kiosk-chapter-overlay')).innerText()).replace(/\s+/g, ' ');
            const total = Number(txt.match(/\/\s*(\d{1,2})/)?.[1]);
            if (kctx.prodRequests.length) throw new Error('PROD-ISOLATION breach in kiosk read');
            return total;
          } finally { await kctx.context.close(); }
        };

        // togglePanel early-returns while a save is in flight (savingKey guard)
        // and the switch disables during the write — poll state transitions
        // instead of racing fixed waits against the serverTimestamp round-trip.
        const waitChecked = async (want, label) => {
          const deadline = Date.now() + 10_000;
          while (Date.now() < deadline) {
            if ((await toggle.getAttribute('aria-checked')) === want
                && (await toggle.isEnabled())) return;
            await p.waitForTimeout(250);
          }
          await shot(p, `a6-stuck-${label}`);
          throw new Error(`toggle did not settle at aria-checked=${want} (${label})`);
        };
        const clickWhenIdle = async () => {
          const deadline = Date.now() + 10_000;
          while (!(await toggle.isEnabled()) && Date.now() < deadline) await p.waitForTimeout(250);
          await toggle.click();
        };

        // Self-heal: a prior aborted run may have left compliance OFF.
        if ((await toggle.getAttribute('aria-checked')) === 'false') {
          await clickWhenIdle();
          await waitChecked('true', 'self-heal');
        }
        await waitChecked('true', 'start');

        // OFF
        await clickWhenIdle();
        await waitChecked('false', 'off');
        await shot(p, 'a6-toggle-off');
        const totalOff = await readKioskTotal();
        if (totalOff !== 12) throw new Error(`kiosk total with compliance OFF = ${totalOff} (expected 12)`);

        // ON (restore)
        await clickWhenIdle();
        await waitChecked('true', 'restore');
        const totalOn = await readKioskTotal();
        if (totalOn !== 13) throw new Error(`kiosk total restored = ${totalOn} (expected 13)`);

        assertLegHygiene(ctx);
        return `compliance toggle OFF → kiosk rotation 12 (was 13), restore ON → 13. Write-read-verify through deployed rules. hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
  {
    id: 'a5-celebration-submit',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        const { weekLabel, W } = await import('./vh/expectations.mjs');
        await login(p, 'agent1');
        // Open the W0 draft via History → viewer → Continue editing
        // (t2-history-edit-path idiom verbatim).
        await p.locator(tsel('agent-tab-history')).first().click({ timeout: 12_000 });
        await p.getByText(/WEEKS SUBMITTED/i).first().waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(1000);
        const draftLabel = weekLabel(W(0));
        await p.locator(`[aria-label="Open submission from ${draftLabel}"]`).click({ timeout: 8000 });
        await p.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 10_000 });
        await p.getByRole('button', { name: /Continue editing/i }).click({ timeout: 8000 });
        await p.locator(tsel('wizard-v2-modal')).waitFor({ state: 'visible', timeout: 12_000 });
        await p.waitForTimeout(800);

        const { weekNumber, getMostRecentSunday } = await import('../../src/utils/dateHelpers.js');
        const expectedWk = weekNumber(getMostRecentSunday());

        // Walk: the fast-path confirm ("Looks good →", week-confirm-next) is
        // the ENTRY, not the submit — ratings/next-week-goals steps follow it,
        // and the LAST wizard-v2-next click performs the submit. Loop until
        // the celebration attaches.
        const celebration = p.locator(tsel('wizard-v2-celebration'));
        const confirmEntry = p.locator(tsel('week-confirm-next')).first();
        if (await confirmEntry.count()) {
          await confirmEntry.click({ timeout: 8000 });
          await p.waitForTimeout(800);
        }
        // Tolerant walk: the final Next click flips to a disabled "submitting"
        // state and the celebration replaces the form — never hard-fail a click
        // race; poll (celebration | enabled-next) each round instead.
        const walkDeadline = Date.now() + 90_000;
        while (Date.now() < walkDeadline) {
          if (await celebration.count()) break;
          const next = p.locator(tsel('wizard-v2-next')).first();
          if ((await next.count()) && (await next.isEnabled().catch(() => false))) {
            await next.click({ timeout: 5000 }).catch(() => {});
          }
          await p.waitForTimeout(1000);
        }
        if (!(await celebration.count())) await shot(p, 'a5-no-celebration');
        await celebration.waitFor({ state: 'attached', timeout: 10_000 });
        await p.waitForTimeout(1500); // count-up settle

        // Medal: WEEK-N wired from the submitted week (app-helper cross-check).
        const wkText = (await p.locator(tsel('wizard-v2-celebration-week-value')).innerText()).trim();
        const wkNum = Number(wkText.match(/(\d{1,2})/)?.[1]);
        if (wkNum !== expectedWk) throw new Error(`medal week = "${wkText}" → ${wkNum} (expected ${expectedWk})`);

        // Stat cards render numeric values; commission is TTD-formatted.
        const apps = (await p.locator(tsel('wizard-v2-celebration-stat-apps-value')).innerText()).trim();
        if (!/^\d+$/.test(apps)) throw new Error(`apps card value "${apps}" not a count`);
        const comm = (await p.locator(tsel('wizard-v2-celebration-stat-commission-value')).innerText()).trim();
        if (!/(?:TTD|TT\$|\$)\s?[\d,]+/.test(comm)) throw new Error(`commission card "${comm}" not TTD-formatted`);
        await shot(p, 'a5-celebration');

        // Secondary CTA opens the SubmissionViewer overlay.
        await p.locator(tsel('wizard-v2-celebration-view-submission')).click();
        await p.waitForTimeout(1200);
        const viewerVisible = await p.locator('[data-testid="submission-viewer"], .modal, [role="dialog"]').first().isVisible();
        if (!viewerVisible) throw new Error('View submission CTA did not open the viewer overlay');
        await shot(p, 'a5-viewer-open');

        assertLegHygiene(ctx);
        return `submitted W0 draft: medal WK ${wkNum} == weekNumber(W0); apps=${apps}; commission ${comm}; View-submission opens viewer. NOTE: MUTATED staging (W0 now submitted; re-seed resets). hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
];

const run = async () => {
  const browser = await chromium.launch();
  const shot = shotFactory('run8-items');
  let pass = 0, fail = 0;
  for (const leg of LEGS) {
    if (legFilter && !leg.id.includes(legFilter)) continue;
    try {
      const detail = await leg.run({ browser, shot });
      pass += 1;
      console.log(`✓ PASS ${leg.id} — ${detail}`);
    } catch (e) {
      fail += 1;
      console.log(`✗ FAIL ${leg.id} — ${e.message}`);
    }
  }
  await browser.close();
  console.log(`RUN8 ITEM SMOKES: PASS ${pass} / FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
};
run();
