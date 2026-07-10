/**
 * tier1.mjs — VH Run-2 Tier-1 LIVE smoke legs (staging). Same contract as
 * tier0.mjs: each leg PASSES by returning a detail string, FAILS by throwing,
 * SKIPs by throwing new Error('SKIP: <reason>'). Every leg runs
 * assertLegHygiene(ctx) before returning and closes its context in `finally`.
 *
 * Scope (brief Tier-1): command palette cross-role, Agent Report View populated,
 * admin quick-add, sidebar drag-reorder write-read-verify, exception lead panel
 * + AgentDrill, and the Master Sheet reality bar / presets / exceptions toggle.
 * Value-level assertions only (exact numbers, ordering, state changes verified
 * by re-read) — selector presence alone is never a pass.
 */
import {
  newLegContext, login, gotoTab, assertLegHygiene, currencyRe,
} from './vh-helpers.mjs';
import { EXPECT, W } from './expectations.mjs';

// ── tier1-private helpers ────────────────────────────────────────────────────

/** Open the command palette via Ctrl+K and wait for its dialog. */
async function openPalette(page) {
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[role="dialog"][aria-label="Command palette"]', { timeout: 8_000 });
}

/** Return the document-order index list of nav rows for the given testids. */
async function navOrder(page, testIds) {
  return page.evaluate((ids) => {
    const all = [...document.querySelectorAll('[data-testid]')];
    return ids
      .map((id) => ({ id, idx: all.findIndex((el) => el.getAttribute('data-testid') === id) }))
      .sort((a, b) => a.idx - b.idx)
      .map((x) => x.id);
  }, testIds);
}

/** Center-based pointer drag of one sidebar row onto the upper half of another. */
async function dragRowAbove(page, fromTestId, toTestId) {
  const rowLoc = (tid) => page.locator('.sidebar-link-row', { has: page.locator(`[data-testid="${tid}"]`) }).first();
  const box = async (tid) => {
    const b = await rowLoc(tid).boundingBox();
    if (!b) throw new Error(`no boundingBox for row ${tid}`);
    return b;
  };
  // The sidebar scrolls independently — target rows can sit below the viewport,
  // where mouse events would miss them. Scroll both into view before dragging.
  await rowLoc(toTestId).scrollIntoViewIfNeeded();
  await rowLoc(fromTestId).scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const from = await box(fromTestId);
  const to = await box(toTestId);
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  // Target Y in the UPPER half of the destination row → computeOverIdx returns
  // the destination index (insert-before).
  const toY = to.y + 3;
  const toX = to.x + to.width / 2;
  await page.mouse.move(fromCx, fromCy);
  await page.mouse.down();
  // Exceed the 5px DRAG_THRESHOLD, then walk to the target in steps.
  await page.mouse.move(fromCx, fromCy - 12, { steps: 4 });
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.move(toX, toY, { steps: 2 }); // settle over target
  await page.mouse.up();
  await page.waitForTimeout(600);
}

/** Read the Master Sheet reality-bar quartet + footer summary as strings. */
async function readReality(page) {
  const t = async (tid) => (await page.locator(`[data-testid="${tid}"]`).first().textContent())?.trim();
  const weekapi = await t('mastersheet-reality-weekapi');
  const submitted = await t('mastersheet-reality-submitted');
  const filed = await t('mastersheet-reality-filed');
  const exceptions = await t('mastersheet-reality-exceptions');
  return { weekapi, submitted, filed, exceptions };
}

// ─────────────────────────────────────────────────────────────────────────────

