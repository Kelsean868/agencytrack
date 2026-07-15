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
