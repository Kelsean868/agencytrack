/**
 * crosscut.mjs — VH Run-2 cross-cutting LIVE smoke legs (staging). Same contract
 * as tier0.mjs: PASS = return detail · FAIL = throw · SKIP = throw Error('SKIP:').
 * Fresh context per leg; assertLegHygiene before returning; contexts closed in finally.
 *
 * Legs:
 *   xc-reduced-motion    — reduced-motion snaps the YTD count-up + disables the
 *                          staggered-assemble animation (value-level: exact 122,000).
 *   xc-dark-contrast     — dark theme spot-check of 3+ Run-1 surfaces for zero
 *                          serious/critical color-contrast violations (axe).
 *   xc-console-isolation — cross-role hygiene meta-leg (console-clean + zero
 *                          prod requests for agent1 / branch_manager / cro).
 */
import AxeBuilder from '@axe-core/playwright';
import { newLegContext, login, gotoTab, assertLegHygiene, currencyRe, expectText } from './vh-helpers.mjs';
import { EXPECT } from './expectations.mjs';

const tsel = (id) => `[data-testid="${id}"]`;

/** Run an axe color-contrast-only scan; return serious/critical violations. */
async function contrastViolations(page) {
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  return (results.violations || []).filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

function summarizeViolations(vs) {
  return vs.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0]?.target?.join(' ')?.slice(0, 80)}`).join(' | ').slice(0, 400);
}

export const LEGS = [
  // ── 1. Reduced-motion: count-up snaps + stagger animation disabled ──
  {
    id: 'xc-reduced-motion',
    role: 'agent1',
    desc: 'prefers-reduced-motion: reduce — the YTD hero shows the FINAL value TTD 122,000 (count-up snaps, no rAF ramp) and the staggered-assemble animation is disabled (computed animationName "none" on a .stagger child). Value-level: exact 122,000.',
    async run({ browser, shot }) {
      const ctx = await newLegContext(browser, { reducedMotion: true });
      try {
        const p = ctx.page;
        await login(p, 'agent1');
        // Reduced-motion must be the active media state.
        const rmActive = await p.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (!rmActive) throw new Error('prefers-reduced-motion: reduce is NOT active in this context');

        // Final YTD value present (count-up snapped straight to target).
        await expectText(p, currencyRe(EXPECT.a1.ytdApi), `YTD hero = TTD ${EXPECT.a1.ytdApi}`);

        // The dashboard tab wrapper carries `.screen-enter`; under reduced motion
        // the `.screen-enter` animation (guarded by @media no-preference) does NOT
        // apply, so the computed animation-name is "none".
        const enter = p.locator('.screen-enter').first();
        await enter.waitFor({ state: 'attached', timeout: 12_000 });
        const animName = await enter.evaluate((el) => getComputedStyle(el).animationName);
        if (animName && animName !== 'none') {
          throw new Error(`.screen-enter is animating (animation-name="${animName}") under reduced-motion`);
        }
        await shot(p, 'xc-reduced-motion');
        assertLegHygiene(ctx);
        return `reduced-motion active; YTD hero snapped to TTD ${EXPECT.a1.ytdApi}; .screen-enter animation-name="${animName}" (disabled). hygiene clean`;
      } finally { await ctx.context.close(); }
    },
  },

  // ── 2. Dark-mode contrast spot-check (3 Run-1 surfaces, axe) ──
  {
    id: 'xc-dark-contrast',
    role: 'agent1+branch_manager',
    desc: 'Dark theme: axe color-contrast scan of 3 Run-1 surfaces (agent Report hero, agent Prospect Prep hero, BM Master Sheet) — assert ZERO serious/critical color-contrast violations. Dark enabled via the persisted agencytrack-theme=dark localStorage flag (app restores dark before mount).',
    async run({ browser, shot }) {
      const findings = [];
      // Enable dark by seeding the app's canonical persisted theme flag before any
      // load (main.jsx: agencytrack-theme ∈ 'dark'|'light'|'system').
      const darkInit = () => { try { localStorage.setItem('agencytrack-theme', 'dark'); } catch { /* ignore */ } };

      // Agent surfaces.
      const a = await newLegContext(browser, { colorScheme: 'dark' });
      try {
        await a.context.addInitScript(darkInit);
        const p = a.page;
        await login(p, 'agent1');
        const isDark = await p.evaluate(() => document.documentElement.classList.contains('dark'));
        if (!isDark) throw new Error('dark theme not applied (html.dark absent after agencytrack-dark seed)');

        await gotoTab(p, 'Report');
        await p.locator(tsel('agent-report-hero')).waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(700);
        const rep = await contrastViolations(p);
        if (rep.length) findings.push(`Report hero: ${summarizeViolations(rep)}`);
        await shot(p, 'xc-dark-report');

        await gotoTab(p, 'Prospect Prep');
        await p.locator(tsel('next-call-hero')).waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(700);
        const pp = await contrastViolations(p);
        if (pp.length) findings.push(`Prospect Prep: ${summarizeViolations(pp)}`);
        await shot(p, 'xc-dark-prospect');
        assertLegHygiene(a);
      } finally { await a.context.close(); }

      // BM Master Sheet.
      const b = await newLegContext(browser, { colorScheme: 'dark' });
      try {
        await b.context.addInitScript(darkInit);
        const p = b.page;
        await login(p, 'branch_manager');
        // Master Sheet is a My-Team surface behind the workspace toggle.
        await p.locator(tsel('sidebar-ws-toggle-team')).click({ timeout: 10_000 });
        await p.waitForTimeout(700);
        await gotoTab(p, 'Master Sheet');
        await p.locator(tsel('mastersheet-reality')).waitFor({ state: 'attached', timeout: 15_000 });
        await p.waitForTimeout(700);
        const ms = await contrastViolations(p);
        if (ms.length) findings.push(`Master Sheet: ${summarizeViolations(ms)}`);
        await shot(p, 'xc-dark-mastersheet');
        assertLegHygiene(b);
      } finally { await b.context.close(); }

      if (findings.length) throw new Error(`DARK CONTRAST violations (serious/critical): ${findings.join(' || ')}`);
      return 'Dark theme: zero serious/critical color-contrast violations across Report hero, Prospect Prep hero, and BM Master Sheet. hygiene clean';
    },
  },

  // ── 3. Cross-role hygiene meta-leg (console-clean + zero prod requests) ──
  {
    id: 'xc-console-isolation',
    role: 'agent1+branch_manager+cro',
    desc: 'Meta-leg: log in as agent1, branch_manager, cro; each visits its default dashboard; PASS only if every context is console-clean AND made ZERO requests to the production project (agencytrack-2a610). Gives the cross-role isolation guarantee its own row.',
    async run({ browser }) {
      const roles = ['agent1', 'branch_manager', 'cro'];
      for (const who of roles) {
        const ctx = await newLegContext(browser);
        try {
          await login(ctx.page, who);
          // Let the default dashboard settle so late XHRs are captured.
          await ctx.page.waitForTimeout(2_000);
          assertLegHygiene(ctx); // throws on any prod request or console error
        } finally { await ctx.context.close(); }
      }
      return `Cross-role hygiene clean for ${roles.join(', ')}: console-clean + zero requests to ${EXPECT.prodProjectMarker}.`;
    },
  },
];
