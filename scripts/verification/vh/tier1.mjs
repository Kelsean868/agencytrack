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
import { EXPECT, W, ACCOUNTS } from './expectations.mjs';
import { getAdminDb, getAdminAuth, ADMIN_TENANT_ID } from './admin-read.mjs';

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

/**
 * Newest configAudit entry matching an exact (settingId, to) pair — used by
 * the Company Config legs to prove a write landed with the right shape
 * (from the raw stored doc, not the surface's own display re-derivation).
 * Reads newest-first (mirrors configAuditService.getConfigAudit's own query)
 * and returns the first match, so a residual entry from a prior smoke run
 * with the same settingId/to never masks the leg's own just-written entry.
 */
async function auditNewest(db, tenantId, settingId, toValue, { limit = 8 } = {}) {
  const snap = await db.collection(`tenants/${tenantId}/configAudit`).orderBy('at', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data()).find((e) => e.settingId === settingId && e.to === toValue) || null;
}

/**
 * Read the pin/unpin star treatment for a sidebar row. `zone: 'group'` (default)
 * reads the row's canonical/home-section testid; `zone: 'pinned'` reads the
 * ★ Pinned-zone alias. The alias testid is `pinned-<navConfig item.id>`, which
 * can DIFFER from the canonical group testid passed in here (navConfig items
 * often set an explicit longer `testId`, e.g. id `leaderboard` → group testid
 * `agent-tab-leaderboard`, but the pinned-zone alias is still `pinned-leaderboard`
 * — built from `item.id`, not `item.testId`) — so the pinned-zone row is
 * correlated by its RENDERED LABEL TEXT (shared by both zone renders of the
 * same item) rather than by re-deriving a testid. Resolves the two candidate
 * ink tokens to rgb() in-page so the color compare is theme-agnostic.
 *
 * Pin de-emphasis v2 (Run4 polish — supersedes Run3 F8's size/contrast
 * reduction): the star is FILLED + brand-teal (`sidebar-nav-star-filled`) ONLY
 * in the ★ Pinned zone; the group/home-section star stays OUTLINE regardless
 * of pinned state. Size is uniform (14) in both zones now.
 */
async function readPinStar(page, navTestId, zone = 'group') {
  return page.evaluate(({ tid, zone }) => {
    const rows = [...document.querySelectorAll('.sidebar-link-row')];
    const groupRow = rows.find((r) => r.querySelector(`[data-testid="${tid}"]`));
    let row = groupRow;
    if (zone === 'pinned') {
      const label = groupRow?.querySelector('.sidebar-link-label')?.textContent?.trim();
      row = label
        ? rows.find((r) => r !== groupRow
            && r.querySelector('[data-testid^="pinned-"]')
            && r.querySelector('.sidebar-link-label')?.textContent?.trim() === label)
        : null;
    }
    const btn = row?.querySelector('.sidebar-nav-star') || null;
    const svg = btn?.querySelector('svg') || null;
    const probe = document.createElement('span');
    probe.style.position = 'absolute';
    probe.style.color = 'var(--color-text-muted)';
    document.body.appendChild(probe);
    const mutedRgb = getComputedStyle(probe).color;
    probe.style.color = 'var(--color-primary)';
    const primaryRgb = getComputedStyle(probe).color;
    probe.remove();
    return {
      found: !!btn,
      filled: btn ? btn.classList.contains('sidebar-nav-star-filled') : null,
      pressed: btn ? btn.getAttribute('aria-pressed') === 'true' : null,
      svgW: svg ? svg.getAttribute('width') : null,
      color: btn ? getComputedStyle(btn).color : null,
      mutedRgb,
      primaryRgb,
    };
  }, { tid: navTestId, zone });
}