export const LEGS = [
  // ── 1a. Palette — agent1 desktop: dialog contract + filter→Enter navigation ──
  {
    id: 't1-palette-agent-desktop',
    role: 'agent1',
    desc: 'agent1 desktop Ctrl+K → dialog contract → filter "history" → Enter navigates to History (nav becomes active, palette closes)',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        await login(ctx.page, 'agent1');
        const p = ctx.page;
        await openPalette(p);
        // Dialog contract: role=dialog + aria-modal + focused search input.
        const dlg = p.locator('[role="dialog"][aria-label="Command palette"]');
        const ariaModal = await dlg.getAttribute('aria-modal');
        if (ariaModal !== 'true') throw new Error(`palette aria-modal="${ariaModal}" (expected "true")`);
        const input = p.locator('input[aria-label="Search commands"]');
        const focused = await input.evaluate((el) => el === document.activeElement);
        if (!focused) throw new Error('palette search input not focused on open');
        // Filter "history" → single "Go to" option → Enter navigates.
        await input.fill('history');
        await p.waitForSelector('[data-testid="cmdk-option-nav:history"]', { timeout: 5_000 });
        await input.press('Enter');
        // Palette closes and History nav becomes the active page.
        await p.waitForSelector('[role="dialog"][aria-label="Command palette"]', { state: 'detached', timeout: 6_000 });
        await p.waitForSelector('[data-testid="agent-tab-history"][aria-current="page"]', { timeout: 6_000 });
        const title = (await p.locator('h1.topbar-title').textContent())?.trim();
        if (!/history/i.test(title || '')) throw new Error(`topbar title="${title}" (expected History)`);
        await shot(p, 't1-palette-agent-desktop');
        assertLegHygiene(ctx);
        return `palette dialog contract OK (aria-modal, input focused); "history"→Enter navigated to History (title="${title}", nav active); hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 1b. Palette — branch_manager desktop: Actions group + master→Enter ──
  {
    id: 't1-palette-bm-desktop',
    role: 'branch_manager',
    desc: 'branch_manager desktop: switch to My Team workspace → Ctrl+K → Actions group present → filter "master" → Enter → Master Sheet reality bar renders',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        await login(ctx.page, 'branch_manager');
        const p = ctx.page;
        // Master Sheet is a My-Team surface; the palette is workspace-scoped, so
        // switch workspace before opening (Run-1 "both"-layout behaviour).
        await p.locator('[data-testid="sidebar-ws-toggle-team"]').click();
        await p.waitForTimeout(700);
        await openPalette(p);
        // The team manager palette carries Quick-Add create actions → Actions group.
        const actions = p.locator('[role="group"][aria-label="Actions"]');
        if (await actions.count() === 0) throw new Error('Actions group absent in branch_manager (My Team) palette');
        const input = p.locator('input[aria-label="Search commands"]');
        await input.fill('master');
        await p.waitForSelector('[data-testid="cmdk-option-nav:mastersheet"]', { timeout: 5_000 });
        await input.press('Enter');
        await p.waitForSelector('[role="dialog"][aria-label="Command palette"]', { state: 'detached', timeout: 6_000 });
        await p.waitForSelector('[data-testid="mastersheet-reality"]', { timeout: 10_000 });
        const weekapi = (await p.locator('[data-testid="mastersheet-reality-weekapi"]').textContent())?.trim();
        await shot(p, 't1-palette-bm-desktop');
        assertLegHygiene(ctx);
        return `Actions group present; "master"→Enter navigated to Master Sheet (reality bar visible, WEEK API=${weekapi}); hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 1c. Palette — agent1 MOBILE: topbar-mobile-search trigger 44px + open/close ──
  {
    id: 't1-palette-agent-mobile',
    role: 'agent1',
    desc: 'agent1 mobile 390x844 .topbar-mobile-search trigger visible + ~44px → opens palette → Escape closes',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser, { viewport: { width: 390, height: 844 } });
      try {
        await login(ctx.page, 'agent1');
        const p = ctx.page;
        const trigger = p.locator('.topbar-mobile-search');
        await trigger.waitFor({ state: 'visible', timeout: 8_000 });
        const box = await trigger.boundingBox();
        if (!box) throw new Error('mobile search trigger has no boundingBox');
        if (box.width < 43 || box.height < 43) {
          throw new Error(`mobile search box ${Math.round(box.width)}x${Math.round(box.height)} < 44px touch target`);
        }
        await trigger.click();
        await p.waitForSelector('[role="dialog"][aria-label="Command palette"]', { timeout: 8_000 });
        await p.keyboard.press('Escape');
        await p.waitForSelector('[role="dialog"][aria-label="Command palette"]', { state: 'detached', timeout: 6_000 });
        await shot(p, 't1-palette-agent-mobile');
        assertLegHygiene(ctx);
        return `mobile trigger visible ${Math.round(box.width)}x${Math.round(box.height)}px (≥44); opened palette + Escape closed; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 2. Agent Report View populated (extractFields path) ──
  {
    id: 't1-agent-report-populated',
    role: 'agent1',
    desc: 'agent1 → Report nav tab: hero YTD API = 122,000, apps = 22, tenure-floor line "122,000 / 250,000" + 49% pace',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser, { reducedMotion: 'reduce' });
      try {
        await login(ctx.page, 'agent1');
        const p = ctx.page;
        await gotoTab(p, 'Report');
        const hero = p.locator('[data-testid="agent-report-hero"]');
        await hero.waitFor({ state: 'attached', timeout: 12_000 });
        // (1) hero YTD API — the extractFields settled/submitted YTD figure.
        const heroApi = p.locator('[data-testid="agent-report-hero-api"]');
        await heroApi.getByText(currencyRe(EXPECT.a1.ytdApi)).first().waitFor({ state: 'attached', timeout: 12_000 });
        // (2) hero apps count (22) — anchored to the "APPS · Submitted/Settled"
        // label so it's the apps StatBlock value, not an incidental "22".
        const heroText = (await hero.textContent()) || '';
        const appsRe = new RegExp(`APPS · (?:Submitted|Settled)\\s*${EXPECT.a1.ytdApps}(?!\\d)`);
        if (!appsRe.test(heroText)) {
          throw new Error(`hero apps: expected "APPS · …${EXPECT.a1.ytdApps}" in "${heroText.replace(/\s+/g, ' ').slice(0, 140)}"`);
        }
        // (3) tenure-floor line: "TTD 122,000 / TTD 250,000".
        const floorLine = p.getByText(new RegExp(`${currencyRe(EXPECT.a1.ytdApi).source}\\s*/\\s*${currencyRe(EXPECT.tenureFloorAnnual).source}`));
        await floorLine.first().waitFor({ state: 'attached', timeout: 8_000 });
        // (4) floor pace percent: 122,000 / 250,000 = 48.8% → 49%.
        const pace = Math.round((EXPECT.a1.ytdApi / EXPECT.tenureFloorAnnual) * 100);
        await p.getByText(new RegExp(`${pace}%`)).first().waitFor({ state: 'attached', timeout: 8_000 });
        await shot(p, 't1-agent-report-populated');
        assertLegHygiene(ctx);
        return `Report populated: hero YTD ${EXPECT.a1.ytdApi} + apps ${EXPECT.a1.ytdApps}; floor line ${EXPECT.a1.ytdApi}/${EXPECT.tenureFloorAnnual} @ ${pace}%; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 3. Admin quick-add fires (tenant_admin) — NEVER submits ──
  {
    id: 't1-admin-quick-add',
    role: 'tenant_admin',
    desc: 'tenant_admin FAB → QuickAddMenu → "New user" opens CreateUserDrawer (dialog) → Escape; then "New branch" opens Add-branch modal. No form submitted.',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        await login(ctx.page, 'tenant_admin');
        const p = ctx.page;
        const fab = p.locator('[data-testid="tenant-admin-quick-add-fab"]');
        await fab.waitFor({ state: 'visible', timeout: 10_000 });

        // New user → CreateUserDrawer (role=dialog, "Add New User").
        await fab.click();
        await p.waitForSelector('[role="dialog"][aria-label="Quick add"]', { timeout: 6_000 });
        await p.locator('[data-testid="quickadd-new-user"]').click();
        const userDlg = p.locator('[role="dialog"][aria-labelledby="create-user-drawer-title"]');
        await userDlg.waitFor({ state: 'attached', timeout: 8_000 });
        const userTitle = (await p.locator('#create-user-drawer-title').textContent())?.trim();
        if (!/add new user/i.test(userTitle || '')) throw new Error(`create-user title="${userTitle}"`);
        await shot(p, 't1-admin-quick-add-user');
        await p.keyboard.press('Escape');
        await userDlg.waitFor({ state: 'detached', timeout: 6_000 });

        // New branch → BranchEditorModal (role=dialog, "Add branch").
        await fab.click();
        await p.waitForSelector('[role="dialog"][aria-label="Quick add"]', { timeout: 6_000 });
        await p.locator('[data-testid="quickadd-new-branch"]').click();
        const branchDlg = p.locator('[role="dialog"][aria-modal="true"]').filter({ hasText: 'Add branch' });
        await branchDlg.first().waitFor({ state: 'attached', timeout: 8_000 });
        await shot(p, 't1-admin-quick-add-branch');
        await p.keyboard.press('Escape');
        assertLegHygiene(ctx);
        return `FAB→QuickAdd: "New user" opened CreateUserDrawer ("${userTitle}"); "New branch" opened Add-branch modal; both dismissed, no submit; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 4. Sidebar drag-reorder write-read-verify (agent1) — MUTATES prefs/app.navOrder ──
  {
    id: 't1-nav-drag-reorder',
    role: 'agent1',
    desc: 'agent1 desktop: drag Career above Awards in the Recognition section; verify DOM order; a FRESH context (empty localStorage → Firestore is the source) verifies the round-trip WHILE the writer context stays open (so the fire-and-forget write reliably ACKs); then restore original order. MUTATES prefs/app.navOrder.',
    async run({ browser, shot }) {
      const orderIn = (page, ids) => navOrder(page, ids);
      const IDS = ['agent-tab-leaderboard', 'agent-tab-awards', 'agent-tab-career'];
      // The writer context (ctxA) is deliberately kept OPEN until the reader
      // context (ctxB) has confirmed persistence: closing ctxA first can strand
      // the in-memory Firestore mutation in ctxA's own IndexedDB before it ACKs,
      // and ctxB (separate IndexedDB) would then read the pre-drag order. Holding
      // ctxA open keeps its write channel alive so the write reaches the server.
      const ctxA = await newLegContext(browser);
      let ctxB = null;
      try {
        await login(ctxA.page, 'agent1');
        const pa = ctxA.page;
        await pa.waitForSelector(`[data-testid="${IDS[2]}"]`, { timeout: 10_000 });
        const before = await orderIn(pa, IDS);
        const start = before.join(',');

        // Drag the LAST row above the MIDDLE row → the dragged row lands before it.
        await dragRowAbove(pa, before[2], before[1]);
        const after = await orderIn(pa, IDS);
        const expected = [before[0], before[2], before[1]].join(',');
        if (after.join(',') === start || after.join(',') !== expected) {
          await shot(pa, 'FAIL-t1-nav-drag-reorder');
          throw new Error(`drag order wrong: got ${after.join(',')} expected ${expected} (was ${start})`);
        }
        await shot(pa, 't1-nav-drag-post-drag');
        // ctxA is alive, so its write ACKs promptly; give it a moment to land
        // BEFORE the reader mounts — useNavOrder reconciles from Firestore ONCE on
        // mount, so the reader must open after the write has committed server-side.
        await pa.waitForTimeout(3000);

        // Reader context — empty localStorage → order comes from Firestore. Poll
        // the rendered order (the background getUserPrefs reconcile applies after
        // mount) while ctxA is still alive.
        ctxB = await newLegContext(browser);
        await login(ctxB.page, 'agent1');
        const pb = ctxB.page;
        await pb.waitForSelector(`[data-testid="${IDS[0]}"]`, { timeout: 10_000 });
        try {
          await pb.waitForFunction((args) => {
            const [ids, want] = args;
            const all = [...document.querySelectorAll('[data-testid]')];
            const got = ids
              .map((id) => ({ id, idx: all.findIndex((el) => el.getAttribute('data-testid') === id) }))
              .sort((a, b) => a.idx - b.idx)
              .map((x) => x.id)
              .join(',');
            return got === want;
          }, [IDS, expected], { timeout: 20_000, polling: 750 });
        } catch {
          const persisted = await orderIn(pb, IDS);
          await shot(pb, 'FAIL-t1-nav-drag-persist');
          throw new Error(`persisted order ${persisted.join(',')} != ${expected} (Firestore round-trip failed)`);
        }
        await shot(pb, 't1-nav-drag-persisted');
        assertLegHygiene(ctxB);

        // Restore original order in the writer context (still alive → ACKs).
        await dragRowAbove(pa, before[1], before[2]);
        const restored = await orderIn(pa, IDS);
        if (restored.join(',') !== before.join(',')) {
          throw new Error(`restore failed: order is ${restored.join(',')}, expected ${before.join(',')}`);
        }
        await pa.waitForTimeout(5000); // restore-write flush headroom (raced at 2.5s once — left navOrder residue for a later leg)
        await shot(pa, 't1-nav-drag-restored');
        assertLegHygiene(ctxA);
        return `drag swapped Career↕Awards in Recognition; persisted to a FRESH context (${expected}) via Firestore round-trip (writer held open for ACK); original order restored (${before.join(',')}); hygiene clean`;
      } finally {
        if (ctxB) await ctxB.context.close();
        await ctxA.context.close();
      }
    },
  },

  // ── 5. Exception lead panel + AgentDrill (branch_manager) ──
  {
    id: 't1-exception-lead-drill',
    role: 'branch_manager',
    desc: 'branch_manager overview: ExceptionLeadPanel flags Staging Agent Two (danger tone), NOT Staging Agent One; row click → AgentDrillDrawer → Report tab shows A2 YTD 8,500',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        await login(ctx.page, 'branch_manager');
        const p = ctx.page;
        const panel = p.locator('[data-testid="exception-lead-panel"]');
        await panel.waitFor({ state: 'attached', timeout: 12_000 });
        const list = p.locator('[data-testid="exception-lead-list"]');
        await list.waitFor({ state: 'attached', timeout: 10_000 });
        // Agent Two flagged; Agent One NOT flagged.
        const listText = (await list.textContent()) || '';
        if (!listText.includes('Staging Agent Two')) throw new Error('Staging Agent Two not in exception list');
        if (listText.includes('Staging Agent One')) throw new Error('Staging Agent One unexpectedly flagged');
        const row = list.locator('button', { hasText: 'Staging Agent Two' }).first();
        const tone = await row.evaluate((el) => {
          const danger = el.querySelector('.text-danger-ink');
          return { hasDanger: !!danger, type: el.getAttribute('data-type') };
        });
        if (!tone.hasDanger) throw new Error(`A2 exception row not danger-toned (type=${tone.type})`);
        // Drill → Report tab → AgentReportView hero shows A2 YTD 8,500.
        await row.click();
        const drawer = p.locator('[data-testid="agent-drill-drawer"]');
        await drawer.waitFor({ state: 'attached', timeout: 8_000 });
        await p.locator('[data-testid="drill-tab-report"]').click();
        await p.waitForTimeout(1200); // lazy per-agent reads settle
        await drawer.getByText(currencyRe(EXPECT.a2.ytdApi)).first().waitFor({ state: 'attached', timeout: 12_000 });
        await shot(p, 't1-exception-lead-drill');
        assertLegHygiene(ctx);
        return `ExceptionLeadPanel flags Staging Agent Two (danger, type=${tone.type}), not Agent One; drill Report tab shows A2 YTD ${EXPECT.a2.ytdApi}; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 6. Master Sheet reality bar / presets / exceptions toggle (branch_manager) ──
  {
    id: 't1-master-sheet',
    role: 'branch_manager',
    desc: 'Master Sheet W0 (2026-07-05): reality bar 0/1 submitted · 1/2 filed · 2 exceptions · TTD 3,000; column presets toggle columns; Only-exceptions filters to the A1 draft row; prior week 2026-06-28 WEEK API total verified with exceptions→empty filter',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        await login(ctx.page, 'branch_manager');
        const p = ctx.page;
        await gotoTab(p, 'Master Sheet');
        await p.waitForSelector('[data-testid="mastersheet-reality"]', { timeout: 12_000 });

        // Ensure the current week (W0) is selected.
        const weekSel = p.locator('select[aria-label="Select week"]');
        await weekSel.selectOption(W(0));
        await p.waitForTimeout(700);

        // (a) Reality bar — hand-derived from seed (only A1's draft exists this week).
        const r0 = await readReality(p);
        const checks = [
          [r0.weekapi, currencyRe(EXPECT.a1.draftApi), 'WEEK API'],
          [r0.submitted, /^0\s*\/\s*1$/, 'SUBMITTED'],
          [r0.filed, /^1\s*\/\s*2$/, 'FILED'],
          [r0.exceptions, /^2$/, 'EXCEPTIONS'],
        ];
        for (const [val, re, label] of checks) {
          if (!re.test(val || '')) throw new Error(`W0 ${label}="${val}" !~ ${re}`);
        }

        // (b) Column presets: Production shows API (TTD); Recruiting shows NEW NAMES
        // and hides API (TTD). Scope to the preset group (labels collide with nav).
        const presets = p.locator('[role="group"][aria-label="Column presets"]');
        const header = p.locator('table thead');
        await presets.getByRole('button', { name: 'Production', exact: true }).click();
        await p.waitForTimeout(300);
        if (!/API \(TTD\)/i.test((await header.textContent()) || '')) throw new Error('Production preset missing "API (TTD)" column');
        await presets.getByRole('button', { name: 'Recruiting', exact: true }).click();
        await p.waitForTimeout(300);
        const recHead = (await header.textContent()) || '';
        if (!/NEW NAMES/i.test(recHead)) throw new Error('Recruiting preset missing "NEW NAMES" column');
        if (/API \(TTD\)/i.test(recHead)) throw new Error('Recruiting preset still shows "API (TTD)" (should hide)');
        // Run3 H3: contactsMade display column collapsed into "Persons Reached" —
        // assert the collapse holds in the Recruiting preset and in All.
        if (!/PERSONS REACHED/i.test(recHead)) throw new Error('Recruiting preset missing "Persons Reached" column (H3 collapse)');
        if (/CONTACTS MADE/i.test(recHead)) throw new Error('Recruiting preset still shows "Contacts Made" (H3 collapse regressed)');
        await presets.getByRole('button', { name: 'All', exact: true }).click();
        await p.waitForTimeout(300);
        const allHead = (await header.textContent()) || '';
        if (/CONTACTS MADE/i.test(allHead)) throw new Error('All preset still shows "Contacts Made" (H3 collapse regressed)');

        // (c) Only-exceptions at W0 → exactly the A1 draft row.
        const rankCount = () => p.locator('tbody [data-testid^="rank-"]').count();
        const toggle = p.locator('[role="switch"]', { hasText: 'Only exceptions' });
        await toggle.click();
        await p.waitForTimeout(400);
        const exRows = await rankCount();
        if (exRows !== 1) throw new Error(`Only-exceptions W0 rows=${exRows} (expected 1 draft row)`);
        const bodyText = (await p.locator('tbody').textContent()) || '';
        if (!bodyText.includes('Staging Agent One') || !/draft/i.test(bodyText)) {
          throw new Error('Only-exceptions row is not the Staging Agent One draft');
        }
        await toggle.click(); // back off
        await p.waitForTimeout(300);
        await shot(p, 't1-master-sheet-w0');

        // (d) Prior week 2026-06-28 = W(-1): 3 SUBMITTED filers all above floor
        // (A1 12,500 + UM 5,200 + BM 8,500) → WEEK API 26,200. Reality bar counts
        // 1 exception (A2 is a non-filer that week — flagged but has no table row).
        // "Only exceptions" therefore filters the 3 submitted rows down to 0.
        const prevWeek = W(-1);
        const prevTotal = 26200;
        await weekSel.selectOption(prevWeek);
        await p.waitForTimeout(800);
        const r1 = await readReality(p);
        if (!currencyRe(prevTotal).test(r1.weekapi || '')) {
          await shot(p, 'FAIL-t1-master-sheet-prevweek');
          throw new Error(`${prevWeek} WEEK API="${r1.weekapi}" !~ ${currencyRe(prevTotal)}`);
        }
        // A2 non-filer at W(-1) → exactly 1 reality-bar exception.
        if (!/^1$/.test(r1.exceptions || '')) throw new Error(`${prevWeek} EXCEPTIONS="${r1.exceptions}" (expected 1 — A2 non-filer)`);
        const prevRowsBefore = await rankCount();
        if (prevRowsBefore !== 3) throw new Error(`${prevWeek} submitted rows=${prevRowsBefore} (expected 3: A1+UM+BM)`);
        await toggle.click(); // Only-exceptions ON — submitted rows are all above floor.
        await p.waitForTimeout(400);
        const prevRowsAfter = await rankCount();
        if (prevRowsAfter !== 0) throw new Error(`${prevWeek} Only-exceptions rows=${prevRowsAfter} (expected 0 — no submitted row is an exception)`);
        await toggle.click();
        await shot(p, 't1-master-sheet-prevweek');
        assertLegHygiene(ctx);
        return `W0 reality bar 0/1·1/2·2·${r0.weekapi}; presets toggle API(TTD)↔NEW NAMES; Only-exceptions→1 A1 draft row; ${prevWeek} WEEK API ${r1.weekapi}, exceptions 1 (A2 non-filer), row filter ${prevRowsBefore}→0; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
];