/** Click the pin/unpin star for a sidebar row by its canonical data-testid. */
async function clickPinStar(page, navTestId) {
  const row = page.locator('.sidebar-link-row', { has: page.locator(`[data-testid="${navTestId}"]`) }).first();
  await row.scrollIntoViewIfNeeded();
  await row.hover(); // reveal the star (opacity:0 until row hover / pinned)
  await row.locator('.sidebar-nav-star').first().click();
  await page.waitForTimeout(400);
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
    desc: 'Master Sheet FUNNEL W0: reality bar 0/1 submitted · 1/2 filed · 2 exceptions · TTD 3,000; funnel collapsed-by-default then expand-one-stage; two group KPIs (Prospecting 65, Contact Attempts 40) verified == sub-column sums at value level; RANK BY API↔NEW NAMES sort chip; Only-exceptions filters to the A1 draft row; prior week WEEK API total verified with exceptions→empty filter; Settings "Default RANK BY" (Run4 polish Item 2) set→New Names→reload seeds the Master Sheet\'s initial RANK BY at mount (no click), then restored to API + re-verified via a second reload. MUTATES prefs/app.settings.masterSheetPreset (restored).',
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

        // (b) FUNNEL collapse/expand + value-level KPI sums. Only the A1 DRAFT
        // row exists at W0, seeded from the STRONG subBody (seed-fixtures.mjs):
        //   ① Prospecting Total = letters(10) + seminars(0) + coldCalls(40)
        //      + referralCalls(15) = 65
        //   ② Contact Attempts Total = Tel(followUpCalls 10 + seminarTradeshowCalls 5
        //      = 15) + F2F(f2fAttempts 25) = 40
        // Both are re-derived below and cross-checked against the rendered
        // sub-column cells (fc-<key>-<uid> carry a data-value).
        const cellCount = (prefix) => p.locator(`[data-testid^="${prefix}"]`).count();
        const cellVal = async (prefix) => Number(await p.locator(`[data-testid^="${prefix}"]`).first().getAttribute('data-value'));
        const viewGrp = p.locator('[role="group"][aria-label="Funnel detail view"]');
        const rankByGrp = p.locator('[role="group"][aria-label="Rank by"]');

        // Collapsed default: Prospecting KPI present, its sub-columns hidden.
        if ((await cellCount('fc-pTot-')) !== 1) throw new Error('W0 collapsed default: Prospecting KPI cell missing');
        if ((await cellCount('fc-letters-')) !== 0) throw new Error('W0 collapsed default leaked Prospecting sub-columns');

        // Expand one stage → its sub-columns appear in place.
        await p.getByRole('button', { name: /expand prospecting activities/i }).click();
        await p.waitForTimeout(250);
        if ((await cellCount('fc-letters-')) !== 1) throw new Error('Expand Prospecting did not reveal sub-columns');
        await p.getByRole('button', { name: /expand contact attempts/i }).click();
        await p.waitForTimeout(250);

        // Value-level: TWO group KPIs === sum of their seeded sub-columns.
        const pTot = await cellVal('fc-pTot-');
        const pSum = (await cellVal('fc-letters-')) + (await cellVal('fc-seminars-')) + (await cellVal('fc-canvass-')) + (await cellVal('fc-refCalls-'));
        if (pTot !== pSum || pTot !== 65) throw new Error(`Prospecting KPI ${pTot} !== sub-sum ${pSum} / seed 65`);
        const caTot = await cellVal('fc-caTot-');
        const caSum = (await cellVal('fc-telAtt-')) + (await cellVal('fc-f2fAtt-'));
        if (caTot !== caSum || caTot !== 40) throw new Error(`Contact Attempts KPI ${caTot} !== sub-sum ${caSum} / seed 40`);

        // RANK BY preset — API ↔ NEW NAMES (moves terminal emphasis + sort chip).
        await rankByGrp.getByRole('button', { name: 'New Names', exact: true }).click();
        await p.waitForTimeout(250);
        if (!/08 NEW NAMES ↓/i.test((await p.locator('[data-testid="funnel-chips"]').textContent()) || '')) {
          throw new Error('RANK BY New Names did not set the NEW NAMES sort chip');
        }
        await rankByGrp.getByRole('button', { name: 'API', exact: true }).click();
        await p.waitForTimeout(250);
        // Collapse back so (c) reads a clean, totals-only table.
        await viewGrp.getByRole('button', { name: 'Totals', exact: true }).click();
        await p.waitForTimeout(250);

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
        // Wait deterministically for the prior week's data to render (the funnel
        // re-render + refetch can outlast a fixed timeout on cold staging) — poll
        // until the 3 submitted rows are present rather than reading a stale value.
        await p.waitForFunction(
          () => document.querySelectorAll('tbody [data-testid^="rank-"]').length === 3,
          { timeout: 15_000 },
        ).catch(() => {});
        await p.waitForTimeout(300);
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

        // (e) Settings-driven "Default RANK BY" (Fable Run4 polish Item 2 —
        // DECISIONS-NEEDED #4 option b, repurposed from the retired 5-preset
        // picker). Settings writes prefs/app.settings.masterSheetPreset; the
        // funnel Master Sheet reads it ONLY at mount as its initial RANK BY —
        // a full reload forces the fresh mount this proves. Set default → New
        // Names → reload → Master Sheet opens with New Names ALREADY pressed
        // (no click). Then restore the default to API and re-verify via a
        // second reload (write-read-verify both directions).
        await p.locator('button[aria-label="Settings"]').click({ timeout: 12_000 });
        await p.locator('[data-testid="settings-mastersheet-rankby-newNames"]').waitFor({ state: 'visible', timeout: 12_000 });
        await p.locator('[data-testid="settings-mastersheet-rankby-newNames"]').click();
        await p.waitForTimeout(1200); // fire-and-forget settings write flush headroom (mirror is synchronous; this is Firestore/UI headroom)

        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
        await p.waitForTimeout(800);
        await gotoTab(p, 'Master Sheet');
        await p.waitForSelector('[data-testid="mastersheet-reality"]', { timeout: 12_000 });
        await weekSel.selectOption(W(0));
        await p.waitForTimeout(500);

        const rankByAfterReload = p.locator('[role="group"][aria-label="Rank by"]');
        const newNamesPressed = await rankByAfterReload.getByRole('button', { name: 'New Names', exact: true }).getAttribute('aria-pressed');
        if (newNamesPressed !== 'true') throw new Error(`Settings default "New Names" did not seed the initial RANK BY at mount (aria-pressed=${newNamesPressed})`);
        const apiPressedAfterReload = await rankByAfterReload.getByRole('button', { name: 'API', exact: true }).getAttribute('aria-pressed');
        if (apiPressedAfterReload !== 'false') throw new Error(`API RANK BY unexpectedly pressed after New-Names default (aria-pressed=${apiPressedAfterReload})`);
        await shot(p, 't1-master-sheet-rankby-default');

        // Restore the Settings default back to API + re-verify via a second reload.
        await p.locator('button[aria-label="Settings"]').click({ timeout: 12_000 });
        await p.locator('[data-testid="settings-mastersheet-rankby-api"]').waitFor({ state: 'visible', timeout: 12_000 });
        await p.locator('[data-testid="settings-mastersheet-rankby-api"]').click();
        await p.waitForTimeout(1200);
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
        await p.waitForTimeout(800);
        await gotoTab(p, 'Master Sheet');
        await p.waitForSelector('[data-testid="mastersheet-reality"]', { timeout: 12_000 });
        const rankByRestored = p.locator('[role="group"][aria-label="Rank by"]');
        const apiPressedRestored = await rankByRestored.getByRole('button', { name: 'API', exact: true }).getAttribute('aria-pressed');
        if (apiPressedRestored !== 'true') throw new Error(`Settings default restore to API failed (aria-pressed=${apiPressedRestored})`);

        assertLegHygiene(ctx);
        return `W0 reality bar 0/1·1/2·2·${r0.weekapi}; funnel collapsed→expand; Prospecting KPI 65 & Contact Attempts KPI 40 == sub-column sums (value level); RANK BY API↔NEW NAMES chip; Only-exceptions→1 A1 draft row; ${prevWeek} WEEK API ${r1.weekapi}, exceptions 1 (A2 non-filer), row filter ${prevRowsBefore}→0; Settings "Default RANK BY"→New Names seeded initial mount RANK BY (aria-pressed) via reload, restored to API + re-verified via second reload; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 6b. Master Sheet FILTERS panel — compose two filters, clear via chip (branch_manager) ──
  {
    id: 't1-master-sheet-filters',
    role: 'branch_manager',
    desc: 'Master Sheet FUNNEL W(-1) filters: 3 filers (A1+UM in unit, BM in __branch_direct__). Open FILTERS panel; WEEKLY REPORT=Submitted keeps 3 (inclusive match); + UNIT=Branch direct → exactly 1 row (BM), badge 2, two chips, totals API == BM 8,500 (totals follow filtered set), reality bar UNCHANGED at TTD 26,200 (ignores filters); clear UNIT chip × → full roster 3 returns; clear report chip → 0 chips',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        await login(ctx.page, 'branch_manager');
        const p = ctx.page;
        await gotoTab(p, 'Master Sheet');
        await p.waitForSelector('[data-testid="mastersheet-reality"]', { timeout: 12_000 });

        const rankCount = () => p.locator('tbody [data-testid^="rank-"]').count();
        const ftotApi = async () => Number(await p.locator('[data-testid="ftot-api"]').first().getAttribute('data-value'));

        // W(-1): 3 SUBMITTED filers (A1 12,500 + UM 5,200 + BM 8,500 = 26,200).
        const prevWeek = W(-1);
        const weekSel = p.locator('select[aria-label="Select week"]');
        await weekSel.selectOption(prevWeek);
        await p.waitForFunction(
          () => document.querySelectorAll('tbody [data-testid^="rank-"]').length === 3,
          { timeout: 15_000 },
        );
        await p.waitForTimeout(300);

        const realityBefore = (await readReality(p)).weekapi;
        if (!currencyRe(26200).test(realityBefore || '')) {
          await shot(p, 'FAIL-t1-master-sheet-filters-baseline');
          throw new Error(`${prevWeek} baseline WEEK API="${realityBefore}" !~ ${currencyRe(26200)}`);
        }
        if ((await rankCount()) !== 3) throw new Error(`${prevWeek} baseline rows != 3`);

        // Open the FILTERS popover (aria-expanded + panel visible).
        const filtersBtn = p.locator('[data-testid="funnel-filters-toggle"]');
        await filtersBtn.click();
        await p.waitForSelector('[data-testid="funnel-filters-panel"]', { state: 'visible', timeout: 6_000 });
        if ((await filtersBtn.getAttribute('aria-expanded')) !== 'true') throw new Error('FILTERS toggle aria-expanded != true when open');

        // Filter 1 — WEEKLY REPORT = Submitted. All 3 are submitted → inclusive, stays 3.
        await p.locator('[data-testid="funnel-report-submitted"]').click();
        await p.waitForTimeout(300);
        const afterReport = await rankCount();
        if (afterReport !== 3) throw new Error(`report=Submitted rows=${afterReport} (expected 3 — all submitted)`);

        // Filter 2 — UNIT = Branch direct (BM's __branch_direct__ unit). 3 → 1.
        const unitBtn = p.locator('[data-testid="funnel-unit-__branch_direct__"]');
        if ((await unitBtn.count()) !== 1) throw new Error('UNIT control missing the Branch-direct option at W(-1)');
        await unitBtn.click();
        await p.waitForTimeout(300);

        const afterBoth = await rankCount();
        if (afterBoth !== 1) throw new Error(`Submitted ∩ Branch-direct rows=${afterBoth} (expected 1 — BM only)`);
        const bodyText = (await p.locator('tbody').textContent()) || '';
        if (!bodyText.includes('Staging Branch Manager')) throw new Error('filtered single row is not the Branch Manager');

        // Badge counts both conditions; two dismissible chips present.
        const badge = (await p.locator('[data-testid="funnel-filters-badge"]').textContent())?.trim();
        if (badge !== '2') throw new Error(`FILTERS badge="${badge}" (expected 2)`);
        for (const key of ['unit', 'report']) {
          if ((await p.locator(`[data-testid="funnel-chip-${key}"]`).count()) !== 1) throw new Error(`missing active-filter chip: ${key}`);
        }

        // Totals row follows the FILTERED set (BM API 8,500); reality bar does NOT.
        const totApi = await ftotApi();
        if (totApi !== 8500) throw new Error(`totals API=${totApi} (expected 8500 = BM only)`);
        const realityAfter = (await readReality(p)).weekapi;
        if (!currencyRe(26200).test(realityAfter || '')) throw new Error(`reality bar changed under filters: "${realityAfter}" (expected unchanged TTD 26,200)`);

        // Close the panel, then clear the UNIT condition via its chip × → roster returns to 3.
        await p.locator('[data-testid="funnel-filters-panel"] button', { hasText: 'Done' }).first().click().catch(() => {});
        await p.waitForTimeout(150);
        await p.locator('[data-testid="funnel-chip-unit-clear"]').click();
        await p.waitForTimeout(300);
        const afterClearUnit = await rankCount();
        if (afterClearUnit !== 3) throw new Error(`after clearing UNIT chip rows=${afterClearUnit} (expected 3 — full roster returns)`);

        // Clear the remaining report chip → no chips, no badge, still 3 rows.
        await p.locator('[data-testid="funnel-chip-report-clear"]').click();
        await p.waitForTimeout(300);
        if ((await p.locator('[data-testid="funnel-chips"]').count()) !== 0) throw new Error('active-filter chips container should be gone after clearing all');
        if ((await p.locator('[data-testid="funnel-filters-badge"]').count()) !== 0) throw new Error('FILTERS badge should be gone with no active filters');
        if ((await rankCount()) !== 3) throw new Error('roster not fully restored after clearing all filters');

        await shot(p, 't1-master-sheet-filters');
        assertLegHygiene(ctx);
        return `W(-1) 3 filers; report=Submitted→3; +unit=Branch-direct→1 (BM), badge 2, 2 chips, totals API 8500, reality bar unchanged 26,200; clear UNIT chip→3; clear report chip→0 chips/3 rows; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 7. Pin de-emphasis v2 — zone-based fill signal (agent1) ──
  // Supersedes t1-pinned-tab-deemphasis (Run3 F8's size/contrast reduction).
  {
    id: 't1-pin-zone-signal',
    role: 'agent1',
    desc: 'agent1 desktop: pin a non-seeded tab (leaderboard) via its sidebar star, then assert VALUE-LEVEL the new zone-based signal — the ★ Pinned-zone star is FILLED + brand-primary (svg width 14) while the SAME item\'s home-section star stays OUTLINE + muted-ink (svg width 14, never filled) — and an UNPINNED tab (awards) has no ★ Pinned-zone alias at all and keeps its home-section star outline. Original pin state restored. MUTATES prefs/app.pinnedNav.',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      const P = 'agent-tab-leaderboard'; // pin target — not in the agent seed
      const U = 'agent-tab-awards';      // unpinned control — not in the agent seed
      let pinnedByLeg = false;
      let unpinnedByLeg = false;
      try {
        await login(ctx.page, 'agent1');
        const p = ctx.page;
        await p.waitForSelector(`[data-testid="${P}"]`, { timeout: 12_000 });
        // Let the once-on-mount pinned-nav reconcile settle before mutating pins.
        await p.waitForTimeout(1500);

        // Capture baseline (home-zone `aria-pressed` is the state signal now — the
        // home-zone fill class no longer tracks pinned state) + normalize: P must
        // be pinned, U must be unpinned.
        const pBase = await readPinStar(p, P);
        const uBase = await readPinStar(p, U);
        if (!pBase.found) throw new Error(`no pin star on ${P}`);
        if (!uBase.found) throw new Error(`no pin star on ${U}`);
        if (!pBase.pressed) { await clickPinStar(p, P); pinnedByLeg = true; }
        if (uBase.pressed) { await clickPinStar(p, U); unpinnedByLeg = true; }
        await p.mouse.move(4, 4); // off any row → avoid the :hover color override
        await p.waitForTimeout(150);

        // P home-section star: pinned STATE (aria-pressed) but OUTLINE — never
        // filled outside the ★ Pinned zone, muted ink, full size 14.
        const pHome = await readPinStar(p, P, 'group');
        if (!pHome.pressed) throw new Error(`${P} home star not aria-pressed after pin`);
        if (pHome.filled) throw new Error(`${P} home star unexpectedly FILLED (zone-based outline rule not applied)`);
        if (pHome.svgW !== '14') throw new Error(`${P} home star size=${pHome.svgW} (expected 14)`);
        if (pHome.color !== pHome.mutedRgb) throw new Error(`${P} home star color=${pHome.color} != muted ${pHome.mutedRgb}`);

        // P ★ Pinned-zone star: FILLED + brand-primary, full size 14.
        const pZone = await readPinStar(p, P, 'pinned');
        if (!pZone.found) throw new Error(`${P} has no ★ Pinned-zone row`);
        if (!pZone.filled) throw new Error(`${P} pinned-zone star not FILLED`);
        if (pZone.svgW !== '14') throw new Error(`${P} pinned-zone star size=${pZone.svgW} (expected 14)`);
        if (pZone.color !== pZone.primaryRgb) throw new Error(`${P} pinned-zone star color=${pZone.color} != primary ${pZone.primaryRgb}`);

        // U home-section star: unpinned, outline, no ★ Pinned-zone alias exists.
        const uHome = await readPinStar(p, U, 'group');
        if (uHome.pressed) throw new Error(`${U} unexpectedly aria-pressed`);
        if (uHome.filled) throw new Error(`${U} home star unexpectedly FILLED`);
        if (uHome.svgW !== '14') throw new Error(`${U} home star size=${uHome.svgW} (expected 14)`);
        const uZone = await readPinStar(p, U, 'pinned');
        if (uZone.found) throw new Error(`${U} unexpectedly has a ★ Pinned-zone row while unpinned`);

        await shot(p, 't1-pin-zone-signal');

        // Restore original pin state (leave prefs/app.pinnedNav value-for-value).
        if (pinnedByLeg) { await clickPinStar(p, P); }
        if (unpinnedByLeg) { await clickPinStar(p, U); }
        await p.waitForTimeout(3000); // fire-and-forget pinnedNav write flush headroom
        const pEnd = await readPinStar(p, P);
        const uEnd = await readPinStar(p, U);
        if (pEnd.pressed !== pBase.pressed || uEnd.pressed !== uBase.pressed) {
          throw new Error(`restore failed: P.pressed ${pBase.pressed}->${pEnd.pressed}, U.pressed ${uBase.pressed}->${uEnd.pressed}`);
        }
        assertLegHygiene(ctx);
        return `★ Pinned-zone star FILLED (${pZone.color}, size 14); SAME item's home-section star OUTLINE (${pHome.color}, size 14, never filled); unpinned control has no pinned-zone alias + outline home star; pin state restored (P=${pEnd.pressed}, U=${uEnd.pressed}); hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 8. Company Config — ⌘F jump + Activity Standards edit/reset (tenant_admin) — MUTATES managerActivityStandards then restores by reset ──
  {
    id: 't1-company-config',
    role: 'tenant_admin',
    desc: 'tenant_admin Company Config: from Feature Flags section, ⌘F "pace-warning" jumps to targets.pace (rail switches flags→targets, row flash-highlighted); edit Activity Standards unit_manager JFW to 5 → SaveBar "1 unsaved change" → Save → toast "Saved 1 change" → fresh page reload + re-navigate shows JFW=5 + custom-state Reset affordance; Admin-SDK verify managerActivityStandards.unit_manager.jfwCount===5 (number) + newest configAudit entry (settingId=unit_manager.jfwCount, section=Activity Standards, who=tenant_admin uid, to="5"); click Reset to default → Save → Admin-SDK verify the jfwCount KEY IS ABSENT (not null/undefined — deleted) + a second configAudit entry (to="DEFAULT"), row back to \'default\' (no Reset/Undo link, JFW control reads 0 — bare/table items like Activity Standards intentionally suppress ConfigRow\'s row-level DEFAULT tag, per ConfigRow.jsx\'s `state === \'default\' && !item?.bare` guard). MUTATES tenants/staging_test/config/managerActivityStandards (restored to absent by the leg\'s own reset step; re-seed also resets it).',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'tenant_admin');
        await gotoTab(p, 'Company Config');
        await p.waitForSelector('[data-testid="ccfg-surface"]', { timeout: 12_000 });

        // Start from a DIFFERENT section so the palette jump below is a real
        // section switch, not a no-op (default active section is 'targets').
        await p.locator('[data-testid="ccfg-rail-flags"]').click();
        await p.waitForTimeout(400);

        // ── ⌘F → "pace-warning" → Enter → jumps to targets.pace ──────────────
        await p.keyboard.press('Control+f');
        const palette = p.locator('[role="dialog"][aria-label="Find a setting"]');
        await palette.waitFor({ state: 'attached', timeout: 8_000 });
        const paletteInput = p.locator('[data-testid="ccfg-palette-input"]');
        await paletteInput.fill('pace-warning');
        const results = p.locator('[data-testid="ccfg-palette-result"]');
        await results.first().waitFor({ state: 'attached', timeout: 6_000 });
        const resultCount = await results.count();
        if (resultCount !== 1) throw new Error(`"pace-warning" query matched ${resultCount} results (expected exactly 1 — not unique)`);
        const resultText = (await results.first().innerText()).replace(/\s+/g, ' ');
        if (!/Pace-warning threshold/i.test(resultText)) throw new Error(`palette result="${resultText}" (expected Pace-warning threshold)`);
        await paletteInput.press('Enter');
        await palette.waitFor({ state: 'detached', timeout: 6_000 });

        // Section switched flags → targets (rail aria-current).
        const railTargets = p.locator('[data-testid="ccfg-rail-targets"]');
        if ((await railTargets.getAttribute('aria-current')) !== 'true') {
          throw new Error('palette jump did not switch the rail to the "targets" section');
        }
        // Target row present + flash-highlighted (ConfigRow's bg-primary-tint
        // treatment, cleared 2s after the jump — read within the window).
        const paceRow = p.locator('[data-testid="ccfg-row-targets.pace"]');
        await paceRow.waitFor({ state: 'attached', timeout: 6_000 });
        const paceRowClass = (await paceRow.getAttribute('class')) || '';
        if (!paceRowClass.includes('bg-primary-tint')) {
          throw new Error(`targets.pace row not flash-highlighted after jump (class="${paceRowClass}")`);
        }
        await shot(p, 't1-company-config-jump');

        // ── Edit Activity Standards: unit_manager JFW → 5 ────────────────────
        await p.locator('[data-testid="ccfg-rail-activity"]').click();
        await p.waitForTimeout(400);
        const umRow = p.locator('[data-testid="ccfg-row-act.standards.unit_manager"]');
        await umRow.waitFor({ state: 'attached', timeout: 10_000 });
        const jfwInput = (scope) => scope.locator('div.grid', { hasText: 'Joint Field Work (JFW)' }).first().locator('input[aria-label="value"]');
        await jfwInput(umRow).fill('5');
        await p.waitForTimeout(300);

        const saveBar = p.locator('[data-testid="ccfg-savebar"]');
        await saveBar.waitFor({ state: 'attached', timeout: 6_000 });
        const saveBarText = (await saveBar.innerText()) || '';
        if (!/1 unsaved change/i.test(saveBarText)) throw new Error(`SaveBar="${saveBarText}" (expected "1 unsaved change")`);
        await p.locator('[data-testid="ccfg-savebar-save"]').click();

        const toast = p.locator('[data-testid="toast-success"]');
        await toast.waitFor({ state: 'attached', timeout: 8_000 });
        const toastText = (await toast.innerText()) || '';
        if (!/Saved 1 change/i.test(toastText)) throw new Error(`toast="${toastText}" (expected "Saved 1 change")`);
        await shot(p, 't1-company-config-saved');

        // ── Write-read-verify through the UI: fresh reload + re-navigate ─────
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => document.body.textContent.length > 200, { timeout: 20_000 });
        await p.waitForTimeout(800);
        await gotoTab(p, 'Company Config');
        await p.waitForSelector('[data-testid="ccfg-surface"]', { timeout: 12_000 });
        await p.locator('[data-testid="ccfg-rail-activity"]').click();
        await p.waitForTimeout(400);
        const umRowAfterReload = p.locator('[data-testid="ccfg-row-act.standards.unit_manager"]');
        await umRowAfterReload.waitFor({ state: 'attached', timeout: 10_000 });
        const jfwValueAfterReload = await jfwInput(umRowAfterReload).inputValue();
        if (jfwValueAfterReload !== '5') throw new Error(`JFW value after reload="${jfwValueAfterReload}" (expected "5")`);
        const resetBtn = p.locator('[data-testid="ccfg-row-act.standards.unit_manager-reset"]');
        await resetBtn.waitFor({ state: 'attached', timeout: 6_000 });
        await shot(p, 't1-company-config-reloaded');

        // ── Direct Firestore verify (Admin SDK) ──────────────────────────────
        const db = getAdminDb();
        const masRef = db.doc(`tenants/${ADMIN_TENANT_ID}/config/managerActivityStandards`);
        const masDoc = (await masRef.get()).data() || {};
        const umMap = masDoc.unit_manager || {};
        if (typeof umMap.jfwCount !== 'number' || umMap.jfwCount !== 5) {
          throw new Error(`Firestore unit_manager.jfwCount=${JSON.stringify(umMap.jfwCount)} (expected number 5)`);
        }

        const auditSave = await auditNewest(db, ADMIN_TENANT_ID, 'unit_manager.jfwCount', '5');
        if (!auditSave) throw new Error('no configAudit entry found for unit_manager.jfwCount -> "5"');
        if (auditSave.section !== 'Activity Standards') throw new Error(`audit section="${auditSave.section}" (expected "Activity Standards")`);
        if (!auditSave.who) throw new Error('audit entry missing "who" (actor uid)');
        if (!auditSave.whoName) throw new Error('audit entry missing "whoName"');
        const auth = getAdminAuth();
        const taUser = await auth.getUserByEmail(ACCOUNTS.tenant_admin.email);
        if (auditSave.who !== taUser.uid) throw new Error(`audit who="${auditSave.who}" (expected tenant_admin uid ${taUser.uid})`);

        // ── Reset to default → save → Admin-SDK verify KEY ABSENT ────────────
        await resetBtn.click();
        await p.waitForTimeout(300);
        const saveBar2 = p.locator('[data-testid="ccfg-savebar"]');
        await saveBar2.waitFor({ state: 'attached', timeout: 6_000 });
        const saveBar2Text = (await saveBar2.innerText()) || '';
        if (!/1 unsaved change/i.test(saveBar2Text)) throw new Error(`SaveBar (reset)="${saveBar2Text}" (expected "1 unsaved change")`);
        await p.locator('[data-testid="ccfg-savebar-save"]').click();
        await p.waitForTimeout(1500); // refresh() re-fetch + row re-render to 'default'
        // 'act.standards.*' items are `bare` (registry: bare:true) — ConfigRow
        // deliberately suppresses the row-level DEFAULT tag for bare/table items
        // (src/components/admin/companyConfig/ConfigRow.jsx: `state === 'default'
        // && !item?.bare`, commit 0b69b769 "bare DEFAULT tag" visual-probe fix —
        // landed on this shared staging branch mid-session, corrected below).
        // Prove 'default' state via the row's OTHER state-exclusive affordances
        // instead: no Reset link (rules out 'custom'), no Undo/unsaved banner
        // (rules out 'draft'/'reset'), and the JFW control itself reads back 0
        // (the code default) — value-level, not selector-presence-only.
        await p.locator('[data-testid="ccfg-savebar"]').waitFor({ state: 'detached', timeout: 8_000 });
        const resetBtnGone = await p.locator('[data-testid="ccfg-row-act.standards.unit_manager-reset"]').count();
        const undoBtnGone = await p.locator('[data-testid="ccfg-row-act.standards.unit_manager-undo"]').count();
        if (resetBtnGone !== 0) throw new Error(`Reset link still present after reset+save (count=${resetBtnGone}) — row not back to 'default'`);
        if (undoBtnGone !== 0) throw new Error(`Undo link still present after reset+save (count=${undoBtnGone}) — row still 'draft'/'reset'`);
        const jfwValueAfterReset = await jfwInput(p.locator('[data-testid="ccfg-row-act.standards.unit_manager"]')).inputValue();
        if (jfwValueAfterReset !== '0') throw new Error(`JFW control after reset+save="${jfwValueAfterReset}" (expected "0", the code default)`);
        await shot(p, 't1-company-config-reset');

        const masDoc2 = (await masRef.get()).data() || {};
        const umMap2 = masDoc2.unit_manager || {};
        if ('jfwCount' in umMap2) throw new Error(`Firestore unit_manager still has jfwCount=${JSON.stringify(umMap2.jfwCount)} after reset (expected key ABSENT)`);

        const auditReset = await auditNewest(db, ADMIN_TENANT_ID, 'unit_manager.jfwCount', 'DEFAULT');
        if (!auditReset) throw new Error('no configAudit entry found for unit_manager.jfwCount -> "DEFAULT"');
        if (auditReset.section !== 'Activity Standards') throw new Error(`reset audit section="${auditReset.section}" (expected "Activity Standards")`);

        assertLegHygiene(ctx);
        return `⌘F "pace-warning" jumped flags→targets (rail switched, targets.pace flash-highlighted); JFW unit_manager 5 saved (toast "Saved 1 change"), fresh reload shows 5 + custom-state reset affordance; Firestore unit_manager.jfwCount=5 (audit settingId=unit_manager.jfwCount, section=Activity Standards, who=${auditSave.who}, to=5); Reset→save→Firestore key ABSENT (audit to=DEFAULT), row back to 'default' (no Reset/Undo link, JFW control reads 0 — bare items suppress the DEFAULT tag itself per ConfigRow's intentional bare-item rule); hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 9. Company Config — Feature Flags disable/re-enable roundtrip (tenant_admin) — toggles persistencyV2 OFF then back ON, ending at the seeded state ──
  {
    id: 't1-company-config-flags',
    role: 'tenant_admin',
    desc: 'tenant_admin Company Config → Feature Flags: persistencyV2 seeded ON (Disable button present); Disable → Admin-SDK verify featureFlags/featureFlagsMeta persistencyV2 KEY ABSENT (not false) + newest configAudit entry ON→OFF (section=featureFlags); re-enable via the danger confirm strip ("effective immediately" copy) → Enable now → row shows provenance "Enabled by …" → Admin-SDK verify featureFlags.persistencyV2===true (strict boolean) + featureFlagsMeta.persistencyV2={who,whoName,date} + newest configAudit entry OFF→ON. Ends at the seeded ON state. MUTATES tenants/staging_test/config/settings.featureFlags.persistencyV2 transiently (restored ON by the leg itself; re-seed also resets it).',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser);
      try {
        const p = ctx.page;
        await login(p, 'tenant_admin');
        await gotoTab(p, 'Company Config');
        await p.waitForSelector('[data-testid="ccfg-surface"]', { timeout: 12_000 });
        await p.locator('[data-testid="ccfg-rail-flags"]').click();
        await p.waitForTimeout(400);

        for (const key of ['persistencyV2', 'policyLedgerCampaignLens', 'awardsProvenance']) {
          await p.locator(`[data-testid="ccfg-flag-${key}"]`).waitFor({ state: 'attached', timeout: 8_000 });
        }
        const flagRow = p.locator('[data-testid="ccfg-flag-persistencyV2"]');
        if ((await p.locator('[data-testid="ccfg-flag-disable-persistencyV2"]').count()) !== 1) {
          throw new Error('persistencyV2 not showing ON (Disable button absent) at leg start — seed expectation is ON');
        }
        await shot(p, 't1-company-config-flags-on');

        const db = getAdminDb();
        const settingsRef = db.doc(`tenants/${ADMIN_TENANT_ID}/config/settings`);

        // ── Disable ──────────────────────────────────────────────────────────
        await p.locator('[data-testid="ccfg-flag-disable-persistencyV2"]').click();
        await p.locator('[data-testid="ccfg-flag-enable-persistencyV2"]').waitFor({ state: 'attached', timeout: 8_000 });
        const offChipText = (await flagRow.innerText())?.replace(/\s+/g, ' ') || '';
        if (!/NOT SET.*OFF/i.test(offChipText)) throw new Error(`flag row after disable="${offChipText}" (expected NOT SET → OFF chip)`);
        await shot(p, 't1-company-config-flags-off');

        let settingsDoc = (await settingsRef.get()).data() || {};
        let ff = settingsDoc.featureFlags || {};
        let ffMeta = settingsDoc.featureFlagsMeta || {};
        if ('persistencyV2' in ff) throw new Error(`Firestore featureFlags still has persistencyV2 key after disable (value=${JSON.stringify(ff.persistencyV2)})`);
        if ('persistencyV2' in ffMeta) throw new Error('Firestore featureFlagsMeta still has persistencyV2 key after disable');

        const auditOff = await auditNewest(db, ADMIN_TENANT_ID, 'persistencyV2', 'OFF');
        if (!auditOff) throw new Error('no configAudit entry found for persistencyV2 -> "OFF"');
        if (auditOff.section !== 'featureFlags') throw new Error(`audit(OFF) section="${auditOff.section}" (expected "featureFlags")`);
        if (auditOff.from !== 'ON') throw new Error(`audit(OFF) from="${auditOff.from}" (expected "ON")`);

        // ── Re-enable via the danger confirm flow ───────────────────────────
        await p.locator('[data-testid="ccfg-flag-enable-persistencyV2"]').click();
        const confirmStrip = p.locator('[data-testid="ccfg-flag-confirm-persistencyV2"]');
        await confirmStrip.waitFor({ state: 'attached', timeout: 6_000 });
        const confirmText = (await confirmStrip.innerText()) || '';
        if (!/effective immediately/i.test(confirmText)) throw new Error(`confirm strip="${confirmText}" (expected "effective immediately" copy)`);
        await shot(p, 't1-company-config-flags-confirm');
        await p.locator('[data-testid="ccfg-flag-confirm-enable-persistencyV2"]').click();
        await p.locator('[data-testid="ccfg-flag-disable-persistencyV2"]').waitFor({ state: 'attached', timeout: 8_000 });
        await p.waitForTimeout(300);
        const onRowText = (await flagRow.innerText()) || '';
        if (!/Enabled by/i.test(onRowText)) throw new Error(`flag row after re-enable="${onRowText}" (expected "Enabled by <name>" provenance line)`);
        await shot(p, 't1-company-config-flags-on-again');

        settingsDoc = (await settingsRef.get()).data() || {};
        ff = settingsDoc.featureFlags || {};
        ffMeta = settingsDoc.featureFlagsMeta || {};
        if (ff.persistencyV2 !== true) throw new Error(`Firestore featureFlags.persistencyV2=${JSON.stringify(ff.persistencyV2)} (expected strict boolean true)`);
        const meta = ffMeta.persistencyV2;
        if (!meta || !meta.who || !meta.whoName || !meta.date) {
          throw new Error(`Firestore featureFlagsMeta.persistencyV2=${JSON.stringify(meta)} (expected {who, whoName, date})`);
        }

        const auditOn = await auditNewest(db, ADMIN_TENANT_ID, 'persistencyV2', 'ON');
        if (!auditOn) throw new Error('no configAudit entry found for persistencyV2 -> "ON"');
        if (auditOn.section !== 'featureFlags') throw new Error(`audit(ON) section="${auditOn.section}" (expected "featureFlags")`);
        if (auditOn.from !== 'OFF') throw new Error(`audit(ON) from="${auditOn.from}" (expected "OFF")`);

        assertLegHygiene(ctx);
        return `persistencyV2 seeded ON; Disable→Firestore featureFlags/featureFlagsMeta key ABSENT (audit ON→OFF, section=featureFlags); re-enable via confirm strip ("effective immediately")→Firestore featureFlags.persistencyV2===true + featureFlagsMeta{who=${meta.who}} (audit OFF→ON); ends at seeded ON; hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },
];
